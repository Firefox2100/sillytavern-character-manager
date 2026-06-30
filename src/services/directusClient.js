import { authentication, createDirectus, readItems, rest } from '@directus/sdk'

const DIRECTUS_PATH = '/api'
const DIRECTUS_URL = new URL(DIRECTUS_PATH, window.location.origin).toString()
const AUTH_STORAGE_KEY = 'sillytavern-character-manager.auth'

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

export async function loginToDirectus({ username, password }) {
  return directusClient.login({
    email: username,
    password,
  })
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
        fields: ['id', 'name', 'description', 'url', 'author.id', 'author.name'],
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

  return Promise.all(characters.map(async (character) => {
    const characterVersions = versionsByCharacter.get(getRelationKey(character.id)) ?? []
    const latestVersion = characterVersions[0] ?? null
    const imageUrl = latestVersion?.assetId
      ? await fetchAssetObjectUrl(latestVersion.assetId)
      : null

    return {
      id: character.id,
      name: character.name,
      author: getAuthorName(character.author),
      authorId: getRelationId(character.author),
      description: character.description,
      sourceUrl: character.url,
      version: latestVersion?.version ?? null,
      versionId: latestVersion?.id ?? null,
      imageUrl,
      tags: latestVersion?.tags ?? [],
      versions: characterVersions.map((version, index) => ({
        ...version,
        imageUrl: index === 0 ? imageUrl : null,
      })),
    }
  }))
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

function normalizeVersion(version) {
  return {
    id: version.id,
    version: version.version,
    versionNote: version.version_note,
    assetId: getRelationId(version.card),
    tags: getTagNames(version.tags),
  }
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
  const blob = await fetchAssetBlob(assetId)
  return URL.createObjectURL(blob)
}

export async function fetchAssetBlob(assetId) {
  const token = await directusClient.getToken()
  const response = await fetch(`${DIRECTUS_URL}/assets/${assetId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (!response.ok) {
    throw Object.assign(new Error('imageLoadError'), {
      i18nKey: 'imageLoadError',
      values: { assetId },
    })
  }

  return response.blob()
}

export function releaseCharacterCardImages(characters) {
  characters.forEach((character) => {
    if (character.imageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(character.imageUrl)
    }

    character.versions?.forEach((version) => {
      if (version.imageUrl?.startsWith('blob:') && version.imageUrl !== character.imageUrl) {
        URL.revokeObjectURL(version.imageUrl)
      }
    })
  })
}
