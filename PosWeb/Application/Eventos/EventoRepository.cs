using System.Globalization;
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

    public async Task<IReadOnlyList<Evento>> BuscarGlobalAsync(int sucursalId, string query, int limit, CancellationToken cancellationToken = default)
    {
        var normalized = Normalize(query);
        var dateFilters = GetDateFilters(query);
        var today = DateOnly.FromDateTime(DateTime.Today);

        IQueryable<Evento> baseQuery = _context.Evento
            .Include(e => e.Cliente)
            .Where(e => e.ID_SUCURSAL == sucursalId);

        baseQuery = baseQuery.Where(e =>
            (e.Cliente != null && e.Cliente.NOMBRE.ToLower().Contains(normalized)) ||
            e.TIPO_EVENTO.ToLower().Contains(normalized) ||
            e.ESTADO.ToLower().Contains(normalized) ||
            dateFilters.Contains(e.FECHA));

        var future = await baseQuery
            .Where(e => e.FECHA >= today)
            .OrderBy(e => e.FECHA)
            .ThenBy(e => e.HORA_INICIO)
            .ThenBy(e => e.ID_EVENTO)
            .Take(limit)
            .ToListAsync(cancellationToken);

        if (future.Count >= limit)
            return future;

        var remaining = limit - future.Count;
        var past = await baseQuery
            .Where(e => e.FECHA < today)
            .OrderByDescending(e => e.FECHA)
            .ThenByDescending(e => e.HORA_INICIO)
            .ThenByDescending(e => e.ID_EVENTO)
            .Take(remaining)
            .ToListAsync(cancellationToken);

        future.AddRange(past);
        return future;
    }

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

    public async Task<IReadOnlyList<CargoExtraEvento>> ListarCargosExtraAsync(int eventoId, CancellationToken cancellationToken = default)
        => await _context.CargoExtraEvento.Where(c => c.ID_EVENTO == eventoId).OrderBy(c => c.FECHA_REGISTRO).ThenBy(c => c.ID_CARGO_EXTRA_EVENTO).ToListAsync(cancellationToken);

    public Task<CargoExtraEvento?> ObtenerCargoExtraAsync(int cargoId, CancellationToken cancellationToken = default)
        => _context.CargoExtraEvento.FirstOrDefaultAsync(c => c.ID_CARGO_EXTRA_EVENTO == cargoId, cancellationToken);

    public async Task AgregarCargoExtraAsync(CargoExtraEvento cargo, CancellationToken cancellationToken = default)
    {
        await _context.CargoExtraEvento.AddAsync(cargo, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public Task GuardarCambiosAsync(CancellationToken cancellationToken = default)
        => _context.SaveChangesAsync(cancellationToken);

    private static string Normalize(string value)
        => value.Trim().ToLowerInvariant();

    private static HashSet<DateOnly> GetDateFilters(string query)
    {
        var result = new HashSet<DateOnly>();
        var formats = new[] { "dd/MM/yyyy", "yyyy-MM-dd" };

        foreach (var part in query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (DateOnly.TryParseExact(part, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                result.Add(parsed);
        }

        return result;
    }
}
