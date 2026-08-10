using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Eventos;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;
using PosWeb.Testing;

namespace PosWeb.Application.Test.Eventos;

public class EventoRepositoryEfTests
{
    private static DateOnly Hoy => DateOnly.FromDateTime(DateTime.Today);
    private static DateOnly Fecha(int dias) => Hoy.AddDays(dias);

    private const int UsuarioId = 9001;
    private const int SuscripcionId = 9001;
    private const int EmpresaId = 9001;
    private const int Sucursal1Id = 9001;
    private const int Sucursal2Id = 9002;
    private const int Cliente1Id = 9001;
    private const int Cliente2Id = 9002;

    private static PosDbContextLocal CrearContexto(SqliteConnection connection)
    {
        var options = new DbContextOptionsBuilder<PosDbContextLocal>()
            .UseSqlite(connection)
            .Options;

        var context = new PosDbContextLocal(options);
        context.Database.Migrate();
        return context;
    }

    private static async Task<(SqliteConnection connection, PosDbContextLocal context)> CrearContextoListoAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        return (connection, CrearContexto(connection));
    }

    private static async Task SeedBaseAsync(PosDbContextLocal context)
    {
        var usuario = new Usuario(UsuarioId, "usuario_eventos", "hash", "Admin");
        context.Usuario.Add(usuario);
        await context.SaveChangesAsync();

        var suscripcion = Suscripcion.CrearBasica(UsuarioId);
        TestHelpers.SetId(suscripcion, SuscripcionId, "ID_SUSCRIPCION");
        context.Suscripcion.Add(suscripcion);
        await context.SaveChangesAsync();

        var empresa = new Empresa("Empresa Eventos", "30-00000000-9", SuscripcionId);
        TestHelpers.SetId(empresa, EmpresaId, "ID_EMPRESA");
        context.Empresa.Add(empresa);
        await context.SaveChangesAsync();

        var sucursal1 = new Sucursal("SUC-1", "Sucursal 1", EmpresaId);
        TestHelpers.SetId(sucursal1, Sucursal1Id, "ID_SUCURSAL");
        context.Sucursal.Add(sucursal1);

        var sucursal2 = new Sucursal("SUC-2", "Sucursal 2", EmpresaId);
        TestHelpers.SetId(sucursal2, Sucursal2Id, "ID_SUCURSAL");
        context.Sucursal.Add(sucursal2);

        var cliente1 = new Cliente("Cliente Uno", "DNI", "12345678");
        TestHelpers.SetId(cliente1, Cliente1Id, "ID_CLIENTE");
        context.Cliente.Add(cliente1);

        var cliente2 = new Cliente("Cliente Dos", "DNI", "87654321");
        TestHelpers.SetId(cliente2, Cliente2Id, "ID_CLIENTE");
        context.Cliente.Add(cliente2);

        await context.SaveChangesAsync();
    }

    private static Evento CrearEvento(int clienteId, int usuarioId, int sucursalId, DateOnly fecha, TimeOnly inicio, TimeOnly fin, string tipo = "Cumpleanos")
        => new(clienteId, usuarioId, sucursalId, fecha, inicio, fin, tipo, 50, 100000m);

    [Fact]
    public async Task Guarda_y_recupera_evento_con_relaciones()
    {
        var (connection, context) = await CrearContextoListoAsync();
        await using (connection)
        await using (context)
        {
            await SeedBaseAsync(context);
            var repo = new EventoRepository(context);

            var evento = CrearEvento(Cliente1Id, UsuarioId, Sucursal1Id, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0));
            await repo.AgregarAsync(evento);

            var encontrado = await repo.ObtenerPorIdAsync(evento.ID_EVENTO);

            Assert.NotNull(encontrado);
            Assert.Equal(Cliente1Id, encontrado!.ID_CLIENTE);
            Assert.Equal(UsuarioId, encontrado.ID_USUARIO_CREADOR);
            Assert.Equal(Sucursal1Id, encontrado.ID_SUCURSAL);
            Assert.NotNull(encontrado.Cliente);
            Assert.NotNull(encontrado.UsuarioCreador);
            Assert.NotNull(encontrado.Sucursal);
        }
    }

    [Fact]
    public async Task Lista_por_rango_devuelve_solo_eventos_del_rango()
    {
        var (connection, context) = await CrearContextoListoAsync();
        await using (connection)
        await using (context)
        {
            await SeedBaseAsync(context);
            var repo = new EventoRepository(context);

            await repo.AgregarAsync(CrearEvento(Cliente1Id, UsuarioId, Sucursal1Id, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)));
            await repo.AgregarAsync(CrearEvento(Cliente2Id, UsuarioId, Sucursal2Id, Fecha(2), new TimeOnly(18, 0), new TimeOnly(22, 0)));
            await repo.AgregarAsync(CrearEvento(Cliente1Id, UsuarioId, Sucursal1Id, Fecha(10), new TimeOnly(18, 0), new TimeOnly(22, 0)));

            var eventos = await repo.ListarPorRangoAsync(Fecha(-1), Fecha(5));

            Assert.Equal(2, eventos.Count);
        }
    }

    [Fact]
    public async Task Filtra_por_sucursal()
    {
        var (connection, context) = await CrearContextoListoAsync();
        await using (connection)
        await using (context)
        {
            await SeedBaseAsync(context);
            var repo = new EventoRepository(context);

            await repo.AgregarAsync(CrearEvento(Cliente1Id, UsuarioId, Sucursal1Id, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)));
            await repo.AgregarAsync(CrearEvento(Cliente2Id, UsuarioId, Sucursal2Id, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)));

            var eventosSucursal1 = await repo.ListarPorFechaYSucursalAsync(Hoy, Sucursal1Id);

            Assert.Single(eventosSucursal1);
            Assert.All(eventosSucursal1, e => Assert.Equal(Sucursal1Id, e.ID_SUCURSAL));
        }
    }

    [Fact]
    public async Task Evento_de_otra_sucursal_no_aparece()
    {
        var (connection, context) = await CrearContextoListoAsync();
        await using (connection)
        await using (context)
        {
            await SeedBaseAsync(context);
            var repo = new EventoRepository(context);

            await repo.AgregarAsync(CrearEvento(Cliente1Id, UsuarioId, Sucursal1Id, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)));
            await repo.AgregarAsync(CrearEvento(Cliente2Id, UsuarioId, Sucursal2Id, Hoy, new TimeOnly(18, 0), new TimeOnly(22, 0)));

            var eventosSucursal1 = await repo.ListarPorFechaYSucursalAsync(Hoy, 1);

            Assert.DoesNotContain(eventosSucursal1, e => e.ID_SUCURSAL == Sucursal2Id);
        }
    }

    [Fact]
    public async Task Modelo_crea_indices_esperados()
    {
        var (connection, context) = await CrearContextoListoAsync();
        await using (connection)
        await using (context)
        {
            var entityType = context.Model.FindEntityType(typeof(Evento));
            Assert.NotNull(entityType);

            var indexSucursalFecha = entityType!.GetIndexes().SingleOrDefault(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "ID_SUCURSAL", "FECHA" }));
            var indexCliente = entityType.GetIndexes().SingleOrDefault(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "ID_CLIENTE" }));
            var indexUsuario = entityType.GetIndexes().SingleOrDefault(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "ID_USUARIO_CREADOR" }));

            Assert.NotNull(indexSucursalFecha);
            Assert.NotNull(indexCliente);
            Assert.NotNull(indexUsuario);
        }
    }

    [Fact]
    public async Task Servicio_de_eventos_funciona_con_repo_EF_real()
    {
        var (connection, context) = await CrearContextoListoAsync();
        await using (connection)
        await using (context)
        {
            await SeedBaseAsync(context);
            var repo = new EventoRepository(context);
            var service = new EventoService(repo);

            var creado = await service.CrearEventoAsync(
                new CrearEventoRequestDto
                {
                    ClienteId = Cliente1Id,
                    Fecha = Hoy,
                    HoraInicio = new TimeOnly(18, 0),
                    HoraFin = new TimeOnly(22, 0),
                    TipoEvento = "Cumpleanos",
                    CantidadInvitados = 50,
                    MontoTotal = 100000m,
                    Observaciones = null,
                },
                usuarioCreadorId: UsuarioId,
                sucursalId: Sucursal1Id);

            Assert.Equal(EventoEstados.Reservado, creado.Estado);
            var disponible = await service.EstaDisponibleAsync(Hoy, new TimeOnly(20, 0), new TimeOnly(21, 0), Sucursal1Id);
            Assert.False(disponible);
        }
    }

    [Fact]
    public async Task Cancelado_no_bloquea_en_repo_real()
    {
        var (connection, context) = await CrearContextoListoAsync();
        await using (connection)
        await using (context)
        {
            await SeedBaseAsync(context);
            var repo = new EventoRepository(context);
            var service = new EventoService(repo);

            var creado = await service.CrearEventoAsync(
                new CrearEventoRequestDto
                {
                    ClienteId = Cliente1Id,
                    Fecha = Hoy,
                    HoraInicio = new TimeOnly(18, 0),
                    HoraFin = new TimeOnly(22, 0),
                    TipoEvento = "Cumpleanos",
                    CantidadInvitados = 50,
                    MontoTotal = 100000m,
                    Observaciones = null,
                },
                usuarioCreadorId: UsuarioId,
                sucursalId: Sucursal1Id);

            var cancelado = await service.CancelarAsync(creado.Id);
            Assert.Equal(EventoEstados.Cancelado, cancelado.Estado);

            var disponible = await service.EstaDisponibleAsync(Hoy, new TimeOnly(20, 0), new TimeOnly(21, 0), Sucursal1Id);
            Assert.True(disponible);
        }
    }
}
