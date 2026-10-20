using System.ComponentModel.DataAnnotations;

namespace InstitutionErp.Application.Common.Configuration;

public class AppOptions
{
    public const string SectionName = "App";

    [Required(ErrorMessage = "App:FrontendBaseUrl is required.")]
    public string FrontendBaseUrl { get; set; } = "http://localhost:3000";
}
