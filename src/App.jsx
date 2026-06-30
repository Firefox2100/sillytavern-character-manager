import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { CharacterDetailPage } from './components/CharacterDetailPage.jsx'
import { CharacterListPage } from './components/CharacterListPage.jsx'
import { LanguageSwitcher } from './components/LanguageSwitcher.jsx'
import { LoginPage } from './components/LoginPage.jsx'
import { useI18n } from './i18n/i18nContext.js'
import {
  fetchCharacterCards,
  hasDirectusSession,
  loginToDirectus,
  logoutFromDirectus,
  releaseCharacterCardImages,
} from './services/directusClient.js'

const pages = {
  characters: 'characters',
  detail: 'detail',
}

function App() {
  const { t } = useI18n()
  const [route, setRoute] = useState(getRouteFromLocation)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAuthorId, setSelectedAuthorId] = useState('')
  const [selectedTags, setSelectedTags] = useState({
    include: [],
    exclude: [],
  })
  const [characters, setCharacters] = useState([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)
  const [loginError, setLoginError] = useState(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const loadCharacters = useCallback(async () => {
    setIsLoadingCharacters(true)

    try {
      const characterCards = await fetchCharacterCards()
      setCharacters((currentCharacters) => {
        releaseCharacterCardImages(currentCharacters)
        return characterCards
      })
      setIsAuthenticated(true)
      return true
    } catch (error) {
      setLoginError(error)
      setIsAuthenticated(false)
      setCharacters((currentCharacters) => {
        releaseCharacterCardImages(currentCharacters)
        return []
      })
      return false
    } finally {
      setIsLoadingCharacters(false)
    }
  }, [])

  useEffect(() => {
    function handlePopState() {
      setRoute(getRouteFromLocation())
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function checkSession() {
      try {
        const hasSession = await hasDirectusSession()

        if (!isMounted) {
          return
        }

        if (!hasSession) {
          setIsAuthenticated(false)
          return
        }

        loadCharacters()
      } finally {
        if (isMounted) {
          setIsCheckingSession(false)
        }
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [loadCharacters])

  const filteredCharacters = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return characters.filter((character) => {
      if (selectedAuthorId && String(character.authorId) !== selectedAuthorId) {
        return false
      }

      if (
        selectedTags.include.some((tag) => !character.tags.includes(tag)) ||
        selectedTags.exclude.some((tag) => character.tags.includes(tag))
      ) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const searchableText = [
        character.name,
        character.author,
        character.authorId,
        character.sourceUrl,
        ...character.tags,
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedSearch)
    })
  }, [characters, searchTerm, selectedAuthorId, selectedTags])

  const authorOptions = useMemo(() => {
    const authorsById = new Map()

    characters.forEach((character) => {
      if (!character.authorId) {
        return
      }

      authorsById.set(String(character.authorId), {
        id: String(character.authorId),
        name: character.author ?? t('authorById', { id: character.authorId }),
      })
    })

    return [...authorsById.values()].sort((firstAuthor, secondAuthor) =>
      firstAuthor.name.localeCompare(secondAuthor.name),
    )
  }, [characters, t])

  const tagOptions = useMemo(() => {
    const tags = new Set()

    characters.forEach((character) => {
      character.tags.forEach((tag) => tags.add(tag))
    })

    return [...tags].sort((firstTag, secondTag) =>
      firstTag.localeCompare(secondTag),
    )
  }, [characters])

  async function handleLogin(credentials) {
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      await loginToDirectus(credentials)
      await loadCharacters()
      if (route.page !== pages.detail) {
        navigateToRoute({ page: pages.characters })
      }
    } catch (error) {
      setLoginError(error)
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleLogout() {
    await logoutFromDirectus()
    setIsAuthenticated(false)
    setCharacters((currentCharacters) => {
      releaseCharacterCardImages(currentCharacters)
      return []
    })
    setSearchTerm('')
    setSelectedAuthorId('')
    setSelectedTags({ include: [], exclude: [] })
    navigateToRoute({ page: pages.characters }, { replace: true })
  }

  function handleShowCharacters() {
    navigateToRoute({ page: pages.characters })
  }

  function handleCharacterOpen(character) {
    navigateToRoute({
      page: pages.detail,
      characterId: String(character.id),
      versionId: character.versionId ? String(character.versionId) : null,
    })
  }

  function handleVersionChange(versionId) {
    if (route.page !== pages.detail) {
      return
    }

    navigateToRoute({
      ...route,
      versionId,
    })
  }

  const showCharacterApp = isAuthenticated || isCheckingSession || isLoadingCharacters
  const selectedCharacter =
    route.page === pages.detail
      ? characters.find((character) => String(character.id) === route.characterId)
      : null

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t('appName')}</p>
          <h1>{t('pageTitle')}</h1>
        </div>
        <div className="topbar-actions">
          <LanguageSwitcher />
          {showCharacterApp ? (
            <>
              <nav className="page-switcher" aria-label={t('navPrimary')}>
                <button
                  type="button"
                  className="is-active"
                  onClick={handleShowCharacters}
                >
                  {t('cardsTab')}
                </button>
              </nav>
              {isAuthenticated ? (
                <button className="logout-action" type="button" onClick={handleLogout}>
                  {t('logout')}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      <main>
        {showCharacterApp ? (
          route.page === pages.detail && (isCheckingSession || isLoadingCharacters) ? (
            <RouteStatusPanel
              title={isCheckingSession ? t('checkingSessionTitle') : t('loadingCardsTitle')}
              message={
                isCheckingSession
                  ? t('checkingSessionMessage')
                  : t('loadingCardsMessage')
              }
            />
          ) : route.page === pages.detail ? (
            <CharacterDetailPage
              character={selectedCharacter}
              selectedVersionId={route.versionId}
              onBack={handleShowCharacters}
              onVersionChange={handleVersionChange}
            />
          ) : (
            <CharacterListPage
              characters={filteredCharacters}
              isCheckingSession={isCheckingSession}
              isLoading={isLoadingCharacters}
              authorOptions={authorOptions}
              selectedAuthorId={selectedAuthorId}
              onAuthorChange={setSelectedAuthorId}
              tagOptions={tagOptions}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              onCharacterOpen={handleCharacterOpen}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          )
        ) : (
          <LoginPage
            error={loginError ? getErrorMessage(loginError, t) : ''}
            isLoading={isLoggingIn}
            onLogin={handleLogin}
          />
        )}
      </main>
    </div>
  )
}

function RouteStatusPanel({ title, message }) {
  return (
    <section className="detail-page">
      <div className="status-panel">
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </section>
  )
}

function navigateToRoute(route, options = {}) {
  const path = getPathFromRoute(route)

  if (options.replace) {
    window.history.replaceState(null, '', path)
  } else {
    window.history.pushState(null, '', path)
  }

  window.dispatchEvent(new PopStateEvent('popstate'))
}

function getRouteFromLocation() {
  const match = window.location.pathname.match(
    /^\/characters\/([^/]+)(?:\/versions\/([^/]+))?\/?$/,
  )

  if (match) {
    return {
      page: pages.detail,
      characterId: match[1],
      versionId: match[2] ?? null,
    }
  }

  return { page: pages.characters }
}

function getPathFromRoute(route) {
  if (route.page === pages.detail && route.characterId) {
    return route.versionId
      ? `/characters/${route.characterId}/versions/${route.versionId}`
      : `/characters/${route.characterId}`
  }

  return '/'
}

function getErrorMessage(error, t) {
  if (error?.i18nKey) {
    return t(error.i18nKey, error.values)
  }

  return error?.errors?.[0]?.message ?? error?.message ?? t('genericError')
}

export default App
