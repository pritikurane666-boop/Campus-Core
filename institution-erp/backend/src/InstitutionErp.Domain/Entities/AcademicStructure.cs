using InstitutionErp.Domain.Common;

namespace InstitutionErp.Domain.Entities;

public class AcademicYear : BaseEntity
{
    public string Name { get; set; } = string.Empty; // e.g. "2026-2027"
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; }

    public ICollection<ClassRoom> Classes { get; set; } = new List<ClassRoom>();
}

public class ClassRoom : BaseEntity
{
    public string Name { get; set; } = string.Empty; // e.g. "Grade 10" or "B.Tech CSE"
    public string Section { get; set; } = string.Empty; // e.g. "A"
    public string FullName => string.IsNullOrWhiteSpace(Section) ? Name : $"{Name} - {Section}";
    public int Capacity { get; set; } = 40;

    public Guid AcademicYearId { get; set; }
    public AcademicYear AcademicYear { get; set; } = null!;

    public ICollection<Student> Students { get; set; } = new List<Student>();
    public ICollection<ClassSubject> ClassSubjects { get; set; } = new List<ClassSubject>();
    public ICollection<TeacherAllocation> Allocations { get; set; } = new List<TeacherAllocation>();
    public ICollection<TimetableEntry> TimetableEntries { get; set; } = new List<TimetableEntry>();
}

public class Subject : BaseEntity
{
    public string Name { get; set; } = string.Empty; // e.g. "Mathematics"
    public string Code { get; set; } = string.Empty; // e.g. "MATH101"
    public string? Description { get; set; }

    public ICollection<ClassSubject> ClassSubjects { get; set; } = new List<ClassSubject>();
}

public class ClassSubject : BaseEntity
{
    public Guid ClassRoomId { get; set; }
    public ClassRoom ClassRoom { get; set; } = null!;

    public Guid SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    public ICollection<TeacherAllocation> Allocations { get; set; } = new List<TeacherAllocation>();
}
