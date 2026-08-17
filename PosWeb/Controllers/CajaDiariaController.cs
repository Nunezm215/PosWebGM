using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosWeb.Application.Cajas;
using PosWeb.Domain;

namespace PosWeb.Controllers;

[ApiController]
[Route("api/caja-diaria")]
[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
public class CajaDiariaController(ICajaDiariaService service, ICajaDiariaPdfService pdfService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Obtener([FromQuery] DateOnly? fecha, CancellationToken cancellationToken)
    {
        if (!fecha.HasValue) return BadRequest(new { error = "La fecha es requerida" });
        try { return Ok(await service.ObtenerAsync(fecha.Value, cancellationToken)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("historial")]
    public async Task<IActionResult> Historial([FromQuery] DateOnly? desde, [FromQuery] DateOnly? hasta, CancellationToken cancellationToken)
    {
        if (!desde.HasValue || !hasta.HasValue) return BadRequest(new { error = "Las fechas desde y hasta son requeridas" });
        try { return Ok(await service.ObtenerHistorialAsync(desde.Value, hasta.Value, cancellationToken)); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("pdf")]
    public async Task<IActionResult> Pdf([FromQuery] DateOnly? fecha, CancellationToken cancellationToken)
    {
        if (!fecha.HasValue) return BadRequest(new { error = "La fecha es requerida" });
        try { return File(await pdfService.GenerarAsync(fecha.Value, cancellationToken), "application/pdf", $"Caja-{fecha:yyyy-MM-dd}.pdf"); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
}
