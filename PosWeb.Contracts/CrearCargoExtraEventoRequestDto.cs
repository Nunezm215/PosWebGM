namespace PosWeb.Contracts;

public class CrearCargoExtraEventoRequestDto
{
    public string Descripcion { get; set; } = string.Empty;
    public decimal Monto { get; set; }
}
