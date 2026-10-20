using System.ComponentModel.DataAnnotations;

namespace InstitutionErp.Application.Common.Configuration;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required(ErrorMessage = "Jwt:Secret is required.")]
    [MinLength(32, ErrorMessage = "Jwt:Secret must be at least 32 characters (256 bits).")]
    public string Secret { get; set; } = string.Empty;

    [Required(ErrorMessage = "Jwt:Issuer is required.")]
    public string Issuer { get; set; } = "InstitutionErp";

    [Required(ErrorMessage = "Jwt:Audience is required.")]
    public string Audience { get; set; } = "InstitutionErpApp";

    [Range(1, 1440, ErrorMessage = "Jwt:ExpiryMinutes must be between 1 and 1440 minutes.")]
    public int ExpiryMinutes { get; set; } = 15;

    [Range(1, 90, ErrorMessage = "Jwt:RefreshTokenExpiryDays must be between 1 and 90 days.")]
    public int RefreshTokenExpiryDays { get; set; } = 7;
}
