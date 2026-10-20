using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Application.DTOs;

public class AdmissionDto
{
    public Guid Id { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string Address { get; set; } = string.Empty;
    public string GuardianName { get; set; } = string.Empty;
    public string GuardianPhone { get; set; } = string.Empty;
    public string GuardianEmail { get; set; } = string.Empty;
    public string GuardianRelation { get; set; } = string.Empty;
    public Guid DesiredClassRoomId { get; set; }
    public string DesiredClassName { get; set; } = string.Empty;
    public string? PreviousSchoolName { get; set; }
    public decimal PreviousSchoolPercentage { get; set; }
    public AdmissionStatus Status { get; set; }
    public string? ReviewRemarks { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedStudentId { get; set; }
    public List<AdmissionDocumentDto> Documents { get; set; } = new();
    public List<AdmissionStatusHistoryDto> StatusHistory { get; set; } = new();
}

public class AdmissionDocumentDto
{
    public Guid Id { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public string DownloadUrl { get; set; } = string.Empty;
}

public class AdmissionStatusHistoryDto
{
    public Guid Id { get; set; }
    public AdmissionStatus FromStatus { get; set; }
    public AdmissionStatus ToStatus { get; set; }
    public string? Remarks { get; set; }
    public string? ChangedBy { get; set; }
    public DateTime ChangedAt { get; set; }
}

public record ApplyAdmissionRequest(
    string FirstName,
    string LastName,
    string Email,
    string PhoneNumber,
    DateTime DateOfBirth,
    Gender Gender,
    string Address,
    string GuardianName,
    string GuardianPhone,
    string GuardianEmail,
    string GuardianRelation,
    Guid DesiredClassRoomId,
    string? PreviousSchoolName,
    decimal PreviousSchoolPercentage
);

public record UpdateAdmissionStatusRequest(
    AdmissionStatus NewStatus,
    string? Remarks
);
