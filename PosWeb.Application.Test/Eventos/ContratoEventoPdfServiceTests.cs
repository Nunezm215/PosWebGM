using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Eventos;
using PosWeb.Data;
using PosWeb.Contracts;
using PosWeb.Domain;
using PosWeb.Testing;
using UglyToad.PdfPig;
using System.Globalization;

namespace PosWeb.Application.Test.Eventos;

public class ContratoEventoPdfServiceTests
{
    private static DateOnly Hoy => DateOnly.FromDateTime(DateTime.Today);
    private static string FormatoFecha(DateOnly fecha) => fecha.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

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

        var cliente = new Cliente("Cliente Uno", "DNI", "12345678", telefono: "1234-5678", domicilio: "Calle 123", mail: "cliente@correo.com");
        TestHelpers.SetId(cliente, ClienteId, "ID_CLIENTE");
        context.Cliente.Add(cliente);

        var otroCliente = new Cliente("Cliente Dos", "DNI", "87654321", telefono: "22222222", mail: "cliente2@correo.com");
        TestHelpers.SetId(otroCliente, OtroClienteId, "ID_CLIENTE");
        context.Cliente.Add(otroCliente);

        await context.SaveChangesAsync();
    }

    private static ContratoEventoPdfService CrearService(PosDbContextLocal context)
        => new(new EventoRepository(context), context);

    private static async Task<Evento> CrearEventoPersistidoAsync(PosDbContextLocal context, int clienteId = ClienteId, int usuarioId = UsuarioId, int sucursalId = SucursalId, DateOnly? fecha = null, TimeOnly? inicio = null, TimeOnly? fin = null)
    {
        var repo = new EventoRepository(context);
        var servicio = new EventoService(repo);
        var creado = await servicio.CrearEventoAsync(new CrearEventoRequestDto
        {
            ClienteId = clienteId,
            Fecha = fecha ?? Hoy,
            HoraInicio = inicio ?? new TimeOnly(18, 0),
            HoraFin = fin ?? new TimeOnly(22, 0),
            TipoEvento = "Cumpleanos",
            CantidadInvitados = 50,
            MontoTotal = 500000m,
            Observaciones = "Sin alcohol"
        }, usuarioId, sucursalId);

        return await context.Evento.FirstAsync(e => e.ID_EVENTO == creado.Id);
    }

    private static string LeerTextoPdf(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var pdf = PdfDocument.Open(stream);
        return string.Join("\n", pdf.GetPages().Select(page => page.Text));
    }

    [Fact]
    public async Task Genera_pdf_con_datos_reales()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var service = CrearService(context);

            var result = await service.GenerarAsync(evento.ID_EVENTO, SucursalId, CancellationToken.None);

            Assert.NotNull(result);
            Assert.NotEmpty(result!.Content);

            var texto = LeerTextoPdf(result.Content);
            Assert.Contains("CONTRATO DE RESERVA DE SALON DE EVENTOS", texto);
            Assert.Contains("Cliente Uno", texto);
            Assert.Contains("DNI 12345678", texto);
            Assert.Contains("1234-5678", texto);
            Assert.Contains("Calle 123", texto);
            Assert.Contains("cliente@correo.com", texto);
            Assert.Contains(FormatoFecha(Hoy), texto);
            Assert.Contains("18:00 - 22:00", texto);
            Assert.Contains("Cumpleanos", texto);
            Assert.Contains("50", texto);
            Assert.Contains("$ 500.000,00", texto);
            Assert.Contains("Sin alcohol", texto);
            Assert.Contains("Reservado", texto);
        }
    }

    [Fact]
    public async Task Genera_pdf_cancelado_y_lo_identifica()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            evento.Cancelar();
            await context.SaveChangesAsync();

            var service = CrearService(context);
            var result = await service.GenerarAsync(evento.ID_EVENTO, SucursalId, CancellationToken.None);

            var texto = LeerTextoPdf(result!.Content);
            Assert.Contains("EVENTO CANCELADO", texto);
            Assert.Contains("Cancelado", texto);
        }
    }

    [Fact]
    public async Task Evento_otra_sucursal_no_es_visible()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context, sucursalId: OtraSucursalId, clienteId: OtroClienteId);

            var service = CrearService(context);
            var result = await service.GenerarAsync(evento.ID_EVENTO, SucursalId, CancellationToken.None);

            Assert.Null(result);
        }
    }

    [Fact]
    public async Task Generar_pdf_no_modifica_db()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context);
            var conteoAntes = await context.Evento.CountAsync();
            var snapshot = await context.Evento.AsNoTracking().FirstAsync(e => e.ID_EVENTO == evento.ID_EVENTO);

            var service = CrearService(context);
            var result = await service.GenerarAsync(evento.ID_EVENTO, SucursalId, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(conteoAntes, await context.Evento.CountAsync());

            var despues = await context.Evento.AsNoTracking().FirstAsync(e => e.ID_EVENTO == evento.ID_EVENTO);
            Assert.Equal(snapshot.ESTADO, despues.ESTADO);
            Assert.Equal(snapshot.MONTO_TOTAL, despues.MONTO_TOTAL);
            Assert.Equal(snapshot.TIPO_EVENTO, despues.TIPO_EVENTO);
        }
    }
}
