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

    private static Cliente CrearCliente(int id, string nombre)
    {
        var cliente = new Cliente(nombre, "DNI", $"{id:00000000}", telefono: "11111111", mail: $"cliente{id}@correo.com");
        PosWeb.Testing.TestHelpers.SetId(cliente, id, "ID_CLIENTE");
        return cliente;
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

    [Fact]
    public async Task BuscarGlobalAsync_busca_por_cliente_tipo_estado_fecha_y_respeta_limit()
    {
        var clienteJuan = CrearCliente(10, "Juan Perez");
        var clienteMaria = CrearCliente(11, "Maria Lopez");

        var eventoFuturo = CrearEventoExistente(1, clienteJuan.ID_CLIENTE, 3, Hoy.AddMonths(1), new TimeOnly(18, 0), new TimeOnly(20, 0));
        eventoFuturo.Editar(clienteJuan.ID_CLIENTE, Hoy.AddMonths(1), new TimeOnly(18, 0), new TimeOnly(20, 0), "Cumpleanos", 50, 100m);

        var eventoHistorico = CrearEventoExistente(2, clienteMaria.ID_CLIENTE, 3, Hoy.AddMonths(-1), new TimeOnly(18, 0), new TimeOnly(20, 0), EventoEstados.Cancelado);
        eventoHistorico.Editar(clienteMaria.ID_CLIENTE, Hoy.AddMonths(-1), new TimeOnly(18, 0), new TimeOnly(20, 0), "Casamiento", 30, 200m);
        eventoHistorico.Cancelar();

        var repo = new EventoRepositoryFake(new[] { eventoFuturo, eventoHistorico }, new[] { clienteJuan, clienteMaria });
        var service = new EventoService(repo);

        var porCliente = await service.BuscarGlobalAsync(3, "juan", 10);
        Assert.Single(porCliente);
        Assert.Equal("Juan Perez", porCliente[0].ReservadoPor);

        var porTipo = await service.BuscarGlobalAsync(3, "cumple", 10);
        Assert.Single(porTipo);
        Assert.Equal("Cumpleanos", porTipo[0].TipoEvento);

        var porEstado = await service.BuscarGlobalAsync(3, "cancelado", 10);
        Assert.Single(porEstado);
        Assert.Equal(EventoEstados.Cancelado, porEstado[0].Estado);

        var porFecha = await service.BuscarGlobalAsync(3, Hoy.AddMonths(1).ToString("dd/MM/yyyy"), 10);
        Assert.Single(porFecha);

        var porFechaIso = await service.BuscarGlobalAsync(3, Hoy.AddMonths(1).ToString("yyyy-MM-dd"), 10);
        Assert.Single(porFechaIso);

        var trimCase = await service.BuscarGlobalAsync(3, "   JUAN   ", 10);
        Assert.Single(trimCase);

        var otroMes = await service.BuscarGlobalAsync(3, "lopez", 10);
        Assert.Single(otroMes);

        var limitado = await service.BuscarGlobalAsync(3, "juan", 1);
        Assert.Single(limitado);
    }

    [Fact]
    public async Task Cargo_extra_suma_total_sin_modificar_monto_base()
    {
        var evento = CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0));
        var repo = new EventoRepositoryFake(new[] { evento });
        var service = new EventoService(repo);
        await service.AgregarCargoExtraAsync(1, new CrearCargoExtraEventoRequestDto { Descripcion = " Pool ", Monto = 50000m }, 99);

        var cargo = Assert.Single(await service.ListarCargosExtraAsync(1));
        Assert.Equal("Pool", cargo.Descripcion);
        Assert.False(cargo.Anulado);
        Assert.Equal(50000m, await service.CalcularTotalExtrasAsync(1));
        Assert.Equal(50001m, await service.CalcularMontoTotalConExtrasAsync(1));
        Assert.Equal(1m, evento.MONTO_TOTAL);
    }

    [Fact]
    public async Task Cargo_extra_anulado_no_suma_y_conserva_auditoria()
    {
        var repo = new EventoRepositoryFake(new[] { CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)) });
        var service = new EventoService(repo);
        var cargo = await service.AgregarCargoExtraAsync(1, new CrearCargoExtraEventoRequestDto { Descripcion = "Pool", Monto = 50000m }, 99);
        await service.AnularCargoExtraAsync(1, cargo.Id, new AnularCargoExtraEventoRequestDto { Motivo = "No se contrató" }, 77);

        var anulado = Assert.Single(await service.ListarCargosExtraAsync(1));
        Assert.True(anulado.Anulado);
        Assert.NotNull(anulado.FechaAnulacion);
        Assert.Equal("No se contrató", anulado.MotivoAnulacion);
        Assert.Equal(0m, await service.CalcularTotalExtrasAsync(1));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.AnularCargoExtraAsync(1, cargo.Id, new AnularCargoExtraEventoRequestDto { Motivo = "Otra vez" }, 77));
    }

    [Fact]
    public async Task Cargo_extra_valida_monto_descripcion_y_evento_cancelado()
    {
        var cancelado = CrearEventoExistente(1, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0), EventoEstados.Cancelado);
        var service = new EventoService(new EventoRepositoryFake(new[] { cancelado }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.AgregarCargoExtraAsync(1, new CrearCargoExtraEventoRequestDto { Descripcion = "Pool", Monto = 1m }, 99));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.AgregarCargoExtraAsync(99, new CrearCargoExtraEventoRequestDto { Descripcion = "Pool", Monto = 1m }, 99));

        var activo = new EventoService(new EventoRepositoryFake(new[] { CrearEventoExistente(2, 10, 3, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)) }));
        await Assert.ThrowsAsync<ArgumentException>(() => activo.AgregarCargoExtraAsync(2, new CrearCargoExtraEventoRequestDto { Descripcion = "", Monto = 1m }, 99));
        await Assert.ThrowsAsync<ArgumentException>(() => activo.AgregarCargoExtraAsync(2, new CrearCargoExtraEventoRequestDto { Descripcion = "Pool", Monto = 0m }, 99));
    }

    [Fact]
    public async Task Pago_evento_calcula_saldo_y_tipo_derivado()
    {
        var evento = new Evento(10, 99, 1, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0), "Evento", 10, 500000m);
        evento.AsignarId(1);
        var service = new EventoService(new EventoRepositoryFake(new[] { evento }));

        var pago = await service.RegistrarPagoEventoAsync(1, new CrearPagoEventoRequestDto { MedioPagoId = 1, Monto = 100000m, Observacion = " nota " }, 99);
        var resumen = await service.ObtenerResumenFinancieroAsync(1);

        Assert.Equal("Seña", pago.TipoPago);
        Assert.Equal(400000m, resumen.SaldoPendiente);
        Assert.Equal("Señado", resumen.EstadoPago);
        Assert.Equal("nota", pago.Observacion);
    }

    private sealed class EventoRepositoryFake : IEventoRepository
    {
        private readonly List<Evento> _eventos;
        private readonly Dictionary<int, Cliente> _clientes;
        private readonly List<CargoExtraEvento> _cargos = new();
        private readonly List<PagoEvento> _pagos = new();
        private int _nextId;
        private int _nextCargoId = 1;

        public EventoRepositoryFake(IEnumerable<Evento>? seed = null)
            : this(seed, Enumerable.Empty<Cliente>())
        {
        }

        public EventoRepositoryFake(IEnumerable<Evento>? seed, IEnumerable<Cliente> clientes)
        {
            _eventos = seed?.ToList() ?? new List<Evento>();
            _clientes = clientes?.ToDictionary(c => c.ID_CLIENTE) ?? new Dictionary<int, Cliente>();

            foreach (var evento in _eventos)
            {
                if (_clientes.TryGetValue(evento.ID_CLIENTE, out var cliente))
                {
                    var propiedad = typeof(Evento).GetProperty("Cliente");
                    propiedad?.SetValue(evento, cliente);
                }
            }

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

        public Task<IReadOnlyList<Evento>> BuscarGlobalAsync(int sucursalId, string query, int limit, CancellationToken cancellationToken = default)
        {
            var normalized = query.Trim().ToLowerInvariant();
            var dates = new HashSet<DateOnly>();
            foreach (var part in query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (DateOnly.TryParseExact(part, new[] { "dd/MM/yyyy", "yyyy-MM-dd" }, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var parsed))
                    dates.Add(parsed);
            }

            var hoy = DateOnly.FromDateTime(DateTime.Today);

            var resultado = _eventos
                .Where(e => e.ID_SUCURSAL == sucursalId)
                .Where(e =>
                    GetClienteNombre(e.ID_CLIENTE).Contains(normalized) ||
                    e.TIPO_EVENTO.ToLowerInvariant().Contains(normalized) ||
                    e.ESTADO.ToLowerInvariant().Contains(normalized) ||
                    dates.Contains(e.FECHA))
                .OrderBy(e => e.FECHA >= hoy ? 0 : 1)
                .ThenBy(e => e.FECHA >= hoy ? (DateOnly?)e.FECHA : null)
                .ThenByDescending(e => e.FECHA < hoy ? (DateOnly?)e.FECHA : null)
                .ThenBy(e => e.HORA_INICIO)
                .ThenBy(e => e.ID_EVENTO)
                .Take(limit)
                .ToList();

            return Task.FromResult((IReadOnlyList<Evento>)resultado);
        }

        private string GetClienteNombre(int clienteId)
            => _clientes.TryGetValue(clienteId, out var cliente) ? cliente.NOMBRE.ToLowerInvariant() : string.Empty;

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

        public Task<IReadOnlyList<CargoExtraEvento>> ListarCargosExtraAsync(int eventoId, CancellationToken cancellationToken = default)
            => Task.FromResult((IReadOnlyList<CargoExtraEvento>)_cargos.Where(c => c.ID_EVENTO == eventoId).OrderBy(c => c.FECHA_REGISTRO).ThenBy(c => c.ID_CARGO_EXTRA_EVENTO).ToList());

        public Task<CargoExtraEvento?> ObtenerCargoExtraAsync(int cargoId, CancellationToken cancellationToken = default)
            => Task.FromResult(_cargos.FirstOrDefault(c => c.ID_CARGO_EXTRA_EVENTO == cargoId));

        public Task AgregarCargoExtraAsync(CargoExtraEvento cargo, CancellationToken cancellationToken = default)
        {
            typeof(CargoExtraEvento).GetProperty("ID_CARGO_EXTRA_EVENTO")!.SetValue(cargo, _nextCargoId++);
            _cargos.Add(cargo);
            return Task.CompletedTask;
        }

        public Task GuardarCambiosAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<IReadOnlyList<PagoEvento>> ListarPagosEventoAsync(int eventoId, CancellationToken cancellationToken = default)
            => Task.FromResult((IReadOnlyList<PagoEvento>)_pagos.Where(p => p.ID_EVENTO == eventoId).OrderBy(p => p.FECHA_REGISTRO).ToList());
        public Task<PagoEvento?> ObtenerPagoEventoAsync(int pagoId, CancellationToken cancellationToken = default)
            => Task.FromResult(_pagos.FirstOrDefault(p => p.ID_PAGO_EVENTO == pagoId));
        public Task<PagoEvento?> ObtenerPagoPorClaveIdempotenciaAsync(string clave, CancellationToken cancellationToken = default)
            => Task.FromResult(_pagos.FirstOrDefault(p => p.CLAVE_IDEMPOTENCIA == clave));
        public Task<MedioPago?> ObtenerMedioPagoAsync(int medioPagoId, CancellationToken cancellationToken = default)
            => Task.FromResult<MedioPago?>(medioPagoId == 1 ? new MedioPago(1, "EFECTIVO", "Efectivo", true) : null);
        public Task AgregarPagoEventoAsync(PagoEvento pago, CancellationToken cancellationToken = default)
        {
            typeof(PagoEvento).GetProperty("ID_PAGO_EVENTO")!.SetValue(pago, _pagos.Count + 1);
            _pagos.Add(pago);
            return Task.CompletedTask;
        }
    }
}
