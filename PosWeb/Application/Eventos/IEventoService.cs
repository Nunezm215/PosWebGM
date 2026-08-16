using PosWeb.Contracts;

namespace PosWeb.Application.Eventos;

public interface IEventoService
{
    Task<EventoDto> CrearEventoAsync(CrearEventoRequestDto request, int usuarioCreadorId, int sucursalId, CancellationToken cancellationToken = default);
    Task<EventoDto> EditarEventoAsync(int eventoId, EditarEventoRequestDto request, CancellationToken cancellationToken = default);
    Task<bool> EstaDisponibleAsync(DateOnly fecha, TimeOnly horaInicio, TimeOnly horaFin, int sucursalId, int? eventoIdIgnorado = null, CancellationToken cancellationToken = default);
    Task<PosWeb.Contracts.DisponibilidadEventoResponseDto> ObtenerDisponibilidadAsync(DateOnly fecha, TimeOnly horaInicio, TimeOnly horaFin, int sucursalId, int? eventoIdIgnorado = null, CancellationToken cancellationToken = default);
    Task<EventoDto?> ObtenerPorIdAsync(int eventoId, int? sucursalId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EventoDto>> ListarAsync(int? sucursalId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EventoDto>> ListarPorRangoAsync(DateOnly fechaDesde, DateOnly fechaHasta, int? sucursalId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<BuscarEventoResponseDto>> BuscarGlobalAsync(int sucursalId, string query, int limit, CancellationToken cancellationToken = default);
    Task<EventoDto> CancelarAsync(int eventoId, CancellationToken cancellationToken = default);
    Task<EventoDto> CambiarEstadoAsync(int eventoId, string estado, CancellationToken cancellationToken = default);
    Task<CargoExtraEventoDto> AgregarCargoExtraAsync(int eventoId, CrearCargoExtraEventoRequestDto request, int usuarioId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CargoExtraEventoDto>> ListarCargosExtraAsync(int eventoId, CancellationToken cancellationToken = default);
    Task AnularCargoExtraAsync(int eventoId, int cargoId, AnularCargoExtraEventoRequestDto request, int usuarioId, CancellationToken cancellationToken = default);
    Task<decimal> CalcularTotalExtrasAsync(int eventoId, CancellationToken cancellationToken = default);
    Task<decimal> CalcularMontoTotalConExtrasAsync(int eventoId, CancellationToken cancellationToken = default);
}
