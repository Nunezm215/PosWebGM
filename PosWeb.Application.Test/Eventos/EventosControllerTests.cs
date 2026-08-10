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

        var cliente = new Cliente("Cliente Uno", "DNI", "12345678");
        TestHelpers.SetId(cliente, ClienteId, "ID_CLIENTE");
        context.Cliente.Add(cliente);

        var otroCliente = new Cliente("Cliente Dos", "DNI", "87654321");
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
            Fecha = fecha ?? new DateOnly(2026, 8, 10),
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
            Fecha = fecha ?? new DateOnly(2026, 8, 10),
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
            await CrearEventoPersistidoAsync(context, sucursalId: SucursalId, clienteId: ClienteId, fecha: new DateOnly(2026, 8, 10));
            await CrearEventoPersistidoAsync(context, sucursalId: OtraSucursalId, clienteId: OtroClienteId, fecha: new DateOnly(2026, 8, 11));

            var controller = CrearController(context, Roles.UsuarioComun);
            var result = await controller.ListarRango(new DateOnly(2026, 8, 9), new DateOnly(2026, 8, 12), CancellationToken.None);

            var ok = Assert.IsType<OkObjectResult>(result.Result);
            var lista = Assert.IsAssignableFrom<IReadOnlyList<EventoDto>>(ok.Value);
            Assert.All(lista, e => Assert.Equal(SucursalId, e.SucursalId));
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

            var a29 = await controller.Disponibilidad(new DateOnly(2026, 8, 10), new TimeOnly(22, 29), new TimeOnly(23, 30), null, CancellationToken.None);
            var a30 = await controller.Disponibilidad(new DateOnly(2026, 8, 10), new TimeOnly(22, 30), new TimeOnly(23, 30), null, CancellationToken.None);

            Assert.False((bool)Assert.IsType<OkObjectResult>(a29).Value!);
            Assert.True((bool)Assert.IsType<OkObjectResult>(a30).Value!);
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

            var disponibilidad = await controller.Disponibilidad(new DateOnly(2026, 8, 10), new TimeOnly(20, 0), new TimeOnly(21, 0), null, CancellationToken.None);
            Assert.True((bool)Assert.IsType<OkObjectResult>(disponibilidad).Value!);
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
}
