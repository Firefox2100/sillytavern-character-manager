import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CharacterCard } from './CharacterCard.jsx'
import { fetchAssetObjectUrl } from '../services/directusClient.js'
import { renderWithI18n } from '../test/renderWithI18n.jsx'

vi.mock('../services/directusClient.js', () => ({
  fetchAssetObjectUrl: vi.fn(),
}))

describe('CharacterCard', () => {
  it('loads a preview only while the card is mounted and releases its object URL', async () => {
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    fetchAssetObjectUrl.mockResolvedValue('blob:preview')

    const { unmount } = renderWithI18n(
      <CharacterCard
        character={{
          id: 1,
          name: 'Synthetic Character',
          author: 'Test Author',
          authorId: 1,
          imageAssetId: 'asset-1',
          tags: [],
        }}
        detailPath="/characters/1"
        onAuthorFilter={vi.fn()}
        onOpen={vi.fn()}
        onTagFilter={vi.fn()}
      />,
    )

    expect(fetchAssetObjectUrl).toHaveBeenCalledOnce()
    expect(fetchAssetObjectUrl).toHaveBeenCalledWith('asset-1')
    expect(await screen.findByRole('img')).toHaveAttribute('src', 'blob:preview')

    unmount()
    await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview'))
    revokeObjectUrl.mockRestore()
  })
})
