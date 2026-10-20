using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Application.DTOs;

public class AttendanceRecordDto
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public AttendanceStatus Status { get; set; }
    public string? Remarks { get; set; }
    public string? MarkedBy { get; set; }
}

public record MarkAttendanceItem(
    Guid StudentId,
    AttendanceStatus Status,
    string? Remarks
);

public record BulkMarkAttendanceRequest(
    Guid ClassRoomId,
    DateTime Date,
    List<MarkAttendanceItem> Records
);

public class StudentAttendanceSummaryDto
{
    public Guid StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public int TotalDays { get; set; }
    public int PresentDays { get; set; }
    public int AbsentDays { get; set; }
    public int LateDays { get; set; }
    public int LeaveDays { get; set; }
    public decimal AttendancePercentage { get; set; }
    public bool IsLowAttendance => AttendancePercentage < 75.0m;
}

public class ClassAttendanceSummaryDto
{
    public Guid ClassRoomId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public int TotalStudents { get; set; }
    public int PresentCount { get; set; }
    public int AbsentCount { get; set; }
    public int LateCount { get; set; }
    public int LeaveCount { get; set; }
    public decimal PresentPercentage { get; set; }
    public bool IsMarked { get; set; }
    public List<AttendanceRecordDto> Records { get; set; } = new();
}
