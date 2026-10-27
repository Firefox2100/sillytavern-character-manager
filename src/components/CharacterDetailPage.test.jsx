import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CharacterDetailPage } from './CharacterDetailPage.jsx'
import {
  createSignedFileLink,
  downloadAsset,
  fetchAssetBlob,
} from '../services/directusClient.js'
import { extractCardExcerptFromPng } from '../services/sillyTavernCard.js'
import { renderWithI18n } from '../test/renderWithI18n.jsx'

vi.mock('../services/directusClient.js', () => ({
  createSignedFileLink: vi.fn(),
  downloadAsset: vi.fn(),
  fetchAssetBlob: vi.fn(),
}))

vi.mock('../services/sillyTavernCard.js', () => ({
  extractCardExcerptFromPng: vi.fn(),
}))

const excerpt = {
  spec: 'chara_card_v3',
  specVersion: '3.0',
  name: 'Embedded Alpha',
  creator: 'Synthetic Creator',
  characterVersion: '2.0',
  alternateGreetingCount: 2,
  worldBookEntryCount: 3,
  definition: 'Definition text',
  personality: 'Friendly',
  scenario: 'Test scenario',
  firstMessage: 'Hello',
  exampleMessages: 'Example',
}

const character = {
  id: 1,
  name: 'Alpha',
  author: 'Author',
  authorId: 9,
  description: 'Synthetic description',
  sourceUrl: 'example.test/source',
  forkedFromCharacterId: 2,
  forkedFromCharacterName: 'Origin',
  forkedFromVersionId: 20,
  forkedFromVersion: '0.9',
  versions: [
    {
      id: 11,
      version: '2.0',
      versionNote: 'Current release',
      assetId: 'card-11',
      imageUrl: null,
      tags: ['hero'],
      recommendations: {
        templates: [{ id: 31, name: 'Template', version: '1.0' }],
        worldBooks: [{ id: 32, name: null, version: null }],
        presets: [],
        tasks: [{ id: 33, name: 'Task', version: null }],
      },
    },
    {
      id: 12,
      version: '',
      assetId: null,
      imageUrl: null,
      tags: [],
      recommendations: {},
    },
  ],
}

function renderDetail(overrides = {}) {
  const props = {
    character,
    selectedVersionId: '11',
    onAuthorFilter: vi.fn(),
    onBack: vi.fn(),
    onForkOpen: vi.fn(),
    onTagFilter: vi.fn(),
    onVersionChange: vi.fn(),
    onResourceOpen: vi.fn(),
    ...overrides,
  }

  return { ...renderWithI18n(<CharacterDetailPage {...props} />), props }
}

describe('CharacterDetailPage', () => {
  beforeEach(() => {
    fetchAssetBlob.mockResolvedValue(new Blob(['synthetic']))
    extractCardExcerptFromPng.mockResolvedValue(excerpt)
    createSignedFileLink.mockResolvedValue('https://example.test/signed')
    downloadAsset.mockResolvedValue(undefined)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:card')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('loads embedded data and supports all detail actions', async () => {
    const user = userEvent.setup()
    const clipboardWrite = vi.spyOn(navigator.clipboard, 'writeText')
    const { props, unmount } = renderDetail()

    expect(await screen.findByRole('img', { name: 'Alpha portrait' })).toHaveAttribute(
      'src',
      'blob:card',
    )
    expect(screen.getByText('chara_card_v3 / 3.0')).toBeInTheDocument()
    expect(screen.getByText('Definition text')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'example.test/source' })).toHaveAttribute(
      'href',
      'https://example.test/source',
    )

    await user.click(screen.getByRole('button', { name: 'by Author' }))
    await user.click(screen.getByRole('button', { name: 'hero' }))
    await user.click(screen.getByRole('button', { name: 'Origin / 0.9' }))
    await user.selectOptions(screen.getByRole('combobox'), '12')
    expect(props.onAuthorFilter).toHaveBeenCalledWith(character)
    expect(props.onTagFilter).toHaveBeenCalledWith('hero')
    expect(props.onForkOpen).toHaveBeenCalledWith(character)
    expect(props.onVersionChange).toHaveBeenCalledWith('12')

    await user.click(screen.getByRole('button', { name: 'Template · 1.0' }))
    await user.click(screen.getByRole('button', { name: 'Unnamed resource' }))
    await user.click(screen.getByRole('button', { name: 'Task' }))
    expect(props.onResourceOpen).toHaveBeenCalledWith('templates', 31)
    expect(props.onResourceOpen).toHaveBeenCalledWith('world-books', 32)
    expect(props.onResourceOpen).toHaveBeenCalledWith('tasks', 33)

    await user.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(downloadAsset).toHaveBeenCalledWith('card-11', 'Alpha.png'))
    await user.click(screen.getByRole('button', { name: 'Copy download link' }))
    expect(await screen.findByText('Download link copied.')).toBeInTheDocument()
    expect(clipboardWrite).toHaveBeenCalledWith(
      'https://example.test/signed',
    )

    await user.click(screen.getByRole('button', { name: 'Back to cards' }))
    expect(props.onBack).toHaveBeenCalledOnce()
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:card')
  })

  it('shows loading, unavailable, and error states safely', async () => {
    const pending = new Promise(() => {})
    fetchAssetBlob.mockReturnValueOnce(pending)
    const first = renderDetail()
    expect(screen.getByText('Reading embedded card data.')).toBeInTheDocument()
    first.unmount()

    extractCardExcerptFromPng.mockResolvedValueOnce(null)
    const second = renderDetail()
    expect(await screen.findByText('No embedded SillyTavern card data was found.')).toBeInTheDocument()
    second.unmount()

    fetchAssetBlob.mockRejectedValueOnce(Object.assign(new Error('failed'), {
      i18nKey: 'imageLoadError',
      values: { assetId: 'card-11' },
    }))
    renderDetail()
    expect(await screen.findAllByText('Could not load card image card-11.')).toHaveLength(2)
  })

  it('reports action failures and handles versions without assets', async () => {
    const user = userEvent.setup()
    downloadAsset.mockRejectedValueOnce(new Error('download failed'))
    createSignedFileLink.mockRejectedValueOnce(new Error('link failed'))
    renderDetail()

    await user.click(screen.getByRole('button', { name: 'Download' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not download card.')
    await user.click(screen.getByRole('button', { name: 'Copy download link' }))
    expect(await screen.findByText('link failed')).toHaveAttribute('role', 'alert')

    renderDetail({ selectedVersionId: '12' })
    expect(screen.getAllByRole('button', { name: 'Download' }).at(-1)).toBeDisabled()
    expect(screen.getAllByText('No embedded SillyTavern card data was found.').at(-1)).toBeInTheDocument()
  })

  it('renders a not-found state when the character or version is missing', async () => {
    const user = userEvent.setup()
    const { props } = renderDetail({ character: null })
    expect(screen.getByText('Character not found')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to cards' }))
    expect(props.onBack).toHaveBeenCalledOnce()
  })
})
