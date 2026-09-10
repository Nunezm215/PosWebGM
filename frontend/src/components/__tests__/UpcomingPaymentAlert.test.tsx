import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EventoDto } from '../../types'

const authState = vi.hoisted(() => ({ isAuthenticated: true }))
const apiState = vi.hoisted(() => ({
  listarPorRango: vi.fn(),
  resumenFinanciero: vi.fn(),
  obtenerCliente: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('../../formats', async () => {
  const actual = await vi.importActual<typeof import('../../formats')>('../../formats')
  return { ...actual, formatDateInput: () => '2026-09-10' }
})
vi.mock('../../api/client', () => ({
  api: {
    eventos: { listarPorRango: apiState.listarPorRango, resumenFinanciero: apiState.resumenFinanciero },
    clientes: { obtener: apiState.obtenerCliente },
  },
}))
vi.mock('../ui/Dialog', () => ({
  default: ({ open, title, children, footer }: any) => open ? <div role="dialog" aria-label={title}>{children}{footer}</div> : null,
}))

import UpcomingPaymentAlert, { UpcomingPaymentAlertProvider, useUpcomingPaymentAlert } from '../UpcomingPaymentAlert'

function event(id: number, fecha: string, estado = 'Reservado'): EventoDto {
  return { id, clienteId: id, usuarioCreadorId: 1, sucursalId: 1, fecha, horaInicio: '18:00:00', horaFin: '22:00:00', tipoEvento: `Evento ${id}`, cantidadInvitados: 10, montoTotal: 500000, estado, fechaCreacion: '2026-09-01T12:00:00' }
}

function ManualTrigger() {
  const alert = useUpcomingPaymentAlert()
  return <button type="button" onClick={() => alert?.openManually()}>Pagos próximos</button>
}

describe('UpcomingPaymentAlert', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('jwt_expires', '2026-12-31T00:00:00.000Z')
    sessionStorage.setItem('upcoming-payment-alert', '2026-12-31T00:00:00.000Z')
    apiState.listarPorRango.mockReset()
    apiState.resumenFinanciero.mockReset()
    apiState.obtenerCliente.mockReset()
    apiState.obtenerCliente.mockImplementation(async (id: number) => ({ id, nombre: `Cliente ${id}`, telefono: '11 1234-5678' }))
  })

  it('includes pending events from today through day 15, sorted by date', async () => {
    apiState.listarPorRango.mockResolvedValue([
      event(10, '2026-09-20'),
      event(15, '2026-09-25'),
      event(16, '2026-09-26'),
      event(9, '2026-09-09'),
      event(0, '2026-09-10'),
      event(1, '2026-09-11'),
      event(11, '2026-09-21', 'Cancelado'),
      event(12, '2026-09-22'),
    ])
    apiState.resumenFinanciero.mockImplementation(async (id: number) => ({
      eventoId: id,
      montoBase: 500000,
      totalExtras: 0,
      montoTotal: 500000,
      totalPagado: id === 12 ? 500000 : id === 0 ? 0 : 200000,
      saldoPendiente: id === 12 ? 0 : id === 0 ? 500000 : 300000,
      estadoPago: id === 12 ? 'Pagado' : id === 0 ? 'SinPagos' : 'Señado',
      cantidadPagosActivos: id === 0 ? 0 : 1,
    }))

    render(<UpcomingPaymentAlert />)

    expect(await screen.findByRole('dialog', { name: 'Eventos próximos con pago pendiente' })).toBeInTheDocument()
    expect(screen.getByText('Es hoy')).toBeInTheDocument()
    expect(screen.getByText('Falta 1 día')).toBeInTheDocument()
    expect(screen.getByText('Faltan 10 días')).toBeInTheDocument()
    expect(screen.getByText('Faltan 15 días')).toBeInTheDocument()
    expect(screen.queryByText('Evento 16')).not.toBeInTheDocument()
    expect(screen.queryByText('Evento 9')).not.toBeInTheDocument()
    expect(screen.queryByText('Evento 11')).not.toBeInTheDocument()
    expect(screen.queryByText('Evento 12')).not.toBeInTheDocument()
    expect(apiState.listarPorRango).toHaveBeenCalledWith('2026-09-10', '2026-09-25')
    expect(apiState.resumenFinanciero).not.toHaveBeenCalledWith(11)
    expect(apiState.resumenFinanciero).not.toHaveBeenCalledWith(16)
    expect(apiState.resumenFinanciero).not.toHaveBeenCalledWith(9)
    const cards = screen.getAllByText(/Evento (0|1|10|15)/).map(item => item.textContent)
    expect(cards).toEqual(['10/09/2026 - Evento 0', '11/09/2026 - Evento 1', '20/09/2026 - Evento 10', '25/09/2026 - Evento 15'])
  })

  it('does not open or repeat checks when there are no pending events or the login marker was consumed', async () => {
    apiState.listarPorRango.mockResolvedValue([event(1, '2026-09-11')])
    apiState.resumenFinanciero.mockResolvedValue({ eventoId: 1, montoBase: 500000, totalExtras: 0, montoTotal: 500000, totalPagado: 500000, saldoPendiente: 0, estadoPago: 'Pagado', cantidadPagosActivos: 1 })

    const { rerender } = render(<UpcomingPaymentAlert />)
    await waitFor(() => expect(apiState.resumenFinanciero).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<UpcomingPaymentAlert />)
    expect(apiState.listarPorRango).toHaveBeenCalledTimes(1)
  })

  it('opens manually with fresh data every time, even without the login marker', async () => {
    sessionStorage.clear()
    apiState.listarPorRango.mockResolvedValue([event(1, '2026-09-11')])
    apiState.resumenFinanciero.mockResolvedValue({ eventoId: 1, montoBase: 500000, totalExtras: 0, montoTotal: 500000, totalPagado: 200000, saldoPendiente: 300000, estadoPago: 'Señado', cantidadPagosActivos: 1 })
    const user = userEvent.setup()

    render(<UpcomingPaymentAlertProvider><ManualTrigger /></UpcomingPaymentAlertProvider>)
    await user.click(screen.getByRole('button', { name: 'Pagos próximos' }))
    expect(await screen.findByRole('dialog', { name: 'Eventos próximos con pago pendiente' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await user.click(screen.getByRole('button', { name: 'Pagos próximos' }))

    await waitFor(() => expect(apiState.listarPorRango).toHaveBeenCalledTimes(2))
    expect(apiState.resumenFinanciero).toHaveBeenCalledTimes(2)
  })

  it('shows an empty-state response for a manual check without pending events', async () => {
    sessionStorage.clear()
    apiState.listarPorRango.mockResolvedValue([event(1, '2026-09-11')])
    apiState.resumenFinanciero.mockResolvedValue({ eventoId: 1, montoBase: 500000, totalExtras: 0, montoTotal: 500000, totalPagado: 500000, saldoPendiente: 0, estadoPago: 'Pagado', cantidadPagosActivos: 1 })
    const user = userEvent.setup()

    render(<UpcomingPaymentAlertProvider><ManualTrigger /></UpcomingPaymentAlertProvider>)
    await user.click(screen.getByRole('button', { name: 'Pagos próximos' }))

    expect(await screen.findByText('No hay eventos próximos con pagos pendientes.')).toBeInTheDocument()
  })

  it('opens the client WhatsApp conversation without a predefined message', async () => {
    apiState.listarPorRango.mockResolvedValue([event(1, '2026-09-11')])
    apiState.resumenFinanciero.mockResolvedValue({ eventoId: 1, montoBase: 500000, totalExtras: 0, montoTotal: 500000, totalPagado: 0, saldoPendiente: 500000, estadoPago: 'SinPagos', cantidadPagosActivos: 0 })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const user = userEvent.setup()

    render(<UpcomingPaymentAlert />)
    await user.click(await screen.findByRole('button', { name: 'Abrir WhatsApp' }))

    expect(openSpy).toHaveBeenCalledWith('https://wa.me/5491112345678', '_blank', 'noopener,noreferrer')
    expect(openSpy.mock.calls[0][0]).not.toContain('?text=')
    openSpy.mockRestore()
  })

  it('supports an already normalized number and disables WhatsApp without a valid phone', async () => {
    apiState.listarPorRango.mockResolvedValue([event(1, '2026-09-11'), event(2, '2026-09-12')])
    apiState.resumenFinanciero.mockResolvedValue({ eventoId: 1, montoBase: 500000, totalExtras: 0, montoTotal: 500000, totalPagado: 0, saldoPendiente: 500000, estadoPago: 'SinPagos', cantidadPagosActivos: 0 })
    apiState.obtenerCliente.mockImplementation(async (id: number) => id === 1
      ? { id, nombre: 'Cliente 1', telefono: '5491112345678' }
      : { id, nombre: 'Cliente 2', telefono: '' })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const user = userEvent.setup()

    render(<UpcomingPaymentAlert />)
    await user.click(await screen.findByRole('button', { name: 'Abrir WhatsApp' }))

    expect(openSpy).toHaveBeenCalledWith('https://wa.me/5491112345678', '_blank', 'noopener,noreferrer')
    expect(screen.getByRole('button', { name: 'Sin teléfono' })).toBeDisabled()
    openSpy.mockRestore()
  })
})
