import { cleanup, render, screen } from '@testing-library/preact'
import { afterEach, expect, test, vi } from 'vitest'
import { ErrorBoundary } from '../src/ui/ErrorBoundary'

afterEach(cleanup)

function Boom(): never {
  throw new Error('kaboom')
}

test('error boundary shows the error and a reset button instead of a blank page', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<ErrorBoundary onReset={() => {}}><Boom /></ErrorBoundary>)
  await screen.findByText(/kaboom/)
  expect(screen.getByRole('button', { name: /Reset/ })).toBeTruthy()
})
