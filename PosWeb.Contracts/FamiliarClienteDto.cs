namespace PosWeb.Contracts;

public class FamiliarClienteDto
{
    public int? Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public DateOnly? FechaNacimiento { get; set; }
}
