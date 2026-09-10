using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
{
    /// <inheritdoc />
    public partial class AddEventoCantidadMayoresMenores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CANTIDAD_MAYORES",
                table: "EVENTO",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CANTIDAD_MENORES",
                table: "EVENTO",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("UPDATE EVENTO SET CANTIDAD_MAYORES = CANTIDAD_INVITADOS, CANTIDAD_MENORES = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CANTIDAD_MAYORES",
                table: "EVENTO");

            migrationBuilder.DropColumn(
                name: "CANTIDAD_MENORES",
                table: "EVENTO");
        }
    }
}
