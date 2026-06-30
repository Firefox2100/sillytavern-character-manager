import { useI18n } from '../i18n/i18nContext.js'

export function LanguageSwitcher() {
  const { language, languages, setLanguage, t } = useI18n()

  return (
    <label className="language-switcher">
      <span>{t('language')}</span>
      <select
        value={language}
        aria-label={t('language')}
        onChange={(event) => setLanguage(event.target.value)}
      >
        {languages.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
