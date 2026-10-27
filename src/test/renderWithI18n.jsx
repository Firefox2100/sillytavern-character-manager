import { render } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nProvider.jsx'

export function renderWithI18n(ui) {
  return render(ui, { wrapper: I18nProvider })
}
