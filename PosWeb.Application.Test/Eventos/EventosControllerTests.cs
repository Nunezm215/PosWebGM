using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Eventos;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;
using PosWeb.Controllers;
using PosWeb.Testing;

namespace PosWeb.Application.Test.Eventos;

public class EventosControllerTests
{
    private static DateOnly Hoy => DateOnly.FromDateTime(DateTime.Today);
    private static DateOnly Fecha(int dias) => Hoy.AddDays(dias);

    private const int UsuarioId = 9101;
    private const int SucursalId = 9101;
    private const int OtraSucursalId = 9102;
    private const int ClienteId = 9101;
    private const int OtroClienteId = 9102;

    private static async Task<(SqliteConnection connection, PosDbContextLocal context)> CrearContextoAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<PosDbContextLocal>()
            .UseSqlite(connection)
            .Options;

        var context = new PosDbContextLocal(options);
        await context.Database.MigrateAsync();
        return (connection, context);
    }

    private static async Task SeedAsync(PosDbContextLocal context)
    {
        var usuario = new Usuario(UsuarioId, "usuario_eventos", "hash", "Admin");
        TestHelpers.SetId(usuario, UsuarioId, "ID_USUARIO");
        context.Usuario.Add(usuario);

        var suscripcion = Suscripcion.CrearBasica(UsuarioId);
        TestHelpers.SetId(suscripcion, 9101, "ID_SUSCRIPCION");
        context.Suscripcion.Add(suscripcion);

        var empresa = new Empresa("Empresa Eventos", "30-00000000-9", 9101);
        TestHelpers.SetId(empresa, 9101, "ID_EMPRESA");
        context.Empresa.Add(empresa);

        var sucursal = new Sucursal("SUC-1", "Sucursal 1", 9101);
        TestHelpers.SetId(sucursal, SucursalId, "ID_SUCURSAL");
        context.Sucursal.Add(sucursal);

        var otraSucursal = new Sucursal("SUC-2", "Sucursal 2", 9101);
        TestHelpers.SetId(otraSucursal, OtraSucursalId, "ID_SUCURSAL");
        context.Sucursal.Add(otraSucursal);

        var cliente = new Cliente("Cliente Uno", "DNI", "12345678", telefono: "11111111", mail: "cliente1@correo.com");
        TestHelpers.SetId(cliente, ClienteId, "ID_CLIENTE");
        context.Cliente.Add(cliente);

        var otroCliente = new Cliente("Cliente Dos", "DNI", "87654321", telefono: "22222222", mail: "cliente2@correo.com");
        TestHelpers.SetId(otroCliente, OtroClienteId, "ID_CLIENTE");
        context.Cliente.Add(otroCliente);

        await context.SaveChangesAsync();
    }

    private static EventosController CrearController(PosDbContextLocal context, string rol, int usuarioId = UsuarioId, int sucursalId = SucursalId)
    {
        var repo = new EventoRepository(context);
        var service = new EventoService(repo);
        var contratoService = new ContratoEventoPdfService(repo, context);
        var controller = new EventosController(service, contratoService, context)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, usuarioId.ToString()),
                            new Claim(ClaimTypes.Role, rol),
                            new Claim("sucursalId", sucursalId.ToString())
                        },
                        "TestAuth"))
                }
            }
        };

        return controller;
    }

    private static CrearEventoRequestDto CrearRequest(int clienteId = ClienteId, DateOnly? fecha = null, TimeOnly? inicio = null, TimeOnly? fin = null)
        => new()
        {
            ClienteId = clienteId,
            Fecha = fecha ?? Hoy,
            HoraInicio = inicio ?? new TimeOnly(18, 0),
            HoraFin = fin ?? new TimeOnly(22, 0),
            TipoEvento = "Cumpleanos",
            CantidadInvitados = 50,
            MontoTotal = 100000m,
            Observaciones = "Sin alcohol"
        };

    private static EditarEventoRequestDto CrearEditarRequest(int clienteId = ClienteId, DateOnly? fecha = null, TimeOnly? inicio = null, TimeOnly? fin = null)
        => new()
        {
            ClienteId = clienteId,
            Fecha = fecha ?? Hoy,
            HoraInicio = inicio ?? new TimeOnly(18, 0),
            HoraFin = fin ?? new TimeOnly(22, 0),
            TipoEvento = "Cumpleanos",
            CantidadInvitados = 50,
            MontoTotal = 100000m,
            Observaciones = "Sin alcohol"
        };

    private static async Task<Evento> CrearEventoPersistidoAsync(PosDbContextLocal context, int clienteId = ClienteId, int usuarioId = UsuarioId, int sucursalId = SucursalId, DateOnly? fecha = null, TimeOnly? inicio = null, TimeOnly? fin = null)
    {
        var repo = new EventoRepository(context);
        var servicio = new EventoService(repo);
        var creado = await servicio.CrearEventoAsync(CrearRequest(clienteId, fecha, inicio, fin), usuarioId, sucursalId);
        return await context.Evento.FirstAsync(e => e.ID_EVENTO == creado.Id);
    }

    [Fact]
    public async Task Post_valido_devuelve_created()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var controller = CrearController(context, Roles.Admin);

            var result = await controller.Crear(CrearRequest(), CancellationToken.None);

            var created = Assert.IsType<CreatedAtActionResult>(result);
            var dto = Assert.IsType<EventoDto>(created.Value);
            Assert.True(dto.Id > 0);
        }
    }

    [Fact]
    public async Task Post_usa_usuario_y_sucursal_del_JWT()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var controller = CrearController(context, Roles.Admin, usuarioId: UsuarioId, sucursalId: SucursalId);

            var result = await controller.Crear(CrearRequest(), CancellationToken.None);

            var created = Assert.IsType<CreatedAtActionResult>(result);
            var dto = Assert.IsType<EventoDto>(created.Value);
            Assert.Equal(UsuarioId, dto.UsuarioCreadorId);
            Assert.Equal(SucursalId, dto.SucursalId);
        }
    }

    [Fact]
    public async Task Post_conflicto_horario_devuelve_badrequest()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoPersistidoAsync(context);
            var controller = CrearController(context, Roles.Admin);

            var result = await controller.Crear(CrearRequest(inicio: new TimeOnly(20, 0), fin: new TimeOnly(21, 0)), CancellationToken.None);

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Contains("no está disponible", badRequest.Value!.ToString()!);
        }
    }

    [Fact]
    public async Task Get_id_misma_sucursal_devuelve_ok()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.ObtenerPorId(evento.ID_EVENTO, CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(result.Result);
            var dto = Assert.IsType<EventoDto>(ok.Value);
            Assert.Equal(evento.ID_EVENTO, dto.Id);
        }
    }

    [Fact]
    public async Task Get_id_evento_historico_sigue_siendo_consultable()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = new Evento(ClienteId, UsuarioId, SucursalId, Fecha(-3), new TimeOnly(18, 0), new TimeOnly(22, 0), "Cumpleanos", 50, 100000m);
            context.Evento.Add(evento);
            await context.SaveChangesAsync();
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.ObtenerPorId(evento.ID_EVENTO, CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(result.Result);
            var dto = Assert.IsType<EventoDto>(ok.Value);
            Assert.Equal(Fecha(-3), dto.Fecha);
        }
    }

    [Fact]
    public async Task Get_id_evento_cancelado_historico_sigue_siendo_consultable()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = new Evento(ClienteId, UsuarioId, SucursalId, Fecha(-4), new TimeOnly(18, 0), new TimeOnly(22, 0), "Cumpleanos", 50, 100000m);
            evento.Cancelar();
            context.Evento.Add(evento);
            await context.SaveChangesAsync();
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.ObtenerPorId(evento.ID_EVENTO, CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(result.Result);
            var dto = Assert.IsType<EventoDto>(ok.Value);
            Assert.Equal(EventoEstados.Cancelado, dto.Estado);
            Assert.Equal(Fecha(-4), dto.Fecha);
        }
    }

    [Fact]
    public async Task Get_id_otra_sucursal_devuelve_404()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context, sucursalId: OtraSucursalId, clienteId: OtroClienteId);
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.ObtenerPorId(evento.ID_EVENTO, CancellationToken.None);

            Assert.IsType<NotFoundObjectResult>(result.Result);
        }
    }

    [Fact]
    public async Task Get_lista_filtra_por_sucursal()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoPersistidoAsync(context, sucursalId: SucursalId, clienteId: ClienteId);
            await CrearEventoPersistidoAsync(context, sucursalId: OtraSucursalId, clienteId: OtroClienteId);

            var controller = CrearController(context, Roles.UsuarioComun);
            var result = await controller.Listar(CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(result.Result);
            var lista = Assert.IsAssignableFrom<IReadOnlyList<EventoDto>>(ok.Value);
            Assert.All(lista, e => Assert.Equal(SucursalId, e.SucursalId));
        }
    }

    [Fact]
    public async Task Get_rango_filtra_por_sucursal()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoPersistidoAsync(context, sucursalId: SucursalId, clienteId: ClienteId, fecha: Hoy);
            await CrearEventoPersistidoAsync(context, sucursalId: OtraSucursalId, clienteId: OtroClienteId, fecha: Fecha(1));

            var controller = CrearController(context, Roles.UsuarioComun);
            var result = await controller.ListarRango(new DateOnly(2026, 8, 9), new DateOnly(2026, 8, 12), CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(result.Result);
            var lista = Assert.IsAssignableFrom<IReadOnlyList<EventoDto>>(ok.Value);
            Assert.All(lista, e => Assert.Equal(SucursalId, e.SucursalId));
        }
    }

    [Fact]
    public async Task Buscar_devuelve_resultados_globales_y_respeta_limit()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoPersistidoAsync(context, sucursalId: SucursalId, clienteId: ClienteId, fecha: Fecha(30));
            var historico = new Evento(OtroClienteId, UsuarioId, SucursalId, Fecha(-5), new TimeOnly(18, 0), new TimeOnly(20, 0), "Cumpleanos", 30, 100000m);
            context.Evento.Add(historico);
            await context.SaveChangesAsync();

            var controller = CrearController(context, Roles.UsuarioComun);
            var result = await controller.Buscar("cliente", 1, CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(result.Result);
            var lista = Assert.IsAssignableFrom<IReadOnlyList<BuscarEventoResponseDto>>(ok.Value);
            Assert.Single(lista);
            Assert.NotEmpty(lista[0].ReservadoPor);
        }
    }

    [Fact]
    public async Task Buscar_query_vacia_devuelve_badrequest()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.Buscar("   ", 10, CancellationToken.None);

            Assert.IsType<BadRequestObjectResult>(result.Result);
        }
    }

    [Fact]
    public async Task Disponibilidad_respeta_30_minutos()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoPersistidoAsync(context);
            var controller = CrearController(context, Roles.UsuarioComun);

            var a29 = await controller.Disponibilidad(Hoy, new TimeOnly(22, 29), new TimeOnly(23, 30), null, CancellationToken.None);
            var a30 = await controller.Disponibilidad(Hoy, new TimeOnly(22, 30), new TimeOnly(23, 30), null, CancellationToken.None);

            var a29Ok = Assert.IsType<OkObjectResult>(a29.Result);
            var a30Ok = Assert.IsType<OkObjectResult>(a30.Result);
            var a29Body = Assert.IsType<DisponibilidadEventoResponseDto>(a29Ok.Value);
            var a30Body = Assert.IsType<DisponibilidadEventoResponseDto>(a30Ok.Value);
            Assert.False(a29Body.Disponible);
            Assert.True(a30Body.Disponible);
            Assert.Null(a29Body.ProximaHoraDisponible);
            Assert.Null(a30Body.ProximaHoraDisponible);
        }
    }

    [Fact]
    public async Task Disponibilidad_devuelve_contracto_con_proxima_hora()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoPersistidoAsync(context, fecha: Hoy, inicio: new TimeOnly(8, 0), fin: new TimeOnly(9, 30));
            var controller = CrearController(context, Roles.UsuarioComun);

            var disponibilidad = await controller.Disponibilidad(Hoy, new TimeOnly(8, 0), new TimeOnly(10, 0), null, CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(disponibilidad.Result);
            var body = Assert.IsType<DisponibilidadEventoResponseDto>(ok.Value);
            Assert.False(body.Disponible);
            Assert.Equal(new TimeOnly(10, 0), body.ProximaHoraDisponible);
        }
    }

    [Fact]
    public async Task Caso_manual_0800_a_1000_devuelve_proxima_hora_en_el_contrato()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoPersistidoAsync(context, fecha: Hoy, inicio: new TimeOnly(8, 0), fin: new TimeOnly(9, 30));
            var controller = CrearController(context, Roles.UsuarioComun);

            var disponibilidad = await controller.Disponibilidad(Hoy, new TimeOnly(8, 0), new TimeOnly(10, 0), null, CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(disponibilidad.Result);
            var body = Assert.IsType<DisponibilidadEventoResponseDto>(ok.Value);
            Assert.False(body.Disponible);
            Assert.Equal(new TimeOnly(10, 0), body.ProximaHoraDisponible);
        }
    }

    [Fact]
    public async Task Disponibilidad_devuelve_null_si_no_hay_hueco()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoPersistidoAsync(context, fecha: Hoy, inicio: new TimeOnly(18, 0), fin: new TimeOnly(20, 30));
            await CrearEventoPersistidoAsync(context, fecha: Hoy, inicio: new TimeOnly(21, 0), fin: new TimeOnly(23, 59));
            var controller = CrearController(context, Roles.UsuarioComun);

            var disponibilidad = await controller.Disponibilidad(Hoy, new TimeOnly(18, 0), new TimeOnly(20, 0), null, CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(disponibilidad.Result);
            var body = Assert.IsType<DisponibilidadEventoResponseDto>(ok.Value);
            Assert.False(body.Disponible);
            Assert.Null(body.ProximaHoraDisponible);
        }
    }

    [Fact]
    public async Task Admin_puede_editar()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var controller = CrearController(context, Roles.Admin);

            var result = await controller.Editar(evento.ID_EVENTO, CrearEditarRequest(), CancellationToken.None);

            Assert.IsType<OkObjectResult>(result);
        }
    }

    [Fact]
    public async Task UsuarioComun_ediar_devuelve_forbid()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.Editar(evento.ID_EVENTO, CrearEditarRequest(), CancellationToken.None);

            Assert.IsType<ForbidResult>(result);
        }
    }

    [Fact]
    public async Task Admin_puede_cancelar_y_libera_horario()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var controller = CrearController(context, Roles.Admin);

            var cancel = await controller.Cancelar(evento.ID_EVENTO, CancellationToken.None);
            Assert.IsType<OkObjectResult>(cancel);

            var disponibilidad = await controller.Disponibilidad(Hoy, new TimeOnly(20, 0), new TimeOnly(21, 0), null, CancellationToken.None);
            var ok = Assert.IsType<OkObjectResult>(disponibilidad.Result);
            Assert.True(Assert.IsType<DisponibilidadEventoResponseDto>(ok.Value).Disponible);
        }
    }

    [Fact]
    public async Task UsuarioComun_cancelar_devuelve_forbid()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.Cancelar(evento.ID_EVENTO, CancellationToken.None);

            Assert.IsType<ForbidResult>(result);
        }
    }

    [Fact]
    public async Task Admin_puede_cambiar_estado()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var controller = CrearController(context, Roles.Admin);

            var result = await controller.CambiarEstado(evento.ID_EVENTO, new ActualizarEstadoEventoRequestDto { Estado = EventoEstados.Pagado }, CancellationToken.None);

            Assert.IsType<OkObjectResult>(result);
        }
    }

    [Fact]
    public async Task UsuarioComun_cambiar_estado_devuelve_forbid()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.CambiarEstado(evento.ID_EVENTO, new ActualizarEstadoEventoRequestDto { Estado = EventoEstados.Pagado }, CancellationToken.None);

            Assert.IsType<ForbidResult>(result);
        }
    }

    [Fact]
    public async Task Claims_faltantes_devuelven_unauthorized()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var repo = new EventoRepository(context);
            var service = new EventoService(repo);
            var contratoService = new ContratoEventoPdfService(repo, context);
            var controller = new EventosController(service, contratoService, context)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity())
                    }
                }
            };

            var result = await controller.Listar(CancellationToken.None);

            Assert.IsType<UnauthorizedObjectResult>(result.Result);
        }
    }

    [Fact]
    public async Task Contrato_devuelve_pdf_y_no_modifica_datos()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var totalAntes = await context.Evento.CountAsync();
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.Contrato(evento.ID_EVENTO, CancellationToken.None);

            var file = Assert.IsType<FileContentResult>(result);
            Assert.Equal("application/pdf", file.ContentType);
            Assert.NotNull(file.FileContents);
            Assert.NotEmpty(file.FileContents);
            Assert.Equal(totalAntes, await context.Evento.CountAsync());
        }
    }

    [Fact]
    public async Task Contrato_evento_otra_sucursal_devuelve_404()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context, sucursalId: OtraSucursalId, clienteId: OtroClienteId);
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.Contrato(evento.ID_EVENTO, CancellationToken.None);

            Assert.IsType<NotFoundObjectResult>(result);
        }
    }

    [Fact]
    public async Task Contrato_evento_inexistente_devuelve_404()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var controller = CrearController(context, Roles.UsuarioComun);

            var result = await controller.Contrato(999999, CancellationToken.None);

            Assert.IsType<NotFoundObjectResult>(result);
        }
    }

    [Fact]
    public async Task Cargos_get_devuelve_activos_y_anulados()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var service = new EventoService(new EventoRepository(context));
            var activo = await service.AgregarCargoExtraAsync(evento.ID_EVENTO, new CrearCargoExtraEventoRequestDto { Descripcion = "Activo", Monto = 100m }, UsuarioId);
            var anulado = await service.AgregarCargoExtraAsync(evento.ID_EVENTO, new CrearCargoExtraEventoRequestDto { Descripcion = "Anulado", Monto = 200m }, UsuarioId);
            await service.AnularCargoExtraAsync(evento.ID_EVENTO, anulado.Id, new AnularCargoExtraEventoRequestDto { Motivo = "Correccion" }, UsuarioId);

            var result = await CrearController(context, Roles.UsuarioComun).ListarCargos(evento.ID_EVENTO, CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(result.Result);
            var cargos = Assert.IsAssignableFrom<IReadOnlyList<CargoExtraEventoDto>>(ok.Value);
            Assert.Contains(cargos, c => c.Id == activo.Id && !c.Anulado);
            Assert.Contains(cargos, c => c.Id == anulado.Id && c.Anulado);
        }
    }

    [Fact]
    public async Task Cargos_post_admin_crea_con_usuario_del_claim()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);

            var result = await CrearController(context, Roles.Admin).AgregarCargo(evento.ID_EVENTO,
                new CrearCargoExtraEventoRequestDto { Descripcion = "Horas extra", Monto = 1500m }, CancellationToken.None);

            var created = Assert.IsType<CreatedAtActionResult>(result);
            Assert.IsType<CargoExtraEventoDto>(created.Value);
            Assert.Equal(UsuarioId, (await context.CargoExtraEvento.SingleAsync()).ID_USUARIO_REGISTRA);
        }
    }

    [Fact]
    public async Task Cargos_post_usuario_comun_es_rechazado()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);

            var result = await CrearController(context, Roles.UsuarioComun).AgregarCargo(evento.ID_EVENTO,
                new CrearCargoExtraEventoRequestDto { Descripcion = "Horas extra", Monto = 1500m }, CancellationToken.None);

            Assert.IsType<ForbidResult>(result);
        }
    }

    [Fact]
    public async Task Cargos_post_monto_invalido_devuelve_badrequest()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);

            var result = await CrearController(context, Roles.SuperAdmin).AgregarCargo(evento.ID_EVENTO,
                new CrearCargoExtraEventoRequestDto { Descripcion = "Horas extra", Monto = 0m }, CancellationToken.None);

            Assert.IsType<BadRequestObjectResult>(result);
        }
    }

    [Fact]
    public async Task Cargos_anular_registra_usuario_del_claim_y_segunda_anulacion_es_controlada()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var service = new EventoService(new EventoRepository(context));
            var cargo = await service.AgregarCargoExtraAsync(evento.ID_EVENTO, new CrearCargoExtraEventoRequestDto { Descripcion = "Horas extra", Monto = 1500m }, UsuarioId);
            var controller = CrearController(context, Roles.SuperAdmin);

            var first = await controller.AnularCargo(evento.ID_EVENTO, cargo.Id, new AnularCargoExtraEventoRequestDto { Motivo = "Correccion" }, CancellationToken.None);
            var second = await controller.AnularCargo(evento.ID_EVENTO, cargo.Id, new AnularCargoExtraEventoRequestDto { Motivo = "Correccion" }, CancellationToken.None);

            Assert.IsType<NoContentResult>(first);
            Assert.IsType<BadRequestObjectResult>(second);
            Assert.Equal(UsuarioId, (await context.CargoExtraEvento.SingleAsync()).ID_USUARIO_ANULA);
        }
    }
}
