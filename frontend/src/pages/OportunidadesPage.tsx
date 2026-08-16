import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { OportunidadCumpleaniosAtendidaResponseDto, ProximoCumpleaniosResponseDto } from '../types'
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

function oportunidadKey(oportunidad: Pick<ProximoCumpleaniosResponseDto, 'tipoPersona' | 'personaId' | 'proximoCumpleanios'>) {
  return `${oportunidad.tipoPersona}-${oportunidad.personaId}-${oportunidad.proximoCumpleanios}`
}

function formatDateTime(value: string) {
  const time = value.slice(11, 16)
  return time ? `${formatDate(value)} ${time}` : formatDate(value)
}

export default function OportunidadesPage() {
  const [proximosCumpleanios, setProximosCumpleanios] = useState<ProximoCumpleaniosResponseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [atendiendo, setAtendiendo] = useState<Set<string>>(() => new Set())
  const [erroresAtencion, setErroresAtencion] = useState<Set<string>>(() => new Set())
  const atendiendoRef = useRef(new Set<string>())
  const [pestana, setPestana] = useState<'Pendientes' | 'Atendidas'>('Pendientes')
  const [atendidas, setAtendidas] = useState<OportunidadCumpleaniosAtendidaResponseDto[]>([])
  const [atendidasCargadas, setAtendidasCargadas] = useState(false)
  const [cargandoAtendidas, setCargandoAtendidas] = useState(false)
  const [errorAtendidas, setErrorAtendidas] = useState(false)
  const [restaurando, setRestaurando] = useState<Set<string>>(() => new Set())
  const [erroresRestauracion, setErroresRestauracion] = useState<Set<string>>(() => new Set())
  const restaurandoRef = useRef(new Set<string>())

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

  async function cargarAtendidas() {
    setCargandoAtendidas(true)
    setErrorAtendidas(false)
    try {
      setAtendidas(await api.clientes.oportunidadesCumpleaniosAtendidas())
      setAtendidasCargadas(true)
    } catch {
      setErrorAtendidas(true)
    } finally {
      setCargandoAtendidas(false)
    }
  }

  async function recargarPendientes() {
    try {
      setProximosCumpleanios(await api.clientes.proximosCumpleanios(90))
      setError(false)
    } catch {
      setError(true)
    }
  }

  function cambiarPestana(siguiente: 'Pendientes' | 'Atendidas') {
    setPestana(siguiente)
    if (siguiente === 'Atendidas' && !atendidasCargadas && !cargandoAtendidas) {
      void cargarAtendidas()
    }
  }

  async function marcarAtendida(oportunidad: ProximoCumpleaniosResponseDto) {
    const key = oportunidadKey(oportunidad)
    if (atendiendoRef.current.has(key)) return

    atendiendoRef.current.add(key)
    setAtendiendo(actual => new Set(actual).add(key))
    setErroresAtencion(actual => {
      const siguiente = new Set(actual)
      siguiente.delete(key)
      return siguiente
    })

    try {
      await api.clientes.marcarOportunidadCumpleaniosAtendida({
        tipoPersona: oportunidad.tipoPersona,
        personaId: oportunidad.personaId,
        proximoCumpleanios: oportunidad.proximoCumpleanios,
      })
      setProximosCumpleanios(actual => actual.filter(item => oportunidadKey(item) !== key))
      if (atendidasCargadas) void cargarAtendidas()
    } catch {
      setErroresAtencion(actual => new Set(actual).add(key))
    } finally {
      atendiendoRef.current.delete(key)
      setAtendiendo(actual => {
        const siguiente = new Set(actual)
        siguiente.delete(key)
        return siguiente
      })
    }
  }

  async function volverAPendientes(oportunidad: OportunidadCumpleaniosAtendidaResponseDto) {
    const key = oportunidadKey(oportunidad)
    if (restaurandoRef.current.has(key)) return

    restaurandoRef.current.add(key)
    setRestaurando(actual => new Set(actual).add(key))
    setErroresRestauracion(actual => {
      const siguiente = new Set(actual)
      siguiente.delete(key)
      return siguiente
    })

    try {
      await api.clientes.deshacerOportunidadCumpleaniosAtendida({
        tipoPersona: oportunidad.tipoPersona,
        personaId: oportunidad.personaId,
        proximoCumpleanios: oportunidad.proximoCumpleanios,
      })
      setAtendidas(actual => actual.filter(item => oportunidadKey(item) !== key))
      await recargarPendientes()
    } catch {
      setErroresRestauracion(actual => new Set(actual).add(key))
    } finally {
      restaurandoRef.current.delete(key)
      setRestaurando(actual => {
        const siguiente = new Set(actual)
        siguiente.delete(key)
        return siguiente
      })
    }
  }

  return (
    <PageShell title="Oportunidades" subtitle="Contactos próximos para impulsar nuevas reservas.">
      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm" aria-label="Oportunidades de cumpleaños">
        <div className="mb-4">
          <div>
            <h2 className="text-base font-bold text-violet-950">Cumpleaños próximos</h2>
            <p className="text-sm text-violet-700">Recordatorios comerciales de los próximos 90 días.</p>
          </div>
        </div>

        <div className="mb-4 flex gap-2" role="tablist" aria-label="Estado de oportunidades">
          <button type="button" role="tab" aria-selected={pestana === 'Pendientes'} onClick={() => cambiarPestana('Pendientes')} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${pestana === 'Pendientes' ? 'bg-violet-700 text-white' : 'bg-white text-violet-700'}`}>
            Pendientes ({proximosCumpleanios.length})
          </button>
          <button type="button" role="tab" aria-selected={pestana === 'Atendidas'} onClick={() => cambiarPestana('Atendidas')} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${pestana === 'Atendidas' ? 'bg-violet-700 text-white' : 'bg-white text-violet-700'}`}>
            Atendidas ({atendidas.length})
          </button>
        </div>

        {pestana === 'Pendientes' && (loading ? (
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
                const key = oportunidadKey(cumpleanios)
                const whatsappHref = buildBirthdayWhatsAppHref(cumpleanios)
                const estaAtendiendo = atendiendo.has(key)
                const whatsappLabel = cumpleanios.tipoPersona === 'Familiar'
                  ? `Enviar promoción por WhatsApp a ${cumpleanios.nombreCliente} por el cumpleaños de ${cumpleanios.nombrePersona}`
                  : `Enviar promoción por WhatsApp a ${cumpleanios.nombreCliente}`

                return (
                <article key={key} className="rounded-xl border border-violet-100 bg-white p-3 shadow-sm" data-testid={`cumpleanios-${cumpleanios.personaId}`}>
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    {whatsappHref ? (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={whatsappLabel}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <button type="button" disabled aria-label={`WhatsApp no disponible para ${cumpleanios.nombreCliente}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-200 px-3 text-sm font-bold text-slate-500">
                        Sin teléfono
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={estaAtendiendo}
                      onClick={() => marcarAtendida(cumpleanios)}
                      aria-label={`Marcar como atendida la oportunidad de cumpleaños de ${cumpleanios.nombrePersona}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-violet-200 bg-white px-3 text-sm font-bold text-violet-700 transition-colors hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {estaAtendiendo ? 'Marcando...' : 'Marcar atendido'}
                    </button>
                  </div>
                  {erroresAtencion.has(key) && <p className="mt-2 text-sm text-red-700">No se pudo marcar como atendido.</p>}
                </article>
                )
              })}
              </div>
            </div>
          </>
        ))}

        {pestana === 'Atendidas' && (cargandoAtendidas ? (
          <p className="text-sm text-gray-600">Cargando atendidas...</p>
        ) : errorAtendidas ? (
          <button type="button" onClick={() => void cargarAtendidas()} className="text-sm font-semibold text-violet-700 hover:text-violet-900">No se pudieron cargar las oportunidades atendidas. Reintentar</button>
        ) : atendidas.length === 0 ? (
          <p className="text-sm text-gray-600">No hay oportunidades atendidas.</p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto pr-1" data-testid="lista-atendidas">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {atendidas.map(atendida => {
                const key = oportunidadKey(atendida)
                const estaRestaurando = restaurando.has(key)
                return (
                  <article key={key} className="rounded-xl border border-violet-100 bg-white p-3 shadow-sm" data-testid={`atendida-${atendida.personaId}`}>
                    <h3 className="font-semibold text-gray-900">{atendida.nombrePersona}</h3>
                    <p className="mt-1 text-sm text-gray-600">Cumple: {formatDate(atendida.proximoCumpleanios)}</p>
                    <p className="mt-1 text-sm text-gray-600">Atendido: {formatDateTime(atendida.fechaAtendido)}</p>
                    {atendida.tipoPersona === 'Familiar' && <p className="mt-2 text-sm font-medium text-violet-700">Familiar de: {atendida.nombreCliente}</p>}
                    <button type="button" disabled={estaRestaurando} onClick={() => volverAPendientes(atendida)} aria-label={`Volver a pendientes la oportunidad de cumpleaños de ${atendida.nombrePersona}`} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-violet-200 bg-white px-3 text-sm font-bold text-violet-700 transition-colors hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                      {estaRestaurando ? 'Restaurando...' : 'Volver a pendientes'}
                    </button>
                    {erroresRestauracion.has(key) && <p className="mt-2 text-sm text-red-700">No se pudo volver a pendientes.</p>}
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </PageShell>
  )
}
