namespace PosWeb.Contracts;

public class CargoExtraEventoDto
{
    public int Id { get; set; }
    public int EventoId { get; set; }
    public string Descripcion { get; set; } = string.Empty;
    public decimal Monto { get; set; }
    public DateTime FechaRegistro { get; set; }
    public bool Anulado { get; set; }
    public DateTime? FechaAnulacion { get; set; }
    public string? MotivoAnulacion { get; set; }
}
