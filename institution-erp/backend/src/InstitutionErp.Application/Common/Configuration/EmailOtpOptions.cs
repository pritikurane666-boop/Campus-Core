using System.ComponentModel.DataAnnotations;

namespace InstitutionErp.Application.Common.Configuration;

public class EmailOtpOptions
{
    public const string SectionName = "Auth:EmailOtp";

    /// <summary>Globally enable or disable Email OTP verification. Default: true.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Minutes an OTP is valid. Default: 10.</summary>
    [Range(1, 30)]
    public int ExpiryMinutes { get; set; } = 10;

    /// <summary>Maximum incorrect attempts allowed per challenge. Default: 5.</summary>
    [Range(1, 10)]
    public int MaxAttempts { get; set; } = 5;

    /// <summary>Seconds before a user can request resending OTP. Default: 60.</summary>
    [Range(10, 300)]
    public int ResendCooldownSeconds { get; set; } = 60;

    /// <summary>Comma-separated role names that require email OTP. Default: Teacher,Student (Principal bypasses OTP).</summary>
    public string RequiredRoles { get; set; } = "Teacher,Student";

    /// <summary>Returns the parsed set of roles that require Email OTP.</summary>
    public IReadOnlySet<string> GetRequiredRoles()
    {
        if (string.IsNullOrWhiteSpace(RequiredRoles))
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        return RequiredRoles
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }
}
