import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
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
import { renderWithI18n } from './test/renderWithI18n.jsx'

vi.mock('./services/directusClient.js', () => ({
  fetchCharacterCards: vi.fn(),
  fetchDatabaseTemplates: vi.fn(),
  fetchPresets: vi.fn(),
  fetchTasks: vi.fn(),
  fetchWorldBooks: vi.fn(),
  hasDirectusSession: vi.fn(),
  loginToDirectus: vi.fn(),
  logoutFromDirectus: vi.fn(),
}))

vi.mock('./components/CharacterListPage.jsx', () => ({
  CharacterListPage: (props) => (
    <section data-testid="character-list">
      <p>{props.characters.map((character) => character.name).join(',')}</p>
      <p data-testid="selected-author">{props.selectedAuthorId}</p>
      <p data-testid="selected-tags">{props.selectedTags.include.join(',')}</p>
      <input
        aria-label="mock search"
        value={props.searchTerm}
        onChange={(event) => props.onSearchChange(event.target.value)}
      />
      <button type="button" onClick={() => props.onCharacterOpen(props.characters[0])}>
        open-character
      </button>
      <button type="button" onClick={() => props.onAuthorShortcut(props.characters[0])}>
        filter-author
      </button>
      <button type="button" onClick={() => props.onTagShortcut('hero')}>
        filter-tag
      </button>
    </section>
  ),
}))

vi.mock('./components/ResourceListPage.jsx', () => ({
  ResourceListPage: (props) => (
    <section data-testid="resource-list">
      <p data-testid="active-resource">{props.activeType}</p>
      <p data-testid="resource-items">{props.items.map((item) => item.name).join(',')}</p>
      <p data-testid="selected-resource">{props.selectedItemId}</p>
      <button type="button" onClick={() => props.onTypeChange('world-books')}>
        type-world-books
      </button>
      <button type="button" onClick={() => props.onTypeChange('presets')}>
        type-presets
      </button>
      <button type="button" onClick={() => props.onTypeChange('tasks')}>
        type-tasks
      </button>
      <button type="button" onClick={() => props.onAuthorChange('9')}>
        filter-resource-author
      </button>
    </section>
  ),
}))

vi.mock('./components/CharacterDetailPage.jsx', () => ({
  CharacterDetailPage: (props) => (
    <section data-testid="character-detail">
      <p>{props.character?.name ?? 'missing-character'}</p>
      <p data-testid="selected-version">{props.selectedVersionId}</p>
      <button type="button" onClick={props.onBack}>detail-back</button>
      <button type="button" onClick={() => props.onVersionChange('12')}>change-version</button>
      <button type="button" onClick={() => props.onAuthorFilter(props.character)}>detail-author</button>
      <button type="button" onClick={() => props.onTagFilter('hero')}>detail-tag</button>
      <button type="button" onClick={() => props.onForkOpen(props.character)}>detail-fork</button>
      <button type="button" onClick={() => props.onResourceOpen('templates', 31)}>detail-resource</button>
    </section>
  ),
}))

const characters = [
  {
    id: 1,
    name: 'Alpha',
    author: 'Author',
    authorId: 9,
    sourceUrl: 'example.test',
    tags: ['hero'],
    versionId: 11,
    forkedFromCharacterId: 2,
    forkedFromVersionId: 20,
  },
  {
    id: 2,
    name: 'Beta',
    author: null,
    authorId: 10,
    tags: ['villain'],
    versionId: 20,
  },
]

const resources = {
  templates: [{ id: 31, name: 'Template', author: 'Author', authorId: 9 }],
  worldBooks: [{ id: 32, name: 'World', author: null, authorId: 10 }],
  presets: [{ id: 33, name: 'Preset', author: 'Author', authorId: 9 }],
  tasks: [{ id: 34, name: 'Task', author: 'Author', authorId: 9 }],
}

function prepareCollections() {
  fetchCharacterCards.mockResolvedValue(characters)
  fetchDatabaseTemplates.mockResolvedValue(resources.templates)
  fetchWorldBooks.mockResolvedValue(resources.worldBooks)
  fetchPresets.mockResolvedValue(resources.presets)
  fetchTasks.mockResolvedValue(resources.tasks)
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    hasDirectusSession.mockResolvedValue(true)
    loginToDirectus.mockResolvedValue(undefined)
    logoutFromDirectus.mockResolvedValue(undefined)
    prepareCollections()
  })

  it('loads a session, filters cards, and follows detail routes', async () => {
    const user = userEvent.setup()
    renderWithI18n(<App />)

    expect(await screen.findByTestId('character-list')).toBeInTheDocument()
    expect(screen.getByText('Alpha,Beta')).toBeInTheDocument()

    await user.type(screen.getByLabelText('mock search'), 'Beta')
    expect(screen.getByText('Beta')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('mock search'))

    await user.click(screen.getByRole('button', { name: 'filter-author' }))
    expect(screen.getByTestId('selected-author')).toHaveTextContent('9')
    await user.click(screen.getByRole('button', { name: 'filter-tag' }))
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('hero')

    await user.click(screen.getByRole('button', { name: 'open-character' }))
    expect(await screen.findByTestId('character-detail')).toHaveTextContent('Alpha')
    expect(window.location.pathname).toBe('/characters/1/versions/11')
    await user.click(screen.getByRole('button', { name: 'change-version' }))
    expect(window.location.pathname).toBe('/characters/1/versions/12')
    await user.click(screen.getByRole('button', { name: 'detail-fork' }))
    expect(window.location.pathname).toBe('/characters/2/versions/20')
    await user.click(screen.getByRole('button', { name: 'detail-back' }))
    expect(window.location.pathname).toBe('/')
  })

  it('navigates and filters every resource type', async () => {
    const user = userEvent.setup()
    renderWithI18n(<App />)
    await screen.findByTestId('character-list')

    await user.click(screen.getByRole('button', { name: 'Resources' }))
    expect(screen.getByTestId('active-resource')).toHaveTextContent('templates')
    expect(screen.getByTestId('resource-items')).toHaveTextContent('Template')
    await user.click(screen.getByRole('button', { name: 'filter-resource-author' }))
    expect(screen.getByTestId('resource-items')).toHaveTextContent('Template')

    for (const [button, type, name] of [
      ['type-world-books', 'world-books', 'World'],
      ['type-presets', 'presets', 'Preset'],
      ['type-tasks', 'tasks', 'Task'],
    ]) {
      await user.click(screen.getByRole('button', { name: button }))
      expect(screen.getByTestId('active-resource')).toHaveTextContent(type)
      expect(screen.getByTestId('resource-items')).toHaveTextContent(name)
      expect(window.location.pathname).toBe(`/resources/${type}`)
    }
  })

  it('opens recommended resources and applies detail shortcuts', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/characters/1/versions/11')
    renderWithI18n(<App />)
    await screen.findByTestId('character-detail')

    await user.click(screen.getByRole('button', { name: 'detail-resource' }))
    expect(window.location.pathname).toBe('/resources/templates/31')
    expect(screen.getByTestId('selected-resource')).toHaveTextContent('31')

    window.history.pushState(null, '', '/characters/1/versions/11')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await screen.findByTestId('character-detail')
    await user.click(screen.getByRole('button', { name: 'detail-author' }))
    expect(window.location.pathname).toBe('/')
    expect(screen.getByTestId('selected-author')).toHaveTextContent('9')

    window.history.pushState(null, '', '/characters/1/versions/11')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await user.click(await screen.findByRole('button', { name: 'detail-tag' }))
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('hero')
  })

  it('handles OTP login, successful login, and logout', async () => {
    const user = userEvent.setup()
    hasDirectusSession.mockResolvedValue(false)
    loginToDirectus
      .mockRejectedValueOnce({
        errors: [{ message: 'OTP missing', extensions: { code: 'INVALID_OTP' } }],
      })
      .mockResolvedValueOnce(undefined)

    renderWithI18n(<App />)
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'user@example.test')
    await user.type(screen.getByLabelText('Password'), 'safe-password')
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your one-time password')
    await user.type(screen.getByRole('textbox', { name: 'One-time password' }), '123456')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByTestId('character-list')).toBeInTheDocument()
    expect(loginToDirectus).toHaveBeenLastCalledWith({
      username: 'user@example.test',
      password: 'safe-password',
      otp: '123456',
    })

    await user.click(screen.getByRole('button', { name: 'Logout' }))
    expect(logoutFromDirectus).toHaveBeenCalledOnce()
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('survives session and secondary-collection failures', async () => {
    hasDirectusSession.mockRejectedValueOnce(new Error('Session failed'))
    const first = renderWithI18n(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Session failed')
    first.unmount()

    hasDirectusSession.mockResolvedValueOnce(true)
    fetchWorldBooks.mockRejectedValueOnce(new Error('Optional collection unavailable'))
    window.history.replaceState(null, '', '/world-books')
    renderWithI18n(<App />)
    expect(await screen.findByTestId('resource-list')).toBeInTheDocument()
    expect(screen.getByTestId('resource-items')).toBeEmptyDOMElement()
  })

  it('responds to legacy and unknown routes', async () => {
    window.history.replaceState(null, '', '/templates')
    const first = renderWithI18n(<App />)
    expect(await screen.findByTestId('active-resource')).toHaveTextContent('templates')
    first.unmount()

    window.history.replaceState(null, '', '/world-books')
    const second = renderWithI18n(<App />)
    expect(await screen.findByTestId('active-resource')).toHaveTextContent('world-books')
    second.unmount()

    window.history.replaceState(null, '', '/not-a-route')
    renderWithI18n(<App />)
    expect(await screen.findByTestId('character-list')).toBeInTheDocument()
    fireEvent.popState(window)
  })
})
