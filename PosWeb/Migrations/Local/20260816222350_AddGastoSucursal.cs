using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
{
    /// <inheritdoc />
    public partial class AddGastoSucursal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ID_SUCURSAL",
                table: "GASTO",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.Sql("UPDATE GASTO SET ID_SUCURSAL = (SELECT ID_SUCURSAL FROM CAJA WHERE CAJA.ID_CAJA = GASTO.ID_CAJA) WHERE ID_CAJA IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_GASTO_ID_SUCURSAL",
                table: "GASTO",
                column: "ID_SUCURSAL");

            migrationBuilder.AddForeignKey(
                name: "FK_GASTO_SUCURSAL_ID_SUCURSAL",
                table: "GASTO",
                column: "ID_SUCURSAL",
                principalTable: "SUCURSAL",
                principalColumn: "ID_SUCURSAL",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GASTO_SUCURSAL_ID_SUCURSAL",
                table: "GASTO");

            migrationBuilder.DropIndex(
                name: "IX_GASTO_ID_SUCURSAL",
                table: "GASTO");

            migrationBuilder.DropColumn(
                name: "ID_SUCURSAL",
                table: "GASTO");
        }
    }
}
