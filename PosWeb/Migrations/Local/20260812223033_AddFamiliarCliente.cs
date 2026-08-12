using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
{
    /// <inheritdoc />
    public partial class AddFamiliarCliente : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FAMILIAR_CLIENTE",
                columns: table => new
                {
                    ID_FAMILIAR_CLIENTE = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ID_CLIENTE = table.Column<int>(type: "INTEGER", nullable: false),
                    NOMBRE = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    FECHA_NACIMIENTO = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FAMILIAR_CLIENTE", x => x.ID_FAMILIAR_CLIENTE);
                    table.ForeignKey(
                        name: "FK_FAMILIAR_CLIENTE_CLIENTE_ID_CLIENTE",
                        column: x => x.ID_CLIENTE,
                        principalTable: "CLIENTE",
                        principalColumn: "ID_CLIENTE",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FAMILIAR_CLIENTE_ID_CLIENTE",
                table: "FAMILIAR_CLIENTE",
                column: "ID_CLIENTE");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FAMILIAR_CLIENTE");
        }
    }
}
