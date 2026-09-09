import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./pages/LoginPage', () => ({
  default: () => <div>LoginMock</div>,
}))

vi.mock('./pages/EventosPage', () => ({
  default: () => <div>EventosMock</div>,
}))

vi.mock('./pages/ClientesPage', () => ({
  default: () => <div>ClientesMock</div>,
}))

vi.mock('./pages/DetalleReservaPage', () => ({
  default: () => <div>DetalleReservaMock</div>,
}))

vi.mock('./updater', () => ({
  onUpdaterChange: () => () => undefined,
  runUpdateCheck: vi.fn(),
  initVersionCheck: vi.fn(),
  getCurrentVersion: () => '1.0.0',
}))

vi.mock('./api/client', () => ({
  esperarBackend: vi.fn().mockResolvedValue(undefined),
  api: {
    sucursales: {
      listar: vi.fn().mockResolvedValue([]),
    },
    auth: {
      login: vi.fn(),
      pinLogin: vi.fn(),
    },
  },
}))

vi.mock('./versionCheck', () => ({
  initVersionCheck: vi.fn(),
  getCurrentVersion: () => '1.0.0',
}))

describe('App navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  async function renderApp() {
    const { default: App } = await import('./App')
    return render(<App />)
  }

  it('redirects an authenticated root visit to Eventos', async () => {
    localStorage.setItem('jwt_token', 'token')
    localStorage.setItem('jwt_expires', new Date(Date.now() + 60_000).toISOString())
    localStorage.setItem('user_info', JSON.stringify({ id: 1, nombre: 'Admin', rol: 'Admin' }))

    await renderApp()

    expect(await screen.findByText('EventosMock', {}, { timeout: 10000 })).toBeInTheDocument()
  })

  it('keeps a valid deep link for an authenticated user', async () => {
    localStorage.setItem('jwt_token', 'token')
    localStorage.setItem('jwt_expires', new Date(Date.now() + 60_000).toISOString())
    localStorage.setItem('user_info', JSON.stringify({ id: 1, nombre: 'Admin', rol: 'Admin' }))
    window.history.pushState({}, '', '/clientes')

    await renderApp()

    expect(await screen.findByText('ClientesMock')).toBeInTheDocument()
  })

  it('keeps the unauthenticated root on the login flow', async () => {
    await renderApp()

    expect(await screen.findByText('LoginMock')).toBeInTheDocument()
  })

  it('exposes the public detail route without auth', async () => {
    window.history.pushState({}, '', '/detalle-reserva/token-123')

    await renderApp()

    expect(await screen.findByText('DetalleReservaMock')).toBeInTheDocument()
  })
})
