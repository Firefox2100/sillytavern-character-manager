import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResourceListPage } from './ResourceListPage.jsx'
import { fetchAssetText } from '../services/directusClient.js'
import { renderWithI18n } from '../test/renderWithI18n.jsx'

vi.mock('../services/directusClient.js', () => ({
  downloadAsset: vi.fn(),
  fetchAssetText: vi.fn(),
}))

describe('ResourceListPage', () => {
  it('does not fetch file contents until the user explicitly opens them', async () => {
    const user = userEvent.setup()
    fetchAssetText.mockResolvedValue('{"safe":"synthetic"}')

    renderWithI18n(
      <ResourceListPage
        items={[{
          id: 1,
          name: 'Synthetic Preset',
          author: 'Test Author',
          fileId: 'file-1',
          fileName: 'synthetic.json',
          version: '1.0',
        }]}
        isCheckingSession={false}
        isLoading={false}
        authorOptions={[]}
        selectedAuthorId=""
        selectedItemId={null}
        onAuthorChange={vi.fn()}
        labels={{
          pageTitle: 'presetsPageTitle',
          count: 'presetCount',
          loadingTitle: 'loadingPresetsTitle',
          loadingMessage: 'loadingPresetsMessage',
          emptyTitle: 'noPresetsTitle',
          emptyMessage: 'noPresetsMessage',
          file: 'presetFile',
        }}
        resourceTypes={[{ id: 'presets', label: 'presetsTab' }]}
        activeType="presets"
        onTypeChange={vi.fn()}
      />,
    )

    expect(fetchAssetText).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'View contents' }))

    expect(fetchAssetText).toHaveBeenCalledOnce()
    expect(fetchAssetText).toHaveBeenCalledWith('file-1')
    expect(await screen.findByText(/"safe": "synthetic"/)).toBeInTheDocument()
  })
})
