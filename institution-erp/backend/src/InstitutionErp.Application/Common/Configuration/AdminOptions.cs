using System.ComponentModel.DataAnnotations;

namespace InstitutionErp.Application.Common.Configuration;

public class AdminOptions
{
    public const string SectionName = "Admin";

    [Required(ErrorMessage = "Admin:Email is required.")]
    [EmailAddress(ErrorMessage = "Admin:Email must be a valid email address.")]
    public string Email { get; set; } = "admin@institution.edu";

    [Required(ErrorMessage = "Admin:Password is required.")]
    public string Password { get; set; } = string.Empty;
}
