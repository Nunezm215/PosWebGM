using PosWeb.Contracts;
using PosWeb.Domain;

namespace PosWeb.Application.Eventos;

public class EventoService : IEventoService
{
    private readonly IEventoRepository _repository;

    public EventoService(IEventoRepository repository)
    {
        _repository = repository;
    }

    public async Task<EventoDto> CrearEventoAsync(CrearEventoRequestDto request, int usuarioCreadorId, int sucursalId, CancellationToken cancellationToken = default)
    {
        ValidarRequest(request);

        var evento = new Evento(
            request.ClienteId,
            usuarioCreadorId,
            sucursalId,
            request.Fecha,
            request.HoraInicio,
            request.HoraFin,
            request.TipoEvento,
            request.CantidadInvitados,
            request.MontoTotal,
            request.Observaciones);

        var eventosExistentes = await _repository.ListarPorFechaYSucursalAsync(request.Fecha, sucursalId, cancellationToken);
        if (!EventoDisponibilidad.EstaDisponible(evento, eventosExistentes))
            throw new InvalidOperationException("El evento no está disponible en ese horario");

        await _repository.AgregarAsync(evento, cancellationToken);
        return Map(evento);
    }

    public async Task<EventoDto> EditarEventoAsync(int eventoId, EditarEventoRequestDto request, CancellationToken cancellationToken = default)
    {
        ValidarRequest(request);

        var evento = await _repository.ObtenerPorIdAsync(eventoId, cancellationToken)
            ?? throw new InvalidOperationException("Evento no encontrado");

        evento.Editar(
            request.ClienteId,
            request.Fecha,
            request.HoraInicio,
            request.HoraFin,
            request.TipoEvento,
            request.CantidadInvitados,
            request.MontoTotal,
            request.Observaciones);

        var eventosExistentes = await _repository.ListarPorFechaYSucursalAsync(evento.FECHA, evento.ID_SUCURSAL, cancellationToken);
        if (!EventoDisponibilidad.EstaDisponible(evento, eventosExistentes, eventoId))
            throw new InvalidOperationException("El evento no está disponible en ese horario");

        await _repository.ActualizarAsync(evento, cancellationToken);
        return Map(evento);
    }

    public async Task<bool> EstaDisponibleAsync(DateOnly fecha, TimeOnly horaInicio, TimeOnly horaFin, int sucursalId, int? eventoIdIgnorado = null, CancellationToken cancellationToken = default)
    {
        var candidato = new Evento(1, 1, sucursalId, fecha, horaInicio, horaFin, "Temporal", 0, 0m, fechaCreacion: DateTime.UtcNow);
        var eventosExistentes = await _repository.ListarPorFechaYSucursalAsync(fecha, sucursalId, cancellationToken);
        return EventoDisponibilidad.EstaDisponible(candidato, eventosExistentes, eventoIdIgnorado);
    }

    public async Task<EventoDto?> ObtenerPorIdAsync(int eventoId, int? sucursalId = null, CancellationToken cancellationToken = default)
    {
        var evento = await _repository.ObtenerPorIdAsync(eventoId, cancellationToken);
        if (evento == null)
            return null;

        if (sucursalId.HasValue && evento.ID_SUCURSAL != sucursalId.Value)
            return null;

        return evento == null ? null : Map(evento);
    }

    public async Task<IReadOnlyList<EventoDto>> ListarAsync(int? sucursalId = null, CancellationToken cancellationToken = default)
    {
        var eventos = await _repository.ListarAsync(cancellationToken);
        if (sucursalId.HasValue)
            eventos = eventos.Where(e => e.ID_SUCURSAL == sucursalId.Value).ToList();

        return eventos.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<EventoDto>> ListarPorRangoAsync(DateOnly fechaDesde, DateOnly fechaHasta, int? sucursalId = null, CancellationToken cancellationToken = default)
    {
        if (fechaHasta < fechaDesde)
            throw new ArgumentException("fechaHasta no puede ser menor a fechaDesde", nameof(fechaHasta));

        var eventos = await _repository.ListarPorRangoAsync(fechaDesde, fechaHasta, sucursalId, cancellationToken);
        return eventos.Select(Map).ToList();
    }

    public async Task<EventoDto> CancelarAsync(int eventoId, CancellationToken cancellationToken = default)
    {
        var evento = await _repository.ObtenerPorIdAsync(eventoId, cancellationToken)
            ?? throw new InvalidOperationException("Evento no encontrado");

        evento.Cancelar();
        await _repository.ActualizarAsync(evento, cancellationToken);
        return Map(evento);
    }

    public async Task<EventoDto> CambiarEstadoAsync(int eventoId, string estado, CancellationToken cancellationToken = default)
    {
        if (!EventoEstados.Todos.Contains(estado))
            throw new ArgumentException("Estado de evento inválido", nameof(estado));

        var evento = await _repository.ObtenerPorIdAsync(eventoId, cancellationToken)
            ?? throw new InvalidOperationException("Evento no encontrado");

        switch (estado)
        {
            case EventoEstados.Reservado:
                evento.MarcarReservado();
                break;
            case EventoEstados.Señado:
                evento.MarcarSenado();
                break;
            case EventoEstados.Pagado:
                evento.MarcarPagado();
                break;
            case EventoEstados.Cancelado:
                evento.Cancelar();
                break;
        }

        await _repository.ActualizarAsync(evento, cancellationToken);
        return Map(evento);
    }

    private static void ValidarRequest(CrearEventoRequestDto request)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        _ = new Evento(
            request.ClienteId,
            1,
            1,
            request.Fecha,
            request.HoraInicio,
            request.HoraFin,
            request.TipoEvento,
            request.CantidadInvitados,
            request.MontoTotal,
            request.Observaciones,
            fechaCreacion: DateTime.UtcNow);
    }

    private static void ValidarRequest(EditarEventoRequestDto request)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        _ = new Evento(
            request.ClienteId,
            1,
            1,
            request.Fecha,
            request.HoraInicio,
            request.HoraFin,
            request.TipoEvento,
            request.CantidadInvitados,
            request.MontoTotal,
            request.Observaciones,
            fechaCreacion: DateTime.UtcNow);
    }

    private static EventoDto Map(Evento evento)
    {
        return new EventoDto
        {
            Id = evento.ID_EVENTO,
            ClienteId = evento.ID_CLIENTE,
            UsuarioCreadorId = evento.ID_USUARIO_CREADOR,
            SucursalId = evento.ID_SUCURSAL,
            Fecha = evento.FECHA,
            HoraInicio = evento.HORA_INICIO,
            HoraFin = evento.HORA_FIN,
            TipoEvento = evento.TIPO_EVENTO,
            CantidadInvitados = evento.CANTIDAD_INVITADOS,
            MontoTotal = evento.MONTO_TOTAL,
            Observaciones = evento.OBSERVACIONES,
            Estado = evento.ESTADO,
            FechaCreacion = evento.FECHA_CREACION,
        };
    }
}
