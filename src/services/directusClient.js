import { authentication, createDirectus, readItems, rest } from '@directus/sdk'

const DIRECTUS_PATH = '/api'
const DIRECTUS_URL = new URL(DIRECTUS_PATH, window.location.origin).toString()
const AUTH_STORAGE_KEY = 'sillytavern-character-manager.auth'
const CHARACTER_PREVIEW_TRANSFORM = { key: 'character-card-preview' }

function createLocalStorageAdapter(key) {
  return {
    get() {
      const storedValue = window.localStorage.getItem(key)
      return storedValue ? JSON.parse(storedValue) : null
    },
    set(value) {
      window.localStorage.setItem(key, JSON.stringify(value))
    },
  }
}

export const directusClient = createDirectus(DIRECTUS_URL)
  .with(rest())
  .with(
    authentication('json', {
      storage: createLocalStorageAdapter(AUTH_STORAGE_KEY),
    }),
  )

export async function loginToDirectus({ username, password, otp }) {
  const credentials = {
    email: username,
    password,
  }

  return directusClient.login(credentials, otp ? { otp } : undefined)
}

export async function logoutFromDirectus() {
  await directusClient.logout()
}

export async function hasDirectusSession() {
  const token = await directusClient.getToken()
  return Boolean(token)
}

export async function fetchCharacterCards() {
  const [characters, versions] = await Promise.all([
    directusClient.request(
      readItems('characters', {
        fields: [
          'id',
          'name',
          'description',
          'url',
          'root_asset.id',
          'root_asset.name',
          'forked_from.id',
          'forked_from.version',
          'author.id',
          'author.name',
        ],
        limit: -1,
        sort: ['name'],
      }),
    ),
    directusClient.request(
      readItems('character_versions', {
        fields: [
          'id',
          'character',
          'version',
          'version_note',
          'card',
          'tags.*',
          'tags.tags_id.*',
          'recommended_template.id',
          'recommended_template.name',
          'recommended_template.version',
          'recommended_world_book.id',
          'recommended_world_book.name',
          'recommended_world_book.version',
          'recommended_preset.id',
          'recommended_preset.name',
          'recommended_preset.version',
          'recommended_tasks.x_tasks_id.id',
          'recommended_tasks.x_tasks_id.name',
          'recommended_tasks.x_tasks_id.version',
        ],
        limit: -1,
        sort: ['-id'],
      }),
    ),
  ])

  const versionsByCharacter = versions.reduce((groupedVersions, version) => {
    const characterId = getRelationId(version.character)
    const characterKey = getRelationKey(characterId)

    if (characterKey) {
      groupedVersions.set(characterKey, [
        ...(groupedVersions.get(characterKey) ?? []),
        normalizeVersion(version),
      ])
    }

    return groupedVersions
  }, new Map())

  return characters.map((character) => {
    const characterVersions = versionsByCharacter.get(getRelationKey(character.id)) ?? []
    const latestVersion = characterVersions[0] ?? null

    return {
      id: character.id,
      name: character.name,
      author: getAuthorName(character.author),
      authorId: getRelationId(character.author),
      description: character.description,
      forkedFromCharacterId: getRelationId(character.root_asset),
      forkedFromCharacterName: getCharacterName(character.root_asset),
      forkedFromVersion: getForkedVersion(character.forked_from),
      forkedFromVersionId: getRelationId(character.forked_from),
      sourceUrl: character.url,
      version: latestVersion?.version ?? null,
      versionId: latestVersion?.id ?? null,
      imageAssetId: latestVersion?.assetId ?? null,
      imageUrl: null,
      tags: latestVersion?.tags ?? [],
      versions: characterVersions.map((version) => ({
        ...version,
        imageUrl: null,
      })),
    }
  })
}

export async function fetchDatabaseTemplates() {
  return fetchFileBackedCollection('database_templates', 'template')
}

export async function fetchWorldBooks() {
  return fetchFileBackedCollection('world_books', 'world_book')
}

export async function fetchPresets() {
  return fetchFileBackedCollection('presets', 'preset')
}

export async function fetchTasks() {
  return fetchFileBackedCollection('x_tasks', 'task')
}

async function fetchFileBackedCollection(collectionName, fileField) {
  const items = await directusClient.request(
    readItems(collectionName, {
      fields: [
        'id',
        'name',
        `${fileField}.id`,
        `${fileField}.filename_download`,
        `${fileField}.title`,
        'version',
        'url',
        'author.id',
        'author.name',
        'previous_version.id',
        'previous_version.version',
      ],
      limit: -1,
      sort: ['name'],
    }),
  )

  return items.map((item) => {
    const fileId = getRelationId(item[fileField])

    return {
      id: item.id,
      name: item.name,
      fileId,
      fileName: getFileName(item[fileField]),
      version: item.version,
      sourceUrl: item.url,
      author: getAuthorName(item.author),
      authorId: getRelationId(item.author),
      previousVersionId: getRelationId(item.previous_version),
      previousVersion: getPreviousVersionName(item.previous_version),
    }
  })
}

function getRelationKey(relationId) {
  return relationId == null ? null : String(relationId)
}

function getRelationId(relation) {
  if (relation == null) {
    return null
  }

  if (typeof relation === 'object') {
    return relation.id ?? null
  }

  return relation
}

function getAuthorName(author) {
  if (!author) {
    return null
  }

  if (typeof author === 'object') {
    return author.name ?? null
  }

  return null
}

function getCharacterName(character) {
  if (!character || typeof character !== 'object') {
    return null
  }

  return character.name ?? null
}

function getForkedVersion(version) {
  if (!version || typeof version !== 'object') {
    return null
  }

  return version.version ?? null
}

function getPreviousVersionName(previousVersion) {
  if (!previousVersion || typeof previousVersion !== 'object') {
    return null
  }

  return previousVersion.version ?? null
}

function normalizeVersion(version) {
  return {
    id: version.id,
    version: version.version,
    versionNote: version.version_note,
    assetId: getRelationId(version.card),
    tags: getTagNames(version.tags),
    recommendations: {
      templates: normalizeRecommendedItems(version.recommended_template),
      worldBooks: normalizeRecommendedItems(version.recommended_world_book),
      presets: normalizeRecommendedItems(version.recommended_preset),
      tasks: normalizeRecommendedItems(
        version.recommended_tasks,
        'x_tasks_id',
      ),
    },
  }
}

function normalizeRecommendedItems(value, relationField) {
  const values = Array.isArray(value) ? value : value ? [value] : []

  return values
    .map((entry) => relationField ? entry?.[relationField] : entry)
    .filter(Boolean)
    .map((item) => ({
      id: getRelationId(item),
      name: typeof item === 'object' ? item.name ?? null : null,
      version: typeof item === 'object' ? item.version ?? null : null,
    }))
    .filter((item) => item.id != null)
}

function getTagNames(tags = []) {
  return tags
    .map((tagRelation) => {
      const tag = tagRelation?.tags_id ?? tagRelation?.tag ?? tagRelation

      if (typeof tag === 'string') {
        return tag
      }

      return tag?.name
    })
    .filter(Boolean)
}

export async function fetchAssetObjectUrl(assetId) {
  const blob = await fetchAsset(assetId, undefined, CHARACTER_PREVIEW_TRANSFORM)
  return URL.createObjectURL(blob)
}

export async function fetchAssetBlob(assetId) {
  return fetchAsset(assetId)
}

export async function downloadAsset(assetId, fileName) {
  const blob = await fetchAsset(assetId, fileName)
  const objectUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')

  downloadLink.href = objectUrl
  downloadLink.download = fileName
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(objectUrl)
}

async function fetchAsset(assetId, fileName, transformation = {}) {
  const token = await directusClient.getToken()
  const filenamePath = fileName ? `/${encodeURIComponent(fileName)}` : ''
  const query = new URLSearchParams(transformation)

  if (fileName) {
    query.set('download', '')
  }

  const queryString = query.size > 0 ? `?${query.toString()}` : ''
  const response = await fetch(
    `${DIRECTUS_URL}/assets/${assetId}${filenamePath}${queryString}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  )

  if (!response.ok) {
    throw Object.assign(new Error('imageLoadError'), {
      i18nKey: 'imageLoadError',
      values: { assetId },
    })
  }

  return response.blob()
}

export async function createSignedFileLink(
  assetId,
  options = { ttlSeconds: 300, download: true },
) {
  const token = await directusClient.getToken()
  const response = await fetch(`${DIRECTUS_URL}/signed-files/${assetId}/sign`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ttl_seconds: options.ttlSeconds,
      download: options.download,
    }),
  })

  if (!response.ok) {
    throw new Error(`Could not create signed link for file ${assetId}.`)
  }

  const payload = await response.json()
  return payload.data?.url
}

export async function fetchAssetText(assetId) {
  const blob = await fetchAssetBlob(assetId)
  return blob.text()
}

function getFileName(file) {
  if (!file || typeof file !== 'object') {
    return null
  }

  return file.filename_download ?? file.title ?? null
}
