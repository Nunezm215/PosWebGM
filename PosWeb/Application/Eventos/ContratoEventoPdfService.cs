using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PosWeb.Application.Eventos;

public sealed record ContratoEventoPdfResult(byte[] Content, string FileName);

public class ContratoEventoPdfService
{
    private readonly IEventoRepository _eventoRepository;
    private readonly IEventoService _eventoService;
    private readonly PosDbContextLocal _context;

    public ContratoEventoPdfService(IEventoRepository eventoRepository, IEventoService eventoService, PosDbContextLocal context)
    {
        _eventoRepository = eventoRepository;
        _eventoService = eventoService;
        _context = context;
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<ContratoEventoPdfResult?> GenerarAsync(int eventoId, int sucursalId, CancellationToken cancellationToken = default)
    {
        var evento = await _eventoRepository.ObtenerPorIdAsync(eventoId, cancellationToken);
        if (evento is null || evento.ID_SUCURSAL != sucursalId)
            return null;

        var salonNombre = await ObtenerNombreSalonAsync(evento, cancellationToken);
        var resumen = await _eventoService.ObtenerResumenFinancieroAsync(eventoId, cancellationToken);
        var pdf = new ContratoEventoDocument(evento, salonNombre, resumen).GeneratePdf();
        var fileName = $"Contrato-Evento-{evento.ID_EVENTO}-{evento.FECHA:yyyy-MM-dd}.pdf";
        return new ContratoEventoPdfResult(pdf, fileName);
    }

    private async Task<string?> ObtenerNombreSalonAsync(Evento evento, CancellationToken cancellationToken)
    {
        var empresaNombre = await _context.Empresa.Where(e => e.ID_EMPRESA == evento.Sucursal.ID_EMPRESA)
            .Select(e => e.NOMBRE).FirstOrDefaultAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(empresaNombre)) return empresaNombre.Trim();
        return string.IsNullOrWhiteSpace(evento.Sucursal.DESC_SUCURSAL) ? null : evento.Sucursal.DESC_SUCURSAL.Trim();
    }

    private sealed class ContratoEventoDocument : IDocument
    {
        private readonly Evento _evento;
        private readonly string? _salonNombre;
        private readonly ResumenFinancieroEventoDto _resumen;

        public ContratoEventoDocument(Evento evento, string? salonNombre, ResumenFinancieroEventoDto resumen)
        {
            _evento = evento;
            _salonNombre = salonNombre;
            _resumen = resumen;
        }

        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

        public void Compose(IDocumentContainer container)
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.DefaultTextStyle(style => style.FontSize(9));
                page.Header().Column(column =>
                {
                    column.Spacing(3);
                    column.Item().Text(ContratoEventoTemplate.Titulo).FontSize(16).SemiBold().AlignCenter();
                    if (!string.IsNullOrWhiteSpace(_salonNombre))
                        column.Item().Text(_salonNombre!).FontSize(11).SemiBold().AlignCenter().FontColor(Colors.Grey.Darken1);
                    if (_evento.ESTADO == EventoEstados.Cancelado)
                        column.Item().AlignCenter().Text("EVENTO CANCELADO").FontSize(10).SemiBold().FontColor(Colors.Red.Darken2);
                    column.Item().PaddingTop(3).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                });

                page.Content().PaddingTop(10).Column(column =>
                {
                    column.Spacing(8);
                    column.Item().Component(new KeyValueBlock("DATOS DEL CLIENTE", new (string Label, string Value)[]
                    {
                        ("Cliente", _evento.Cliente.NOMBRE),
                        ("DNI", _evento.Cliente.NRO_DOCUMENTO ?? "-"),
                        ("Teléfono", _evento.Cliente.TELEFONO ?? "-"),
                    }));
                    column.Item().Component(new KeyValueBlock("DATOS DEL EVENTO", new[]
                    {
                        ("Fecha", _evento.FECHA.ToString("dd/MM/yyyy")),
                        ("Tipo de evento", _evento.TIPO_EVENTO),
                        ("Horario", $"{_evento.HORA_INICIO:HH:mm} a {_evento.HORA_FIN:HH:mm}"),
                        ("Mayores", _evento.CANTIDAD_MAYORES.ToString()),
                        ("Menores", _evento.CANTIDAD_MENORES.ToString()),
                        ("Total invitados", _evento.CANTIDAD_INVITADOS.ToString()),
                    }));

                    var economia = new List<(string Label, string Value)>
                    {
                        ("Valor total del evento", FormatearImporte(_resumen.MontoTotal)),
                        ("Total abonado", FormatearImporte(_resumen.TotalPagado)),
                        ("Saldo pendiente", FormatearImporte(_resumen.SaldoPendiente)),
                    };
                    if (_resumen.TotalExtras != 0) economia.Add(("Adicionales vigentes", FormatearImporte(_resumen.TotalExtras)));
                    column.Item().Component(new KeyValueBlock("INFORMACIÓN ECONÓMICA", economia));
                    column.Item().Component(new ConditionsBlock("CONDICIONES DE RESERVA Y PAGO", ContratoEventoTemplate.CondicionesReservaYPago));
                    column.Item().Component(new ConditionsBlock("CONDICIONES GENERALES", ContratoEventoTemplate.CondicionesGenerales));
                    column.Item().PaddingTop(4).Column(signColumn =>
                    {
                        signColumn.Spacing(8);
                        signColumn.Item().Text("Firma del cliente: __________________________");
                        signColumn.Item().Text("Aclaración: _________________________________");
                        signColumn.Item().Text("DNI: _______________________________________");
                        signColumn.Item().Text("Firma responsable: __________________________");
                    });
                });
                page.Footer().AlignCenter().Text($"Contrato de Evento #{_evento.ID_EVENTO}").FontSize(8).FontColor(Colors.Grey.Darken1);
            });
        }

        private static string FormatearImporte(decimal importe) => $"$ {importe.ToString("N2", CultureInfo.GetCultureInfo("es-AR"))}";

        private sealed class KeyValueBlock : IComponent
        {
            private readonly string _title;
            private readonly IReadOnlyList<(string Label, string Value)> _rows;
            public KeyValueBlock(string title, IReadOnlyList<(string Label, string Value)> rows) => (_title, _rows) = (title, rows);

            public void Compose(IContainer container)
            {
                container.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(7).Column(column =>
                {
                    column.Spacing(2);
                    column.Item().Text(_title).FontSize(10).SemiBold();
                    foreach (var row in _rows)
                        column.Item().Row(rowContainer =>
                        {
                            rowContainer.RelativeItem(2).Text(row.Label).SemiBold();
                            rowContainer.RelativeItem(5).Text(row.Value);
                        });
                });
            }
        }

        private sealed class ConditionsBlock : IComponent
        {
            private readonly string _title;
            private readonly IReadOnlyList<string> _conditions;
            public ConditionsBlock(string title, IReadOnlyList<string> conditions) => (_title, _conditions) = (title, conditions);

            public void Compose(IContainer container)
            {
                container.Column(column =>
                {
                    column.Spacing(3);
                    column.Item().Text(_title).FontSize(10).SemiBold();
                    foreach (var condition in _conditions) column.Item().Text(condition).LineHeight(1.15f);
                });
            }
        }
    }
}
