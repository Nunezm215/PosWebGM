using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosWeb.Application.Eventos;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;

namespace PosWeb.Controllers;

[ApiController]
[Route("api/eventos")]
[Authorize]
public class EventosController : ControllerBase
{
    private readonly IEventoService _eventoService;
    private readonly ContratoEventoPdfService _contratoEventoPdfService;
    private readonly PosDbContextLocal _context;

    public EventosController(IEventoService eventoService, ContratoEventoPdfService contratoEventoPdfService, PosDbContextLocal context)
    {
        _eventoService = eventoService;
        _contratoEventoPdfService = contratoEventoPdfService;
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearEventoRequestDto request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out var usuarioId, out var sucursalId, out var error))
            return error;

        if (request.ClienteId <= 0 || !_context.Cliente.Any(c => c.ID_CLIENTE == request.ClienteId))
            return NotFound(new { error = $"Cliente con ID {request.ClienteId} no encontrado" });

        try
        {
            var creado = await _eventoService.CrearEventoAsync(request, usuarioId, sucursalId, cancellationToken);
            return CreatedAtAction(nameof(ObtenerPorId), new { id = creado.Id }, creado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<EventoDto>> ObtenerPorId(int id, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        var evento = await _eventoService.ObtenerPorIdAsync(id, sucursalId, cancellationToken);
        if (evento == null)
            return NotFound(new { error = "Evento no encontrado" });

        return Ok(evento);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EventoDto>>> Listar(CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        var eventos = await _eventoService.ListarAsync(sucursalId, cancellationToken);
        return Ok(eventos);
    }

    [HttpGet("rango")]
    public async Task<ActionResult<IReadOnlyList<EventoDto>>> ListarRango([FromQuery] DateOnly desde, [FromQuery] DateOnly hasta, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        try
        {
            var eventos = await _eventoService.ListarPorRangoAsync(desde, hasta, sucursalId, cancellationToken);
            return Ok(eventos);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("disponibilidad")]
    public async Task<ActionResult> Disponibilidad(
        [FromQuery] DateOnly fecha,
        [FromQuery] TimeOnly horaInicio,
        [FromQuery] TimeOnly horaFin,
        [FromQuery] int? eventoIdExcluir,
        CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        try
        {
            var disponible = await _eventoService.EstaDisponibleAsync(fecha, horaInicio, horaFin, sucursalId, eventoIdExcluir, cancellationToken);
            return Ok(disponible);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Editar(int id, [FromBody] EditarEventoRequestDto request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        if (!EsAdminOMas())
            return Forbid();

        if (await _eventoService.ObtenerPorIdAsync(id, sucursalId, cancellationToken) == null)
            return NotFound(new { error = "Evento no encontrado" });

        try
        {
            var editado = await _eventoService.EditarEventoAsync(id, request, cancellationToken);
            return Ok(editado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPatch("{id:int}/estado")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> CambiarEstado(int id, [FromBody] ActualizarEstadoEventoRequestDto request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        if (!EsAdminOMas())
            return Forbid();

        if (await _eventoService.ObtenerPorIdAsync(id, sucursalId, cancellationToken) == null)
            return NotFound(new { error = "Evento no encontrado" });

        try
        {
            var actualizado = await _eventoService.CambiarEstadoAsync(id, request.Estado, cancellationToken);
            return Ok(actualizado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id:int}/cancelar")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Cancelar(int id, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        if (!EsAdminOMas())
            return Forbid();

        if (await _eventoService.ObtenerPorIdAsync(id, sucursalId, cancellationToken) == null)
            return NotFound(new { error = "Evento no encontrado" });

        try
        {
            var cancelado = await _eventoService.CancelarAsync(id, cancellationToken);
            return Ok(cancelado);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id:int}/contrato")]
    public async Task<IActionResult> Contrato(int id, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        var contrato = await _contratoEventoPdfService.GenerarAsync(id, sucursalId, cancellationToken);
        if (contrato is null)
            return NotFound(new { error = "Evento no encontrado" });

        Response.Headers["Content-Disposition"] = $"inline; filename=\"{contrato.FileName}\"";
        return File(contrato.Content, "application/pdf");
    }

    private bool TryGetCurrentContext(out int usuarioId, out int sucursalId, out ActionResult error)
    {
        usuarioId = 0;
        sucursalId = 0;
        error = Unauthorized(new { error = "No autenticado" });

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var sucursalValue = User.FindFirstValue("sucursalId");

        if (!int.TryParse(userIdValue, out usuarioId) || !int.TryParse(sucursalValue, out sucursalId) || usuarioId <= 0 || sucursalId <= 0)
            return false;

        return true;
    }

    private bool EsAdminOMas()
        => User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);
}
