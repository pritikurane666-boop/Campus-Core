using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InstitutionErp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailOtpToLoginChallenges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "last_otp_sent_at",
                table: "login_challenges",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "otp_code_hash",
                table: "login_challenges",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "last_otp_sent_at",
                table: "login_challenges");

            migrationBuilder.DropColumn(
                name: "otp_code_hash",
                table: "login_challenges");
        }
    }
}
