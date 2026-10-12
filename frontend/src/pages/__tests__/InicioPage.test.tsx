import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import InicioPage from '../InicioPage'

it('opens the user manual in a new tab', async () => {
  const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  const user = userEvent.setup()
  render(<InicioPage />)

  await user.click(screen.getByRole('button', { name: 'Manual de usuario' }))

  expect(openSpy).toHaveBeenCalledWith('/manual-usuario.pdf', '_blank', 'noopener,noreferrer')
  openSpy.mockRestore()
})
