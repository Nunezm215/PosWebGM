using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using PosWeb.Contracts;
using PosWeb.Domain;

namespace PosWeb.Application.Eventos;

public sealed record EventoDetallePdfResult(byte[] Content, string FileName);

public class EventoDetallePdfService
{
    private readonly IEventoRepository _eventoRepository;
    private readonly IEventoService _eventoService;

    public EventoDetallePdfService(IEventoRepository eventoRepository, IEventoService eventoService)
    {
        _eventoRepository = eventoRepository;
        _eventoService = eventoService;
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<EventoDetallePdfResult?> GenerarAsync(int eventoId, int sucursalId, CancellationToken cancellationToken = default)
    {
        var evento = await _eventoRepository.ObtenerPorIdAsync(eventoId, cancellationToken);
        if (evento is null || evento.ID_SUCURSAL != sucursalId)
            return null;

        var resumen = await _eventoService.ObtenerResumenFinancieroAsync(eventoId, cancellationToken);
        var pagos = (await _eventoService.ListarPagosEventoAsync(eventoId, cancellationToken))
            .Where(p => !p.Anulado)
            .ToList();

        var document = new EventoDetalleDocument(evento, resumen, pagos);
        var fileName = $"Detalle-Reserva-Evento-{evento.ID_EVENTO}-{evento.FECHA:yyyy-MM-dd}.pdf";
        return new EventoDetallePdfResult(document.GeneratePdf(), fileName);
    }

    private sealed class EventoDetalleDocument : IDocument
    {
        private static readonly CultureInfo Argentina = CultureInfo.GetCultureInfo("es-AR");
        private readonly Evento _evento;
        private readonly ResumenFinancieroEventoDto _resumen;
        private readonly IReadOnlyList<PagoEventoDto> _pagos;

        public EventoDetalleDocument(Evento evento, ResumenFinancieroEventoDto resumen, IReadOnlyList<PagoEventoDto> pagos)
        {
            _evento = evento;
            _resumen = resumen;
            _pagos = pagos;
        }

        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

        public void Compose(IDocumentContainer container)
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(32);
                page.DefaultTextStyle(style => style.FontSize(10));

                page.Header().Column(column =>
                {
                    column.Spacing(2);
                    column.Item().Text("GESTOR MULTIEVENTOS").FontSize(11).SemiBold().AlignCenter().FontColor(Colors.Grey.Darken1);
                    column.Item().Text("DETALLE DE RESERVA").FontSize(18).Bold().AlignCenter();
                    column.Item().PaddingTop(4).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                });

                page.Content().PaddingTop(16).Column(column =>
                {
                    column.Spacing(14);
                    column.Item().Component(new SectionCard("DATOS DEL EVENTO", new[]
                    {
                        ("Fecha", _evento.FECHA.ToString("dd/MM/yyyy", Argentina)),
                        ("Horario", $"{_evento.HORA_INICIO:HH:mm} - {_evento.HORA_FIN:HH:mm}"),
                        ("Tipo de evento", _evento.TIPO_EVENTO),
                        ("Cantidad de invitados", _evento.CANTIDAD_INVITADOS.ToString(Argentina)),
                        ("Estado actual", _evento.ESTADO),
                    }));

                    column.Item().Component(new SectionCard("RESERVA", new[]
                    {
                        ("Reservado por", _evento.Cliente.NOMBRE),
                        ("Contacto", FormatearContacto(_evento.Cliente.TELEFONO, _evento.Cliente.MAIL)),
                        ("Salón / sucursal", _evento.Sucursal.DESC_SUCURSAL),
                    }));

                    column.Item().Component(new ResumenCard(_resumen));

                    column.Item().Column(pagosColumn =>
                    {
                        pagosColumn.Spacing(8);
                        pagosColumn.Item().Text("HISTORIAL DE PAGOS").FontSize(12).SemiBold();

                        if (_pagos.Count == 0)
                        {
                            pagosColumn.Item().Text("No hay pagos válidos registrados.").FontColor(Colors.Grey.Darken1);
                            return;
                        }

                        pagosColumn.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(110);
                                columns.RelativeColumn();
                                columns.ConstantColumn(88);
                                columns.RelativeColumn();
                            });

                            table.Header(header =>
                            {
                                HeaderCell(header.Cell(), "Fecha");
                                HeaderCell(header.Cell(), "Medio");
                                HeaderCell(header.Cell(), "Importe");
                                HeaderCell(header.Cell(), "Observación");
                            });

                            foreach (var pago in _pagos)
                            {
                                BodyCell(table.Cell()).Text(FormatearFechaHoraArgentina(pago.FechaRegistro));
                                BodyCell(table.Cell()).Text(pago.MedioPago ?? $"Medio #{pago.MedioPagoId}");
                                BodyCell(table.Cell()).AlignRight().Text(FormatearMonto(pago.Monto));
                                BodyCell(table.Cell()).Text(FormatearDetallePago(pago));
                            }
                        });
                    });
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span($"Detalle de reserva #{_evento.ID_EVENTO} - Página ");
                    text.CurrentPageNumber();
                    text.Span(" de ");
                    text.TotalPages();
                });
            });
        }

        private sealed class SectionCard : IComponent
        {
            private readonly string _title;
            private readonly IReadOnlyList<(string Label, string Value)> _rows;

            public SectionCard(string title, IReadOnlyList<(string Label, string Value)> rows)
            {
                _title = title;
                _rows = rows;
            }

            public void Compose(IContainer container)
            {
                container.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(12).Column(column =>
                {
                    column.Spacing(6);
                    column.Item().Text(_title).FontSize(11).SemiBold().FontColor(Colors.Grey.Darken2);
                    foreach (var row in _rows)
                    {
                        column.Item().Row(rowContainer =>
                        {
                            rowContainer.RelativeItem(2).Text(row.Label).SemiBold();
                            rowContainer.RelativeItem(5).Text(string.IsNullOrWhiteSpace(row.Value) ? "-" : row.Value);
                        });
                    }
                });
            }
        }

        private sealed class ResumenCard : IComponent
        {
            private readonly ResumenFinancieroEventoDto _resumen;

            public ResumenCard(ResumenFinancieroEventoDto resumen)
            {
                _resumen = resumen;
            }

            public void Compose(IContainer container)
            {
                container.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(12).Column(column =>
                {
                    column.Spacing(6);
                    column.Item().Text("RESUMEN ECONÓMICO").FontSize(11).SemiBold().FontColor(Colors.Grey.Darken2);
                    column.Item().Row(row =>
                    {
                        row.RelativeItem(2).Text("Monto base").SemiBold();
                        row.RelativeItem(5).Text(FormatearMonto(_resumen.MontoBase));
                    });
                    column.Item().Row(row =>
                    {
                        row.RelativeItem(2).Text("Cargos extras").SemiBold();
                        row.RelativeItem(5).Text(FormatearMonto(_resumen.TotalExtras));
                    });
                    column.Item().Row(row =>
                    {
                        row.RelativeItem(2).Text("Total final").SemiBold();
                        row.RelativeItem(5).Text(FormatearMonto(_resumen.MontoTotal));
                    });
                    column.Item().Row(row =>
                    {
                        row.RelativeItem(2).Text("Total abonado").SemiBold();
                        row.RelativeItem(5).Text(FormatearMonto(_resumen.TotalPagado));
                    });

                    column.Item().Background(_resumen.SaldoPendiente > 0 ? Colors.Red.Lighten4 : Colors.Green.Lighten4).Border(1).BorderColor(_resumen.SaldoPendiente > 0 ? Colors.Red.Lighten2 : Colors.Green.Lighten2).Padding(10).Row(row =>
                    {
                        row.RelativeItem(2).Text("SALDO PENDIENTE").SemiBold();
                        row.RelativeItem(5).Text(FormatearMonto(_resumen.SaldoPendiente)).SemiBold();
                    });
                });
            }
        }

        private static void HeaderCell(IContainer container, string text)
            => container.Background(Colors.Grey.Lighten4).PaddingVertical(6).PaddingHorizontal(8).Text(text).SemiBold();

        private static IContainer BodyCell(IContainer container)
            => container.BorderBottom(1).BorderColor(Colors.Grey.Lighten3).PaddingVertical(6).PaddingHorizontal(8);

        private static string FormatearFechaHoraArgentina(DateTime fechaUtc)
            => FechaContableArgentina.ALocal(DateTime.SpecifyKind(fechaUtc, DateTimeKind.Utc)).ToString("dd/MM/yyyy HH:mm", Argentina);

        private static string FormatearMonto(decimal monto)
            => $"$ {monto.ToString("N2", Argentina)}";

        private static string FormatearContacto(string? telefono, string? mail)
        {
            var partes = new List<string>();
            if (!string.IsNullOrWhiteSpace(telefono)) partes.Add($"Tel: {telefono.Trim()}");
            if (!string.IsNullOrWhiteSpace(mail)) partes.Add($"Mail: {mail.Trim()}");
            return partes.Count == 0 ? "Sin contacto" : string.Join(" | ", partes);
        }

        private static string FormatearDetallePago(PagoEventoDto pago)
        {
            var partes = new List<string>();
            if (!string.IsNullOrWhiteSpace(pago.Observacion)) partes.Add(pago.Observacion.Trim());
            if (!string.IsNullOrWhiteSpace(pago.ReferenciaExterna)) partes.Add($"Ref: {pago.ReferenciaExterna.Trim()}");
            return partes.Count == 0 ? "-" : string.Join(" · ", partes);
        }
    }
}
