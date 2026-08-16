import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ProximoCumpleaniosResponseDto } from '../types'
import PageShell from '../components/shared/PageShell'

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function OportunidadesPage() {
  const [proximosCumpleanios, setProximosCumpleanios] = useState<ProximoCumpleaniosResponseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [mostrarTodos, setMostrarTodos] = useState(false)

  useEffect(() => {
    let active = true

    api.clientes.proximosCumpleanios(90)
      .then(data => {
        if (active) setProximosCumpleanios(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const visibles = mostrarTodos ? proximosCumpleanios : proximosCumpleanios.slice(0, 5)

  return (
    <PageShell title="Oportunidades" subtitle="Contactos próximos para impulsar nuevas reservas.">
      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm" aria-label="Oportunidades de cumpleaños">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-violet-950">Cumpleaños próximos</h2>
            <p className="text-sm text-violet-700">Recordatorios comerciales de los próximos 90 días.</p>
          </div>
          {!loading && !error && proximosCumpleanios.length > 0 && (
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-violet-700 shadow-sm">{proximosCumpleanios.length}</span>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Cargando oportunidades...</p>
        ) : error ? (
          <p className="text-sm text-gray-600">No se pudieron cargar las oportunidades.</p>
        ) : proximosCumpleanios.length === 0 ? (
          <p className="text-sm text-gray-600">No hay oportunidades de cumpleaños en los próximos 90 días.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibles.map(cumpleanios => (
                <article key={`${cumpleanios.tipoPersona}-${cumpleanios.personaId}`} className="rounded-xl border border-violet-100 bg-white p-3 shadow-sm" data-testid={`cumpleanios-${cumpleanios.personaId}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-900">{cumpleanios.nombrePersona}</h3>
                      <p className="mt-1 text-sm text-gray-600">Cumple: {formatDate(cumpleanios.proximoCumpleanios)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">
                      {cumpleanios.diasFaltantes === 0 ? 'Cumple hoy' : cumpleanios.diasFaltantes === 1 ? 'Cumple mañana' : `Faltan ${cumpleanios.diasFaltantes} días`}
                    </span>
                  </div>
                  {cumpleanios.tipoPersona === 'Familiar' && (
                    <p className="mt-2 text-sm font-medium text-violet-700">Familiar de: {cumpleanios.nombreCliente}</p>
                  )}
                </article>
              ))}
            </div>

            {proximosCumpleanios.length > 5 && (
              <button type="button" onClick={() => setMostrarTodos(value => !value)} className="mt-3 text-sm font-semibold text-violet-700 hover:text-violet-900">
                {mostrarTodos ? 'Mostrar menos' : `Ver todos (${proximosCumpleanios.length})`}
              </button>
            )}
          </>
        )}
      </section>
    </PageShell>
  )
}
