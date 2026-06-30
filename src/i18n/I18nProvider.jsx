import { useMemo, useState } from 'react'
import { I18nContext } from './i18nContext.js'
import { defaultLanguage, languages, translations } from './translations.js'

const LANGUAGE_STORAGE_KEY = 'sillytavern-character-manager.language'

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage)

  const value = useMemo(() => {
    function setLanguage(nextLanguage) {
      const supportedLanguage = getSupportedLanguage(nextLanguage)
      setLanguageState(supportedLanguage)
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, supportedLanguage)
      document.documentElement.lang = supportedLanguage
    }

    function t(key, values = {}) {
      const template =
        translations[language]?.[key] ?? translations[defaultLanguage][key] ?? key

      return Object.entries(values).reduce(
        (message, [name, value]) => message.replaceAll(`{${name}}`, value),
        template,
      )
    }

    return {
      language,
      languages,
      setLanguage,
      t,
    }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function getInitialLanguage() {
  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  const initialLanguage = getSupportedLanguage(
    storedLanguage ?? window.navigator.language,
  )

  document.documentElement.lang = initialLanguage
  return initialLanguage
}

function getSupportedLanguage(language) {
  const normalizedLanguage = language?.toLowerCase()

  if (normalizedLanguage?.startsWith('zh')) {
    return 'zh'
  }

  return languages.some(({ code }) => code === normalizedLanguage)
    ? normalizedLanguage
    : defaultLanguage
}
