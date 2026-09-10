import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { formatCurrency, formatDate, formatDateInput } from '../formats'
import type { EventoDto, ResumenFinancieroEventoDto } from '../types'
import { useAuth } from '../context/AuthContext'
import Dialog from './ui/Dialog'
import Button from './ui/Button'

const ALERT_MARKER = 'upcoming-payment-alert'

interface PendingEvent {
  evento: EventoDto
  resumen: ResumenFinancieroEventoDto
  cliente: string
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day))
  result.setUTCDate(result.getUTCDate() + days)
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

function remainingDays(date: string, today: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number)
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86_400_000)
}

function remainingDaysLabel(date: string, today: string) {
  const days = remainingDays(date, today)
  return days === 0 ? 'Es hoy' : days === 1 ? 'Falta 1 día' : `Faltan ${days} días`
}

export interface UpcomingPaymentAlertHandle {
  openManually: () => void
}

const UpcomingPaymentAlertContext = createContext<UpcomingPaymentAlertHandle | null>(null)

export function useUpcomingPaymentAlert() {
  return useContext(UpcomingPaymentAlertContext)
}

const UpcomingPaymentAlert = forwardRef<UpcomingPaymentAlertHandle>(function UpcomingPaymentAlert(_, ref) {
  const { isAuthenticated } = useAuth()
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([])
  const [open, setOpen] = useState(false)
  const [today, setToday] = useState('')
  const [empty, setEmpty] = useState(false)

  const load = useCallback(async (manual: boolean, isActive: () => boolean = () => true) => {
    const argentinaToday = formatDateInput(new Date())
    try {
      const until = addDays(argentinaToday, 15)
      const events = await api.eventos.listarPorRango(argentinaToday, until)
      const candidates = events.filter(evento => evento.estado !== 'Cancelado' && evento.fecha >= argentinaToday && evento.fecha <= until)
      const withBalance = await Promise.all(candidates.map(async evento => {
        try {
          const resumen = await api.eventos.resumenFinanciero(evento.id)
          return resumen.saldoPendiente > 0 ? { evento, resumen } : null
        } catch {
          return null
        }
      }))
      const pending = withBalance.filter((item): item is { evento: EventoDto; resumen: ResumenFinancieroEventoDto } => item !== null)
      const clients = new Map<number, string>()
      await Promise.all([...new Set(pending.map(item => item.evento.clienteId))].map(async clienteId => {
        try {
          clients.set(clienteId, (await api.clientes.obtener(clienteId)).nombre)
        } catch {
          clients.set(clienteId, `Cliente #${clienteId}`)
        }
      }))

      if (!isActive()) return
      setToday(argentinaToday)
      setPendingEvents(pending
        .map(item => ({ ...item, cliente: clients.get(item.evento.clienteId) ?? `Cliente #${item.evento.clienteId}` }))
        .sort((a, b) => a.evento.fecha.localeCompare(b.evento.fecha)))
      setEmpty(pending.length === 0)
      setOpen(manual || pending.length > 0)
    } catch {
      // The informational alert must never interfere with a successful login.
    }
  }, [])

  useImperativeHandle(ref, () => ({ openManually: () => { void load(true) } }), [load])

  useEffect(() => {
    if (!isAuthenticated) return

    const expiresAt = localStorage.getItem('jwt_expires')
    if (!expiresAt || sessionStorage.getItem(ALERT_MARKER) !== expiresAt) return

    // Consume the login-only marker before requests so navigation cannot duplicate the alert.
    sessionStorage.removeItem(ALERT_MARKER)
    let active = true

    void load(false, () => active)
    return () => { active = false }
  }, [isAuthenticated])

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Eventos próximos con pago pendiente"
      description="Hay eventos a 15 días o menos que todavía tienen saldo pendiente."
      width="lg"
      footer={<Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cerrar</Button>}
    >
      {empty ? (
        <p className="py-3 text-sm text-slate-600">No hay eventos próximos con pagos pendientes.</p>
      ) : <div className="space-y-3">
        {pendingEvents.map(({ evento, resumen, cliente }) => (
          <article key={evento.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 sm:p-4">
            <p className="font-semibold text-slate-950">{formatDate(evento.fecha)} - {evento.tipoEvento}</p>
            <p className="mt-1 text-sm text-slate-700">{cliente}</p>
            <p className="mt-2 text-sm font-medium text-amber-800">{remainingDaysLabel(evento.fecha, today)}</p>
            <div className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-3 sm:gap-3">
              <p>Total: <span className="font-semibold">{formatCurrency(resumen.montoTotal)}</span></p>
              <p>Pagado: <span className="font-semibold">{formatCurrency(resumen.totalPagado)}</span></p>
              <p>Pendiente: <span className="font-semibold text-amber-900">{formatCurrency(resumen.saldoPendiente)}</span></p>
            </div>
          </article>
        ))}
      </div>}
    </Dialog>
  )
})

export function UpcomingPaymentAlertProvider({ children }: { children: ReactNode }) {
  const [handle, setHandle] = useState<UpcomingPaymentAlertHandle | null>(null)

  return (
    <UpcomingPaymentAlertContext.Provider value={handle}>
      <UpcomingPaymentAlert ref={setHandle} />
      {children}
    </UpcomingPaymentAlertContext.Provider>
  )
}

export default UpcomingPaymentAlert
