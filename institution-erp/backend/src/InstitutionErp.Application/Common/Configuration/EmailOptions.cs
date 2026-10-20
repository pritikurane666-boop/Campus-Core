using System.ComponentModel.DataAnnotations;

namespace InstitutionErp.Application.Common.Configuration;

public class EmailOptions
{
    public const string SectionName = "Email";

    [Required(ErrorMessage = "Email:Provider is required (Brevo or Smtp).")]
    public string Provider { get; set; } = "Smtp";

    public string ApiKey { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email:FromAddress is required.")]
    [EmailAddress(ErrorMessage = "Email:FromAddress must be a valid email address.")]
    public string FromAddress { get; set; } = "notifications@institution.edu";

    [Required(ErrorMessage = "Email:FromName is required.")]
    public string FromName { get; set; } = "CampusCore ERP";

    [Range(1, 100000, ErrorMessage = "Email:DailyLimit must be at least 1.")]
    public int DailyLimit { get; set; } = 300;

    public string SmtpHost { get; set; } = "localhost";
    public int SmtpPort { get; set; } = 1025;
}
