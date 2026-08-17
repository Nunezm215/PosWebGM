using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosWeb.Application.Exceptions;
using PosWeb.Application.Gastos;
using PosWeb.Contracts;
using PosWeb.Domain;

namespace PosWeb.Controllers;

[ApiController]
[Route("api/gastos")]
[Authorize]
public class GastosController : ControllerBase
{
    private readonly GastoService _gastoService;

    public GastosController(GastoService gastoService)
    {
        _gastoService = gastoService;
    }

    [HttpPost]
    public IActionResult Crear([FromBody] CrearGastoRequest request)
    {
        var userId = GetUserId();
        try
        {
            var result = _gastoService.Crear(request.Monto, request.Detalle, userId,
                fuentePago: request.FuentePago, montoPagadoCaja: request.MontoPagadoCaja);
            return Created($"/api/gastos/{result.Id}", result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (GastoSinCajaActivaException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("simple")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public IActionResult CrearSimple([FromBody] CrearGastoSimpleRequestDto request)
    {
        try { return Created("/api/gastos", _gastoService.CrearSimple(request.Monto, request.Detalle, GetUserId())); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public IActionResult ObtenerPorCaja([FromQuery] int cajaId)
    {
        var items = _gastoService.ObtenerPorCaja(cajaId);
        return Ok(new { items });
    }

    [HttpGet("historial")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public IActionResult ObtenerHistorial(
        [FromQuery] int? excluirCajaId = null,
        [FromQuery] DateTime? fechaDesde = null,
        [FromQuery] DateTime? fechaHasta = null,
        [FromQuery] string? texto = null,
        [FromQuery] string? estado = null,
        [FromQuery] string? q = null)
    {
        var items = _gastoService.ObtenerHistorial(excluirCajaId, fechaDesde, fechaHasta, texto, estado, q);
        return Ok(new { items });
    }

    [HttpPost("{id}/anular")]
    public IActionResult Anular(int id)
    {
        try
        {
            _gastoService.Anular(id);
            return Ok(new { message = "Gasto anulado" });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        return int.Parse(claim?.Value ?? "0");
    }
}
