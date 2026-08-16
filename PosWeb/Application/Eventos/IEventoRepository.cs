using PosWeb.Domain;

namespace PosWeb.Application.Eventos;

public interface IEventoRepository
{
    Task<IReadOnlyList<Evento>> ListarAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Evento>> ListarPorRangoAsync(DateOnly fechaDesde, DateOnly fechaHasta, int? sucursalId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Evento>> ListarPorFechaYSucursalAsync(DateOnly fecha, int sucursalId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Evento>> BuscarGlobalAsync(int sucursalId, string query, int limit, CancellationToken cancellationToken = default);
    Task<Evento?> ObtenerPorIdAsync(int eventoId, CancellationToken cancellationToken = default);
    Task AgregarAsync(Evento evento, CancellationToken cancellationToken = default);
    Task ActualizarAsync(Evento evento, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CargoExtraEvento>> ListarCargosExtraAsync(int eventoId, CancellationToken cancellationToken = default);
    Task<CargoExtraEvento?> ObtenerCargoExtraAsync(int cargoId, CancellationToken cancellationToken = default);
    Task AgregarCargoExtraAsync(CargoExtraEvento cargo, CancellationToken cancellationToken = default);
    Task GuardarCambiosAsync(CancellationToken cancellationToken = default);
}
