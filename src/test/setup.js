import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn()
}

if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn()
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
