namespace PosWeb.Contracts;
public class CrearPagoEventoRequestDto { public int MedioPagoId { get; set; } public decimal Monto { get; set; } public string? Observacion { get; set; } public string? ReferenciaExterna { get; set; } public string? ClaveIdempotencia { get; set; } }
