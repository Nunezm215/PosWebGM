using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using PosWeb.Contracts;
using PosWeb.Application.Eventos;

namespace PosWeb.Application.Cajas;

public class CajaDiariaPdfService(ICajaDiariaService cajaService) : ICajaDiariaPdfService
{
    private const string Ink = "1F2937";
    private const string Muted = "6B7280";
    private const string Soft = "F3F4F6";
    private const string Line = "D1D5DB";

    public async Task<byte[]> GenerarAsync(DateOnly fecha, CancellationToken ct = default)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var caja = await cajaService.ObtenerAsync(fecha, ct);

        var document = Document.Create(container => container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(32);
            page.DefaultTextStyle(x => x.FontSize(9).FontColor(Ink));
            page.Header().Column(header =>
            {
                header.Item().Text("CAJA DIARIA").FontSize(21).Bold();
                header.Item().PaddingTop(2).Text($"Fecha: {fecha:dd/MM/yyyy}").FontColor(Muted).FontSize(10);
                header.Item().PaddingTop(12).LineHorizontal(1).LineColor(Line);
            });
            page.Content().PaddingVertical(18).Column(col =>
            {
                col.Spacing(16);
                Resumen(col, caja);
                MediosPago(col, caja);
                Ingresos(col, caja);
                Egresos(col, caja);
                Eventos(col, caja);
                Cierre(col, caja);
            });
            page.Footer().PaddingTop(8).Row(row =>
            {
                row.RelativeItem().Text($"Caja diaria - {fecha:dd/MM/yyyy}").FontSize(8).FontColor(Muted);
                row.AutoItem().Text(text => { text.Span("Página ").FontSize(8).FontColor(Muted); text.CurrentPageNumber().FontSize(8).FontColor(Muted); text.Span(" de ").FontSize(8).FontColor(Muted); text.TotalPages().FontSize(8).FontColor(Muted); });
            });
        }));
        return document.GeneratePdf();
    }

    private static void Resumen(ColumnDescriptor col, CajaDiariaDto caja)
    {
        Titulo(col, "RESUMEN DEL DÍA");
        col.Item().Row(row =>
        {
            Tarjeta(row.RelativeItem(), "INGRESOS", Monto(caja.TotalIngresos), false);
            row.Spacing(8);
            Tarjeta(row.RelativeItem(), "EGRESOS", Monto(caja.TotalEgresos), false);
            row.Spacing(8);
            Tarjeta(row.RelativeItem(), "RESULTADO", Monto(caja.Resultado), caja.Resultado < 0);
            row.Spacing(8);
            Tarjeta(row.RelativeItem(), "EVENTOS", caja.CantidadEventosRealizados.ToString(CultureInfo.InvariantCulture), false);
        });
    }

    private static void MediosPago(ColumnDescriptor col, CajaDiariaDto caja)
    {
        Titulo(col, "INGRESOS POR MEDIO DE PAGO");
        if (caja.DesgloseMediosPago.Count == 0) { Vacio(col, "Sin ingresos registrados."); return; }
        col.Item().Table(table =>
        {
            table.ColumnsDefinition(columns => { columns.RelativeColumn(5); columns.RelativeColumn(2); columns.RelativeColumn(3); });
            Encabezado(table, "Medio de pago", "Cantidad", "Total");
            foreach (var item in caja.DesgloseMediosPago)
            {
                Celda(table, item.Descripcion); CeldaCentro(table, item.CantidadPagos.ToString(CultureInfo.InvariantCulture)); CeldaMonto(table, Monto(item.Total));
            }
        });
    }

    private static void Ingresos(ColumnDescriptor col, CajaDiariaDto caja)
    {
        Titulo(col, "DETALLE DE INGRESOS");
        if (caja.Ingresos.Count == 0) { Vacio(col, "Sin ingresos registrados."); return; }
        col.Item().Table(table =>
        {
            table.ColumnsDefinition(columns => { columns.ConstantColumn(42); columns.RelativeColumn(3); columns.RelativeColumn(3); columns.RelativeColumn(2); columns.RelativeColumn(2); });
            Encabezado(table, "Hora", "Cliente", "Evento", "Medio", "Monto");
            foreach (var item in caja.Ingresos)
            {
                Celda(table, FechaContableArgentina.ALocal(item.FechaRegistro).ToString("HH:mm")); Celda(table, item.NombreCliente); Celda(table, item.TipoEvento); Celda(table, item.MedioPago); CeldaMonto(table, Monto(item.Monto));
            }
        });
    }

    private static void Egresos(ColumnDescriptor col, CajaDiariaDto caja)
    {
        Titulo(col, "DETALLE DE EGRESOS");
        if (caja.Egresos.Count == 0) { Vacio(col, "Sin egresos registrados."); return; }
        col.Item().Table(table =>
        {
            table.ColumnsDefinition(columns => { columns.ConstantColumn(42); columns.RelativeColumn(8); columns.RelativeColumn(3); });
            Encabezado(table, "Hora", "Concepto", "Monto");
            foreach (var item in caja.Egresos)
            {
                Celda(table, FechaContableArgentina.ALocal(item.Fecha).ToString("HH:mm")); Celda(table, item.Detalle); CeldaMonto(table, Monto(item.Monto));
            }
        });
    }

    private static void Eventos(ColumnDescriptor col, CajaDiariaDto caja)
    {
        Titulo(col, "EVENTOS REALIZADOS");
        if (caja.EventosRealizados.Count == 0) { Vacio(col, "Sin eventos registrados."); return; }
        col.Item().Table(table =>
        {
            table.ColumnsDefinition(columns => { columns.ConstantColumn(42); columns.RelativeColumn(4); columns.RelativeColumn(4); columns.RelativeColumn(2); });
            Encabezado(table, "Hora", "Cliente", "Tipo de evento", "Estado");
            foreach (var item in caja.EventosRealizados)
            {
                Celda(table, item.HoraInicio.ToString("HH:mm")); Celda(table, item.NombreCliente); Celda(table, item.TipoEvento); Celda(table, item.Estado);
            }
        });
    }

    private static void Cierre(ColumnDescriptor col, CajaDiariaDto caja)
    {
        Titulo(col, "CIERRE DEL DÍA");
        col.Item().Border(1).BorderColor(Line).Padding(12).Column(cierre =>
        {
            FilaCierre(cierre, "Total ingresos", Monto(caja.TotalIngresos), false);
            FilaCierre(cierre, "Total egresos", Monto(caja.TotalEgresos), false);
            cierre.Item().PaddingVertical(6).LineHorizontal(1).LineColor(Line);
            FilaCierre(cierre, "Resultado del día", Monto(caja.Resultado), true);
        });
    }

    private static void Titulo(ColumnDescriptor col, string texto) => col.Item().ShowEntire().Text(texto).FontSize(11).Bold().FontColor(Ink);
    private static void Vacio(ColumnDescriptor col, string texto) => col.Item().Background(Soft).Padding(9).Text(texto).Italic().FontColor(Muted);
    private static void Tarjeta(IContainer container, string etiqueta, string valor, bool negativo) => container.Border(1).BorderColor(negativo ? "9CA3AF" : Line).Background(Soft).Padding(9).Column(card => { card.Item().Text(etiqueta).FontSize(7).Bold().FontColor(Muted); card.Item().PaddingTop(4).Text(valor).FontSize(12).Bold().FontColor(Ink); });
    private static void Encabezado(TableDescriptor table, params string[] textos) { table.Header(header => { foreach (var texto in textos) header.Cell().Background(Soft).PaddingVertical(7).PaddingHorizontal(6).Text(texto).FontSize(8).Bold().FontColor(Muted); }); }
    private static void Celda(TableDescriptor table, string texto) => table.Cell().BorderBottom(1).BorderColor(Line).PaddingVertical(6).PaddingHorizontal(6).Text(texto);
    private static void CeldaCentro(TableDescriptor table, string texto) => table.Cell().BorderBottom(1).BorderColor(Line).PaddingVertical(6).PaddingHorizontal(6).AlignCenter().Text(texto);
    private static void CeldaMonto(TableDescriptor table, string texto) => table.Cell().BorderBottom(1).BorderColor(Line).PaddingVertical(6).PaddingHorizontal(6).AlignRight().Text(texto);
    private static void FilaCierre(ColumnDescriptor col, string etiqueta, string valor, bool destacado) => col.Item().Row(row =>
    {
        var label = row.RelativeItem().Text(etiqueta);
        if (destacado) label.Bold();
        row.AutoItem().Text(valor).Bold().FontSize(destacado ? 12 : 10);
    });
    private static string Monto(decimal monto) => monto.ToString("$ #,##0.00", CultureInfo.GetCultureInfo("es-AR"));
}
