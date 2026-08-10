using PosWeb.Domain;

namespace PosWeb.Application.Eventos;

public interface IEventoRepository
{
    Task<IReadOnlyList<Evento>> ListarAsync(CancellationToken cancellationToken = default);
    Task<Evento?> ObtenerPorIdAsync(int eventoId, CancellationToken cancellationToken = default);
    Task AgregarAsync(Evento evento, CancellationToken cancellationToken = default);
    Task ActualizarAsync(Evento evento, CancellationToken cancellationToken = default);
}
