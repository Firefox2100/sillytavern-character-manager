import { useEffect, useState } from 'react'
import { AuthorFilter } from './AuthorFilter.jsx'
import { useI18n } from '../i18n/i18nContext.js'
import {
  downloadAsset,
  fetchAssetText,
} from '../services/directusClient.js'

export function ResourceListPage({
  items,
  isCheckingSession,
  isLoading,
  authorOptions,
  selectedAuthorId,
  selectedItemId,
  onAuthorChange,
  labels,
  resourceTypes,
  activeType,
  onTypeChange,
}) {
  const { t } = useI18n()
  const showItems = !isCheckingSession && !isLoading && items.length > 0
  const showEmptyState = !isCheckingSession && !isLoading && items.length === 0
  const selectedItemExists = selectedItemId == null || items.some(
    (item) => String(item.id) === String(selectedItemId),
  )

  useEffect(() => {
    if (!selectedItemId || !showItems) return

    const selectedItem = document.getElementById(`resource-${activeType}-${selectedItemId}`)
    if (!selectedItem) return

    selectedItem.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'center',
    })
    selectedItem.focus({ preventScroll: true })
  }, [activeType, selectedItemId, showItems])

  return (
    <section className="workspace" aria-label={t(labels.pageTitle)}>
      <aside className="filter-panel" aria-label={t('filters')}>
        <div className="panel-heading">
          <h2>{t('filters')}</h2>
          <span>{items.length}</span>
        </div>
        <div className="filter-stack">
          <AuthorFilter
            authors={authorOptions}
            selectedAuthorId={selectedAuthorId}
            onAuthorChange={onAuthorChange}
          />
        </div>
      </aside>

      <section className="content-panel">
        <nav className="resource-switcher" aria-label={t('resourceTypes')}>
          {resourceTypes.map((resourceType) => (
            <button
              key={resourceType.id}
              type="button"
              className={resourceType.id === activeType ? 'is-active' : ''}
              aria-current={resourceType.id === activeType ? 'page' : undefined}
              onClick={() => onTypeChange(resourceType.id)}
            >
              {t(resourceType.label)}
            </button>
          ))}
        </nav>

        <div className="list-toolbar resource-toolbar">
          <div>
            <h2>{t(labels.pageTitle)}</h2>
            <p className="resource-intro">{t('resourcePrivacyNote')}</p>
          </div>
          <p>{t(labels.count, { count: items.length })}</p>
        </div>

        {isCheckingSession ? (
          <StatusPanel title={t('checkingSessionTitle')} message={t('checkingSessionMessage')} />
        ) : null}
        {isLoading ? (
          <StatusPanel title={t(labels.loadingTitle)} message={t(labels.loadingMessage)} />
        ) : null}
        {showItems ? (
          <div className="template-list">
            {items.map((item) => (
              <ResourceListItem
                key={item.id}
                item={item}
                labels={labels}
                resourceType={activeType}
                isSelected={String(item.id) === String(selectedItemId)}
              />
            ))}
          </div>
        ) : null}
        {!isCheckingSession && !isLoading && selectedItemId && !selectedItemExists ? (
          <p className="form-error resource-target-error" role="alert">
            {t('recommendedResourceUnavailable')}
          </p>
        ) : null}
        {showEmptyState ? (
          <div className="empty-state">
            <h2>{t(labels.emptyTitle)}</h2>
            <p>{t(labels.emptyMessage)}</p>
          </div>
        ) : null}
      </section>
    </section>
  )
}

function ResourceListItem({ item, labels, resourceType, isSelected }) {
  const { t } = useI18n()
  const [preview, setPreview] = useState({ status: 'idle', content: '', error: '' })
  const [download, setDownload] = useState({ status: 'idle', error: '' })
  const previewId = `resource-preview-${resourceType}-${item.id}`
  const author = item.author ?? (item.authorId
    ? t('authorById', { id: item.authorId })
    : t('unknownAuthor'))

  async function togglePreview() {
    if (preview.status === 'loaded') {
      setPreview({ status: 'idle', content: '', error: '' })
      return
    }

    if (!item.fileId) return
    setPreview({ status: 'loading', content: '', error: '' })

    try {
      const content = await fetchAssetText(item.fileId)
      setPreview({ status: 'loaded', content, error: '' })
    } catch {
      setPreview({ status: 'error', content: '', error: t('resourcePreviewFailed') })
    }
  }

  async function downloadResource() {
    if (!item.fileId || !item.fileName) return
    setDownload({ status: 'loading', error: '' })
    try {
      await downloadAsset(item.fileId, item.fileName)
      setDownload({ status: 'idle', error: '' })
    } catch {
      setDownload({ status: 'error', error: t('resourceDownloadFailed') })
    }
  }

  return (
    <article
      id={`resource-${resourceType}-${item.id}`}
      className={`template-list-item ${isSelected ? 'is-selected' : ''}`}
      tabIndex={isSelected ? -1 : undefined}
      aria-label={isSelected ? t('selectedRecommendedResource', { name: item.name }) : undefined}
    >
      <div className="template-list-main">
        <div>
          <h3>{item.name}</h3>
          <p>{t('byAuthor', { author })}</p>
        </div>
        <dl className="template-metadata">
          <MetadataItem label={t('version')} value={item.version} />
          <MetadataItem label={t(labels.file)} value={item.fileName} />
          <MetadataItem label={t('previousVersion')} value={item.previousVersion} />
          {item.sourceUrl ? (
            <div>
              <dt>{t('sourceUrl')}</dt>
              <dd><a href={getExternalUrl(item.sourceUrl)} target="_blank" rel="noreferrer">{item.sourceUrl}</a></dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="resource-actions">
        <button
          className="secondary-action"
          type="button"
          disabled={!item.fileId || preview.status === 'loading'}
          aria-expanded={preview.status === 'loaded'}
          aria-controls={previewId}
          onClick={togglePreview}
        >
          {preview.status === 'loading'
            ? t('loadingResourcePreview')
            : preview.status === 'loaded'
              ? t('hideResourcePreview')
              : t('viewResourcePreview')}
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={!item.fileId || !item.fileName || download.status === 'loading'}
          onClick={downloadResource}
        >
          {download.status === 'loading' ? t('downloadingResource') : t('downloadResource')}
        </button>
        <span className="resource-load-note">{t('resourceLoadNote')}</span>
      </div>

      {preview.status === 'loaded' ? (
        <pre id={previewId} className="template-preview">{formatResourcePreview(preview.content)}</pre>
      ) : null}
      {preview.status === 'error' ? <p className="form-error" role="alert">{preview.error}</p> : null}
      {download.status === 'error' ? <p className="form-error" role="alert">{download.error}</p> : null}
    </article>
  )
}

function MetadataItem({ label, value }) {
  return value ? <div><dt>{label}</dt><dd>{value}</dd></div> : null
}

function StatusPanel({ title, message }) {
  return <div className="status-panel" role="status" aria-live="polite"><h2>{title}</h2><p>{message}</p></div>
}

function formatResourcePreview(content) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

function getExternalUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
