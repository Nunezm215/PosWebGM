using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using PosWeb.Contracts;

namespace PosWeb.Application.Cajas;

public class CajaMensualPdfService(ICajaDiariaService cajaService) : ICajaMensualPdfService
{
    private const string Ink = "1F2937";
    private const string Muted = "6B7280";
    private const string Soft = "F3F4F6";
    private const string Line = "D1D5DB";

    public async Task<byte[]> GenerarAsync(int anio, int mes, CancellationToken ct = default)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var mensual = await cajaService.ObtenerMensualAsync(anio, mes, ct);
        var mesLabel = MesLabel(anio, mes);

        var document = Document.Create(container => container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(32);
            page.DefaultTextStyle(x => x.FontSize(9).FontColor(Ink));

            page.Header().Column(header =>
            {
                header.Item().Text("RESUMEN MENSUAL DE CAJA").FontSize(21).Bold();
                header.Item().PaddingTop(2).Text(mesLabel).FontSize(12).Bold().FontColor(Muted);
                header.Item().Text($"Período: {mensual.Desde:dd/MM/yyyy} al {mensual.Hasta:dd/MM/yyyy}").FontColor(Muted).FontSize(10);
                header.Item().PaddingTop(12).LineHorizontal(1).LineColor(Line);
            });

            page.Content().PaddingVertical(18).Column(col =>
            {
                col.Spacing(16);
                Resumen(col, mensual);
                MediosPago(col, mensual);
                Actividad(col, mensual);
                Cierre(col, mensual);
            });

            page.Footer().PaddingTop(8).Row(row =>
            {
                row.RelativeItem().Text($"Resumen mensual de Caja - {mesLabel}").FontSize(8).FontColor(Muted);
                row.AutoItem().Text(text =>
                {
                    text.Span("Página ").FontSize(8).FontColor(Muted);
                    text.CurrentPageNumber().FontSize(8).FontColor(Muted);
                    text.Span(" de ").FontSize(8).FontColor(Muted);
                    text.TotalPages().FontSize(8).FontColor(Muted);
                });
            });
        }));

        return document.GeneratePdf();
    }

    private static void Resumen(ColumnDescriptor col, CajaMensualDto mensual)
    {
        Titulo(col, "RESUMEN DEL MES");
        col.Item().Row(row =>
        {
            Tarjeta(row.RelativeItem(), "INGRESOS", Monto(mensual.TotalIngresos), false);
            row.Spacing(8);
            Tarjeta(row.RelativeItem(), "EGRESOS", Monto(mensual.TotalEgresos), false);
            row.Spacing(8);
            Tarjeta(row.RelativeItem(), "RESULTADO", Monto(mensual.Resultado), mensual.Resultado < 0);
            row.Spacing(8);
            Tarjeta(row.RelativeItem(), "EVENTOS REALIZADOS", mensual.EventosRealizados.ToString(CultureInfo.InvariantCulture), false);
        });
    }

    private static void MediosPago(ColumnDescriptor col, CajaMensualDto mensual)
    {
        Titulo(col, "INGRESOS POR MEDIO DE PAGO");
        if (mensual.IngresosPorMedio.Count == 0)
        {
            Vacio(col, "Sin ingresos registrados.");
            return;
        }

        col.Item().Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(5);
                columns.RelativeColumn(2);
                columns.RelativeColumn(3);
            });

            Encabezado(table, "Medio de pago", "Cantidad", "Total");
            foreach (var item in mensual.IngresosPorMedio)
            {
                Celda(table, item.Descripcion);
                CeldaCentro(table, item.CantidadPagos.ToString(CultureInfo.InvariantCulture));
                CeldaMonto(table, Monto(item.Total));
            }
        });
    }

    private static void Actividad(ColumnDescriptor col, CajaMensualDto mensual)
    {
        Titulo(col, "ACTIVIDAD DEL MES");
        if (mensual.DiasActividad.Count == 0)
        {
            Vacio(col, "Sin actividad registrada durante el período.");
            return;
        }

        foreach (var dia in mensual.DiasActividad)
        {
            col.Item().ShowEntire().Border(1).BorderColor(Line).Padding(10).Column(day =>
            {
                day.Spacing(10);
                day.Item().Text(dia.Fecha.ToString("dd/MM/yyyy")).FontSize(11).Bold().FontColor(Ink);

                if (dia.Eventos.Count > 0)
                {
                    SeccionDia(day, "EVENTOS", table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(42);
                            columns.RelativeColumn(4);
                            columns.RelativeColumn(4);
                            columns.RelativeColumn(2);
                        });
                        Encabezado(table, "Hora", "Cliente", "Tipo de evento", "Estado");
                        foreach (var evento in dia.Eventos)
                        {
                            Celda(table, evento.HoraInicio.ToString("HH:mm"));
                            Celda(table, evento.NombreCliente);
                            Celda(table, evento.TipoEvento);
                            Celda(table, evento.Estado);
                        }
                    });
                }

                if (dia.Ingresos.Count > 0)
                {
                    SeccionDia(day, "INGRESOS / PAGOS", table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(42);
                            columns.RelativeColumn(3);
                            columns.RelativeColumn(3);
                            columns.RelativeColumn(2);
                            columns.RelativeColumn(2);
                        });
                        Encabezado(table, "Hora", "Cliente", "Evento", "Medio", "Monto");
                        foreach (var ingreso in dia.Ingresos)
                        {
                            Celda(table, ingreso.FechaRegistro.ToString("HH:mm"));
                            Celda(table, ingreso.NombreCliente);
                            Celda(table, ingreso.TipoEvento);
                            Celda(table, ingreso.MedioPago);
                            CeldaMonto(table, Monto(ingreso.Monto));
                        }
                    });
                }

                if (dia.Egresos.Count > 0)
                {
                    SeccionDia(day, "EGRESOS", table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(42);
                            columns.RelativeColumn(8);
                            columns.RelativeColumn(3);
                        });
                        Encabezado(table, "Hora", "Concepto", "Monto");
                        foreach (var egreso in dia.Egresos)
                        {
                            Celda(table, egreso.Fecha.ToString("HH:mm"));
                            Celda(table, egreso.Detalle);
                            CeldaMonto(table, Monto(egreso.Monto));
                        }
                    });
                }
            });
        }
    }

    private static void Cierre(ColumnDescriptor col, CajaMensualDto mensual)
    {
        Titulo(col, "CIERRE DEL MES");
        col.Item().Border(1).BorderColor(Line).Padding(12).Column(cierre =>
        {
            FilaCierre(cierre, "Total ingresos", Monto(mensual.TotalIngresos), false);
            FilaCierre(cierre, "Total egresos", Monto(mensual.TotalEgresos), false);
            cierre.Item().PaddingVertical(6).LineHorizontal(1).LineColor(Line);
            FilaCierre(cierre, "Resultado", Monto(mensual.Resultado), true);
            FilaCierre(cierre, "Eventos realizados", mensual.EventosRealizados.ToString(CultureInfo.InvariantCulture), false);
        });
    }

    private static void SeccionDia(ColumnDescriptor col, string titulo, Action<TableDescriptor> buildTable)
    {
        col.Item().PaddingTop(4).Text(titulo).FontSize(10).Bold().FontColor(Ink);
        col.Item().Table(buildTable);
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
    private static string MesLabel(int anio, int mes)
    {
        var raw = new DateTime(anio, mes, 1).ToString("MMMM yyyy", CultureInfo.GetCultureInfo("es-AR"));
        return char.ToUpper(raw[0]) + raw[1..].Replace(" de ", " ");
    }
}
