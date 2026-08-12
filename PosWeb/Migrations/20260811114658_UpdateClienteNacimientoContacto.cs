using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations
{
    /// <inheritdoc />
    public partial class UpdateClienteNacimientoContacto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "NRO_DOCUMENTO",
                table: "CLIENTE",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "FECHA_NACIMIENTO",
                table: "CLIENTE",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FECHA_NACIMIENTO",
                table: "CLIENTE");

            migrationBuilder.UpdateData(
                table: "CLIENTE",
                keyColumn: "NRO_DOCUMENTO",
                keyValue: null,
                column: "NRO_DOCUMENTO",
                value: "");

            migrationBuilder.AlterColumn<string>(
                name: "NRO_DOCUMENTO",
                table: "CLIENTE",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
