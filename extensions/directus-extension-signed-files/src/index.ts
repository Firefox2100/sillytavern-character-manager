import { defineEndpoint } from '@directus/extensions-sdk';
import {
	ForbiddenError,
	InvalidPayloadError,
} from '@directus/errors';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { Readable } from 'node:stream';

type SignRequestBody = {
	ttl_seconds?: number;
	download?: boolean;

	/**
	 * Optional stronger permission check:
	 * If supplied, the extension verifies that the authenticated user can read
	 * this collection item and that the requested field contains the file id.
	 */
	collection?: string;
	item_id?: string | number;
	field?: string;
};

type SignedPayload = {
	file_id: string;
	iat: number;
	exp: number;
	download: boolean;
	jti: string;
};

type DirectusFile = {
	id: string;
	filename_download?: string;
	type?: string;
	filesize?: number;
};

type AssetResult = {
	stream: Readable;
	file: DirectusFile;
	stat?: {
		size?: number;
	};
};

function b64url(value: string | Buffer): string {
	return Buffer.from(value).toString('base64url');
}

function makeToken(payload: SignedPayload, secret: string): string {
	const body = b64url(JSON.stringify(payload));
	const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');

	return `${body}.${signature}`;
}

function verifyToken(token: string, secret: string): SignedPayload {
	const parts = token.split('.');

	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		throw new ForbiddenError({ reason: 'Malformed signed file token' });
	}

	const [body, signature] = parts;
	const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');

	if (
		signature.length !== expected.length ||
		!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
	) {
		throw new ForbiddenError({ reason: 'Invalid signed file token' });
	}

	const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SignedPayload;

	if (Math.floor(Date.now() / 1000) > payload.exp) {
		throw new ForbiddenError({ reason: 'Signed file token has expired' });
	}

	return payload;
}

function getSecret(env: Record<string, unknown>): string {
	const secret = env['SIGNED_FILES_SECRET'];

	if (typeof secret !== 'string' || secret.length < 32) {
		throw new Error('SIGNED_FILES_SECRET must be set and at least 32 characters long');
	}

	return secret;
}

function getPublicBaseUrl(req: Request, env: Record<string, unknown>): string {
	const configured = env['PUBLIC_URL'];

	if (typeof configured === 'string' && configured.length > 0) {
		return configured.replace(/\/$/, '');
	}

	return `${req.protocol}://${req.get('host')}`;
}

function getTtlSeconds(body: SignRequestBody, env: Record<string, unknown>): number {
	const defaultTtl = Number(env['SIGNED_FILES_DEFAULT_TTL_SECONDS'] ?? 300);
	const maxTtl = Number(env['SIGNED_FILES_MAX_TTL_SECONDS'] ?? 900);
	const requestedTtl = Number(body.ttl_seconds ?? defaultTtl);

	if (!Number.isFinite(requestedTtl) || requestedTtl <= 0) {
		throw new InvalidPayloadError({ reason: 'ttl_seconds must be a positive number' });
	}

	return Math.min(requestedTtl, maxTtl);
}

function setFileHeaders(res: Response, file: DirectusFile, asset: AssetResult, download: boolean): void {
	if (file.type) {
		res.setHeader('Content-Type', file.type);
	}

	if (asset.stat?.size) {
		res.setHeader('Content-Length', String(asset.stat.size));
	} else if (file.filesize) {
		res.setHeader('Content-Length', String(file.filesize));
	}

	res.setHeader('Cache-Control', 'private, no-store');

	if (download) {
		const filename = file.filename_download ?? file.id;
		const safeFilename = filename.replaceAll('"', '\\"');

		res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
	}
}

function fieldContainsFileId(value: unknown, fileId: string): boolean {
	if (value === fileId) return true;

	if (Array.isArray(value)) {
		return value.some((entry) => {
			if (entry === fileId) return true;

			if (
				entry &&
				typeof entry === 'object' &&
				'id' in entry &&
				(entry as { id?: unknown }).id === fileId
			) {
				return true;
			}

			return false;
		});
	}

	if (
		value &&
		typeof value === 'object' &&
		'id' in value &&
		(value as { id?: unknown }).id === fileId
	) {
		return true;
	}

	return false;
}

export default defineEndpoint({
	id: 'signed-files',
	handler: (router, context) => {
		const { services, getSchema, env, logger } = context;
		const { FilesService, ItemsService, AssetsService } = services;

		router.post('/:fileId/sign', async (req, res, next) => {
			try {
				if (!req.accountability?.user) {
					throw new ForbiddenError({ reason: 'Authentication required' });
				}

				const fileId = req.params.fileId;

				if (!fileId) {
					throw new InvalidPayloadError({ reason: 'Missing file id' });
				}

				const body = (req.body ?? {}) as SignRequestBody;
				const secret = getSecret(env);
				const ttlSeconds = getTtlSeconds(body, env);
				const schema = await getSchema();

				/*
				* Permission check path 1:
				* If collection/item/field is supplied, verify the authenticated user
				* can read the item and that the field actually references this file.
				*/
				if (body.collection && body.item_id !== undefined && body.field) {
					const itemsService = new ItemsService(body.collection, {
						schema,
						accountability: req.accountability,
					});

					const item = await itemsService.readOne(body.item_id, {
						fields: [body.field],
					});

					if (!fieldContainsFileId(item[body.field], fileId)) {
						throw new ForbiddenError({
							reason: 'The requested file is not referenced by the supplied item field',
						});
					}
				}

				/*
				* Permission check path 2:
				* Direct file read permission.
				* This still runs even if item/field was supplied, because it also confirms
				* the file exists and gives us metadata.
				*/
				const filesService = new FilesService({
					schema,
					accountability: req.accountability,
				});

				const file = (await filesService.readOne(fileId, {
					fields: ['id', 'filename_download', 'type', 'filesize'],
				})) as DirectusFile;

				const now = Math.floor(Date.now() / 1000);

				const payload: SignedPayload = {
					file_id: file.id,
					iat: now,
					exp: now + ttlSeconds,
					download: body.download ?? true,
					jti: crypto.randomUUID(),
				};

				const token = makeToken(payload, secret);
				const baseUrl = getPublicBaseUrl(req, env);

				res.json({
					data: {
						url: `${baseUrl}/signed-files/${encodeURIComponent(file.id)}/retrieve?token=${encodeURIComponent(token)}`,
						file_id: file.id,
						expires_at: new Date(payload.exp * 1000).toISOString(),
						ttl_seconds: ttlSeconds,
					},
				});
			} catch (error) {
				next(error);
			}
		});

		router.get('/:fileId/retrieve', async (req, res, next) => {
			try {
				const fileId = req.params.fileId;
				const token = String(req.query.token ?? '');

				if (!fileId || !token) {
					throw new ForbiddenError({ reason: 'Missing file id or token' });
				}

				const payload = verifyToken(token, getSecret(env));

				if (payload.file_id !== fileId) {
					throw new ForbiddenError({ reason: 'Token does not match requested file' });
				}

				const schema = await getSchema();

				/*
				* Admin accountability here is intentional.
				* The access decision was made at sign-time using the real frontend user.
				*/
				const assetsService = new AssetsService({
					schema,
					accountability: null,
				});

				const asset = (await assetsService.getAsset(fileId)) as AssetResult;

				setFileHeaders(res, asset.file, asset, payload.download);

				asset.stream.on('error', (error) => {
					logger.error(error, `Failed streaming signed file ${fileId}`);

					if (!res.headersSent) {
						next(error);
					} else {
						res.destroy(error);
					}
				});

				asset.stream.pipe(res);
			} catch (error) {
				next(error);
			}
		});
	},
});
