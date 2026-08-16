using PosWeb.Contracts;
namespace PosWeb.Application.Cajas;
public interface ICajaDiariaService { Task<CajaDiariaDto> ObtenerAsync(DateOnly fecha, CancellationToken cancellationToken = default); }
