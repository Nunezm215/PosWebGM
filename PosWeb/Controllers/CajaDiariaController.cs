using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosWeb.Application.Cajas;
using PosWeb.Domain;

namespace PosWeb.Controllers;

[ApiController]
[Route("api/caja-diaria")]
[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
public class CajaDiariaController(ICajaDiariaService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Obtener([FromQuery] DateOnly? fecha, CancellationToken cancellationToken)
    {
        if (!fecha.HasValue) return BadRequest(new { error = "La fecha es requerida" });
        try { return Ok(await service.ObtenerAsync(fecha.Value, cancellationToken)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
}
