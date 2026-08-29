using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
{
    /// <inheritdoc />
    public partial class AddEventoDetalleCompartido : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EVENTO_DETALLE_COMPARTIDO",
                columns: table => new
                {
                    ID_EVENTO_DETALLE_COMPARTIDO = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ID_EVENTO = table.Column<int>(type: "INTEGER", nullable: false),
                    TOKEN_HASH = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CREADO_EN_UTC = table.Column<DateTime>(type: "TEXT", nullable: false),
                    VENCE_EN_UTC = table.Column<DateTime>(type: "TEXT", nullable: false),
                    REVOCADO_EN_UTC = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EVENTO_DETALLE_COMPARTIDO", x => x.ID_EVENTO_DETALLE_COMPARTIDO);
                    table.ForeignKey(
                        name: "FK_EVENTO_DETALLE_COMPARTIDO_EVENTO_ID_EVENTO",
                        column: x => x.ID_EVENTO,
                        principalTable: "EVENTO",
                        principalColumn: "ID_EVENTO",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EVENTO_DETALLE_COMPARTIDO_ID_EVENTO",
                table: "EVENTO_DETALLE_COMPARTIDO",
                column: "ID_EVENTO");

            migrationBuilder.CreateIndex(
                name: "IX_EVENTO_DETALLE_COMPARTIDO_TOKEN_HASH",
                table: "EVENTO_DETALLE_COMPARTIDO",
                column: "TOKEN_HASH",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EVENTO_DETALLE_COMPARTIDO");
        }
    }
}
