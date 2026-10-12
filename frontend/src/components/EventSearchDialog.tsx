import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { formatDate, formatDateInput } from '../formats'
import type { BuscarEventoResponseDto, PagedResult } from '../types'
import Dialog from './ui/Dialog'
import Button from './ui/Button'

interface Props {
  open: boolean
  onClose: () => void
  onOpenEvent: (id: number) => void
}

export default function EventSearchDialog({ open, onClose, onOpenEvent }: Props) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedResult<BuscarEventoResponseDto> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError('')
    api.eventos.buscarGeneral({ q, page })
      .then(data => { if (active) setResult(data) })
      .catch(() => { if (active) setError('No se pudieron buscar eventos.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, q, page])

  function updateFilters(update: () => void) {
    update()
    setPage(1)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Buscar eventos" description="Buscá en todo el historial de la sucursal." width="xl" footer={<Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>}>
      <div className="space-y-4">
        <input aria-label="Buscar eventos" value={q} onChange={e => updateFilters(() => setQ(e.target.value))} placeholder="Buscar por cliente, tipo, estado o fecha..." className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        {loading && <p className="text-sm text-slate-500">Buscando eventos...</p>}
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        {!loading && !error && result?.items.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">No se encontraron eventos.</p>}
        {!loading && !error && result?.items.map(evento => {
          const isPast = evento.fecha < formatDateInput(new Date())
          return <article key={evento.id} className={`rounded-xl border p-3 sm:flex sm:items-center sm:justify-between sm:gap-4 ${isPast ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-slate-950">{formatDate(evento.fecha)} - {evento.tipoEvento}</p>
              <p className="text-sm text-slate-700">{evento.reservadoPor}</p>
              <p className="text-xs text-slate-500">{evento.horaInicio.slice(0, 5)} a {evento.horaFin.slice(0, 5)} · {evento.cantidadInvitados} invitados · {evento.estado}</p>
            </div>
            <Button variant="secondary" size="sm" className="mt-3 sm:mt-0" onClick={() => { onOpenEvent(evento.id); onClose() }}>Ver detalle</Button>
          </article>
        })}
        {!loading && !error && result && result.totalPages > 1 && <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(current => current - 1)}>Anterior</Button>
          <span className="text-sm text-slate-600">Página {result.page} de {result.totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= result.totalPages} onClick={() => setPage(current => current + 1)}>Siguiente</Button>
        </div>}
      </div>
    </Dialog>
  )
}
