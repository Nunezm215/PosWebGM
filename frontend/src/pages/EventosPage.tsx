import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronRight, Plus, Search, UserRound, X } from 'lucide-react'
import { api } from '../api/client'
import { useNotification } from '../context/NotificationContext'
import type { BuscarEventoResponseDto, CargoExtraEventoDto, ClienteDto, CrearEventoRequestDto, EventoDto, FamiliarClienteDto, MedioPagoDto, PagoEventoDto, ResumenFinancieroEventoDto } from '../types'
import PageShell from '../components/shared/PageShell'
import Dialog from '../components/ui/Dialog'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { formatDateTime as formatArgentinaDateTime } from '../formats'
import { DEFAULT_PHONE_CODE, PHONE_CODE_OPTIONS, buildArgentinaPhone, buildTelHref, buildWhatsAppHref, getArgentinaPhoneLocalDigits, getArgentinaPhoneLocalError, getArgentinaPhoneLocalLabel, getArgentinaPhoneLocalPlaceholder, limitArgentinaPhoneLocalDigits } from '../utils/phone'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

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

function isBeforeToday(value: string, today = formatDateInput(new Date())) {
  return Boolean(value) && value < today
}

const EVENTO_ESTADOS = ['Reservado', 'Señado', 'Pagado', 'Cancelado'] as const
type EventoEstado = typeof EVENTO_ESTADOS[number]

const CLIENTE_TIPOS_DOCUMENTO = ['DNI', 'CUIT', 'CUIL', 'ConsumidorFinal']
interface ClienteAltaFormState {
  nombre: string
  fechaNacimiento: string
  tipoDocumento: string
  numeroDocumento: string
  ivaCondicion: string
  telefono: string
  domicilio: string
  mail: string
  familiares: FamiliarClienteDto[]
}

type ClientePhoneForm = {
  code: string
  local: string
}

function createEmptyClienteForm(nombre = ''): ClienteAltaFormState {
  return {
    nombre,
    fechaNacimiento: '',
    tipoDocumento: 'DNI',
    numeroDocumento: '',
    ivaCondicion: 'ConsumidorFinal',
    telefono: '',
    domicilio: '',
    mail: '',
    familiares: [],
  }
}

function toDateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function createEmptyFamiliar(): FamiliarClienteDto {
  return {
    id: 0,
    nombre: '',
    fechaNacimiento: '',
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

export function buildEventoDetalleWhatsAppMessage(
  evento: EventoDto,
  cliente: ClienteDto,
  cargos: CargoExtraEventoDto[],
  pagos: PagoEventoDto[],
  resumen: ResumenFinancieroEventoDto,
) {
  const extrasActivos = cargos.filter(cargo => !cargo.anulado)
  const pagosValidos = pagos.filter(pago => !pago.anulado)
  const lines = [
    '================================',
    '       DETALLE DE RESERVA',
    '================================',
    '',
    `Evento: ${evento.tipoEvento}`,
    `Fecha: ${formatDate(evento.fecha)}`,
    `Horario: ${formatTime(evento.horaInicio)} a ${formatTime(evento.horaFin)}`,
    '',
    '--------------------------------',
    'RESERVANTE',
    '--------------------------------',
    `Nombre: ${cliente.nombre.trim()}`,
    `Teléfono: ${cliente.telefono?.trim() || '-'}`,
    '',
    '--------------------------------',
    'DETALLE',
    '--------------------------------',
    `Mayores: ${evento.cantidadMayores ?? evento.cantidadInvitados}`,
    `Menores: ${evento.cantidadMenores ?? 0}`,
    `Total invitados: ${evento.cantidadInvitados}`,
    `Estado: ${evento.estado}`,
    '',
    `Valor del evento: ${formatCurrency(resumen.montoBase)}`,
  ]

  if (extrasActivos.length > 0) {
    lines.push('', 'Extras:', ...extrasActivos.map(cargo => `- ${cargo.descripcion}: ${formatCurrency(cargo.monto)}`))
  }

  lines.push(
    '',
    '--------------------------------',
    'RESUMEN',
    '--------------------------------',
    `TOTAL: ${formatCurrency(resumen.montoTotal)}`,
    `PAGADO: ${formatCurrency(resumen.totalPagado)}`,
    `SALDO PENDIENTE: ${formatCurrency(resumen.saldoPendiente)}`,
    '',
    '--------------------------------',
    'PAGOS',
    '--------------------------------',
  )

  if (pagosValidos.length === 0) {
    lines.push('Sin pagos registrados')
  } else {
    lines.push(...pagosValidos.map(pago => `- ${formatArgentinaDateTime(pago.fechaRegistro)} - ${pago.medioPago || `Medio #${pago.medioPagoId}`} - ${formatCurrency(pago.monto)}`))
  }

  lines.push('', '================================', 'Gracias por elegirnos', '================================')
  return lines.join('\n')
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

function startOfMonthCopy(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function parseEventDateTime(fecha: string, hora: string) {
  const [year, month, day] = fecha.slice(0, 10).split('-').map(Number)
  const [hours, minutes] = hora.slice(0, 5).split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

function isUpcomingEvento(evento: EventoDto, now: Date) {
  if (evento.estado === 'Cancelado') return false
  return parseEventDateTime(evento.fecha, evento.horaFin).getTime() > now.getTime()
}

function compareEventosByDateTime(a: EventoDto, b: EventoDto) {
  const fecha = a.fecha.localeCompare(b.fecha)
  if (fecha !== 0) return fecha

  const hora = a.horaInicio.localeCompare(b.horaInicio)
  if (hora !== 0) return hora

  return a.id - b.id
}

function formatUpcomingDay(evento: EventoDto) {
  return fromDateKey(evento.fecha.slice(0, 10))
    .toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
    .replace(/\./g, '')
    .replace(',', '')
    .toUpperCase()
}

function formatLongDayLabel(dateKey: string) {
  const raw = fromDateKey(dateKey).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatSelectedDayLabel(dateKey: string) {
  const raw = fromDateKey(dateKey).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function isSameMonth(dateKey: string, anchor: Date) {
  const [year, month] = dateKey.split('-').map(Number)
  return year === anchor.getFullYear() && month === anchor.getMonth() + 1
}

function getDateKeyForMonthDay(anchor: Date, day: number) {
  const clampedDay = Math.max(1, Math.min(day, endOfMonth(anchor).getDate()))
  return toDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), clampedDay))
}

function isCompactViewport() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches
}

interface EventoAltaFormState {
  fecha: string
  horaInicio: string
  horaFin: string
  tipoEvento: string
  cantidadMayores: string
  cantidadMenores: string
  montoTotal: string
  observaciones: string
}

type DisponibilidadEstado = 'idle' | 'loading' | 'available' | 'unavailable' | 'error'

type DisponibilidadResponse = { disponible: boolean; proximaHoraDisponible?: string | null }

function createEmptyForm(fecha = formatDateInput(new Date())): EventoAltaFormState {
  return {
    fecha,
    horaInicio: '',
    horaFin: '',
    tipoEvento: '',
    cantidadMayores: '',
    cantidadMenores: '',
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

function statusStyles(estado: string, isPast = false) {
  if (isPast && estado !== 'Cancelado') {
    return 'border-slate-500 bg-slate-200 text-slate-800'
  }

  switch (estado) {
    case 'Pagado':
      return 'border-sky-400 bg-sky-100 text-sky-950'
    case 'Señado':
      return 'border-blue-400 bg-blue-100 text-blue-950'
    case 'Cancelado':
      return 'border-slate-400 bg-slate-100 text-slate-700 opacity-80'
    default:
      return 'border-blue-400 bg-blue-100 text-blue-950'
  }
}

function statusBadgeStyles(estado: string, isPast = false) {
  if (isPast && estado !== 'Cancelado') return 'bg-slate-700 text-white'

  switch (estado) {
    case 'Pagado':
      return 'bg-sky-700 text-white'
    case 'Señado':
      return 'bg-blue-700 text-white'
    case 'Cancelado':
      return 'bg-slate-600 text-white'
    default:
      return 'bg-blue-700 text-white'
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
  const todayDateKey = formatDateInput(new Date())
  const canManageEvents = user?.rol === 'Admin' || user?.rol === 'SuperAdmin'
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))
  const [eventos, setEventos] = useState<EventoDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvento, setSelectedEvento] = useState<EventoDto | null>(null)
  const [detalleCompartirError, setDetalleCompartirError] = useState('')
  const [detalleCompartirLoading, setDetalleCompartirLoading] = useState(false)
  const [cargosExtra, setCargosExtra] = useState<CargoExtraEventoDto[]>([])
  const [cargosExtraLoading, setCargosExtraLoading] = useState(false)
  const [cargosExtraError, setCargosExtraError] = useState('')
  const [pagos, setPagos] = useState<PagoEventoDto[]>([])
  const [resumenFinanciero, setResumenFinanciero] = useState<ResumenFinancieroEventoDto | null>(null)
  const [pagosError, setPagosError] = useState('')
  const [mediosPago, setMediosPago] = useState<MedioPagoDto[]>([])
  const [pagoOpen, setPagoOpen] = useState(false)
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoMedioId, setPagoMedioId] = useState('')
  const [pagoObservacion, setPagoObservacion] = useState('')
  const [pagoReferencia, setPagoReferencia] = useState('')
  const [pagoError, setPagoError] = useState('')
  const [pagoSaving, setPagoSaving] = useState(false)
  const [pagoClave, setPagoClave] = useState('')
  const [pagoAnular, setPagoAnular] = useState<PagoEventoDto | null>(null)
  const [pagoMotivo, setPagoMotivo] = useState('')
  const [pagoAnularError, setPagoAnularError] = useState('')
  const [pagoAnulando, setPagoAnulando] = useState(false)
  const [agregarExtraOpen, setAgregarExtraOpen] = useState(false)
  const [extraDescripcion, setExtraDescripcion] = useState('')
  const [extraMonto, setExtraMonto] = useState('')
  const [extraError, setExtraError] = useState('')
  const [extraSaving, setExtraSaving] = useState(false)
  const [cargoParaAnular, setCargoParaAnular] = useState<CargoExtraEventoDto | null>(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [anulacionError, setAnulacionError] = useState('')
  const [anulacionSaving, setAnulacionSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

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
  const [clienteCreateFamiliarErrors, setClienteCreateFamiliarErrors] = useState<Record<number, { nombre?: string; fechaNacimiento?: string }>>({})
  const [clienteCreateTelefono, setClienteCreateTelefono] = useState<ClientePhoneForm>({ code: DEFAULT_PHONE_CODE, local: '' })

  const [disponibilidad, setDisponibilidad] = useState<{ estado: DisponibilidadEstado; mensaje: string }>({
    estado: 'idle',
    mensaje: '',
  })

  const [estadoModalOpen, setEstadoModalOpen] = useState(false)
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EventoEstado>('Reservado')
  const [estadoError, setEstadoError] = useState('')
  const [estadoSaving, setEstadoSaving] = useState(false)

  const [clienteDetalle, setClienteDetalle] = useState<ClienteDto | null>(null)
  const [clienteDetalleLoading, setClienteDetalleLoading] = useState(false)
  const [clienteDetalleError, setClienteDetalleError] = useState('')
  const [clientesPorId, setClientesPorId] = useState<Record<number, string>>({})

  const [cancelarOpen, setCancelarOpen] = useState(false)
  const [cancelarError, setCancelarError] = useState('')
  const [cancelarSaving, setCancelarSaving] = useState(false)

  const [contratoOpen, setContratoOpen] = useState(false)
  const [contratoLoading, setContratoLoading] = useState(false)
  const [contratoError, setContratoError] = useState('')

  const [proximosEventos, setProximosEventos] = useState<EventoDto[]>([])
  const [proximosLoading, setProximosLoading] = useState(true)
  const [proximosError, setProximosError] = useState<string | null>(null)
  const [busquedaProximos, setBusquedaProximos] = useState('')
  const [busquedaGlobalResultados, setBusquedaGlobalResultados] = useState<BuscarEventoResponseDto[]>([])
  const [busquedaGlobalLoading, setBusquedaGlobalLoading] = useState(false)
  const [busquedaGlobalError, setBusquedaGlobalError] = useState('')
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [monthPickerYear, setMonthPickerYear] = useState(() => monthAnchor.getFullYear())
  const monthPickerRef = useRef<HTMLDivElement | null>(null)
  const busquedaGlobalRequestIdRef = useRef(0)
  const busquedaGlobalTimeoutRef = useRef<number | null>(null)
  const [dayDialogOpen, setDayDialogOpen] = useState(false)

  const range = useMemo(() => buildVisibleDays(monthAnchor), [monthAnchor])
  const totalExtrasActivos = useMemo(
    () => cargosExtra.filter(cargo => !cargo.anulado).reduce((total, cargo) => total + cargo.monto, 0),
    [cargosExtra],
  )

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

  useEffect(() => {
    let active = true
    const hoy = new Date()
    const desde = toDateKey(hoy)
    const hasta = toDateKey(addMonths(hoy, 12))

    setProximosLoading(true)
    setProximosError(null)

    api.eventos.listarPorRango(desde, hasta)
      .then(data => {
        if (!active) return
        setProximosEventos(data)
      })
      .catch((err: unknown) => {
        if (!active) return
        setProximosEventos([])
        setProximosError(err instanceof Error ? err.message : 'Error al cargar próximos eventos')
      })
      .finally(() => {
        if (active) setProximosLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!monthPickerOpen) return
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setMonthPickerOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [monthPickerOpen])

  useEffect(() => {
    if (!selectedEvento) {
      setClienteDetalle(null)
      setClienteDetalleLoading(false)
      setClienteDetalleError('')
      return
    }

    let active = true
    setClienteDetalle(null)
    setClienteDetalleLoading(true)
    setClienteDetalleError('')

    api.clientes.obtener(selectedEvento.clienteId)
      .then(cliente => {
        if (!active) return
        setClienteDetalle(cliente)
      })
      .catch(() => {
        if (!active) return
        setClienteDetalle(null)
        setClienteDetalleError('No se pudieron cargar las acciones de contacto')
      })
      .finally(() => {
        if (active) setClienteDetalleLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedEvento?.clienteId, selectedEvento?.id])

  useEffect(() => {
    if (!selectedEvento) {
      setCargosExtra([])
      setCargosExtraError('')
      return
    }

    let active = true
    setCargosExtraLoading(true)
    setCargosExtraError('')
    api.eventos.listarCargos(selectedEvento.id)
      .then(cargos => { if (active) setCargosExtra(cargos) })
      .catch(() => { if (active) setCargosExtraError('No se pudieron cargar los extras.') })
      .finally(() => { if (active) setCargosExtraLoading(false) })

    return () => { active = false }
  }, [selectedEvento?.id])

  useEffect(() => {
    if (!selectedEvento) { setPagos([]); setResumenFinanciero(null); setPagosError(''); return }
    let active = true
    Promise.all([api.eventos.listarPagos(selectedEvento.id), api.eventos.resumenFinanciero(selectedEvento.id)])
      .then(([nextPagos, resumen]) => { if (active) { setPagos(nextPagos); setResumenFinanciero(resumen) } })
      .catch(() => { if (active) setPagosError('No se pudo cargar la información de pagos.') })
    return () => { active = false }
  }, [selectedEvento?.id, cargosExtra])

  async function refrescarPagosYResumen(eventoId: number) {
    const [nextPagos, resumen] = await Promise.all([api.eventos.listarPagos(eventoId), api.eventos.resumenFinanciero(eventoId)])
    setPagos(nextPagos); setResumenFinanciero(resumen)
  }

  async function refrescarEventoFinanciero(eventoId: number) {
    const [eventosActualizados, eventoActualizado] = await Promise.all([
      api.eventos.listarPorRango(range.desde, range.hasta),
      api.eventos.obtenerPorId(eventoId),
    ])
    setEventos(eventosActualizados)
    if (eventoActualizado) setSelectedEvento(eventoActualizado)
  }

  async function abrirPago() {
    try { setMediosPago((await api.mediosPago.listar()).filter(medio => medio.activo)); setPagoClave(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`); setPagoError(''); setPagoOpen(true) } catch { setPagoError('No se pudieron cargar los medios de pago.') }
  }

  async function guardarPago() {
    if (!selectedEvento) return
    const monto = Number(pagoMonto)
    if (!pagoMedioId || !Number.isFinite(monto) || monto <= 0) { setPagoError('Ingrese un monto válido y un medio de pago.'); return }
    if (resumenFinanciero && monto > resumenFinanciero.saldoPendiente) { setPagoError('El monto supera el saldo actual.'); return }
    setPagoSaving(true); setPagoError('')
    try {
      await api.eventos.registrarPago(selectedEvento.id, { medioPagoId: Number(pagoMedioId), monto, observacion: pagoObservacion.trim() || undefined, referenciaExterna: pagoReferencia.trim() || undefined, claveIdempotencia: pagoClave })
      await refrescarPagosYResumen(selectedEvento.id); await refrescarEventoFinanciero(selectedEvento.id); setPagoOpen(false); setPagoMonto(''); setPagoMedioId(''); setPagoObservacion(''); setPagoReferencia(''); setPagoClave('')
    } catch (err) { setPagoError(err instanceof Error ? err.message : 'No se pudo registrar el pago.') } finally { setPagoSaving(false) }
  }

  async function confirmarAnularPago() {
    if (!selectedEvento || !pagoAnular) return
    const motivo = pagoMotivo.trim(); if (!motivo) { setPagoAnularError('El motivo de anulación es requerido.'); return }
    setPagoAnulando(true); setPagoAnularError('')
    try { await api.eventos.anularPago(selectedEvento.id, pagoAnular.id, { motivo }); await refrescarPagosYResumen(selectedEvento.id); await refrescarEventoFinanciero(selectedEvento.id); setPagoAnular(null) }
    catch (err) { setPagoAnularError(err instanceof Error ? err.message : 'No se pudo anular el pago.') } finally { setPagoAnulando(false) }
  }

  useEffect(() => {
    if (!selectedDay) return
    if (Object.keys(clientesPorId).length > 0) return

    let active = true
    api.clientes.listar(undefined, 1, 1000, true)
      .then(result => {
        if (!active) return
        const next: Record<number, string> = {}
        for (const cliente of result.items ?? []) {
          if (cliente.id) next[cliente.id] = cliente.nombre
        }
        setClientesPorId(next)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [selectedDay, clientesPorId])

  useEffect(() => {
    if (proximosEventos.length === 0) return
    if (Object.keys(clientesPorId).length > 0) return

    let active = true
    api.clientes.listar(undefined, 1, 1000, true)
      .then(result => {
        if (!active) return
        const next: Record<number, string> = {}
        for (const cliente of result.items ?? []) {
          if (cliente.id) next[cliente.id] = cliente.nombre
        }
        setClientesPorId(next)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [clientesPorId, proximosEventos.length])

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

  const effectiveSelectedDay = useMemo(() => {
    const current = selectedDay
    const currentMonth = new Date()

    if (current && isSameMonth(current, monthAnchor)) {
      return current
    }

    if (monthAnchor.getFullYear() === currentMonth.getFullYear() && monthAnchor.getMonth() === currentMonth.getMonth()) {
      return todayDateKey
    }

    if (current) {
      return getDateKeyForMonthDay(monthAnchor, Number(current.slice(8, 10)))
    }

    return getDateKeyForMonthDay(monthAnchor, 1)
  }, [monthAnchor, selectedDay, todayDateKey])

  const selectedDayEventos = useMemo(() => {
    return (eventosPorDia.get(effectiveSelectedDay) ?? []).slice().sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
  }, [effectiveSelectedDay, eventosPorDia])

  const eventosProximosVisibles = useMemo(() => {
    const ahora = new Date()
    const busqueda = normalizeSearchText(busquedaProximos)
    return proximosEventos
      .filter(evento => isUpcomingEvento(evento, ahora))
      .filter(evento => {
        if (!busqueda) return true
        const clienteNombre = clientesPorId[evento.clienteId]?.trim() || ''
        const fechaVisible = formatUpcomingDay(evento)
        const fechaBusqueda = `${evento.fecha.slice(8, 10)}/${evento.fecha.slice(5, 7)}`
        const campos = [clienteNombre, evento.tipoEvento, evento.estado, fechaVisible, evento.fecha, fechaBusqueda].map(normalizeSearchText)
        return campos.some(campo => campo.includes(busqueda))
      })
      .sort(compareEventosByDateTime)
      .slice(0, 10)
  }, [busquedaProximos, clientesPorId, proximosEventos, reloadKey])

  const busquedaGlobalActiva = Boolean(normalizeSearchText(busquedaProximos))

  useEffect(() => {
    const query = busquedaProximos.trim()

    if (busquedaGlobalTimeoutRef.current !== null) {
      window.clearTimeout(busquedaGlobalTimeoutRef.current)
      busquedaGlobalTimeoutRef.current = null
    }

    if (!query) {
      busquedaGlobalRequestIdRef.current += 1
      setBusquedaGlobalResultados([])
      setBusquedaGlobalLoading(false)
      setBusquedaGlobalError('')
      return
    }

    setBusquedaGlobalResultados([])
    setBusquedaGlobalLoading(true)
    setBusquedaGlobalError('')

    const requestId = ++busquedaGlobalRequestIdRef.current
    busquedaGlobalTimeoutRef.current = window.setTimeout(() => {
      api.eventos.buscar(query, 10)
        .then(resultados => {
          if (requestId !== busquedaGlobalRequestIdRef.current) return
          setBusquedaGlobalResultados(resultados)
        })
        .catch(() => {
          if (requestId !== busquedaGlobalRequestIdRef.current) return
          setBusquedaGlobalResultados([])
          setBusquedaGlobalError('No se pudo buscar eventos.')
        })
        .finally(() => {
          if (requestId !== busquedaGlobalRequestIdRef.current) return
          setBusquedaGlobalLoading(false)
        })
    }, 300)

    return () => {
      if (busquedaGlobalTimeoutRef.current !== null) {
        window.clearTimeout(busquedaGlobalTimeoutRef.current)
        busquedaGlobalTimeoutRef.current = null
      }
    }
  }, [busquedaProximos])

  function getClienteLabel(clienteId: number) {
    return clientesPorId[clienteId]?.trim() || `Cliente #${clienteId}`
  }

  function formatBusquedaGlobalFecha(fecha: string) {
    return formatDate(fecha)
  }

  const monthTitle = formatMonthTitle(monthAnchor)

  function changeMonth(nextMonth: Date) {
    setMonthAnchor(startOfMonthCopy(nextMonth))
    setMonthPickerOpen(false)
  }

  function moveMonth(offset: number) {
    setMonthAnchor(current => startOfMonthCopy(addMonths(current, offset)))
    setMonthPickerOpen(false)
  }

  function toggleMonthPicker() {
    if (!monthPickerOpen) setMonthPickerYear(monthAnchor.getFullYear())
    setMonthPickerOpen(open => !open)
  }

  function goToCurrentMonth() {
    const currentMonth = startOfMonth(new Date())
    setMonthPickerYear(currentMonth.getFullYear())
    changeMonth(currentMonth)
  }

  const timeError = useMemo(() => {
    if (!createForm.horaInicio || !createForm.horaFin) return ''
    return isValidTimeRange(createForm.horaInicio, createForm.horaFin) ? '' : 'La hora fin debe ser posterior a la hora inicio'
  }, [createForm.horaInicio, createForm.horaFin])

  const fechaError = useMemo(() => {
    if (!createForm.fecha) return ''
    return isBeforeToday(createForm.fecha, todayDateKey) ? 'No se puede reservar un evento en una fecha anterior a hoy' : ''
  }, [createForm.fecha, todayDateKey])
  const invitadosError = Number(createForm.cantidadMayores || 0) < 0 || Number(createForm.cantidadMenores || 0) < 0
    ? 'Las cantidades de invitados no pueden ser negativas'
    : ''

  const canGuardar = Boolean(
    clienteSeleccionado?.id &&
    createForm.fecha &&
    createForm.horaInicio &&
    createForm.horaFin &&
    createForm.tipoEvento.trim() &&
    createForm.cantidadMayores.trim() &&
    createForm.cantidadMenores.trim() &&
    createForm.montoTotal.trim() &&
    !fechaError &&
    !timeError &&
    !invitadosError &&
    disponibilidad.estado === 'available' &&
    !saving &&
    !clienteLoading
  )
  const totalInvitadosForm = Math.max(0, Number(createForm.cantidadMayores || 0)) + Math.max(0, Number(createForm.cantidadMenores || 0))

  const canGuardarCliente = !clienteCreateSaving

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
        const respuesta = await api.eventos.consultarDisponibilidad({
          fecha,
          horaInicio: normalizeTimeForApi(horaInicio),
          horaFin: normalizeTimeForApi(horaFin),
          eventoIdExcluir: formMode === 'edit' ? editingEventoId ?? undefined : undefined,
        })
        if (!active) return
        const disponibilidadRespuesta = typeof respuesta === 'boolean'
          ? { disponible: respuesta, proximaHoraDisponible: null }
          : respuesta as DisponibilidadResponse
        const proximaHora = disponibilidadRespuesta.proximaHoraDisponible?.slice(0, 5) ?? ''
        setDisponibilidad({
          estado: disponibilidadRespuesta.disponible ? 'available' : 'unavailable',
          mensaje: disponibilidadRespuesta.disponible
            ? 'Horario disponible'
            : `Horario no disponible${proximaHora ? `\nPróximo horario disponible: ${proximaHora}` : ''}`,
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

  function abrirAltaEvento(fecha?: string) {
    setSelectedEvento(null)
    setFormMode('create')
    setEditingEventoId(null)
    setCreateOpen(true)
    resetAltaEventoState(fecha)
  }

  function resetAltaEventoState(fecha?: string) {
    setCreateForm(createEmptyForm(fecha))
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

  function canAddEventFromDay(dateKey: string) {
    return dateKey >= todayDateKey
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
        cantidadMayores: String(evento.cantidadMayores ?? evento.cantidadInvitados),
        cantidadMenores: String(evento.cantidadMenores ?? 0),
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
    setClienteCreateFamiliarErrors({})
    setClienteCreateTelefono({ code: DEFAULT_PHONE_CODE, local: '' })
    setClienteCreateOpen(true)
  }

  function volverAAltaEvento() {
    if (clienteCreateSaving) return
    setClienteCreateOpen(false)
    setClienteCreateError('')
    setClienteCreateSaving(false)
    setClienteCreateFamiliarErrors({})
    setClienteCreateTelefono({ code: DEFAULT_PHONE_CODE, local: '' })
  }

  function todayLocalDateInputValue() {
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10)
  }

  function normalizeClienteFamiliares(familiares?: FamiliarClienteDto[] | null): FamiliarClienteDto[] {
    return (familiares ?? []).map((familiar, index) => ({
      id: familiar.id ?? index,
      nombre: familiar.nombre ?? '',
      fechaNacimiento: familiar.fechaNacimiento ?? '',
    }))
  }

  function validateClienteFamiliares(familiares: FamiliarClienteDto[]) {
    const today = todayLocalDateInputValue()
    const nextErrors: Record<number, { nombre?: string; fechaNacimiento?: string }> = {}

    familiares.forEach((familiar, index) => {
      const errors: { nombre?: string; fechaNacimiento?: string } = {}
      const nombre = familiar.nombre?.trim() || ''
      const fechaNacimiento = toDateInputValue(familiar.fechaNacimiento)

      if (!nombre) errors.nombre = 'El nombre del familiar es obligatorio'
      if (!fechaNacimiento) errors.fechaNacimiento = 'La fecha de nacimiento del familiar es obligatoria'
      else if (fechaNacimiento > today) errors.fechaNacimiento = 'La fecha de nacimiento del familiar no puede ser futura'

      if (Object.keys(errors).length > 0) nextErrors[index] = errors
    })

    setClienteCreateFamiliarErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function actualizarClienteFamiliares(nextFamiliares: FamiliarClienteDto[]) {
    setClienteCreateForm(prev => ({ ...prev, familiares: nextFamiliares }))
  }

  function agregarClienteFamiliar() {
    actualizarClienteFamiliares([...(clienteCreateForm.familiares ?? []), createEmptyFamiliar()])
  }

  function eliminarClienteFamiliar(index: number) {
    const next = (clienteCreateForm.familiares ?? []).filter((_, current) => current !== index)
    actualizarClienteFamiliares(next)
    setClienteCreateFamiliarErrors(prev => {
      const nextErrors: Record<number, { nombre?: string; fechaNacimiento?: string }> = {}
      next.forEach((_, idx) => {
        const sourceIndex = idx >= index ? idx + 1 : idx
        if (prev[sourceIndex]) nextErrors[idx] = prev[sourceIndex]
      })
      return nextErrors
    })
  }

  function cambiarClienteFamiliar(index: number, field: 'nombre' | 'fechaNacimiento', value: string) {
    const next = [...(clienteCreateForm.familiares ?? [])]
    next[index] = { ...next[index], [field]: value }
    actualizarClienteFamiliares(next)
  }

  function actualizarClienteTelefonoCode(code: string) {
    setClienteCreateTelefono(prev => ({ ...prev, code, local: limitArgentinaPhoneLocalDigits(code, prev.local) }))
  }

  function actualizarClienteTelefonoLocal(value: string) {
    setClienteCreateTelefono(prev => ({ ...prev, local: limitArgentinaPhoneLocalDigits(prev.code, value) }))
  }

  async function guardarNuevoCliente() {
    const nombre = clienteCreateForm.nombre.trim()
    const fechaNacimiento = toDateInputValue(clienteCreateForm.fechaNacimiento)
    const telefono = buildArgentinaPhone(clienteCreateTelefono.code, clienteCreateTelefono.local)
    const expectedTelefonoDigits = getArgentinaPhoneLocalDigits(clienteCreateTelefono.code)

    if (!nombre) {
      setClienteCreateError('Completá el nombre del cliente')
      return
    }

    if (!fechaNacimiento) {
      setClienteCreateError('Completá la fecha de nacimiento')
      return
    }

    if (fechaNacimiento > formatDateInput(new Date())) {
      setClienteCreateError('La fecha de nacimiento no puede ser futura')
      return
    }

    if (!telefono) {
      setClienteCreateError('Completá el celular o teléfono')
      return
    }

    if (clienteCreateTelefono.local.length !== expectedTelefonoDigits) {
      setClienteCreateError(getArgentinaPhoneLocalError(clienteCreateTelefono.code))
      return
    }

    if (!clienteCreateForm.mail.trim()) {
      setClienteCreateError('Completá el email')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteCreateForm.mail.trim())) {
      setClienteCreateError('El email no es válido')
      return
    }

    const familiares = normalizeClienteFamiliares(clienteCreateForm.familiares)
    if (!validateClienteFamiliares(familiares)) {
      setClienteCreateError('Revisá los familiares')
      return
    }

    const payload: ClienteDto = {
      nombre,
      fechaNacimiento,
      tipoDocumento: clienteCreateForm.tipoDocumento,
      numeroDocumento: clienteCreateForm.numeroDocumento.trim() || null,
      ivaCondicion: clienteCreateForm.ivaCondicion,
      telefono,
      domicilio: clienteCreateForm.domicilio.trim() || null,
      mail: clienteCreateForm.mail.trim(),
      familiares,
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
      setClienteCreateFamiliarErrors({})
      setClienteCreateTelefono({ code: DEFAULT_PHONE_CODE, local: '' })
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
  void abrirCambioEstado

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

  function abrirContrato() {
    setContratoError('')
    setContratoOpen(true)
  }

  async function compartirDetalleEvento() {
    if (!selectedEvento) return

    setDetalleCompartirLoading(true)
    setDetalleCompartirError('')
    try {
      const [cliente, cargos, pagosActuales, resumen] = await Promise.all([
        api.clientes.obtener(selectedEvento.clienteId),
        api.eventos.listarCargos(selectedEvento.id),
        api.eventos.listarPagos(selectedEvento.id),
        api.eventos.resumenFinanciero(selectedEvento.id),
      ])
      const whatsappHref = buildWhatsAppHref(cliente.telefono ?? '')
      if (!whatsappHref) {
        setDetalleCompartirError('El evento no tiene un teléfono válido para WhatsApp.')
        return
      }

      const message = buildEventoDetalleWhatsAppMessage(selectedEvento, cliente, cargos, pagosActuales, resumen)
      const opened = window.open(`${whatsappHref}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      if (!opened) setDetalleCompartirError('El navegador bloqueó la apertura de WhatsApp.')
    } catch (err) {
      setDetalleCompartirError(err instanceof Error ? err.message : 'No se pudo preparar el detalle del evento.')
    } finally {
      setDetalleCompartirLoading(false)
    }
  }

  function cerrarContrato() {
    if (contratoLoading) return
    setContratoOpen(false)
    setContratoError('')
  }

  async function obtenerContratoPdf() {
    if (!selectedEvento) return null

    setContratoLoading(true)
    setContratoError('')

    try {
      return await api.eventos.obtenerContratoPdf(selectedEvento.id)
    } catch (err) {
      setContratoError(err instanceof Error ? err.message : 'Error al generar el contrato')
      return null
    } finally {
      setContratoLoading(false)
    }
  }

  async function verContrato() {
    const result = await obtenerContratoPdf()
    if (!result) return

    const url = URL.createObjectURL(result.blob)
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) {
      URL.revokeObjectURL(url)
      setContratoError('El navegador bloqueo la apertura del PDF')
      return
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function handleGuardarEvento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (fechaError) {
      return
    }

    if (!clienteSeleccionado?.id) {
      setCreateError('Seleccioná un cliente')
      return
    }

    if (!createForm.fecha || !createForm.horaInicio || !createForm.horaFin || !createForm.tipoEvento.trim() || !createForm.cantidadMayores.trim() || !createForm.cantidadMenores.trim() || !createForm.montoTotal.trim()) {
      setCreateError('Completá los campos obligatorios')
      return
    }

    if (timeError) {
      setCreateError(timeError)
      return
    }

    if (invitadosError) {
      setCreateError(invitadosError)
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
      cantidadMayores: Number(createForm.cantidadMayores),
      cantidadMenores: Number(createForm.cantidadMenores),
      cantidadInvitados: totalInvitadosForm,
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

  async function guardarExtra() {
    if (!selectedEvento) return
    const descripcion = extraDescripcion.trim()
    const monto = Number(extraMonto)
    if (!descripcion) {
      setExtraError('La descripción es requerida.')
      return
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      setExtraError('El monto debe ser mayor a cero.')
      return
    }

    setExtraSaving(true)
    setExtraError('')
    try {
      const creado = await api.eventos.agregarCargo(selectedEvento.id, { descripcion, monto })
      setCargosExtra(current => [...current, creado])
      await refrescarPagosYResumen(selectedEvento.id)
      await refrescarEventoFinanciero(selectedEvento.id)
      setAgregarExtraOpen(false)
      setExtraDescripcion('')
      setExtraMonto('')
      notifySuccess('Extra agregado correctamente')
    } catch (err) {
      setExtraError(err instanceof Error ? err.message : 'No se pudo agregar el extra.')
    } finally {
      setExtraSaving(false)
    }
  }

  async function confirmarAnulacionExtra() {
    if (!selectedEvento || !cargoParaAnular) return
    const motivo = motivoAnulacion.trim()
    if (!motivo) {
      setAnulacionError('El motivo de anulación es requerido.')
      return
    }

    setAnulacionSaving(true)
    setAnulacionError('')
    try {
      await api.eventos.anularCargo(selectedEvento.id, cargoParaAnular.id, { motivo })
      setCargosExtra(current => current.map(cargo => cargo.id === cargoParaAnular.id
        ? { ...cargo, anulado: true, motivoAnulacion: motivo, fechaAnulacion: new Date().toISOString() }
        : cargo))
      await refrescarPagosYResumen(selectedEvento.id)
      await refrescarEventoFinanciero(selectedEvento.id)
      setCargoParaAnular(null)
      setMotivoAnulacion('')
      notifySuccess('Extra anulado correctamente')
    } catch (err) {
      setAnulacionError(err instanceof Error ? err.message : 'No se pudo anular el extra.')
    } finally {
      setAnulacionSaving(false)
    }
  }

  function openDay(dateKey: string) {
    setSelectedDay(dateKey)
    setDayDialogOpen(!isCompactViewport())
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
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => abrirAltaEvento()}>
            Nuevo Evento
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200 sm:px-4" ref={monthPickerRef}>
            <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Mes anterior"
              >
                <ChevronRight size={18} className="rotate-180" />
              </button>

              <div className="relative text-center">
                <button
                  type="button"
                  onClick={toggleMonthPicker}
                  className="inline-flex items-center justify-center gap-1 text-base font-semibold text-slate-900 sm:text-lg"
                  aria-haspopup="dialog"
                  aria-expanded={monthPickerOpen}
                >
                  <span>{monthTitle}</span>
                </button>

                {monthPickerOpen && (
                  <div className="absolute left-1/2 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-xl" role="dialog" aria-label="Selector de mes y año">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <button type="button" onClick={() => setMonthPickerYear(year => year - 1)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900" aria-label="Año anterior">
                        <ChevronRight size={16} className="rotate-180" />
                      </button>
                      <span className="text-base font-semibold text-gray-900" aria-live="polite">{monthPickerYear}</span>
                      <button type="button" onClick={() => setMonthPickerYear(year => year + 1)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900" aria-label="Año siguiente">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1" aria-label="Meses del año">
                      {MONTH_LABELS.map((label, monthIndex) => {
                        const selected = monthAnchor.getFullYear() === monthPickerYear && monthAnchor.getMonth() === monthIndex
                        return (
                          <button
                            key={label}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => changeMonth(new Date(monthPickerYear, monthIndex, 1))}
                            className={`rounded-lg px-2 py-2 text-sm hover:bg-indigo-50 ${selected ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-gray-700'}`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <button type="button" onClick={goToCurrentMonth} className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                      Ir al mes actual
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Mes siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white px-3 py-4 shadow-sm ring-1 ring-slate-200 sm:px-4">
            <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs" aria-label="Días de la semana">
              {WEEKDAY_LABELS.map(day => (
                <div key={day} className="py-1">{day}</div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-7 gap-y-2">
              {range.days.map(day => {
                const key = toDateKey(day)
                const eventosDia = eventosPorDia.get(key) ?? []
                const tieneEventosActivos = eventosDia.some(evento => evento.estado !== 'Cancelado')
                const isCurrentMonth = day.getMonth() === monthAnchor.getMonth()
                const isSelected = key === effectiveSelectedDay
                const isToday = key === todayDateKey
                const isPast = key < todayDateKey
                const isDimmedPastDay = isCurrentMonth && isPast && !isToday

                return (
                  <button
                    key={key}
                    type="button"
                    role="button"
                    aria-label={`Eventos del día ${formatLongDayLabel(key)}`}
                    tabIndex={0}
                    data-day-key={key}
                    data-has-events={tieneEventosActivos}
                    data-is-today={isToday}
                    data-is-past={isPast}
                    data-is-current-month={isCurrentMonth}
                    onClick={() => openDay(key)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openDay(key)
                      }
                    }}
                    className={`flex min-h-14 flex-col items-center justify-start rounded-xl px-1 py-1 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500/30 sm:min-h-16 ${
                      isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                    } ${isDimmedPastDay ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : isToday
                            ? 'ring-2 ring-inset ring-indigo-500 text-indigo-700'
                            : isCurrentMonth
                              ? 'text-slate-900'
                              : 'text-slate-400'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full ${tieneEventosActivos ? 'bg-indigo-600' : 'bg-transparent'}`} aria-hidden="true" />
                    {isToday && <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-indigo-600">HOY</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
            {effectiveSelectedDay && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{formatSelectedDayLabel(effectiveSelectedDay)}</h2>
                  <p className="text-sm text-slate-500">
                    {selectedDayEventos.length === 0
                      ? 'No hay eventos para este día'
                      : `${selectedDayEventos.length} evento${selectedDayEventos.length === 1 ? '' : 's'}`}
                  </p>
                </div>

                {selectedDayEventos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No hay eventos para este día
                    <div className="mt-3">
                      <Button variant="confirm" size="sm" onClick={() => abrirAltaEvento(effectiveSelectedDay)}>
                        Nuevo Evento
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEventos.map(evento => (
                      <button
                        key={evento.id}
                        type="button"
                        onClick={() => openEvent(evento.id)}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                        aria-label={`${formatTime(evento.horaInicio)} ${evento.tipoEvento}`}
                      >
                        <div className="flex w-16 shrink-0 flex-col items-start text-xs font-semibold text-slate-600">
                          <span>{formatTime(evento.horaInicio)}</span>
                          <span className="text-[10px] text-slate-400">{formatTime(evento.horaFin)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">{evento.tipoEvento}</div>
                          <div className="truncate text-xs text-slate-500">{clientesPorId[evento.clienteId]?.trim() || `Cliente #${evento.clienteId}`}</div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusBadgeStyles(evento.estado)}`}>
                          {evento.estado}
                        </span>
                        <ChevronRight size={16} className="shrink-0 text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!loading && eventos.length === 0 && !error && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
              No hay eventos en este rango.
            </div>
          )}
        </div>

        <aside className="min-w-0">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Próximos eventos</h2>
                <p className="text-xs text-gray-500">Máximo 10 eventos futuros</p>
              </div>
              {proximosLoading && <span className="text-xs text-gray-500">Cargando...</span>}
            </div>

            <input
              type="search"
              value={busquedaProximos}
              onChange={event => setBusquedaProximos(event.target.value)}
              placeholder="Buscar evento..."
              aria-label="Buscar evento"
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />

            <div className="mt-4 space-y-3">
              {!busquedaGlobalActiva && proximosError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
                  No se pudieron cargar los próximos eventos.
                </div>
              )}

              {busquedaGlobalActiva && busquedaGlobalLoading && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  Buscando eventos...
                </div>
              )}

              {busquedaGlobalActiva && !busquedaGlobalLoading && busquedaGlobalError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
                  No se pudo buscar eventos.
                </div>
              )}

              {busquedaGlobalActiva && !busquedaGlobalLoading && !busquedaGlobalError && busquedaGlobalResultados.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  No se encontraron eventos.
                </div>
              )}

              {!busquedaGlobalActiva && !proximosLoading && !proximosError && eventosProximosVisibles.length === 0 && !busquedaProximos.trim() && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  No hay próximos eventos.
                </div>
              )}

              {!busquedaGlobalActiva && !proximosLoading && !proximosError && eventosProximosVisibles.length === 0 && busquedaProximos.trim() && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  No se encontraron eventos.
                </div>
              )}

              {busquedaGlobalActiva ? busquedaGlobalResultados.map(evento => (
                <button
                  key={evento.id}
                  type="button"
                  onClick={() => openEvent(evento.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${statusStyles(evento.estado)}`}
                  aria-label={`${formatTime(evento.horaInicio)} ${evento.tipoEvento}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {formatTime(evento.horaInicio)} - {formatTime(evento.horaFin)}
                      </div>
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {evento.tipoEvento}
                      </div>
                      <div className="text-xs text-gray-600 truncate">
                        Reservado por: {evento.reservadoPor?.trim() || `Cliente #${evento.clienteId}`}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-700">
                        <span>{formatBusquedaGlobalFecha(evento.fecha)} · {evento.estado}</span>
                        {isBeforeToday(evento.fecha.slice(0, 10)) && (
                          <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-semibold tracking-wide text-white">
                            PASADO
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusBadgeStyles(evento.estado)}`}>
                      {evento.estado}
                    </span>
                  </div>
                </button>
              )) : eventosProximosVisibles.map(evento => (
                <button
                  key={evento.id}
                  type="button"
                  onClick={() => openEvent(evento.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${statusStyles(evento.estado)}`}
                  aria-label={`${formatTime(evento.horaInicio)} ${evento.tipoEvento}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
                        {formatUpcomingDay(evento)}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {formatTime(evento.horaInicio)} - {formatTime(evento.horaFin)}
                      </div>
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {evento.tipoEvento}
                      </div>
                      <div className="text-xs text-gray-600 truncate">
                        Reservado por: {getClienteLabel(evento.clienteId)}
                      </div>
                      <div className="text-xs text-gray-700">
                        {evento.cantidadInvitados} invitados
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusBadgeStyles(evento.estado)}`}>
                      {evento.estado}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Dialog
        open={dayDialogOpen && selectedDay !== null}
        onClose={() => setDayDialogOpen(false)}
        title="Eventos del día"
        description={effectiveSelectedDay ? formatLongDayLabel(effectiveSelectedDay) : undefined}
        width="md"
        footer={effectiveSelectedDay ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setDayDialogOpen(false)}>
              Cerrar
            </Button>
            {canAddEventFromDay(effectiveSelectedDay) && (
              <Button variant="confirm" size="sm" onClick={() => {
                const fechaSeleccionada = effectiveSelectedDay
                setDayDialogOpen(false)
                abrirAltaEvento(fechaSeleccionada)
              }}>
                Añadir evento
              </Button>
            )}
          </>
        ) : undefined}
      >
        {effectiveSelectedDay && (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {selectedDayEventos.length === 0
                ? 'No hay eventos para este día.'
                : `${selectedDayEventos.length} evento${selectedDayEventos.length === 1 ? '' : 's'}`}
            </div>
            {selectedDayEventos.length > 0 && (
              <div className="space-y-2">
                {selectedDayEventos.map(evento => (
                  <button
                    key={evento.id}
                    type="button"
                    onClick={() => openEvent(evento.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${statusStyles(evento.estado)}`}
                    aria-label={`${formatTime(evento.horaInicio)} ${evento.tipoEvento}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {formatTime(evento.horaInicio)} - {formatTime(evento.horaFin)}
                        </div>
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {evento.tipoEvento}
                        </div>
                        <div className="text-xs text-gray-700 truncate">
                          Reservado por: {clientesPorId[evento.clienteId]?.trim() || `Cliente #${evento.clienteId}`}
                        </div>
                        <div className="text-xs text-gray-700">
                          {evento.cantidadInvitados} invitados
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusBadgeStyles(evento.estado)}`}>
                        {evento.estado}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Dialog>

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
                min={todayDateKey}
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

          {fechaError && (
            <p className="text-xs font-medium text-red-600">{fechaError}</p>
          )}

          {invitadosError && (
            <p className="text-xs font-medium text-red-600">{invitadosError}</p>
          )}

          <div className={`rounded-xl border px-4 py-3 text-sm whitespace-pre-line ${
            disponibilidad.estado === 'available'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : disponibilidad.estado === 'unavailable'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : disponibilidad.estado === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600'
          }`}>
            {disponibilidad.estado === 'idle' && 'Completá fecha y horarios para validar disponibilidad.'}
            {disponibilidad.estado === 'loading' && 'Consultando disponibilidad...'}
            {disponibilidad.estado === 'available' && 'Horario disponible'}
            {disponibilidad.estado === 'unavailable' && disponibilidad.mensaje}
            {disponibilidad.estado === 'error' && disponibilidad.mensaje}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="evento-mayores" className="text-xs font-semibold text-gray-700">Mayores *</label>
              <input
                id="evento-mayores"
                type="number"
                min="0"
                step="1"
                value={createForm.cantidadMayores}
                onChange={e => setCreateForm(prev => ({ ...prev, cantidadMayores: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label htmlFor="evento-menores" className="text-xs font-semibold text-gray-700">Menores *</label>
              <input
                id="evento-menores"
                type="number"
                min="0"
                step="1"
                value={createForm.cantidadMenores}
                onChange={e => setCreateForm(prev => ({ ...prev, cantidadMenores: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="mt-1 text-xs text-gray-500">Total invitados: {totalInvitadosForm}</p>
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

          <div>
            <label htmlFor="evento-cliente-fecha-nacimiento" className="text-xs font-semibold text-gray-700">Fecha de nacimiento *</label>
            <input
              id="evento-cliente-fecha-nacimiento"
              type="date"
              value={clienteCreateForm.fechaNacimiento}
              onChange={e => setClienteCreateForm(prev => ({ ...prev, fechaNacimiento: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <label htmlFor="evento-cliente-telefono-codigo" className="text-xs font-semibold text-gray-700">Código</label>
              <select
                id="evento-cliente-telefono-codigo"
                value={clienteCreateTelefono.code}
                onChange={e => actualizarClienteTelefonoCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                {PHONE_CODE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="evento-cliente-telefono" className="text-xs font-semibold text-gray-700">Celular / Teléfono *</label>
              <p className="mt-1 text-[11px] text-gray-500">{getArgentinaPhoneLocalLabel(clienteCreateTelefono.code)}</p>
              <input
                id="evento-cliente-telefono"
                type="tel"
                inputMode="numeric"
                value={clienteCreateTelefono.local}
                onChange={e => actualizarClienteTelefonoLocal(e.target.value)}
                placeholder={getArgentinaPhoneLocalPlaceholder(clienteCreateTelefono.code)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="evento-cliente-mail" className="text-xs font-semibold text-gray-700">Email *</label>
              <input
                id="evento-cliente-mail"
                type="email"
                value={clienteCreateForm.mail}
                onChange={e => setClienteCreateForm(prev => ({ ...prev, mail: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
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
              <label htmlFor="evento-cliente-numero-documento" className="text-xs font-semibold text-gray-700">DNI / número de documento</label>
              <input
                id="evento-cliente-numero-documento"
                type="text"
                value={clienteCreateForm.numeroDocumento}
                onChange={e => setClienteCreateForm(prev => ({ ...prev, numeroDocumento: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="evento-cliente-domicilio" className="text-xs font-semibold text-gray-700">Domicilio</label>
            <input
              id="evento-cliente-domicilio"
              type="text"
              value={clienteCreateForm.domicilio}
              onChange={e => setClienteCreateForm(prev => ({ ...prev, domicilio: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800">Familiares (opcional)</p>
              <Button type="button" variant="secondary" size="sm" onClick={agregarClienteFamiliar}>Agregar familiar</Button>
            </div>

            {(clienteCreateForm.familiares ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">Sin familiares cargados.</p>
            ) : (
              <div className="space-y-3">
                {(clienteCreateForm.familiares ?? []).map((familiar, index) => {
                  const errors = clienteCreateFamiliarErrors[index] ?? {}
                  const idBase = `evento-cliente-familiar-${index}`
                  return (
                    <div key={index} className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-700">Familiar {index + 1}</p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => eliminarClienteFamiliar(index)}>Eliminar</Button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`${idBase}-nombre`} className="text-xs font-semibold text-gray-700">Nombre</label>
                          <input
                            id={`${idBase}-nombre`}
                            type="text"
                            value={familiar.nombre}
                            onChange={e => cambiarClienteFamiliar(index, 'nombre', e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          />
                          {errors.nombre && <p className="mt-1 text-xs text-red-600">{errors.nombre}</p>}
                        </div>
                        <div>
                          <label htmlFor={`${idBase}-fecha`} className="text-xs font-semibold text-gray-700">Fecha nacimiento</label>
                          <input
                            id={`${idBase}-fecha`}
                            type="date"
                            max={todayLocalDateInputValue()}
                            value={familiar.fechaNacimiento?.slice(0, 10) || ''}
                            onChange={e => cambiarClienteFamiliar(index, 'fechaNacimiento', e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          />
                          {errors.fechaNacimiento && <p className="mt-1 text-xs text-red-600">{errors.fechaNacimiento}</p>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            El cliente se guardará en Clientes y quedará seleccionado para este Evento.
          </div>
        </form>
      </Dialog>

      <Dialog
        open={selectedEvento !== null}
        onClose={() => {
          setSelectedEvento(null)
          setContratoOpen(false)
        }}
        title="Detalle del evento"
        icon={<CalendarDays size={18} />}
        width="md"
        footer={selectedEvento ? (
          <>
            <Button variant="secondary" size="sm" onClick={compartirDetalleEvento} disabled={detalleCompartirLoading}>
              Compartir detalle
            </Button>
            <Button variant="secondary" size="sm" onClick={abrirContrato}>
              Contrato
            </Button>
            {canManageEvents && (
              <>
                <Button variant="secondary" size="sm" onClick={() => abrirEdicionEvento(selectedEvento)}>
                  Editar
                </Button>
                {selectedEvento.estado !== 'Cancelado' && (
                  <Button variant="destructive" size="sm" onClick={() => abrirCancelar(selectedEvento)}>
                    Cancelar evento
                  </Button>
                )}
              </>
            )}
          </>
        ) : undefined}
      >
        {selectedEvento && (
          <div className="space-y-1">
            {detalleCompartirError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{detalleCompartirError}</p>}
            <DetailRow label="Fecha" value={formatDate(selectedEvento.fecha)} />
            <DetailRow label="Horario" value={`${formatTime(selectedEvento.horaInicio)} - ${formatTime(selectedEvento.horaFin)}`} />
            <DetailRow label="Tipo" value={selectedEvento.tipoEvento} />
            <DetailRow label="Mayores" value={String(selectedEvento.cantidadMayores ?? selectedEvento.cantidadInvitados)} />
            <DetailRow label="Menores" value={String(selectedEvento.cantidadMenores ?? 0)} />
            <DetailRow label="Total invitados" value={String(selectedEvento.cantidadInvitados)} />
            <DetailRow label="Monto" value={formatCurrency(selectedEvento.montoTotal)} />
            <DetailRow label="Estado" value={selectedEvento.estado} />
            <DetailRow
              label="Reservado por"
              value={clienteDetalle?.nombre?.trim() || `Cliente #${selectedEvento.clienteId}`}
            />
            <DetailRow label="Usuario creador" value={selectedEvento.usuarioCreadorNombre || `Usuario #${selectedEvento.usuarioCreadorId}`} />
            <div className="pt-3 mt-2 border-t border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contacto</p>
              {clienteDetalleLoading && (
                <p className="mt-1 text-sm text-gray-500">Cargando contacto del cliente...</p>
              )}
              {!clienteDetalleLoading && clienteDetalleError && (
                <p className="mt-1 text-sm text-gray-500">Las acciones de contacto no están disponibles.</p>
              )}
              {!clienteDetalleLoading && !clienteDetalleError && clienteDetalle && (
                <div className="mt-2 space-y-2">
                  {clienteDetalle.telefono?.trim() ? (
                    <>
                      <DetailRow label="Teléfono" value={clienteDetalle.telefono.trim()} />
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={buildTelHref(clienteDetalle.telefono)}
                          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 sm:flex-none"
                        >
                          Llamar
                        </a>
                        <a
                          href={buildWhatsAppHref(clienteDetalle.telefono)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 sm:flex-none"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">Cliente sin teléfono registrado.</p>
                  )}
                </div>
              )}
            </div>
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Observaciones</p>
              <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                {selectedEvento.observaciones?.trim() || 'Sin observaciones'}
              </p>
            </div>
            <section className="mt-4 border-t border-gray-200 pt-4" aria-label="Finanzas del evento">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Finanzas del evento</p>
                {canManageEvents && selectedEvento.estado !== 'Cancelado' && (
                  <Button size="sm" onClick={() => { setExtraError(''); setAgregarExtraOpen(true) }} icon={<Plus size={14} />}>
                    Agregar extra
                  </Button>
                )}
                {canManageEvents && selectedEvento.estado !== 'Cancelado' && resumenFinanciero?.saldoPendiente !== 0 && <Button size="sm" variant="secondary" onClick={abrirPago}>Registrar pago</Button>}
              </div>
              <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
                <DetailRow label="Monto base" value={formatCurrency(resumenFinanciero?.montoBase ?? selectedEvento.montoTotal)} />
                <DetailRow label="Extras" value={formatCurrency(resumenFinanciero?.totalExtras ?? totalExtrasActivos)} />
                <div className="flex items-center justify-between gap-4 pt-2 text-base font-bold text-slate-950">
                  <span>Total del evento</span>
                  <span>{formatCurrency(resumenFinanciero?.montoTotal ?? selectedEvento.montoTotal + totalExtrasActivos)}</span>
                </div>
                {resumenFinanciero && <>
                  <DetailRow label="Pagado" value={formatCurrency(resumenFinanciero.totalPagado)} />
                  <div className="flex items-center justify-between gap-4 pt-2 text-base font-bold text-emerald-800"><span>Saldo pendiente</span><span>{formatCurrency(resumenFinanciero.saldoPendiente)}</span></div>
                  <DetailRow label="Estado financiero" value={resumenFinanciero.estadoPago === 'SinPagos' ? 'Sin pagos' : resumenFinanciero.estadoPago} />
                </>}
              </div>
              {pagosError && <p className="mt-3 text-sm text-red-700">{pagosError}</p>}
              {!pagosError && <div className="mt-3 space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Historial de pagos</p>{pagos.length === 0 ? <p className="text-sm text-gray-500">No hay pagos registrados.</p> : pagos.map(pago => <div key={pago.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><div className="flex justify-between gap-3"><span className="font-semibold">{pago.tipoPago === 'PagoTotal' ? 'Pago total' : pago.tipoPago} · {pago.medioPago}</span><span className="font-semibold">{formatCurrency(pago.monto)}</span></div><p className="text-xs text-gray-500">{formatArgentinaDateTime(pago.fechaRegistro)}</p>{pago.observacion && <p className="text-xs">{pago.observacion}</p>}{pago.referenciaExterna && <p className="text-xs">Ref: {pago.referenciaExterna}</p>}{pago.anulado ? <p className="mt-1 text-xs font-bold text-slate-600">ANULADO {pago.motivoAnulacion ? `· ${pago.motivoAnulacion}` : ''}</p> : canManageEvents && <Button variant="secondary" size="sm" onClick={() => { setPagoAnular(pago); setPagoMotivo(''); setPagoAnularError('') }}>Anular</Button>}</div>)}</div>}
              {cargosExtraLoading && <p className="mt-3 text-sm text-gray-500">Cargando extras...</p>}
              {cargosExtraError && <p className="mt-3 text-sm text-red-700">{cargosExtraError}</p>}
              {!cargosExtraLoading && !cargosExtraError && (
                <div className="mt-3 space-y-2">
                  {cargosExtra.length === 0 && <p className="text-sm text-gray-500">Sin extras registrados.</p>}
                  {cargosExtra.map(cargo => (
                    <div key={cargo.id} className={`rounded-lg border px-3 py-2 ${cargo.anulado ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{cargo.descripcion}</p>
                          {cargo.anulado && <p className="mt-1 text-xs font-bold tracking-wide text-slate-600">ANULADO</p>}
                          {cargo.anulado && cargo.motivoAnulacion && <p className="mt-1 text-xs">Motivo: {cargo.motivoAnulacion}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(cargo.monto)}</span>
                          {canManageEvents && !cargo.anulado && (
                            <Button variant="secondary" size="sm" onClick={() => { setAnulacionError(''); setMotivoAnulacion(''); setCargoParaAnular(cargo) }}>
                              Anular
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Dialog>

      <Dialog open={pagoOpen} onClose={() => !pagoSaving && setPagoOpen(false)} title="Registrar pago" width="sm" footer={<Button onClick={guardarPago} disabled={pagoSaving}>{pagoSaving ? 'Registrando...' : 'Registrar pago'}</Button>}>
        <div className="space-y-3"><p className="text-sm text-gray-600">Saldo actual: {formatCurrency(resumenFinanciero?.saldoPendiente ?? 0)}</p><input aria-label="Monto pago" type="number" min="0" step="0.01" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Monto"/><select aria-label="Medio de pago" value={pagoMedioId} onChange={e => setPagoMedioId(e.target.value)} className="w-full rounded-lg border px-3 py-2"><option value="">Seleccione un medio</option>{mediosPago.map(medio => <option key={medio.id} value={medio.id}>{medio.nombre}</option>)}</select><input aria-label="Observación" value={pagoObservacion} onChange={e => setPagoObservacion(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Observación opcional"/><input aria-label="Referencia" value={pagoReferencia} onChange={e => setPagoReferencia(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Referencia opcional"/>{pagoError && <p className="text-sm text-red-700">{pagoError}</p>}</div>
      </Dialog>
      <Dialog open={pagoAnular !== null} onClose={() => !pagoAnulando && setPagoAnular(null)} title="Anular pago" width="sm" footer={<Button variant="destructive" onClick={confirmarAnularPago} disabled={pagoAnulando}>{pagoAnulando ? 'Anulando...' : 'Confirmar anulación'}</Button>}><textarea aria-label="Motivo de anulación de pago" value={pagoMotivo} onChange={e => setPagoMotivo(e.target.value)} className="w-full rounded-lg border px-3 py-2" />{pagoAnularError && <p className="mt-2 text-sm text-red-700">{pagoAnularError}</p>}</Dialog>

      <Dialog open={agregarExtraOpen} onClose={() => !extraSaving && setAgregarExtraOpen(false)} title="Agregar extra" width="sm"
        footer={<Button onClick={guardarExtra} disabled={extraSaving}>{extraSaving ? 'Guardando...' : 'Guardar extra'}</Button>}>
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700">Descripción
            <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={extraDescripcion} onChange={event => setExtraDescripcion(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-gray-700">Monto
            <input type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={extraMonto} onChange={event => setExtraMonto(event.target.value)} />
          </label>
          {extraError && <p className="text-sm text-red-700">{extraError}</p>}
        </div>
      </Dialog>

      <Dialog open={cargoParaAnular !== null} onClose={() => !anulacionSaving && setCargoParaAnular(null)} title="Anular extra" width="sm"
        description="¿Anular este extra? Dejará de formar parte del total del Evento."
        footer={<Button variant="destructive" onClick={confirmarAnulacionExtra} disabled={anulacionSaving}>{anulacionSaving ? 'Anulando...' : 'Confirmar anulación'}</Button>}>
        <label className="block text-sm font-semibold text-gray-700">Motivo de anulación
          <textarea className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={motivoAnulacion} onChange={event => setMotivoAnulacion(event.target.value)} />
        </label>
        {anulacionError && <p className="mt-2 text-sm text-red-700">{anulacionError}</p>}
      </Dialog>

      <Dialog
        open={contratoOpen}
        onClose={cerrarContrato}
        title="Contrato"
        description={selectedEvento ? `Contrato de reserva para el Evento #${selectedEvento.id}` : 'Contrato de reserva'}
        width="sm"
        closeOnBackdrop={!contratoLoading}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={cerrarContrato} disabled={contratoLoading}>
              Cerrar
            </Button>
            <Button variant="secondary" size="sm" onClick={verContrato} loading={contratoLoading}>
              Ver contrato
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {contratoError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {contratoError}
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            El PDF se genera con los datos reales del Evento y del Cliente. Se abre en una nueva pestaña o se imprime desde el navegador.
          </div>
        </div>
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
