import { useI18n } from '../i18n/i18nContext.js'

export function SearchInput({ value, onChange }) {
  const { t } = useI18n()

  return (
    <label className="search-field">
      <span>{t('searchCards')}</span>
      <input
        type="search"
        value={value}
        placeholder={t('searchPlaceholder')}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
