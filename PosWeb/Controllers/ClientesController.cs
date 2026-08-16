using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosWeb.Application.Clientes;
using PosWeb.Contracts;
using PosWeb.Domain;

namespace PosWeb.Controllers;

[ApiController]
[Route("api/clientes")]
[Authorize(Roles = $"{Roles.SuperAdmin},{Roles.Admin}")]
public class ClientesController : ControllerBase
{
    private readonly ClienteService _clienteService;

    public ClientesController(ClienteService clienteService)
    {
        _clienteService = clienteService;
    }

    [HttpGet]
    public IActionResult Listar([FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] bool incluirInactivos = false)
    {
        var result = _clienteService.Listar(q, page, pageSize, incluirInactivos);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public IActionResult Obtener(int id)
    {
        var result = _clienteService.Obtener(id);
        if (result == null)
        {
            return NotFound(new { error = "Cliente no encontrado" });
        }
        return Ok(result);
    }

    [HttpGet("proximos-cumpleanios")]
    public ActionResult<IReadOnlyList<ProximoCumpleaniosResponseDto>> ListarProximosCumpleanios([FromQuery] int dias = 90)
    {
        if (dias < 0 || dias > 365)
        {
            return BadRequest(new { error = "Los días deben estar entre 0 y 365" });
        }

        // Clientes are global in the current model, so this endpoint intentionally does not use sucursalId.
        return Ok(_clienteService.ListarProximosCumpleanios(dias));
    }

    [HttpPost]
    public IActionResult Crear([FromBody] ClienteDto dto)
    {
        var result = _clienteService.Crear(dto);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public IActionResult Actualizar(int id, [FromBody] ClienteDto dto)
    {
        var result = _clienteService.Actualizar(id, dto);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public IActionResult Desactivar(int id)
    {
        _clienteService.Desactivar(id);
        return NoContent();
    }

    [HttpPost("{id}/reactivar")]
    public IActionResult Reactivar(int id)
    {
        _clienteService.Reactivar(id);
        return NoContent();
    }
}
