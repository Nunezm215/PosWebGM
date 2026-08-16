import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ProximoCumpleaniosResponseDto } from '../types'
import PageShell from '../components/shared/PageShell'
import { buildWhatsAppHref } from '../utils/phone'

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function buildBirthdayWhatsAppMessage(oportunidad: ProximoCumpleaniosResponseDto) {
  if (oportunidad.tipoPersona === 'Familiar') {
    return `🎉 ¡Hola, ${oportunidad.nombreCliente}! Se acerca el cumpleaños de ${oportunidad.nombrePersona} 🎂\n\nQueremos ofrecerte un 10% de descuento reservando su evento con nosotros.\n\nPara aprovechar la promoción, respondé este mensaje y coordinamos la fecha.`
  }

  return `🎉 ¡Hola, ${oportunidad.nombreCliente}! Se acerca tu cumpleaños 🎂\n\nQueremos ofrecerte un 10% de descuento reservando tu evento con nosotros.\n\nPara aprovechar la promoción, respondé este mensaje y coordinamos tu fecha.`
}

function buildBirthdayWhatsAppHref(oportunidad: ProximoCumpleaniosResponseDto) {
  const baseHref = buildWhatsAppHref(oportunidad.telefonoCliente ?? '')
  return baseHref ? `${baseHref}?text=${encodeURIComponent(buildBirthdayWhatsAppMessage(oportunidad))}` : ''
}

export default function OportunidadesPage() {
  const [proximosCumpleanios, setProximosCumpleanios] = useState<ProximoCumpleaniosResponseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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
            <div className="max-h-[600px] overflow-y-auto pr-1" data-testid="lista-oportunidades">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {proximosCumpleanios.map(cumpleanios => {
                const whatsappHref = buildBirthdayWhatsAppHref(cumpleanios)
                const whatsappLabel = cumpleanios.tipoPersona === 'Familiar'
                  ? `Enviar promoción por WhatsApp a ${cumpleanios.nombreCliente} por el cumpleaños de ${cumpleanios.nombrePersona}`
                  : `Enviar promoción por WhatsApp a ${cumpleanios.nombreCliente}`

                return (
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
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={whatsappLabel}
                      className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                    >
                      WhatsApp
                    </a>
                  ) : (
                    <button type="button" disabled aria-label={`WhatsApp no disponible para ${cumpleanios.nombreCliente}`} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-200 px-3 text-sm font-bold text-slate-500">
                      Sin teléfono
                    </button>
                  )}
                </article>
                )
              })}
              </div>
            </div>
          </>
        )}
      </section>
    </PageShell>
  )
}
