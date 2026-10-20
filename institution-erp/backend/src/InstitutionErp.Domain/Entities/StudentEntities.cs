using InstitutionErp.Domain.Common;
using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Domain.Entities;

public class Student : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string StudentRegistrationNumber { get; set; } = string.Empty; // e.g. "2026-CLS-0001"
    public string RollNumber { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string BloodGroup { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public StudentStatus Status { get; set; } = StudentStatus.Active;
    public DateTime AdmissionDate { get; set; }

    public Guid ClassRoomId { get; set; }
    public ClassRoom ClassRoom { get; set; } = null!;

    public string? GuardianName { get; set; }
    public string? GuardianPhone { get; set; }
    public string? GuardianEmail { get; set; }
    public string? GuardianRelation { get; set; }

    public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
    public ICollection<ExamMark> ExamMarks { get; set; } = new List<ExamMark>();
    public ICollection<StudentFee> StudentFees { get; set; } = new List<StudentFee>();
}

public class Attendance : BaseEntity
{
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;

    public Guid ClassRoomId { get; set; }
    public ClassRoom ClassRoom { get; set; } = null!;

    public DateTime Date { get; set; }
    public AttendanceStatus Status { get; set; } = AttendanceStatus.Present;
    public string? Remarks { get; set; }
    public string? MarkedBy { get; set; }
}
