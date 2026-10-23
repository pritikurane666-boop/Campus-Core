namespace InstitutionErp.Domain.Entities;

/// <summary>Type of a pending login challenge.</summary>
public enum LoginChallengeType
{
    /// <summary>User has confirmed 2FA and needs to verify their TOTP code.</summary>
    Verify = 0,

    /// <summary>User has no confirmed 2FA and must set it up before receiving tokens.</summary>
    Setup = 1
}

/// <summary>
/// Stores the encrypted TOTP secret for a user.
/// This entity is NOT a BaseEntity — it has no soft-delete, no CreatedBy audit stamp.
/// It uses user_id as its primary key (1:1 with User).
/// </summary>
public class UserTotp
{
    public Guid UserId { get; set; }

    /// <summary>AES-256-GCM ciphertext of the Base32 TOTP secret. Never stored in plaintext.</summary>
    public byte[] EncryptedSecret { get; set; } = Array.Empty<byte>();

    /// <summary>GCM nonce (12 bytes). Unique per record.</summary>
    public byte[] Nonce { get; set; } = Array.Empty<byte>();

    /// <summary>Key version identifier to support key rotation.</summary>
    public int KeyVersion { get; set; } = 1;

    /// <summary>Set when the user successfully confirms their first TOTP code. Null = pending/unconfirmed.</summary>
    public DateTime? ConfirmedAt { get; set; }

    /// <summary>
    /// The UTC Unix time-step (floor(UnixEpoch / 30)) of the last successfully used TOTP code.
    /// Used to prevent replay attacks — incoming step must be strictly greater.
    /// </summary>
    public long LastUsedStep { get; set; } = -1;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}

/// <summary>
/// Single-use recovery code for 2FA bypass (e.g., lost phone).
/// Stored only as SHA-256 hash — the raw code is shown once at enrollment.
/// </summary>
public class RecoveryCode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }

    /// <summary>SHA-256 hex hash of the raw recovery code.</summary>
    public string CodeHash { get; set; } = string.Empty;

    /// <summary>Set when this code is consumed. Null = available.</summary>
    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}

/// <summary>
/// Short-lived challenge created at the end of the password step.
/// Binds to a specific user and prevents token issuance until 2FA succeeds.
/// </summary>
public class LoginChallenge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public LoginChallengeType Type { get; set; }

    /// <summary>Attempts used so far. Challenge is dead when Attempts >= MaxAttempts.</summary>
    public int Attempts { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }

    /// <summary>Set when the challenge is successfully used (or max-attempt-killed). Single-use.</summary>
    public DateTime? ConsumedAt { get; set; }

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}

/// <summary>
/// A trusted browser/device that bypasses 2FA for up to TrustedDeviceDays days.
/// Only the SHA-256 hash of the raw token is stored; the raw token is sent as a cookie.
/// </summary>
public class TrustedDevice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }

    /// <summary>SHA-256 hex hash of the raw 32-byte token stored in the browser cookie.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }

    /// <summary>Truncated User-Agent string (max 256 chars) for display purposes.</summary>
    public string? UserAgentSummary { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
