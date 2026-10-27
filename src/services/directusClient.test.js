import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => {
  const state = {}
  const client = {
    with: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getToken: vi.fn(),
    request: vi.fn(),
  }
  client.with.mockReturnValue(client)

  return {
    client,
    state,
    authentication: vi.fn((_mode, options) => {
      state.authenticationOptions = options
      return 'authentication-extension'
    }),
    createDirectus: vi.fn(() => client),
    readItems: vi.fn((collection, query) => ({ collection, query })),
    rest: vi.fn(() => 'rest-extension'),
  }
})

vi.mock('@directus/sdk', () => sdk)

import {
  createSignedFileLink,
  directusClient,
  downloadAsset,
  fetchAssetBlob,
  fetchAssetObjectUrl,
  fetchAssetText,
  fetchCharacterCards,
  fetchDatabaseTemplates,
  fetchPresets,
  fetchTasks,
  fetchWorldBooks,
  hasDirectusSession,
  loginToDirectus,
  logoutFromDirectus,
} from './directusClient.js'

describe('Directus client service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sdk.client.with.mockReturnValue(sdk.client)
    sdk.client.getToken.mockResolvedValue(null)
    globalThis.fetch = vi.fn()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('configures JSON authentication with persistent local storage', () => {
    expect(directusClient).toBe(sdk.client)
    const options = sdk.state.authenticationOptions

    expect(options.storage.get()).toBeNull()
    options.storage.set({ access_token: 'synthetic-token' })
    expect(options.storage.get()).toEqual({ access_token: 'synthetic-token' })
  })

  it('logs in with optional OTP, logs out, and detects sessions', async () => {
    sdk.client.login.mockResolvedValue({ access_token: 'token' })
    sdk.client.getToken.mockResolvedValueOnce('token').mockResolvedValueOnce(null)

    await loginToDirectus({ username: 'user@example.test', password: 'safe', otp: '123456' })
    expect(sdk.client.login).toHaveBeenCalledWith(
      { email: 'user@example.test', password: 'safe' },
      { otp: '123456' },
    )

    await loginToDirectus({ username: 'user@example.test', password: 'safe' })
    expect(sdk.client.login).toHaveBeenLastCalledWith(
      { email: 'user@example.test', password: 'safe' },
      undefined,
    )
    await expect(hasDirectusSession()).resolves.toBe(true)
    await expect(hasDirectusSession()).resolves.toBe(false)
    await logoutFromDirectus()
    expect(sdk.client.logout).toHaveBeenCalledOnce()
  })

  it('normalizes characters, versions, tags, forks, and recommendations', async () => {
    sdk.client.request.mockImplementation(({ collection }) => {
      if (collection === 'characters') {
        return Promise.resolve([
          {
            id: 1,
            name: 'Alpha',
            description: 'Synthetic description',
            url: 'example.test/alpha',
            author: { id: 9, name: 'Author' },
            root_asset: { id: 2, name: 'Origin' },
            forked_from: { id: 20, version: '0.9' },
          },
          { id: 2, name: 'Empty', author: 9 },
        ])
      }

      return Promise.resolve([
        {
          id: 11,
          character: 1,
          version: '2.0',
          version_note: 'Current',
          card: { id: 'card-11' },
          tags: [
            { tags_id: { name: 'hero' } },
            { tag: 'adventure' },
            null,
          ],
          recommended_template: { id: 31, name: 'Template', version: '1' },
          recommended_world_book: [{ id: 32 }],
          recommended_preset: null,
          recommended_tasks: [
            { x_tasks_id: { id: 33, name: 'Task' } },
            { x_tasks_id: null },
          ],
        },
        { id: 99, character: null, tags: [] },
      ])
    })

    await expect(fetchCharacterCards()).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        author: 'Author',
        authorId: 9,
        forkedFromCharacterId: 2,
        forkedFromCharacterName: 'Origin',
        forkedFromVersionId: 20,
        version: '2.0',
        versionId: 11,
        imageAssetId: 'card-11',
        tags: ['hero', 'adventure'],
        versions: [
          expect.objectContaining({
            id: 11,
            recommendations: {
              templates: [{ id: 31, name: 'Template', version: '1' }],
              worldBooks: [{ id: 32, name: null, version: null }],
              presets: [],
              tasks: [{ id: 33, name: 'Task', version: null }],
            },
          }),
        ],
      }),
      expect.objectContaining({
        id: 2,
        author: null,
        versions: [],
        version: null,
      }),
    ])
  })

  it.each([
    ['fetchDatabaseTemplates', fetchDatabaseTemplates, 'database_templates', 'template'],
    ['fetchWorldBooks', fetchWorldBooks, 'world_books', 'world_book'],
    ['fetchPresets', fetchPresets, 'presets', 'preset'],
    ['fetchTasks', fetchTasks, 'x_tasks', 'task'],
  ])('normalizes file-backed collections through %s', async (_name, load, collection, field) => {
    sdk.client.request.mockResolvedValue([
      {
        id: 1,
        name: 'Resource',
        [field]: { id: 'file-1', filename_download: 'resource.json', title: 'Fallback' },
        version: '1.0',
        url: 'https://example.test/resource',
        author: { id: 4, name: 'Collector' },
        previous_version: { id: 3, version: '0.9' },
      },
      { id: 2, name: 'Minimal', [field]: { id: 'file-2', title: 'fallback.json' } },
    ])

    await expect(load()).resolves.toEqual([
      {
        id: 1,
        name: 'Resource',
        fileId: 'file-1',
        fileName: 'resource.json',
        version: '1.0',
        sourceUrl: 'https://example.test/resource',
        author: 'Collector',
        authorId: 4,
        previousVersionId: 3,
        previousVersion: '0.9',
      },
      expect.objectContaining({ fileId: 'file-2', fileName: 'fallback.json' }),
    ])
    expect(sdk.readItems).toHaveBeenCalledWith(collection, expect.any(Object))
  })

  it('fetches previews, blobs, text, and downloads with authentication', async () => {
    const blob = new Blob(['synthetic text'])
    sdk.client.getToken.mockResolvedValue('access-token')
    fetch.mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) })

    await expect(fetchAssetObjectUrl('preview asset')).resolves.toBe('blob:synthetic')
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/assets/preview asset?key=character-card-preview',
      { headers: { Authorization: 'Bearer access-token' } },
    )
    await expect(fetchAssetBlob('raw')).resolves.toBe(blob)
    await expect(fetchAssetText('text')).resolves.toBe('synthetic text')

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await downloadAsset('download', 'file name.json')
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/assets/download/file%20name.json?download=',
      { headers: { Authorization: 'Bearer access-token' } },
    )
    expect(click).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic')
  })

  it('reports asset and signed-link failures and supports signed-link options', async () => {
    fetch.mockResolvedValueOnce({ ok: false })
    await expect(fetchAssetBlob('missing')).rejects.toMatchObject({
      i18nKey: 'imageLoadError',
      values: { assetId: 'missing' },
    })

    fetch.mockResolvedValueOnce({ ok: false })
    await expect(createSignedFileLink('missing')).rejects.toThrow(
      'Could not create signed link for file missing.',
    )

    sdk.client.getToken.mockResolvedValue('access-token')
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { url: 'https://example.test/signed' } }),
    })
    await expect(
      createSignedFileLink('file-1', { ttlSeconds: 60, download: false }),
    ).resolves.toBe('https://example.test/signed')
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/signed-files/file-1/sign',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer access-token',
        },
        body: JSON.stringify({ ttl_seconds: 60, download: false }),
      }),
    )
  })
})
