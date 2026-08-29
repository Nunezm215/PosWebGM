import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DetalleReservaPage from '../../pages/DetalleReservaPage'

const apiState = vi.hoisted(() => ({
  obtenerDetalleCompartidoPdf: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  api: {
    eventos: {
      obtenerDetalleCompartidoPdf: apiState.obtenerDetalleCompartidoPdf,
    },
  },
}))

function renderPage(initialPath = '/detalle-reserva/token-123') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/detalle-reserva/:token" element={<DetalleReservaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DetalleReservaPage', () => {
  beforeEach(() => {
    apiState.obtenerDetalleCompartidoPdf.mockReset()
    apiState.obtenerDetalleCompartidoPdf.mockResolvedValue({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      filename: 'Detalle-Reserva.pdf',
    })
  })

  it('shows loading state', async () => {
    apiState.obtenerDetalleCompartidoPdf.mockReturnValue(new Promise(() => undefined))

    renderPage()

    expect(screen.getByText('Cargando detalle...')).toBeInTheDocument()
  })

  it('renders the shared pdf for a valid token', async () => {
    const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:detalle')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    renderPage()

    expect(await screen.findByTitle('Detalle de reserva')).toHaveAttribute('src', 'blob:detalle')

    objectUrlSpy.mockRestore()
    revokeSpy.mockRestore()
  })

  it('shows invalid token message', async () => {
    apiState.obtenerDetalleCompartidoPdf.mockRejectedValueOnce(new Error('not found'))

    renderPage('/detalle-reserva/invalido')

    expect(await screen.findByText('El enlace no es válido o venció.')).toBeInTheDocument()
  })
})
