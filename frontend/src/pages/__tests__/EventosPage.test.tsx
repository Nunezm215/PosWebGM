import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildTelHref, buildWhatsAppHref } from '../../utils/phone'

const apiState = vi.hoisted(() => ({
  listarRango: vi.fn(),
  obtenerPorId: vi.fn(),
  consultarDisponibilidad: vi.fn(),
  crear: vi.fn(),
  editar: vi.fn(),
  crearCliente: vi.fn(),
  obtenerCliente: vi.fn(),
  obtenerContratoPdf: vi.fn(),
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
      editar: apiState.editar,
      obtenerContratoPdf: apiState.obtenerContratoPdf,
    },
    clientes: {
      listar: apiState.listarClientes,
      crear: apiState.crearCliente,
      obtener: apiState.obtenerCliente,
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
    apiState.editar.mockReset()
    apiState.crearCliente.mockReset()
    apiState.obtenerCliente.mockReset()
    apiState.obtenerContratoPdf.mockReset()
    apiState.listarClientes.mockReset()
    apiState.listarRango.mockResolvedValue([])
    apiState.obtenerPorId.mockResolvedValue(null)
    apiState.consultarDisponibilidad.mockResolvedValue(true)
    apiState.crear.mockResolvedValue({})
    apiState.editar.mockResolvedValue({})
    apiState.crearCliente.mockResolvedValue({})
    apiState.obtenerCliente.mockResolvedValue({
      id: 1,
      nombre: 'Juan Pérez',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '+54 11-1234-5678',
      domicilio: '',
      mail: '',
      activo: true,
    })
    apiState.obtenerContratoPdf.mockResolvedValue({ blob: new Blob(['pdf'], { type: 'application/pdf' }), filename: 'Contrato-Evento-1-2026-08-15.pdf' })
    apiState.listarClientes.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })
  })

  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const dateKeyFromToday = (offsetDays = 0) => {
    const date = new Date()
    date.setDate(date.getDate() + offsetDays)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const dayLabelFromDateKey = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number)
    const raw = new Date(year, month - 1, day).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  const dayButtonName = (dateKey: string) => new RegExp(`Eventos del día .*${dayLabelFromDateKey(dateKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

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
    expect(screen.queryByRole('button', { name: 'Mes anterior' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mes siguiente' })).not.toBeInTheDocument()
    expect(screen.queryByText('Hoy')).not.toBeInTheDocument()
    expect(screen.queryByText(/2026-\d{2}-\d{2} - 2026-\d{2}-\d{2}/)).not.toBeInTheDocument()
  })

  it('shows selector with current month and opens the month list', async () => {
    await renderPage()

    const monthButton = await screen.findByRole('button', { name: /Agosto de 2026/ })
    expect(monthButton).toHaveAttribute('aria-haspopup', 'listbox')
    expect(monthButton).toHaveAttribute('aria-expanded', 'false')

    await userEvent.setup().click(monthButton)

    const listbox = await screen.findByRole('listbox', { name: 'Selector de mes' })
    expect(listbox).toBeInTheDocument()
    expect(within(listbox).getByRole('option', { name: /Agosto de 2026/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows 6 months before and future months in the selector', async () => {
    await renderPage()
    await userEvent.setup().click(await screen.findByRole('button', { name: /Agosto de 2026/ }))

    const listbox = await screen.findByRole('listbox', { name: 'Selector de mes' })
    expect(within(listbox).getByRole('option', { name: /Febrero de 2026/ })).toBeInTheDocument()
    expect(within(listbox).getByRole('option', { name: /Julio de 2026/ })).toBeInTheDocument()
    expect(within(listbox).getByRole('option', { name: /Septiembre de 2026/ })).toBeInTheDocument()
    expect(within(listbox).getByRole('option', { name: /Febrero de 2027/ })).toBeInTheDocument()
    expect(within(listbox).queryByRole('option', { name: /Enero de 2026/ })).not.toBeInTheDocument()
  })

  it('changes month when selecting previous or next month', async () => {
    await renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Agosto de 2026/ }))
    await user.click(await screen.findByRole('option', { name: /Julio de 2026/ }))
    expect(await screen.findByRole('button', { name: /Julio de 2026/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Julio de 2026/ }))
    await user.click(await screen.findByRole('option', { name: /Agosto de 2026/ }))
    expect(await screen.findByRole('button', { name: /Agosto de 2026/ })).toBeInTheDocument()
  })

  it('reconsults the visible range when the month changes', async () => {
    await renderPage()
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalled())
    const initialCalls = apiState.listarRango.mock.calls.length

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Agosto de 2026/ }))
    await user.click(await screen.findByRole('option', { name: /Septiembre de 2026/ }))

    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(initialCalls + 1))
  })

  it('keeps the day popup and availability flows intact', async () => {
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

    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: /Eventos del día .*15 de agosto de 2026/ }))
    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    expect(within(dayDialog).getByRole('button', { name: 'Añadir evento' })).toBeInTheDocument()
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

  it('opens the client form from Nuevo Evento', async () => {
    const { user, dialog } = await abrirAlta()

    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))

    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })
    expect(within(clientDialog).getByLabelText('Nombre *')).toBeInTheDocument()
    expect(within(clientDialog).getByLabelText('Fecha de nacimiento *')).toBeInTheDocument()
    expect(within(clientDialog).getByLabelText('Código')).toHaveValue('54911')
    expect(within(clientDialog).getByLabelText('Celular / Teléfono *')).toBeInTheDocument()
    expect(within(clientDialog).getByLabelText('Email *')).toBeInTheDocument()
    expect(within(clientDialog).getByLabelText('Tipo documento')).toBeInTheDocument()
    expect(within(clientDialog).getByLabelText('DNI / número de documento')).toBeInTheDocument()
    expect(within(clientDialog).getByLabelText('Domicilio')).toBeInTheDocument()
    expect(within(clientDialog).getByText('Número (8 dígitos)')).toBeInTheDocument()
    expect(within(clientDialog).getByText(/Familiares \(opcional\)/)).toBeInTheDocument()
    expect(within(clientDialog).queryByLabelText(/Condición IVA/)).not.toBeInTheDocument()
  })

  it('muestra 7 digitos cuando cambia el codigo en el alta de cliente del evento', async () => {
    const { user, dialog } = await abrirAlta()

    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })

    fireEvent.change(within(clientDialog).getByLabelText('Código'), { target: { value: '549221' } })

    expect(within(clientDialog).getByText('Número (7 dígitos)')).toBeInTheDocument()
    expect(within(clientDialog).getByPlaceholderText('1234567')).toBeInTheDocument()
  })

  it('keeps Evento data while creating a Cliente and auto-selects the new Cliente', async () => {
    const createdClient = {
      id: 10,
      nombre: 'Cliente Nuevo',
      fechaNacimiento: '1990-01-01',
      tipoDocumento: 'DNI',
      numeroDocumento: null,
      ivaCondicion: 'ConsumidorFinal',
      telefono: '11111111',
      domicilio: null,
      mail: 'cliente@correo.com',
      familiares: [
        {
          id: 0,
          nombre: 'Familiar Uno',
          fechaNacimiento: '2015-02-03',
        },
      ],
      activo: true,
    }

    apiState.crearCliente.mockResolvedValueOnce(createdClient)

    const { user, dialog } = await abrirAlta()
    fireEvent.change(within(dialog).getByPlaceholderText('Buscar cliente por nombre o documento'), { target: { value: 'Cli' } })
    await pause(350)
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    fireEvent.change(within(dialog).getByLabelText(/Hora inicio/), { target: { value: '18:00' } })
    fireEvent.change(within(dialog).getByLabelText(/Hora fin/), { target: { value: '22:00' } })
    fireEvent.change(within(dialog).getByLabelText(/Tipo de evento/), { target: { value: 'Cumpleaños' } })
    fireEvent.change(within(dialog).getByLabelText(/Cantidad de invitados/), { target: { value: '50' } })
    fireEvent.change(within(dialog).getByLabelText(/Monto total/), { target: { value: '500000' } })

    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })
    await user.click(within(clientDialog).getByRole('button', { name: 'Agregar familiar' }))
    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Cliente Nuevo' } })
    fireEvent.change(within(clientDialog).getByLabelText('Fecha de nacimiento *'), { target: { value: '1990-01-01' } })
    fireEvent.change(within(clientDialog).getByLabelText('Celular / Teléfono *'), { target: { value: '12345678' } })
    fireEvent.change(within(clientDialog).getByLabelText('Email *'), { target: { value: 'cliente@correo.com' } })
    fireEvent.change(clientDialog.querySelector('#evento-cliente-familiar-0-nombre') as HTMLInputElement, { target: { value: 'Familiar Uno' } })
    fireEvent.change(within(clientDialog).getAllByLabelText('Fecha nacimiento')[0], { target: { value: '2015-02-03' } })
    await user.click(within(clientDialog).getByRole('button', { name: 'Guardar Cliente' }))

    await waitFor(() => expect(apiState.crearCliente).toHaveBeenCalledWith({
      nombre: 'Cliente Nuevo',
      fechaNacimiento: '1990-01-01',
      tipoDocumento: 'DNI',
      numeroDocumento: null,
      ivaCondicion: 'ConsumidorFinal',
      telefono: '5491112345678',
      domicilio: null,
      mail: 'cliente@correo.com',
      familiares: [
        {
          id: 0,
          nombre: 'Familiar Uno',
          fechaNacimiento: '2015-02-03',
        },
      ],
    }))

    expect(screen.queryByRole('dialog', { name: 'Nuevo Cliente' })).not.toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('Cliente Nuevo')).toBeInTheDocument()
  })

  it('permite crear cliente sin familiares', async () => {
    const createdClient = {
      id: 11,
      nombre: 'Cliente Sin Familia',
      fechaNacimiento: '1990-01-01',
      tipoDocumento: 'DNI',
      numeroDocumento: null,
      ivaCondicion: 'ConsumidorFinal',
      telefono: '5491112345678',
      domicilio: null,
      mail: 'sin-familia@correo.com',
      familiares: [],
      activo: true,
    }

    apiState.crearCliente.mockResolvedValueOnce(createdClient)

    const { user, dialog } = await abrirAlta()
    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })
    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Cliente Sin Familia' } })
    fireEvent.change(within(clientDialog).getByLabelText('Fecha de nacimiento *'), { target: { value: '1990-01-01' } })
    fireEvent.change(within(clientDialog).getByLabelText('Celular / Teléfono *'), { target: { value: '12345678' } })
    fireEvent.change(within(clientDialog).getByLabelText('Email *'), { target: { value: 'sin-familia@correo.com' } })

    await user.click(within(clientDialog).getByRole('button', { name: 'Guardar Cliente' }))

    await waitFor(() => expect(apiState.crearCliente).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Cliente Sin Familia',
      fechaNacimiento: '1990-01-01',
      familiares: [],
    })))
  })

  it('bloquea crear cliente si el numero tiene menos digitos de los esperados', async () => {
    const { user, dialog } = await abrirAlta()

    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })

    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Cliente Nuevo' } })
    fireEvent.change(within(clientDialog).getByLabelText('Fecha de nacimiento *'), { target: { value: '1990-01-01' } })
    fireEvent.change(within(clientDialog).getByLabelText('Celular / Teléfono *'), { target: { value: '1234567' } })
    fireEvent.change(within(clientDialog).getByLabelText('Email *'), { target: { value: 'cliente@correo.com' } })

    await user.click(within(clientDialog).getByRole('button', { name: 'Guardar Cliente' }))

    expect(await within(clientDialog).findByText('El número debe tener 8 dígitos')).toBeInTheDocument()
    expect(apiState.crearCliente).not.toHaveBeenCalled()
  })

  it('bloquea guardar si un familiar tiene fecha vacia', async () => {
    const { user, dialog } = await abrirAlta()
    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })
    await user.click(within(clientDialog).getByRole('button', { name: 'Agregar familiar' }))

    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Cliente Nuevo' } })
    fireEvent.change(within(clientDialog).getByLabelText('Fecha de nacimiento *'), { target: { value: '1990-01-01' } })
    fireEvent.change(within(clientDialog).getByLabelText('Celular / Teléfono *'), { target: { value: '12345678' } })
    fireEvent.change(within(clientDialog).getByLabelText('Email *'), { target: { value: 'cliente@correo.com' } })
    fireEvent.change(within(clientDialog).getByLabelText('Nombre'), { target: { value: 'Familiar Uno' } })

    await user.click(within(clientDialog).getByRole('button', { name: 'Guardar Cliente' }))

    expect(await within(clientDialog).findByText('La fecha de nacimiento del familiar es obligatoria')).toBeInTheDocument()
    expect(apiState.crearCliente).not.toHaveBeenCalled()
  })

  it('bloquea guardar si un familiar tiene fecha futura', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const futureDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const { user, dialog } = await abrirAlta()
    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })
    await user.click(within(clientDialog).getByRole('button', { name: 'Agregar familiar' }))

    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Cliente Nuevo' } })
    fireEvent.change(within(clientDialog).getByLabelText('Fecha de nacimiento *'), { target: { value: '1990-01-01' } })
    fireEvent.change(within(clientDialog).getByLabelText('Celular / Teléfono *'), { target: { value: '12345678' } })
    fireEvent.change(within(clientDialog).getByLabelText('Email *'), { target: { value: 'cliente@correo.com' } })
    fireEvent.change(within(clientDialog).getByLabelText('Nombre'), { target: { value: 'Familiar Uno' } })
    fireEvent.change(within(clientDialog).getByLabelText('Fecha nacimiento'), { target: { value: futureDate } })

    await user.click(within(clientDialog).getByRole('button', { name: 'Guardar Cliente' }))

    expect(await within(clientDialog).findByText('La fecha de nacimiento del familiar no puede ser futura')).toBeInTheDocument()
    expect(apiState.crearCliente).not.toHaveBeenCalled()
  })

  it('mantiene la fecha del cliente al agregar y eliminar familiares', async () => {
    const { user, dialog } = await abrirAlta()
    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })

    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Cliente Nuevo' } })
    fireEvent.change(within(clientDialog).getByLabelText('Fecha de nacimiento *'), { target: { value: '1990-01-01' } })
    fireEvent.change(within(clientDialog).getByLabelText('Celular / Teléfono *'), { target: { value: '11111111' } })
    fireEvent.change(within(clientDialog).getByLabelText('Email *'), { target: { value: 'cliente@correo.com' } })

    await user.click(within(clientDialog).getByRole('button', { name: 'Agregar familiar' }))
    await user.click(within(clientDialog).getByRole('button', { name: 'Eliminar' }))

    expect((clientDialog.querySelector('input[type="date"]') as HTMLInputElement).value).toBe('1990-01-01')
  })

  it('cancels cliente creation and preserves Evento data', async () => {
    const { user, dialog } = await abrirAlta()
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')
    await user.type(within(dialog).getByLabelText(/Tipo de evento/), 'Cumpleaños')

    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })
    await user.click(within(clientDialog).getByRole('button', { name: 'Volver al Evento' }))

    expect(screen.queryByRole('dialog', { name: 'Nuevo Cliente' })).not.toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('2026-08-15')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('18:00')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('22:00')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('Cumpleaños')).toBeInTheDocument()
  })

  it('keeps the client form open on error', async () => {
    apiState.crearCliente.mockRejectedValueOnce(new Error('Documento duplicado'))
    const { user, dialog } = await abrirAlta()

    await user.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })
    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Cliente Nuevo' } })
    fireEvent.change(within(clientDialog).getByLabelText('Fecha de nacimiento *'), { target: { value: '1990-01-01' } })
    fireEvent.change(within(clientDialog).getByLabelText('Celular / Teléfono *'), { target: { value: '12345678' } })
    fireEvent.change(within(clientDialog).getByLabelText('Email *'), { target: { value: 'cliente@correo.com' } })
    await user.click(within(clientDialog).getByRole('button', { name: 'Guardar Cliente' }))

    expect(await screen.findByText('Documento duplicado')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nuevo Cliente' })).toBeInTheDocument()
  })

  it('does not show inline client creation in edit mode', async () => {
    apiState.obtenerCliente.mockResolvedValueOnce({
      id: 1,
      nombre: 'Cliente Prueba',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '',
      domicilio: '',
      mail: '',
      activo: true,
    })
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
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })
    await user.click(within(dialog).getByRole('button', { name: 'Editar' }))

    const editDialog = await screen.findByRole('dialog', { name: 'Editar Evento' })
    expect(within(editDialog).queryByRole('button', { name: 'Crear cliente nuevo' })).not.toBeInTheDocument()
  })

  it('opens the daily dialog when clicking a day', async () => {
    apiState.listarClientes.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          nombre: 'Juan Pérez',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          ivaCondicion: 'ConsumidorFinal',
          activo: true,
        },
        {
          id: 2,
          nombre: 'María Gómez',
          tipoDocumento: 'DNI',
          numeroDocumento: '87654321',
          ivaCondicion: 'ConsumidorFinal',
          activo: true,
        },
      ],
      totalCount: 2,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    })
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
      {
        id: 2,
        clienteId: 2,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-15',
        horaInicio: '10:00:00',
        horaFin: '12:00:00',
        tipoEvento: 'Brunch',
        cantidadInvitados: 20,
        montoTotal: 150000,
        observaciones: '',
        estado: 'Pagado',
        fechaCreacion: '2026-08-10T12:00:00',
      },
    ])

    await renderPage()
    await screen.findByRole('button', { name: /Eventos del día .*15 de agosto de 2026/ })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Eventos del día .*15 de agosto de 2026/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await waitFor(() => expect(apiState.listarClientes).toHaveBeenCalledTimes(1))
    expect(within(dialog).getByText(/2 eventos?/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '10:00 Brunch' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '18:00 Cumpleaños' })).toBeInTheDocument()
    expect(within(dialog).getAllByText('18:00 - 22:00')[0]).toBeInTheDocument()
    expect(within(dialog).getAllByText('10:00 - 12:00')[0]).toBeInTheDocument()
    expect(within(dialog).getByText('Reservado por: Juan Pérez')).toBeInTheDocument()
    expect(within(dialog).getByText('Reservado por: María Gómez')).toBeInTheDocument()
  })

  it('marks days with active reservations and ignores cancelados alone', async () => {
    const keyWithActive = '2026-08-15'
    const keyOnlyCancelled = '2026-08-16'
    const keyMixed = '2026-08-17'

    apiState.listarRango.mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: keyWithActive,
        horaInicio: '18:00:00',
        horaFin: '22:00:00',
        tipoEvento: 'Cumpleaños',
        cantidadInvitados: 50,
        montoTotal: 500000,
        observaciones: 'Sin alcohol',
        estado: 'Reservado',
        fechaCreacion: '2026-08-10T12:00:00',
      },
      {
        id: 2,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: keyOnlyCancelled,
        horaInicio: '10:00:00',
        horaFin: '12:00:00',
        tipoEvento: 'Cancelado Solo',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Cancelado',
        fechaCreacion: '2026-08-10T12:00:00',
      },
      {
        id: 3,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: keyMixed,
        horaInicio: '11:00:00',
        horaFin: '13:00:00',
        tipoEvento: 'Activo',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Señado',
        fechaCreacion: '2026-08-10T12:00:00',
      },
      {
        id: 4,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: keyMixed,
        horaInicio: '14:00:00',
        horaFin: '16:00:00',
        tipoEvento: 'Cancelado Mixto',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Cancelado',
        fechaCreacion: '2026-08-10T12:00:00',
      },
    ])

    await renderPage()

    expect(await screen.findByRole('button', { name: /Eventos del día .*15 de agosto de 2026/ })).toHaveAttribute('data-has-events', 'true')
    expect(screen.getByRole('button', { name: /Eventos del día .*16 de agosto de 2026/ })).toHaveAttribute('data-has-events', 'false')
    expect(screen.getByRole('button', { name: /Eventos del día .*17 de agosto de 2026/ })).toHaveAttribute('data-has-events', 'true')
  })

  it('shows a fallback reserved-by label when the client is not in cache', async () => {
    apiState.listarClientes.mockResolvedValueOnce({
      items: [{
        id: 1,
        nombre: 'Juan Pérez',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        ivaCondicion: 'ConsumidorFinal',
        activo: true,
      }],
      totalCount: 1,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    })
    apiState.listarRango.mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 99,
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
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Eventos del día .*15 de agosto de 2026/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    expect(within(dialog).getByText('Reservado por: Cliente #99')).toBeInTheDocument()
  })

  it('shows the empty day message when clicking a day without events', async () => {
    apiState.listarRango.mockResolvedValueOnce([])

    await renderPage()
    await screen.findByRole('button', { name: /Eventos del día .*16 de agosto de 2026/ })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Eventos del día .*16 de agosto de 2026/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    expect(within(dialog).getByText('No hay eventos para este día.')).toBeInTheDocument()
  })

  it('does not show Añadir evento for a past day', async () => {
    apiState.listarRango.mockResolvedValueOnce([])

    await renderPage()

    const pastKey = dateKeyFromToday(-1)
    const pastDay = await screen.findByRole('button', { name: dayButtonName(pastKey) })
    await userEvent.setup().click(pastDay)

    const dialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    expect(within(dialog).queryByRole('button', { name: 'Añadir evento' })).not.toBeInTheDocument()
  })

  it('shows Añadir evento for today and future days', async () => {
    apiState.listarRango.mockResolvedValue([])

    await renderPage()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: dayButtonName(dateKeyFromToday(1)) }))

    const dialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    expect(within(dialog).getByRole('button', { name: 'Añadir evento' })).toBeInTheDocument()
  })

  it('shows Añadir evento for a day that already has events', async () => {
    const key = dateKeyFromToday(1)
    apiState.listarRango.mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: key,
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
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: dayButtonName(key) }))

    const dialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    expect(within(dialog).getByRole('button', { name: 'Añadir evento' })).toBeInTheDocument()
  })

  it('opens Nuevo Evento with the selected day when clicking Añadir evento', async () => {
    apiState.listarRango.mockResolvedValueOnce([])

    await renderPage()
    const user = userEvent.setup()
    const selectedKey = dateKeyFromToday(1)
    await user.click(await screen.findByRole('button', { name: dayButtonName(selectedKey) }))

    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await user.click(within(dayDialog).getByRole('button', { name: 'Añadir evento' }))

    expect(screen.queryByRole('dialog', { name: 'Eventos del día' })).not.toBeInTheDocument()
    const createDialog = await screen.findByRole('dialog', { name: 'Nuevo Evento' })
    expect(within(createDialog).getByLabelText(/Fecha/)).toHaveValue(selectedKey)
    expect(within(createDialog).getByLabelText(/Hora inicio/)).toHaveValue('')
    expect(within(createDialog).getByLabelText(/Hora fin/)).toHaveValue('')
    expect(within(createDialog).getByLabelText(/Cliente/)).toHaveValue('')
  })

  it('keeps the general Nuevo Evento button independent from the selected day', async () => {
    apiState.listarRango.mockResolvedValueOnce([])

    await renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: dayButtonName(dateKeyFromToday(1)) }))
    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await user.click(within(dayDialog).getAllByRole('button', { name: /^Cerrar$/ })[1])
    await user.click(screen.getByRole('button', { name: 'Nuevo Evento' }))

    const createDialog = await screen.findByRole('dialog', { name: 'Nuevo Evento' })
    expect(await within(createDialog).findByDisplayValue(dateKeyFromToday())).toBeInTheDocument()
  })

  it('cierra el popup diario sin abrir Nuevo Evento', async () => {
    apiState.listarRango.mockResolvedValueOnce([])

    await renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: dayButtonName(dateKeyFromToday(1)) }))

    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await user.click(within(dayDialog).getAllByRole('button', { name: /^Cerrar$/ })[1])

    expect(screen.queryByRole('dialog', { name: 'Eventos del día' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Nuevo Evento' })).not.toBeInTheDocument()
  })

  it('abre Nuevo Evento desde el popup con la fecha seleccionada y conserva la validacion existente', async () => {
    apiState.listarRango.mockResolvedValueOnce([])
    apiState.listarClientes.mockResolvedValue({
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
    apiState.crear.mockResolvedValueOnce({
      id: 77,
      clienteId: 1,
      usuarioCreadorId: 7,
      sucursalId: 3,
      fecha: dateKeyFromToday(1),
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 30,
      montoTotal: 300000,
      observaciones: null,
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })

    await renderPage()
    const user = userEvent.setup()
    const selectedKey = dateKeyFromToday(1)
    await user.click(await screen.findByRole('button', { name: dayButtonName(selectedKey) }))
    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await user.click(within(dayDialog).getByRole('button', { name: 'Añadir evento' }))

    const createDialog = await screen.findByRole('dialog', { name: 'Nuevo Evento' })
    expect(within(createDialog).getByLabelText(/Fecha/)).toHaveValue(selectedKey)
    expect(within(createDialog).getByLabelText(/Hora inicio/)).toHaveValue('')
    expect(within(createDialog).getByLabelText(/Hora fin/)).toHaveValue('')
    expect(within(createDialog).getByLabelText(/Cliente/)).toHaveValue('')

    await user.type(within(createDialog).getByPlaceholderText('Buscar cliente por nombre o documento'), 'Cli')
    await pause(350)
    await user.click(within(createDialog).getByRole('button', { name: /Cliente Prueba/ }))
    await user.type(within(createDialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(createDialog).getByLabelText(/Hora fin/), '22:00')
    await user.type(within(createDialog).getByLabelText(/Tipo de evento/), 'Cumpleaños')
    await user.type(within(createDialog).getByLabelText(/Cantidad de invitados/), '30')
    await user.type(within(createDialog).getByLabelText(/Monto total/), '300000')

    await pause(350)
    await waitFor(() => expect(within(createDialog).getByText('Horario disponible')).toBeInTheDocument())
    await user.click(within(createDialog).getByRole('button', { name: 'Guardar Evento' }))

    await waitFor(() => expect(apiState.crear).toHaveBeenCalledWith(expect.objectContaining({
      fecha: selectedKey,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
    })))
    expect(apiState.crear.mock.calls[0][0]).not.toHaveProperty('usuarioCreadorId')
    expect(apiState.crear.mock.calls[0][0]).not.toHaveProperty('sucursalId')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nuevo Evento' })).not.toBeInTheDocument())
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(4))
  }, 10000)

  it('keeps the fecha validation intact for past dates in Nuevo Evento', async () => {
    const { dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: dateKeyFromToday(-1) } })

    expect(within(dialog).getByText('No se puede reservar un evento en una fecha anterior a hoy')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Guardar Evento' })).toBeDisabled()
  })

  it('keeps event clicks opening the detail dialog', async () => {
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
    await screen.findByRole('button', { name: /Eventos del día .*15 de agosto de 2026/ })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '18:00 Cumpleaños' }))

    expect(await screen.findByRole('dialog', { name: 'Detalle del evento' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Eventos del día' })).not.toBeInTheDocument()
  })

  it('keeps the month selector working while highlighting days with active events', async () => {
    apiState.listarRango.mockResolvedValue([])

    const user = userEvent.setup()
    await renderPage()

    await user.click(await screen.findByRole('button', { name: /Agosto de 2026/ }))
    await user.click(await screen.findByRole('option', { name: /Septiembre de 2026/ }))

    expect(await screen.findByRole('button', { name: /Septiembre de 2026/ })).toBeInTheDocument()
  })

  it('sets today as the minimum date in create mode', async () => {
    const { dialog } = await abrirAlta()

    expect(within(dialog).getByLabelText(/Fecha/)).toHaveAttribute('min', dateKeyFromToday())
  })

  it('sets today as the minimum date in edit mode', async () => {
    apiState.obtenerCliente.mockResolvedValueOnce({
      id: 1,
      nombre: 'Cliente Prueba',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '',
      domicilio: '',
      mail: '',
      activo: true,
    })
    apiState.listarRango.mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: dateKeyFromToday(-1),
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
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })
    await user.click(within(dialog).getByRole('button', { name: 'Editar' }))

    const editDialog = await screen.findByRole('dialog', { name: 'Editar Evento' })
    expect(within(editDialog).getByLabelText(/Fecha/)).toHaveAttribute('min', dateKeyFromToday())
  })

  it('blocks yesterday on create and does not POST', async () => {
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
    await user.type(within(dialog).getByPlaceholderText('Buscar cliente por nombre o documento'), 'Cli')
    await pause(350)
    await user.click(within(dialog).getByRole('button', { name: /Cliente Prueba/ }))
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: dateKeyFromToday(-1) } })

    expect(within(dialog).getByText('No se puede reservar un evento en una fecha anterior a hoy')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Guardar Evento' })).toBeDisabled()
    expect(apiState.crear).not.toHaveBeenCalled()
  })

  it('blocks yesterday on edit and does not PUT', async () => {
    apiState.obtenerCliente.mockResolvedValueOnce({
      id: 1,
      nombre: 'Cliente Prueba',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '',
      domicilio: '',
      mail: '',
      activo: true,
    })
    apiState.listarRango.mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: dateKeyFromToday(-2),
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
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })
    await user.click(within(dialog).getByRole('button', { name: 'Editar' }))

    const editDialog = await screen.findByRole('dialog', { name: 'Editar Evento' })
    fireEvent.change(within(editDialog).getByLabelText(/Fecha/), { target: { value: dateKeyFromToday(-1) } })
    await pause(350)

    expect(within(editDialog).getByText('No se puede reservar un evento en una fecha anterior a hoy')).toBeInTheDocument()
    expect(within(editDialog).getByRole('button', { name: 'Guardar Cambios' })).toBeDisabled()
    expect(apiState.editar).not.toHaveBeenCalled()
  })

  it('rechecks availability when schedule values change and keeps edit exclusion', async () => {
    apiState.listarClientes.mockResolvedValue({
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
    apiState.consultarDisponibilidad.mockResolvedValue(true)

    await renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })
    await user.click(within(dialog).getByRole('button', { name: 'Editar' }))

    const editDialog = await screen.findByRole('dialog', { name: 'Editar Evento' })
    await waitFor(() => expect(apiState.consultarDisponibilidad).toHaveBeenCalledWith(expect.objectContaining({
      fecha: '2026-08-15',
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      eventoIdExcluir: 1,
    })))

    apiState.consultarDisponibilidad.mockClear()
    fireEvent.change(within(editDialog).getByLabelText(/Hora fin/), { target: { value: '23:00' } })
    await pause(350)
    expect(apiState.consultarDisponibilidad).toHaveBeenCalledWith(expect.objectContaining({ eventoIdExcluir: 1, horaFin: '23:00:00' }))
  })

  it('does not replicate the 30 minute rule in the frontend', async () => {
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '18:20')

    await pause(350)

    expect(apiState.consultarDisponibilidad).toHaveBeenCalledWith(expect.objectContaining({
      fecha: '2026-08-15',
      horaInicio: '18:00:00',
      horaFin: '18:20:00',
    }))
  })

  it('allows today on create', async () => {
    apiState.listarClientes.mockResolvedValue({
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

    const fecha = dateKeyFromToday()
    const created = {
      id: 99,
      clienteId: 1,
      usuarioCreadorId: 7,
      sucursalId: 3,
      fecha,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    }

    apiState.crear.mockResolvedValueOnce(created)
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const { user, dialog } = await abrirAlta()
    await user.type(within(dialog).getByPlaceholderText('Buscar cliente por nombre o documento'), 'Cli')
    await pause(350)
    await user.click(within(dialog).getByRole('button', { name: /Cliente Prueba/ }))
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: fecha } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')
    await user.type(within(dialog).getByLabelText(/Tipo de evento/), 'Cumpleaños')
    await user.type(within(dialog).getByLabelText(/Cantidad de invitados/), '50')
    await user.type(within(dialog).getByLabelText(/Monto total/), '500000')

    await pause(350)
    await waitFor(() => expect(within(dialog).getByText('Horario disponible')).toBeInTheDocument())

    await user.click(within(dialog).getByRole('button', { name: 'Guardar Evento' }))
    await waitFor(() => expect(apiState.crear).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog', { name: 'Nuevo Evento' })).not.toBeInTheDocument()
  }, 10000)

  it('allows tomorrow on create', async () => {
    apiState.listarClientes.mockResolvedValue({
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

    const fecha = dateKeyFromToday(1)
    const created = {
      id: 99,
      clienteId: 1,
      usuarioCreadorId: 7,
      sucursalId: 3,
      fecha,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    }

    apiState.crear.mockResolvedValueOnce(created)
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const { user, dialog } = await abrirAlta()
    await user.type(within(dialog).getByPlaceholderText('Buscar cliente por nombre o documento'), 'Cli')
    await pause(350)
    await user.click(within(dialog).getByRole('button', { name: /Cliente Prueba/ }))
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: fecha } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')
    await user.type(within(dialog).getByLabelText(/Tipo de evento/), 'Cumpleaños')
    await user.type(within(dialog).getByLabelText(/Cantidad de invitados/), '50')
    await user.type(within(dialog).getByLabelText(/Monto total/), '500000')

    await pause(350)
    await waitFor(() => expect(within(dialog).getByText('Horario disponible')).toBeInTheDocument())

    await user.click(within(dialog).getByRole('button', { name: 'Guardar Evento' }))
    await waitFor(() => expect(apiState.crear).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog', { name: 'Nuevo Evento' })).not.toBeInTheDocument()
  }, 10000)

  it('validates that end time is after start time', async () => {
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '17:00')

    await pause(350)

    expect(within(dialog).getByText('La hora fin debe ser posterior a la hora inicio')).toBeInTheDocument()
    expect(apiState.consultarDisponibilidad).not.toHaveBeenCalled()
  })

  it('calls disponibilidad and shows Horario disponible', async () => {
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
    const availability = within(dialog).getByText('Horario disponible')
    expect(availability).toBeInTheDocument()
    expect(availability.previousElementSibling?.textContent).toContain('Hora fin')
  })

  it('shows Horario no disponible and blocks save', async () => {
    apiState.consultarDisponibilidad.mockResolvedValueOnce({ disponible: false, proximaHoraDisponible: '22:30' })
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')

    await pause(350)

    expect(within(dialog).getByText(/Horario no disponible/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Próximo horario disponible: 22:30/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Guardar Evento' })).toBeDisabled()
  })

  it('does not invent a next slot when backend returns null', async () => {
    apiState.consultarDisponibilidad.mockResolvedValueOnce({ disponible: false, proximaHoraDisponible: null })
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')

    await pause(350)

    expect(within(dialog).getByText(/Horario no disponible/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/Próximo horario disponible/)).not.toBeInTheDocument()
  })

  it('shows availability below the schedule block', async () => {
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')

    await pause(350)

    const availability = within(dialog).getByText('Horario disponible')
    const scheduleBlock = within(dialog).getByLabelText(/Hora inicio/).closest('div')?.parentElement
    expect(scheduleBlock).not.toBeNull()
    expect(scheduleBlock!.compareDocumentPosition(availability) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('rechecks availability when the schedule changes', async () => {
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')

    await pause(350)
    await waitFor(() => expect(apiState.consultarDisponibilidad).toHaveBeenCalledTimes(1))

    await user.clear(within(dialog).getByLabelText(/Hora fin/))
    await user.type(within(dialog).getByLabelText(/Hora fin/), '23:00')

    await pause(350)
    await waitFor(() => expect(apiState.consultarDisponibilidad).toHaveBeenCalledTimes(2))
  })

  it('does not query availability without fecha, horaInicio or horaFin', async () => {
    const { user, dialog } = await abrirAlta()

    expect(apiState.consultarDisponibilidad).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await pause(350)
    expect(apiState.consultarDisponibilidad).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await pause(350)
    expect(apiState.consultarDisponibilidad).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText(/Hora fin/), '17:00')
    await pause(350)
    expect(apiState.consultarDisponibilidad).not.toHaveBeenCalled()
  })

  it('does not calculate the next slot on the frontend', async () => {
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-08-15' } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')

    await pause(350)

    expect(apiState.consultarDisponibilidad).toHaveBeenCalledWith(expect.objectContaining({
      fecha: '2026-08-15',
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
    }))
    expect(within(dialog).queryByText(/Próximo horario disponible:/)).not.toBeInTheDocument()
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([created])
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
    await waitFor(() => expect(within(dialog).getByText('Horario disponible')).toBeInTheDocument())

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
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(4))
    expect(await screen.findByText('18:00 Cumpleaños')).toBeInTheDocument()
  }, 10000)

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
    await waitFor(() => expect(within(dialog).getByText('Horario disponible')).toBeInTheDocument())

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
    await waitFor(() => expect(within(dialog).getByText('Horario disponible')).toBeInTheDocument())

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
    authState.rol = 'UsuarioComun'
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
    await waitFor(() => expect(apiState.obtenerCliente).toHaveBeenCalledWith(1))
    expect(within(dialog).getByText('Reservado por')).toBeInTheDocument()
    expect(within(dialog).getByText('Juan Pérez')).toBeInTheDocument()
    expect(within(dialog).getByText('Reservado')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Contrato' })).toBeInTheDocument()
    expect(await within(dialog).findByText('Contacto')).toBeInTheDocument()
    expect(await within(dialog).findByText('+54 11-1234-5678')).toBeInTheDocument()
    expect(await within(dialog).findByRole('link', { name: 'Llamar' })).toHaveAttribute('href', 'tel:+541112345678')
    const whatsappLink = await within(dialog).findByRole('link', { name: 'WhatsApp' })
    expect(whatsappLink).toHaveAttribute('href', 'https://wa.me/541112345678')
    expect(whatsappLink).toHaveAttribute('target', '_blank')
    expect(whatsappLink.getAttribute('rel')).toContain('noopener')
    expect(whatsappLink.getAttribute('rel')).toContain('noreferrer')
    expect(whatsappLink.getAttribute('href')).not.toContain('text=')
    expect(within(dialog).queryByText(/Sucursal/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar evento' })).not.toBeInTheDocument()
  })

  it('hides contact actions when the client has no phone', async () => {
    apiState.obtenerCliente.mockResolvedValueOnce({
      id: 1,
      nombre: 'Cliente Prueba',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '   ',
      domicilio: '',
      mail: '',
      activo: true,
    })
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
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })

    expect(await within(dialog).findByText('Cliente sin teléfono registrado.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'Llamar' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument()
  })

  it('builds WhatsApp and tel links correctly', async () => {
    expect(buildWhatsAppHref('5491112345678')).toBe('https://wa.me/5491112345678')
    expect(buildTelHref('5491112345678')).toBe('tel:+5491112345678')
  })

  it('shows contact fallback when client loading fails', async () => {
    apiState.obtenerCliente.mockRejectedValueOnce(new Error('Cliente no encontrado'))
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
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })

    expect(await within(dialog).findByText('Las acciones de contacto no están disponibles.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'Llamar' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Contrato' })).toBeInTheDocument()
  })

  it('opens contract options and requests the PDF', async () => {
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

    const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:contrato')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)

    await renderPage()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })
    await user.click(within(dialog).getByRole('button', { name: 'Contrato' }))

    const contratoDialog = await screen.findByRole('dialog', { name: 'Contrato' })
    expect(within(contratoDialog).getByRole('button', { name: 'Ver contrato' })).toBeInTheDocument()
    expect(within(contratoDialog).queryByRole('button', { name: 'Imprimir contrato' })).not.toBeInTheDocument()

    await user.click(within(contratoDialog).getByRole('button', { name: 'Ver contrato' }))

    await waitFor(() => expect(apiState.obtenerContratoPdf).toHaveBeenCalledWith(1))
    expect(openSpy).toHaveBeenCalledWith('blob:contrato', '_blank', 'noopener,noreferrer')

    objectUrlSpy.mockRestore()
    revokeSpy.mockRestore()
    openSpy.mockRestore()
  })

  it('shows the 10 nearest upcoming events and skips cancelados', async () => {
    const base = new Date()
    base.setHours(12, 0, 0, 0)

    const makeDate = (daysAhead: number) => {
      const date = new Date(base)
      date.setDate(date.getDate() + daysAhead)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    apiState.listarRango
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 1,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(1),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 1',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 2,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(2),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 2',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 3,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(3),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 3',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 4,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(4),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 4',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 5,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(5),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 5',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 6,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(6),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 6',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 7,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(7),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 7',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 8,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(8),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 8',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 9,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(9),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 9',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 10,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(10),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 10',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 11,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(11),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento 11',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Reservado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
        {
          id: 12,
          clienteId: 1,
          usuarioCreadorId: 1,
          sucursalId: 1,
          fecha: makeDate(12),
          horaInicio: '11:00:00',
          horaFin: '13:00:00',
          tipoEvento: 'Evento Cancelado',
          cantidadInvitados: 20,
          montoTotal: 1000,
          observaciones: null,
          estado: 'Cancelado',
          fechaCreacion: '2026-08-01T10:00:00',
        },
      ])

    await renderPage()

    const upcomingButtons = await screen.findAllByRole('button', { name: /^11:00 Evento / })
    expect(upcomingButtons).toHaveLength(10)
    expect(screen.getByRole('button', { name: '11:00 Evento 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '11:00 Evento 10' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '11:00 Evento 11' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '11:00 Evento Cancelado' })).not.toBeInTheDocument()
  })
})
