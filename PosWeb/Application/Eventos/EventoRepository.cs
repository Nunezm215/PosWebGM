using Microsoft.EntityFrameworkCore;
using PosWeb.Data;
using PosWeb.Domain;

namespace PosWeb.Application.Eventos;

public class EventoRepository : IEventoRepository
{
    private readonly PosDbContextLocal _context;

    public EventoRepository(PosDbContextLocal context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Evento>> ListarAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Evento
            .Include(e => e.Cliente)
            .Include(e => e.UsuarioCreador)
            .Include(e => e.Sucursal)
            .OrderBy(e => e.FECHA)
            .ThenBy(e => e.HORA_INICIO)
            .ThenBy(e => e.ID_EVENTO)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Evento>> ListarPorRangoAsync(DateOnly fechaDesde, DateOnly fechaHasta, int? sucursalId = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Evento
            .Include(e => e.Cliente)
            .Include(e => e.UsuarioCreador)
            .Include(e => e.Sucursal)
            .Where(e => e.FECHA >= fechaDesde && e.FECHA <= fechaHasta);

        if (sucursalId.HasValue)
            query = query.Where(e => e.ID_SUCURSAL == sucursalId.Value);

        return await query
            .OrderBy(e => e.FECHA)
            .ThenBy(e => e.HORA_INICIO)
            .ThenBy(e => e.ID_EVENTO)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Evento>> ListarPorFechaYSucursalAsync(DateOnly fecha, int sucursalId, CancellationToken cancellationToken = default)
        => await _context.Evento
            .Include(e => e.Cliente)
            .Include(e => e.UsuarioCreador)
            .Include(e => e.Sucursal)
            .Where(e => e.FECHA == fecha && e.ID_SUCURSAL == sucursalId)
            .OrderBy(e => e.HORA_INICIO)
            .ThenBy(e => e.ID_EVENTO)
            .ToListAsync(cancellationToken);

    public Task<Evento?> ObtenerPorIdAsync(int eventoId, CancellationToken cancellationToken = default)
        => _context.Evento
            .Include(e => e.Cliente)
            .Include(e => e.UsuarioCreador)
            .Include(e => e.Sucursal)
            .FirstOrDefaultAsync(e => e.ID_EVENTO == eventoId, cancellationToken);

    public async Task AgregarAsync(Evento evento, CancellationToken cancellationToken = default)
    {
        await _context.Evento.AddAsync(evento, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task ActualizarAsync(Evento evento, CancellationToken cancellationToken = default)
    {
        await _context.SaveChangesAsync(cancellationToken);
    }
}
