import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from '../Layout'

const userState = vi.hoisted(() => ({
  user: { id: 1, nombre: 'Admin', rol: 'Admin' as string } as { id: number; nombre: string; rol: string } | null,
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: userState.user,
    logout: vi.fn(),
  }),
}))

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    current: null,
    hasNext: false,
    notifyError: vi.fn(),
    notifySuccess: vi.fn(),
    notifyInfo: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

vi.mock('../../api/client', () => ({
  api: {
    sucursales: { listar: vi.fn() },
  },
}))

vi.mock('../ProductLookupModal', () => ({
  default: () => null,
}))

vi.mock('../../versionCheck', () => ({
  getCurrentVersion: () => '1.0.0',
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}))

describe('Layout navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    userState.user = { id: 1, nombre: 'Admin', rol: 'Admin' }
  })

  function renderLayout() {
    return render(
      <MemoryRouter initialEntries={['/clientes']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it('shows only the salon-visible modules for admin roles', () => {
    renderLayout()

    expect(screen.getByText('GE')).toBeInTheDocument()
    expect(screen.getAllByText('Gestor de Eventos')).toHaveLength(2)
    expect(screen.getByText('Eventos')).toBeInTheDocument()
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.getByText('Oportunidades')).toBeInTheDocument()
    expect(screen.getByText('Caja')).toBeInTheDocument()
    expect(screen.getByText('Gastos')).toBeInTheDocument()
    expect(screen.getByText('Usuarios')).toBeInTheDocument()
    expect(screen.getByText('Configuración')).toBeInTheDocument()

    expect(screen.queryByText('Ventas')).not.toBeInTheDocument()
    expect(screen.queryByText('Compras')).not.toBeInTheDocument()
    expect(screen.queryByText('Productos')).not.toBeInTheDocument()
    expect(screen.queryByText('Historial')).not.toBeInTheDocument()
    expect(screen.queryByText('Proveedores')).not.toBeInTheDocument()
    expect(screen.queryByText('Deudas')).not.toBeInTheDocument()
    expect(screen.queryByText('Pedidos')).not.toBeInTheDocument()
    expect(screen.queryByText('Ofertas')).not.toBeInTheDocument()
    expect(screen.queryByText('PW')).not.toBeInTheDocument()
    expect(screen.queryByText('Punto de Venta')).not.toBeInTheDocument()
  })

  it('does not show the active branch name or switch action in the header', () => {
    localStorage.setItem('sucursalActiva', JSON.stringify({ id: 1, nombre: 'Sucursal Central' }))
    renderLayout()

    expect(screen.queryByText('Sucursal Central')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cambiar sucursal/i })).not.toBeInTheDocument()
  })

  it('keeps the user-comun menu reduced', () => {
    userState.user = { id: 2, nombre: 'Usuario', rol: 'UsuarioComun' }
    renderLayout()

    expect(screen.getByText('Eventos')).toBeInTheDocument()
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.queryByText('Oportunidades')).not.toBeInTheDocument()
    expect(screen.queryByText('Caja')).not.toBeInTheDocument()
    expect(screen.queryByText('Gastos')).not.toBeInTheDocument()
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument()
    expect(screen.queryByText('Configuración')).not.toBeInTheDocument()
  })

  it('also shows Eventos for SuperAdmin', () => {
    userState.user = { id: 3, nombre: 'Super', rol: 'SuperAdmin' }
    renderLayout()

    expect(screen.getByText('Eventos')).toBeInTheDocument()
    expect(screen.getByText('Oportunidades')).toBeInTheDocument()
    expect(screen.getByText('Caja')).toBeInTheDocument()
  })

  it('keeps logout available', () => {
    renderLayout()

    expect(screen.getAllByRole('button', { name: /Salir/i })).toHaveLength(2)
  })
})
