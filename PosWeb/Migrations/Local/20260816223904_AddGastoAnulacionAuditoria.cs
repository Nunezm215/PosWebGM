using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
{
    /// <inheritdoc />
    public partial class AddGastoAnulacionAuditoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FECHA_ANULACION",
                table: "GASTO",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ID_USUARIO_ANULA",
                table: "GASTO",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MOTIVO_ANULACION",
                table: "GASTO",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GASTO_ID_USUARIO_ANULA",
                table: "GASTO",
                column: "ID_USUARIO_ANULA");

            migrationBuilder.AddForeignKey(
                name: "FK_GASTO_USUARIO_ID_USUARIO_ANULA",
                table: "GASTO",
                column: "ID_USUARIO_ANULA",
                principalTable: "USUARIO",
                principalColumn: "ID_USUARIO",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GASTO_USUARIO_ID_USUARIO_ANULA",
                table: "GASTO");

            migrationBuilder.DropIndex(
                name: "IX_GASTO_ID_USUARIO_ANULA",
                table: "GASTO");

            migrationBuilder.DropColumn(
                name: "FECHA_ANULACION",
                table: "GASTO");

            migrationBuilder.DropColumn(
                name: "ID_USUARIO_ANULA",
                table: "GASTO");

            migrationBuilder.DropColumn(
                name: "MOTIVO_ANULACION",
                table: "GASTO");
        }
    }
}
