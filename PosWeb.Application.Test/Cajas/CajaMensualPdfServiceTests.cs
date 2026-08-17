using Microsoft.AspNetCore.Mvc;
using PosWeb.Application.Cajas;
using PosWeb.Contracts;
using PosWeb.Controllers;

namespace PosWeb.Application.Test.Cajas;

public class CajaMensualPdfServiceTests
{
    [Fact]
    public async Task Genera_pdf_mensual_valido_y_usa_mes_solicitado()
    {
        var fuente = new CajaMensualFake(CajaMensualDtoDemo());
        var bytes = await new CajaMensualPdfService(fuente).GenerarAsync(2026, 8);

        Assert.True(bytes.Length > 4);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        Assert.Equal((2026, 8), fuente.UltimaConsulta!.Value);
    }

    [Fact]
    public async Task Genera_pdf_mensual_para_mes_vacio()
    {
        var bytes = await new CajaMensualPdfService(new CajaMensualFake(CajaMensualDtoVacio())).GenerarAsync(2026, 8);

        Assert.True(bytes.Length > 4);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [Fact]
    public async Task Controller_mensual_devuelve_pdf_con_nombre_y_content_type()
    {
        var result = await new CajaDiariaController(new CajaDiariaFake(), new PdfFake(), new MensualPdfFake())
            .MensualPdf(2026, 8, CancellationToken.None);

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/pdf", file.ContentType);
        Assert.Equal("Caja-Mensual-2026-08.pdf", file.FileDownloadName);
    }

    private static CajaMensualDto CajaMensualDtoDemo() => new()
    {
        Anio = 2026,
        Mes = 8,
        Desde = new DateOnly(2026, 8, 1),
        Hasta = new DateOnly(2026, 8, 17),
        TotalIngresos = 500000,
        TotalEgresos = 65000,
        Resultado = 435000,
        EventosRealizados = 1,
        IngresosPorMedio = [new MedioPagoCajaDto { MedioPagoId = 4, Descripcion = "Transferencia", CantidadPagos = 1, Total = 500000 }],
        Dias = [new CajaDiariaResumenDto { Fecha = new DateOnly(2026, 8, 17), TotalIngresos = 500000, TotalEgresos = 65000, Resultado = 435000, CantidadEventosRealizados = 1 }],
        DiasActividad = [new CajaMensualActividadDiaDto
        {
            Fecha = new DateOnly(2026, 8, 17),
            TotalIngresos = 500000,
            TotalEgresos = 65000,
            Resultado = 435000,
            CantidadEventosRealizados = 1,
            Ingresos = [new IngresoCajaDiariaDto { FechaRegistro = new DateTime(2026, 8, 17, 18, 0, 0), NombreCliente = "Ana", TipoEvento = "Boda", MedioPago = "Transferencia", Monto = 500000 }],
            Egresos = [new EgresoCajaDiariaDto { Fecha = new DateTime(2026, 8, 17, 19, 0, 0), Detalle = "Hielo", Monto = 65000 }],
            Eventos = [new EventoRealizadoCajaDto { HoraInicio = new TimeOnly(18, 0), NombreCliente = "Ana", TipoEvento = "Boda", Estado = "Pagado" }],
        }],
    };

    private static CajaMensualDto CajaMensualDtoVacio() => new()
    {
        Anio = 2026,
        Mes = 8,
        Desde = new DateOnly(2026, 8, 1),
        Hasta = new DateOnly(2026, 8, 17),
        Dias = [new CajaDiariaResumenDto { Fecha = new DateOnly(2026, 8, 1) }],
    };

    private sealed class CajaMensualFake(CajaMensualDto respuesta) : ICajaDiariaService
    {
        public (int Anio, int Mes)? UltimaConsulta { get; private set; }
        public Task<CajaDiariaDto> ObtenerAsync(DateOnly fecha, CancellationToken cancellationToken = default) => Task.FromResult(new CajaDiariaDto { Fecha = fecha });
        public Task<IReadOnlyList<CajaDiariaResumenDto>> ObtenerHistorialAsync(DateOnly desde, DateOnly hasta, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<CajaDiariaResumenDto>>([]);
        public Task<CajaMensualDto> ObtenerMensualAsync(int anio, int mes, CancellationToken cancellationToken = default) { UltimaConsulta = (anio, mes); return Task.FromResult(respuesta); }
    }

    private sealed class CajaDiariaFake : ICajaDiariaService
    {
        public Task<CajaDiariaDto> ObtenerAsync(DateOnly fecha, CancellationToken cancellationToken = default) => Task.FromResult(new CajaDiariaDto { Fecha = fecha });
        public Task<IReadOnlyList<CajaDiariaResumenDto>> ObtenerHistorialAsync(DateOnly desde, DateOnly hasta, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<CajaDiariaResumenDto>>([]);
        public Task<CajaMensualDto> ObtenerMensualAsync(int anio, int mes, CancellationToken cancellationToken = default) => Task.FromResult(new CajaMensualDto { Anio = anio, Mes = mes });
    }

    private sealed class PdfFake : ICajaDiariaPdfService
    {
        public Task<byte[]> GenerarAsync(DateOnly fecha, CancellationToken cancellationToken = default) => Task.FromResult(System.Text.Encoding.ASCII.GetBytes("%PDF-test"));
    }

    private sealed class MensualPdfFake : ICajaMensualPdfService
    {
        public Task<byte[]> GenerarAsync(int anio, int mes, CancellationToken cancellationToken = default) => Task.FromResult(System.Text.Encoding.ASCII.GetBytes("%PDF-test"));
    }
}
