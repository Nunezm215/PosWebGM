using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;

namespace PosWeb.Application.Eventos;

public class EventoDetalleCompartidoService
{
    private const int VigenciaDias = 30;
    private readonly IEventoRepository _eventoRepository;
    private readonly PosDbContextLocal _context;
    private readonly TimeProvider _timeProvider;

    public EventoDetalleCompartidoService(IEventoRepository eventoRepository, PosDbContextLocal context, TimeProvider? timeProvider = null)
    {
        _eventoRepository = eventoRepository;
        _context = context;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task<EventoDetalleCompartidoEnlaceDto> GenerarEnlaceAsync(int eventoId, int sucursalId, CancellationToken cancellationToken = default)
    {
        var evento = await ObtenerEventoRequeridoAsync(eventoId, sucursalId, cancellationToken);

        var activos = await _context.EventoDetalleCompartido
            .Where(x => x.ID_EVENTO == eventoId && x.REVOCADO_EN_UTC == null && x.VENCE_EN_UTC > _timeProvider.GetUtcNow().UtcDateTime)
            .ToListAsync(cancellationToken);

        foreach (var activo in activos)
        {
            activo.Revocar(_timeProvider.GetUtcNow().UtcDateTime);
        }

        var ahoraUtc = _timeProvider.GetUtcNow().UtcDateTime;
        var token = GenerarTokenSeguro();
        var entidad = new EventoDetalleCompartido(
            evento.ID_EVENTO,
            CalcularHashToken(token),
            ahoraUtc,
            ahoraUtc.AddDays(VigenciaDias));

        await _context.EventoDetalleCompartido.AddAsync(entidad, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return new EventoDetalleCompartidoEnlaceDto
        {
            EventoId = evento.ID_EVENTO,
            SolicitudId = entidad.ID_EVENTO_DETALLE_COMPARTIDO,
            Token = token,
            UrlPublica = $"/detalle-reserva/{token}",
            CreadoEnUtc = entidad.CREADO_EN_UTC,
            VenceEnUtc = entidad.VENCE_EN_UTC,
        };
    }

    public async Task<EventoDetalleCompartido?> ObtenerActivoPorTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var tokenHash = CalcularHashToken(token);
        var detalle = await _context.EventoDetalleCompartido.FirstOrDefaultAsync(x => x.TOKEN_HASH == tokenHash, cancellationToken);
        if (detalle is null || !detalle.EstaActivo(_timeProvider.GetUtcNow().UtcDateTime))
            return null;

        return detalle;
    }

    private async Task<Evento> ObtenerEventoRequeridoAsync(int eventoId, int sucursalId, CancellationToken cancellationToken)
    {
        var evento = await _eventoRepository.ObtenerPorIdAsync(eventoId, cancellationToken)
            ?? throw new InvalidOperationException("Evento no encontrado");

        if (evento.ID_SUCURSAL != sucursalId)
            throw new InvalidOperationException("Evento no encontrado");

        return evento;
    }

    private static string GenerarTokenSeguro()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Base64UrlEncode(bytes);
    }

    private static string CalcularHashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string Base64UrlEncode(ReadOnlySpan<byte> bytes)
    {
        var base64 = Convert.ToBase64String(bytes);
        return base64.Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }
}
