namespace PosWeb.Contracts;

public class CrearUsuarioRequestDto
{
    public string Usuario { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? Pin { get; set; }
    public string? Mail { get; set; }
    public string Rol { get; set; } = string.Empty;
}

public class EditarUsuarioRequestDto
{
    public string Usuario { get; set; } = string.Empty;
    public string? Password { get; set; }
    public string? Pin { get; set; }
    public string? Mail { get; set; }
    public string Rol { get; set; } = string.Empty;
}
