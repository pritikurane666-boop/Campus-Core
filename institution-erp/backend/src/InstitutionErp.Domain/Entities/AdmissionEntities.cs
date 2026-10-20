using InstitutionErp.Domain.Common;
using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Domain.Entities;

public class Admission : BaseEntity
{
    public string ReferenceNumber { get; set; } = string.Empty; // e.g. "ADM-2026-0001"
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName => $"{FirstName} {LastName}".Trim();
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string Address { get; set; } = string.Empty;

    public string GuardianName { get; set; } = string.Empty;
    public string GuardianPhone { get; set; } = string.Empty;
    public string GuardianEmail { get; set; } = string.Empty;
    public string GuardianRelation { get; set; } = "Parent";

    public Guid DesiredClassRoomId { get; set; }
    public ClassRoom DesiredClassRoom { get; set; } = null!;

    public string? PreviousSchoolName { get; set; }
    public decimal PreviousSchoolPercentage { get; set; }

    public AdmissionStatus Status { get; set; } = AdmissionStatus.Submitted;
    public string? ReviewRemarks { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewedBy { get; set; }

    public Guid? CreatedStudentId { get; set; }
    public Student? CreatedStudent { get; set; }

    public ICollection<AdmissionDocument> Documents { get; set; } = new List<AdmissionDocument>();
    public ICollection<AdmissionStatusHistory> StatusHistory { get; set; } = new List<AdmissionStatusHistory>();
}

public class AdmissionDocument : BaseEntity
{
    public Guid AdmissionId { get; set; }
    public Admission Admission { get; set; } = null!;

    public string DocumentType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string ContentType { get; set; } = string.Empty;
}

public class AdmissionStatusHistory : BaseEntity
{
    public Guid AdmissionId { get; set; }
    public Admission Admission { get; set; } = null!;

    public AdmissionStatus FromStatus { get; set; }
    public AdmissionStatus ToStatus { get; set; }
    public string? Remarks { get; set; }
    public string? ChangedBy { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
}
