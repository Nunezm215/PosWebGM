import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { PageShell } from '../components/shared'
import Dialog from '../components/ui/Dialog'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../formats'
import type { CajaDiariaDto, CajaDiariaResumenDto, CajaMensualDto, GastoDto } from '../types'
import { CalendarDays, CircleDollarSign, CreditCard, ReceiptText, TrendingDown, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'

const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => today().slice(0, 7)
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('es-AR')
const dateLabelLong = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const timeLabel = (value: string) => new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
const monthLabel = (value: string) => {
  const [anio, mes] = value.split('-').map(Number)
  if (!anio || !mes) return value
  const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(anio, mes - 1, 1))
  return label.replace(' de ', ' ').replace(/^./, c => c.toUpperCase())
}
const periodLabel = (desde: string, hasta: string) => `${dateLabelLong(desde)} al ${dateLabelLong(hasta)}`
const tieneActividad = (dia: CajaDiariaResumenDto) => dia.totalIngresos !== 0 || dia.totalEgresos !== 0 || dia.cantidadEventosRealizados !== 0
const dateTimeLabel = (value: string) => new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

export default function CajaPage() {
  const { user } = useAuth()
  const puedeVerGastos = user?.rol === 'Admin' || user?.rol === 'SuperAdmin'

  const [fecha, setFecha] = useState(today)
  const [caja, setCaja] = useState<CajaDiariaDto | null>(null)
  const [historial, setHistorial] = useState<CajaDiariaResumenDto[]>([])
  const [error, setError] = useState('')
  const [gastoOpen, setGastoOpen] = useState(false)
  const [detalle, setDetalle] = useState('')
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [abriendoPdf, setAbriendoPdf] = useState(false)
  const [abriendoPdfMensual, setAbriendoPdfMensual] = useState(false)
  const [historialOpen, setHistorialOpen] = useState(false)
  const [resumenOpen, setResumenOpen] = useState(false)
  const [resumenMes, setResumenMes] = useState(currentMonth())
  const [resumen, setResumen] = useState<CajaMensualDto | null>(null)
  const [resumenLoading, setResumenLoading] = useState(false)
  const [resumenError, setResumenError] = useState('')
  const [gastosOpen, setGastosOpen] = useState(false)
  const [gastosLoading, setGastosLoading] = useState(false)
  const [gastosError, setGastosError] = useState('')
  const [gastos, setGastos] = useState<GastoDto[]>([])
  const [gastoQuery, setGastoQuery] = useState('')

  const maxResumenMes = currentMonth()

  const cargar = async (dia = fecha) => {
    try {
      setError('')
      const desde = new Date(`${dia}T00:00:00`)
      desde.setDate(desde.getDate() - 29)
      const [detalleCaja, items] = await Promise.all([
        api.cajaDiaria.obtener(dia),
        api.cajaDiaria.historial(desde.toISOString().slice(0, 10), dia),
      ])
      setCaja(detalleCaja)
      setHistorial([...items].reverse())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la caja.')
    }
  }

  const cargarResumenMensual = async (mes = resumenMes) => {
    if (mes > maxResumenMes) {
      setResumenError('No se pueden consultar meses futuros.')
      return
    }

    setResumenLoading(true)
    setResumenError('')
    setResumen(null)

    try {
      const [anio, numeroMes] = mes.split('-').map(Number)
      const data = await api.cajaDiaria.obtenerMensual(anio, numeroMes)
      setResumen(data)
    } catch (e) {
      setResumenError(e instanceof Error ? e.message : 'No se pudo cargar el resumen mensual.')
    } finally {
      setResumenLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [fecha])

  useEffect(() => {
    if (!resumenOpen) return
    void cargarResumenMensual(resumenMes)
  }, [resumenOpen, resumenMes])

  useEffect(() => {
    if (!gastosOpen) return
    void buscarGastos('')
  }, [gastosOpen])

  const cerrarGasto = () => {
    if (!guardando) {
      setGastoOpen(false)
      setDetalle('')
      setMonto('')
      setError('')
    }
  }

  const registrar = async () => {
    if (!detalle.trim() || Number(monto) <= 0) {
      setError('Detalle y monto válido son requeridos.')
      return
    }

    setGuardando(true)
    try {
      await api.gastos.crearSimple({ detalle: detalle.trim(), monto: Number(monto) })
      const hoy = today()
      setFecha(hoy)
      setDetalle('')
      setMonto('')
      setGastoOpen(false)
      await cargar(hoy)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el gasto.')
    } finally {
      setGuardando(false)
    }
  }

  const abrirPdf = async () => {
    const ventana = window.open('', '_blank')
    setAbriendoPdf(true)
    try {
      const { blob } = await api.cajaDiaria.obtenerPdf(fecha)
      const url = URL.createObjectURL(blob)
      if (ventana) ventana.location.href = url
      else window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      ventana?.close()
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF de Caja.')
    } finally {
      setAbriendoPdf(false)
    }
  }

  const abrirResumen = () => {
    setResumenMes(currentMonth())
    setResumenError('')
    setResumen(null)
    setResumenOpen(true)
  }

  const abrirGastos = () => {
    setGastosError('')
    setGastoQuery('')
    setGastosOpen(true)
  }

  const buscarGastos = async (q: string = gastoQuery) => {
    setGastosLoading(true)
    setGastosError('')
    try {
      const res = await api.gastos.historial(undefined, undefined, undefined, undefined, undefined, q)
      setGastos(res.items)
    } catch (e) {
      setGastosError(e instanceof Error ? e.message : 'No se pudieron cargar los gastos.')
    } finally {
      setGastosLoading(false)
    }
  }

  const limpiarGastos = () => {
    setGastoQuery('')
    void buscarGastos('')
  }

  const cerrarGastos = () => {
    setGastosOpen(false)
    setGastosError('')
  }

  const abrirPdfMensual = async () => {
    const ventana = window.open('', '_blank')
    setAbriendoPdfMensual(true)
    try {
      const [anio, mes] = resumenMes.split('-').map(Number)
      const { blob } = await api.cajaDiaria.obtenerPdfMensual(anio, mes)
      const url = URL.createObjectURL(blob)
      if (ventana) ventana.location.href = url
      else window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      ventana?.close()
      setResumenError(e instanceof Error ? e.message : 'No se pudo generar el PDF mensual.')
    } finally {
      setAbriendoPdfMensual(false)
    }
  }

  const cerrarResumen = () => {
    setResumenOpen(false)
    setResumenError('')
  }

  const cambiarMesResumen = (value: string) => {
    if (!value) return
    if (value > maxResumenMes) {
      setResumenError('No se pueden consultar meses futuros.')
      return
    }
    setResumenMes(value)
  }

  const actividades = resumen?.dias.filter(tieneActividad) ?? []

  return (
    <PageShell title="Caja diaria" subtitle="Resumen financiero y movimientos del día seleccionado" error={error} onErrorClose={() => setError('')}>
      <div className="w-full space-y-5 rounded-2xl bg-slate-50/70 p-3 sm:p-4">
        <section className="border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-3 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Fecha de caja
              <input aria-label="Fecha de caja" type="date" value={fecha} onChange={e => { if (e.target.value) setFecha(e.target.value) }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setHistorialOpen(true)}>Ver historial</button>
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={abrirResumen}>Ver resumen mensual</button>
              {puedeVerGastos && <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={abrirGastos}>Ver gastos</button>}
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60" onClick={abrirPdf} disabled={abriendoPdf}>{abriendoPdf ? 'Abriendo PDF...' : 'Abrir PDF del día'}</button>
              <button className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => setGastoOpen(true)}>Registrar gasto</button>
            </div>
          </div>
        </section>

        {caja && (
          <>
            <section>
              <SectionTitle title="Resumen del día" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[900px]:grid-cols-4">
                <SummaryCard label="Ingresos" value={formatCurrency(caja.totalIngresos)} icon={TrendingUp} tone="blue" />
                <SummaryCard label="Egresos" value={formatCurrency(caja.totalEgresos)} icon={TrendingDown} tone="rose" />
                <SummaryCard label="Resultado" value={formatCurrency(caja.resultado)} icon={CircleDollarSign} tone={caja.resultado < 0 ? 'rose' : 'emerald'} prominent negative={caja.resultado < 0} />
                <SummaryCard label="Eventos realizados" value={String(caja.cantidadEventosRealizados)} icon={CalendarDays} tone="violet" />
              </div>
            </section>

            <div className="grid items-start gap-x-5 gap-y-5 md:grid-cols-2">
              <Section title="Ingresos por medio de pago" icon={CreditCard} tone="blue">
                <ResponsiveTable headers={['Medio de pago', 'Cantidad', 'Total']} rows={caja.desgloseMediosPago.map(m => [m.descripcion, String(m.cantidadPagos), formatCurrency(m.total)])} empty="Sin ingresos para desglosar por medio de pago." />
              </Section>
              <Section title="Eventos realizados" icon={CalendarDays} tone="violet">
                <ResponsiveTable headers={['Hora', 'Cliente', 'Tipo de evento', 'Estado']} rows={caja.eventosRealizados.map(e => [e.horaInicio.slice(0, 5), e.nombreCliente, e.tipoEvento, e.estado])} empty="Sin eventos registrados." />
              </Section>
            </div>

            <div className="grid items-start gap-x-5 gap-y-5 md:grid-cols-[1.3fr_1fr]">
              <Section title="Detalle de ingresos" icon={Wallet} tone="emerald">
                <ResponsiveTable headers={['Hora', 'Cliente', 'Evento', 'Medio', 'Monto']} rows={caja.ingresos.map(i => [timeLabel(i.fechaRegistro), i.nombreCliente, i.tipoEvento, i.medioPago, formatCurrency(i.monto)])} empty="Sin ingresos registrados." />
              </Section>
              <Section title="Detalle de egresos" icon={ReceiptText} tone="rose">
                <ResponsiveTable headers={['Hora', 'Concepto', 'Monto']} rows={caja.egresos.map(g => [timeLabel(g.fecha), g.detalle, formatCurrency(g.monto)])} empty="Sin egresos registrados." />
              </Section>
            </div>
          </>
        )}

        <Dialog
          open={resumenOpen}
          onClose={cerrarResumen}
          title="Resumen mensual de Caja"
          description="Consulta el resumen contable del mes seleccionado"
          width="xl"
          footer={<button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" onClick={cerrarResumen}>Cerrar</button>}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                Mes y año
                <input
                  aria-label="Mes y año"
                  type="month"
                  value={resumenMes}
                  max={maxResumenMes}
                  onChange={e => cambiarMesResumen(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-500">Disponible hasta {monthLabel(maxResumenMes)}.</p>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={abrirPdfMensual}
                  disabled={abriendoPdfMensual || resumenLoading}
                >
                  {abriendoPdfMensual ? 'Abriendo PDF...' : 'Abrir PDF mensual'}
                </button>
              </div>
            </div>

            {resumenLoading && <p className="text-sm text-slate-500">Cargando resumen...</p>}
            {!resumenLoading && resumenError && <p className="text-sm text-red-700">{resumenError}</p>}

            {!resumenLoading && resumen && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{monthLabel(`${resumen.anio}-${String(resumen.mes).padStart(2, '0')}`)}</span>
                  <span className="ml-2">{periodLabel(resumen.desde, resumen.hasta)}</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[900px]:grid-cols-4">
                  <SummaryCard label="Ingresos" value={formatCurrency(resumen.totalIngresos)} icon={TrendingUp} tone="blue" />
                  <SummaryCard label="Egresos" value={formatCurrency(resumen.totalEgresos)} icon={TrendingDown} tone="rose" />
                  <SummaryCard label="Resultado" value={formatCurrency(resumen.resultado)} icon={CircleDollarSign} tone={resumen.resultado < 0 ? 'rose' : 'emerald'} prominent negative={resumen.resultado < 0} />
                  <SummaryCard label="Eventos realizados" value={String(resumen.eventosRealizados)} icon={CalendarDays} tone="violet" />
                </div>

                <Section title="Ingresos por medio de pago" icon={CreditCard} tone="blue">
                  <ResponsiveTable headers={['Medio', 'Cantidad', 'Total']} rows={resumen.ingresosPorMedio.map(m => [m.descripcion, String(m.cantidadPagos), formatCurrency(m.total)])} empty="Sin ingresos para desglosar por medio de pago." />
                </Section>

                <Section title="Actividad del mes" icon={CalendarDays} tone="violet">
                  <ResponsiveTable
                    headers={['Fecha', 'Ingresos', 'Egresos', 'Resultado', 'Eventos']}
                    rows={actividades.map(dia => [dateLabel(dia.fecha), formatCurrency(dia.totalIngresos), formatCurrency(dia.totalEgresos), formatCurrency(dia.resultado), String(dia.cantidadEventosRealizados)])}
                    empty="Sin actividad registrada en este mes."
                  />
                </Section>
              </div>
            )}
          </div>
        </Dialog>

        <Dialog
          open={gastosOpen}
          onClose={cerrarGastos}
          title="Gastos"
          description="Consulta y busca gastos registrados"
          width="xl"
          footer={<button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" onClick={cerrarGastos} disabled={gastosLoading}>Cerrar</button>}
        >
          <div className="space-y-4">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={e => {
                e.preventDefault()
                void buscarGastos(gastoQuery)
              }}
            >
              <label className="sr-only" htmlFor="buscar-gasto-global">Buscar gasto</label>
              <input
                id="buscar-gasto-global"
                aria-label="Buscar gasto"
                value={gastoQuery}
                onChange={e => setGastoQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void buscarGastos(gastoQuery) } }}
                placeholder="Buscar por detalle, fecha, monto, usuario o estado"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
              <div className="flex gap-2 sm:shrink-0">
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" disabled={gastosLoading}>{gastosLoading ? 'Buscando...' : 'Buscar'}</button>
                <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium" onClick={limpiarGastos} disabled={gastosLoading}>Limpiar</button>
              </div>
            </form>

            {gastosLoading && <p className="text-sm text-slate-500">Cargando gastos...</p>}
            {!gastosLoading && gastosError && <p className="text-sm text-red-700">{gastosError}</p>}

            {!gastosLoading && !gastosError && (
              <div className="max-h-[52vh] overflow-y-auto pr-1">
                {gastos.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm italic text-slate-500">No se encontraron gastos.</p>
                ) : (
                  <>
                    <div className="hidden md:block">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="sticky top-0 border-b border-slate-200 bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-3">Fecha</th>
                            <th className="px-3 py-3">Detalle</th>
                            <th className="px-3 py-3">Usuario</th>
                            <th className="px-3 py-3">Estado</th>
                            <th className="px-3 py-3 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gastos.map(gasto => (
                            <tr key={gasto.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                              <td className="px-3 py-3 text-slate-700">{dateTimeLabel(gasto.fecha)}</td>
                              <td className="px-3 py-3 text-slate-700">{gasto.detalle}</td>
                              <td className="px-3 py-3 text-slate-700">{gasto.usuarioNombre || '—'}</td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${gasto.anulado ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {gasto.anulado ? 'Anulado' : 'Activo'}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(gasto.monto)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2 md:hidden">
                      {gastos.map(gasto => (
                        <article key={gasto.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800">{gasto.detalle}</p>
                              <p className="text-xs text-slate-500">{dateTimeLabel(gasto.fecha)}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${gasto.anulado ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {gasto.anulado ? 'Anulado' : 'Activo'}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                            <span className="text-slate-500">Usuario</span>
                            <span className="text-right text-slate-700">{gasto.usuarioNombre || '—'}</span>
                            <span className="text-slate-500">Monto</span>
                            <span className="text-right font-semibold text-slate-900">{formatCurrency(gasto.monto)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Dialog>

        <Dialog open={gastoOpen} onClose={cerrarGasto} title="Registrar gasto" width="sm" footer={<><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" onClick={cerrarGasto} disabled={guardando}>Cancelar</button><button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white" onClick={registrar} disabled={guardando}>{guardando ? 'Registrando...' : 'Registrar gasto'}</button></>}>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Detalle
              <input aria-label="Detalle gasto" value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Detalle" className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Monto
              <input aria-label="Monto gasto" type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Monto" className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        </Dialog>

        <Dialog open={historialOpen} onClose={() => setHistorialOpen(false)} title="Historial de Caja" description="Últimos 30 días" width="xl" footer={<button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" onClick={() => setHistorialOpen(false)}>Cerrar</button>}>
          <Historial historial={historial} fecha={fecha} onSelect={dia => { setFecha(dia); setHistorialOpen(false) }} />
        </Dialog>
      </div>
    </PageShell>
  )
}

const tones = {
  blue: 'bg-blue-50 text-blue-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
} as const

function Section({ title, icon: Icon, tone, children }: { title: string; icon: LucideIcon; tone: keyof typeof tones; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-center gap-2 border-b border-slate-100 px-4 py-3 ${tones[tone]}`}>
        <span className="rounded-md bg-white/70 p-1.5"><Icon size={16} strokeWidth={2} /></span>
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h2>
}

function SummaryCard({ label, value, icon: Icon, tone, prominent, negative }: { label: string; value: string; icon: LucideIcon; tone: keyof typeof tones; prominent?: boolean; negative?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-3.5 shadow-sm ${prominent ? 'border-slate-300' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wide ${tones[tone].split(' ')[1]}`}>
          {label}
        </p>
        <span className={`rounded-md p-1.5 ${tones[tone]}`}><Icon size={16} strokeWidth={2} /></span>
      </div>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${negative ? 'text-slate-950 underline decoration-rose-300 decoration-2 underline-offset-4' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}

function Historial({ historial, fecha, onSelect }: { historial: CajaDiariaResumenDto[]; fecha: string; onSelect: (fecha: string) => void }) {
  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>{['Fecha', 'Ingresos', 'Egresos', 'Resultado', 'Eventos'].map(h => <th key={h} className="px-3 py-3 first:rounded-l-lg last:rounded-r-lg">{h}</th>)}</tr>
          </thead>
          <tbody>
            {historial.map(h => (
              <tr key={h.fecha} className={`border-b border-slate-100 last:border-0 ${h.fecha === fecha ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                <td colSpan={5} className="p-0">
                  <button className="grid w-full grid-cols-5 px-3 py-3 text-left" onClick={() => onSelect(h.fecha)}>
                    <span className="font-medium text-slate-800">{dateLabel(h.fecha)}</span>
                    <span>{formatCurrency(h.totalIngresos)}</span>
                    <span>{formatCurrency(h.totalEgresos)}</span>
                    <span className="font-semibold">{formatCurrency(h.resultado)}</span>
                    <span>{h.cantidadEventosRealizados}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {historial.map(h => (
          <button key={h.fecha} className={`w-full rounded-lg border p-3 text-left ${h.fecha === fecha ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`} onClick={() => onSelect(h.fecha)}>
            <div className="mb-2 font-semibold text-slate-800">{dateLabel(h.fecha)}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
              <span>Ingresos</span><span className="text-right">{formatCurrency(h.totalIngresos)}</span>
              <span>Egresos</span><span className="text-right">{formatCurrency(h.totalEgresos)}</span>
              <span className="font-semibold">Resultado</span><span className="text-right font-semibold">{formatCurrency(h.resultado)}</span>
              <span>Eventos</span><span className="text-right">{h.cantidadEventosRealizados}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ResponsiveTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <div className="rounded-lg bg-slate-50 px-3 py-4 text-sm italic text-slate-500">{empty}</div>

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>{headers.map((header, index) => <th key={header} className={`px-3 py-3 ${index === headers.length - 1 ? 'text-right' : ''}`}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                {row.map((cell, index) => <td key={index} className={`px-3 py-3 text-slate-700 ${index === row.length - 1 ? 'text-right font-medium text-slate-900' : ''}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            {row.map((cell, index) => (
              <div key={headers[index]} className="flex justify-between gap-4 py-0.5 text-sm">
                <span className="text-slate-500">{headers[index]}</span>
                <span className={`text-right ${index === row.length - 1 ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{cell}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
