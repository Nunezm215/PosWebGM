namespace PosWeb.Application.Cajas;

public interface ICajaMensualPdfService
{
    Task<byte[]> GenerarAsync(int anio, int mes, CancellationToken cancellationToken = default);
}
