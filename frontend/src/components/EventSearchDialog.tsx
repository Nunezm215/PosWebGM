import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { formatDate } from '../formats'
import type { BuscarEventoResponseDto, PagedResult } from '../types'
import Dialog from './ui/Dialog'
import Button from './ui/Button'

interface Props {
  open: boolean
  onClose: () => void
  onOpenEvent: (id: number) => void
}

const estados = ['Reservado', 'Pagado', 'Cancelado']

export default function EventSearchDialog({ open, onClose, onOpenEvent }: Props) {
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedResult<BuscarEventoResponseDto> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError('')
    api.eventos.buscarGeneral({ q, estado: estado || undefined, desde: desde || undefined, hasta: hasta || undefined, page })
      .then(data => { if (active) setResult(data) })
      .catch(() => { if (active) setError('No se pudieron buscar eventos.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, q, estado, desde, hasta, page])

  function updateFilters(update: () => void) {
    update()
    setPage(1)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Buscar eventos" description="Buscá en todo el historial de la sucursal." width="xl" footer={<Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>}>
      <div className="space-y-4">
        <input aria-label="Buscar eventos" value={q} onChange={e => updateFilters(() => setQ(e.target.value))} placeholder="Buscar por cliente, tipo, estado o fecha..." className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        <div className="grid gap-2 sm:grid-cols-3">
          <select aria-label="Filtrar por estado" value={estado} onChange={e => updateFilters(() => setEstado(e.target.value))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            {estados.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input aria-label="Desde" type="date" value={desde} onChange={e => updateFilters(() => setDesde(e.target.value))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <input aria-label="Hasta" type="date" value={hasta} onChange={e => updateFilters(() => setHasta(e.target.value))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        </div>
        {loading && <p className="text-sm text-slate-500">Buscando eventos...</p>}
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        {!loading && !error && result?.items.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">No se encontraron eventos.</p>}
        {!loading && !error && result?.items.map(evento => (
          <article key={evento.id} className="rounded-xl border border-gray-200 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-slate-950">{formatDate(evento.fecha)} - {evento.tipoEvento}</p>
              <p className="text-sm text-slate-700">{evento.reservadoPor}</p>
              <p className="text-xs text-slate-500">{evento.horaInicio.slice(0, 5)} a {evento.horaFin.slice(0, 5)} · {evento.cantidadInvitados} invitados · {evento.estado}</p>
            </div>
            <Button variant="secondary" size="sm" className="mt-3 sm:mt-0" onClick={() => { onOpenEvent(evento.id); onClose() }}>Ver detalle</Button>
          </article>
        ))}
        {!loading && !error && result && result.totalPages > 1 && <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(current => current - 1)}>Anterior</Button>
          <span className="text-sm text-slate-600">Página {result.page} de {result.totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= result.totalPages} onClick={() => setPage(current => current + 1)}>Siguiente</Button>
        </div>}
      </div>
    </Dialog>
  )
}
