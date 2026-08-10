import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const apiState = vi.hoisted(() => ({
  listarRango: vi.fn(),
  obtenerPorId: vi.fn(),
  consultarDisponibilidad: vi.fn(),
  crear: vi.fn(),
  listarClientes: vi.fn(),
}))

const authState = vi.hoisted(() => ({
  rol: 'Admin' as string,
}))

vi.mock('../../api/client', () => ({
  api: {
    eventos: {
      listarPorRango: apiState.listarRango,
      obtenerPorId: apiState.obtenerPorId,
      consultarDisponibilidad: apiState.consultarDisponibilidad,
      crear: apiState.crear,
    },
    clientes: {
      listar: apiState.listarClientes,
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

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, nombre: 'Admin', rol: authState.rol },
    isAuthenticated: true,
    login: vi.fn(),
    pinLogin: vi.fn(),
    logout: vi.fn(),
  }),
}))

describe('EventosPage', () => {
  beforeEach(() => {
    authState.rol = 'Admin'
    apiState.listarRango.mockReset()
    apiState.obtenerPorId.mockReset()
    apiState.consultarDisponibilidad.mockReset()
    apiState.crear.mockReset()
    apiState.listarClientes.mockReset()
    apiState.listarRango.mockResolvedValue([])
    apiState.obtenerPorId.mockResolvedValue(null)
    apiState.consultarDisponibilidad.mockResolvedValue(true)
    apiState.crear.mockResolvedValue({})
    apiState.listarClientes.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })
  })

  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  function renderPage() {
    return import('../../pages/EventosPage').then(({ default: EventosPage }) => render(<EventosPage />))
  }

  async function abrirAlta(user = userEvent.setup()) {
    await renderPage()
    await screen.findByText('Eventos')
    await user.click(screen.getByRole('button', { name: 'Nuevo Evento' }))
    return { user, dialog: await screen.findByRole('dialog', { name: 'Nuevo Evento' }) }
  }

  it('renders title and Nuevo Evento button', async () => {
    await renderPage()

    expect(await screen.findByText('Eventos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo Evento' })).toBeInTheDocument()
  })

  it('opens the create form and shows the expected fields', async () => {
    const { dialog } = await abrirAlta()

    expect(within(dialog).getByLabelText(/Cliente/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Fecha/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Hora inicio/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Hora fin/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Tipo de evento/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Cantidad de invitados/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Monto total/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Observaciones/)).toBeInTheDocument()
  })

  it('allows searching and selecting a client', async () => {
    apiState.listarClientes.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          nombre: 'Cliente Prueba',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          ivaCondicion: 'ConsumidorFinal',
          activo: true,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })

    const { user, dialog } = await abrirAlta()
    const input = within(dialog).getByPlaceholderText('Buscar cliente por nombre o documento')

    await user.type(input, 'Cli')
    await pause(350)

    await waitFor(() => expect(apiState.listarClientes).toHaveBeenCalledWith('Cli', 1, 10))
    await user.click(within(dialog).getByRole('button', { name: /Cliente Prueba/ }))

    expect(within(dialog).getByText(/Cliente Prueba/)).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('Cliente Prueba · DNI 12345678')).toBeInTheDocument()
  })

  it('validates that end time is after start time', async () => {
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '17:00')

    await pause(350)

    expect(within(dialog).getByText('La hora fin debe ser posterior a la hora inicio')).toBeInTheDocument()
    expect(apiState.consultarDisponibilidad).not.toHaveBeenCalled()
  })

  it('calls disponibilidad and shows Disponible', async () => {
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')

    await pause(350)

    await waitFor(() => expect(apiState.consultarDisponibilidad).toHaveBeenCalledWith({
      fecha: '2026-08-15',
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
    }))
    expect(within(dialog).getByText('Disponible')).toBeInTheDocument()
  })

  it('shows Horario no disponible and blocks save', async () => {
    apiState.consultarDisponibilidad.mockResolvedValueOnce(false)
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')

    await pause(350)

    expect(within(dialog).getByText('Horario no disponible')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Guardar Evento' })).toBeDisabled()
  })

  it('creates event with the exact payload and refreshes the calendar', async () => {
    const created = {
      id: 99,
      clienteId: 1,
      usuarioCreadorId: 7,
      sucursalId: 3,
      fecha: '2026-08-15',
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    }

    apiState.listarClientes.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          nombre: 'Cliente Prueba',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          ivaCondicion: 'ConsumidorFinal',
          activo: true,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
    apiState.listarRango
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([created])
    apiState.consultarDisponibilidad.mockResolvedValueOnce(true)
    apiState.crear.mockResolvedValueOnce(created)

    const { user, dialog } = await abrirAlta()

    await user.type(within(dialog).getByPlaceholderText('Buscar cliente por nombre o documento'), 'Cli')
    await pause(350)
    await user.click(within(dialog).getByRole('button', { name: /Cliente Prueba/ }))
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')
    await user.type(within(dialog).getByLabelText(/Tipo de evento/), 'Cumpleaños')
    await user.type(within(dialog).getByLabelText(/Cantidad de invitados/), '50')
    await user.type(within(dialog).getByLabelText(/Monto total/), '500000')
    await user.type(within(dialog).getByLabelText(/Observaciones/), 'Sin alcohol')

    await pause(350)
    await waitFor(() => expect(within(dialog).getByText('Disponible')).toBeInTheDocument())

    await user.click(within(dialog).getByRole('button', { name: 'Guardar Evento' }))

    expect(apiState.crear).toHaveBeenCalledWith({
      clienteId: 1,
      fecha: '2026-08-15',
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
    })
    expect(apiState.crear.mock.calls[0][0]).not.toHaveProperty('usuarioCreadorId')
    expect(apiState.crear.mock.calls[0][0]).not.toHaveProperty('sucursalId')
    expect(apiState.crear.mock.calls[0][0]).not.toHaveProperty('estado')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nuevo Evento' })).not.toBeInTheDocument())
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('18:00 Cumpleaños')).toBeInTheDocument()
  })

  it('keeps the modal open when backend rejects the save', async () => {
    apiState.listarClientes.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          nombre: 'Cliente Prueba',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          ivaCondicion: 'ConsumidorFinal',
          activo: true,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
    apiState.consultarDisponibilidad.mockResolvedValueOnce(true)
    apiState.crear.mockRejectedValueOnce(new Error('El evento no está disponible en ese horario'))

    const { user, dialog } = await abrirAlta()
    await user.type(within(dialog).getByPlaceholderText('Buscar cliente por nombre o documento'), 'Cli')
    await pause(350)
    await user.click(within(dialog).getByRole('button', { name: /Cliente Prueba/ }))
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')
    await user.type(within(dialog).getByLabelText(/Tipo de evento/), 'Cumpleaños')
    await user.type(within(dialog).getByLabelText(/Cantidad de invitados/), '50')
    await user.type(within(dialog).getByLabelText(/Monto total/), '500000')

    await pause(350)
    await waitFor(() => expect(within(dialog).getByText('Disponible')).toBeInTheDocument())

    await user.click(within(dialog).getByRole('button', { name: 'Guardar Evento' }))

    expect(await screen.findByText('El evento no está disponible en ese horario')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nuevo Evento' })).toBeInTheDocument()
  })

  it('disables the save button while the POST is pending', async () => {
    let resolveCreate!: (value: unknown) => void
    const createPromise = new Promise(resolve => { resolveCreate = resolve })

    apiState.listarClientes.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          nombre: 'Cliente Prueba',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          ivaCondicion: 'ConsumidorFinal',
          activo: true,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
    apiState.consultarDisponibilidad.mockResolvedValueOnce(true)
    apiState.crear.mockReturnValueOnce(createPromise)

    const { user, dialog } = await abrirAlta()
    await user.type(within(dialog).getByPlaceholderText('Buscar cliente por nombre o documento'), 'Cli')
    await pause(350)
    await user.click(within(dialog).getByRole('button', { name: /Cliente Prueba/ }))
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')
    await user.type(within(dialog).getByLabelText(/Tipo de evento/), 'Cumpleaños')
    await user.type(within(dialog).getByLabelText(/Cantidad de invitados/), '50')
    await user.type(within(dialog).getByLabelText(/Monto total/), '500000')

    await pause(350)
    await waitFor(() => expect(within(dialog).getByText('Disponible')).toBeInTheDocument())

    await user.click(within(dialog).getByRole('button', { name: 'Guardar Evento' }))

    expect(within(dialog).getByRole('button', { name: 'Guardando...' })).toBeDisabled()

    resolveCreate({
      id: 99,
      clienteId: 1,
      usuarioCreadorId: 7,
      sucursalId: 3,
      fecha: '2026-08-15',
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: null,
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })

    await createPromise
  })

  it('shows the read-only detail and no edit/cancel actions', async () => {
    authState.rol = 'Vendedor'
    apiState.listarRango.mockResolvedValueOnce([
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

    await renderPage()

    expect(await screen.findByText('18:00 Cumpleaños')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))

    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })
    expect(within(dialog).getByText('Reservado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar evento' })).not.toBeInTheDocument()
  })
})
