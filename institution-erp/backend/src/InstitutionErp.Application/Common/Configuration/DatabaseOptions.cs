using System.ComponentModel.DataAnnotations;

namespace InstitutionErp.Application.Common.Configuration;

public class DatabaseOptions
{
    public const string SectionName = "ConnectionStrings";

    [Required(ErrorMessage = "ConnectionStrings:DefaultConnection is required.")]
    public string DefaultConnection { get; set; } = string.Empty;
}
