using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Infrastructure;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Api;

/// <summary>
/// Break-glass CLI commands for emergency operations.
/// These are NOT HTTP endpoints — they require direct server/database access to run.
/// 
/// Usage:
///   dotnet run --project InstitutionErp.Api -- reset-2fa --email user@example.com
///
/// This command:
///   - Removes the user's TOTP secret and recovery codes
///   - Revokes all trusted devices and refresh tokens
///   - Forces re-enrollment at next login
///   - Writes an audit log entry
///   - Does NOT disable 2FA for the role (user will be prompted to re-enroll)
/// </summary>
public static class CliRunner
{
    public static async Task<bool> TryRunCliAsync(string[] args)
    {
        if (args.Length == 0) return false;
        if (args[0] != "reset-2fa") return false;

        var email = GetArgValue(args, "--email");
        if (string.IsNullOrWhiteSpace(email))
        {
            Console.Error.WriteLine("[CLI] ERROR: --email argument is required.");
            Console.Error.WriteLine("Usage: dotnet run --project InstitutionErp.Api -- reset-2fa --email user@example.com");
            Environment.Exit(1);
        }

        Console.WriteLine($"[CLI] Break-glass 2FA reset for: {email}");
        Console.WriteLine("[CLI] This operation requires database access and will be audit-logged.");
        Console.Write("[CLI] Type 'YES' to confirm: ");
        var confirm = Console.ReadLine()?.Trim();
        if (confirm != "YES")
        {
            Console.WriteLine("[CLI] Aborted.");
            Environment.Exit(0);
        }

        // Build minimal host for DB access
        var host = Host.CreateDefaultBuilder(args)
            .ConfigureAppConfiguration(config =>
            {
                config.AddEnvironmentVariables();
                config.AddJsonFile("appsettings.json", optional: true);
                config.AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"}.json", optional: true);
            })
            .ConfigureServices((ctx, services) =>
            {
                services.AddInfrastructure(ctx.Configuration);
            })
            .Build();

        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email!.ToLower());
        if (user == null)
        {
            Console.Error.WriteLine($"[CLI] ERROR: User not found: {email}");
            Environment.Exit(1);
        }

        // Delete TOTP record
        var totp = await db.UserTotps.FirstOrDefaultAsync(t => t.UserId == user.Id);
        if (totp != null) db.UserTotps.Remove(totp);

        // Delete recovery codes
        var codes = db.RecoveryCodes.Where(rc => rc.UserId == user.Id);
        db.RecoveryCodes.RemoveRange(codes);

        // Revoke trusted devices
        var devices = db.TrustedDevices.Where(d => d.UserId == user.Id);
        db.TrustedDevices.RemoveRange(devices);

        // Revoke refresh tokens
        var tokens = db.RefreshTokens.Where(rt => rt.UserId == user.Id && !rt.IsRevoked);
        await foreach (var t in tokens.AsAsyncEnumerable())
        {
            t.IsRevoked = true;
        }

        // Audit log
        db.AuditLogs.Add(new InstitutionErp.Domain.Entities.AuditLog
        {
            Action = "TotpBreakGlassCLIReset",
            EntityName = "User",
            EntityId = user.Id.ToString(),
            UserId = null, // CLI — no authenticated user
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new { resetBy = "break-glass-cli", email }),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "BreakGlassCLI"
        });

        await db.SaveChangesAsync();

        Console.WriteLine($"[CLI] SUCCESS: 2FA reset for {email}.");
        Console.WriteLine("[CLI] The user will be required to re-enroll 2FA at their next login.");
        Console.WriteLine("[CLI] All refresh tokens and trusted devices have been revoked.");
        return true;
    }

    private static string? GetArgValue(string[] args, string key)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (string.Equals(args[i], key, StringComparison.OrdinalIgnoreCase))
                return args[i + 1];
        }
        return null;
    }
}
