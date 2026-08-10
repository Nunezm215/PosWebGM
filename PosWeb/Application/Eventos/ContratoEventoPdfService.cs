using System.Globalization;
using Microsoft.EntityFrameworkCore;
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
    private readonly PosDbContextLocal _context;

    public ContratoEventoPdfService(IEventoRepository eventoRepository, PosDbContextLocal context)
    {
        _eventoRepository = eventoRepository;
        _context = context;
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<ContratoEventoPdfResult?> GenerarAsync(int eventoId, int sucursalId, CancellationToken cancellationToken = default)
    {
        var evento = await _eventoRepository.ObtenerPorIdAsync(eventoId, cancellationToken);
        if (evento is null || evento.ID_SUCURSAL != sucursalId)
            return null;

        var salonNombre = await ObtenerNombreSalonAsync(evento, cancellationToken);
        var document = new ContratoEventoDocument(evento, salonNombre);
        var pdf = document.GeneratePdf();
        var fileName = $"Contrato-Evento-{evento.ID_EVENTO}-{evento.FECHA:yyyy-MM-dd}.pdf";
        return new ContratoEventoPdfResult(pdf, fileName);
    }

    private async Task<string?> ObtenerNombreSalonAsync(Evento evento, CancellationToken cancellationToken)
    {
        var empresaNombre = await _context.Empresa
            .Where(e => e.ID_EMPRESA == evento.Sucursal.ID_EMPRESA)
            .Select(e => e.NOMBRE)
            .FirstOrDefaultAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(empresaNombre))
            return empresaNombre.Trim();

        if (!string.IsNullOrWhiteSpace(evento.Sucursal.DESC_SUCURSAL))
            return evento.Sucursal.DESC_SUCURSAL.Trim();

        return null;
    }

    private sealed class ContratoEventoDocument : IDocument
    {
        private readonly Evento _evento;
        private readonly string? _salonNombre;

        public ContratoEventoDocument(Evento evento, string? salonNombre)
        {
            _evento = evento;
            _salonNombre = salonNombre;
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
                    column.Spacing(4);
                    column.Item().Text(ContratoEventoTemplate.Titulo)
                        .FontSize(16).SemiBold().AlignCenter();

                    if (!string.IsNullOrWhiteSpace(_salonNombre))
                        column.Item().Text(_salonNombre!).FontSize(11).SemiBold().AlignCenter().FontColor(Colors.Grey.Darken1);

                    if (_evento.ESTADO == EventoEstados.Cancelado)
                    {
                        column.Item().AlignCenter().Text("EVENTO CANCELADO")
                            .FontSize(10).SemiBold().FontColor(Colors.Red.Darken2);
                    }

                    column.Item().PaddingTop(4).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                });

                page.Content().PaddingTop(16).Column(column =>
                {
                    column.Spacing(14);

                    column.Item().Text($"Contrato de Evento #{_evento.ID_EVENTO}")
                        .FontSize(13).SemiBold();

                    column.Item().Component(new KeyValueBlock("DATOS DEL CONTRATANTE", new[]
                    {
                        ("Nombre", _evento.Cliente.NOMBRE),
                        ("Documento", $"{_evento.Cliente.TIPO_DOCUMENTO} {_evento.Cliente.NRO_DOCUMENTO}"),
                        ("Teléfono", _evento.Cliente.TELEFONO ?? "-"),
                        ("Domicilio", _evento.Cliente.DOMICILIO ?? "-"),
                        ("Email", _evento.Cliente.MAIL ?? "-"),
                    }));

                    column.Item().Component(new KeyValueBlock("DATOS DEL EVENTO", new[]
                    {
                        ("Fecha", _evento.FECHA.ToString("dd/MM/yyyy")),
                        ("Horario", $"{_evento.HORA_INICIO:HH:mm} - {_evento.HORA_FIN:HH:mm}"),
                        ("Tipo de evento", _evento.TIPO_EVENTO),
                        ("Cantidad estimada de invitados", _evento.CANTIDAD_INVITADOS.ToString()),
                        ("Monto total acordado", $"$ {_evento.MONTO_TOTAL.ToString("N2", CultureInfo.GetCultureInfo("es-AR"))}"),
                        ("Estado", _evento.ESTADO),
                    }));

                    column.Item().Column(textColumn =>
                    {
                        textColumn.Spacing(6);
                        textColumn.Item().Text("CLÁUSULAS GENERALES").FontSize(12).SemiBold();

                        foreach (var clause in ContratoEventoTemplate.Clausulas)
                        {
                            textColumn.Item().Text(clause).LineHeight(1.25f);
                        }
                    });

                    column.Item().Column(obsColumn =>
                    {
                        obsColumn.Spacing(4);
                        obsColumn.Item().Text("OBSERVACIONES DEL EVENTO").FontSize(12).SemiBold();
                        obsColumn.Item().Text(string.IsNullOrWhiteSpace(_evento.OBSERVACIONES) ? "Sin observaciones." : _evento.OBSERVACIONES!).LineHeight(1.25f);
                    });

                    column.Item().PaddingTop(8).Column(signColumn =>
                    {
                        signColumn.Spacing(18);
                        signColumn.Item().Text("Lugar y fecha: ___________________________");
                        signColumn.Item().Text("Firma EL CONTRATANTE: ___________________________");
                        signColumn.Item().Text("Aclaración: ___________________________");
                        signColumn.Item().Text("DNI: ___________________________");
                        signColumn.Item().PaddingTop(4).Text("Firma responsable EL SALÓN: ___________________________");
                        signColumn.Item().Text("Aclaración: ___________________________");
                    });
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span($"Contrato de Evento #{_evento.ID_EVENTO} — Página ");
                    text.CurrentPageNumber();
                    text.Span(" de ");
                    text.TotalPages();
                });
            });
        }

        private sealed class KeyValueBlock : IComponent
        {
            private readonly string _title;
            private readonly IReadOnlyList<(string Label, string Value)> _rows;

            public KeyValueBlock(string title, IReadOnlyList<(string Label, string Value)> rows)
            {
                _title = title;
                _rows = rows;
            }

            public void Compose(IContainer container)
            {
                container.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(10).Column(column =>
                {
                    column.Spacing(4);
                    column.Item().Text(_title).FontSize(11).SemiBold();
                    foreach (var row in _rows)
                    {
                        column.Item().Row(rowContainer =>
                        {
                            rowContainer.RelativeItem(2).Text(row.Label).SemiBold();
                            rowContainer.RelativeItem(5).Text(row.Value);
                        });
                    }
                });
            }
        }
    }
}
