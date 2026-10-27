import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CharacterListPage } from './CharacterListPage.jsx'
import { renderWithI18n } from '../test/renderWithI18n.jsx'

vi.mock('../services/directusClient.js', () => ({
  fetchAssetObjectUrl: vi.fn(),
}))

function makeCharacters(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Character ${String(index + 1).padStart(2, '0')}`,
    author: 'Test Author',
    authorId: 1,
    imageAssetId: null,
    tags: [],
    versionId: 1,
  }))
}

function renderList(overrides = {}) {
  const props = {
    characters: makeCharacters(16),
    isCheckingSession: false,
    isLoading: false,
    authorOptions: [],
    selectedAuthorId: '',
    onAuthorChange: vi.fn(),
    tagOptions: [],
    selectedTags: { include: [], exclude: [] },
    onTagsChange: vi.fn(),
    onAuthorShortcut: vi.fn(),
    onCharacterOpen: vi.fn(),
    onTagShortcut: vi.fn(),
    searchTerm: '',
    onSearchChange: vi.fn(),
    ...overrides,
  }

  return renderWithI18n(<CharacterListPage {...props} />)
}

describe('CharacterListPage', () => {
  it('shows fifteen cards per page and fills the next page with the remainder', async () => {
    const user = userEvent.setup()
    renderList()

    expect(screen.getByText('Character 01')).toBeInTheDocument()
    expect(screen.getByText('Character 15')).toBeInTheDocument()
    expect(screen.queryByText('Character 16')).not.toBeInTheDocument()
    expect(screen.getByText('1–15 of 16 cards')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.queryByText('Character 01')).not.toBeInTheDocument()
    expect(screen.getByText('Character 16')).toBeInTheDocument()
    expect(screen.getByText('16–16 of 16 cards')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('resets pagination when the search changes', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    renderList({ onSearchChange })

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.type(screen.getByRole('searchbox'), 'A')

    expect(onSearchChange).toHaveBeenCalledWith('A')
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })
})
