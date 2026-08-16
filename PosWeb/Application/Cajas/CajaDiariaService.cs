using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Eventos;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;
namespace PosWeb.Application.Cajas;
public class CajaDiariaService(PosDbContextLocal context) : ICajaDiariaService
{
 public async Task<CajaDiariaDto> ObtenerAsync(DateOnly fecha, CancellationToken ct = default)
 {
  var sucursales = await context.Sucursal.Where(s => s.ACTIVO).ToListAsync(ct); if (sucursales.Count != 1) throw new InvalidOperationException("Se esperaba una única sucursal activa."); var sucursal = sucursales[0];
  var pagos = await context.PagoEvento.Where(p => !p.ANULADO && p.ID_EVENTO > 0).ToListAsync(ct); var eventos = await context.Evento.Include(e=>e.Cliente).Where(e=>e.ID_SUCURSAL==sucursal.ID_SUCURSAL).ToListAsync(ct); var medios=await context.MedioPago.ToListAsync(ct);
  var ingresos=pagos.Join(eventos,p=>p.ID_EVENTO,e=>e.ID_EVENTO,(p,e)=>new{p,e}).Where(x=>FechaContableArgentina.DesdeUtc(x.p.FECHA_REGISTRO)==fecha).Select(x=>new IngresoCajaDiariaDto{IdPagoEvento=x.p.ID_PAGO_EVENTO,FechaRegistro=x.p.FECHA_REGISTRO,EventoId=x.e.ID_EVENTO,TipoEvento=x.e.TIPO_EVENTO,ClienteId=x.e.ID_CLIENTE,NombreCliente=x.e.Cliente.NOMBRE,MedioPagoId=x.p.ID_MEDIO_PAGO,MedioPago=medios.FirstOrDefault(m=>m.ID_MEDIO_PAGO==x.p.ID_MEDIO_PAGO)?.DESC_MEDIO_PAGO??"",Monto=x.p.MONTO,Observacion=x.p.OBSERVACION,ReferenciaExterna=x.p.REFERENCIA_EXTERNA}).ToList();
  var gastos=(await context.Gasto.Where(g=>!g.ANULADO&&g.ID_SUCURSAL==sucursal.ID_SUCURSAL).ToListAsync(ct)).Where(g=>FechaContableArgentina.DesdeUtc(g.FECHA_GASTO)==fecha).Select(g=>new EgresoCajaDiariaDto{IdGasto=g.ID_GASTO,Fecha=g.FECHA_GASTO,Detalle=g.DETALLE,Monto=g.MONTO,UsuarioId=g.ID_USUARIO}).ToList();
  var realizados=eventos.Where(e=>e.FECHA==fecha&&e.ESTADO!=EventoEstados.Cancelado).Select(e=>new EventoRealizadoCajaDto{EventoId=e.ID_EVENTO,Fecha=e.FECHA,HoraInicio=e.HORA_INICIO,TipoEvento=e.TIPO_EVENTO,ClienteId=e.ID_CLIENTE,NombreCliente=e.Cliente.NOMBRE,Estado=e.ESTADO}).ToList();
  return new CajaDiariaDto{Fecha=fecha,Ingresos=ingresos,Egresos=gastos,EventosRealizados=realizados,CantidadEventosRealizados=realizados.Count,TotalIngresos=ingresos.Sum(i=>i.Monto),TotalEgresos=gastos.Sum(g=>g.Monto),Resultado=ingresos.Sum(i=>i.Monto)-gastos.Sum(g=>g.Monto),DesgloseMediosPago=ingresos.GroupBy(i=>new{i.MedioPagoId,i.MedioPago}).Select(g=>new MedioPagoCajaDto{MedioPagoId=g.Key.MedioPagoId,Descripcion=g.Key.MedioPago,Total=g.Sum(x=>x.Monto),CantidadPagos=g.Count()}).ToList()};
 }
 public async Task<IReadOnlyList<CajaDiariaResumenDto>> ObtenerHistorialAsync(DateOnly desde, DateOnly hasta, CancellationToken ct = default)
 {
  if (desde>hasta) throw new ArgumentException("La fecha desde no puede ser posterior a hasta."); if (hasta.DayNumber-desde.DayNumber>365) throw new ArgumentException("El rango máximo es de 366 días.");
  var sucursales=await context.Sucursal.Where(s=>s.ACTIVO).ToListAsync(ct); if(sucursales.Count!=1) throw new InvalidOperationException("Se esperaba una única sucursal activa."); var id=sucursales[0].ID_SUCURSAL;
  var eventos=await context.Evento.Where(e=>e.ID_SUCURSAL==id).ToListAsync(ct); var ids=eventos.Select(e=>e.ID_EVENTO).ToList(); var pagos=await context.PagoEvento.Where(p=>!p.ANULADO&&ids.Contains(p.ID_EVENTO)).ToListAsync(ct); var gastos=await context.Gasto.Where(g=>!g.ANULADO&&g.ID_SUCURSAL==id).ToListAsync(ct);
  var ingresos=pagos.GroupBy(p=>FechaContableArgentina.DesdeUtc(p.FECHA_REGISTRO)).ToDictionary(g=>g.Key,g=>g.Sum(x=>x.MONTO)); var egresos=gastos.GroupBy(g=>FechaContableArgentina.DesdeUtc(g.FECHA_GASTO)).ToDictionary(g=>g.Key,g=>g.Sum(x=>x.MONTO)); var realizados=eventos.Where(e=>e.ESTADO!=EventoEstados.Cancelado&&e.FECHA>=desde&&e.FECHA<=hasta).GroupBy(e=>e.FECHA).ToDictionary(g=>g.Key,g=>g.Count());
  var resultado=new List<CajaDiariaResumenDto>(); for(var dia=desde;dia<=hasta;dia=dia.AddDays(1)){ingresos.TryGetValue(dia,out var i);egresos.TryGetValue(dia,out var e);realizados.TryGetValue(dia,out var c);resultado.Add(new CajaDiariaResumenDto{Fecha=dia,TotalIngresos=i,TotalEgresos=e,Resultado=i-e,CantidadEventosRealizados=c});} return resultado;
 }
}
