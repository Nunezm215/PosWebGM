using Microsoft.Extensions.Options;

namespace PosWeb.Application.Eventos;

public sealed class DetallePdfStorageOptions
{
    public const string SectionName = "DetallePdfStorage";
    public string BasePath { get; set; } = "data/eventos";
}

public sealed class DetallePdfStorage
{
    private readonly EventoDetallePdfService _pdfService;
    private readonly DetallePdfStorageOptions _options;

    public DetallePdfStorage(EventoDetallePdfService pdfService, IOptions<DetallePdfStorageOptions> options)
    {
        _pdfService = pdfService;
        _options = options.Value;
    }

    public async Task<EventoDetallePdfResult?> RegenerarAsync(int eventoId, int sucursalId, CancellationToken cancellationToken = default)
    {
        var pdf = await _pdfService.GenerarAsync(eventoId, sucursalId, cancellationToken);
        if (pdf is null)
            return null;

        var directory = Path.Combine(_options.BasePath, eventoId.ToString());
        var destination = Path.Combine(directory, "detalle-reserva.pdf");
        var temporary = Path.Combine(directory, $".detalle-reserva-{Guid.NewGuid():N}.tmp");

        Directory.CreateDirectory(directory);
        try
        {
            await File.WriteAllBytesAsync(temporary, pdf.Content, cancellationToken);
            File.Move(temporary, destination, true);
        }
        finally
        {
            if (File.Exists(temporary))
                File.Delete(temporary);
        }

        return pdf;
    }
}
