using Microsoft.AspNetCore.Mvc;
using PosWeb.Application.Cajas;
using PosWeb.Contracts;
using PosWeb.Controllers;

namespace PosWeb.Application.Test.Cajas;

public class CajaDiariaPdfServiceTests
{
    [Fact]
    public async Task Genera_pdf_valido_y_usa_fecha_solicitada()
    {
        var fuente = new CajaDiariaFake();
        var fecha = new DateOnly(2026, 8, 17);
        var bytes = await new CajaDiariaPdfService(fuente).GenerarAsync(fecha);
        Assert.True(bytes.Length > 4); Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4)); Assert.Equal(fecha, fuente.Fecha);
    }

    [Fact]
    public async Task Genera_pdf_para_dia_vacio()
    {
        var bytes = await new CajaDiariaPdfService(new CajaDiariaFake()).GenerarAsync(new DateOnly(2026, 8, 17));
        Assert.True(bytes.Length > 4); Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [Fact]
    public async Task Controller_devuelve_pdf_con_nombre_y_content_type()
    {
        var fecha = new DateOnly(2026, 8, 17);
        var result = await new CajaDiariaController(new CajaDiariaFake(), new PdfFake()).Pdf(fecha, CancellationToken.None);
        var file = Assert.IsType<FileContentResult>(result); Assert.Equal("application/pdf", file.ContentType); Assert.Equal("Caja-2026-08-17.pdf", file.FileDownloadName);
    }

    private sealed class CajaDiariaFake : ICajaDiariaService
    {
        public DateOnly? Fecha { get; private set; }
        public Task<CajaDiariaDto> ObtenerAsync(DateOnly fecha, CancellationToken cancellationToken = default) { Fecha = fecha; return Task.FromResult(new CajaDiariaDto { Fecha = fecha }); }
        public Task<IReadOnlyList<CajaDiariaResumenDto>> ObtenerHistorialAsync(DateOnly desde, DateOnly hasta, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<CajaDiariaResumenDto>>([]);
    }
    private sealed class PdfFake : ICajaDiariaPdfService { public Task<byte[]> GenerarAsync(DateOnly fecha, CancellationToken cancellationToken = default) => Task.FromResult(System.Text.Encoding.ASCII.GetBytes("%PDF-test")); }
}
