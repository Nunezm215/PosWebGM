import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { PageShell } from '../components/shared'
import type { CajaDiariaDto, CajaDiariaResumenDto } from '../types'
import { formatCurrency } from '../formats'
import Dialog from '../components/ui/Dialog'

const today = () => new Date().toISOString().slice(0, 10)
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('es-AR')

export default function CajaPage() {
  const [fecha, setFecha] = useState(today)
  const [caja, setCaja] = useState<CajaDiariaDto | null>(null)
  const [historial, setHistorial] = useState<CajaDiariaResumenDto[]>([])
  const [error, setError] = useState('')
  const [gastoOpen, setGastoOpen] = useState(false)
  const [detalle, setDetalle] = useState('')
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [abriendoPdf, setAbriendoPdf] = useState(false)
  const cargar = async (dia = fecha) => { try { setError(''); const desde = new Date(`${dia}T00:00:00`); desde.setDate(desde.getDate() - 29); const [detalleCaja, items] = await Promise.all([api.cajaDiaria.obtener(dia), api.cajaDiaria.historial(desde.toISOString().slice(0, 10), dia)]); setCaja(detalleCaja); setHistorial([...items].reverse()) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la caja.') } }
  useEffect(() => { cargar() }, [fecha])
  const cerrarGasto = () => { if (!guardando) { setGastoOpen(false); setDetalle(''); setMonto(''); setError('') } }
  const registrar = async () => { if (!detalle.trim() || Number(monto) <= 0) { setError('Detalle y monto válido son requeridos.'); return } setGuardando(true); try { await api.gastos.crearSimple({ detalle: detalle.trim(), monto: Number(monto) }); const hoy = today(); setFecha(hoy); setDetalle(''); setMonto(''); setGastoOpen(false); await cargar(hoy) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar el gasto.') } finally { setGuardando(false) } }
  const abrirPdf = async () => { const ventana = window.open('', '_blank'); setAbriendoPdf(true); try { const { blob } = await api.cajaDiaria.obtenerPdf(fecha); const url = URL.createObjectURL(blob); if (ventana) ventana.location.href = url; else window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000) } catch (e) { ventana?.close(); setError(e instanceof Error ? e.message : 'No se pudo generar el PDF de Caja.') } finally { setAbriendoPdf(false) } }
  return <PageShell title="Caja" subtitle="Resumen diario de ingresos y egresos" error={error} onErrorClose={() => setError('')}>
    <div className="space-y-6"><div className="flex flex-wrap gap-2"><input aria-label="Fecha de caja" type="date" value={fecha} onChange={e => { if (e.target.value) setFecha(e.target.value) }} className="rounded-lg border px-3 py-2" /><button className="rounded-lg border px-4 py-2" onClick={abrirPdf} disabled={abriendoPdf}>{abriendoPdf ? 'Abriendo PDF...' : 'Abrir PDF del día'}</button></div>
    {caja && <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Ingresos',caja.totalIngresos],['Egresos',caja.totalEgresos],['Resultado',caja.resultado],['Eventos realizados',caja.cantidadEventosRealizados]].map(([l,v]) => <div key={String(l)} className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold text-gray-500">{l}</p><p className="text-xl font-bold">{typeof v === 'number' && l !== 'Eventos realizados' ? formatCurrency(v) : v}</p></div>)}</div>
    <button className="rounded-lg bg-indigo-600 px-4 py-2 text-white" onClick={() => setGastoOpen(true)}>Registrar gasto</button>
    <Section title="Por medio de pago">{caja.desgloseMediosPago.map(m => <p key={m.descripcion}>{m.descripcion}: {formatCurrency(m.total)} ({m.cantidadPagos} pagos)</p>)}</Section>
    <Section title="Ingresos del día">{caja.ingresos.length ? caja.ingresos.map((i,n) => <p key={n}>{new Date(i.fechaRegistro).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})} · {i.nombreCliente} · {i.tipoEvento} · {i.medioPago} · {formatCurrency(i.monto)}</p>) : 'No hay ingresos registrados en esta fecha.'}</Section>
    <Section title="Egresos del día">{caja.egresos.length ? caja.egresos.map((g,n) => <p key={n}>{new Date(g.fecha).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})} · {g.detalle} · {formatCurrency(g.monto)}</p>) : 'No hay egresos registrados en esta fecha.'}</Section>
    <Section title="Eventos del día">{caja.eventosRealizados.map((e,n) => <p key={n}>{e.horaInicio.slice(0,5)} · {e.nombreCliente} · {e.tipoEvento} · {e.estado}</p>)}</Section>
    <Section title="Historial últimos 30 días">{historial.map(h => <button key={h.fecha} className="block w-full border-b py-2 text-left" onClick={() => setFecha(h.fecha)}>{dateLabel(h.fecha)} · {formatCurrency(h.totalIngresos)} · {formatCurrency(h.totalEgresos)} · {formatCurrency(h.resultado)} · {h.cantidadEventosRealizados} eventos</button>)}</Section></>}
    <Dialog open={gastoOpen} onClose={cerrarGasto} title="Registrar gasto" width="sm" footer={<><button className="rounded border px-3 py-2" onClick={cerrarGasto} disabled={guardando}>Cancelar</button><button className="rounded bg-indigo-600 px-3 py-2 text-white" onClick={registrar} disabled={guardando}>{guardando ? 'Registrando...' : 'Registrar gasto'}</button></>}><div className="space-y-3"><input aria-label="Detalle gasto" value={detalle} onChange={e=>setDetalle(e.target.value)} placeholder="Detalle" className="w-full border p-2"/><input aria-label="Monto gasto" type="number" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="Monto" className="w-full border p-2"/>{error && <p className="text-sm text-red-700">{error}</p>}</div></Dialog></div>
  </PageShell>
}
function Section({title,children}:{title:string;children:React.ReactNode}) { return <section className="rounded-xl border bg-white p-4"><h2 className="mb-2 font-bold">{title}</h2>{children}</section> }
