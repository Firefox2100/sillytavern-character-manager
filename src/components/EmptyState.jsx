import { useI18n } from '../i18n/i18nContext.js'

export function EmptyState({ searchTerm }) {
  const { t } = useI18n()

  return (
    <div className="empty-state">
      <h2>{t('noCardsTitle')}</h2>
      <p>
        {searchTerm
          ? t('noCardsSearch', { searchTerm })
          : t('noCardsDefault')}
      </p>
    </div>
  )
}
