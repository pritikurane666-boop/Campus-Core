using System.ComponentModel.DataAnnotations;

namespace InstitutionErp.Application.Common.Configuration;

public class TotpOptions
{
    public const string SectionName = "Auth:Totp";

    /// <summary>Globally enable or disable TOTP 2FA. Default: true.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Comma-separated role names that require 2FA. Default: Principal,Teacher,Student.</summary>
    public string RequiredRoles { get; set; } = "Principal,Teacher,Student";

    /// <summary>Issuer string embedded in the otpauth URI. Default: CampusCore.</summary>
    public string Issuer { get; set; } = "CampusCore";

    /// <summary>
    /// 32-byte AES-256-GCM key, base64-encoded. REQUIRED in Production.
    /// Generate: [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    /// </summary>
    public string? EncryptionKey { get; set; }

    /// <summary>TOTP window (steps before/after current). Default: 1.</summary>
    [Range(0, 2)]
    public int Window { get; set; } = 1;

    /// <summary>Maximum wrong attempts before a challenge is dead. Default: 5.</summary>
    [Range(1, 10)]
    public int MaxAttempts { get; set; } = 5;

    /// <summary>Days a trusted-device cookie is valid. 0 disables. Default: 30.</summary>
    [Range(0, 365)]
    public int TrustedDeviceDays { get; set; } = 30;

    /// <summary>Number of recovery codes generated at enrollment. Default: 10.</summary>
    [Range(6, 20)]
    public int RecoveryCodeCount { get; set; } = 10;

    /// <summary>Grace days before 2FA enrollment is forced. 0 = forced at next login. Default: 0.</summary>
    [Range(0, 30)]
    public int EnrollmentGraceDays { get; set; } = 0;

    /// <summary>Minutes a login challenge is valid. Default: 10.</summary>
    [Range(5, 30)]
    public int ChallengeExpiryMinutes { get; set; } = 10;

    /// <summary>Returns the parsed set of roles that require TOTP.</summary>
    public IReadOnlySet<string> GetRequiredRoles()
    {
        if (string.IsNullOrWhiteSpace(RequiredRoles))
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        return RequiredRoles
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>Returns the raw 32-byte key. Throws if not configured or wrong length.</summary>
    public byte[] GetEncryptionKeyBytes()
    {
        if (string.IsNullOrWhiteSpace(EncryptionKey))
            throw new InvalidOperationException("Auth:Totp:EncryptionKey is not configured.");

        byte[] keyBytes;
        try
        {
            keyBytes = Convert.FromBase64String(EncryptionKey);
        }
        catch (FormatException)
        {
            throw new InvalidOperationException("Auth:Totp:EncryptionKey is not valid base64.");
        }

        if (keyBytes.Length != 32)
            throw new InvalidOperationException($"Auth:Totp:EncryptionKey must decode to exactly 32 bytes (AES-256). Got {keyBytes.Length}.");

        return keyBytes;
    }
}
