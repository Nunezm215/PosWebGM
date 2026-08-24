import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildTelHref, buildWhatsAppHref } from '../../utils/phone'

const apiState = vi.hoisted(() => ({
  listarRango: vi.fn(),
  buscar: vi.fn(),
  obtenerPorId: vi.fn(),
  consultarDisponibilidad: vi.fn(),
  crear: vi.fn(),
  editar: vi.fn(),
  crearCliente: vi.fn(),
  obtenerCliente: vi.fn(),
  obtenerContratoPdf: vi.fn(),
  listarCargos: vi.fn(),
  agregarCargo: vi.fn(),
  anularCargo: vi.fn(),
  listarPagos: vi.fn(),
  resumenFinanciero: vi.fn(),
  listarClientes: vi.fn(),
  proximosCumpleanios: vi.fn(),
}))

const authState = vi.hoisted(() => ({
  rol: 'Admin' as string,
}))

vi.mock('../../api/client', () => ({
  api: {
    eventos: {
      listarPorRango: apiState.listarRango,
      buscar: apiState.buscar,
      obtenerPorId: apiState.obtenerPorId,
      consultarDisponibilidad: apiState.consultarDisponibilidad,
      crear: apiState.crear,
      editar: apiState.editar,
      listarCargos: apiState.listarCargos,
      agregarCargo: apiState.agregarCargo,
      anularCargo: apiState.anularCargo,
      listarPagos: apiState.listarPagos,
      resumenFinanciero: apiState.resumenFinanciero,
      obtenerContratoPdf: apiState.obtenerContratoPdf,
    },
    clientes: {
      listar: apiState.listarClientes,
      crear: apiState.crearCliente,
      obtener: apiState.obtenerCliente,
      proximosCumpleanios: apiState.proximosCumpleanios,
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
    apiState.buscar.mockReset()
    apiState.obtenerPorId.mockReset()
    apiState.consultarDisponibilidad.mockReset()
    apiState.crear.mockReset()
    apiState.editar.mockReset()
    apiState.crearCliente.mockReset()
    apiState.obtenerCliente.mockReset()
    apiState.obtenerContratoPdf.mockReset()
    apiState.listarCargos.mockReset()
    apiState.agregarCargo.mockReset()
    apiState.anularCargo.mockReset()
    apiState.listarPagos.mockReset()
    apiState.resumenFinanciero.mockReset()
    apiState.listarClientes.mockReset()
    apiState.proximosCumpleanios.mockReset()
    apiState.listarRango.mockResolvedValue([])
    apiState.buscar.mockResolvedValue([])
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
    apiState.listarCargos.mockResolvedValue([])
    apiState.agregarCargo.mockResolvedValue({})
    apiState.anularCargo.mockResolvedValue(undefined)
    apiState.listarPagos.mockResolvedValue([])
    apiState.resumenFinanciero.mockResolvedValue({ montoBase: 0, totalExtras: 0, montoTotal: 0, totalPagado: 0, saldoPendiente: 0, estadoPago: 'SinPagos', cantidadPagosActivos: 0 })
    apiState.listarClientes.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })
    apiState.proximosCumpleanios.mockResolvedValue([])
  })

  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const monthLabels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const formatMonthTitle = (date = new Date()) => {
    const raw = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

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
    await screen.findByRole('button', { name: formatMonthTitle() })
    await screen.findByText('Eventos')
    await user.click(screen.getAllByRole('button', { name: 'Nuevo Evento' })[0])
    return { user, dialog: await screen.findByRole('dialog', { name: 'Nuevo Evento' }) }
  }

  it('renders title and Nuevo Evento button', async () => {
    await renderPage()

    expect(await screen.findByText('Eventos')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Nuevo Evento' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('searchbox', { name: 'Buscar evento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hoy' })).not.toBeInTheDocument()
    expect(screen.queryByText(/2026-\d{2}-\d{2} - 2026-\d{2}-\d{2}/)).not.toBeInTheDocument()
    expect(screen.queryByText('Oportunidades de cumpleaños')).not.toBeInTheDocument()
    expect(apiState.proximosCumpleanios).not.toHaveBeenCalled()
  })

  it('initializes the selector with the current local month and year', async () => {
    const realNow = new Date()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 15, 12))

    try {
      await renderPage()
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getByRole('button', { name: 'Septiembre de 2026' })).toBeInTheDocument()
    } finally {
      vi.setSystemTime(realNow)
      vi.useRealTimers()
    }
  })

  it('shows selector with the current month and opens the month/year popup', async () => {
    await renderPage()

    const currentMonthTitle = formatMonthTitle()
    const monthButton = await screen.findByRole('button', { name: currentMonthTitle })
    expect(monthButton).toHaveAttribute('aria-haspopup', 'dialog')
    expect(monthButton).toHaveAttribute('aria-expanded', 'false')

    await userEvent.setup().click(monthButton)

    const picker = await screen.findByRole('dialog', { name: 'Selector de mes y año' })
    expect(within(picker).getByText(String(new Date().getFullYear()))).toBeInTheDocument()
    expect(within(picker).getByRole('button', { name: new Date().toLocaleDateString('es-AR', { month: 'long' }).replace(/^./, value => value.toUpperCase()) })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows all 12 months without the old scroll list', async () => {
    await renderPage()
    await userEvent.setup().click(await screen.findByRole('button', { name: formatMonthTitle() }))

    const picker = await screen.findByRole('dialog', { name: 'Selector de mes y año' })
    expect(within(picker).queryByRole('listbox')).not.toBeInTheDocument()
    expect(monthLabels.map(label => within(picker).getByRole('button', { name: label }))).toHaveLength(12)
  })

  it('changes the picker year freely and selects a month', async () => {
    await renderPage()
    const user = userEvent.setup()
    const currentYear = new Date().getFullYear()

    await user.click(await screen.findByRole('button', { name: formatMonthTitle() }))
    const picker = await screen.findByRole('dialog', { name: 'Selector de mes y año' })
    await user.click(within(picker).getByRole('button', { name: 'Año siguiente' }))
    expect(within(picker).getByText(String(currentYear + 1))).toBeInTheDocument()
    await user.click(within(picker).getByRole('button', { name: 'Año anterior' }))
    expect(within(picker).getByText(String(currentYear))).toBeInTheDocument()

    await user.click(within(picker).getByRole('button', { name: 'Junio' }))
    expect(await screen.findByRole('button', { name: formatMonthTitle(new Date(currentYear, 5, 1)) })).toBeInTheDocument()
  })

  it('reconsults the visible range when the month changes', async () => {
    await renderPage()
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalled())
    const initialCalls = apiState.listarRango.mock.calls.length

    const user = userEvent.setup()
    const currentDate = new Date()
    const targetMonth = currentDate.getMonth() === 0 ? 1 : 0
    await user.click(await screen.findByRole('button', { name: formatMonthTitle(currentDate) }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Selector de mes y año' })).getByRole('button', { name: monthLabels[targetMonth] }))

    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(initialCalls + 1))
  })

  it('navigates to distant future and past years without an artificial limit', async () => {
    await renderPage()
    const user = userEvent.setup()
    const currentYear = new Date().getFullYear()

    await user.click(await screen.findByRole('button', { name: formatMonthTitle() }))
    const picker = await screen.findByRole('dialog', { name: 'Selector de mes y año' })
    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(within(picker).getByRole('button', { name: 'Año siguiente' }))
    }
    expect(within(picker).getByText(String(currentYear + 4))).toBeInTheDocument()
    await user.click(within(picker).getByRole('button', { name: 'Junio' }))
    expect(await screen.findByRole('button', { name: formatMonthTitle(new Date(currentYear + 4, 5, 1)) })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: formatMonthTitle(new Date(currentYear + 4, 5, 1)) }))
    const reopenedPicker = await screen.findByRole('dialog', { name: 'Selector de mes y año' })
    for (let index = 0; index < 7; index += 1) {
      fireEvent.click(within(reopenedPicker).getByRole('button', { name: 'Año anterior' }))
    }
    expect(within(reopenedPicker).getByText(String(currentYear - 3))).toBeInTheDocument()
  })

  it('returns to the dynamic current month only when requested', async () => {
    await renderPage()
    const user = userEvent.setup()
    const currentDate = new Date()
    const currentTitle = formatMonthTitle(currentDate)
    const nextYearJuneTitle = formatMonthTitle(new Date(currentDate.getFullYear() + 1, 5, 1))

    await user.click(await screen.findByRole('button', { name: currentTitle }))
    const picker = await screen.findByRole('dialog', { name: 'Selector de mes y año' })
    await user.click(within(picker).getByRole('button', { name: 'Año siguiente' }))
    await user.click(within(picker).getByRole('button', { name: 'Junio' }))
    expect(await screen.findByRole('button', { name: nextYearJuneTitle })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: nextYearJuneTitle }))
    expect(await screen.findByRole('dialog', { name: 'Selector de mes y año' })).toHaveTextContent(String(currentDate.getFullYear() + 1))
    await user.click(screen.getByRole('button', { name: 'Ir al mes actual' }))
    expect(await screen.findByRole('button', { name: currentTitle })).toBeInTheDocument()
  })

  it('keeps the day popup and availability flows intact', async () => {
    const eventDate = dateKeyFromToday(1)
    apiState.listarRango.mockResolvedValue([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: eventDate,
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
    apiState.obtenerPorId.mockResolvedValueOnce({
      id: 1,
      clienteId: 1,
      usuarioCreadorId: 1,
      sucursalId: 1,
      fecha: eventDate,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })

    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: dayButtonName(eventDate) }))
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
    const eventDate = dateKeyFromToday(1)
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

    const { dialog } = await abrirAlta()
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: eventDate } })
    fireEvent.change(within(dialog).getByLabelText(/Hora inicio/), { target: { value: '18:00' } })
    fireEvent.change(within(dialog).getByLabelText(/Hora fin/), { target: { value: '22:00' } })
    fireEvent.change(within(dialog).getByLabelText(/Tipo de evento/), { target: { value: 'Cumpleaños' } })
    fireEvent.change(within(dialog).getByLabelText(/Cantidad de invitados/), { target: { value: '50' } })
    fireEvent.change(within(dialog).getByLabelText(/Monto total/), { target: { value: '500000' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear cliente nuevo' }))
    const clientDialog = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })
    fireEvent.click(within(clientDialog).getByRole('button', { name: 'Agregar familiar' }))
    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Cliente Nuevo' } })
    fireEvent.change(within(clientDialog).getByLabelText('Fecha de nacimiento *'), { target: { value: '1990-01-01' } })
    fireEvent.change(within(clientDialog).getByLabelText('Celular / Teléfono *'), { target: { value: '12345678' } })
    fireEvent.change(within(clientDialog).getByLabelText('Email *'), { target: { value: 'cliente@correo.com' } })
    fireEvent.change(clientDialog.querySelector('#evento-cliente-familiar-0-nombre') as HTMLInputElement, { target: { value: 'Familiar Uno' } })
    fireEvent.change(within(clientDialog).getAllByLabelText('Fecha nacimiento')[0], { target: { value: '2015-02-03' } })
    fireEvent.click(within(clientDialog).getByRole('button', { name: 'Guardar Cliente' }))

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
  }, 10000)

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
  }, 10000)

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
    const eventDate = '2026-08-15'
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
    apiState.listarRango.mockResolvedValue([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        usuarioCreadorNombre: 'Pedro',
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
    apiState.obtenerPorId.mockResolvedValueOnce({
      id: 1,
      clienteId: 1,
      usuarioCreadorId: 1,
      sucursalId: 1,
      fecha: eventDate,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })

    await renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: dayButtonName('2026-08-15') }))
    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await user.click(within(dayDialog).getByRole('button', { name: '18:00 Cumpleaños' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })
    await user.click(within(dialog).getByRole('button', { name: 'Editar' }))

    const editDialog = await screen.findByRole('dialog', { name: 'Editar Evento' })
    expect(within(editDialog).queryByRole('button', { name: 'Crear cliente nuevo' })).not.toBeInTheDocument()
  })

  it('opens the daily dialog when clicking a day', async () => {
    const eventDate = '2026-08-15'
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
    apiState.listarRango.mockResolvedValue([
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
    apiState.obtenerPorId.mockResolvedValueOnce({
      id: 1,
      clienteId: 1,
      usuarioCreadorId: 1,
      sucursalId: 1,
      fecha: eventDate,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })

    await renderPage()
    await screen.findByRole('button', { name: /Eventos del día .*15 de agosto de 2026/ })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Eventos del día .*15 de agosto de 2026/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await waitFor(() => expect(apiState.listarClientes).toHaveBeenCalledTimes(1))
    expect(within(dialog).getByText(/eventos?/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '10:00 Brunch' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '18:00 Cumpleaños' })).toBeInTheDocument()
    expect(within(dialog).getAllByText('18:00 - 22:00')[0]).toBeInTheDocument()
    expect(within(dialog).getAllByText('10:00 - 12:00')[0]).toBeInTheDocument()
    expect(within(dialog).getByText('Reservado por: Juan Pérez')).toBeInTheDocument()
    expect(within(dialog).getByText('Reservado por: María Gómez')).toBeInTheDocument()
  })

  it('marks days with active reservations and ignores cancelados alone', async () => {
    const eventDate = '2026-08-15'
    const keyWithActive = '2026-08-15'
    const keyOnlyCancelled = '2026-08-16'
    const keyMixed = '2026-08-17'

    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([
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
    apiState.obtenerPorId.mockResolvedValueOnce({
      id: 1,
      clienteId: 1,
      usuarioCreadorId: 1,
      sucursalId: 1,
      fecha: eventDate,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })

    await renderPage()
    await screen.findByRole('button', { name: formatMonthTitle() })

    expect(screen.getByRole('button', { name: /Eventos del día .*15 de agosto de 2026/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Eventos del día .*16 de agosto de 2026/ })).toHaveAttribute('data-has-events', 'false')
    expect(screen.getByRole('button', { name: /Eventos del día .*17 de agosto de 2026/ })).toBeInTheDocument()
  })

  it('highlights the local current day without replacing reservation styling or day interaction', async () => {
    const todayKey = dateKeyFromToday()
    const otherReservedKey = dateKeyFromToday(1)
    const pastReservedKey = dateKeyFromToday(-1)
    const pastCancelledKey = dateKeyFromToday(-2)
    const pastMixedKey = dateKeyFromToday(-3)
    apiState.listarRango.mockResolvedValue([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: todayKey,
        horaInicio: '18:00:00',
        horaFin: '22:00:00',
        tipoEvento: 'Reserva hoy',
        cantidadInvitados: 50,
        montoTotal: 500000,
        observaciones: '',
        estado: 'Reservado',
        fechaCreacion: `${todayKey}T12:00:00`,
      },
      {
        id: 2,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: otherReservedKey,
        horaInicio: '10:00:00',
        horaFin: '12:00:00',
        tipoEvento: 'Otra reserva',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: '',
        estado: 'Señado',
        fechaCreacion: `${todayKey}T12:00:00`,
      },
      {
        id: 3,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: pastReservedKey,
        horaInicio: '10:00:00',
        horaFin: '12:00:00',
        tipoEvento: 'Reserva pasada',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: '',
        estado: 'Pagado',
        fechaCreacion: `${pastReservedKey}T12:00:00`,
      },
      {
        id: 4,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: pastCancelledKey,
        horaInicio: '10:00:00',
        horaFin: '12:00:00',
        tipoEvento: 'Cancelado pasado',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: '',
        estado: 'Cancelado',
        fechaCreacion: `${pastCancelledKey}T12:00:00`,
      },
      {
        id: 5,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: pastMixedKey,
        horaInicio: '10:00:00',
        horaFin: '12:00:00',
        tipoEvento: 'Reserva activa pasada',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: '',
        estado: 'Señado',
        fechaCreacion: `${pastMixedKey}T12:00:00`,
      },
      {
        id: 6,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: pastMixedKey,
        horaInicio: '14:00:00',
        horaFin: '16:00:00',
        tipoEvento: 'Cancelado mixto pasado',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: '',
        estado: 'Cancelado',
        fechaCreacion: `${pastMixedKey}T12:00:00`,
      },
    ])

    await renderPage()

    const today = await screen.findByRole('button', { name: dayButtonName(todayKey) })
    const otherReserved = screen.getByRole('button', { name: dayButtonName(otherReservedKey) })
    const pastReserved = screen.getByRole('button', { name: dayButtonName(pastReservedKey) })
    const pastCancelled = screen.getByRole('button', { name: dayButtonName(pastCancelledKey) })
    const pastMixed = screen.getByRole('button', { name: dayButtonName(pastMixedKey) })
    const normalDay = document.querySelector<HTMLElement>('[data-is-current-month="true"][data-is-past="false"][data-is-today="false"][data-has-events="false"]')
    const outsideMonthDay = document.querySelector<HTMLElement>('[data-is-current-month="false"][data-has-events="false"]')

    expect(document.querySelectorAll('[data-is-today="true"]')).toHaveLength(1)
    expect(today).toHaveAttribute('data-is-today', 'true')
    expect(today).toHaveAttribute('data-has-events', 'true')
    expect(within(today).getByText('HOY')).toBeInTheDocument()
    expect(otherReserved).toHaveAttribute('data-has-events', 'true')
    expect(otherReserved).not.toHaveAttribute('data-is-today', 'true')
    expect(otherReserved).not.toHaveClass('opacity-50')
    expect(pastReserved).toHaveAttribute('data-has-events', 'true')
    expect(pastReserved).toHaveClass('opacity-50')
    expect(pastCancelled).toHaveAttribute('data-has-events', 'false')
    expect(pastCancelled).toHaveClass('opacity-50')
    expect(pastMixed).toHaveAttribute('data-has-events', 'true')
    expect(pastMixed).toHaveClass('opacity-50')
    expect(normalDay).not.toHaveClass('bg-indigo-600')
    expect(normalDay).toHaveAttribute('data-has-events', 'false')
    expect(normalDay).toHaveAttribute('data-is-today', 'false')
    expect(normalDay).not.toHaveClass('opacity-50')
    expect(within(normalDay!).queryByText('HOY')).not.toBeInTheDocument()
    expect(outsideMonthDay).toHaveClass('text-slate-400')

    await userEvent.setup().click(today)
    expect(await screen.findByRole('dialog', { name: 'Eventos del día' })).toBeInTheDocument()
  })

  it('keeps past days clickable while dimmed', async () => {
    const pastKey = dateKeyFromToday(-1)
    apiState.listarRango.mockResolvedValue([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: pastKey,
        horaInicio: '10:00:00',
        horaFin: '12:00:00',
        tipoEvento: 'Reserva pasada',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: '',
        estado: 'Pagado',
        fechaCreacion: `${pastKey}T12:00:00`,
      },
    ])

    await renderPage()
    const user = userEvent.setup()
    const pastDay = await screen.findByRole('button', { name: dayButtonName(pastKey) })

    expect(pastDay).toHaveClass('opacity-50')

    await user.click(pastDay)

    const dialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    expect(within(dialog).getByRole('button', { name: '10:00 Reserva pasada' })).toBeInTheDocument()
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
    await user.click(screen.getAllByRole('button', { name: 'Nuevo Evento' })[0])

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
    apiState.listarRango.mockResolvedValue([
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
    apiState.obtenerPorId.mockResolvedValueOnce({
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
    })

    await renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: dayButtonName('2026-08-15') }))
    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await user.click(within(dayDialog).getByRole('button', { name: '18:00 Cumpleaños' }))

    expect(await screen.findByRole('dialog', { name: 'Detalle del evento' })).toBeInTheDocument()
  })

  it('keeps the month selector working while highlighting days with active events', async () => {
    apiState.listarRango.mockResolvedValue([])

    const user = userEvent.setup()
    await renderPage()

    const currentDate = new Date()
    const targetMonth = currentDate.getMonth() === 0 ? 1 : 0
    await user.click(await screen.findByRole('button', { name: formatMonthTitle(currentDate) }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Selector de mes y año' })).getByRole('button', { name: monthLabels[targetMonth] }))

    expect(await screen.findByRole('button', { name: formatMonthTitle(new Date(currentDate.getFullYear(), targetMonth, 1)) })).toBeInTheDocument()
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
    apiState.listarRango.mockResolvedValue([
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
    apiState.obtenerPorId.mockResolvedValueOnce({
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
    })

    await renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: dayButtonName(dateKeyFromToday(-1)) }))
    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await user.click(within(dayDialog).getByRole('button', { name: '18:00 Cumpleaños' }))
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
    apiState.listarRango.mockResolvedValue([
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
    apiState.obtenerPorId.mockResolvedValueOnce({
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
    })

    await renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: dayButtonName(dateKeyFromToday(-2)) }))
    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await user.click(within(dayDialog).getByRole('button', { name: '18:00 Cumpleaños' }))
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
    apiState.listarRango.mockResolvedValue([
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
    apiState.obtenerPorId.mockResolvedValueOnce({
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
    })
    apiState.consultarDisponibilidad.mockResolvedValue(true)

    await renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: dayButtonName('2026-08-15') }))
    const dayDialog = await screen.findByRole('dialog', { name: 'Eventos del día' })
    await user.click(within(dayDialog).getByRole('button', { name: '18:00 Cumpleaños' }))
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
    const eventDate = dateKeyFromToday(1)
    const { user, dialog } = await abrirAlta()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: eventDate } })
    await user.type(within(dialog).getByLabelText(/Hora inicio/), '18:00')
    await user.type(within(dialog).getByLabelText(/Hora fin/), '22:00')

    await pause(350)

    await waitFor(() => expect(apiState.consultarDisponibilidad).toHaveBeenCalledWith({
      fecha: eventDate,
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
    const eventDate = dateKeyFromToday(1)
    const created = {
      id: 99,
      clienteId: 1,
      usuarioCreadorId: 7,
      sucursalId: 3,
      fecha: eventDate,
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
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: eventDate } })
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
      fecha: eventDate,
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
    expect(await screen.findByRole('button', { name: /18:00 Cumpleaños/ })).toBeInTheDocument()
  }, 10000)

  it('keeps the modal open when backend rejects the save', async () => {
    const eventDate = dateKeyFromToday(1)
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
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: eventDate } })
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
  }, 10000)

  it('disables the save button while the POST is pending', async () => {
    const eventDate = dateKeyFromToday(1)
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
    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: eventDate } })
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
      fecha: eventDate,
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
  }, 10000)

  it('shows the read-only detail and no edit/cancel actions', async () => {
    authState.rol = 'UsuarioComun'
    const eventDate = dateKeyFromToday(1)
    apiState.obtenerPorId.mockResolvedValueOnce({
      id: 1,
      clienteId: 1,
      usuarioCreadorId: 1,
      usuarioCreadorNombre: 'Pedro',
      sucursalId: 1,
      fecha: eventDate,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        usuarioCreadorNombre: 'Pedro',
        sucursalId: 1,
        fecha: eventDate,
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
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(2))

    const eventButton = await screen.findByRole('button', { name: '18:00 Cumpleaños' })
    const user = userEvent.setup()
    await user.click(eventButton)

    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })
    await waitFor(() => expect(apiState.obtenerCliente).toHaveBeenCalledWith(1))
    expect(within(dialog).getByText('Reservado por')).toBeInTheDocument()
    expect(within(dialog).getByText('Juan Pérez')).toBeInTheDocument()
    expect(within(dialog).getByText('Reservado')).toBeInTheDocument()
    expect(within(dialog).getByText('Pedro')).toBeInTheDocument()
    expect(within(dialog).queryByText('Usuario #1')).not.toBeInTheDocument()
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
    const eventDate = dateKeyFromToday(1)
    apiState.obtenerPorId.mockResolvedValueOnce({
      id: 1,
      clienteId: 1,
      usuarioCreadorId: 1,
      sucursalId: 1,
      fecha: eventDate,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })
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
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: eventDate,
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
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(2))
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
    const eventDate = dateKeyFromToday(1)
    apiState.obtenerPorId.mockResolvedValueOnce({
      id: 1,
      clienteId: 1,
      usuarioCreadorId: 1,
      sucursalId: 1,
      fecha: eventDate,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })
    apiState.obtenerCliente.mockRejectedValueOnce(new Error('Cliente no encontrado'))
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: eventDate,
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
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(2))
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '18:00 Cumpleaños' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del evento' })

    expect(await within(dialog).findByText('Las acciones de contacto no están disponibles.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'Llamar' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Contrato' })).toBeInTheDocument()
  })

  it('opens contract options and requests the PDF', async () => {
    const eventDate = dateKeyFromToday(1)
    apiState.obtenerPorId.mockResolvedValueOnce({
      id: 1,
      clienteId: 1,
      usuarioCreadorId: 1,
      sucursalId: 1,
      fecha: eventDate,
      horaInicio: '18:00:00',
      horaFin: '22:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 50,
      montoTotal: 500000,
      observaciones: 'Sin alcohol',
      estado: 'Reservado',
      fechaCreacion: '2026-08-10T12:00:00',
    })
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: eventDate,
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
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(2))

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

  it('keeps upcoming events local when the search box is empty and does not call buscar', async () => {
    apiState.listarClientes.mockResolvedValueOnce({
      items: [
        { id: 1, nombre: 'Juan Pérez' },
        { id: 2, nombre: 'María Gómez' },
      ],
      totalCount: 2,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    })
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-25',
        horaInicio: '09:00:00',
        horaFin: '10:00:00',
        tipoEvento: 'Cumpleaños',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Reservado',
        fechaCreacion: '2026-08-01T10:00:00',
      },
      {
        id: 2,
        clienteId: 2,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-26',
        horaInicio: '10:00:00',
        horaFin: '11:00:00',
        tipoEvento: 'Reunión',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Señado',
        fechaCreacion: '2026-08-01T10:00:00',
      },
      {
        id: 3,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-24',
        horaInicio: '11:00:00',
        horaFin: '12:00:00',
        tipoEvento: 'Evento Cancelado',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Cancelado',
        fechaCreacion: '2026-08-01T10:00:00',
      },
    ])

    await renderPage()
    const search = await screen.findByRole('searchbox', { name: 'Buscar evento' })

    expect(screen.getByRole('button', { name: '09:00 Cumpleaños' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10:00 Reunión' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '11:00 Evento Cancelado' })).not.toBeInTheDocument()
    expect(apiState.buscar).not.toHaveBeenCalled()

    await userEvent.setup().clear(search)
    expect(screen.getByRole('button', { name: '09:00 Cumpleaños' })).toBeInTheDocument()
    expect(apiState.buscar).not.toHaveBeenCalled()
  })

  it('uses the global endpoint after debounce and renders results from any month', async () => {
    apiState.buscar.mockResolvedValueOnce([
      {
        id: 77,
        clienteId: 1,
        reservadoPor: 'Juan Pérez',
        fecha: '2026-09-22',
        horaInicio: '21:00:00',
        horaFin: '22:00:00',
        tipoEvento: 'Cumpleaños',
        estado: 'Reservado',
        cantidadInvitados: 40,
      },
      {
        id: 78,
        clienteId: 2,
        reservadoPor: 'Juan Pérez',
        fecha: '2026-06-10',
        horaInicio: '18:00:00',
        horaFin: '20:00:00',
        tipoEvento: 'Reunión',
        estado: 'Cancelado',
        cantidadInvitados: 20,
      },
    ])

    const user = userEvent.setup()
    await renderPage()
    const search = await screen.findByRole('searchbox', { name: 'Buscar evento' })

    await user.type(search, 'juan')
    expect(apiState.buscar).not.toHaveBeenCalled()
    expect(await screen.findByText('Buscando eventos...')).toBeInTheDocument()

    await pause(350)
    await waitFor(() => expect(apiState.buscar).toHaveBeenCalledWith('juan', 10))

    const firstResult = await screen.findByRole('button', { name: '21:00 Cumpleaños' })
    expect(firstResult).toBeInTheDocument()
    expect(within(firstResult).getByText('Reservado por: Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('22/09/2026 · Reservado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '18:00 Reunión' })).toBeInTheDocument()
    expect(screen.getByText('10/06/2026 · Cancelado')).toBeInTheDocument()
    expect(screen.getByText('PASADO')).toBeInTheDocument()
  }, 30000)

  it('marks only past global results without changing their real state', async () => {
    const yesterday = dateKeyFromToday(-1)
    const today = dateKeyFromToday()
    const tomorrow = dateKeyFromToday(1)
    const pastReserved = { id: 81, clienteId: 1, reservadoPor: 'Juan Pérez', fecha: yesterday, horaInicio: '09:00:00', horaFin: '10:00:00', tipoEvento: 'Reservado pasado', estado: 'Reservado', cantidadInvitados: 20 }

    apiState.buscar.mockResolvedValueOnce([
      pastReserved,
      { id: 82, clienteId: 2, reservadoPor: 'María Gómez', fecha: yesterday, horaInicio: '10:00:00', horaFin: '11:00:00', tipoEvento: 'Señado pasado', estado: 'Señado', cantidadInvitados: 20 },
      { id: 83, clienteId: 3, reservadoPor: 'Pedro Díaz', fecha: yesterday, horaInicio: '11:00:00', horaFin: '12:00:00', tipoEvento: 'Pagado pasado', estado: 'Pagado', cantidadInvitados: 20 },
      { id: 84, clienteId: 4, reservadoPor: 'Ana López', fecha: yesterday, horaInicio: '12:00:00', horaFin: '13:00:00', tipoEvento: 'Cancelado pasado', estado: 'Cancelado', cantidadInvitados: 20 },
      { id: 85, clienteId: 5, reservadoPor: 'Hoy Cliente', fecha: today, horaInicio: '08:00:00', horaFin: '09:00:00', tipoEvento: 'Evento de hoy', estado: 'Reservado', cantidadInvitados: 20 },
      { id: 86, clienteId: 6, reservadoPor: 'Futuro Cliente', fecha: tomorrow, horaInicio: '08:00:00', horaFin: '09:00:00', tipoEvento: 'Evento futuro', estado: 'Reservado', cantidadInvitados: 20 },
    ])

    const user = userEvent.setup()
    await renderPage()
    const search = await screen.findByRole('searchbox', { name: 'Buscar evento' })
    await user.type(search, 'pasado')
    await pause(350)

    expect(await screen.findByText(`${yesterday.slice(8, 10)}/${yesterday.slice(5, 7)}/${yesterday.slice(0, 4)} · Reservado`)).toBeInTheDocument()
    expect(screen.getByText(`${yesterday.slice(8, 10)}/${yesterday.slice(5, 7)}/${yesterday.slice(0, 4)} · Señado`)).toBeInTheDocument()
    expect(screen.getByText(`${yesterday.slice(8, 10)}/${yesterday.slice(5, 7)}/${yesterday.slice(0, 4)} · Pagado`)).toBeInTheDocument()
    expect(screen.getByText(`${yesterday.slice(8, 10)}/${yesterday.slice(5, 7)}/${yesterday.slice(0, 4)} · Cancelado`)).toBeInTheDocument()
    expect(screen.getByText(`${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)} · Reservado`)).toBeInTheDocument()
    expect(screen.getByText(`${tomorrow.slice(8, 10)}/${tomorrow.slice(5, 7)}/${tomorrow.slice(0, 4)} · Reservado`)).toBeInTheDocument()
    expect(screen.getAllByText('PASADO')).toHaveLength(4)
    expect(pastReserved).toEqual(expect.objectContaining({ fecha: yesterday, estado: 'Reservado' }))
    expect(pastReserved).not.toHaveProperty('pasado')
  }, 30000)

  it('shows empty and error states for the global search and clears back to upcoming events', async () => {
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-25',
        horaInicio: '11:00:00',
        horaFin: '12:00:00',
        tipoEvento: 'Evento 1',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Reservado',
        fechaCreacion: '2026-08-01T10:00:00',
      },
    ])
    apiState.buscar.mockResolvedValueOnce([])

    const user = userEvent.setup()
    await renderPage()
    const search = await screen.findByRole('searchbox', { name: 'Buscar evento' })

    await user.type(search, 'nada')
    await pause(350)

    expect(await screen.findByText('No se encontraron eventos.')).toBeInTheDocument()

    apiState.buscar.mockRejectedValueOnce(new Error('Fallo backend'))
    await user.clear(search)
    await user.type(search, 'fallo')
    await pause(350)

    expect(await screen.findByText('No se pudo buscar eventos.')).toBeInTheDocument()

    await user.clear(search)
    await pause(350)
    expect(apiState.buscar).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('No se pudo buscar eventos.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '11:00 Evento 1' })).toBeInTheDocument()
  }, 30000)

  it('ignores obsolete global search responses', async () => {
    let resolveJuan!: (value: any) => void
    let resolveMaria!: (value: any) => void

    apiState.buscar
      .mockImplementationOnce(() => new Promise(resolve => { resolveJuan = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveMaria = resolve }))

    const user = userEvent.setup()
    await renderPage()
    const search = await screen.findByRole('searchbox', { name: 'Buscar evento' })

    await user.type(search, 'juan')
    await pause(350)
    await user.clear(search)
    await user.type(search, 'maria')
    await pause(350)

    resolveMaria([
      {
        id: 2,
        clienteId: 2,
        reservadoPor: 'María Gómez',
        fecha: '2026-09-22',
        horaInicio: '19:00:00',
        horaFin: '20:00:00',
        tipoEvento: 'Evento Maria',
        estado: 'Reservado',
        cantidadInvitados: 20,
      },
    ])
    resolveJuan([
      {
        id: 1,
        clienteId: 1,
        reservadoPor: 'Juan Pérez',
        fecha: '2026-09-21',
        horaInicio: '18:00:00',
        horaFin: '19:00:00',
        tipoEvento: 'Evento Juan',
        estado: 'Reservado',
        cantidadInvitados: 20,
      },
    ])

    await waitFor(() => expect(screen.getByText('Reservado por: María Gómez')).toBeInTheDocument())
    expect(screen.queryByText('Reservado por: Juan Pérez')).not.toBeInTheDocument()
  }, 30000)

  it('shows the reservador in each upcoming event card using the shared client cache', async () => {
    apiState.listarClientes.mockResolvedValueOnce({
      items: [
        { id: 1, nombre: 'Juan Pérez' },
        { id: 2, nombre: 'María Gómez' },
      ],
      totalCount: 2,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    })
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-25',
        horaInicio: '21:00:00',
        horaFin: '22:00:00',
        tipoEvento: 'Cumpleaños',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Reservado',
        fechaCreacion: '2026-08-01T10:00:00',
      },
      {
        id: 2,
        clienteId: 2,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-26',
        horaInicio: '22:00:00',
        horaFin: '23:00:00',
        tipoEvento: 'Reunión',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Señado',
        fechaCreacion: '2026-08-01T10:00:00',
      },
    ])

    await renderPage()
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(apiState.listarClientes).toHaveBeenCalledWith(undefined, 1, 1000, true))

    const juanCard = screen.getByRole('button', { name: '21:00 Cumpleaños' })
    const mariaCard = screen.getByRole('button', { name: '22:00 Reunión' })
    expect(juanCard.textContent).toContain('Reservado por: Juan Pérez')
    expect(mariaCard.textContent).toContain('Reservado por: María Gómez')
    expect(apiState.listarClientes).toHaveBeenCalledWith(undefined, 1, 1000, true)
    expect(apiState.listarClientes).toHaveBeenCalledTimes(1)
  }, 30000)

  it('falls back to Cliente #ID when the client is not in the cache', async () => {
    apiState.listarClientes.mockResolvedValueOnce({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 1000,
      totalPages: 0,
    })
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 23,
        usuarioCreadorId: 1,
        sucursalId: 1,
        fecha: '2026-08-25',
        horaInicio: '21:00:00',
        horaFin: '22:00:00',
        tipoEvento: 'Cumpleaños',
        cantidadInvitados: 20,
        montoTotal: 1000,
        observaciones: null,
        estado: 'Reservado',
        fechaCreacion: '2026-08-01T10:00:00',
      },
    ])

    await renderPage()
    await waitFor(() => expect(apiState.listarRango).toHaveBeenCalledTimes(2))

    const clientCard = screen.getByRole('button', { name: '21:00 Cumpleaños' })
    expect(clientCard.textContent).toContain('Reservado por: Cliente #23')
  }, 30000)

  it('uses the global endpoint with order, history and cancelados while respecting limit', async () => {
    apiState.buscar.mockResolvedValueOnce([
      { id: 1, clienteId: 1, reservadoPor: 'Cliente 1', fecha: '2026-08-20', horaInicio: '08:00:00', horaFin: '09:00:00', tipoEvento: 'Evento 1', estado: 'Reservado', cantidadInvitados: 20 },
      { id: 2, clienteId: 2, reservadoPor: 'Cliente 2', fecha: '2026-09-05', horaInicio: '09:00:00', horaFin: '10:00:00', tipoEvento: 'Evento 2', estado: 'Reservado', cantidadInvitados: 20 },
      { id: 3, clienteId: 3, reservadoPor: 'Cliente 3', fecha: '2027-01-10', horaInicio: '10:00:00', horaFin: '11:00:00', tipoEvento: 'Evento 3', estado: 'Reservado', cantidadInvitados: 20 },
      { id: 4, clienteId: 4, reservadoPor: 'Cliente 4', fecha: '2026-08-12', horaInicio: '11:00:00', horaFin: '12:00:00', tipoEvento: 'Evento 4', estado: 'Cancelado', cantidadInvitados: 20 },
      { id: 5, clienteId: 5, reservadoPor: 'Cliente 5', fecha: '2026-08-01', horaInicio: '12:00:00', horaFin: '13:00:00', tipoEvento: 'Evento 5', estado: 'Reservado', cantidadInvitados: 20 },
      { id: 6, clienteId: 6, reservadoPor: 'Cliente 6', fecha: '2026-07-20', horaInicio: '13:00:00', horaFin: '14:00:00', tipoEvento: 'Evento 6', estado: 'Reservado', cantidadInvitados: 20 },
      { id: 7, clienteId: 7, reservadoPor: 'Cliente 7', fecha: '2026-10-01', horaInicio: '14:00:00', horaFin: '15:00:00', tipoEvento: 'Evento 7', estado: 'Reservado', cantidadInvitados: 20 },
      { id: 8, clienteId: 8, reservadoPor: 'Cliente 8', fecha: '2026-06-18', horaInicio: '15:00:00', horaFin: '16:00:00', tipoEvento: 'Evento 8', estado: 'Reservado', cantidadInvitados: 20 },
      { id: 9, clienteId: 9, reservadoPor: 'Cliente 9', fecha: '2026-11-02', horaInicio: '16:00:00', horaFin: '17:00:00', tipoEvento: 'Evento 9', estado: 'Reservado', cantidadInvitados: 20 },
      { id: 10, clienteId: 10, reservadoPor: 'Cliente 10', fecha: '2026-12-12', horaInicio: '17:00:00', horaFin: '18:00:00', tipoEvento: 'Evento 10', estado: 'Reservado', cantidadInvitados: 20 },
    ])

    const user = userEvent.setup()
    await renderPage()
    const search = await screen.findByRole('searchbox', { name: 'Buscar evento' })

    await user.type(search, 'evento')
    await pause(350)

    await waitFor(() => expect(apiState.buscar).toHaveBeenCalledWith('evento', 10))
    const buttons = await screen.findAllByRole('button', { name: /^\d{2}:\d{2} Evento / })
    expect(buttons).toHaveLength(10)
    expect(screen.getByRole('button', { name: '08:00 Evento 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '17:00 Evento 10' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '18:00 Evento 11' })).not.toBeInTheDocument()
    expect(screen.getByText('12/08/2026 · Cancelado')).toBeInTheDocument()
  }, 30000)

  it('opens detail when clicking a global result and does not refetch while typing', async () => {
    apiState.buscar.mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        reservadoPor: 'Juan Pérez',
        fecha: '2026-10-22',
        horaInicio: '09:00:00',
        horaFin: '10:00:00',
        tipoEvento: 'Cumpleaños',
        estado: 'Reservado',
        cantidadInvitados: 20,
      },
    ])
    apiState.obtenerPorId.mockResolvedValueOnce({
      id: 1,
      clienteId: 1,
      usuarioCreadorId: 1,
      sucursalId: 1,
      fecha: '2026-08-22',
      horaInicio: '09:00:00',
      horaFin: '10:00:00',
      tipoEvento: 'Cumpleaños',
      cantidadInvitados: 20,
      montoTotal: 1000,
      observaciones: null,
      estado: 'Reservado',
      fechaCreacion: '2026-08-01T10:00:00',
    })
    apiState.listarRango.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const user = userEvent.setup()
    await renderPage()
    const search = await screen.findByRole('searchbox', { name: 'Buscar evento' })

    const clienteCallsBeforeTyping = apiState.listarClientes.mock.calls.length
    await user.type(search, 'juan')
    await pause(350)
    expect(apiState.listarClientes.mock.calls.length).toBe(clienteCallsBeforeTyping)

    await waitFor(() => expect(screen.getByRole('button', { name: '09:00 Cumpleaños' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '09:00 Cumpleaños' }))
    expect(await screen.findByRole('dialog', { name: 'Detalle del evento' })).toBeInTheDocument()
  }, 30000)

  it('uses reservadoPor from global search results without consulting the client cache', async () => {
    apiState.buscar.mockResolvedValueOnce([
      {
        id: 1,
        clienteId: 1,
        reservadoPor: 'Juan Pérez',
        fecha: '2026-10-22',
        horaInicio: '09:00:00',
        horaFin: '10:00:00',
        tipoEvento: 'Cumpleaños',
        estado: 'Reservado',
        cantidadInvitados: 20,
      },
    ])

    const user = userEvent.setup()
    await renderPage()
    const search = await screen.findByRole('searchbox', { name: 'Buscar evento' })

    await user.type(search, 'juan')
    await pause(350)
    expect(screen.getByText('Reservado por: Juan Pérez')).toBeInTheDocument()
    expect(apiState.listarClientes).not.toHaveBeenCalledWith(undefined, 1, 1000, true)
  }, 30000)
})
