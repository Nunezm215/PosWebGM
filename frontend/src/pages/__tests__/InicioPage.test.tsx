import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import InicioPage from '../InicioPage'

it('does not show the user manual link', () => {
  render(<InicioPage />)

  expect(screen.queryByRole('button', { name: 'Manual de usuario' })).not.toBeInTheDocument()
})
