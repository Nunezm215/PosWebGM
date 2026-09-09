namespace PosWeb.Contracts;

public class EventoDetalleCompartidoEnlaceDto
{
    public int EventoId { get; set; }
    public int SolicitudId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string UrlPublica { get; set; } = string.Empty;
    public DateTime CreadoEnUtc { get; set; }
    public DateTime VenceEnUtc { get; set; }
}
