using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
{
    /// <inheritdoc />
    public partial class AddOportunidadCumpleaniosAtendida : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OPORTUNIDAD_CUMPLEANIOS_ATENDIDA",
                columns: table => new
                {
                    ID_OPORTUNIDAD_CUMPLEANIOS_ATENDIDA = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TIPO_PERSONA = table.Column<int>(type: "INTEGER", nullable: false),
                    ID_PERSONA = table.Column<int>(type: "INTEGER", nullable: false),
                    PROXIMO_CUMPLEANIOS = table.Column<DateOnly>(type: "date", nullable: false),
                    FECHA_ATENDIDO = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OPORTUNIDAD_CUMPLEANIOS_ATENDIDA", x => x.ID_OPORTUNIDAD_CUMPLEANIOS_ATENDIDA);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OPORTUNIDAD_CUMPLEANIOS_ATENDIDA_TIPO_PERSONA_ID_PERSONA_PROXIMO_CUMPLEANIOS",
                table: "OPORTUNIDAD_CUMPLEANIOS_ATENDIDA",
                columns: new[] { "TIPO_PERSONA", "ID_PERSONA", "PROXIMO_CUMPLEANIOS" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "OPORTUNIDAD_CUMPLEANIOS_ATENDIDA");
        }
    }
}
