using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Application.DTOs;

public class TeacherDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string Qualification { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public DateTime JoiningDate { get; set; }
    public TeacherStatus Status { get; set; }
    public List<TeacherAllocationDto> Allocations { get; set; } = new();
    public string? GeneratedPassword { get; set; }
}

public class CreateTeacherResponse : TeacherDto
{
    public CredentialSlipDto? CredentialSlip { get; set; }
    public string? TemporaryPassword => CredentialSlip?.TemporaryPassword;
}


public record CreateTeacherRequest(
    string FirstName,
    string LastName,
    string Email,
    string? PhoneNumber,
    string? Password,
    string Qualification,
    string Specialization,
    DateTime JoiningDate
);

public record UpdateTeacherRequest(
    string FirstName,
    string LastName,
    string? PhoneNumber,
    string Qualification,
    string Specialization,
    TeacherStatus Status
);

public class TeacherAllocationDto
{
    public Guid Id { get; set; }
    public Guid TeacherId { get; set; }
    public string TeacherName { get; set; } = string.Empty;
    public Guid ClassRoomId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public Guid SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public bool IsClassTeacher { get; set; }
}

public record AllocateTeacherRequest(Guid TeacherId, Guid ClassRoomId, Guid SubjectId, bool IsClassTeacher);

public class TimetableEntryDto
{
    public Guid Id { get; set; }
    public Guid ClassRoomId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public Guid SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public Guid TeacherId { get; set; }
    public string TeacherName { get; set; } = string.Empty;
    public DayOfWeek DayOfWeek { get; set; }
    public int PeriodNumber { get; set; }
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public string? RoomNumber { get; set; }
}

public record CreateTimetableEntryRequest(
    Guid ClassRoomId,
    Guid SubjectId,
    Guid TeacherId,
    DayOfWeek DayOfWeek,
    int PeriodNumber,
    string StartTime,
    string EndTime,
    string? RoomNumber
);

public class TeacherAttendanceDto
{
    public Guid Id { get; set; }
    public Guid TeacherId { get; set; }
    public string TeacherName { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public AttendanceStatus Status { get; set; }
    public string? Remarks { get; set; }
}

public record MarkTeacherAttendanceRequest(Guid TeacherId, DateTime Date, AttendanceStatus Status, string? Remarks);

public record ResetTeacherPasswordRequest(string? NewPassword = null);

