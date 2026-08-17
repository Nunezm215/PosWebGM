using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
namespace PosWeb.Application.Cajas;
public class CajaDiariaPdfService(ICajaDiariaService cajaService) : ICajaDiariaPdfService
{
 public async Task<byte[]> GenerarAsync(DateOnly fecha, CancellationToken ct = default)
 {
  QuestPDF.Settings.License = LicenseType.Community;
  var caja=await cajaService.ObtenerAsync(fecha,ct);
  var document = Document.Create(container => container.Page(page =>
  {
   page.Size(PageSizes.A4); page.Margin(28); page.DefaultTextStyle(x => x.FontSize(10));
   page.Content().Column(col =>
   {
    col.Spacing(8); col.Item().Text("CAJA DIARIA").Bold().FontSize(20); col.Item().Text($"Fecha: {fecha:dd/MM/yyyy}");
    col.Item().Row(r => { r.RelativeItem().Text($"INGRESOS\n${caja.TotalIngresos:N2}").Bold(); r.RelativeItem().Text($"EGRESOS\n${caja.TotalEgresos:N2}").Bold(); r.RelativeItem().Text($"RESULTADO\n${caja.Resultado:N2}").Bold(); r.RelativeItem().Text($"EVENTOS\n{caja.CantidadEventosRealizados}").Bold(); });
    Seccion(col,"INGRESOS POR MEDIO DE PAGO",caja.DesgloseMediosPago.Select(x=>$"{x.Descripcion} | {x.CantidadPagos} pagos | ${x.Total:N2}")); Seccion(col,"INGRESOS DEL DÍA",caja.Ingresos.Select(x=>$"{x.FechaRegistro:HH:mm} | {x.NombreCliente} | {x.TipoEvento} | {x.MedioPago} | ${x.Monto:N2}")); Seccion(col,"EGRESOS DEL DÍA",caja.Egresos.Select(x=>$"{x.Fecha:HH:mm} | {x.Detalle} | ${x.Monto:N2}")); Seccion(col,"EVENTOS DEL DÍA",caja.EventosRealizados.Select(x=>$"{x.HoraInicio:HH\\:mm} | {x.NombreCliente} | {x.TipoEvento} | {x.Estado}"));
    col.Item().Text($"TOTAL INGRESOS: ${caja.TotalIngresos:N2}\nTOTAL EGRESOS: ${caja.TotalEgresos:N2}\nRESULTADO DEL DÍA: ${caja.Resultado:N2}").Bold();
   });
  }));
  return document.GeneratePdf();
 }
 private static void Seccion(ColumnDescriptor col,string titulo,IEnumerable<string> lineas){col.Item().Text(titulo).Bold();var items=lineas.ToList();if(items.Count==0)col.Item().Text("Sin movimientos.");else foreach(var linea in items)col.Item().Text(linea);}
}
