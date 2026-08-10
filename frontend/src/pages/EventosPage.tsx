import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { api } from '../api/client'
import type { EventoDto } from '../types'
import PageShell from '../components/shared/PageShell'
import Dialog from '../components/ui/Dialog'

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
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))
  const [eventos, setEventos] = useState<EventoDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvento, setSelectedEvento] = useState<EventoDto | null>(null)

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
  }, [range.desde, range.hasta])

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
      loading={loading}
      loadingMessage="Cargando calendario..."
      error={error}
      onErrorClose={() => setError(null)}
      actions={
        <div className="flex items-center gap-2">
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
        open={selectedEvento !== null}
        onClose={() => setSelectedEvento(null)}
        title="Detalle del evento"
        icon={<CalendarDays size={18} />}
        width="md"
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
    </PageShell>
  )
}
