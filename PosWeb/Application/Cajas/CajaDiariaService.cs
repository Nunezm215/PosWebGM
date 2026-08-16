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
}
