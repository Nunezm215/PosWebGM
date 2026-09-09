using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Eventos;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;
using PosWeb.Testing;

namespace PosWeb.Application.Test.Eventos;

public class EventoDetalleCompartidoServiceTests
{
    private static readonly DateOnly FechaEvento = DateOnly.FromDateTime(DateTime.Today).AddDays(1);
    private static readonly TimeOnly InicioEvento = new(18, 0);
    private static readonly TimeOnly FinEvento = new(22, 0);

    private const int UsuarioId = 9401;
    private const int SucursalId = 9401;
    private const int ClienteId = 9401;

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
        TestHelpers.SetId(suscripcion, UsuarioId, "ID_SUSCRIPCION");
        context.Suscripcion.Add(suscripcion);

        var empresa = new Empresa("Empresa Eventos", "30-00000000-9", UsuarioId);
        TestHelpers.SetId(empresa, UsuarioId, "ID_EMPRESA");
        context.Empresa.Add(empresa);

        var sucursal = new Sucursal("SUC-1", "Sucursal 1", UsuarioId);
        TestHelpers.SetId(sucursal, SucursalId, "ID_SUCURSAL");
        context.Sucursal.Add(sucursal);

        var cliente = new Cliente("Cliente Uno", "DNI", "12345678", telefono: "11111111", mail: "cliente@correo.com");
        TestHelpers.SetId(cliente, ClienteId, "ID_CLIENTE");
        context.Cliente.Add(cliente);

        await context.SaveChangesAsync();
    }

    private static async Task<Evento> CrearEventoAsync(PosDbContextLocal context)
    {
        var repo = new EventoRepository(context);
        var service = new EventoService(repo);
        var creado = await service.CrearEventoAsync(new CrearEventoRequestDto
        {
            ClienteId = ClienteId,
            Fecha = FechaEvento,
            HoraInicio = InicioEvento,
            HoraFin = FinEvento,
            TipoEvento = "Cumpleanos",
            CantidadInvitados = 50,
            MontoTotal = 100000m,
            Observaciones = "Sin alcohol",
        }, UsuarioId, SucursalId);

        return await context.Evento.FirstAsync(e => e.ID_EVENTO == creado.Id);
    }

    [Fact]
    public async Task GenerarEnlace_crea_hash_y_revoca_enlaces_activos_previos()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoAsync(context);
            var service = new EventoDetalleCompartidoService(new EventoRepository(context), context);

            var primero = await service.GenerarEnlaceAsync(1, SucursalId);
            var segundo = await service.GenerarEnlaceAsync(1, SucursalId);

            Assert.NotEmpty(primero.Token);
            Assert.NotEqual(primero.Token, segundo.Token);
            Assert.Equal(43, primero.Token.Length);
            Assert.Equal(64, (await context.EventoDetalleCompartido.SingleAsync(x => x.ID_EVENTO_DETALLE_COMPARTIDO == primero.SolicitudId)).TOKEN_HASH.Length);
            Assert.Null(await service.ObtenerActivoPorTokenAsync(primero.Token));
            Assert.NotNull(await service.ObtenerActivoPorTokenAsync(segundo.Token));
        }
    }

    [Fact]
    public async Task ObtenerActivoPorToken_rechaza_token_invalido_vencido_y_revocado()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            await CrearEventoAsync(context);
            var service = new EventoDetalleCompartidoService(new EventoRepository(context), context);

            var enlace = await service.GenerarEnlaceAsync(1, SucursalId);

            Assert.Null(await service.ObtenerActivoPorTokenAsync("token-invalido"));

            var entidad = await context.EventoDetalleCompartido.SingleAsync();
            typeof(EventoDetalleCompartido).GetProperty("VENCE_EN_UTC")!.SetValue(entidad, DateTime.UtcNow.AddDays(-1));
            await context.SaveChangesAsync();
            Assert.Null(await service.ObtenerActivoPorTokenAsync(enlace.Token));

            typeof(EventoDetalleCompartido).GetProperty("VENCE_EN_UTC")!.SetValue(entidad, DateTime.UtcNow.AddDays(30));
            entidad.Revocar(DateTime.UtcNow);
            await context.SaveChangesAsync();
            Assert.Null(await service.ObtenerActivoPorTokenAsync(enlace.Token));
        }
    }
}
