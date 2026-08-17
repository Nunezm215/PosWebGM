namespace PosWeb.Application.Cajas;
public interface ICajaDiariaPdfService { Task<byte[]> GenerarAsync(DateOnly fecha, CancellationToken cancellationToken = default); }
