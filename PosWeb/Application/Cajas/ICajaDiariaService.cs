using PosWeb.Contracts;
namespace PosWeb.Application.Cajas;
public interface ICajaDiariaService { Task<CajaDiariaDto> ObtenerAsync(DateOnly fecha, CancellationToken cancellationToken = default); Task<IReadOnlyList<CajaDiariaResumenDto>> ObtenerHistorialAsync(DateOnly desde, DateOnly hasta, CancellationToken cancellationToken = default); Task<CajaMensualDto> ObtenerMensualAsync(int anio, int mes, CancellationToken cancellationToken = default); }
