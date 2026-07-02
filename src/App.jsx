import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { CharacterDetailPage } from './components/CharacterDetailPage.jsx'
import { CharacterListPage } from './components/CharacterListPage.jsx'
import { DatabaseTemplateListPage } from './components/DatabaseTemplateListPage.jsx'
import { LanguageSwitcher } from './components/LanguageSwitcher.jsx'
import { LoginPage } from './components/LoginPage.jsx'
import { useI18n } from './i18n/i18nContext.js'
import {
  fetchCharacterCards,
  fetchDatabaseTemplates,
  fetchWorldBooks,
  hasDirectusSession,
  loginToDirectus,
  logoutFromDirectus,
  releaseCharacterCardImages,
} from './services/directusClient.js'

const pages = {
  characters: 'characters',
  detail: 'detail',
  templates: 'templates',
  worldBooks: 'worldBooks',
}

const databaseTemplateLabels = {
  tab: 'templatesTab',
  pageTitle: 'templatesPageTitle',
  count: 'templateCount',
  loadingTitle: 'loadingTemplatesTitle',
  loadingMessage: 'loadingTemplatesMessage',
  emptyTitle: 'noTemplatesTitle',
  emptyMessage: 'noTemplatesMessage',
  file: 'templateFile',
  noPreview: 'noTemplatePreview',
}

const worldBookLabels = {
  tab: 'worldBooksTab',
  pageTitle: 'worldBooksPageTitle',
  count: 'worldBookCount',
  loadingTitle: 'loadingWorldBooksTitle',
  loadingMessage: 'loadingWorldBooksMessage',
  emptyTitle: 'noWorldBooksTitle',
  emptyMessage: 'noWorldBooksMessage',
  file: 'worldBookFile',
  noPreview: 'noWorldBookPreview',
}

function App() {
  const { t } = useI18n()
  const [route, setRoute] = useState(getRouteFromLocation)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAuthorId, setSelectedAuthorId] = useState('')
  const [selectedTemplateAuthorId, setSelectedTemplateAuthorId] = useState('')
  const [selectedWorldBookAuthorId, setSelectedWorldBookAuthorId] = useState('')
  const [selectedTags, setSelectedTags] = useState({
    include: [],
    exclude: [],
  })
  const [characters, setCharacters] = useState([])
  const [databaseTemplates, setDatabaseTemplates] = useState([])
  const [worldBooks, setWorldBooks] = useState([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)
  const [loginError, setLoginError] = useState(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const loadAppData = useCallback(async () => {
    setIsLoadingCharacters(true)

    try {
      const [characterCards, templates, loadedWorldBooks] = await Promise.all([
        fetchCharacterCards(),
        fetchDatabaseTemplates(),
        fetchWorldBooks(),
      ])
      setCharacters((currentCharacters) => {
        releaseCharacterCardImages(currentCharacters)
        return characterCards
      })
      setDatabaseTemplates(templates)
      setWorldBooks(loadedWorldBooks)
      setIsAuthenticated(true)
      return true
    } catch (error) {
      setLoginError(error)
      setIsAuthenticated(false)
      setCharacters((currentCharacters) => {
        releaseCharacterCardImages(currentCharacters)
        return []
      })
      setDatabaseTemplates([])
      setWorldBooks([])
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

        loadAppData()
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
  }, [loadAppData])

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

  const filteredDatabaseTemplates = useMemo(() => {
    return databaseTemplates.filter((template) => {
      if (
        selectedTemplateAuthorId &&
        String(template.authorId) !== selectedTemplateAuthorId
      ) {
        return false
      }

      return true
    })
  }, [databaseTemplates, selectedTemplateAuthorId])

  const filteredWorldBooks = useMemo(() => {
    return worldBooks.filter((worldBook) => {
      if (
        selectedWorldBookAuthorId &&
        String(worldBook.authorId) !== selectedWorldBookAuthorId
      ) {
        return false
      }

      return true
    })
  }, [selectedWorldBookAuthorId, worldBooks])

  const templateAuthorOptions = useMemo(() => {
    const authorsById = new Map()

    databaseTemplates.forEach((template) => {
      if (!template.authorId) {
        return
      }

      authorsById.set(String(template.authorId), {
        id: String(template.authorId),
        name: template.author ?? t('authorById', { id: template.authorId }),
      })
    })

    return [...authorsById.values()].sort((firstAuthor, secondAuthor) =>
      firstAuthor.name.localeCompare(secondAuthor.name),
    )
  }, [databaseTemplates, t])

  const worldBookAuthorOptions = useMemo(() => {
    const authorsById = new Map()

    worldBooks.forEach((worldBook) => {
      if (!worldBook.authorId) {
        return
      }

      authorsById.set(String(worldBook.authorId), {
        id: String(worldBook.authorId),
        name: worldBook.author ?? t('authorById', { id: worldBook.authorId }),
      })
    })

    return [...authorsById.values()].sort((firstAuthor, secondAuthor) =>
      firstAuthor.name.localeCompare(secondAuthor.name),
    )
  }, [t, worldBooks])

  async function handleLogin(credentials) {
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      await loginToDirectus(credentials)
      await loadAppData()
      if (route.page !== pages.detail) {
        navigateToRoute(isListRoute(route) ? route : { page: pages.characters })
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
    setDatabaseTemplates([])
    setWorldBooks([])
    setSearchTerm('')
    setSelectedAuthorId('')
    setSelectedTemplateAuthorId('')
    setSelectedWorldBookAuthorId('')
    setSelectedTags({ include: [], exclude: [] })
    navigateToRoute({ page: pages.characters }, { replace: true })
  }

  function handleShowCharacters() {
    navigateToRoute({ page: pages.characters })
  }

  function handleAuthorShortcut(character) {
    setSearchTerm('')
    setSelectedTags({ include: [], exclude: [] })
    setSelectedAuthorId(character.authorId ? String(character.authorId) : '')
    navigateToRoute({ page: pages.characters })
  }

  function handleTagShortcut(tag) {
    setSearchTerm('')
    setSelectedAuthorId('')
    setSelectedTags({ include: [tag], exclude: [] })
    navigateToRoute({ page: pages.characters })
  }

  function handleShowTemplates() {
    navigateToRoute({ page: pages.templates })
  }

  function handleShowWorldBooks() {
    navigateToRoute({ page: pages.worldBooks })
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
          <h1>{getPageTitle(route, t)}</h1>
        </div>
        <div className="topbar-actions">
          <LanguageSwitcher />
          {showCharacterApp ? (
            <>
              <nav className="page-switcher" aria-label={t('navPrimary')}>
                <button
                  type="button"
                  className={
                    route.page === pages.characters || route.page === pages.detail
                      ? 'is-active'
                      : ''
                  }
                  onClick={handleShowCharacters}
                >
                  {t('cardsTab')}
                </button>
                <button
                  type="button"
                  className={route.page === pages.templates ? 'is-active' : ''}
                  onClick={handleShowTemplates}
                >
                  {t('templatesTab')}
                </button>
                <button
                  type="button"
                  className={route.page === pages.worldBooks ? 'is-active' : ''}
                  onClick={handleShowWorldBooks}
                >
                  {t('worldBooksTab')}
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
              onAuthorFilter={handleAuthorShortcut}
              onBack={handleShowCharacters}
              onTagFilter={handleTagShortcut}
              onVersionChange={handleVersionChange}
            />
          ) : route.page === pages.templates ? (
            <DatabaseTemplateListPage
              items={filteredDatabaseTemplates}
              isCheckingSession={isCheckingSession}
              isLoading={isLoadingCharacters}
              authorOptions={templateAuthorOptions}
              selectedAuthorId={selectedTemplateAuthorId}
              onAuthorChange={setSelectedTemplateAuthorId}
              labels={databaseTemplateLabels}
            />
          ) : route.page === pages.worldBooks ? (
            <DatabaseTemplateListPage
              items={filteredWorldBooks}
              isCheckingSession={isCheckingSession}
              isLoading={isLoadingCharacters}
              authorOptions={worldBookAuthorOptions}
              selectedAuthorId={selectedWorldBookAuthorId}
              onAuthorChange={setSelectedWorldBookAuthorId}
              labels={worldBookLabels}
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
              onAuthorShortcut={handleAuthorShortcut}
              onCharacterOpen={handleCharacterOpen}
              onTagShortcut={handleTagShortcut}
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

function getPageTitle(route, t) {
  if (route.page === pages.templates) {
    return t('templatesPageTitle')
  }

  if (route.page === pages.worldBooks) {
    return t('worldBooksPageTitle')
  }

  return t('pageTitle')
}

function isListRoute(route) {
  return route.page === pages.characters ||
    route.page === pages.templates ||
    route.page === pages.worldBooks
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
  if (window.location.pathname === '/templates') {
    return { page: pages.templates }
  }

  if (window.location.pathname === '/world-books') {
    return { page: pages.worldBooks }
  }

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
  if (route.page === pages.templates) {
    return '/templates'
  }

  if (route.page === pages.worldBooks) {
    return '/world-books'
  }

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
