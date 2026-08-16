using PosWeb.Contracts;
using PosWeb.Domain;

namespace PosWeb.Application.Eventos;

public class EventoService : IEventoService
{
    private readonly IEventoRepository _repository;
    private readonly TimeProvider _timeProvider;
    private static readonly SemaphoreSlim PagoMutex = new(1, 1);

    public EventoService(IEventoRepository repository, TimeProvider? timeProvider = null)
    {
        _repository = repository;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task<EventoDto> CrearEventoAsync(CrearEventoRequestDto request, int usuarioCreadorId, int sucursalId, CancellationToken cancellationToken = default)
    {
        ValidarFechaNoAnteriorAHoy(request.Fecha);
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
        ValidarFechaNoAnteriorAHoy(request.Fecha);
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

    public async Task<DisponibilidadEventoResponseDto> ObtenerDisponibilidadAsync(DateOnly fecha, TimeOnly horaInicio, TimeOnly horaFin, int sucursalId, int? eventoIdIgnorado = null, CancellationToken cancellationToken = default)
    {
        var candidato = new Evento(1, 1, sucursalId, fecha, horaInicio, horaFin, "Temporal", 0, 0m, fechaCreacion: DateTime.UtcNow);
        var eventosExistentes = await _repository.ListarPorFechaYSucursalAsync(fecha, sucursalId, cancellationToken);
        var disponible = EventoDisponibilidad.EstaDisponible(candidato, eventosExistentes, eventoIdIgnorado);

        return new DisponibilidadEventoResponseDto
        {
            Disponible = disponible,
            ProximaHoraDisponible = disponible ? null : EncontrarProximaHoraDisponible(candidato, eventosExistentes, eventoIdIgnorado),
        };
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

    public async Task<IReadOnlyList<BuscarEventoResponseDto>> BuscarGlobalAsync(int sucursalId, string query, int limit, CancellationToken cancellationToken = default)
    {
        ValidarQuery(query);
        var normalizadoLimit = NormalizarLimit(limit);

        var eventos = await _repository.BuscarGlobalAsync(sucursalId, query, normalizadoLimit, cancellationToken);
        return eventos.Select(evento => new BuscarEventoResponseDto
        {
            Id = evento.ID_EVENTO,
            ClienteId = evento.ID_CLIENTE,
            ReservadoPor = evento.Cliente?.NOMBRE ?? $"Cliente #{evento.ID_CLIENTE}",
            Fecha = evento.FECHA,
            HoraInicio = evento.HORA_INICIO,
            HoraFin = evento.HORA_FIN,
            TipoEvento = evento.TIPO_EVENTO,
            Estado = evento.ESTADO,
            CantidadInvitados = evento.CANTIDAD_INVITADOS,
        }).ToList();
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

    public async Task<CargoExtraEventoDto> AgregarCargoExtraAsync(int eventoId, CrearCargoExtraEventoRequestDto request, int usuarioId, CancellationToken cancellationToken = default)
    {
        var evento = await ObtenerEventoRequerido(eventoId, cancellationToken);
        if (evento.ESTADO == EventoEstados.Cancelado) throw new InvalidOperationException("No se pueden agregar cargos extra a un evento cancelado");
        var descripcion = Requerido(request?.Descripcion, "La descripción es requerida", 200);
        if (request!.Monto <= 0) throw new ArgumentException("El monto debe ser mayor a cero", nameof(request.Monto));
        if (usuarioId <= 0) throw new ArgumentException("El usuario es requerido", nameof(usuarioId));

        var cargo = new CargoExtraEvento(eventoId, descripcion, request.Monto, usuarioId);
        await _repository.AgregarCargoExtraAsync(cargo, cancellationToken);
        await SincronizarEstadoFinancieroAsync(evento, cancellationToken);
        return Map(cargo);
    }

    public async Task<IReadOnlyList<CargoExtraEventoDto>> ListarCargosExtraAsync(int eventoId, CancellationToken cancellationToken = default)
    {
        await ObtenerEventoRequerido(eventoId, cancellationToken);
        return (await _repository.ListarCargosExtraAsync(eventoId, cancellationToken)).Select(Map).ToList();
    }

    public async Task AnularCargoExtraAsync(int eventoId, int cargoId, AnularCargoExtraEventoRequestDto request, int usuarioId, CancellationToken cancellationToken = default)
    {
        await ObtenerEventoRequerido(eventoId, cancellationToken);
        var cargo = await _repository.ObtenerCargoExtraAsync(cargoId, cancellationToken) ?? throw new InvalidOperationException("Cargo extra no encontrado");
        if (cargo.ID_EVENTO != eventoId) throw new ArgumentException("El cargo extra no pertenece al evento");
        var motivo = Requerido(request?.Motivo, "El motivo de anulación es requerido", 500);
        if (usuarioId <= 0) throw new ArgumentException("El usuario es requerido", nameof(usuarioId));
        cargo.Anular(usuarioId, motivo);
        await _repository.GuardarCambiosAsync(cancellationToken);
        await SincronizarEstadoFinancieroAsync(await ObtenerEventoRequerido(eventoId, cancellationToken), cancellationToken);
    }

    public async Task<decimal> CalcularTotalExtrasAsync(int eventoId, CancellationToken cancellationToken = default)
    {
        await ObtenerEventoRequerido(eventoId, cancellationToken);
        return (await _repository.ListarCargosExtraAsync(eventoId, cancellationToken)).Where(c => !c.ANULADO).Sum(c => c.MONTO);
    }

    public async Task<decimal> CalcularMontoTotalConExtrasAsync(int eventoId, CancellationToken cancellationToken = default)
    {
        var evento = await ObtenerEventoRequerido(eventoId, cancellationToken);
        return evento.MONTO_TOTAL + await CalcularTotalExtrasAsync(eventoId, cancellationToken);
    }

    public async Task<PagoEventoDto> RegistrarPagoEventoAsync(int eventoId, CrearPagoEventoRequestDto request, int usuarioId, CancellationToken cancellationToken = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (request.Monto <= 0) throw new ArgumentException("El monto debe ser mayor a cero", nameof(request.Monto));
        if (usuarioId <= 0) throw new ArgumentException("El usuario es requerido", nameof(usuarioId));
        var clave = string.IsNullOrWhiteSpace(request.ClaveIdempotencia) ? null : request.ClaveIdempotencia.Trim();
        if (clave?.Length > 150) throw new ArgumentException("La clave de idempotencia excede el máximo permitido");

        await PagoMutex.WaitAsync(cancellationToken);
        try
        {
            if (clave is not null)
            {
                var existente = await _repository.ObtenerPagoPorClaveIdempotenciaAsync(clave, cancellationToken);
                if (existente is not null) return await MapPagoAsync(existente, eventoId, cancellationToken);
            }
            var evento = await ObtenerEventoRequerido(eventoId, cancellationToken);
            if (evento.ESTADO == EventoEstados.Cancelado) throw new InvalidOperationException("No se pueden registrar pagos en un evento cancelado");
            var medio = await _repository.ObtenerMedioPagoAsync(request.MedioPagoId, cancellationToken) ?? throw new InvalidOperationException("Medio de pago no encontrado");
            if (!medio.ACTIVO) throw new InvalidOperationException("El medio de pago está inactivo");
            var resumen = await ObtenerResumenFinancieroInternoAsync(evento, cancellationToken);
            if (request.Monto > resumen.SaldoPendiente) throw new InvalidOperationException("El pago supera el saldo pendiente");
            var pago = new PagoEvento(eventoId, request.MedioPagoId, request.Monto, usuarioId, observacion: NormalizarOpcional(request.Observacion, 500), claveIdempotencia: clave, referenciaExterna: NormalizarOpcional(request.ReferenciaExterna, 200));
            await _repository.AgregarPagoEventoAsync(pago, cancellationToken);
            await SincronizarEstadoFinancieroAsync(evento, cancellationToken);
            return await MapPagoAsync(pago, eventoId, cancellationToken);
        }
        finally { PagoMutex.Release(); }
    }

    public async Task<IReadOnlyList<PagoEventoDto>> ListarPagosEventoAsync(int eventoId, CancellationToken cancellationToken = default)
    {
        await ObtenerEventoRequerido(eventoId, cancellationToken);
        var pagos = await _repository.ListarPagosEventoAsync(eventoId, cancellationToken);
        return await Task.WhenAll(pagos.Select(p => MapPagoAsync(p, eventoId, cancellationToken)));
    }

    public async Task AnularPagoEventoAsync(int eventoId, int pagoId, AnularPagoEventoRequestDto request, int usuarioId, CancellationToken cancellationToken = default)
    {
        await ObtenerEventoRequerido(eventoId, cancellationToken);
        var pago = await _repository.ObtenerPagoEventoAsync(pagoId, cancellationToken) ?? throw new InvalidOperationException("Pago no encontrado");
        if (pago.ID_EVENTO != eventoId) throw new ArgumentException("El pago no pertenece al evento");
        if (usuarioId <= 0) throw new ArgumentException("El usuario es requerido");
        if (FechaContableArgentina.DesdeUtc(pago.FECHA_REGISTRO) != FechaContableArgentina.Actual(_timeProvider))
            throw new InvalidOperationException("El pago solo puede anularse el mismo día en que fue registrado.");
        pago.Anular(usuarioId, Requerido(request?.Motivo, "El motivo de anulación es requerido", 500));
        await _repository.GuardarCambiosAsync(cancellationToken);
        await SincronizarEstadoFinancieroAsync(await ObtenerEventoRequerido(eventoId, cancellationToken), cancellationToken);
    }

    public async Task<ResumenFinancieroEventoDto> ObtenerResumenFinancieroAsync(int eventoId, CancellationToken cancellationToken = default)
        => await ObtenerResumenFinancieroInternoAsync(await ObtenerEventoRequerido(eventoId, cancellationToken), cancellationToken);

    private async Task<ResumenFinancieroEventoDto> ObtenerResumenFinancieroInternoAsync(Evento evento, CancellationToken cancellationToken)
    {
        var extras = (await _repository.ListarCargosExtraAsync(evento.ID_EVENTO, cancellationToken)).Where(c => !c.ANULADO).Sum(c => c.MONTO);
        var activos = (await _repository.ListarPagosEventoAsync(evento.ID_EVENTO, cancellationToken)).Where(p => !p.ANULADO).ToList();
        var total = evento.MONTO_TOTAL + extras; var pagado = activos.Sum(p => p.MONTO); var saldo = total - pagado;
        return new ResumenFinancieroEventoDto { EventoId = evento.ID_EVENTO, MontoBase = evento.MONTO_TOTAL, TotalExtras = extras, MontoTotal = total, TotalPagado = pagado, SaldoPendiente = saldo, EstadoPago = pagado == 0 ? "SinPagos" : saldo == 0 ? "Pagado" : "Señado", CantidadPagosActivos = activos.Count, UltimoPagoFecha = activos.Select(p => (DateTime?)p.FECHA_REGISTRO).Max() };
    }

    private async Task SincronizarEstadoFinancieroAsync(Evento evento, CancellationToken cancellationToken)
    {
        if (evento.ESTADO == EventoEstados.Cancelado) return;
        var resumen = await ObtenerResumenFinancieroInternoAsync(evento, cancellationToken);
        if (resumen.TotalPagado == 0) evento.MarcarReservado();
        else if (resumen.SaldoPendiente == 0) evento.MarcarPagado();
        else evento.MarcarSenado();
        await _repository.GuardarCambiosAsync(cancellationToken);
    }

    private async Task<PagoEventoDto> MapPagoAsync(PagoEvento pago, int eventoId, CancellationToken cancellationToken)
    {
        var resumen = await ObtenerResumenFinancieroAsync(eventoId, cancellationToken);
        var medio = await _repository.ObtenerMedioPagoAsync(pago.ID_MEDIO_PAGO, cancellationToken);
        return new PagoEventoDto { Id = pago.ID_PAGO_EVENTO, EventoId = pago.ID_EVENTO, MedioPagoId = pago.ID_MEDIO_PAGO, MedioPago = medio?.DESC_MEDIO_PAGO, Monto = pago.MONTO, FechaRegistro = pago.FECHA_REGISTRO, Observacion = pago.OBSERVACION, ReferenciaExterna = pago.REFERENCIA_EXTERNA, Anulado = pago.ANULADO, FechaAnulacion = pago.FECHA_ANULACION, MotivoAnulacion = pago.MOTIVO_ANULACION, TipoPago = resumen.SaldoPendiente == 0 ? "PagoTotal" : "Seña" };
    }

    private static string? NormalizarOpcional(string? value, int maxLength) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().Length <= maxLength ? value.Trim() : throw new ArgumentException("El texto excede el máximo permitido");

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

    private async Task<Evento> ObtenerEventoRequerido(int eventoId, CancellationToken cancellationToken)
        => await _repository.ObtenerPorIdAsync(eventoId, cancellationToken) ?? throw new InvalidOperationException("Evento no encontrado");

    private static string Requerido(string? value, string message, int maxLength)
    {
        var normalizado = value?.Trim();
        if (string.IsNullOrWhiteSpace(normalizado) || normalizado.Length > maxLength) throw new ArgumentException(message);
        return normalizado;
    }

    private static CargoExtraEventoDto Map(CargoExtraEvento cargo) => new()
    {
        Id = cargo.ID_CARGO_EXTRA_EVENTO,
        EventoId = cargo.ID_EVENTO,
        Descripcion = cargo.DESCRIPCION,
        Monto = cargo.MONTO,
        FechaRegistro = cargo.FECHA_REGISTRO,
        Anulado = cargo.ANULADO,
        FechaAnulacion = cargo.FECHA_ANULACION,
        MotivoAnulacion = cargo.MOTIVO_ANULACION,
    };

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

    private static void ValidarFechaNoAnteriorAHoy(DateOnly fecha)
    {
        // Se compara contra la fecha local del sistema para respetar el día operativo del salón.
        var hoy = DateOnly.FromDateTime(DateTime.Today);
        if (fecha < hoy)
            throw new ArgumentException("No se puede reservar un evento en una fecha anterior a hoy", nameof(fecha));
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

    private static TimeOnly? EncontrarProximaHoraDisponible(Evento candidato, IReadOnlyList<Evento> eventosExistentes, int? excluirEventoId)
    {
        var duracion = candidato.HORA_FIN.ToTimeSpan() - candidato.HORA_INICIO.ToTimeSpan();
        if (duracion <= TimeSpan.Zero)
            return null;

        var inicioBusquedaMinutos = candidato.HORA_INICIO.Hour * 60 + candidato.HORA_INICIO.Minute;
        var duracionMinutos = (int)duracion.TotalMinutes;
        var endLimitMinutos = 23 * 60 + 59;

        if (inicioBusquedaMinutos > endLimitMinutos)
            return null;

        for (var minutos = inicioBusquedaMinutos; minutos <= endLimitMinutos; minutos += 30)
        {
            var probeFinMinutos = minutos + duracionMinutos;
            if (probeFinMinutos > endLimitMinutos)
                break;

            var probe = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(minutos));
            var probeFin = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(probeFinMinutos));

            var probeEvento = new Evento(1, 1, candidato.ID_SUCURSAL, candidato.FECHA, probe, probeFin, candidato.TIPO_EVENTO, 0, 0m, fechaCreacion: DateTime.UtcNow);
            if (EventoDisponibilidad.EstaDisponible(probeEvento, eventosExistentes, excluirEventoId))
                return probe;
        }

        return null;
    }

    private static void ValidarQuery(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            throw new ArgumentException("Debe ingresar un criterio de búsqueda", nameof(query));
    }

    private static int NormalizarLimit(int limit)
        => limit < 1 ? 10 : Math.Min(limit, 50);
}
