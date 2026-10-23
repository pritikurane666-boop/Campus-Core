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
[Route("api/v1/academic-years")]
[Authorize]
public class AcademicYearsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public AcademicYearsController(ApplicationDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<AcademicYearDto>>> GetAcademicYears()
    {
        var years = await _db.AcademicYears
            .OrderByDescending(y => y.StartDate)
            .Select(y => new AcademicYearDto
            {
                Id = y.Id,
                Name = y.Name,
                StartDate = y.StartDate,
                EndDate = y.EndDate,
                IsActive = y.IsActive
            })
            .ToListAsync();

        return Ok(years);
    }

    [HttpPost]
    [Authorize(Roles = "Principal")]
    public async Task<ActionResult<AcademicYearDto>> Create([FromBody] CreateAcademicYearRequest request)
    {
        if (request.IsActive)
        {
            var activeYears = await _db.AcademicYears.Where(y => y.IsActive).ToListAsync();
            foreach (var y in activeYears) y.IsActive = false;
        }

        var year = new AcademicYear
        {
            Name = request.Name,
            StartDate = DateTime.SpecifyKind(request.StartDate, DateTimeKind.Utc),
            EndDate = DateTime.SpecifyKind(request.EndDate, DateTimeKind.Utc),
            IsActive = request.IsActive
        };

        _db.AcademicYears.Add(year);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("CreateAcademicYear", "AcademicYear", year.Id.ToString(), null, request);

        return CreatedAtAction(nameof(GetAcademicYears), new { id = year.Id }, new AcademicYearDto
        {
            Id = year.Id,
            Name = year.Name,
            StartDate = year.StartDate,
            EndDate = year.EndDate,
            IsActive = year.IsActive
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Principal")]
    public async Task<ActionResult<AcademicYearDto>> Update(Guid id, [FromBody] UpdateAcademicYearRequest request)
    {
        var y = await _db.AcademicYears.FirstOrDefaultAsync(y => y.Id == id);
        if (y == null) return NotFound(new { message = "Academic year not found." });

        if (request.IsActive)
        {
            var otherActive = await _db.AcademicYears.Where(o => o.Id != id && o.IsActive).ToListAsync();
            foreach (var o in otherActive) o.IsActive = false;
        }

        y.Name = request.Name;
        y.StartDate = DateTime.SpecifyKind(request.StartDate, DateTimeKind.Utc);
        y.EndDate = DateTime.SpecifyKind(request.EndDate, DateTimeKind.Utc);
        y.IsActive = request.IsActive;

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("UpdateAcademicYear", "AcademicYear", y.Id.ToString(), null, request);

        return Ok(new AcademicYearDto
        {
            Id = y.Id,
            Name = y.Name,
            StartDate = y.StartDate,
            EndDate = y.EndDate,
            IsActive = y.IsActive
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var y = await _db.AcademicYears
            .Include(a => a.Classes)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (y == null) return NotFound(new { message = "Academic year not found." });

        if (y.Classes.Any(c => !c.IsDeleted))
        {
            return BadRequest(new { message = "Cannot delete academic year that has linked classes. Delete or reassign classes first." });
        }

        y.IsDeleted = true;
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("DeleteAcademicYear", "AcademicYear", id.ToString());
        return Ok(new { message = "Academic year deleted successfully." });
    }
}

[ApiController]
[Route("api/v1/classes")]
[Authorize]
public class ClassesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;

    public ClassesController(ApplicationDbContext db, IAuditLogService auditLogService, ICurrentUserService currentUserService)
    {
        _db = db;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<ClassRoomDto>>> GetClasses()
    {
        var classes = await _db.Classes
            .Include(c => c.AcademicYear)
            .Include(c => c.Students)
            .Include(c => c.ClassSubjects)
            .Include(c => c.Allocations)
                .ThenInclude(a => a.Teacher)
                    .ThenInclude(t => t.User)
            .OrderBy(c => c.Name)
            .ThenBy(c => c.Section)
            .ToListAsync();

        var isAdmin = User.IsInRole("Principal");
        if (!isAdmin && User.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers
                .Include(t => t.Allocations)
                .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

            if (teacher != null)
            {
                var allocatedClassIds = teacher.Allocations
                    .Where(a => !a.IsDeleted)
                    .Select(a => a.ClassRoomId)
                    .Distinct()
                    .ToList();
                classes = classes.Where(c => allocatedClassIds.Contains(c.Id)).ToList();
            }
            else
            {
                classes = new List<ClassRoom>();
            }
        }

        var result = classes.Select(c =>
        {
            var ctAlloc = c.Allocations.FirstOrDefault(a => a.IsClassTeacher && !a.IsDeleted && (a.Teacher == null || !a.Teacher.IsDeleted));
            return new ClassRoomDto
            {
                Id = c.Id,
                Name = c.Name,
                Section = c.Section,
                FullName = c.FullName,
                Capacity = c.Capacity,
                AcademicYearId = c.AcademicYearId,
                AcademicYearName = c.AcademicYear?.Name ?? "",
                StudentCount = c.Students.Count(s => s.Status == StudentStatus.Active && !s.IsDeleted),
                ClassTeacherId = ctAlloc?.TeacherId,
                ClassTeacherName = ctAlloc?.Teacher?.User?.FullName,
                ClassTeacherEmployeeCode = ctAlloc?.Teacher?.EmployeeCode,
                ClassTeacherEmail = ctAlloc?.Teacher?.User?.Email,
                ClassTeacherPhone = ctAlloc?.Teacher?.User?.PhoneNumber,
                SubjectCount = c.ClassSubjects.Where(cs => !cs.IsDeleted).Select(cs => cs.SubjectId)
                    .Union(c.Allocations.Where(a => !a.IsDeleted).Select(a => a.SubjectId))
                    .Distinct().Count()
            };
        }).ToList();

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ClassRoomDto>> GetClass(Guid id)
    {
        var c = await _db.Classes
            .Include(c => c.AcademicYear)
            .Include(c => c.Students)
            .Include(c => c.ClassSubjects)
            .Include(c => c.Allocations)
                .ThenInclude(a => a.Teacher)
                    .ThenInclude(t => t.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (c == null) return NotFound();

        var ctAlloc = c.Allocations.FirstOrDefault(a => a.IsClassTeacher && !a.IsDeleted && (a.Teacher == null || !a.Teacher.IsDeleted));

        return Ok(new ClassRoomDto
        {
            Id = c.Id,
            Name = c.Name,
            Section = c.Section,
            FullName = c.FullName,
            Capacity = c.Capacity,
            AcademicYearId = c.AcademicYearId,
            AcademicYearName = c.AcademicYear?.Name ?? "",
            StudentCount = c.Students.Count(s => s.Status == StudentStatus.Active && !s.IsDeleted),
            ClassTeacherId = ctAlloc?.TeacherId,
            ClassTeacherName = ctAlloc?.Teacher?.User?.FullName,
            ClassTeacherEmployeeCode = ctAlloc?.Teacher?.EmployeeCode,
            ClassTeacherEmail = ctAlloc?.Teacher?.User?.Email,
            ClassTeacherPhone = ctAlloc?.Teacher?.User?.PhoneNumber,
            SubjectCount = c.ClassSubjects.Where(cs => !cs.IsDeleted).Select(cs => cs.SubjectId)
                .Union(c.Allocations.Where(a => !a.IsDeleted).Select(a => a.SubjectId))
                .Distinct().Count()
        });
    }

    [HttpPost]
    [Authorize(Roles = "Principal")]
    public async Task<ActionResult<ClassRoomDto>> Create([FromBody] CreateClassRoomRequest request)
    {
        var cr = new ClassRoom
        {
            Name = request.Name,
            Section = request.Section,
            Capacity = request.Capacity,
            AcademicYearId = request.AcademicYearId
        };

        _db.Classes.Add(cr);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("CreateClass", "ClassRoom", cr.Id.ToString(), null, request);

        return CreatedAtAction(nameof(GetClass), new { id = cr.Id }, new ClassRoomDto
        {
            Id = cr.Id,
            Name = cr.Name,
            Section = cr.Section,
            FullName = cr.FullName,
            Capacity = cr.Capacity,
            AcademicYearId = cr.AcademicYearId,
            StudentCount = 0,
            SubjectCount = 0
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Principal")]
    public async Task<ActionResult<ClassRoomDto>> Update(Guid id, [FromBody] UpdateClassRoomRequest request)
    {
        var cr = await _db.Classes
            .Include(c => c.AcademicYear)
            .Include(c => c.Students)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (cr == null) return NotFound(new { message = "Class not found." });

        cr.Name = request.Name;
        cr.Section = request.Section;
        cr.Capacity = request.Capacity;
        cr.AcademicYearId = request.AcademicYearId;

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("UpdateClass", "ClassRoom", cr.Id.ToString(), null, request);

        return Ok(new ClassRoomDto
        {
            Id = cr.Id,
            Name = cr.Name,
            Section = cr.Section,
            FullName = cr.FullName,
            Capacity = cr.Capacity,
            AcademicYearId = cr.AcademicYearId,
            AcademicYearName = cr.AcademicYear?.Name ?? "",
            StudentCount = cr.Students.Count(s => s.Status == StudentStatus.Active && !s.IsDeleted)
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var cr = await _db.Classes
            .Include(c => c.Students)
            .Include(c => c.ClassSubjects)
            .Include(c => c.Allocations)
            .Include(c => c.TimetableEntries)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (cr == null) return NotFound(new { message = "Class not found." });

        var activeStudents = cr.Students.Count(s => s.Status == StudentStatus.Active && !s.IsDeleted);
        if (activeStudents > 0)
        {
            return BadRequest(new { message = $"Cannot delete class with {activeStudents} active students. Please reassign or graduate students first." });
        }

        // Clean up linked timetable, allocations, subjects
        if (cr.TimetableEntries.Any()) _db.TimetableEntries.RemoveRange(cr.TimetableEntries);
        if (cr.Allocations.Any()) _db.TeacherAllocations.RemoveRange(cr.Allocations);
        if (cr.ClassSubjects.Any()) _db.ClassSubjects.RemoveRange(cr.ClassSubjects);

        cr.IsDeleted = true;
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("DeleteClass", "ClassRoom", id.ToString());
        return Ok(new { message = "Class deleted successfully." });
    }

    [HttpGet("{id}/subjects")]
    public async Task<ActionResult<List<SubjectDto>>> GetClassSubjects(Guid id)
    {
        var classSubjects = await _db.ClassSubjects
            .Where(cs => cs.ClassRoomId == id && !cs.IsDeleted)
            .Include(cs => cs.Subject)
            .ToListAsync();

        var allocations = await _db.TeacherAllocations
            .Where(a => a.ClassRoomId == id && !a.IsDeleted)
            .Include(a => a.Teacher).ThenInclude(t => t.User)
            .Include(a => a.Subject)
            .ToListAsync();

        var subjectMap = new Dictionary<Guid, SubjectDto>();

        foreach (var cs in classSubjects)
        {
            if (cs.Subject == null || cs.Subject.IsDeleted) continue;
            var alloc = allocations.FirstOrDefault(a => a.SubjectId == cs.SubjectId && (a.Teacher == null || !a.Teacher.IsDeleted));
            subjectMap[cs.SubjectId] = new SubjectDto
            {
                Id = cs.Subject.Id,
                Name = cs.Subject.Name,
                Code = cs.Subject.Code,
                Description = cs.Subject.Description,
                TeacherId = alloc?.TeacherId,
                TeacherName = alloc?.Teacher?.User?.FullName,
                TeacherEmployeeCode = alloc?.Teacher?.EmployeeCode,
                IsClassTeacher = alloc?.IsClassTeacher ?? false
            };
        }

        foreach (var a in allocations)
        {
            if (a.Subject == null || a.Subject.IsDeleted) continue;
            if (!subjectMap.ContainsKey(a.SubjectId))
            {
                subjectMap[a.SubjectId] = new SubjectDto
                {
                    Id = a.Subject.Id,
                    Name = a.Subject.Name,
                    Code = a.Subject.Code,
                    Description = a.Subject.Description,
                    TeacherId = a.TeacherId,
                    TeacherName = a.Teacher?.User?.FullName,
                    TeacherEmployeeCode = a.Teacher?.EmployeeCode,
                    IsClassTeacher = a.IsClassTeacher
                };
            }
        }

        return Ok(subjectMap.Values.OrderBy(s => s.Name).ToList());
    }

    [HttpPost("{id}/class-teacher")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> AssignClassTeacher(Guid id, [FromBody] AssignClassTeacherRequest request)
    {
        var cr = await _db.Classes
            .Include(c => c.Allocations)
            .Include(c => c.ClassSubjects)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (cr == null) return NotFound(new { message = "Class not found." });

        var teacher = await _db.Teachers
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == request.TeacherId && !t.IsDeleted);

        if (teacher == null) return NotFound(new { message = "Teacher not found or inactive." });

        // Unset any previous class teacher flag for this class
        var existingClassTeachers = await _db.TeacherAllocations
            .Where(a => a.ClassRoomId == id && a.IsClassTeacher)
            .ToListAsync();
        foreach (var prev in existingClassTeachers)
        {
            prev.IsClassTeacher = false;
        }

        // Check if teacher already has an allocation in this class
        var teacherAlloc = await _db.TeacherAllocations
            .FirstOrDefaultAsync(a => a.ClassRoomId == id && a.TeacherId == request.TeacherId);

        if (teacherAlloc != null)
        {
            teacherAlloc.IsClassTeacher = true;
        }
        else
        {
            // Allocate teacher to the class with a subject
            Guid subjectId = request.SubjectId ?? Guid.Empty;
            if (subjectId == Guid.Empty)
            {
                subjectId = cr.ClassSubjects.FirstOrDefault()?.SubjectId ?? Guid.Empty;
            }

            if (subjectId == Guid.Empty)
            {
                var anySub = await _db.Subjects.FirstOrDefaultAsync();
                if (anySub != null)
                {
                    subjectId = anySub.Id;
                    _db.ClassSubjects.Add(new ClassSubject { ClassRoomId = id, SubjectId = subjectId });
                }
                else
                {
                    return BadRequest(new { message = "Please create at least one subject first before allocating a class teacher." });
                }
            }

            var subAlloc = await _db.TeacherAllocations
                .FirstOrDefaultAsync(a => a.ClassRoomId == id && a.SubjectId == subjectId);
            if (subAlloc != null)
            {
                subAlloc.TeacherId = request.TeacherId;
                subAlloc.IsClassTeacher = true;
            }
            else
            {
                _db.TeacherAllocations.Add(new TeacherAllocation
                {
                    TeacherId = request.TeacherId,
                    ClassRoomId = id,
                    SubjectId = subjectId,
                    IsClassTeacher = true
                });
            }
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("AssignClassTeacher", "ClassRoom", id.ToString(), null, new { request.TeacherId, TeacherName = teacher.User?.FullName });

        return Ok(new { message = $"Class Teacher '{teacher.User?.FullName ?? teacher.EmployeeCode}' allotted successfully to {cr.FullName}." });
    }

    [HttpDelete("{id}/class-teacher")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> RemoveClassTeacher(Guid id)
    {
        var classTeachers = await _db.TeacherAllocations
            .Where(a => a.ClassRoomId == id && a.IsClassTeacher)
            .ToListAsync();

        if (classTeachers.Count == 0)
        {
            return Ok(new { message = "No class teacher currently assigned." });
        }

        foreach (var a in classTeachers)
        {
            a.IsClassTeacher = false;
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("RemoveClassTeacher", "ClassRoom", id.ToString());

        return Ok(new { message = "Class teacher unassigned successfully." });
    }

    [HttpPost("{id}/subjects")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> AssignSubject(Guid id, [FromBody] AssignSubjectToClassRequest request)
    {
        var cr = await _db.Classes.FindAsync(id);
        if (cr == null) return NotFound(new { message = "Classroom not found." });

        var sub = await _db.Subjects.FindAsync(request.SubjectId);
        if (sub == null) return NotFound(new { message = "Subject not found." });

        if (!await _db.ClassSubjects.AnyAsync(cs => cs.ClassRoomId == id && cs.SubjectId == request.SubjectId))
        {
            _db.ClassSubjects.Add(new ClassSubject { ClassRoomId = id, SubjectId = request.SubjectId });
        }

        string facultyAssignedMsg = string.Empty;
        if (request.TeacherId.HasValue && request.TeacherId.Value != Guid.Empty)
        {
            var teacher = await _db.Teachers
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Id == request.TeacherId.Value && !t.IsDeleted);

            if (teacher != null)
            {
                if (request.IsClassTeacher)
                {
                    var previousClassTeachers = await _db.TeacherAllocations
                        .Where(a => a.ClassRoomId == id && a.IsClassTeacher)
                        .ToListAsync();
                    foreach (var prev in previousClassTeachers)
                    {
                        prev.IsClassTeacher = false;
                    }
                }

                var existingAlloc = await _db.TeacherAllocations
                    .FirstOrDefaultAsync(a => a.ClassRoomId == id && a.SubjectId == request.SubjectId);

                if (existingAlloc != null)
                {
                    existingAlloc.TeacherId = request.TeacherId.Value;
                    existingAlloc.IsClassTeacher = request.IsClassTeacher;
                }
                else
                {
                    _db.TeacherAllocations.Add(new TeacherAllocation
                    {
                        TeacherId = request.TeacherId.Value,
                        ClassRoomId = id,
                        SubjectId = request.SubjectId,
                        IsClassTeacher = request.IsClassTeacher
                    });
                }

                facultyAssignedMsg = $" with assigned faculty {teacher.User?.FullName}";
            }
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("AssignClassSubject", "ClassSubject", $"{id}_{request.SubjectId}", null, request);
        return Ok(new { message = $"Subject '{sub.Name}' successfully linked to class{facultyAssignedMsg}." });
    }

    [HttpPost("{id}/subjects/{subjectId}/teacher")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> AssignSubjectTeacher(Guid id, Guid subjectId, [FromBody] AssignClassSubjectTeacherRequest request)
    {
        var cr = await _db.Classes.FindAsync(id);
        if (cr == null) return NotFound(new { message = "Classroom not found." });

        var sub = await _db.Subjects.FindAsync(subjectId);
        if (sub == null) return NotFound(new { message = "Subject not found." });

        var teacher = await _db.Teachers
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == request.TeacherId && !t.IsDeleted);

        if (teacher == null) return NotFound(new { message = "Teacher not found or inactive." });

        // Ensure subject is in ClassSubjects
        if (!await _db.ClassSubjects.AnyAsync(cs => cs.ClassRoomId == id && cs.SubjectId == subjectId))
        {
            _db.ClassSubjects.Add(new ClassSubject { ClassRoomId = id, SubjectId = subjectId });
        }

        if (request.IsClassTeacher)
        {
            var previousClassTeachers = await _db.TeacherAllocations
                .Where(a => a.ClassRoomId == id && a.IsClassTeacher)
                .ToListAsync();
            foreach (var prev in previousClassTeachers)
            {
                prev.IsClassTeacher = false;
            }
        }

        var existingAlloc = await _db.TeacherAllocations
            .FirstOrDefaultAsync(a => a.ClassRoomId == id && a.SubjectId == subjectId);

        if (existingAlloc != null)
        {
            existingAlloc.TeacherId = request.TeacherId;
            existingAlloc.IsClassTeacher = request.IsClassTeacher;
        }
        else
        {
            _db.TeacherAllocations.Add(new TeacherAllocation
            {
                TeacherId = request.TeacherId,
                ClassRoomId = id,
                SubjectId = subjectId,
                IsClassTeacher = request.IsClassTeacher
            });
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("AssignSubjectTeacher", "TeacherAllocation", $"{id}_{subjectId}", null, request);
        return Ok(new { message = $"Faculty {teacher.User?.FullName} successfully assigned to {sub.Name}." });
    }

    [HttpDelete("{id}/subjects/{subjectId}/teacher")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> RemoveSubjectTeacher(Guid id, Guid subjectId)
    {
        var alloc = await _db.TeacherAllocations
            .FirstOrDefaultAsync(a => a.ClassRoomId == id && a.SubjectId == subjectId);

        if (alloc == null) return NotFound(new { message = "No faculty allocated to this subject in this class." });

        _db.TeacherAllocations.Remove(alloc);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("RemoveSubjectTeacher", "TeacherAllocation", alloc.Id.ToString());
        return Ok(new { message = "Faculty removed from this subject in this class." });
    }

    [HttpDelete("{id}/subjects/{subjectId}")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> RemoveSubjectFromClass(Guid id, Guid subjectId)
    {
        var classSubject = await _db.ClassSubjects
            .FirstOrDefaultAsync(cs => cs.ClassRoomId == id && cs.SubjectId == subjectId);

        if (classSubject == null)
        {
            return NotFound(new { message = "Subject is not linked to this class." });
        }

        _db.ClassSubjects.Remove(classSubject);

        // Also clean up any TeacherAllocation for this class and subject
        var allocations = await _db.TeacherAllocations
            .Where(a => a.ClassRoomId == id && a.SubjectId == subjectId)
            .ToListAsync();
        if (allocations.Any())
        {
            _db.TeacherAllocations.RemoveRange(allocations);
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("RemoveClassSubject", "ClassSubject", null, new { ClassRoomId = id, SubjectId = subjectId }, null);
        return Ok(new { message = "Subject removed from class successfully." });
    }

    [HttpGet("{id}/students")]
    public async Task<ActionResult<List<StudentDto>>> GetClassStudents(Guid id)
    {
        var students = await _db.Students
            .Where(s => s.ClassRoomId == id && s.Status == StudentStatus.Active)
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .OrderBy(s => s.RollNumber)
            .Select(s => new StudentDto
            {
                Id = s.Id,
                UserId = s.UserId,
                StudentRegistrationNumber = s.StudentRegistrationNumber,
                RollNumber = s.RollNumber,
                FirstName = s.User.FirstName,
                LastName = s.User.LastName,
                FullName = s.User.FullName,
                Email = s.User.Email,
                PhoneNumber = s.User.PhoneNumber,
                DateOfBirth = s.DateOfBirth,
                Gender = s.Gender,
                BloodGroup = s.BloodGroup,
                Address = s.Address,
                ClassRoomId = s.ClassRoomId,
                ClassName = s.ClassRoom.FullName,
                AdmissionDate = s.AdmissionDate,
                GuardianName = s.GuardianName,
                GuardianPhone = s.GuardianPhone,
                GuardianEmail = s.GuardianEmail,
                Status = s.Status
            })
            .ToListAsync();

        return Ok(students);
    }
}

[ApiController]
[Route("api/v1/subjects")]
[Authorize]
public class SubjectsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public SubjectsController(ApplicationDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    [HttpGet]
    public async Task<ActionResult<List<SubjectDto>>> GetSubjects()
    {
        var subjects = await _db.Subjects
            .OrderBy(s => s.Name)
            .Select(s => new SubjectDto
            {
                Id = s.Id,
                Name = s.Name,
                Code = s.Code,
                Description = s.Description
            })
            .ToListAsync();

        return Ok(subjects);
    }

    [HttpPost]
    [Authorize(Roles = "Principal")]
    public async Task<ActionResult<SubjectDto>> Create([FromBody] CreateSubjectRequest request)
    {
        if (await _db.Subjects.AnyAsync(s => s.Code.ToLower() == request.Code.ToLower()))
        {
            return BadRequest(new { message = "Subject code must be unique." });
        }

        var subject = new Subject
        {
            Name = request.Name,
            Code = request.Code,
            Description = request.Description
        };

        _db.Subjects.Add(subject);

        if (request.TeacherIds != null && request.TeacherIds.Count > 0)
        {
            var selectedTeachers = await _db.Teachers
                .Where(t => request.TeacherIds.Contains(t.Id))
                .ToListAsync();

            foreach (var t in selectedTeachers)
            {
                if (string.IsNullOrWhiteSpace(t.Specialization))
                {
                    t.Specialization = request.Name;
                }
                else if (!t.Specialization.Contains(request.Name, StringComparison.OrdinalIgnoreCase))
                {
                    t.Specialization = $"{t.Specialization}, {request.Name}";
                }
            }
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("CreateSubject", "Subject", subject.Id.ToString(), null, request);

        return CreatedAtAction(nameof(GetSubjects), new { id = subject.Id }, new SubjectDto
        {
            Id = subject.Id,
            Name = subject.Name,
            Code = subject.Code,
            Description = subject.Description
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SubjectDto>> GetSubject(Guid id)
    {
        var s = await _db.Subjects.FirstOrDefaultAsync(s => s.Id == id);
        if (s == null) return NotFound(new { message = "Subject not found." });

        return Ok(new SubjectDto
        {
            Id = s.Id,
            Name = s.Name,
            Code = s.Code,
            Description = s.Description
        });
    }

    [HttpGet("{id}/teachers")]
    public async Task<ActionResult<List<SubjectTeacherDto>>> GetSubjectTeachers(Guid id)
    {
        var subject = await _db.Subjects.FindAsync(id);
        if (subject == null) return NotFound(new { message = "Subject not found." });

        // A teacher is allocated to this subject if they have any TeacherAllocation with this SubjectId
        var allocatedTeacherIds = await _db.TeacherAllocations
            .Where(a => a.SubjectId == id)
            .Select(a => a.TeacherId)
            .Distinct()
            .ToListAsync();

        var teachers = await _db.Teachers
            .Include(t => t.User)
            .Where(t => !t.IsDeleted && t.Status == TeacherStatus.Active)
            .OrderBy(t => t.User.FirstName)
            .ToListAsync();

        var result = teachers.Select(t =>
        {
            var isAllocated = allocatedTeacherIds.Contains(t.Id) ||
                              (!string.IsNullOrWhiteSpace(t.Specialization) &&
                               (t.Specialization.Contains(subject.Name, StringComparison.OrdinalIgnoreCase) ||
                                t.Specialization.Contains(subject.Code, StringComparison.OrdinalIgnoreCase)));

            return new SubjectTeacherDto
            {
                TeacherId = t.Id,
                FullName = t.User?.FullName ?? t.EmployeeCode,
                EmployeeCode = t.EmployeeCode,
                Specialization = t.Specialization,
                Email = t.User?.Email,
                PhoneNumber = t.User?.PhoneNumber,
                IsAllocatedToSubject = isAllocated
            };
        })
        .OrderByDescending(t => t.IsAllocatedToSubject)
        .ThenBy(t => t.FullName)
        .ToList();

        return Ok(result);
    }

    [HttpPost("{id}/teachers")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> AssociateTeacherToSubject(Guid id, [FromBody] AssociateSubjectTeacherRequest request)
    {
        var subject = await _db.Subjects.FindAsync(id);
        if (subject == null) return NotFound(new { message = "Subject not found." });

        var teacher = await _db.Teachers
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == request.TeacherId && !t.IsDeleted);

        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        if (string.IsNullOrWhiteSpace(teacher.Specialization))
        {
            teacher.Specialization = subject.Name;
        }
        else if (!teacher.Specialization.Contains(subject.Name, StringComparison.OrdinalIgnoreCase))
        {
            teacher.Specialization = $"{teacher.Specialization}, {subject.Name}";
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("AssociateTeacherToSubject", "Subject", $"{id}_{request.TeacherId}");
        return Ok(new { message = $"Teacher {teacher.User?.FullName} successfully linked to subject {subject.Name}." });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Principal")]
    public async Task<ActionResult<SubjectDto>> Update(Guid id, [FromBody] UpdateSubjectRequest request)
    {
        var s = await _db.Subjects.FirstOrDefaultAsync(s => s.Id == id);
        if (s == null) return NotFound(new { message = "Subject not found." });

        if (await _db.Subjects.AnyAsync(other => other.Id != id && other.Code.ToLower() == request.Code.ToLower()))
        {
            return BadRequest(new { message = "Another subject with this code already exists." });
        }

        s.Name = request.Name;
        s.Code = request.Code;
        s.Description = request.Description;

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("UpdateSubject", "Subject", s.Id.ToString(), null, request);

        return Ok(new SubjectDto
        {
            Id = s.Id,
            Name = s.Name,
            Code = s.Code,
            Description = s.Description
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var s = await _db.Subjects
            .Include(s => s.ClassSubjects)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (s == null) return NotFound(new { message = "Subject not found." });

        // Clean up linked ClassSubjects, Allocations, Timetable
        if (s.ClassSubjects.Any()) _db.ClassSubjects.RemoveRange(s.ClassSubjects);
        var allocations = await _db.TeacherAllocations.Where(a => a.SubjectId == id).ToListAsync();
        if (allocations.Any()) _db.TeacherAllocations.RemoveRange(allocations);
        var timetables = await _db.TimetableEntries.Where(t => t.SubjectId == id).ToListAsync();
        if (timetables.Any()) _db.TimetableEntries.RemoveRange(timetables);

        s.IsDeleted = true;
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("DeleteSubject", "Subject", id.ToString());
        return Ok(new { message = "Subject deleted successfully." });
    }
}
