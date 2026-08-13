using PosWeb.Application.Eventos;
using PosWeb.Contracts;
using PosWeb.Domain;

namespace PosWeb.Application.Test.Eventos;

public class EventoServiceTests
{
    private static DateOnly Hoy => DateOnly.FromDateTime(DateTime.Today);
    private static DateOnly Fecha(int dias) => Hoy.AddDays(dias);

    private static CrearEventoRequestDto CrearRequest(
        int clienteId = 10,
        DateOnly? fecha = null,
        TimeOnly? horaInicio = null,
        TimeOnly? horaFin = null,
        string tipoEvento = "Cumplea\u00f1os",
        int cantidadInvitados = 50,
        decimal montoTotal = 150000m,
        string? observaciones = "Sin alcohol")
    {
        return new CrearEventoRequestDto
        {
            ClienteId = clienteId,
            Fecha = fecha ?? Hoy,
            HoraInicio = horaInicio ?? new TimeOnly(18, 0),
            HoraFin = horaFin ?? new TimeOnly(22, 0),
            TipoEvento = tipoEvento,
            CantidadInvitados = cantidadInvitados,
            MontoTotal = montoTotal,
            Observaciones = observaciones,
        };
    }

    private static Evento CrearEventoExistente(
        int id,
        int clienteId,
        int sucursalId,
        DateOnly fecha,
        TimeOnly inicio,
        TimeOnly fin,
        string estado = EventoEstados.Reservado)
    {
        var evento = new Evento(clienteId, 99, sucursalId, fecha, inicio, fin, "Evento", 100, 1m, fechaCreacion: new DateTime(2026, 8, 10, 12, 0, 0, DateTimeKind.Utc));
        evento.AsignarId(id);
        if (estado == EventoEstados.Cancelado) evento.Cancelar();
        if (estado == EventoEstados.Señado) evento.MarcarSenado();
        if (estado == EventoEstados.Pagado) evento.MarcarPagado();
        return evento;
    }

    [Fact]
    public async Task CrearEventoAsync_con_datos_validos_crea_evento_reservado()
    {
        var repo = new EventoRepositoryFake();
        var service = new EventoService(repo);

        var dto = await service.CrearEventoAsync(CrearRequest(), usuarioCreadorId: 7, sucursalId: 3);

        Assert.Equal(EventoEstados.Reservado, dto.Estado);
        Assert.Equal(10, dto.ClienteId);
        Assert.Equal(7, dto.UsuarioCreadorId);
        Assert.Equal(3, dto.SucursalId);
        Assert.Equal(Hoy, dto.Fecha);
        Assert.Equal(new TimeOnly(18, 0), dto.HoraInicio);
        Assert.Equal(new TimeOnly(22, 0), dto.HoraFin);
        Assert.Equal("Cumplea\u00f1os", dto.TipoEvento);
        Assert.Equal(50, dto.CantidadInvitados);
        Assert.Equal(150000m, dto.MontoTotal);
        Assert.True(dto.FechaCreacion != default);
    }

    [Fact]
    public async Task CrearEventoAsync_con_fecha_ayer_rechaza()
    {
        var repo = new EventoRepositoryFake();
        var service = new EventoService(repo);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.CrearEventoAsync(CrearRequest(fecha: Fecha(-1)), usuarioCreadorId: 7, sucursalId: 3));

        Assert.Contains("anterior a hoy", ex.Message);
    }

    [Fact]
    public async Task CrearEventoAsync_con_fecha_hoy_permite()
    {
        var repo = new EventoRepositoryFake();
        var service = new EventoService(repo);

        var dto = await service.CrearEventoAsync(CrearRequest(fecha: Hoy), usuarioCreadorId: 7, sucursalId: 3);

        Assert.Equal(Hoy, dto.Fecha);
    }

    [Fact]
    public async Task CrearEventoAsync_con_fecha_manana_permite()
    {
        var repo = new EventoRepositoryFake();
        var service = new EventoService(repo);

        var dto = await service.CrearEventoAsync(CrearRequest(fecha: Fecha(1)), usuarioCreadorId: 7, sucursalId: 3);

        Assert.Equal(Fecha(1), dto.Fecha);
    }

    [Fact]
    public async Task EditarEventoAsync_con_fecha_ayer_rechaza()
    {
        var repo = new EventoRepositoryFake(new[] { CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)) });
        var service = new EventoService(repo);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.EditarEventoAsync(1, new EditarEventoRequestDto
        {
            ClienteId = 10,
            Fecha = Fecha(-1),
            HoraInicio = new TimeOnly(18, 0),
            HoraFin = new TimeOnly(22, 0),
            TipoEvento = "Cumpleaños",
            CantidadInvitados = 50,
            MontoTotal = 150000m,
            Observaciones = null,
        }));

        Assert.Contains("anterior a hoy", ex.Message);
    }

    [Fact]
    public async Task EditarEventoAsync_con_fecha_hoy_permite()
    {
        var repo = new EventoRepositoryFake(new[] { CrearEventoExistente(1, 10, 3, Hoy.AddDays(-2), new TimeOnly(18, 0), new TimeOnly(22, 0)) });
        var service = new EventoService(repo);

        var dto = await service.EditarEventoAsync(1, new EditarEventoRequestDto
        {
            ClienteId = 10,
            Fecha = Hoy,
            HoraInicio = new TimeOnly(18, 0),
            HoraFin = new TimeOnly(22, 0),
            TipoEvento = "Cumpleaños",
            CantidadInvitados = 50,
            MontoTotal = 150000m,
            Observaciones = null,
        });

        Assert.Equal(Hoy, dto.Fecha);
    }

    [Fact]
    public void Evento_con_hora_fin_igual_a_inicio_es_invalido()
    {
        var ex = Assert.Throws<ArgumentException>(() => new Evento(10, 7, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(18, 0), "Cumplea\u00f1os", 50, 150000m));
        Assert.Contains("horaFin", ex.Message);
    }

    [Fact]
    public void Evento_con_hora_fin_menor_a_inicio_es_invalido()
    {
        var ex = Assert.Throws<ArgumentException>(() => new Evento(10, 7, 3, Hoy, new TimeOnly(22, 0), new TimeOnly(21, 30), "Cumplea\u00f1os", 50, 150000m));
        Assert.Contains("horaFin", ex.Message);
    }

    [Fact]
    public void Evento_con_tipo_vacio_es_invalido()
    {
        Assert.Throws<ArgumentException>(() => new Evento(10, 7, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0), string.Empty, 50, 150000m));
    }

    [Fact]
    public void Evento_con_cantidad_negativa_es_invalido()
    {
        Assert.Throws<ArgumentException>(() => new Evento(10, 7, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0), "Cumplea\u00f1os", -1, 150000m));
    }

    [Fact]
    public void Evento_con_monto_negativo_es_invalido()
    {
        Assert.Throws<ArgumentException>(() => new Evento(10, 7, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0), "Cumplea\u00f1os", 50, -1m));
    }

    [Fact]
    public async Task Superposicion_directa_genera_conflicto()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)),
        });
        var service = new EventoService(repo);

        var disponible = await service.EstaDisponibleAsync(Hoy, new TimeOnly(20, 0), new TimeOnly(21, 0), 3);

        Assert.False(disponible);
    }

    [Fact]
    public async Task Margen_de_29_minutos_despues_genera_conflicto()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)),
        });
        var service = new EventoService(repo);

        var disponible = await service.EstaDisponibleAsync(Hoy, new TimeOnly(22, 29), new TimeOnly(23, 30), 3);

        Assert.False(disponible);
    }

    [Fact]
    public async Task Margen_exacto_de_30_minutos_despues_es_permitido()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)),
        });
        var service = new EventoService(repo);

        var disponible = await service.EstaDisponibleAsync(Hoy, new TimeOnly(22, 30), new TimeOnly(23, 30), 3);

        Assert.True(disponible);
    }

    [Fact]
    public async Task Margen_exacto_de_30_minutos_antes_es_permitido()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)),
        });
        var service = new EventoService(repo);

        var disponible = await service.EstaDisponibleAsync(Hoy, new TimeOnly(16, 30), new TimeOnly(17, 30), 3);

        Assert.True(disponible);
    }

    [Fact]
    public async Task Evento_cancelado_no_bloquea_y_cancelar_async_lo_marca_cancelado()
    {
        var evento = CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0));
        var repo = new EventoRepositoryFake(new[] { evento });
        var service = new EventoService(repo);

        var cancelado = await service.CancelarAsync(1);
        Assert.Equal(EventoEstados.Cancelado, cancelado.Estado);

        var disponible = await service.EstaDisponibleAsync(Hoy, new TimeOnly(20, 0), new TimeOnly(21, 0), 3);
        Assert.True(disponible);
    }

    [Fact]
    public async Task Eventos_de_otra_fecha_no_bloquean()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)),
        });
        var service = new EventoService(repo);

        var disponible = await service.EstaDisponibleAsync(Hoy.AddDays(1), new TimeOnly(18, 0), new TimeOnly(22, 0), 3);

        Assert.True(disponible);
    }

    [Fact]
    public async Task Dos_eventos_claramente_separados_son_permitidos()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)),
        });
        var service = new EventoService(repo);

        var disponible = await service.EstaDisponibleAsync(Hoy, new TimeOnly(23, 5), new TimeOnly(23, 30), 3);

        Assert.True(disponible);
    }

    [Fact]
    public async Task Proxima_disponibilidad_devuelve_null_si_esta_libre()
    {
        var repo = new EventoRepositoryFake();
        var service = new EventoService(repo);

        var disponibilidad = await service.ObtenerDisponibilidadAsync(Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0), 3);

        Assert.True(disponibilidad.Disponible);
        Assert.Null(disponibilidad.ProximaHoraDisponible);
    }

    [Fact]
    public async Task Proxima_disponibilidad_busca_siguiente_hueco_respetando_30_minutos_y_duracion()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(8, 0), new TimeOnly(9, 30)),
        });
        var service = new EventoService(repo);

        var disponibilidad = await service.ObtenerDisponibilidadAsync(Hoy, new TimeOnly(8, 0), new TimeOnly(10, 0), 3);

        Assert.False(disponibilidad.Disponible);
        Assert.Equal(new TimeOnly(10, 0), disponibilidad.ProximaHoraDisponible);
    }

    [Fact]
    public async Task Caso_manual_0800_a_1000_devuelve_la_siguiente_franga_disponible_del_mismo_dia()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(8, 0), new TimeOnly(9, 30)),
        });
        var service = new EventoService(repo);

        var disponibilidad = await service.ObtenerDisponibilidadAsync(Hoy, new TimeOnly(8, 0), new TimeOnly(10, 0), 3);

        Assert.False(disponibilidad.Disponible);
        Assert.Equal(new TimeOnly(10, 0), disponibilidad.ProximaHoraDisponible);
    }

    [Fact]
    public async Task Proxima_disponibilidad_no_debe_sumar_margen_dos_veces()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(8, 0), new TimeOnly(9, 30)),
        });
        var service = new EventoService(repo);

        var disponibilidad = await service.ObtenerDisponibilidadAsync(Hoy, new TimeOnly(8, 0), new TimeOnly(10, 0), 3);

        Assert.Equal(new TimeOnly(10, 0), disponibilidad.ProximaHoraDisponible);
        Assert.NotEqual(new TimeOnly(10, 30), disponibilidad.ProximaHoraDisponible);
    }

    [Fact]
    public async Task Proxima_disponibilidad_salta_eventos_consecutivos_y_considera_cancelados()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(8, 0), new TimeOnly(9, 30)),
            CrearEventoExistente(2, 10, 3, Hoy, new TimeOnly(12, 30), new TimeOnly(15, 0)),
            CrearEventoExistente(3, 10, 3, Hoy, new TimeOnly(23, 0), new TimeOnly(23, 30), EventoEstados.Cancelado),
        });
        var service = new EventoService(repo);

        var disponibilidad = await service.ObtenerDisponibilidadAsync(Hoy, new TimeOnly(10, 0), new TimeOnly(12, 0), 3);

        Assert.True(disponibilidad.Disponible);
        Assert.Null(disponibilidad.ProximaHoraDisponible);
    }

    [Fact]
    public async Task Edicion_no_colisiona_con_si_mismo_y_proxima_disponibilidad_lo_respeta()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)),
        });
        var service = new EventoService(repo);

        var disponibilidad = await service.ObtenerDisponibilidadAsync(Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0), 3, eventoIdIgnorado: 1);

        Assert.True(disponibilidad.Disponible);
        Assert.Null(disponibilidad.ProximaHoraDisponible);
    }

    [Fact]
    public async Task Sin_hueco_valido_devuelve_proxima_nula()
    {
        var repo = new EventoRepositoryFake(new[]
        {
            CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(8, 0), new TimeOnly(20, 30)),
            CrearEventoExistente(2, 10, 3, Hoy, new TimeOnly(21, 0), new TimeOnly(23, 59)),
        });
        var service = new EventoService(repo);

        var disponibilidad = await service.ObtenerDisponibilidadAsync(Hoy, new TimeOnly(8, 0), new TimeOnly(10, 0), 3);

        Assert.False(disponibilidad.Disponible);
        Assert.Null(disponibilidad.ProximaHoraDisponible);
    }

    private sealed class EventoRepositoryFake : IEventoRepository
    {
        private readonly List<Evento> _eventos;
        private int _nextId;

        public EventoRepositoryFake(IEnumerable<Evento>? seed = null)
        {
            _eventos = seed?.ToList() ?? new List<Evento>();
            _nextId = _eventos.Count == 0 ? 1 : _eventos.Max(e => e.ID_EVENTO) + 1;
        }

        public Task<IReadOnlyList<Evento>> ListarAsync(CancellationToken cancellationToken = default)
            => Task.FromResult((IReadOnlyList<Evento>)_eventos.ToList());

        public Task<IReadOnlyList<Evento>> ListarPorRangoAsync(DateOnly fechaDesde, DateOnly fechaHasta, int? sucursalId = null, CancellationToken cancellationToken = default)
        {
            var filtrados = _eventos.Where(e => e.FECHA >= fechaDesde && e.FECHA <= fechaHasta);
            if (sucursalId.HasValue)
                filtrados = filtrados.Where(e => e.ID_SUCURSAL == sucursalId.Value);
            return Task.FromResult((IReadOnlyList<Evento>)filtrados.OrderBy(e => e.FECHA).ThenBy(e => e.HORA_INICIO).ToList());
        }

        public Task<IReadOnlyList<Evento>> ListarPorFechaYSucursalAsync(DateOnly fecha, int sucursalId, CancellationToken cancellationToken = default)
            => Task.FromResult((IReadOnlyList<Evento>)_eventos
                .Where(e => e.FECHA == fecha && e.ID_SUCURSAL == sucursalId)
                .OrderBy(e => e.HORA_INICIO)
                .ToList());

        public Task<Evento?> ObtenerPorIdAsync(int eventoId, CancellationToken cancellationToken = default)
            => Task.FromResult(_eventos.FirstOrDefault(e => e.ID_EVENTO == eventoId));

        public Task AgregarAsync(Evento evento, CancellationToken cancellationToken = default)
        {
            if (evento.ID_EVENTO <= 0)
                evento.AsignarId(_nextId++);
            _eventos.Add(evento);
            return Task.CompletedTask;
        }

        public Task ActualizarAsync(Evento evento, CancellationToken cancellationToken = default)
        {
            var index = _eventos.FindIndex(e => e.ID_EVENTO == evento.ID_EVENTO);
            if (index >= 0)
                _eventos[index] = evento;
            return Task.CompletedTask;
        }
    }
}
