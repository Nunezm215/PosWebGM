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
    private readonly EventoDetalleCompartidoService _eventoDetalleCompartidoService;
    private readonly ContratoEventoPdfService _contratoEventoPdfService;
    private readonly EventoDetallePdfService _eventoDetallePdfService;
    private readonly PosDbContextLocal _context;

    public EventosController(IEventoService eventoService, EventoDetalleCompartidoService eventoDetalleCompartidoService, ContratoEventoPdfService contratoEventoPdfService, EventoDetallePdfService eventoDetallePdfService, PosDbContextLocal context)
    {
        _eventoService = eventoService;
        _eventoDetalleCompartidoService = eventoDetalleCompartidoService;
        _contratoEventoPdfService = contratoEventoPdfService;
        _eventoDetallePdfService = eventoDetallePdfService;
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

    [HttpGet("buscar")]
    public async Task<ActionResult<IReadOnlyList<BuscarEventoResponseDto>>> Buscar([FromQuery] string q, [FromQuery] int limit = 10, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        try
        {
            var resultados = await _eventoService.BuscarGlobalAsync(sucursalId, q, limit, cancellationToken);
            return Ok(resultados);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("disponibilidad")]
    public async Task<ActionResult<DisponibilidadEventoResponseDto>> Disponibilidad(
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
            var disponibilidad = await _eventoService.ObtenerDisponibilidadAsync(fecha, horaInicio, horaFin, sucursalId, eventoIdExcluir, cancellationToken);
            return Ok(disponibilidad);
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

    [HttpGet("{eventoId:int}/cargos")]
    public async Task<ActionResult<IReadOnlyList<CargoExtraEventoDto>>> ListarCargos(int eventoId, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error)) return error;
        if (eventoId <= 0 || await _eventoService.ObtenerPorIdAsync(eventoId, sucursalId, cancellationToken) == null)
            return NotFound(new { error = "Evento no encontrado" });

        return Ok(await _eventoService.ListarCargosExtraAsync(eventoId, cancellationToken));
    }

    [HttpPost("{eventoId:int}/cargos")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> AgregarCargo(int eventoId, [FromBody] CrearCargoExtraEventoRequestDto request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out var usuarioId, out var sucursalId, out var error)) return error;
        if (!EsAdminOMas()) return Forbid();
        if (eventoId <= 0 || await _eventoService.ObtenerPorIdAsync(eventoId, sucursalId, cancellationToken) == null)
            return NotFound(new { error = "Evento no encontrado" });

        try
        {
            var creado = await _eventoService.AgregarCargoExtraAsync(eventoId, request, usuarioId, cancellationToken);
            return CreatedAtAction(nameof(ListarCargos), new { eventoId }, creado);
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

    [HttpPost("{eventoId:int}/cargos/{cargoId:int}/anular")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> AnularCargo(int eventoId, int cargoId, [FromBody] AnularCargoExtraEventoRequestDto request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out var usuarioId, out var sucursalId, out var error)) return error;
        if (!EsAdminOMas()) return Forbid();
        if (eventoId <= 0 || await _eventoService.ObtenerPorIdAsync(eventoId, sucursalId, cancellationToken) == null)
            return NotFound(new { error = "Evento no encontrado" });

        try
        {
            await _eventoService.AnularCargoExtraAsync(eventoId, cargoId, request, usuarioId, cancellationToken);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return ex.Message.Contains("no encontrado", StringComparison.OrdinalIgnoreCase) || ex.Message.Contains("no pertenece", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = ex.Message })
                : BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{eventoId:int}/pagos")]
    public async Task<ActionResult<IReadOnlyList<PagoEventoDto>>> ListarPagos(int eventoId, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error)) return error;
        if (eventoId <= 0 || await _eventoService.ObtenerPorIdAsync(eventoId, sucursalId, cancellationToken) is null)
            return NotFound(new { error = "Evento no encontrado" });
        return Ok(await _eventoService.ListarPagosEventoAsync(eventoId, cancellationToken));
    }

    [HttpGet("{eventoId:int}/resumen-financiero")]
    public async Task<ActionResult<ResumenFinancieroEventoDto>> ObtenerResumenFinanciero(int eventoId, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error)) return error;
        if (eventoId <= 0 || await _eventoService.ObtenerPorIdAsync(eventoId, sucursalId, cancellationToken) is null)
            return NotFound(new { error = "Evento no encontrado" });
        return Ok(await _eventoService.ObtenerResumenFinancieroAsync(eventoId, cancellationToken));
    }

    [HttpPost("{eventoId:int}/detalle-compartido")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> CrearDetalleCompartido(int eventoId, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error)) return error;
        if (!EsAdminOMas()) return Forbid();
        if (eventoId <= 0 || await _eventoService.ObtenerPorIdAsync(eventoId, sucursalId, cancellationToken) is null)
            return NotFound(new { error = "Evento no encontrado" });

        try
        {
            var enlace = await _eventoDetalleCompartidoService.GenerarEnlaceAsync(eventoId, sucursalId, cancellationToken);
            return CreatedAtAction(nameof(DetalleCompartidoPdfPublico), new { token = enlace.Token }, enlace);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpGet("detalle-compartido/{token}")]
    public async Task<IActionResult> DetalleCompartidoPdfPublico(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
            return NotFound(new { error = "Detalle no encontrado" });

        var detalle = await _eventoDetalleCompartidoService.ObtenerActivoPorTokenAsync(token, cancellationToken);
        if (detalle is null)
            return NotFound(new { error = "Detalle no encontrado" });

        var evento = await _eventoService.ObtenerPorIdAsync(detalle.ID_EVENTO, null, cancellationToken);
        if (evento is null)
            return NotFound(new { error = "Evento no encontrado" });

        var pdf = await _eventoDetallePdfService.GenerarAsync(evento.Id, evento.SucursalId, cancellationToken);
        if (pdf is null)
            return NotFound(new { error = "Evento no encontrado" });

        Response.Headers["Content-Disposition"] = $"inline; filename=\"{pdf.FileName}\"";
        return File(pdf.Content, "application/pdf");
    }

    [HttpPost("{eventoId:int}/pagos")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> RegistrarPago(int eventoId, [FromBody] CrearPagoEventoRequestDto request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out var usuarioId, out var sucursalId, out var error)) return error;
        if (!EsAdminOMas()) return Forbid();
        if (eventoId <= 0 || await _eventoService.ObtenerPorIdAsync(eventoId, sucursalId, cancellationToken) is null)
            return NotFound(new { error = "Evento no encontrado" });
        try
        {
            var pago = await _eventoService.RegistrarPagoEventoAsync(eventoId, request, usuarioId, cancellationToken);
            return CreatedAtAction(nameof(ListarPagos), new { eventoId }, pago);
        }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("{eventoId:int}/pagos/{pagoId:int}/anular")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> AnularPago(int eventoId, int pagoId, [FromBody] AnularPagoEventoRequestDto request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out var usuarioId, out var sucursalId, out var error)) return error;
        if (!EsAdminOMas()) return Forbid();
        if (eventoId <= 0 || await _eventoService.ObtenerPorIdAsync(eventoId, sucursalId, cancellationToken) is null)
            return NotFound(new { error = "Evento no encontrado" });
        try
        {
            await _eventoService.AnularPagoEventoAsync(eventoId, pagoId, request, usuarioId, cancellationToken);
            var pago = (await _eventoService.ListarPagosEventoAsync(eventoId, cancellationToken)).SingleOrDefault(p => p.Id == pagoId);
            return pago is null ? NotFound(new { error = "Pago no encontrado" }) : Ok(pago);
        }
        catch (ArgumentException ex) { return ex.Message.Contains("no pertenece", StringComparison.OrdinalIgnoreCase) ? NotFound(new { error = ex.Message }) : BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return ex.Message.Contains("no encontrado", StringComparison.OrdinalIgnoreCase) ? NotFound(new { error = ex.Message }) : BadRequest(new { error = ex.Message }); }
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

    [HttpGet("{id:int}/detalle-pdf")]
    public async Task<IActionResult> DetallePdf(int id, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentContext(out _, out var sucursalId, out var error))
            return error;

        var detalle = await _eventoDetallePdfService.GenerarAsync(id, sucursalId, cancellationToken);
        if (detalle is null)
            return NotFound(new { error = "Evento no encontrado" });

        Response.Headers["Content-Disposition"] = $"inline; filename=\"{detalle.FileName}\"";
        return File(detalle.Content, "application/pdf");
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
