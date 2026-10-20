using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Application.DTOs;

public class ExamDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public ExamType Type { get; set; }
    public Guid AcademicYearId { get; set; }
    public string AcademicYearName { get; set; } = string.Empty;
    public Guid ClassRoomId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsPublished { get; set; }
    public bool IsLocked { get; set; }
    public DateTime? PublishedAt { get; set; }
    public List<ExamSubjectDto> Subjects { get; set; } = new();
}

public class ExamSubjectDto
{
    public Guid Id { get; set; }
    public Guid ExamId { get; set; }
    public Guid SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public string SubjectCode { get; set; } = string.Empty;
    public decimal MaxMarks { get; set; }
    public decimal PassMarks { get; set; }
    public DateTime ExamDate { get; set; }
    public Guid? TeacherId { get; set; }
    public string? TeacherName { get; set; }
    public bool CanCurrentUserEdit { get; set; }
}

public class CreateExamRequest
{
    public string Name { get; set; } = string.Empty;
    public ExamType? Type { get; set; }
    public string? ExamType { get; set; }
    public Guid? AcademicYearId { get; set; }
    public Guid ClassRoomId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public List<AddExamSubjectRequest>? Subjects { get; set; }
}

public class AddExamSubjectRequest
{
    public Guid SubjectId { get; set; }
    public decimal MaxMarks { get; set; } = 100;
    public decimal PassMarks { get; set; } = 35;
    public DateTime ExamDate { get; set; }
}

public record SaveMarkItem(
    Guid StudentId,
    decimal MarksObtained,
    bool IsAbsent,
    string? Remarks
);

public record SaveMarksRequest(
    Guid ExamSubjectId,
    List<SaveMarkItem> Marks
);

public class SubjectResultDto
{
    public Guid SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public string SubjectCode { get; set; } = string.Empty;
    public decimal MaxMarks { get; set; }
    public decimal PassMarks { get; set; }
    public decimal MarksObtained { get; set; }
    public bool IsAbsent { get; set; }
    public bool IsPassed => !IsAbsent && MarksObtained >= PassMarks;
    public string GradeLetter { get; set; } = string.Empty;
    public string? Remarks { get; set; }
}

public class StudentExamResultDto
{
    public Guid ExamId { get; set; }
    public string ExamName { get; set; } = string.Empty;
    public Guid StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string? AcademicYear { get; set; }
    public List<SubjectResultDto> SubjectResults { get; set; } = new();
    public decimal TotalMarksObtained { get; set; }
    public decimal TotalMaxMarks { get; set; }
    public decimal Percentage { get; set; }
    public string OverallGrade { get; set; } = string.Empty;
    public bool IsOverallPassed { get; set; }
    public int ClassRank { get; set; }
    public decimal AttendancePercentage { get; set; }
}

public class GradeScaleDto
{
    public Guid Id { get; set; }
    public string GradeLetter { get; set; } = string.Empty;
    public decimal MinPercentage { get; set; }
    public decimal MaxPercentage { get; set; }
    public decimal GradePoint { get; set; }
    public string? Description { get; set; }
}

public class ExamMarkEntryDto
{
    public Guid StudentId { get; set; }
    public string RollNumber { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public decimal MarksObtained { get; set; }
    public decimal MaxMarks { get; set; }
    public decimal PassMarks { get; set; }
    public bool IsAbsent { get; set; }
    public string? Remarks { get; set; }
    public bool HasSavedMark { get; set; }
    public Guid ExamSubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public string? EnteredBy { get; set; }
}

public class ClassSubjectMarkDto
{
    public Guid SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public decimal MarksObtained { get; set; }
    public decimal MaxMarks { get; set; }
    public decimal PassMarks { get; set; }
    public bool IsAbsent { get; set; }
    public bool IsPassed { get; set; }
    public string GradeLetter { get; set; } = string.Empty;
    public string? Remarks { get; set; }
}

public class ClassStudentResultDto
{
    public Guid StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public Dictionary<string, ClassSubjectMarkDto> SubjectMarks { get; set; } = new();
    public decimal TotalMarksObtained { get; set; }
    public decimal TotalMaxMarks { get; set; }
    public decimal Percentage { get; set; }
    public string OverallGrade { get; set; } = string.Empty;
    public bool IsOverallPassed { get; set; }
    public int ClassRank { get; set; }
    public decimal AttendancePercentage { get; set; }
}

public class SubjectSummaryDto
{
    public Guid SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public string SubjectCode { get; set; } = string.Empty;
    public decimal MaxMarks { get; set; }
    public decimal PassMarks { get; set; }
    public decimal AverageMarks { get; set; }
    public decimal HighestMarks { get; set; }
    public decimal LowestMarks { get; set; }
    public decimal PassPercentage { get; set; }
}

public class ClassExamAnalyticsDto
{
    public int TotalStudents { get; set; }
    public int EvaluatedStudents { get; set; }
    public int PassedStudents { get; set; }
    public int FailedStudents { get; set; }
    public decimal PassPercentage { get; set; }
    public decimal ClassAveragePercentage { get; set; }
    public decimal HighestPercentage { get; set; }
    public string HighestScorerName { get; set; } = string.Empty;
    public decimal LowestPercentage { get; set; }
    public Dictionary<string, int> GradeDistribution { get; set; } = new();
    public List<SubjectSummaryDto> SubjectSummaries { get; set; } = new();
}

public class ClassExamReportDto
{
    public Guid ExamId { get; set; }
    public string ExamName { get; set; } = string.Empty;
    public ExamType ExamType { get; set; }
    public Guid ClassRoomId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string AcademicYearName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsPublished { get; set; }
    public bool IsLocked { get; set; }
    public DateTime? PublishedAt { get; set; }
    public List<ExamSubjectDto> Subjects { get; set; } = new();
    public List<ClassStudentResultDto> Students { get; set; } = new();
    public ClassExamAnalyticsDto Analytics { get; set; } = new();
}

