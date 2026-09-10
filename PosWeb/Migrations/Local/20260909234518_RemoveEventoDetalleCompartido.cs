using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
{
    /// <inheritdoc />
    public partial class RemoveEventoDetalleCompartido : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EVENTO_DETALLE_COMPARTIDO");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EVENTO_DETALLE_COMPARTIDO",
                columns: table => new
                {
                    ID_EVENTO_DETALLE_COMPARTIDO = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CREADO_EN_UTC = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ID_EVENTO = table.Column<int>(type: "INTEGER", nullable: false),
                    REVOCADO_EN_UTC = table.Column<DateTime>(type: "TEXT", nullable: true),
                    TOKEN_HASH = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    VENCE_EN_UTC = table.Column<DateTime>(type: "TEXT", nullable: false)
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
    }
}
