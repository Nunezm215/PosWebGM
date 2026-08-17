namespace PosWeb.Contracts;

public class CajaMensualDto
{
    public int Anio { get; set; }
    public int Mes { get; set; }
    public DateOnly Desde { get; set; }
    public DateOnly Hasta { get; set; }
    public decimal TotalIngresos { get; set; }
    public decimal TotalEgresos { get; set; }
    public decimal Resultado { get; set; }
    public int EventosRealizados { get; set; }
    public List<MedioPagoCajaDto> IngresosPorMedio { get; set; } = [];
    public List<CajaDiariaResumenDto> Dias { get; set; } = [];
}
