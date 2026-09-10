using System.Globalization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PosWeb.Application.Eventos;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;
using PosWeb.Testing;
using UglyToad.PdfPig;

namespace PosWeb.Application.Test.Eventos;

public class EventoDetallePdfServiceTests
{
    private static readonly DateOnly FechaEvento = DateOnly.FromDateTime(DateTime.Today).AddDays(1);
    private static readonly TimeOnly InicioEvento = new(18, 0);
    private static readonly TimeOnly FinEvento = new(22, 0);

    private const int UsuarioId = 9101;
    private const int SucursalId = 9101;
    private const int OtraSucursalId = 9102;
    private const int ClienteId = 9101;

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

        var cliente = new Cliente("Cliente Uno", "DNI", "12345678", telefono: "1234-5678", mail: "cliente@correo.com");
        TestHelpers.SetId(cliente, ClienteId, "ID_CLIENTE");
        context.Cliente.Add(cliente);

        if (!context.MedioPago.Any())
        {
            context.MedioPago.Add(new MedioPago(9101, "EFECTIVO_TEST", "Efectivo", true));
        }

        await context.SaveChangesAsync();
    }

    private static EventoService CrearEventoService(PosDbContextLocal context)
        => new(new EventoRepository(context), new RelojFijo(new DateTimeOffset(2026, 8, 17, 15, 0, 0, TimeSpan.Zero)));

    private static EventoDetallePdfService CrearService(PosDbContextLocal context)
    {
        var repo = new EventoRepository(context);
        return new EventoDetallePdfService(repo, new EventoService(repo, new RelojFijo(new DateTimeOffset(2026, 8, 17, 15, 0, 0, TimeSpan.Zero))));
    }

    private static async Task<Evento> CrearEventoPersistidoAsync(PosDbContextLocal context, int sucursalId = SucursalId)
    {
        var service = CrearEventoService(context);
        var creado = await service.CrearEventoAsync(new CrearEventoRequestDto
        {
            ClienteId = ClienteId,
            Fecha = FechaEvento,
            HoraInicio = InicioEvento,
            HoraFin = FinEvento,
            TipoEvento = "Cumpleanos",
            CantidadInvitados = 50,
            MontoTotal = 100000m,
            Observaciones = "Sin alcohol"
        }, UsuarioId, sucursalId);

        return await context.Evento.FirstAsync(e => e.ID_EVENTO == creado.Id);
    }

    private static string LeerTextoPdf(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var pdf = PdfDocument.Open(stream);
        return string.Join("\n", pdf.GetPages().Select(page => page.Text));
    }

    private static void SetFechaRegistro(PagoEvento pago, DateTime value)
        => typeof(PagoEvento).GetProperty("FECHA_REGISTRO")!.SetValue(pago, value);

    [Fact]
    public async Task Genera_pdf_con_resumen_pagos_y_cargos_validos()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var medioPagoId = await context.MedioPago.Where(m => m.ACTIVO).Select(m => m.ID_MEDIO_PAGO).FirstAsync();
            var evento = await CrearEventoPersistidoAsync(context);
            var repo = new EventoRepository(context);
            var eventoService = new EventoService(repo, new RelojFijo(new DateTimeOffset(2026, 8, 17, 15, 0, 0, TimeSpan.Zero)));

            await eventoService.AgregarCargoExtraAsync(evento.ID_EVENTO, new CrearCargoExtraEventoRequestDto { Descripcion = "Decoracion", Monto = 25000m }, UsuarioId);
            var cargoAnulado = await eventoService.AgregarCargoExtraAsync(evento.ID_EVENTO, new CrearCargoExtraEventoRequestDto { Descripcion = "Vajilla", Monto = 15000m }, UsuarioId);
            await eventoService.AnularCargoExtraAsync(evento.ID_EVENTO, cargoAnulado.Id, new AnularCargoExtraEventoRequestDto { Motivo = "No se usa" }, UsuarioId);

            var pagoValido = await eventoService.RegistrarPagoEventoAsync(evento.ID_EVENTO, new CrearPagoEventoRequestDto { MedioPagoId = medioPagoId, Monto = 40000m, Observacion = "Seña" }, UsuarioId);
            var pagoValidoEntity = await context.PagoEvento.FirstAsync(p => p.ID_PAGO_EVENTO == pagoValido.Id);
            SetFechaRegistro(pagoValidoEntity, new DateTime(2026, 8, 17, 15, 0, 0, DateTimeKind.Utc));
            await context.SaveChangesAsync();

            var pagoAnulado = await eventoService.RegistrarPagoEventoAsync(evento.ID_EVENTO, new CrearPagoEventoRequestDto { MedioPagoId = medioPagoId, Monto = 10000m, Observacion = "No mostrar" }, UsuarioId);
            var pagoAnuladoEntity = await context.PagoEvento.FirstAsync(p => p.ID_PAGO_EVENTO == pagoAnulado.Id);
            SetFechaRegistro(pagoAnuladoEntity, new DateTime(2026, 8, 17, 16, 0, 0, DateTimeKind.Utc));
            await context.SaveChangesAsync();
            await eventoService.AnularPagoEventoAsync(evento.ID_EVENTO, pagoAnulado.Id, new AnularPagoEventoRequestDto { Motivo = "Duplicado" }, UsuarioId);

            var service = CrearService(context);
            var result = await service.GenerarAsync(evento.ID_EVENTO, SucursalId, CancellationToken.None);

            Assert.NotNull(result);
            var texto = LeerTextoPdf(result!.Content);

            Assert.Contains("GESTOR MULTIEVENTOS", texto);
            Assert.Contains("DETALLE DE RESERVA", texto);
            Assert.Contains(FechaEvento.ToString("dd/MM/yyyy", CultureInfo.GetCultureInfo("es-AR")), texto);
            Assert.Contains("18:00 - 22:00", texto);
            Assert.Contains("Cumpleanos", texto);
            Assert.Contains("50", texto);
            Assert.Contains("Reservado", texto);
            Assert.Contains("Cliente Uno", texto);
            Assert.Contains("Tel: 1234-5678", texto);
            Assert.Contains("Mail: cliente@correo.com", texto);
            Assert.Contains("Sucursal 1", texto);
            Assert.Contains("Monto base", texto);
            Assert.Contains("$ 100.000,00", texto);
            Assert.Contains("Cargos extras", texto);
            Assert.Contains("$ 25.000,00", texto);
            Assert.Contains("$ 125.000,00", texto);
            Assert.Contains("Total abonado", texto);
            Assert.Contains("$ 40.000,00", texto);
            Assert.Contains("SALDO PENDIENTE", texto);
            Assert.Contains("$ 85.000,00", texto);
            Assert.Contains("HISTORIAL DE PAGOS", texto);
            Assert.Contains("17/08/2026 12:00", texto);
            Assert.DoesNotContain("No mostrar", texto);
            Assert.DoesNotContain("Duplicado", texto);
        }
    }

    [Fact]
    public async Task Evento_inexistente_devuelve_null()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var service = CrearService(context);

            var result = await service.GenerarAsync(999999, SucursalId, CancellationToken.None);

            Assert.Null(result);
        }
    }

    [Fact]
    public async Task Evento_otra_sucursal_devuelve_null()
    {
        var (connection, context) = await CrearContextoAsync();
        await using (connection)
        await using (context)
        {
            await SeedAsync(context);
            var evento = await CrearEventoPersistidoAsync(context, OtraSucursalId);
            var service = CrearService(context);

            var result = await service.GenerarAsync(evento.ID_EVENTO, SucursalId, CancellationToken.None);

            Assert.Null(result);
        }
    }

    [Fact]
    public async Task Almacena_un_solo_pdf_y_lo_reemplaza_despues_de_un_pago()
    {
        var (connection, context) = await CrearContextoAsync();
        var basePath = Path.Combine(Path.GetTempPath(), "PosWebTests", Guid.NewGuid().ToString("N"));
        await using (connection)
        await using (context)
        {
            try
            {
                await SeedAsync(context);
                var evento = await CrearEventoPersistidoAsync(context);
                var service = CrearService(context);
                var storage = new DetallePdfStorage(service, Options.Create(new DetallePdfStorageOptions { BasePath = basePath }));

                var inicial = await storage.RegenerarAsync(evento.ID_EVENTO, SucursalId);
                var archivo = Path.Combine(basePath, evento.ID_EVENTO.ToString(), "detalle-reserva.pdf");
                Assert.NotNull(inicial);
                Assert.True(File.Exists(archivo));
                Assert.Single(Directory.GetFiles(Path.GetDirectoryName(archivo)!));
                Assert.Contains("$ 100.000,00", LeerTextoPdf(await File.ReadAllBytesAsync(archivo)));

                var medioPagoId = await context.MedioPago.Where(m => m.ACTIVO).Select(m => m.ID_MEDIO_PAGO).FirstAsync();
                await CrearEventoService(context).RegistrarPagoEventoAsync(evento.ID_EVENTO, new CrearPagoEventoRequestDto
                {
                    MedioPagoId = medioPagoId,
                    Monto = 40000m,
                    Observacion = "Seña"
                }, UsuarioId);

                await storage.RegenerarAsync(evento.ID_EVENTO, SucursalId);
                Assert.Single(Directory.GetFiles(Path.GetDirectoryName(archivo)!));
                var textoActualizado = LeerTextoPdf(await File.ReadAllBytesAsync(archivo));
                Assert.Contains("$ 40.000,00", textoActualizado);
                Assert.Contains("$ 60.000,00", textoActualizado);
            }
            finally
            {
                if (Directory.Exists(basePath))
                    Directory.Delete(basePath, true);
            }
        }
    }

    private sealed class RelojFijo(DateTimeOffset ahora) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => ahora;
    }
}
