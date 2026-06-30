import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/i18nContext.js'
import { fetchAssetBlob } from '../services/directusClient.js'
import { extractCardExcerptFromPng } from '../services/sillyTavernCard.js'

export function CharacterDetailPage({
  character,
  selectedVersionId,
  onBack,
  onVersionChange,
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
            <p className="eyebrow">{t('characterDetails')}</p>
            <h2 id="detail-title">{character.name}</h2>
            <p className="detail-author">{t('byAuthor', { author })}</p>
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

          <div className="detail-section">
            <h3>{t('tags')}</h3>
            {selectedVersion.tags.length > 0 ? (
              <ul className="tag-list" aria-label={t('tagsLabel', { name: character.name })}>
                {selectedVersion.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
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

function getExternalUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
