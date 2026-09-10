import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
}))

const apiState = vi.hoisted(() => ({
  sucursales: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn().mockResolvedValue(undefined),
    pinLogin: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: authState.isAuthenticated,
  }),
}))

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    notifyError: vi.fn(),
  }),
}))

vi.mock('../../api/client', () => ({
  api: {
    sucursales: {
      listar: apiState.sucursales,
    },
  },
}))

describe('LoginPage navigation', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    apiState.sucursales.mockReset()
    apiState.sucursales.mockResolvedValue([{ id: 1, nombre: 'Central' }])
    authState.isAuthenticated = false
    localStorage.clear()
    sessionStorage.clear()
  })

  it('navigates to Eventos after a successful login', async () => {
    const { default: LoginPage } = await import('../LoginPage')
    const user = userEvent.setup()

    render(<LoginPage />)
    localStorage.setItem('jwt_expires', '2026-12-31T00:00:00.000Z')

    await user.type(screen.getByPlaceholderText('Nombre de usuario'), 'demo')
    await user.type(screen.getByPlaceholderText('••••••••'), '1234')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/eventos', { replace: true }))
    expect(sessionStorage.getItem('upcoming-payment-alert')).toBe('2026-12-31T00:00:00.000Z')
  })
})
