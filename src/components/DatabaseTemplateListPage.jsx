import { AuthorFilter } from './AuthorFilter.jsx'
import { useI18n } from '../i18n/i18nContext.js'

export function DatabaseTemplateListPage({
  items,
  isCheckingSession,
  isLoading,
  authorOptions,
  selectedAuthorId,
  onAuthorChange,
  labels,
}) {
  const { t } = useI18n()
  const showItems = !isCheckingSession && !isLoading && items.length > 0
  const showEmptyState = !isCheckingSession && !isLoading && items.length === 0

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
        <div className="list-toolbar">
          <div>
            <p className="section-kicker">{t(labels.tab)}</p>
            <h2>{t(labels.pageTitle)}</h2>
          </div>
          <p>{t(labels.count, { count: items.length })}</p>
        </div>

        {isCheckingSession ? (
          <StatusPanel
            title={t('checkingSessionTitle')}
            message={t('checkingSessionMessage')}
          />
        ) : null}

        {isLoading ? (
          <StatusPanel
            title={t(labels.loadingTitle)}
            message={t(labels.loadingMessage)}
          />
        ) : null}

        {showItems ? (
          <div className="template-list">
            {items.map((item) => (
              <TemplateListItem key={item.id} item={item} labels={labels} />
            ))}
          </div>
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

function TemplateListItem({ item, labels }) {
  const { t } = useI18n()
  const author =
    item.author ??
    (item.authorId
      ? t('authorById', { id: item.authorId })
      : t('unknownAuthor'))

  return (
    <article className="template-list-item">
      <div className="template-list-main">
        <div>
          <h3>{item.name}</h3>
          <p>{t('byAuthor', { author })}</p>
        </div>
        <dl className="template-metadata">
          <MetadataItem label={t('version')} value={item.version} />
          <MetadataItem label={t(labels.file)} value={item.fileName} />
          <MetadataItem
            label={t('previousVersion')}
            value={item.previousVersion}
          />
          {item.sourceUrl ? (
            <div>
              <dt>{t('sourceUrl')}</dt>
              <dd>
                <a href={getExternalUrl(item.sourceUrl)} target="_blank" rel="noreferrer">
                  {item.sourceUrl}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      {item.fileContent ? (
        <pre className="template-preview">
          {formatTemplatePreview(item.fileContent)}
        </pre>
      ) : (
        <p className="no-tags">{t(labels.noPreview)}</p>
      )}
    </article>
  )
}

function MetadataItem({ label, value }) {
  if (!value) {
    return null
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function StatusPanel({ title, message }) {
  return (
    <div className="status-panel">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  )
}

function formatTemplatePreview(template) {
  try {
    return JSON.stringify(JSON.parse(template), null, 2)
  } catch {
    return template
  }
}

function getExternalUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
