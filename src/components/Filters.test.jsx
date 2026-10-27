import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthorFilter } from './AuthorFilter.jsx'
import { EmptyState } from './EmptyState.jsx'
import { LanguageSwitcher } from './LanguageSwitcher.jsx'
import { LoginPage } from './LoginPage.jsx'
import { TagFilter } from './TagFilter.jsx'
import { renderWithI18n } from '../test/renderWithI18n.jsx'

describe('filter and form controls', () => {
  it('searches, selects, clears, escapes, and dismisses the author filter', async () => {
    const user = userEvent.setup()
    const onAuthorChange = vi.fn()
    const { rerender } = renderWithI18n(
      <AuthorFilter
        authors={[{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]}
        selectedAuthorId=""
        onAuthorChange={onAuthorChange}
      />,
    )

    const input = screen.getByRole('combobox', { name: 'Author' })
    await user.click(input)
    await user.type(input, 'ali')
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Bob' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Alice' }))
    expect(onAuthorChange).toHaveBeenLastCalledWith('1')

    rerender(
      <AuthorFilter
        authors={[{ id: '1', name: 'Alice' }]}
        selectedAuthorId="1"
        onAuthorChange={onAuthorChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onAuthorChange).toHaveBeenLastCalledWith('')
    await user.type(input, 'missing')
    expect(screen.getByText('No authors found.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(input)
    await user.click(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('includes, excludes, removes, and clears tags', async () => {
    const user = userEvent.setup()
    const onTagsChange = vi.fn()
    const { rerender } = renderWithI18n(
      <TagFilter
        tags={['hero', 'villain']}
        selectedTags={{ include: [], exclude: [] }}
        onTagsChange={onTagsChange}
      />,
    )

    const input = screen.getByRole('combobox', { name: 'Tags' })
    await user.click(input)
    await user.type(input, 'hero')
    await user.click(screen.getByRole('button', { name: 'Include' }))
    expect(onTagsChange).toHaveBeenLastCalledWith({ include: ['hero'], exclude: [] })

    rerender(
      <TagFilter
        tags={['hero', 'villain']}
        selectedTags={{ include: ['hero'], exclude: [] }}
        onTagsChange={onTagsChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Includehero' }))
    expect(onTagsChange).toHaveBeenLastCalledWith({ include: [], exclude: [] })
    await user.click(input)
    await user.click(screen.getByRole('button', { name: 'Exclude' }))
    expect(onTagsChange).toHaveBeenLastCalledWith({ include: ['hero'], exclude: ['villain'] })

    rerender(
      <TagFilter
        tags={['hero', 'villain']}
        selectedTags={{ include: [], exclude: ['villain'] }}
        onTagsChange={onTagsChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onTagsChange).toHaveBeenLastCalledWith({ include: [], exclude: [] })
    await user.type(input, 'missing')
    expect(screen.getByText('No tags found.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
  })

  it('submits login credentials and renders loading and error states', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    const { rerender } = renderWithI18n(
      <LoginPage error="" isLoading={false} isOtpRequired onLogin={onLogin} />,
    )
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'user@example.test')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.type(screen.getByRole('textbox', { name: 'One-time password' }), '123456')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(onLogin).toHaveBeenCalledWith({
      username: 'user@example.test',
      password: 'password',
      otp: '123456',
    })

    rerender(<LoginPage error="Rejected" isLoading isOtpRequired={false} onLogin={onLogin} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Rejected')
    expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled()
  })

  it('switches language persistently and renders both empty-state messages', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithI18n(
      <>
        <LanguageSwitcher />
        <EmptyState searchTerm="" />
      </>,
    )
    expect(screen.getByText('Character cards will appear here once they are available.')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'zh')
    expect(document.documentElement.lang).toBe('zh')
    expect(localStorage.getItem('sillytavern-character-manager.language')).toBe('zh')
    expect(screen.getByText('未找到角色卡')).toBeInTheDocument()

    rerender(
      <>
        <LanguageSwitcher />
        <EmptyState searchTerm="Alpha" />
      </>,
    )
    expect(screen.getByText('没有角色卡匹配“Alpha”。')).toBeInTheDocument()
  })
})
