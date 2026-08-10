import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const eventosState = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  api: {
    eventos: {
      listarPorRango: eventosState.list,
      obtenerPorId: eventosState.getById,
    },
  },
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

describe('EventosPage', () => {
  beforeEach(() => {
    eventosState.list.mockReset()
    eventosState.getById.mockReset()
  })

  it('renders title and subtitle', async () => {
    eventosState.list.mockResolvedValue([])
    const { default: EventosPage } = await import('../../pages/EventosPage')

    render(<EventosPage />)

    expect(await screen.findByText('Eventos')).toBeInTheDocument()
    expect(screen.getByText('Calendario de reservas y eventos')).toBeInTheDocument()
  })

  it('calls GET rango on mount', async () => {
    eventosState.list.mockResolvedValue([])
    const { default: EventosPage } = await import('../../pages/EventosPage')

    render(<EventosPage />)

    await waitFor(() => expect(eventosState.list).toHaveBeenCalled())
    expect(eventosState.list).toHaveBeenCalledWith('2026-07-27', '2026-09-06')
  })

  it('shows event returned by API', async () => {
    eventosState.list.mockResolvedValue([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-15',
        horaInicio: '18:00:00',
        horaFin: '22:00:00',
        tipoEvento: 'Cumpleaños',
        cantidadInvitados: 50,
        montoTotal: 500000,
        observaciones: 'Sin alcohol',
        estado: 'Reservado',
        fechaCreacion: '2026-08-10T12:00:00',
      },
    ])
    const { default: EventosPage } = await import('../../pages/EventosPage')

    render(<EventosPage />)

    expect(await screen.findByText('18:00 Cumpleaños')).toBeInTheDocument()
  })

  it('click opens read-only detail', async () => {
    eventosState.list.mockResolvedValue([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-15',
        horaInicio: '18:00:00',
        horaFin: '22:00:00',
        tipoEvento: 'Cumpleaños',
        cantidadInvitados: 50,
        montoTotal: 500000,
        observaciones: 'Sin alcohol',
        estado: 'Reservado',
        fechaCreacion: '2026-08-10T12:00:00',
      },
    ])
    const { default: EventosPage } = await import('../../pages/EventosPage')
    const user = userEvent.setup()

    render(<EventosPage />)

    expect(await screen.findByText('18:00 Cumpleaños')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))

    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })
    expect(within(dialog).getByText('Reservado')).toBeInTheDocument()
  })

  it('detail shows formatted amount', async () => {
    eventosState.list.mockResolvedValue([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-15',
        horaInicio: '18:00:00',
        horaFin: '22:00:00',
        tipoEvento: 'Cumpleaños',
        cantidadInvitados: 50,
        montoTotal: 500000,
        observaciones: 'Sin alcohol',
        estado: 'Reservado',
        fechaCreacion: '2026-08-10T12:00:00',
      },
    ])
    const { default: EventosPage } = await import('../../pages/EventosPage')
    const user = userEvent.setup()

    render(<EventosPage />)
    expect(await screen.findByText('18:00 Cumpleaños')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))

    expect(await screen.findByText('$ 500.000,00')).toBeInTheDocument()
  })

  it('changing month triggers new request', async () => {
    eventosState.list.mockResolvedValue([])
    const { default: EventosPage } = await import('../../pages/EventosPage')
    const user = userEvent.setup()

    render(<EventosPage />)

    await waitFor(() => expect(eventosState.list).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    await waitFor(() => expect(eventosState.list).toHaveBeenCalledTimes(2))
  })

  it('shows API error message', async () => {
    eventosState.list.mockRejectedValue(new Error('Error al cargar eventos'))
    const { default: EventosPage } = await import('../../pages/EventosPage')

    render(<EventosPage />)

    expect(await screen.findByText('Error al cargar eventos')).toBeInTheDocument()
  })

  it('shows cancelled event with label', async () => {
    eventosState.list.mockResolvedValue([
      {
        id: 2,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-16',
        horaInicio: '20:00:00',
        horaFin: '21:00:00',
        tipoEvento: 'Reunión',
        cantidadInvitados: 10,
        montoTotal: 10000,
        observaciones: '',
        estado: 'Cancelado',
        fechaCreacion: '2026-08-10T12:00:00',
      },
    ])
    const { default: EventosPage } = await import('../../pages/EventosPage')

    render(<EventosPage />)

    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
  })

  it('does not show create edit or cancel actions', async () => {
    eventosState.list.mockResolvedValue([])
    const { default: EventosPage } = await import('../../pages/EventosPage')

    render(<EventosPage />)

    await screen.findByText('Eventos')
    expect(screen.queryByText(/nuevo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/editar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/cancelar/i)).not.toBeInTheDocument()
  })
})
