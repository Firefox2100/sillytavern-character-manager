import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { CharacterDetailPage } from './components/CharacterDetailPage.jsx'
import { CharacterListPage } from './components/CharacterListPage.jsx'
import { ResourceListPage } from './components/ResourceListPage.jsx'
import { LanguageSwitcher } from './components/LanguageSwitcher.jsx'
import { LoginPage } from './components/LoginPage.jsx'
import { useI18n } from './i18n/i18nContext.js'
import {
  fetchCharacterCards,
  fetchDatabaseTemplates,
  fetchPresets,
  fetchTasks,
  fetchWorldBooks,
  hasDirectusSession,
  loginToDirectus,
  logoutFromDirectus,
} from './services/directusClient.js'

const pages = {
  characters: 'characters',
  detail: 'detail',
  resources: 'resources',
}

const resourceTypes = [
  { id: 'templates', label: 'templatesTab' },
  { id: 'world-books', label: 'worldBooksTab' },
  { id: 'presets', label: 'presetsTab' },
  { id: 'tasks', label: 'tasksTab' },
]

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

const presetLabels = {
  pageTitle: 'presetsPageTitle',
  count: 'presetCount',
  loadingTitle: 'loadingPresetsTitle',
  loadingMessage: 'loadingPresetsMessage',
  emptyTitle: 'noPresetsTitle',
  emptyMessage: 'noPresetsMessage',
  file: 'presetFile',
}

const taskLabels = {
  pageTitle: 'tasksPageTitle',
  count: 'taskCount',
  loadingTitle: 'loadingTasksTitle',
  loadingMessage: 'loadingTasksMessage',
  emptyTitle: 'noTasksTitle',
  emptyMessage: 'noTasksMessage',
  file: 'taskFile',
}

const resourceConfiguration = {
  templates: { labels: databaseTemplateLabels, stateKey: 'templates' },
  'world-books': { labels: worldBookLabels, stateKey: 'worldBooks' },
  presets: { labels: presetLabels, stateKey: 'presets' },
  tasks: { labels: taskLabels, stateKey: 'tasks' },
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
  const [presets, setPresets] = useState([])
  const [tasks, setTasks] = useState([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)
  const [loginError, setLoginError] = useState(null)
  const [isOtpRequired, setIsOtpRequired] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const loadAppData = useCallback(async () => {
    setIsLoadingCharacters(true)

    try {
      const characterCards = await fetchCharacterCards()
      setCharacters(characterCards)
      setIsAuthenticated(true)
      await loadSecondaryCollections({
        setDatabaseTemplates,
        setWorldBooks,
        setPresets,
        setTasks,
      })
      return true
    } catch (error) {
      setLoginError(error)
      setIsAuthenticated(false)
      setCharacters([])
      setDatabaseTemplates([])
      setWorldBooks([])
      setPresets([])
      setTasks([])
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

        await loadAppData()
      } catch (error) {
        if (isMounted) {
          setLoginError(error)
          setIsAuthenticated(false)
        }
      } finally {
        if (isMounted) {
          setIsCheckingSession(false)
        }
      }
    }

    void checkSession()

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
      return !(selectedTemplateAuthorId &&
          String(template.authorId) !== selectedTemplateAuthorId);
    })
  }, [databaseTemplates, selectedTemplateAuthorId])

  const filteredWorldBooks = useMemo(() => {
    return worldBooks.filter((worldBook) => {
      return !(selectedWorldBookAuthorId &&
          String(worldBook.authorId) !== selectedWorldBookAuthorId);
    })
  }, [selectedWorldBookAuthorId, worldBooks])

  const [selectedPresetAuthorId, setSelectedPresetAuthorId] = useState('')
  const [selectedTaskAuthorId, setSelectedTaskAuthorId] = useState('')
  const filteredPresets = useMemo(
    () => filterResourcesByAuthor(presets, selectedPresetAuthorId),
    [presets, selectedPresetAuthorId],
  )
  const filteredTasks = useMemo(
    () => filterResourcesByAuthor(tasks, selectedTaskAuthorId),
    [tasks, selectedTaskAuthorId],
  )

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

  const presetAuthorOptions = useMemo(
    () => getResourceAuthorOptions(presets, t),
    [presets, t],
  )
  const taskAuthorOptions = useMemo(
    () => getResourceAuthorOptions(tasks, t),
    [tasks, t],
  )

  async function handleLogin(credentials) {
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      await loginToDirectus(credentials)
      setIsOtpRequired(false)
      await loadAppData()
      if (route.page !== pages.detail) {
        navigateToRoute(isListRoute(route) ? route : { page: pages.characters })
      }
    } catch (error) {
      if (isInvalidOtpError(error)) {
        setIsOtpRequired(true)
        setLoginError({
          i18nKey: 'otpRequired',
        })
      } else {
        setLoginError(error)
      }
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleLogout() {
    await logoutFromDirectus()
    setIsAuthenticated(false)
    setCharacters([])
    setDatabaseTemplates([])
    setWorldBooks([])
    setPresets([])
    setTasks([])
    setSearchTerm('')
    setSelectedAuthorId('')
    setSelectedTemplateAuthorId('')
    setSelectedWorldBookAuthorId('')
    setSelectedPresetAuthorId('')
    setSelectedTaskAuthorId('')
    setSelectedTags({ include: [], exclude: [] })
    setIsOtpRequired(false)
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

  function handleShowResources(resourceType = route.resourceType ?? 'templates') {
    navigateToRoute({ page: pages.resources, resourceType })
  }

  function handleResourceOpen(resourceType, resourceId) {
    const clearAuthorFilter = {
      templates: setSelectedTemplateAuthorId,
      'world-books': setSelectedWorldBookAuthorId,
      presets: setSelectedPresetAuthorId,
      tasks: setSelectedTaskAuthorId,
    }[resourceType]

    clearAuthorFilter?.('')
    navigateToRoute({ page: pages.resources, resourceType, resourceId: String(resourceId) })
  }

  function handleCharacterOpen(character) {
    navigateToRoute({
      page: pages.detail,
      characterId: String(character.id),
      versionId: character.versionId ? String(character.versionId) : null,
    })
  }

  function handleForkOpen(character) {
    navigateToRoute({
      page: pages.detail,
      characterId: String(character.forkedFromCharacterId),
      versionId: String(character.forkedFromVersionId),
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
        <div className="topbar-brand">
          <img className="brand-mark" src="/logo.png" alt="" aria-hidden="true" />
          <div>
            <p className="product-name">{t('appName')}</p>
            <h1>{getPageTitle(route, t)}</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <LanguageSwitcher />
          {showCharacterApp ? (
            <>
              <nav className="page-switcher" aria-label={t('navPrimary')}>
                <button
                  type="button"
                  aria-current={
                    route.page === pages.characters || route.page === pages.detail
                      ? 'page'
                      : undefined
                  }
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
                  aria-current={route.page === pages.resources ? 'page' : undefined}
                  className={route.page === pages.resources ? 'is-active' : ''}
                  onClick={() => handleShowResources()}
                >
                  {t('resourcesTab')}
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
              onForkOpen={handleForkOpen}
              onTagFilter={handleTagShortcut}
              onVersionChange={handleVersionChange}
              onResourceOpen={handleResourceOpen}
            />
          ) : route.page === pages.resources ? (
            <ResourceListPage
              items={getActiveResources(route.resourceType, {
                templates: filteredDatabaseTemplates,
                worldBooks: filteredWorldBooks,
                presets: filteredPresets,
                tasks: filteredTasks,
              })}
              isCheckingSession={isCheckingSession}
              isLoading={isLoadingCharacters}
              authorOptions={getActiveResources(route.resourceType, {
                templates: templateAuthorOptions,
                worldBooks: worldBookAuthorOptions,
                presets: presetAuthorOptions,
                tasks: taskAuthorOptions,
              })}
              selectedAuthorId={getActiveResources(route.resourceType, {
                templates: selectedTemplateAuthorId,
                worldBooks: selectedWorldBookAuthorId,
                presets: selectedPresetAuthorId,
                tasks: selectedTaskAuthorId,
              })}
              selectedItemId={route.resourceId}
              onAuthorChange={getActiveResources(route.resourceType, {
                templates: setSelectedTemplateAuthorId,
                worldBooks: setSelectedWorldBookAuthorId,
                presets: setSelectedPresetAuthorId,
                tasks: setSelectedTaskAuthorId,
              })}
              labels={resourceConfiguration[route.resourceType]?.labels ?? databaseTemplateLabels}
              resourceTypes={resourceTypes}
              activeType={route.resourceType ?? 'templates'}
              onTypeChange={handleShowResources}
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
            isOtpRequired={isOtpRequired}
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
      <div className="status-panel" role="status" aria-live="polite">
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </section>
  )
}

function getPageTitle(route, t) {
  if (route.page === pages.resources) {
    return t(resourceConfiguration[route.resourceType]?.labels.pageTitle ?? 'resourcesPageTitle')
  }

  return t('pageTitle')
}

function isListRoute(route) {
  return route.page === pages.characters ||
    route.page === pages.resources
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
    return { page: pages.resources, resourceType: 'templates' }
  }

  if (window.location.pathname === '/world-books') {
    return { page: pages.resources, resourceType: 'world-books' }
  }

  const resourceMatch = window.location.pathname.match(
    /^\/resources\/(templates|world-books|presets|tasks)(?:\/([^/]+))?\/?$/,
  )

  if (resourceMatch) {
    return {
      page: pages.resources,
      resourceType: resourceMatch[1],
      resourceId: resourceMatch[2] ?? null,
    }
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
  if (route.page === pages.resources) {
    const resourceType = resourceConfiguration[route.resourceType]
      ? route.resourceType
      : 'templates'
    return route.resourceId
      ? `/resources/${resourceType}/${route.resourceId}`
      : `/resources/${resourceType}`
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

function isInvalidOtpError(error) {
  return error?.errors?.some((directusError) =>
    directusError.extensions?.code === 'INVALID_OTP' ||
    directusError.extensions?.reason === 'INVALID_OTP',
  )
}

async function loadSecondaryCollections({
  setDatabaseTemplates,
  setWorldBooks,
  setPresets,
  setTasks,
}) {
  const [templatesResult, worldBooksResult, presetsResult, tasksResult] = await Promise.allSettled([
    fetchDatabaseTemplates(),
    fetchWorldBooks(),
    fetchPresets(),
    fetchTasks(),
  ])

  if (templatesResult.status === 'fulfilled') {
    setDatabaseTemplates(templatesResult.value)
  }

  if (worldBooksResult.status === 'fulfilled') {
    setWorldBooks(worldBooksResult.value)
  }

  if (presetsResult.status === 'fulfilled') {
    setPresets(presetsResult.value)
  }

  if (tasksResult.status === 'fulfilled') {
    setTasks(tasksResult.value)
  }
}

function filterResourcesByAuthor(resources, authorId) {
  return resources.filter((resource) =>
    !authorId || String(resource.authorId) === authorId,
  )
}

function getResourceAuthorOptions(resources, t) {
  const authorsById = new Map()

  resources.forEach((resource) => {
    if (!resource.authorId) return
    authorsById.set(String(resource.authorId), {
      id: String(resource.authorId),
      name: resource.author ?? t('authorById', { id: resource.authorId }),
    })
  })

  return [...authorsById.values()].sort((first, second) =>
    first.name.localeCompare(second.name),
  )
}

function getActiveResources(resourceType, resources) {
  const key = resourceConfiguration[resourceType]?.stateKey ?? 'templates'
  return resources[key]
}

export default App
