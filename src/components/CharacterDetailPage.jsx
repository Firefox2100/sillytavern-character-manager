import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/i18nContext.js'
import {
  createSignedFileLink,
  downloadAsset,
  fetchAssetBlob,
} from '../services/directusClient.js'
import { extractCardExcerptFromPng } from '../services/sillyTavernCard.js'

export function CharacterDetailPage({
  character,
  selectedVersionId,
  onAuthorFilter,
  onBack,
  onForkOpen,
  onTagFilter,
  onVersionChange,
  onResourceOpen,
}) {
  const { t } = useI18n()
  const [loadedImage, setLoadedImage] = useState({
    versionId: null,
    url: null,
    error: '',
  })
  const [cardExcerpt, setCardExcerpt] = useState({
    versionId: null,
    data: null,
    error: '',
  })
  const [copyState, setCopyState] = useState({
    versionId: null,
    status: 'idle',
    message: '',
  })
  const [downloadState, setDownloadState] = useState({
    versionId: null,
    status: 'idle',
    message: '',
  })

  const selectedVersion = useMemo(() => {
    if (!character) {
      return null
    }

    if (selectedVersionId) {
      return character.versions.find(
        (version) => String(version.id) === String(selectedVersionId),
      ) ?? null
    }

    return character.versions[0] ?? null
  }, [character, selectedVersionId])

  const author =
    character?.author ??
    (character?.authorId
      ? t('authorById', { id: character.authorId })
      : t('unknownAuthor'))

  useEffect(() => {
    let isMounted = true

    async function loadVersionCardData() {
      if (!selectedVersion?.assetId) {
        return
      }

      try {
        const blob = await fetchAssetBlob(selectedVersion.assetId)
        const excerpt = await extractCardExcerptFromPng(blob)

        if (isMounted) {
          const imageUrl = selectedVersion.imageUrl
            ? null
            : URL.createObjectURL(blob)

          setLoadedImage({
            versionId: selectedVersion.id,
            url: imageUrl,
            error: '',
          })
          setCardExcerpt({
            versionId: selectedVersion.id,
            data: excerpt,
            error: '',
          })
        }
      } catch (error) {
        if (isMounted) {
          const message = error?.i18nKey
            ? t(error.i18nKey, error.values)
            : error?.message ?? t('genericError')

          setLoadedImage({
            versionId: selectedVersion.id,
            url: null,
            error: message,
          })
          setCardExcerpt({
            versionId: selectedVersion.id,
            data: null,
            error: message,
          })
        }
      }
    }

    loadVersionCardData()

    return () => {
      isMounted = false
    }
  }, [selectedVersion, t])

  useEffect(() => {
    return () => {
      if (loadedImage.url?.startsWith('blob:')) {
        URL.revokeObjectURL(loadedImage.url)
      }
    }
  }, [loadedImage.url])

  if (!character || !selectedVersion) {
    return (
      <section className="detail-page">
        <div className="status-panel">
          <h2>{t('detailNotFoundTitle')}</h2>
          <p>{t('detailNotFoundMessage')}</p>
          <button className="secondary-action" type="button" onClick={onBack}>
            {t('backToCards')}
          </button>
        </div>
      </section>
    )
  }

  const loadedVersionImage =
    loadedImage.versionId === selectedVersion.id ? loadedImage : null
  const imageUrl = selectedVersion.imageUrl ?? loadedVersionImage?.url
  const imageError = loadedVersionImage?.error
  const selectedCardExcerpt =
    !selectedVersion.assetId
      ? { versionId: selectedVersion.id, data: null, error: '' }
      : cardExcerpt.versionId === selectedVersion.id ? cardExcerpt : null
  const selectedCopyState =
    copyState.versionId === selectedVersion.id ? copyState : null
  const selectedDownloadState =
    downloadState.versionId === selectedVersion.id ? downloadState : null

  async function downloadCard() {
    if (!selectedVersion.assetId) {
      return
    }

    setDownloadState({
      versionId: selectedVersion.id,
      status: 'loading',
      message: '',
    })

    try {
      await downloadAsset(selectedVersion.assetId, `${character.name}.png`)
      setDownloadState({
        versionId: selectedVersion.id,
        status: 'success',
        message: '',
      })
    } catch {
      setDownloadState({
        versionId: selectedVersion.id,
        status: 'error',
        message: t('cardDownloadFailed'),
      })
    }
  }

  async function copyDownloadLink() {
    if (!selectedVersion.assetId) {
      return
    }

    setCopyState({
      versionId: selectedVersion.id,
      status: 'loading',
      message: '',
    })

    try {
      const url = await createSignedFileLink(selectedVersion.assetId)
      await copyTextToClipboard(url)
      setCopyState({
        versionId: selectedVersion.id,
        status: 'success',
        message: t('downloadLinkCopied'),
      })
    } catch (error) {
      setCopyState({
        versionId: selectedVersion.id,
        status: 'error',
        message: error?.message ?? t('downloadLinkCopyFailed'),
      })
    }
  }

  return (
    <section className="detail-page" aria-labelledby="detail-title">
      <button className="back-link" type="button" onClick={onBack}>
        {t('backToCards')}
      </button>

      <div className="detail-layout">
        <div className="detail-image-frame">
          {imageUrl ? (
            <img
              className="detail-image"
              src={imageUrl}
              alt={t('portraitAlt', { name: character.name })}
            />
          ) : (
            <div className="detail-image detail-image-placeholder">
              {imageError || t('noCardImage')}
            </div>
          )}
        </div>

        <div className="detail-content">
          <div>
            <h2 id="detail-title">{character.name}</h2>
            <p className="detail-author">
              {character.authorId ? (
                <button
                  className="inline-filter-button"
                  type="button"
                  onClick={() => onAuthorFilter(character)}
                >
                  {t('byAuthor', { author })}
                </button>
              ) : (
                t('byAuthor', { author })
              )}
            </p>
          </div>

          <label className="detail-field">
            <span>{t('version')}</span>
            <select
              value={selectedVersion.id}
              onChange={(event) => onVersionChange(event.target.value)}
            >
              {character.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.version || t('unnamedVersion')}
                </option>
              ))}
            </select>
          </label>

          <div className="detail-actions">
            <button
              className="secondary-action"
              type="button"
              disabled={
                !selectedVersion.assetId ||
                selectedDownloadState?.status === 'loading'
              }
              onClick={downloadCard}
            >
              {selectedDownloadState?.status === 'loading'
                ? t('downloadingCard')
                : t('downloadCard')}
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={!selectedVersion.assetId || selectedCopyState?.status === 'loading'}
              onClick={copyDownloadLink}
            >
              {selectedCopyState?.status === 'loading'
                ? t('copyingDownloadLink')
                : t('copyDownloadLink')}
            </button>
            {selectedDownloadState?.message ? (
              <p className="copy-status is-error" role="alert">
                {selectedDownloadState.message}
              </p>
            ) : null}
            {selectedCopyState?.message ? (
              <p
                className={`copy-status ${
                  selectedCopyState.status === 'error' ? 'is-error' : ''
                }`}
                role={selectedCopyState.status === 'error' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {selectedCopyState.message}
              </p>
            ) : null}
          </div>

          {character.forkedFromCharacterId && character.forkedFromVersionId ? (
            <div className="detail-section">
              <h3>{t('forkedFrom')}</h3>
              <button
                className="inline-filter-button"
                type="button"
                onClick={() => onForkOpen(character)}
              >
                {formatForkSource(character)}
              </button>
            </div>
          ) : null}

          <div className="detail-section">
            <h3>{t('tags')}</h3>
            {selectedVersion.tags.length > 0 ? (
              <ul className="tag-list" aria-label={t('tagsLabel', { name: character.name })}>
                {selectedVersion.tags.map((tag) => (
                  <li key={tag}>
                    <button type="button" onClick={() => onTagFilter(tag)}>
                      {tag}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-tags">{t('noTags')}</p>
            )}
          </div>

          {character.sourceUrl ? (
            <div className="detail-section">
              <h3>{t('sourceUrl')}</h3>
              <a href={getExternalUrl(character.sourceUrl)} target="_blank" rel="noreferrer">
                {character.sourceUrl}
              </a>
            </div>
          ) : null}

          {selectedVersion.versionNote ? (
            <div className="detail-section">
              <h3>{t('versionNote')}</h3>
              <p>{selectedVersion.versionNote}</p>
            </div>
          ) : null}

          <RecommendedResources
            recommendations={selectedVersion.recommendations}
            onResourceOpen={onResourceOpen}
          />
        </div>
      </div>

      {character.description ? (
        <section className="detail-wide-section">
          <h3>{t('description')}</h3>
          <p>{character.description}</p>
        </section>
      ) : null}

      <CardExcerptSection excerptState={selectedCardExcerpt} />
    </section>
  )
}

function RecommendedResources({ recommendations, onResourceOpen }) {
  const { t } = useI18n()
  const groups = [
    ['templates', 'templatesTab'],
    ['worldBooks', 'worldBooksTab'],
    ['presets', 'presetsTab'],
    ['tasks', 'tasksTab'],
  ].map(([type, label]) => ({
    type,
    routeType: type === 'worldBooks' ? 'world-books' : type,
    label,
    items: recommendations?.[type] ?? [],
  })).filter((group) => group.items.length > 0)

  if (groups.length === 0) return null

  return (
    <section className="detail-section recommended-resources">
      <h3>{t('recommendedResources')}</h3>
      <div className="recommendation-groups">
        {groups.map((group) => (
          <div key={group.type}>
            <h4>{t(group.label)}</h4>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    className="inline-filter-button"
                    type="button"
                    onClick={() => onResourceOpen(group.routeType, item.id)}
                  >
                    {item.name ?? t('unnamedResource')}
                    {item.version ? ` · ${item.version}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function CardExcerptSection({ excerptState }) {
  const { t } = useI18n()
  const excerpt = excerptState?.data

  if (!excerptState) {
    return (
      <section className="detail-wide-section">
        <h3>{t('cardExcerpt')}</h3>
        <p>{t('cardExcerptLoading')}</p>
      </section>
    )
  }

  if (excerptState?.error) {
    return (
      <section className="detail-wide-section">
        <h3>{t('cardExcerpt')}</h3>
        <p>{excerptState.error}</p>
      </section>
    )
  }

  if (!excerpt) {
    return (
      <section className="detail-wide-section">
        <h3>{t('cardExcerpt')}</h3>
        <p>{t('cardExcerptUnavailable')}</p>
      </section>
    )
  }

  return (
    <section className="detail-wide-section">
      <h3>{t('cardExcerpt')}</h3>
      <dl className="excerpt-grid">
        <MetadataRow label={t('cardSpec')} value={formatSpec(excerpt)} />
        <MetadataRow label={t('cardName')} value={excerpt.name} />
        <MetadataRow label={t('creator')} value={excerpt.creator} />
        <MetadataRow
          label={t('characterVersion')}
          value={excerpt.characterVersion}
        />
        <MetadataRow
          label={t('alternateGreetings')}
          value={excerpt.alternateGreetingCount}
        />
        <MetadataRow
          label={t('worldBookEntries')}
          value={excerpt.worldBookEntryCount}
        />
      </dl>

      <LongExcerpt label={t('definition')} value={excerpt.definition} />
      <LongExcerpt label={t('personality')} value={excerpt.personality} />
      <LongExcerpt label={t('scenario')} value={excerpt.scenario} />
      <LongExcerpt label={t('firstMessage')} value={excerpt.firstMessage} />
      <LongExcerpt label={t('exampleMessages')} value={excerpt.exampleMessages} />
    </section>
  )
}

function MetadataRow({ label, value }) {
  return (
    <div className="metadata-row">
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  )
}

function LongExcerpt({ label, value }) {
  if (!value) {
    return null
  }

  return (
    <div className="long-excerpt">
      <h4>{label}</h4>
      <p>{value}</p>
    </div>
  )
}

function formatSpec(excerpt) {
  return [excerpt.spec, excerpt.specVersion].filter(Boolean).join(' / ')
}

function formatForkSource(character) {
  const source = [
    character.forkedFromCharacterName,
    character.forkedFromVersion,
  ].filter(Boolean).join(' / ')

  return source || `#${character.forkedFromVersionId}`
}

function getExternalUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'absolute'
  textArea.style.left = '-9999px'
  document.body.append(textArea)
  textArea.select()
  document.execCommand('copy')
  textArea.remove()
}
