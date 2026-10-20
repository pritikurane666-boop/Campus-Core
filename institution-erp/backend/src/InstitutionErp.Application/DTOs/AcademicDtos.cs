namespace InstitutionErp.Application.DTOs;

public class AcademicYearDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; }
}

public record CreateAcademicYearRequest(string Name, DateTime StartDate, DateTime EndDate, bool IsActive);
public record UpdateAcademicYearRequest(string Name, DateTime StartDate, DateTime EndDate, bool IsActive);

public class ClassRoomDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public Guid AcademicYearId { get; set; }
    public string AcademicYearName { get; set; } = string.Empty;
    public int StudentCount { get; set; }
    public Guid? ClassTeacherId { get; set; }
    public string? ClassTeacherName { get; set; }
    public string? ClassTeacherEmployeeCode { get; set; }
    public string? ClassTeacherEmail { get; set; }
    public string? ClassTeacherPhone { get; set; }
    public int SubjectCount { get; set; }
    public bool IsAttendanceMarkedToday { get; set; }
}

public record CreateClassRoomRequest(string Name, string Section, int Capacity, Guid AcademicYearId);
public record UpdateClassRoomRequest(string Name, string Section, int Capacity, Guid AcademicYearId);
public record AssignClassTeacherRequest(Guid TeacherId, Guid? SubjectId = null);

public class SubjectDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? TeacherId { get; set; }
    public string? TeacherName { get; set; }
    public string? TeacherEmployeeCode { get; set; }
    public bool IsClassTeacher { get; set; }
}

public class SubjectTeacherDto
{
    public Guid TeacherId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string EmployeeCode { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public bool IsAllocatedToSubject { get; set; }
}

public record CreateSubjectRequest(string Name, string Code, string? Description, List<Guid>? TeacherIds = null);
public record UpdateSubjectRequest(string Name, string Code, string? Description);
public record AssociateSubjectTeacherRequest(Guid TeacherId);

public class ClassSubjectDto
{
    public Guid Id { get; set; }
    public Guid ClassRoomId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public Guid SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public string SubjectCode { get; set; } = string.Empty;
}

public record AssignSubjectToClassRequest(Guid ClassRoomId, Guid SubjectId, Guid? TeacherId = null, bool IsClassTeacher = false);
public record AssignClassSubjectTeacherRequest(Guid TeacherId, bool IsClassTeacher = false);

public class TimetableStatusDto
{
    public Guid AcademicYearId { get; set; }
    public string AcademicYearName { get; set; } = string.Empty;
    public bool IsFixed { get; set; }
    public DateTime? FixedAt { get; set; }
    public string? FixedBy { get; set; }
}

