using InstitutionErp.Domain.Common;
using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Domain.Entities;

public class Exam : BaseEntity
{
    public string Name { get; set; } = string.Empty; // e.g. "Mid Term Examinations 2026"
    public ExamType Type { get; set; } = ExamType.MidTerm;

    public Guid AcademicYearId { get; set; }
    public AcademicYear AcademicYear { get; set; } = null!;

    public Guid ClassRoomId { get; set; }
    public ClassRoom ClassRoom { get; set; } = null!;

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsPublished { get; set; } = false;
    public bool IsLocked { get; set; } = false;
    public DateTime? PublishedAt { get; set; }

    public ICollection<ExamSubject> ExamSubjects { get; set; } = new List<ExamSubject>();
}

public class ExamSubject : BaseEntity
{
    public Guid ExamId { get; set; }
    public Exam Exam { get; set; } = null!;

    public Guid SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    public decimal MaxMarks { get; set; } = 100;
    public decimal PassMarks { get; set; } = 35;
    public DateTime ExamDate { get; set; }

    public ICollection<ExamMark> Marks { get; set; } = new List<ExamMark>();
}

public class ExamMark : BaseEntity
{
    public Guid ExamSubjectId { get; set; }
    public ExamSubject ExamSubject { get; set; } = null!;

    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;

    public decimal MarksObtained { get; set; }
    public bool IsAbsent { get; set; } = false;
    public string? Remarks { get; set; }
    public string? EnteredBy { get; set; }
}

public class GradeScale : BaseEntity
{
    public string GradeLetter { get; set; } = string.Empty; // e.g. "A+", "A", "B", "C", "F"
    public decimal MinPercentage { get; set; }
    public decimal MaxPercentage { get; set; }
    public decimal GradePoint { get; set; }
    public string? Description { get; set; } // e.g. "Outstanding"
}
