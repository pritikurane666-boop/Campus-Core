using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Application.DTOs;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Api.Controllers;

[ApiController]
[Route("api/v1/exams")]
[Authorize]
public class ExamsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;

    public ExamsController(ApplicationDbContext db, IAuditLogService auditLogService, ICurrentUserService currentUserService)
    {
        _db = db;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ExamDto>>> GetExams([FromQuery] Guid? classId)
    {
        var query = _db.Exams
            .Include(e => e.AcademicYear)
            .Include(e => e.ClassRoom)
            .Include(e => e.ExamSubjects).ThenInclude(es => es.Subject)
            .AsNoTracking();

        var isAdmin = _currentUserService.IsInRole("HOD");
        Teacher? currentTeacher = null;

        if (_currentUserService.IsInRole("Student"))
        {
            var userEmail = _currentUserService.Email;
            var student = await _db.Students.FirstOrDefaultAsync(s => (_currentUserService.UserId.HasValue && s.UserId == _currentUserService.UserId.Value) || (!string.IsNullOrEmpty(userEmail) && s.User != null && s.User.Email.ToLower() == userEmail.ToLower()));
            if (student != null)
            {
                query = query.Where(e => e.ClassRoomId == student.ClassRoomId);
            }
            else
            {
                query = query.Where(e => false);
            }
        }
        else
        {
            if (classId.HasValue) query = query.Where(e => e.ClassRoomId == classId.Value);

            if (!isAdmin && _currentUserService.IsInRole("Teacher"))
            {
                currentTeacher = await _db.Teachers
                    .Include(t => t.Allocations)
                    .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

                var allocatedClassIds = currentTeacher?.Allocations
                    .Where(a => !a.IsDeleted)
                    .Select(a => a.ClassRoomId)
                    .Distinct()
                    .ToList() ?? new List<Guid>();

                // Strict class isolation: teachers only receive exams belonging to their allocated classes
                query = query.Where(e => allocatedClassIds.Contains(e.ClassRoomId));
            }
            else if (_currentUserService.IsInRole("Parent"))
            {
                query = query.Where(e => e.IsPublished);
            }
        }

        var examsList = await query
            .OrderByDescending(e => e.StartDate)
            .ToListAsync();

        var allAllocations = await _db.TeacherAllocations
            .Include(a => a.Teacher).ThenInclude(t => t.User)
            .Where(a => !a.IsDeleted)
            .ToListAsync();

        var exams = examsList.Select(e => new ExamDto
        {
            Id = e.Id,
            Name = e.Name,
            Type = e.Type,
            AcademicYearId = e.AcademicYearId,
            AcademicYearName = e.AcademicYear?.Name ?? "",
            ClassRoomId = e.ClassRoomId,
            ClassName = e.ClassRoom?.FullName ?? "",
            StartDate = e.StartDate,
            EndDate = e.EndDate,
            IsPublished = e.IsPublished,
            IsLocked = e.IsLocked,
            PublishedAt = e.PublishedAt,
            Subjects = e.ExamSubjects.Select(es =>
            {
                var alloc = allAllocations.FirstOrDefault(a => a.SubjectId == es.SubjectId && (a.ClassRoomId == e.ClassRoomId || a.ClassRoomId == Guid.Empty));
                var canEdit = !isAdmin && _currentUserService.IsInRole("Teacher") && !e.IsLocked && currentTeacher != null && alloc?.TeacherId == currentTeacher.Id;

                return new ExamSubjectDto
                {
                    Id = es.Id,
                    ExamId = es.ExamId,
                    SubjectId = es.SubjectId,
                    SubjectName = es.Subject?.Name ?? "Subject",
                    SubjectCode = es.Subject?.Code ?? "",
                    MaxMarks = es.MaxMarks,
                    PassMarks = es.PassMarks,
                    ExamDate = es.ExamDate,
                    TeacherId = alloc?.TeacherId,
                    TeacherName = alloc?.Teacher?.User?.FullName,
                    CanCurrentUserEdit = canEdit
                };
            }).ToList()
        }).ToList();

        return Ok(exams);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ExamDto>> GetExam(Guid id)
    {
        var e = await _db.Exams
            .Include(e => e.AcademicYear)
            .Include(e => e.ClassRoom)
            .Include(e => e.ExamSubjects).ThenInclude(es => es.Subject)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (e == null) return NotFound();

        var isAdmin = _currentUserService.IsInRole("HOD");
        Teacher? currentTeacher = null;

        if (!isAdmin && _currentUserService.IsInRole("Teacher"))
        {
            currentTeacher = await _db.Teachers
                .Include(t => t.Allocations)
                .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

            var allocatedClassIds = currentTeacher?.Allocations
                .Where(a => !a.IsDeleted)
                .Select(a => a.ClassRoomId)
                .Distinct()
                .ToList() ?? new List<Guid>();

            if (!allocatedClassIds.Contains(e.ClassRoomId))
            {
                return Forbid();
            }
        }

        if (_currentUserService.IsInRole("Student"))
        {
            var userEmail = _currentUserService.Email;
            var student = await _db.Students.FirstOrDefaultAsync(s => s.UserId == _currentUserService.UserId || (!string.IsNullOrEmpty(userEmail) && s.User != null && s.User.Email.ToLower() == userEmail.ToLower()));
            if (student == null || student.ClassRoomId != e.ClassRoomId)
            {
                return Forbid();
            }
        }

        var allAllocations = await _db.TeacherAllocations
            .Include(a => a.Teacher).ThenInclude(t => t.User)
            .Where(a => !a.IsDeleted)
            .ToListAsync();

        return Ok(new ExamDto
        {
            Id = e.Id,
            Name = e.Name,
            Type = e.Type,
            AcademicYearId = e.AcademicYearId,
            AcademicYearName = e.AcademicYear?.Name ?? "",
            ClassRoomId = e.ClassRoomId,
            ClassName = e.ClassRoom?.FullName ?? "",
            StartDate = e.StartDate,
            EndDate = e.EndDate,
            IsPublished = e.IsPublished,
            IsLocked = e.IsLocked,
            PublishedAt = e.PublishedAt,
            Subjects = e.ExamSubjects.Select(es =>
            {
                var alloc = allAllocations.FirstOrDefault(a => a.SubjectId == es.SubjectId && (a.ClassRoomId == e.ClassRoomId || a.ClassRoomId == Guid.Empty));
                var canEdit = !isAdmin && _currentUserService.IsInRole("Teacher") && !e.IsLocked && currentTeacher != null && alloc?.TeacherId == currentTeacher.Id;

                return new ExamSubjectDto
                {
                    Id = es.Id,
                    ExamId = es.ExamId,
                    SubjectId = es.SubjectId,
                    SubjectName = es.Subject?.Name ?? "Subject",
                    SubjectCode = es.Subject?.Code ?? "",
                    MaxMarks = es.MaxMarks,
                    PassMarks = es.PassMarks,
                    ExamDate = es.ExamDate,
                    TeacherId = alloc?.TeacherId,
                    TeacherName = alloc?.Teacher?.User?.FullName,
                    CanCurrentUserEdit = canEdit
                };
            }).ToList()
        });
    }

    [HttpPost]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<ExamDto>> Create([FromBody] CreateExamRequest request)
    {
        var classroom = await _db.Classes.FindAsync(request.ClassRoomId);
        if (classroom == null)
        {
            return BadRequest(new { message = "Selected class was not found." });
        }

        var academicYearId = (request.AcademicYearId.HasValue && request.AcademicYearId.Value != Guid.Empty)
            ? request.AcademicYearId.Value
            : classroom.AcademicYearId;

        // Resolve exam type gracefully from either enum Type or string ExamType
        ExamType resolvedType = ExamType.MidTerm;
        if (request.Type.HasValue)
        {
            resolvedType = request.Type.Value;
        }
        else if (!string.IsNullOrWhiteSpace(request.ExamType))
        {
            var raw = request.ExamType.Trim();
            if (Enum.TryParse<ExamType>(raw, true, out var parsed))
            {
                resolvedType = parsed;
            }
            else if (raw.Equals("Final", StringComparison.OrdinalIgnoreCase))
            {
                resolvedType = ExamType.FinalExam;
            }
            else if (raw.Equals("Unit", StringComparison.OrdinalIgnoreCase))
            {
                resolvedType = ExamType.UnitExam;
            }
        }

        var startDate = request.StartDate != default ? DateTime.SpecifyKind(request.StartDate, DateTimeKind.Utc) : DateTime.UtcNow;
        var endDate = request.EndDate != default ? DateTime.SpecifyKind(request.EndDate, DateTimeKind.Utc) : startDate.AddDays(7);
        if (endDate < startDate) endDate = startDate.AddDays(7);

        var exam = new Exam
        {
            Name = request.Name,
            Type = resolvedType,
            AcademicYearId = academicYearId,
            ClassRoomId = request.ClassRoomId,
            StartDate = startDate,
            EndDate = endDate,
            IsPublished = false,
            IsLocked = false
        };

        if (request.Subjects != null && request.Subjects.Any())
        {
            foreach (var sub in request.Subjects)
            {
                exam.ExamSubjects.Add(new ExamSubject
                {
                    SubjectId = sub.SubjectId,
                    MaxMarks = sub.MaxMarks > 0 ? sub.MaxMarks : 100,
                    PassMarks = sub.PassMarks > 0 ? sub.PassMarks : 35,
                    ExamDate = sub.ExamDate != default ? DateTime.SpecifyKind(sub.ExamDate, DateTimeKind.Utc) : exam.StartDate
                });
            }
        }
        else
        {
            // Auto-populate from ClassSubjects assigned to this classroom
            var classSubjects = await _db.ClassSubjects
                .Where(cs => cs.ClassRoomId == request.ClassRoomId)
                .ToListAsync();

            if (classSubjects.Any())
            {
                int dayOffset = 0;
                foreach (var cs in classSubjects)
                {
                    exam.ExamSubjects.Add(new ExamSubject
                    {
                        SubjectId = cs.SubjectId,
                        MaxMarks = 100,
                        PassMarks = 35,
                        ExamDate = exam.StartDate.AddDays(dayOffset)
                    });
                    dayOffset += 1;
                }
            }
            else
            {
                // If no specific ClassSubjects assigned yet, auto-populate from institution subjects so exam is fully ready
                var allSubjects = await _db.Subjects.ToListAsync();
                int dayOffset = 0;
                foreach (var s in allSubjects)
                {
                    exam.ExamSubjects.Add(new ExamSubject
                    {
                        SubjectId = s.Id,
                        MaxMarks = 100,
                        PassMarks = 35,
                        ExamDate = exam.StartDate.AddDays(dayOffset)
                    });
                    dayOffset += 1;
                }
            }
        }

        _db.Exams.Add(exam);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("CreateExam", "Exam", exam.Id.ToString(), null, request);

        return CreatedAtAction(nameof(GetExam), new { id = exam.Id }, new ExamDto { Id = exam.Id, Name = exam.Name });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<ExamDto>> Update(Guid id, [FromBody] CreateExamRequest request)
    {
        var exam = await _db.Exams
            .Include(e => e.ClassRoom)
            .Include(e => e.AcademicYear)
            .Include(e => e.ExamSubjects)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (exam == null) return NotFound(new { message = "Exam not found." });
        if (exam.IsLocked) return BadRequest(new { message = "Cannot modify a locked examination." });

        ExamType resolvedType = exam.Type;
        if (request.Type.HasValue)
        {
            resolvedType = request.Type.Value;
        }
        else if (!string.IsNullOrWhiteSpace(request.ExamType))
        {
            var raw = request.ExamType.Trim();
            if (Enum.TryParse<ExamType>(raw, true, out var parsed))
            {
                resolvedType = parsed;
            }
            else if (raw.Equals("Final", StringComparison.OrdinalIgnoreCase))
            {
                resolvedType = ExamType.FinalExam;
            }
            else if (raw.Equals("Unit", StringComparison.OrdinalIgnoreCase))
            {
                resolvedType = ExamType.UnitExam;
            }
        }

        exam.Name = request.Name;
        exam.Type = resolvedType;
        if (request.AcademicYearId.HasValue && request.AcademicYearId.Value != Guid.Empty)
        {
            exam.AcademicYearId = request.AcademicYearId.Value;
        }
        if (request.ClassRoomId != Guid.Empty)
        {
            exam.ClassRoomId = request.ClassRoomId;
        }
        if (request.StartDate != default) exam.StartDate = DateTime.SpecifyKind(request.StartDate, DateTimeKind.Utc);
        if (request.EndDate != default) exam.EndDate = DateTime.SpecifyKind(request.EndDate, DateTimeKind.Utc);

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("UpdateExam", "Exam", exam.Id.ToString(), null, request);

        return Ok(new ExamDto { Id = exam.Id, Name = exam.Name });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var exam = await _db.Exams
            .Include(e => e.ExamSubjects).ThenInclude(es => es.Marks)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (exam == null) return NotFound(new { message = "Exam not found." });
        if (exam.IsLocked) return BadRequest(new { message = "Cannot delete a locked examination." });

        foreach (var es in exam.ExamSubjects)
        {
            if (es.Marks.Any()) _db.ExamMarks.RemoveRange(es.Marks);
        }
        if (exam.ExamSubjects.Any()) _db.ExamSubjects.RemoveRange(exam.ExamSubjects);

        exam.IsDeleted = true;
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("DeleteExam", "Exam", id.ToString());
        return Ok(new { message = "Exam deleted successfully." });
    }

    [HttpGet("{id}/marks/{examSubjectId}")]
    public async Task<ActionResult<List<ExamMarkEntryDto>>> GetSubjectMarks(Guid id, Guid examSubjectId)
    {
        var exam = await _db.Exams
            .Include(e => e.ClassRoom)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (exam == null) return NotFound("Exam not found.");

        if (_currentUserService.IsInRole("Student"))
        {
            return StatusCode(403, new { message = "Students are not permitted to view class-wide marks entry rosters." });
        }

        var isAdmin = _currentUserService.IsInRole("HOD");
        if (!isAdmin && _currentUserService.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers
                .Include(t => t.Allocations)
                .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

            var allocatedClassIds = teacher?.Allocations
                .Where(a => !a.IsDeleted)
                .Select(a => a.ClassRoomId)
                .Distinct()
                .ToList() ?? new List<Guid>();

            if (!allocatedClassIds.Contains(exam.ClassRoomId))
            {
                return StatusCode(403, new { message = "You can only view marks for your allocated class cohorts." });
            }
        }

        // Find the exam subject either by ExamSubject.Id or SubjectId
        var examSubject = await _db.ExamSubjects
            .Include(es => es.Subject)
            .FirstOrDefaultAsync(es => (es.Id == examSubjectId || es.SubjectId == examSubjectId) && es.ExamId == id);

        if (examSubject == null) return NotFound("Exam subject not found for this examination.");

        // Retrieve all active students in the cohort classroom
        var students = await _db.Students
            .Include(s => s.User)
            .Where(s => s.ClassRoomId == exam.ClassRoomId && s.Status == StudentStatus.Active)
            .OrderBy(s => s.RollNumber)
            .ToListAsync();

        var existingMarks = await _db.ExamMarks
            .Where(m => m.ExamSubjectId == examSubject.Id)
            .ToListAsync();

        var result = students.Select(s =>
        {
            var mark = existingMarks.FirstOrDefault(m => m.StudentId == s.Id);
            return new ExamMarkEntryDto
            {
                StudentId = s.Id,
                RollNumber = s.RollNumber,
                StudentName = s.User?.FullName ?? "Student",
                MarksObtained = mark?.MarksObtained ?? 0,
                MaxMarks = examSubject.MaxMarks,
                PassMarks = examSubject.PassMarks,
                IsAbsent = mark?.IsAbsent ?? false,
                Remarks = mark?.Remarks,
                HasSavedMark = mark != null,
                ExamSubjectId = examSubject.Id,
                SubjectName = examSubject.Subject?.Name ?? "Subject",
                EnteredBy = mark?.EnteredBy
            };
        }).ToList();

        return Ok(result);
    }

    [HttpPost("{id}/marks")]
    [Authorize]
    public async Task<IActionResult> SaveMarks(Guid id, [FromBody] SaveMarksRequest request)
    {
        var exam = await _db.Exams.FindAsync(id);
        if (exam == null) return NotFound("Exam not found.");

        if (exam.IsLocked)
        {
            return BadRequest(new { message = "Marks entry is locked for this exam." });
        }

        // ROLE RESTRICTION: HOD CANNOT enter marks. Only Teachers can enter marks!
        if (_currentUserService.IsInRole("HOD"))
        {
            return StatusCode(403, new { message = "Administrators are not permitted to enter or modify marks. Score entry is strictly reserved for faculty teachers." });
        }

        if (!_currentUserService.IsInRole("Teacher"))
        {
            return StatusCode(403, new { message = "Only faculty teachers are authorized to enter exam marks." });
        }

        // Find ExamSubject either by ExamSubject.Id or request.ExamSubjectId (which could also be SubjectId)
        var examSubject = await _db.ExamSubjects
            .FirstOrDefaultAsync(es => (es.Id == request.ExamSubjectId || es.SubjectId == request.ExamSubjectId) && es.ExamId == id);
        if (examSubject == null) return NotFound("Exam subject not found.");

        var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);
        if (teacher == null) return Unauthorized("Teacher profile not found for authenticated user.");

        // Teacher resource check: teacher can only enter marks for their allocated subject in this class
        var isSubjectTeacher = await _db.TeacherAllocations.AnyAsync(a =>
            a.TeacherId == teacher.Id &&
            !a.IsDeleted &&
            a.SubjectId == examSubject.SubjectId &&
            (a.ClassRoomId == exam.ClassRoomId || a.ClassRoomId == Guid.Empty));

        if (!isSubjectTeacher)
        {
            return StatusCode(403, new { message = "You can only enter marks for your own allocated subject. Other class subjects are view-only." });
        }

        var existingMarks = await _db.ExamMarks
            .Where(m => m.ExamSubjectId == examSubject.Id)
            .ToListAsync();

        foreach (var item in request.Marks)
        {
            // Validation: 0 <= marks <= max
            if (!item.IsAbsent && (item.MarksObtained < 0 || item.MarksObtained > examSubject.MaxMarks))
            {
                return BadRequest(new { message = $"Marks must be between 0 and {examSubject.MaxMarks}." });
            }

            var mark = existingMarks.FirstOrDefault(m => m.StudentId == item.StudentId);
            if (mark != null)
            {
                mark.MarksObtained = item.MarksObtained;
                mark.IsAbsent = item.IsAbsent;
                mark.Remarks = item.Remarks;
                mark.EnteredBy = _currentUserService.Email ?? "Teacher";
            }
            else
            {
                _db.ExamMarks.Add(new ExamMark
                {
                    ExamSubjectId = examSubject.Id,
                    StudentId = item.StudentId,
                    MarksObtained = item.MarksObtained,
                    IsAbsent = item.IsAbsent,
                    Remarks = item.Remarks,
                    EnteredBy = _currentUserService.Email ?? "Teacher"
                });
            }
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("SaveMarks", "ExamMark", examSubject.Id.ToString(), null, new { count = request.Marks.Count, teacher = _currentUserService.Email });

        return Ok(new { message = "Marks successfully saved and updated in database." });
    }

    [HttpPost("{id}/publish")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> PublishExam(Guid id)
    {
        var exam = await _db.Exams.FindAsync(id);
        if (exam == null) return NotFound();

        exam.IsPublished = true;
        exam.IsLocked = true;
        exam.PublishedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("PublishExam", "Exam", exam.Id.ToString());

        return Ok(new { message = "Exam results published and locked successfully." });
    }
}

[ApiController]
[Route("api/v1/results")]
[Authorize]
public class ResultsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPdfService _pdfService;
    private readonly ICurrentUserService _currentUserService;

    public ResultsController(ApplicationDbContext db, IPdfService pdfService, ICurrentUserService currentUserService)
    {
        _db = db;
        _pdfService = pdfService;
        _currentUserService = currentUserService;
    }

    [HttpGet("me")]
    public async Task<ActionResult<List<StudentExamResultDto>>> GetMyResults()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var userEmail = _currentUserService.Email;
        var student = await _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .FirstOrDefaultAsync(s => s.UserId == _currentUserService.UserId.Value || (!string.IsNullOrEmpty(userEmail) && s.User != null && s.User.Email.ToLower() == userEmail.ToLower()));

        if (student == null) return NotFound("Student record not found for authenticated account.");

        return await GetStudentResults(student.Id);
    }

    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<List<StudentExamResultDto>>> GetStudentResults(Guid studentId)
    {
        var student = await _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null) return NotFound();

        // RBAC check: Student/Parent can only view own results
        if (_currentUserService.IsInRole("Student"))
        {
            var userEmail = _currentUserService.Email;
            if (student.UserId != _currentUserService.UserId && (string.IsNullOrEmpty(userEmail) || student.User == null || student.User.Email.ToLower() != userEmail.ToLower()))
            {
                return Forbid();
            }
        }
        else if (_currentUserService.IsInRole("Parent"))
        {
            var userEmail = _currentUserService.Email;
            if (string.IsNullOrEmpty(userEmail) || string.IsNullOrEmpty(student.GuardianEmail) || student.GuardianEmail.ToLower() != userEmail.ToLower()) return Forbid();
        }
        else if (_currentUserService.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers
                .Include(t => t.Allocations)
                .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

            var allocatedClassIds = teacher?.Allocations
                .Where(a => !a.IsDeleted)
                .Select(a => a.ClassRoomId)
                .Distinct()
                .ToList() ?? new List<Guid>();

            if (!allocatedClassIds.Contains(student.ClassRoomId))
            {
                return Forbid();
            }
        }

        var isStudentOrParent = _currentUserService.IsInRole("Student") || _currentUserService.IsInRole("Parent");

        var examsQuery = _db.Exams
            .Where(e => e.ClassRoomId == student.ClassRoomId)
            .Include(e => e.AcademicYear)
            .Include(e => e.ExamSubjects).ThenInclude(es => es.Subject)
            .AsQueryable();

        if (isStudentOrParent)
        {
            examsQuery = examsQuery.Where(e => e.IsPublished);
        }

        var exams = await examsQuery
            .OrderByDescending(e => e.StartDate)
            .ToListAsync();

        var gradeScales = await _db.GradeScales.OrderByDescending(g => g.MinPercentage).ToListAsync();
        var allClassStudents = await _db.Students.Where(s => s.ClassRoomId == student.ClassRoomId).ToListAsync();

        var attendances = await _db.Attendances.Where(a => a.StudentId == studentId).ToListAsync();
        var attPct = attendances.Count > 0
            ? Math.Round((decimal)attendances.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late) / attendances.Count * 100, 1)
            : 100m;

        var resultList = new List<StudentExamResultDto>();

        foreach (var exam in exams)
        {
            var marks = await _db.ExamMarks
                .Where(m => exam.ExamSubjects.Select(es => es.Id).Contains(m.ExamSubjectId))
                .ToListAsync();

            var studentMarks = marks.Where(m => m.StudentId == studentId).ToList();
            if (isStudentOrParent && !studentMarks.Any())
            {
                continue;
            }

            var subjectResults = new List<SubjectResultDto>();
            decimal totalObtained = 0;
            decimal totalMax = 0;

            foreach (var es in exam.ExamSubjects)
            {
                var mk = studentMarks.FirstOrDefault(m => m.ExamSubjectId == es.Id);
                var obtained = mk?.MarksObtained ?? 0;
                var absent = mk?.IsAbsent ?? false;

                if (!absent) totalObtained += obtained;
                totalMax += es.MaxMarks;

                var subPct = es.MaxMarks > 0 ? (obtained / es.MaxMarks) * 100 : 0;
                var gradeLetter = gradeScales.FirstOrDefault(g => subPct >= g.MinPercentage && subPct <= g.MaxPercentage)?.GradeLetter ?? "N/A";

                subjectResults.Add(new SubjectResultDto
                {
                    SubjectId = es.SubjectId,
                    SubjectName = es.Subject.Name,
                    SubjectCode = es.Subject.Code,
                    MaxMarks = es.MaxMarks,
                    PassMarks = es.PassMarks,
                    MarksObtained = obtained,
                    IsAbsent = absent,
                    GradeLetter = gradeLetter,
                    Remarks = mk?.Remarks
                });
            }

            var overallPct = totalMax > 0 ? Math.Round((totalObtained / totalMax) * 100, 2) : 0;
            var overallGrade = gradeScales.FirstOrDefault(g => overallPct >= g.MinPercentage && overallPct <= g.MaxPercentage)?.GradeLetter ?? "F";
            var isOverallPassed = subjectResults.All(sr => sr.IsPassed);

            // Calculate class rank
            var classTotals = allClassStudents.Select(cs =>
            {
                var csTotal = marks.Where(m => m.StudentId == cs.Id && !m.IsAbsent).Sum(m => m.MarksObtained);
                return new { StudentId = cs.Id, Total = csTotal };
            }).OrderByDescending(x => x.Total).ToList();

            var rank = classTotals.FindIndex(x => x.StudentId == studentId) + 1;

            resultList.Add(new StudentExamResultDto
            {
                ExamId = exam.Id,
                ExamName = exam.Name,
                StudentId = student.Id,
                StudentName = student.User?.FullName ?? "Student",
                RollNumber = student.RollNumber,
                ClassName = student.ClassRoom.FullName,
                AcademicYear = exam.AcademicYear?.Name,
                SubjectResults = subjectResults,
                TotalMarksObtained = totalObtained,
                TotalMaxMarks = totalMax,
                Percentage = overallPct,
                OverallGrade = overallGrade,
                IsOverallPassed = isOverallPassed,
                ClassRank = rank > 0 ? rank : 1,
                AttendancePercentage = attPct
            });
        }

        return Ok(resultList);
    }

    [HttpGet("{examId}/report-card/{studentId}")]
    public async Task<IActionResult> DownloadReportCardPdf(Guid examId, Guid studentId)
    {
        var exam = await _db.Exams
            .Include(e => e.ClassRoom)
            .Include(e => e.ExamSubjects).ThenInclude(es => es.Subject)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null) return NotFound("Exam not found.");

        var student = await _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null) return NotFound("Student not found.");

        // RBAC check: Student/Parent can only download own report card
        if (_currentUserService.IsInRole("Student"))
        {
            var userEmail = _currentUserService.Email;
            if (student.UserId != _currentUserService.UserId && (string.IsNullOrEmpty(userEmail) || student.User == null || student.User.Email.ToLower() != userEmail.ToLower()))
            {
                return Forbid();
            }
        }
        else if (_currentUserService.IsInRole("Parent"))
        {
            var userEmail = _currentUserService.Email;
            if (string.IsNullOrEmpty(userEmail) || string.IsNullOrEmpty(student.GuardianEmail) || student.GuardianEmail.ToLower() != userEmail.ToLower()) return Forbid();
        }
        else if (_currentUserService.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers
                .Include(t => t.Allocations)
                .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

            var allocatedClassIds = teacher?.Allocations
                .Where(a => !a.IsDeleted)
                .Select(a => a.ClassRoomId)
                .Distinct()
                .ToList() ?? new List<Guid>();

            if (!allocatedClassIds.Contains(exam.ClassRoomId) || !allocatedClassIds.Contains(student.ClassRoomId))
            {
                return Forbid();
            }
        }

        // Check publishing requirement for parents
        if (_currentUserService.IsInRole("Parent") && !exam.IsPublished)
        {
            return Forbid("Report cards are only available after results are published.");
        }

        var marks = await _db.ExamMarks
            .Where(m => exam.ExamSubjects.Select(es => es.Id).Contains(m.ExamSubjectId) && m.StudentId == studentId)
            .ToListAsync();

        var resultsList = exam.ExamSubjects.Select(es =>
        {
            var mk = marks.FirstOrDefault(m => m.ExamSubjectId == es.Id)
                     ?? new ExamMark { ExamSubjectId = es.Id, StudentId = studentId, MarksObtained = 0 };
            return (subject: es, mark: mk);
        }).ToList();

        var totalObtained = resultsList.Where(r => !r.mark.IsAbsent).Sum(r => r.mark.MarksObtained);
        var totalMax = resultsList.Sum(r => r.subject.MaxMarks);
        var pct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

        var gradeScales = await _db.GradeScales.OrderByDescending(g => g.MinPercentage).ToListAsync();
        var grade = gradeScales.FirstOrDefault(g => pct >= g.MinPercentage && pct <= g.MaxPercentage)?.GradeLetter ?? "F";

        var attendances = await _db.Attendances.Where(a => a.StudentId == studentId).ToListAsync();
        var attPct = attendances.Count > 0
            ? Math.Round((decimal)attendances.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late) / attendances.Count * 100, 1)
            : 100m;

        var pdfBytes = await _pdfService.GenerateReportCardPdfAsync(student, exam, resultsList, attPct, grade, totalObtained, totalMax, pct, 1);

        return File(pdfBytes, "application/pdf", $"ReportCard_{exam.Name.Replace(" ", "_")}_{student.RollNumber}.pdf");
    }

    [HttpGet("exam/{examId}/class-report")]
    [Authorize(Roles = "HOD,Teacher")]
    public async Task<ActionResult<ClassExamReportDto>> GetClassExamReport(Guid examId)
    {
        var exam = await _db.Exams
            .Include(e => e.ClassRoom)
            .Include(e => e.AcademicYear)
            .Include(e => e.ExamSubjects).ThenInclude(es => es.Subject)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null) return NotFound("Examination not found.");

        var isAdmin = _currentUserService.IsInRole("HOD");
        if (!isAdmin && _currentUserService.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers
                .Include(t => t.Allocations)
                .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

            var allocatedClassIds = teacher?.Allocations
                .Where(a => !a.IsDeleted)
                .Select(a => a.ClassRoomId)
                .Distinct()
                .ToList() ?? new List<Guid>();

            if (!allocatedClassIds.Contains(exam.ClassRoomId))
            {
                return StatusCode(403, new { message = "You can only access exam reports for your allocated classes." });
            }
        }

        var students = await _db.Students
            .Include(s => s.User)
            .Where(s => s.ClassRoomId == exam.ClassRoomId && s.Status == StudentStatus.Active)
            .OrderBy(s => s.RollNumber)
            .ToListAsync();

        var examSubIds = exam.ExamSubjects.Select(es => es.Id).ToList();
        var allMarks = await _db.ExamMarks
            .Where(m => examSubIds.Contains(m.ExamSubjectId))
            .ToListAsync();

        var gradeScales = await _db.GradeScales.OrderByDescending(g => g.MinPercentage).ToListAsync();

        var attendances = await _db.Attendances
            .Where(a => a.ClassRoomId == exam.ClassRoomId)
            .ToListAsync();

        var subjectsDto = exam.ExamSubjects.Select(es => new ExamSubjectDto
        {
            Id = es.Id,
            ExamId = es.ExamId,
            SubjectId = es.SubjectId,
            SubjectName = es.Subject?.Name ?? "Subject",
            SubjectCode = es.Subject?.Code ?? "",
            MaxMarks = es.MaxMarks,
            PassMarks = es.PassMarks,
            ExamDate = es.ExamDate
        }).ToList();

        // Calculate result for each student
        var studentResults = new List<ClassStudentResultDto>();

        foreach (var st in students)
        {
            var stMarks = allMarks.Where(m => m.StudentId == st.Id).ToList();
            var subjectMap = new Dictionary<string, ClassSubjectMarkDto>();

            decimal stTotalObtained = 0;
            decimal stTotalMax = 0;
            bool anyFailed = false;

            foreach (var es in exam.ExamSubjects)
            {
                var mk = stMarks.FirstOrDefault(m => m.ExamSubjectId == es.Id);
                var obtained = mk?.MarksObtained ?? 0;
                var absent = mk?.IsAbsent ?? false;
                var passed = !absent && obtained >= es.PassMarks;

                if (!passed) anyFailed = true;
                if (!absent) stTotalObtained += obtained;
                stTotalMax += es.MaxMarks;

                var subPct = es.MaxMarks > 0 ? (obtained / es.MaxMarks) * 100 : 0;
                var gradeLetter = gradeScales.FirstOrDefault(g => subPct >= g.MinPercentage && subPct <= g.MaxPercentage)?.GradeLetter ?? (absent ? "ABS" : "F");

                subjectMap[es.SubjectId.ToString()] = new ClassSubjectMarkDto
                {
                    SubjectId = es.SubjectId,
                    SubjectName = es.Subject?.Name ?? "Subject",
                    MarksObtained = obtained,
                    MaxMarks = es.MaxMarks,
                    PassMarks = es.PassMarks,
                    IsAbsent = absent,
                    IsPassed = passed,
                    GradeLetter = gradeLetter,
                    Remarks = mk?.Remarks
                };
            }

            var stPct = stTotalMax > 0 ? Math.Round((stTotalObtained / stTotalMax) * 100, 2) : 0;
            var stOverallGrade = gradeScales.FirstOrDefault(g => stPct >= g.MinPercentage && stPct <= g.MaxPercentage)?.GradeLetter ?? "F";

            var stAttList = attendances.Where(a => a.StudentId == st.Id).ToList();
            var stAttPct = stAttList.Count > 0
                ? Math.Round((decimal)stAttList.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late) / stAttList.Count * 100, 1)
                : 100m;

            studentResults.Add(new ClassStudentResultDto
            {
                StudentId = st.Id,
                StudentName = st.User?.FullName ?? "Student",
                RollNumber = st.RollNumber,
                SubjectMarks = subjectMap,
                TotalMarksObtained = stTotalObtained,
                TotalMaxMarks = stTotalMax,
                Percentage = stPct,
                OverallGrade = stOverallGrade,
                IsOverallPassed = !anyFailed,
                AttendancePercentage = stAttPct
            });
        }

        // Calculate class ranks based on TotalMarksObtained
        var ranked = studentResults.OrderByDescending(sr => sr.TotalMarksObtained).ToList();
        for (int i = 0; i < ranked.Count; i++)
        {
            ranked[i].ClassRank = i + 1;
        }

        // Analytics
        var totalStudents = students.Count;
        var evaluatedStudents = studentResults.Count(sr => sr.SubjectMarks.Values.Any(sm => sm.MarksObtained > 0 || sm.IsAbsent));
        var passedStudents = studentResults.Count(sr => sr.IsOverallPassed);
        var failedStudents = totalStudents - passedStudents;
        var passPercentage = totalStudents > 0 ? Math.Round((decimal)passedStudents / totalStudents * 100, 1) : 0;
        var classAveragePct = totalStudents > 0 ? Math.Round(studentResults.Average(sr => sr.Percentage), 1) : 0;

        var highestScorer = ranked.FirstOrDefault();
        var lowestScorer = ranked.LastOrDefault();

        // Grade distribution
        var gradeDist = new Dictionary<string, int>
        {
            { "A+", studentResults.Count(s => s.OverallGrade == "A+") },
            { "A", studentResults.Count(s => s.OverallGrade == "A") },
            { "B", studentResults.Count(s => s.OverallGrade == "B") },
            { "C", studentResults.Count(s => s.OverallGrade == "C") },
            { "D", studentResults.Count(s => s.OverallGrade == "D") },
            { "F", studentResults.Count(s => s.OverallGrade == "F") }
        };

        // Subject summaries
        var subjectSummaries = exam.ExamSubjects.Select(es =>
        {
            var subMarks = allMarks.Where(m => m.ExamSubjectId == es.Id && !m.IsAbsent).ToList();
            var avg = subMarks.Count > 0 ? Math.Round(subMarks.Average(m => m.MarksObtained), 1) : 0;
            var high = subMarks.Count > 0 ? subMarks.Max(m => m.MarksObtained) : 0;
            var low = subMarks.Count > 0 ? subMarks.Min(m => m.MarksObtained) : 0;
            var passedCount = subMarks.Count(m => m.MarksObtained >= es.PassMarks);
            var passPct = totalStudents > 0 ? Math.Round((decimal)passedCount / totalStudents * 100, 1) : 0;

            return new SubjectSummaryDto
            {
                SubjectId = es.SubjectId,
                SubjectName = es.Subject?.Name ?? "Subject",
                SubjectCode = es.Subject?.Code ?? "",
                MaxMarks = es.MaxMarks,
                PassMarks = es.PassMarks,
                AverageMarks = avg,
                HighestMarks = high,
                LowestMarks = low,
                PassPercentage = passPct
            };
        }).ToList();

        var analytics = new ClassExamAnalyticsDto
        {
            TotalStudents = totalStudents,
            EvaluatedStudents = evaluatedStudents,
            PassedStudents = passedStudents,
            FailedStudents = failedStudents,
            PassPercentage = passPercentage,
            ClassAveragePercentage = classAveragePct,
            HighestPercentage = highestScorer?.Percentage ?? 0,
            HighestScorerName = highestScorer?.StudentName ?? "N/A",
            LowestPercentage = lowestScorer?.Percentage ?? 0,
            GradeDistribution = gradeDist,
            SubjectSummaries = subjectSummaries
        };

        return Ok(new ClassExamReportDto
        {
            ExamId = exam.Id,
            ExamName = exam.Name,
            ExamType = exam.Type,
            ClassRoomId = exam.ClassRoomId,
            ClassName = exam.ClassRoom?.FullName ?? "Class",
            AcademicYearName = exam.AcademicYear?.Name ?? "",
            StartDate = exam.StartDate,
            EndDate = exam.EndDate,
            IsPublished = exam.IsPublished,
            IsLocked = exam.IsLocked,
            PublishedAt = exam.PublishedAt,
            Subjects = subjectsDto,
            Students = studentResults,
            Analytics = analytics
        });
    }

    [HttpGet("exam/{examId}/export-csv")]
    [Authorize(Roles = "HOD,Teacher")]
    public async Task<IActionResult> ExportClassExamCsv(Guid examId)
    {
        var reportRes = await GetClassExamReport(examId);
        if (reportRes.Result is not OkObjectResult ok || ok.Value is not ClassExamReportDto report)
        {
            return NotFound("Report data could not be generated for this exam.");
        }

        var sb = new StringBuilder();
        // Header row
        var header = new List<string> { "Roll Number", "Student Name", "Class" };
        foreach (var sub in report.Subjects)
        {
            header.Add($"\"{sub.SubjectName} (Max {sub.MaxMarks:F0})\"");
        }
        header.AddRange(new[] { "Total Marks", "Max Marks", "Percentage (%)", "Grade", "Rank", "Result", "Attendance (%)" });
        sb.AppendLine(string.Join(",", header));

        // Rows
        foreach (var st in report.Students.OrderBy(s => s.ClassRank))
        {
            var row = new List<string>
            {
                $"\"{st.RollNumber}\"",
                $"\"{st.StudentName}\"",
                $"\"{report.ClassName}\""
            };

            foreach (var sub in report.Subjects)
            {
                if (st.SubjectMarks.TryGetValue(sub.SubjectId.ToString(), out var sm))
                {
                    row.Add(sm.IsAbsent ? "\"ABS\"" : sm.MarksObtained.ToString("F1"));
                }
                else
                {
                    row.Add("0");
                }
            }

            row.Add(st.TotalMarksObtained.ToString("F1"));
            row.Add(st.TotalMaxMarks.ToString("F0"));
            row.Add(st.Percentage.ToString("F2"));
            row.Add($"\"{st.OverallGrade}\"");
            row.Add(st.ClassRank.ToString());
            row.Add(st.IsOverallPassed ? "\"PASSED\"" : "\"FAILED\"");
            row.Add(st.AttendancePercentage.ToString("F1"));

            sb.AppendLine(string.Join(",", row));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"Class_Marks_{report.ExamName.Replace(" ", "_")}_{report.ClassName.Replace(" ", "_")}_{DateTime.UtcNow:yyyyMMdd}.csv";
        return File(bytes, "text/csv", fileName);
    }
}
