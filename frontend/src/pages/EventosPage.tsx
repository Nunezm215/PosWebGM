import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Search, UserRound, X } from 'lucide-react'
import { api } from '../api/client'
import { useNotification } from '../context/NotificationContext'
import type { ClienteDto, CrearEventoRequestDto, EventoDto } from '../types'
import PageShell from '../components/shared/PageShell'
import Dialog from '../components/ui/Dialog'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function startOfWeekMonday(date: Date) {
  const result = new Date(date)
  const diff = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - diff)
  return result
}

function endOfWeekSunday(date: Date) {
  const result = new Date(date)
  const diff = (7 - result.getDay()) % 7
  result.setDate(result.getDate() + diff)
  return result
}

function formatTime(value: string) {
  return value.slice(0, 5)
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const EVENTO_ESTADOS = ['Reservado', 'Señado', 'Pagado', 'Cancelado'] as const
type EventoEstado = typeof EVENTO_ESTADOS[number]

const CLIENTE_TIPOS_DOCUMENTO = ['DNI', 'CUIT', 'CUIL', 'ConsumidorFinal']
const CLIENTE_IVA_CONDICIONES = ['ResponsableInscripto', 'Monotributo', 'Exento', 'ConsumidorFinal']

interface ClienteAltaFormState {
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  ivaCondicion: string
  telefono: string
  domicilio: string
  mail: string
}

function createEmptyClienteForm(nombre = ''): ClienteAltaFormState {
  return {
    nombre,
    tipoDocumento: 'DNI',
    numeroDocumento: '',
    ivaCondicion: 'ConsumidorFinal',
    telefono: '',
    domicilio: '',
    mail: '',
  }
}

function normalizeTimeForApi(value: string) {
  if (!value) return ''
  return value.length === 5 ? `${value}:00` : value
}

function parseTimeToMinutes(value: string) {
  if (!value) return NaN
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return NaN
  return (hours * 60) + minutes
}

function isValidTimeRange(horaInicio: string, horaFin: string) {
  const inicio = parseTimeToMinutes(horaInicio)
  const fin = parseTimeToMinutes(horaFin)
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return false
  return fin > inicio
}

function formatClienteLabel(cliente: ClienteDto) {
  const documento = cliente.numeroDocumento?.trim() ? `${cliente.tipoDocumento} ${cliente.numeroDocumento}` : ''
  return documento ? `${cliente.nombre} · ${documento}` : cliente.nombre
}

function formatDate(value: string) {
  const date = fromDateKey(value.slice(0, 10))
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMonthTitle(date: Date) {
  const raw = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatCurrency(value: number) {
  return `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface EventoAltaFormState {
  fecha: string
  horaInicio: string
  horaFin: string
  tipoEvento: string
  cantidadInvitados: string
  montoTotal: string
  observaciones: string
}

type DisponibilidadEstado = 'idle' | 'loading' | 'available' | 'unavailable' | 'error'

function createEmptyForm(): EventoAltaFormState {
  return {
    fecha: formatDateInput(new Date()),
    horaInicio: '',
    horaFin: '',
    tipoEvento: '',
    cantidadInvitados: '',
    montoTotal: '',
    observaciones: '',
  }
}

function buildVisibleDays(anchor: Date) {
  const first = startOfMonth(anchor)
  const last = endOfMonth(anchor)
  const start = startOfWeekMonday(first)
  const end = endOfWeekSunday(last)
  const days: Date[] = []
  const current = new Date(start)
  while (current <= end) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return { days, desde: toDateKey(start), hasta: toDateKey(end) }
}

function shiftMonth(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function statusStyles(estado: string) {
  switch (estado) {
    case 'Pagado':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    case 'Señado':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    case 'Cancelado':
      return 'border-gray-200 bg-gray-100 text-gray-500 opacity-80'
    default:
      return 'border-indigo-200 bg-indigo-50 text-indigo-800'
  }
}

function statusBadgeStyles(estado: string) {
  switch (estado) {
    case 'Pagado':
      return 'bg-emerald-600 text-white'
    case 'Señado':
      return 'bg-amber-600 text-white'
    case 'Cancelado':
      return 'bg-gray-500 text-white'
    default:
      return 'bg-indigo-600 text-white'
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}

export default function EventosPage() {
  const { user } = useAuth()
  const { notifySuccess } = useNotification()
  const canManageEvents = user?.rol === 'Admin' || user?.rol === 'SuperAdmin'
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))
  const [eventos, setEventos] = useState<EventoDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvento, setSelectedEvento] = useState<EventoDto | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingEventoId, setEditingEventoId] = useState<number | null>(null)
  const [createForm, setCreateForm] = useState<EventoAltaFormState>(createEmptyForm)
  const [createError, setCreateError] = useState('')
  const [saving, setSaving] = useState(false)

  const [clienteBusqueda, setClienteBusqueda] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteDto | null>(null)
  const [clienteResultados, setClienteResultados] = useState<ClienteDto[]>([])
  const [clienteBuscando, setClienteBuscando] = useState(false)
  const [clienteError, setClienteError] = useState('')
  const [clienteLoading, setClienteLoading] = useState(false)
  const [clienteCreateOpen, setClienteCreateOpen] = useState(false)
  const [clienteCreateForm, setClienteCreateForm] = useState<ClienteAltaFormState>(() => createEmptyClienteForm())
  const [clienteCreateError, setClienteCreateError] = useState('')
  const [clienteCreateSaving, setClienteCreateSaving] = useState(false)

  const [disponibilidad, setDisponibilidad] = useState<{ estado: DisponibilidadEstado; mensaje: string }>({
    estado: 'idle',
    mensaje: '',
  })

  const [estadoModalOpen, setEstadoModalOpen] = useState(false)
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EventoEstado>('Reservado')
  const [estadoError, setEstadoError] = useState('')
  const [estadoSaving, setEstadoSaving] = useState(false)

  const [cancelarOpen, setCancelarOpen] = useState(false)
  const [cancelarError, setCancelarError] = useState('')
  const [cancelarSaving, setCancelarSaving] = useState(false)

  const range = useMemo(() => buildVisibleDays(monthAnchor), [monthAnchor])

  useEffect(() => {
    let active = true

    setLoading(true)
    setError(null)

    api.eventos.listarPorRango(range.desde, range.hasta)
      .then(data => {
        if (!active) return
        setEventos(data)
      })
      .catch((err: unknown) => {
        if (!active) return
        setEventos([])
        setError(err instanceof Error ? err.message : 'Error al cargar eventos')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    setSelectedEvento(null)

    return () => {
      active = false
    }
  }, [range.desde, range.hasta, reloadKey])

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, EventoDto[]>()
    for (const evento of eventos) {
      const key = evento.fecha.slice(0, 10)
      const current = map.get(key) ?? []
      current.push(evento)
      map.set(key, current)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    }
    return map
  }, [eventos])

  const monthTitle = formatMonthTitle(monthAnchor)

  const timeError = useMemo(() => {
    if (!createForm.horaInicio || !createForm.horaFin) return ''
    return isValidTimeRange(createForm.horaInicio, createForm.horaFin) ? '' : 'La hora fin debe ser posterior a la hora inicio'
  }, [createForm.horaInicio, createForm.horaFin])

  const canGuardar = Boolean(
    clienteSeleccionado?.id &&
    createForm.fecha &&
    createForm.horaInicio &&
    createForm.horaFin &&
    createForm.tipoEvento.trim() &&
    createForm.cantidadInvitados.trim() &&
    createForm.montoTotal.trim() &&
    !timeError &&
    disponibilidad.estado === 'available' &&
    !saving &&
    !clienteLoading
  )

  const canGuardarCliente = Boolean(clienteCreateForm.nombre.trim() && !clienteCreateSaving)

  useEffect(() => {
    if (!createOpen) return

    const query = clienteBusqueda.trim()
    if (!query) {
      setClienteResultados([])
      setClienteBuscando(false)
      setClienteError('')
      return
    }

    if (clienteSeleccionado && query === formatClienteLabel(clienteSeleccionado)) {
      return
    }

    let active = true
    const timeoutId = window.setTimeout(async () => {
      setClienteBuscando(true)
      setClienteError('')
      try {
        const result = await api.clientes.listar(query, 1, 10)
        if (!active) return
        setClienteResultados(result.items ?? [])
      } catch (err) {
        if (!active) return
        setClienteResultados([])
        setClienteError(err instanceof Error ? err.message : 'Error al buscar clientes')
      } finally {
        if (active) setClienteBuscando(false)
      }
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [createOpen, clienteBusqueda, clienteSeleccionado?.id])

  useEffect(() => {
    if (!createOpen) return

    const fecha = createForm.fecha
    const horaInicio = createForm.horaInicio
    const horaFin = createForm.horaFin

    if (!fecha || !horaInicio || !horaFin) {
      setDisponibilidad({ estado: 'idle', mensaje: '' })
      return
    }

    if (!isValidTimeRange(horaInicio, horaFin)) {
      setDisponibilidad({ estado: 'idle', mensaje: '' })
      return
    }

    let active = true
    const timeoutId = window.setTimeout(async () => {
      setDisponibilidad({ estado: 'loading', mensaje: 'Comprobando disponibilidad...' })
      try {
        const disponible = await api.eventos.consultarDisponibilidad({
          fecha,
          horaInicio: normalizeTimeForApi(horaInicio),
          horaFin: normalizeTimeForApi(horaFin),
          eventoIdExcluir: formMode === 'edit' ? editingEventoId ?? undefined : undefined,
        })
        if (!active) return
        setDisponibilidad({
          estado: disponible ? 'available' : 'unavailable',
          mensaje: disponible ? 'Disponible' : 'Horario no disponible',
        })
      } catch (err) {
        if (!active) return
        setDisponibilidad({
          estado: 'error',
          mensaje: err instanceof Error ? err.message : 'Error al consultar disponibilidad',
        })
      }
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [createOpen, formMode, editingEventoId, createForm.fecha, createForm.horaInicio, createForm.horaFin])

  function abrirAltaEvento() {
    setSelectedEvento(null)
    setFormMode('create')
    setEditingEventoId(null)
    setCreateOpen(true)
    resetAltaEventoState()
  }

  function resetAltaEventoState() {
    setCreateForm(createEmptyForm())
    setCreateError('')
    setFormMode('create')
    setEditingEventoId(null)
    setClienteBusqueda('')
    setClienteSeleccionado(null)
    setClienteResultados([])
    setClienteBuscando(false)
    setClienteError('')
    setClienteLoading(false)
    setDisponibilidad({ estado: 'idle', mensaje: '' })
    setSaving(false)
    setClienteCreateOpen(false)
    setClienteCreateForm(createEmptyClienteForm())
    setClienteCreateError('')
    setClienteCreateSaving(false)
  }

  function cerrarAltaEvento() {
    if (saving) return
    setCreateOpen(false)
    resetAltaEventoState()
  }

  async function abrirEdicionEvento(evento: EventoDto) {
    setCreateError('')
    setSelectedEvento(evento)
    setFormMode('edit')
    setEditingEventoId(evento.id)
    setCreateOpen(true)
    setClienteLoading(true)

    try {
      const cliente = await api.clientes.obtener(evento.clienteId)
      setCreateForm({
        fecha: evento.fecha.slice(0, 10),
        horaInicio: formatTime(evento.horaInicio),
        horaFin: formatTime(evento.horaFin),
        tipoEvento: evento.tipoEvento,
        cantidadInvitados: String(evento.cantidadInvitados),
        montoTotal: String(evento.montoTotal),
        observaciones: evento.observaciones ?? '',
      })
      setClienteSeleccionado(cliente)
      setClienteBusqueda(formatClienteLabel(cliente))
      setClienteResultados([])
      setClienteError('')
      setDisponibilidad({ estado: 'idle', mensaje: '' })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al cargar el evento')
    } finally {
      setClienteLoading(false)
    }
  }

  function seleccionarCliente(cliente: ClienteDto) {
    setClienteSeleccionado(cliente)
    setClienteBusqueda(formatClienteLabel(cliente))
    setClienteResultados([])
    setClienteError('')
  }

  function limpiarCliente() {
    setClienteSeleccionado(null)
    setClienteBusqueda('')
    setClienteResultados([])
    setClienteError('')
  }

  function handleClienteBusquedaChange(value: string) {
    setClienteBusqueda(value)
    if (clienteSeleccionado && value.trim() !== formatClienteLabel(clienteSeleccionado)) {
      setClienteSeleccionado(null)
    }
  }

  function abrirCreacionCliente() {
    setClienteCreateForm(createEmptyClienteForm(clienteBusqueda.trim()))
    setClienteCreateError('')
    setClienteCreateSaving(false)
    setClienteCreateOpen(true)
  }

  function volverAAltaEvento() {
    if (clienteCreateSaving) return
    setClienteCreateOpen(false)
    setClienteCreateError('')
    setClienteCreateSaving(false)
  }

  async function guardarNuevoCliente() {
    if (!clienteCreateForm.nombre.trim()) {
      setClienteCreateError('Completá el nombre del cliente')
      return
    }

    const payload: ClienteDto = {
      nombre: clienteCreateForm.nombre.trim(),
      tipoDocumento: clienteCreateForm.tipoDocumento,
      numeroDocumento: clienteCreateForm.numeroDocumento.trim(),
      ivaCondicion: clienteCreateForm.ivaCondicion,
      telefono: clienteCreateForm.telefono.trim() || '',
      domicilio: clienteCreateForm.domicilio.trim() || '',
      mail: clienteCreateForm.mail.trim() || '',
    }

    setClienteCreateSaving(true)
    setClienteCreateError('')

    try {
      const nuevoCliente = await api.clientes.crear(payload)
      setClienteSeleccionado(nuevoCliente)
      setClienteBusqueda(formatClienteLabel(nuevoCliente))
      setClienteResultados([])
      setClienteError('')
      setClienteCreateOpen(false)
      setClienteCreateForm(createEmptyClienteForm())
      notifySuccess('Cliente creado correctamente')
    } catch (err) {
      setClienteCreateError(err instanceof Error ? err.message : 'Error al crear cliente')
    } finally {
      setClienteCreateSaving(false)
    }
  }

  function abrirCambioEstado(evento: EventoDto) {
    setSelectedEvento(evento)
    setEstadoSeleccionado(evento.estado as EventoEstado)
    setEstadoError('')
    setEstadoModalOpen(true)
  }

  function cerrarCambioEstado() {
    if (estadoSaving) return
    setEstadoModalOpen(false)
    setEstadoError('')
    setEstadoSeleccionado('Reservado')
  }

  function abrirCancelar(evento: EventoDto) {
    setSelectedEvento(evento)
    setCancelarError('')
    setCancelarOpen(true)
  }

  function cerrarCancelar() {
    if (cancelarSaving) return
    setCancelarOpen(false)
    setCancelarError('')
  }

  async function handleGuardarEvento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!clienteSeleccionado?.id) {
      setCreateError('Seleccioná un cliente')
      return
    }

    if (!createForm.fecha || !createForm.horaInicio || !createForm.horaFin || !createForm.tipoEvento.trim() || !createForm.cantidadInvitados.trim() || !createForm.montoTotal.trim()) {
      setCreateError('Completá los campos obligatorios')
      return
    }

    if (timeError) {
      setCreateError(timeError)
      return
    }

    if (disponibilidad.estado === 'unavailable') {
      setCreateError('El evento no está disponible en ese horario')
      return
    }

    if (disponibilidad.estado !== 'available') {
      setCreateError('Esperá la validación de disponibilidad')
      return
    }

    const payload: CrearEventoRequestDto = {
      clienteId: clienteSeleccionado.id,
      fecha: createForm.fecha,
      horaInicio: normalizeTimeForApi(createForm.horaInicio),
      horaFin: normalizeTimeForApi(createForm.horaFin),
      tipoEvento: createForm.tipoEvento.trim(),
      cantidadInvitados: Number(createForm.cantidadInvitados),
      montoTotal: Number(createForm.montoTotal),
      observaciones: createForm.observaciones.trim() ? createForm.observaciones.trim() : null,
    }
    const successMessage = formMode === 'edit' ? 'Evento actualizado correctamente' : 'Evento creado correctamente'

    setSaving(true)
    setCreateError('')

    try {
      if (formMode === 'edit' && !editingEventoId) {
        throw new Error('No se pudo determinar el evento a editar')
      }

      const eventoId = editingEventoId as number
      const result = formMode === 'edit'
        ? await api.eventos.editar(eventoId, payload)
        : await api.eventos.crear(payload)

      setReloadKey(value => value + 1)
      if (formMode === 'edit') {
        setSelectedEvento(result)
      }
      setCreateOpen(false)
      resetAltaEventoState()
      notifySuccess(successMessage)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : formMode === 'edit' ? 'Error al editar evento' : 'Error al crear evento')
    } finally {
      setSaving(false)
    }
  }

  async function confirmarCambioEstado() {
    if (!selectedEvento) return

    setEstadoSaving(true)
    setEstadoError('')

    try {
      const actualizado = await api.eventos.cambiarEstado(selectedEvento.id, { estado: estadoSeleccionado })
      setSelectedEvento(actualizado)
      setReloadKey(value => value + 1)
      setEstadoModalOpen(false)
      notifySuccess('Estado actualizado correctamente')
    } catch (err) {
      setEstadoError(err instanceof Error ? err.message : 'Error al cambiar el estado')
    } finally {
      setEstadoSaving(false)
    }
  }

  async function confirmarCancelacion() {
    if (!selectedEvento) return

    setCancelarSaving(true)
    setCancelarError('')

    try {
      const cancelado = await api.eventos.cancelar(selectedEvento.id)
      setSelectedEvento(cancelado)
      setReloadKey(value => value + 1)
      setCancelarOpen(false)
      notifySuccess('Evento cancelado correctamente')
    } catch (err) {
      setCancelarError(err instanceof Error ? err.message : 'Error al cancelar el evento')
    } finally {
      setCancelarSaving(false)
    }
  }

  async function openEvent(id: number) {
    const cached = eventos.find(evento => evento.id === id)
    if (cached) {
      setSelectedEvento(cached)
      return
    }

    try {
      setSelectedEvento(await api.eventos.obtenerPorId(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el evento')
    }
  }

  return (
    <PageShell
      title="Eventos"
      subtitle="Calendario de reservas y eventos"
      loading={loading && eventos.length === 0}
      loadingMessage="Cargando calendario..."
      error={error}
      onErrorClose={() => setError(null)}
      actions={
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={abrirAltaEvento}>
            Nuevo Evento
          </Button>
          <button
            type="button"
            onClick={() => setMonthAnchor(shiftMonth(monthAnchor, -1))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={14} />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <button
            type="button"
            onClick={() => setMonthAnchor(startOfMonth(new Date()))}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setMonthAnchor(shiftMonth(monthAnchor, 1))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            aria-label="Mes siguiente"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight size={14} />
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CalendarDays size={16} className="text-indigo-600" />
          <span className="font-semibold text-gray-900">{monthTitle}</span>
        </div>
        <div className="text-xs text-gray-500">
          {range.desde} - {range.hasta}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-500">
          {WEEKDAY_LABELS.map(day => (
            <div key={day} className="px-2 py-2 text-center">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {range.days.map(day => {
            const key = toDateKey(day)
            const eventosDia = eventosPorDia.get(key) ?? []
            const isCurrentMonth = day.getMonth() === monthAnchor.getMonth()

            return (
              <div
                key={key}
                className={`min-h-[100px] bg-white p-2 text-sm sm:min-h-[122px] sm:p-3 ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400 bg-gray-50'}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isCurrentMonth ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
                    {day.getDate()}
                  </span>
                </div>

                <div className="space-y-1">
                  {eventosDia.slice(0, 3).map(evento => (
                    <button
                      key={evento.id}
                      type="button"
                      onClick={() => openEvent(evento.id)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] sm:text-xs leading-tight transition-colors hover:brightness-[0.98] ${statusStyles(evento.estado)}`}
                      aria-label={`${formatTime(evento.horaInicio)} ${evento.tipoEvento}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">
                            {formatTime(evento.horaInicio)} {evento.tipoEvento}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-90">
                            <Clock3 size={10} />
                            <span>{formatTime(evento.horaInicio)}-{formatTime(evento.horaFin)}</span>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusBadgeStyles(evento.estado)}`}>
                          {evento.estado}
                        </span>
                      </div>
                    </button>
                  ))}

                  {eventosDia.length > 3 && (
                    <div className="px-1 text-[10px] font-medium text-gray-500">
                      +{eventosDia.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!loading && eventos.length === 0 && !error && (
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
          No hay eventos en este rango.
        </div>
      )}

      <Dialog
        open={createOpen}
        onClose={cerrarAltaEvento}
        title={formMode === 'edit' ? 'Editar Evento' : 'Nuevo Evento'}
        description={formMode === 'edit' ? 'Editar una reserva existente' : 'Crear una nueva reserva'}
        width="lg"
        closeOnBackdrop={!saving}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={cerrarAltaEvento} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="confirm"
              size="sm"
              type="submit"
              form="evento-alta-form"
              loading={saving}
              disabled={!canGuardar}
            >
              {saving ? 'Guardando...' : formMode === 'edit' ? 'Guardar Cambios' : 'Guardar Evento'}
            </Button>
          </>
        }
      >
        <form id="evento-alta-form" onSubmit={handleGuardarEvento} className="space-y-4">
          {clienteLoading && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Cargando cliente...</div>
          )}
          {createError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {createError}
            </div>
          )}

          <div>
            <label htmlFor="evento-cliente-busqueda" className="text-xs font-semibold text-gray-700">Cliente *</label>
            <div className="mt-1 space-y-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="evento-cliente-busqueda"
                  type="text"
                  value={clienteBusqueda}
                  onChange={e => handleClienteBusquedaChange(e.target.value)}
                  placeholder="Buscar cliente por nombre o documento"
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                {clienteSeleccionado && (
                  <button
                    type="button"
                    onClick={limpiarCliente}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Limpiar cliente"
                  >
                    <X size={14} />
                    </button>
                )}
              </div>

              {formMode === 'create' && (
                <button
                  type="button"
                  onClick={abrirCreacionCliente}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  <Plus size={12} />
                  Crear cliente nuevo
                </button>
              )}

              {clienteSeleccionado ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <UserRound size={14} />
                  <span className="font-medium">{formatClienteLabel(clienteSeleccionado)}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Escribí al menos un caracter para buscar clientes existentes.</p>
              )}

              {clienteBuscando && (
                <p className="text-xs text-gray-500">Buscando clientes...</p>
              )}

              {clienteError && (
                <p className="text-xs text-red-600">{clienteError}</p>
              )}

              {!clienteSeleccionado && clienteBusqueda.trim() && !clienteBuscando && clienteResultados.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  {clienteResultados.map(cliente => (
                    <button
                      key={cliente.id}
                      type="button"
                      onClick={() => seleccionarCliente(cliente)}
                      className="flex w-full items-start justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{cliente.nombre}</div>
                        <div className="text-xs text-gray-500">
                          {cliente.numeroDocumento ? `${cliente.tipoDocumento} ${cliente.numeroDocumento}` : 'Sin documento'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!clienteSeleccionado && clienteBusqueda.trim() && !clienteBuscando && !clienteError && clienteResultados.length === 0 && (
                <p className="text-xs text-gray-500">Sin resultados</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="evento-fecha" className="text-xs font-semibold text-gray-700">Fecha *</label>
              <input
                id="evento-fecha"
                type="date"
                value={createForm.fecha}
                onChange={e => setCreateForm(prev => ({ ...prev, fecha: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label htmlFor="evento-tipo" className="text-xs font-semibold text-gray-700">Tipo de evento *</label>
              <input
                id="evento-tipo"
                type="text"
                value={createForm.tipoEvento}
                onChange={e => setCreateForm(prev => ({ ...prev, tipoEvento: e.target.value }))}
                placeholder="Cumpleaños, casamiento, bautismo..."
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="evento-hora-inicio" className="text-xs font-semibold text-gray-700">Hora inicio *</label>
              <input
                id="evento-hora-inicio"
                type="time"
                step="60"
                value={createForm.horaInicio}
                onChange={e => setCreateForm(prev => ({ ...prev, horaInicio: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label htmlFor="evento-hora-fin" className="text-xs font-semibold text-gray-700">Hora fin *</label>
              <input
                id="evento-hora-fin"
                type="time"
                step="60"
                value={createForm.horaFin}
                onChange={e => setCreateForm(prev => ({ ...prev, horaFin: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {timeError && (
            <p className="text-xs font-medium text-red-600">{timeError}</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="evento-invitados" className="text-xs font-semibold text-gray-700">Cantidad de invitados *</label>
              <input
                id="evento-invitados"
                type="number"
                min="0"
                step="1"
                value={createForm.cantidadInvitados}
                onChange={e => setCreateForm(prev => ({ ...prev, cantidadInvitados: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label htmlFor="evento-monto" className="text-xs font-semibold text-gray-700">Monto total *</label>
              <input
                id="evento-monto"
                type="number"
                min="0"
                step="0.01"
                value={createForm.montoTotal}
                onChange={e => setCreateForm(prev => ({ ...prev, montoTotal: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="evento-observaciones" className="text-xs font-semibold text-gray-700">Observaciones</label>
            <textarea
              id="evento-observaciones"
              value={createForm.observaciones}
              onChange={e => setCreateForm(prev => ({ ...prev, observaciones: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Opcional"
            />
          </div>

          <div className={`rounded-xl border px-4 py-3 text-sm ${
            disponibilidad.estado === 'available'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : disponibilidad.estado === 'unavailable'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : disponibilidad.estado === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600'
          }`}>
            {disponibilidad.estado === 'idle' && 'Completá fecha y horarios para validar disponibilidad.'}
            {disponibilidad.estado === 'loading' && disponibilidad.mensaje}
            {disponibilidad.estado === 'available' && disponibilidad.mensaje}
            {disponibilidad.estado === 'unavailable' && disponibilidad.mensaje}
            {disponibilidad.estado === 'error' && disponibilidad.mensaje}
          </div>
        </form>
      </Dialog>

      <Dialog
        open={clienteCreateOpen}
        onClose={volverAAltaEvento}
        title="Nuevo Cliente"
        description="Crear un cliente nuevo sin perder el Evento en curso"
        width="md"
        closeOnBackdrop={!clienteCreateSaving}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={volverAAltaEvento} disabled={clienteCreateSaving}>
              Volver al Evento
            </Button>
            <Button
              variant="confirm"
              size="sm"
              type="button"
              onClick={guardarNuevoCliente}
              loading={clienteCreateSaving}
              disabled={!canGuardarCliente}
            >
              {clienteCreateSaving ? 'Guardando...' : 'Guardar Cliente'}
            </Button>
          </>
        }
      >
        <form id="cliente-inline-form" className="space-y-4">
          {clienteCreateError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {clienteCreateError}
            </div>
          )}

          <div>
            <label htmlFor="evento-cliente-nombre" className="text-xs font-semibold text-gray-700">Nombre *</label>
            <input
              id="evento-cliente-nombre"
              type="text"
              value={clienteCreateForm.nombre}
              onChange={e => setClienteCreateForm(prev => ({ ...prev, nombre: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="evento-cliente-tipo-documento" className="text-xs font-semibold text-gray-700">Tipo documento</label>
              <select
                id="evento-cliente-tipo-documento"
                value={clienteCreateForm.tipoDocumento}
                onChange={e => setClienteCreateForm(prev => ({ ...prev, tipoDocumento: e.target.value, numeroDocumento: e.target.value === 'ConsumidorFinal' ? '' : prev.numeroDocumento }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
              >
                {CLIENTE_TIPOS_DOCUMENTO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="evento-cliente-numero-documento" className="text-xs font-semibold text-gray-700">N° documento</label>
              <input
                id="evento-cliente-numero-documento"
                type="text"
                value={clienteCreateForm.numeroDocumento}
                onChange={e => setClienteCreateForm(prev => ({ ...prev, numeroDocumento: e.target.value }))}
                disabled={clienteCreateForm.tipoDocumento === 'ConsumidorFinal'}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="evento-cliente-iva" className="text-xs font-semibold text-gray-700">Condición IVA</label>
            <select
              id="evento-cliente-iva"
              value={clienteCreateForm.ivaCondicion}
              onChange={e => setClienteCreateForm(prev => ({ ...prev, ivaCondicion: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
            >
              {CLIENTE_IVA_CONDICIONES.map(iva => <option key={iva} value={iva}>{iva}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="evento-cliente-telefono" className="text-xs font-semibold text-gray-700">Teléfono</label>
              <input
                id="evento-cliente-telefono"
                type="text"
                value={clienteCreateForm.telefono}
                onChange={e => setClienteCreateForm(prev => ({ ...prev, telefono: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label htmlFor="evento-cliente-mail" className="text-xs font-semibold text-gray-700">Mail</label>
              <input
                id="evento-cliente-mail"
                type="email"
                value={clienteCreateForm.mail}
                onChange={e => setClienteCreateForm(prev => ({ ...prev, mail: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="evento-cliente-domicilio" className="text-xs font-semibold text-gray-700">Domicilio</label>
              <input
                id="evento-cliente-domicilio"
                type="text"
                value={clienteCreateForm.domicilio}
                onChange={e => setClienteCreateForm(prev => ({ ...prev, domicilio: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            El cliente se guardará en Clientes y quedará seleccionado para este Evento.
          </div>
        </form>
      </Dialog>

      <Dialog
        open={selectedEvento !== null}
        onClose={() => setSelectedEvento(null)}
        title="Detalle del evento"
        icon={<CalendarDays size={18} />}
        width="md"
        footer={selectedEvento && canManageEvents ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => abrirEdicionEvento(selectedEvento)}>
              Editar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => abrirCambioEstado(selectedEvento)}>
              Cambiar estado
            </Button>
            {selectedEvento.estado !== 'Cancelado' && (
              <Button variant="destructive" size="sm" onClick={() => abrirCancelar(selectedEvento)}>
                Cancelar evento
              </Button>
            )}
          </>
        ) : undefined}
      >
        {selectedEvento && (
          <div className="space-y-1">
            <DetailRow label="Fecha" value={formatDate(selectedEvento.fecha)} />
            <DetailRow label="Horario" value={`${formatTime(selectedEvento.horaInicio)} - ${formatTime(selectedEvento.horaFin)}`} />
            <DetailRow label="Tipo" value={selectedEvento.tipoEvento} />
            <DetailRow label="Invitados" value={String(selectedEvento.cantidadInvitados)} />
            <DetailRow label="Monto" value={formatCurrency(selectedEvento.montoTotal)} />
            <DetailRow label="Estado" value={selectedEvento.estado} />
            <DetailRow label="Cliente" value={`Cliente #${selectedEvento.clienteId}`} />
            <DetailRow label="Sucursal" value={`Sucursal #${selectedEvento.sucursalId}`} />
            <DetailRow label="Usuario creador" value={`Usuario #${selectedEvento.usuarioCreadorId}`} />
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Observaciones</p>
              <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                {selectedEvento.observaciones?.trim() || 'Sin observaciones'}
              </p>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={estadoModalOpen}
        onClose={cerrarCambioEstado}
        title="Cambiar estado"
        description="Seleccioná el nuevo estado del evento"
        width="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={cerrarCambioEstado} disabled={estadoSaving}>Cancelar</Button>
            <Button variant="confirm" size="sm" onClick={confirmarCambioEstado} loading={estadoSaving}>
              {estadoSaving ? 'Guardando...' : 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {estadoError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{estadoError}</div>}
          <div>
            <label htmlFor="evento-estado-select" className="text-xs font-semibold text-gray-700">Estado</label>
            <select
              id="evento-estado-select"
              value={estadoSeleccionado}
              onChange={e => setEstadoSeleccionado(e.target.value as EventoEstado)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
            >
              {EVENTO_ESTADOS.map(estado => <option key={estado} value={estado}>{estado}</option>)}
            </select>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={cancelarOpen}
        onClose={cerrarCancelar}
        title="Cancelar evento"
        description="¿Confirmás que querés cancelar este evento? El evento quedará cancelado y liberará su horario."
        width="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={cerrarCancelar} disabled={cancelarSaving}>No, volver</Button>
            <Button variant="destructive" size="sm" onClick={confirmarCancelacion} loading={cancelarSaving}>
              {cancelarSaving ? 'Cancelando...' : 'Sí, cancelar'}
            </Button>
          </>
        }
      >
        {cancelarError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{cancelarError}</div>}
      </Dialog>
    </PageShell>
  )
}
