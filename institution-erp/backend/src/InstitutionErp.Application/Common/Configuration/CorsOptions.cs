using System.ComponentModel.DataAnnotations;

namespace InstitutionErp.Application.Common.Configuration;

public class CorsOptions
{
    public const string SectionName = "Cors";

    [Required(ErrorMessage = "Cors:AllowedOrigins is required.")]
    public string[] AllowedOrigins { get; set; } = Array.Empty<string>();
}
