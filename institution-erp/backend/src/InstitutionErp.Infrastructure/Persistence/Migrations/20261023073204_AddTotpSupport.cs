using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InstitutionErp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTotpSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "default_password",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "login_challenges",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    consumed_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_login_challenges", x => x.id);
                    table.ForeignKey(
                        name: "fk_login_challenges_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recovery_codes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    used_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recovery_codes", x => x.id);
                    table.ForeignKey(
                        name: "fk_recovery_codes_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "trusted_devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    last_used_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    user_agent_summary = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_trusted_devices", x => x.id);
                    table.ForeignKey(
                        name: "fk_trusted_devices_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_totp",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    encrypted_secret = table.Column<byte[]>(type: "bytea", nullable: false),
                    nonce = table.Column<byte[]>(type: "bytea", nullable: false),
                    key_version = table.Column<int>(type: "integer", nullable: false),
                    confirmed_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    last_used_step = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_totp", x => x.user_id);
                    table.ForeignKey(
                        name: "fk_user_totp_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_login_challenges_expires_at",
                table: "login_challenges",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_login_challenges_user_id",
                table: "login_challenges",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_recovery_codes_code_hash",
                table: "recovery_codes",
                column: "code_hash");

            migrationBuilder.CreateIndex(
                name: "ix_recovery_codes_user_id",
                table: "recovery_codes",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_trusted_devices_expires_at",
                table: "trusted_devices",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_trusted_devices_token_hash",
                table: "trusted_devices",
                column: "token_hash");

            migrationBuilder.CreateIndex(
                name: "ix_trusted_devices_user_id",
                table: "trusted_devices",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_user_totp_user_id",
                table: "user_totp",
                column: "user_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "login_challenges");

            migrationBuilder.DropTable(
                name: "recovery_codes");

            migrationBuilder.DropTable(
                name: "trusted_devices");

            migrationBuilder.DropTable(
                name: "user_totp");

            migrationBuilder.DropColumn(
                name: "default_password",
                table: "users");
        }
    }
}
