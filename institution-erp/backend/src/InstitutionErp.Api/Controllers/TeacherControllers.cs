using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Application.Common.Utils;
using InstitutionErp.Application.DTOs;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Api.Controllers;

[ApiController]
[Route("api/v1/teachers")]
[Authorize]
public class TeachersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly INotificationSender _notificationSender;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ISequenceGenerator _sequenceGenerator;

    public TeachersController(
        ApplicationDbContext db,
        IPasswordHasher passwordHasher,
        INotificationSender notificationSender,
        IAuditLogService auditLogService,
        ICurrentUserService currentUserService,
        ISequenceGenerator sequenceGenerator)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _notificationSender = notificationSender;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
        _sequenceGenerator = sequenceGenerator;
    }

    [HttpGet]
    public async Task<ActionResult<List<TeacherDto>>> GetTeachers()
    {
        var isAdmin = User.IsInRole("HOD");
        var teachers = await _db.Teachers
            .Include(t => t.User)
            .Include(t => t.Allocations)
                .ThenInclude(a => a.ClassRoom)
            .Include(t => t.Allocations)
                .ThenInclude(a => a.Subject)
            .OrderBy(t => t.EmployeeCode)
            .Select(t => new TeacherDto
            {
                Id = t.Id,
                UserId = t.UserId,
                EmployeeCode = t.EmployeeCode,
                FirstName = t.User.FirstName,
                LastName = t.User.LastName,
                FullName = t.User.FullName,
                Email = t.User.Email,
                PhoneNumber = t.User.PhoneNumber,
                Qualification = t.Qualification,
                Specialization = t.Specialization,
                JoiningDate = t.JoiningDate,
                Status = t.Status,
                GeneratedPassword = isAdmin ? t.User.DefaultPassword : null,
                Allocations = t.Allocations.Select(a => new TeacherAllocationDto
                {
                    Id = a.Id,
                    TeacherId = a.TeacherId,
                    TeacherName = t.User.FullName,
                    ClassRoomId = a.ClassRoomId,
                    ClassName = a.ClassRoom.FullName,
                    SubjectId = a.SubjectId,
                    SubjectName = a.Subject.Name,
                    IsClassTeacher = a.IsClassTeacher
                }).ToList()
            })
            .ToListAsync();

        if (isAdmin)
        {
            foreach (var t in teachers)
            {
                if (string.IsNullOrWhiteSpace(t.GeneratedPassword))
                {
                    t.GeneratedPassword = PasswordGenerator.GenerateTeacherPassword(t.FirstName);
                }
            }
        }

        return Ok(teachers);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TeacherDto>> GetTeacher(Guid id)
    {
        var t = await _db.Teachers
            .Include(t => t.User)
            .Include(t => t.Allocations).ThenInclude(a => a.ClassRoom)
            .Include(t => t.Allocations).ThenInclude(a => a.Subject)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (t == null) return NotFound();

        var isAdmin = User.IsInRole("HOD");

        return Ok(new TeacherDto
        {
            Id = t.Id,
            UserId = t.UserId,
            EmployeeCode = t.EmployeeCode,
            FirstName = t.User.FirstName,
            LastName = t.User.LastName,
            FullName = t.User.FullName,
            Email = t.User.Email,
            PhoneNumber = t.User.PhoneNumber,
            Qualification = t.Qualification,
            Specialization = t.Specialization,
            JoiningDate = t.JoiningDate,
            Status = t.Status,
            GeneratedPassword = isAdmin
                ? (!string.IsNullOrWhiteSpace(t.User.DefaultPassword)
                    ? t.User.DefaultPassword
                    : PasswordGenerator.GenerateTeacherPassword(t.User.FirstName))
                : null,
            Allocations = t.Allocations.Select(a => new TeacherAllocationDto
            {
                Id = a.Id,
                TeacherId = a.TeacherId,
                TeacherName = t.User.FullName,
                ClassRoomId = a.ClassRoomId,
                ClassName = a.ClassRoom.FullName,
                SubjectId = a.SubjectId,
                SubjectName = a.Subject.Name,
                IsClassTeacher = a.IsClassTeacher
            }).ToList()
        });
    }

    [HttpPost]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<TeacherDto>> Create([FromBody] CreateTeacherRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == request.Email.ToLower()))
        {
            return BadRequest(new { message = "Email already in use." });
        }

        var teacherRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == UserRoleType.Teacher.ToString());
        if (teacherRole == null) return BadRequest("Teacher role not configured.");

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<TeacherDto>>(async () =>
        {
            var empCode = await _sequenceGenerator.NextTeacherEmployeeCodeAsync();

            var password = string.IsNullOrWhiteSpace(request.Password)
                ? PasswordGenerator.GenerateTeacherPassword(request.FirstName)
                : request.Password;

            var isRelational = _db.Database.IsRelational();
            await using var transaction = isRelational ? await _db.Database.BeginTransactionAsync() : null;
            try
            {
                var user = new User
                {
                    Email = request.Email,
                    FirstName = request.FirstName,
                    LastName = request.LastName,
                    PhoneNumber = request.PhoneNumber,
                    PasswordHash = _passwordHasher.HashPassword(password),
                    DefaultPassword = password,
                    MustChangePassword = true,
                    IsActive = true
                };
                user.UserRoles.Add(new UserRole { RoleId = teacherRole.Id });
                _db.Users.Add(user);
                await _db.SaveChangesAsync();

                var teacher = new Teacher
                {
                    UserId = user.Id,
                    EmployeeCode = empCode,
                    Qualification = request.Qualification,
                    Specialization = request.Specialization,
                    JoiningDate = DateTime.SpecifyKind(request.JoiningDate, DateTimeKind.Utc),
                    Status = TeacherStatus.Active
                };
                _db.Teachers.Add(teacher);
                await _db.SaveChangesAsync();

                // Audit log without password
                await _auditLogService.LogAsync("CreateTeacher", "Teacher", teacher.Id.ToString(), null, new { email = user.Email, employeeCode = empCode });

                // Queue welcome onboarding email (no plaintext password in outbox)
                try
                {
                    var emailBody = $@"
                        <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;"">
                            <div style=""background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; color: #ffffff;"">
                                <h1 style=""margin: 0; font-size: 22px; font-weight: bold;"">Welcome to CampusCore Faculty</h1>
                                <p style=""margin: 6px 0 0; font-size: 14px; opacity: 0.9;"">Faculty Account Created</p>
                            </div>
                            <div style=""background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 28px;"">
                                <p style=""font-size: 15px;"">Dear <strong>{user.FullName}</strong>,</p>
                                <p>Welcome to CampusCore ERP! Your faculty account has been registered with Employee Code <strong>{empCode}</strong>.</p>
                                <p>Please obtain your initial one-time temporary credential slip from the institution administration office to sign in.</p>
                                <div style=""text-align: center; margin: 28px 0;"">
                                    <a href=""/login"" style=""background: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;"">Sign In to Faculty Portal</a>
                                </div>
                            </div>
                        </div>";

                    await _notificationSender.QueueOutboxAsync(
                        NotificationChannelType.Email,
                        request.Email,
                        $"Welcome to CampusCore - Your Faculty Portal Account ({empCode})",
                        emailBody
                    );
                }
                catch
                {
                    // Silently ignore email errors
                }

                if (transaction != null)
                {
                    await transaction.CommitAsync();
                }

                var credentialSlip = new CredentialSlipDto
                {
                    UserId = user.Id,
                    Email = user.Email,
                    FullName = user.FullName,
                    Role = "Teacher",
                    TemporaryPassword = password,
                    MustChangePassword = true,
                    Identifier = empCode,
                    GeneratedAtUtc = DateTime.UtcNow
                };

                return CreatedAtAction(nameof(GetTeacher), new { id = teacher.Id }, new CreateTeacherResponse
                {
                    Id = teacher.Id,
                    UserId = teacher.UserId,
                    EmployeeCode = teacher.EmployeeCode,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    FullName = user.FullName,
                    Email = user.Email,
                    PhoneNumber = user.PhoneNumber,
                    Qualification = teacher.Qualification,
                    Specialization = teacher.Specialization,
                    JoiningDate = teacher.JoiningDate,
                    Status = teacher.Status,
                    GeneratedPassword = password,
                    CredentialSlip = credentialSlip
                });
            }
            catch
            {
                if (transaction != null)
                {
                    await transaction.RollbackAsync();
                }
                throw;
            }
        });
    }

    [HttpPost("{id}/reset-password")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetTeacherPasswordRequest? request = null)
    {
        var teacher = await _db.Teachers
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var newPassword = !string.IsNullOrWhiteSpace(request?.NewPassword)
            ? request.NewPassword
            : PasswordGenerator.GenerateTeacherPassword(teacher.User.FirstName);

        teacher.User.PasswordHash = _passwordHasher.HashPassword(newPassword);
        teacher.User.DefaultPassword = newPassword;
        teacher.User.MustChangePassword = true;
        teacher.User.LockoutEnd = null;
        teacher.User.AccessFailedCount = 0;
        teacher.User.PasswordResetToken = null;
        teacher.User.PasswordResetTokenExpires = null;

        // Revoke active refresh tokens
        var refreshTokens = await _db.RefreshTokens
            .Where(rt => rt.UserId == teacher.UserId)
            .ToListAsync();
        foreach (var rt in refreshTokens) rt.IsRevoked = true;

        await _db.SaveChangesAsync();

        // Queue notification email to teacher without plaintext password
        try
        {
            var emailBody = $@"
                <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;"">
                    <div style=""background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; color: #ffffff;"">
                        <h1 style=""margin: 0; font-size: 22px; font-weight: bold;"">CampusCore Faculty Portal</h1>
                        <p style=""margin: 6px 0 0; font-size: 14px; opacity: 0.9;"">Password Reset Notice</p>
                    </div>
                    <div style=""background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;"">
                        <p style=""font-size: 15px;"">Dear <strong>{teacher.User.FullName}</strong>,</p>
                        <p>The password for your faculty account (<strong>{teacher.User.Email}</strong>) has been reset by an administrator.</p>
                        <p>Please obtain your temporary credential slip from the administrator to sign in.</p>
                        <div style=""text-align: center; margin: 28px 0;"">
                            <a href=""/login"" style=""background: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;"">Login to Teacher Portal</a>
                        </div>
                    </div>
                </div>";

            await _notificationSender.QueueOutboxAsync(
                NotificationChannelType.Email,
                teacher.User.Email,
                "Your CampusCore Faculty Portal Password Has Been Reset",
                emailBody
            );
        }
        catch
        {
            // Ignore notification errors
        }

        await _auditLogService.LogAsync("ResetTeacherPassword", "Teacher", teacher.Id.ToString(), null, new { email = teacher.User.Email });

        var slip = new CredentialSlipDto
        {
            UserId = teacher.UserId,
            Email = teacher.User.Email,
            FullName = teacher.User.FullName,
            Role = "Teacher",
            TemporaryPassword = newPassword,
            MustChangePassword = true,
            Identifier = teacher.EmployeeCode,
            GeneratedAtUtc = DateTime.UtcNow
        };

        return Ok(new
        {
            message = "Teacher password reset successfully.",
            email = teacher.User.Email,
            newPassword,
            credentialSlip = slip
        });
    }


    [HttpPut("{id}")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<TeacherDto>> Update(Guid id, [FromBody] UpdateTeacherRequest request)
    {
        var teacher = await _db.Teachers
            .Include(t => t.User)
            .Include(t => t.Allocations).ThenInclude(a => a.ClassRoom)
            .Include(t => t.Allocations).ThenInclude(a => a.Subject)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        teacher.User.FirstName = request.FirstName;
        teacher.User.LastName = request.LastName;
        teacher.User.PhoneNumber = request.PhoneNumber;
        teacher.Qualification = request.Qualification;
        teacher.Specialization = request.Specialization;
        teacher.Status = request.Status;

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("UpdateTeacher", "Teacher", teacher.Id.ToString(), null, request);

        return Ok(new TeacherDto
        {
            Id = teacher.Id,
            UserId = teacher.UserId,
            EmployeeCode = teacher.EmployeeCode,
            FirstName = teacher.User.FirstName,
            LastName = teacher.User.LastName,
            FullName = teacher.User.FullName,
            Email = teacher.User.Email,
            PhoneNumber = teacher.User.PhoneNumber,
            Qualification = teacher.Qualification,
            Specialization = teacher.Specialization,
            JoiningDate = teacher.JoiningDate,
            Status = teacher.Status,
            Allocations = teacher.Allocations.Select(a => new TeacherAllocationDto
            {
                Id = a.Id,
                TeacherId = a.TeacherId,
                TeacherName = teacher.User.FullName,
                ClassRoomId = a.ClassRoomId,
                ClassName = a.ClassRoom.FullName,
                SubjectId = a.SubjectId,
                SubjectName = a.Subject.Name,
                IsClassTeacher = a.IsClassTeacher
            }).ToList()
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> DeleteTeacher(Guid id)
    {
        var teacher = await _db.Teachers
            .Include(t => t.User)
            .Include(t => t.Allocations)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        if (teacher.Allocations.Count > 0)
        {
            var orphanedTimetable = await _db.TimetableEntries
                .Where(t => t.TeacherId == id)
                .ToListAsync();
            if (orphanedTimetable.Count > 0)
            {
                _db.TimetableEntries.RemoveRange(orphanedTimetable);
            }
            _db.TeacherAllocations.RemoveRange(teacher.Allocations);
        }

        if (teacher.User != null)
        {
            teacher.User.IsActive = false;
            teacher.User.IsDeleted = true;
        }

        _db.Teachers.Remove(teacher);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("DeleteTeacher", "Teacher", id.ToString(), new { teacher.EmployeeCode, teacher.User?.FullName }, null);

        return Ok(new { message = $"Teacher {teacher.User?.FullName ?? teacher.EmployeeCode} successfully deactivated/deleted." });
    }

    [HttpPost("{id}/allocations")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> AllocateTeacher(Guid id, [FromBody] AllocateTeacherRequest request)
    {
        // Conflict check: no double allocation of the same subject in the same class to another teacher
        var existing = await _db.TeacherAllocations
            .FirstOrDefaultAsync(a => a.ClassRoomId == request.ClassRoomId && a.SubjectId == request.SubjectId);

        if (existing != null)
        {
            return BadRequest(new { message = "This class and subject is already allocated to another teacher." });
        }

        if (request.IsClassTeacher)
        {
            var previousClassTeachers = await _db.TeacherAllocations
                .Where(a => a.ClassRoomId == request.ClassRoomId && a.IsClassTeacher)
                .ToListAsync();
            foreach (var prev in previousClassTeachers)
            {
                prev.IsClassTeacher = false;
            }
        }

        var allocation = new TeacherAllocation
        {
            TeacherId = id,
            ClassRoomId = request.ClassRoomId,
            SubjectId = request.SubjectId,
            IsClassTeacher = request.IsClassTeacher
        };

        _db.TeacherAllocations.Add(allocation);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("AllocateTeacher", "TeacherAllocation", allocation.Id.ToString(), null, request);
        return Ok(new { message = "Teacher successfully allocated." });
    }

    [HttpDelete("allocations/{allocationId}")]
    [HttpDelete("{id}/allocations/{allocationId}")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> DeallocateTeacher([FromRoute] Guid allocationId, [FromRoute] Guid? id = null)
    {
        var query = _db.TeacherAllocations
            .Include(a => a.Teacher).ThenInclude(t => t.User)
            .Include(a => a.ClassRoom)
            .Include(a => a.Subject)
            .AsQueryable();

        if (id.HasValue && id.Value != Guid.Empty)
        {
            query = query.Where(a => a.TeacherId == id.Value);
        }

        var allocation = await query.FirstOrDefaultAsync(a => a.Id == allocationId);
        if (allocation == null)
        {
            return NotFound(new { message = "Teacher allocation not found." });
        }

        var teacherName = allocation.Teacher?.User?.FullName ?? "Teacher";
        var className = allocation.ClassRoom?.FullName ?? "Class";
        var subjectName = allocation.Subject?.Name ?? "Subject";

        // Also clean up any associated timetable entries for this teacher, class, and subject
        var orphanedTimetable = await _db.TimetableEntries
            .Where(t => t.TeacherId == allocation.TeacherId && t.ClassRoomId == allocation.ClassRoomId && t.SubjectId == allocation.SubjectId)
            .ToListAsync();

        if (orphanedTimetable.Count > 0)
        {
            _db.TimetableEntries.RemoveRange(orphanedTimetable);
        }

        _db.TeacherAllocations.Remove(allocation);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync(
            "DeallocateTeacher",
            "TeacherAllocation",
            allocationId.ToString(),
            new { allocation.TeacherId, TeacherName = teacherName, allocation.ClassRoomId, ClassName = className, allocation.SubjectId, SubjectName = subjectName },
            null
        );

        return Ok(new { message = $"Successfully deallocated {teacherName} from {className} ({subjectName})." });
    }
}

[ApiController]
[Route("api/v1/timetable")]
[Authorize]
public class TimetableController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;

    public TimetableController(ApplicationDbContext db, IAuditLogService auditLogService, ICurrentUserService currentUserService)
    {
        _db = db;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
    }

    [HttpGet("my-class")]
    public async Task<ActionResult<List<TimetableEntryDto>>> GetMyClassTimetable()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var userEmail = _currentUserService.Email;
        var student = await _db.Students.FirstOrDefaultAsync(s => s.UserId == _currentUserService.UserId.Value || (!string.IsNullOrEmpty(userEmail) && s.User != null && s.User.Email.ToLower() == userEmail.ToLower()));

        if (student == null) return NotFound("Student record not found for authenticated account.");

        return await GetByClass(student.ClassRoomId);
    }

    [HttpGet("class/{classId}")]
    public async Task<ActionResult<List<TimetableEntryDto>>> GetByClass(Guid classId)
    {
        if (_currentUserService.IsInRole("Student"))
        {
            var userEmail = _currentUserService.Email;
            var student = await _db.Students.FirstOrDefaultAsync(s => (_currentUserService.UserId.HasValue && s.UserId == _currentUserService.UserId.Value) || (!string.IsNullOrEmpty(userEmail) && s.User != null && s.User.Email.ToLower() == userEmail.ToLower()));
            if (student == null || student.ClassRoomId != classId)
            {
                return StatusCode(403, new { message = "Students are only permitted to view their own enrolled class timetable." });
            }
        }

        var entries = await _db.TimetableEntries
            .Where(t => t.ClassRoomId == classId)
            .Include(t => t.ClassRoom)
            .Include(t => t.Subject)
            .Include(t => t.Teacher).ThenInclude(tc => tc.User)
            .OrderBy(t => t.DayOfWeek)
            .ThenBy(t => t.PeriodNumber)
            .Select(t => new TimetableEntryDto
            {
                Id = t.Id,
                ClassRoomId = t.ClassRoomId,
                ClassName = t.ClassRoom.FullName,
                SubjectId = t.SubjectId,
                SubjectName = t.Subject.Name,
                TeacherId = t.TeacherId,
                TeacherName = t.Teacher.User.FullName,
                DayOfWeek = t.DayOfWeek,
                PeriodNumber = t.PeriodNumber,
                StartTime = t.StartTime.ToString(@"hh\:mm"),
                EndTime = t.EndTime.ToString(@"hh\:mm"),
                RoomNumber = t.RoomNumber
            })
            .ToListAsync();

        return Ok(entries);
    }

    [HttpGet("teacher/{teacherId}")]
    public async Task<ActionResult<List<TimetableEntryDto>>> GetByTeacher(Guid teacherId)
    {
        var entries = await _db.TimetableEntries
            .Where(t => t.TeacherId == teacherId)
            .Include(t => t.ClassRoom)
            .Include(t => t.Subject)
            .Include(t => t.Teacher).ThenInclude(tc => tc.User)
            .OrderBy(t => t.DayOfWeek)
            .ThenBy(t => t.PeriodNumber)
            .Select(t => new TimetableEntryDto
            {
                Id = t.Id,
                ClassRoomId = t.ClassRoomId,
                ClassName = t.ClassRoom.FullName,
                SubjectId = t.SubjectId,
                SubjectName = t.Subject.Name,
                TeacherId = t.TeacherId,
                TeacherName = t.Teacher.User.FullName,
                DayOfWeek = t.DayOfWeek,
                PeriodNumber = t.PeriodNumber,
                StartTime = t.StartTime.ToString(@"hh\:mm"),
                EndTime = t.EndTime.ToString(@"hh\:mm"),
                RoomNumber = t.RoomNumber
            })
            .ToListAsync();

        return Ok(entries);
    }

    [HttpGet("academic-year/{academicYearId}/status")]
    public async Task<ActionResult<TimetableStatusDto>> GetYearTimetableStatus(Guid academicYearId)
    {
        var year = await _db.AcademicYears.FindAsync(academicYearId);
        if (year == null) return NotFound(new { message = "Academic year not found." });

        var key = $"Timetable_Fixed_Year_{academicYearId}";
        var setting = await _db.AppSettings.FirstOrDefaultAsync(s => s.Key == key);
        var isFixed = setting != null && setting.Value == "true";

        return Ok(new TimetableStatusDto
        {
            AcademicYearId = year.Id,
            AcademicYearName = year.Name,
            IsFixed = isFixed,
            FixedAt = setting?.UpdatedAt ?? setting?.CreatedAt,
            FixedBy = setting?.UpdatedBy ?? setting?.CreatedBy
        });
    }

    [HttpPost("academic-year/{academicYearId}/fix")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> FixYearTimetable(Guid academicYearId)
    {
        var year = await _db.AcademicYears.FindAsync(academicYearId);
        if (year == null) return NotFound(new { message = "Academic year not found." });

        var key = $"Timetable_Fixed_Year_{academicYearId}";
        var setting = await _db.AppSettings.FirstOrDefaultAsync(s => s.Key == key);
        var currentUser = User.Identity?.Name ?? "Administrator";

        if (setting == null)
        {
            _db.AppSettings.Add(new AppSetting
            {
                Key = key,
                Value = "true",
                Description = $"Fixed timetable flag for academic year {year.Name}",
                CreatedBy = currentUser
            });
        }
        else
        {
            setting.Value = "true";
            setting.UpdatedBy = currentUser;
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("FixTimetable", "AcademicYear", academicYearId.ToString(), null, new { year.Name, isFixed = true });
        return Ok(new { message = $"Timetable has been officially fixed and locked for academic year {year.Name}.", isFixed = true });
    }

    [HttpPost("academic-year/{academicYearId}/unfix")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> UnfixYearTimetable(Guid academicYearId)
    {
        var year = await _db.AcademicYears.FindAsync(academicYearId);
        if (year == null) return NotFound(new { message = "Academic year not found." });

        var key = $"Timetable_Fixed_Year_{academicYearId}";
        var setting = await _db.AppSettings.FirstOrDefaultAsync(s => s.Key == key);
        if (setting != null)
        {
            setting.Value = "false";
            setting.UpdatedBy = User.Identity?.Name ?? "Administrator";
            await _db.SaveChangesAsync();
        }

        await _auditLogService.LogAsync("UnfixTimetable", "AcademicYear", academicYearId.ToString(), null, new { year.Name, isFixed = false });
        return Ok(new { message = $"Timetable unlocked for academic year {year.Name}.", isFixed = false });
    }

    [HttpPost]
    [Authorize(Roles = "HOD,Teacher")]
    public async Task<ActionResult<TimetableEntryDto>> Create([FromBody] CreateTimetableEntryRequest request)
    {
        var classroom = await _db.Classes
            .Include(c => c.AcademicYear)
            .FirstOrDefaultAsync(c => c.Id == request.ClassRoomId);

        if (classroom == null) return NotFound(new { message = "Classroom not found." });

        var isAdmin = User.IsInRole("HOD");
        if (!isAdmin && User.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);
            if (teacher == null) return Unauthorized();

            var isAllocated = await _db.TeacherAllocations.AnyAsync(a => a.TeacherId == teacher.Id && a.ClassRoomId == request.ClassRoomId && !a.IsDeleted);
            if (!isAllocated && request.TeacherId != teacher.Id)
            {
                return Forbid("You can only schedule timetable periods for your allocated classroom or faculty schedule.");
            }
        }

        // Check if academic year timetable is fixed
        var isLocked = await _db.AppSettings.AnyAsync(s => s.Key == $"Timetable_Fixed_Year_{classroom.AcademicYearId}" && s.Value == "true");
        if (isLocked)
        {
            return BadRequest(new { message = $"The timetable for {classroom.AcademicYear?.Name ?? "this academic year"} is fixed and locked. Please unlock it first to schedule periods." });
        }

        // Verify subject belongs to this classroom (either via class_subjects or teacher_allocations)
        var isSubjectInClass = await _db.ClassSubjects.AnyAsync(cs => cs.ClassRoomId == request.ClassRoomId && cs.SubjectId == request.SubjectId)
            || await _db.TeacherAllocations.AnyAsync(ta => ta.ClassRoomId == request.ClassRoomId && ta.SubjectId == request.SubjectId);

        if (!isSubjectInClass)
        {
            return BadRequest(new { message = "Selected subject is not allocated to this classroom." });
        }

        TimeSpan.TryParse(request.StartTime, out var start);
        TimeSpan.TryParse(request.EndTime, out var end);

        // Institutional standard period timings:
        // Period 1: 10:15 - 11:15
        // Period 2: 11:15 - 12:15
        // (Lunch Break: 12:15 - 13:00)
        // Period 3: 13:00 - 14:00
        // Period 4: 14:00 - 15:00
        // (Short Break: 15:00 - 15:15)
        // Period 5: 15:15 - 16:15
        // Period 6: 16:15 - 17:15
        var institutionalTimings = new Dictionary<int, (TimeSpan Start, TimeSpan End)>
        {
            { 1, (new TimeSpan(10, 15, 0), new TimeSpan(11, 15, 0)) },
            { 2, (new TimeSpan(11, 15, 0), new TimeSpan(12, 15, 0)) },
            { 3, (new TimeSpan(13, 0, 0), new TimeSpan(14, 0, 0)) },
            { 4, (new TimeSpan(14, 0, 0), new TimeSpan(15, 0, 0)) },
            { 5, (new TimeSpan(15, 15, 0), new TimeSpan(16, 15, 0)) },
            { 6, (new TimeSpan(16, 15, 0), new TimeSpan(17, 15, 0)) }
        };

        if ((start == TimeSpan.Zero || end == TimeSpan.Zero) && institutionalTimings.TryGetValue(request.PeriodNumber, out var standardTimes))
        {
            start = standardTimes.Start;
            end = standardTimes.End;
        }

        // Clash detection 1: Class already scheduled for this period or overlapping time on that day
        var classClash = await _db.TimetableEntries
            .Include(t => t.Subject)
            .FirstOrDefaultAsync(t => t.ClassRoomId == request.ClassRoomId 
                && t.DayOfWeek == request.DayOfWeek 
                && (t.PeriodNumber == request.PeriodNumber || (start < t.EndTime && end > t.StartTime)));

        if (classClash != null)
        {
            return BadRequest(new { message = $"This class already has a scheduled subject ({classClash.Subject?.Name ?? "Subject"}) in period {classClash.PeriodNumber} at that time." });
        }

        // Clash detection 2: Teacher already scheduled for another class in the same period or overlapping time
        var teacherClash = await _db.TimetableEntries
            .Include(t => t.ClassRoom)
            .FirstOrDefaultAsync(t => t.TeacherId == request.TeacherId 
                && t.DayOfWeek == request.DayOfWeek 
                && (t.PeriodNumber == request.PeriodNumber || (start < t.EndTime && end > t.StartTime)));

        if (teacherClash != null)
        {
            var clashingClassName = teacherClash.ClassRoom?.FullName ?? "another class";
            return BadRequest(new { message = $"This teacher is already teaching {clashingClassName} in period {teacherClash.PeriodNumber} at that time." });
        }

        var entry = new TimetableEntry
        {
            ClassRoomId = request.ClassRoomId,
            SubjectId = request.SubjectId,
            TeacherId = request.TeacherId,
            DayOfWeek = request.DayOfWeek,
            PeriodNumber = request.PeriodNumber,
            StartTime = start,
            EndTime = end,
            RoomNumber = request.RoomNumber
        };

        _db.TimetableEntries.Add(entry);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("CreateTimetableEntry", "TimetableEntry", entry.Id.ToString(), null, request);

        return Ok(new TimetableEntryDto
        {
            Id = entry.Id,
            ClassRoomId = entry.ClassRoomId,
            SubjectId = entry.SubjectId,
            TeacherId = entry.TeacherId,
            DayOfWeek = entry.DayOfWeek,
            PeriodNumber = entry.PeriodNumber,
            StartTime = entry.StartTime.ToString(@"hh\:mm"),
            EndTime = entry.EndTime.ToString(@"hh\:mm"),
            RoomNumber = entry.RoomNumber
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "HOD,Teacher")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entry = await _db.TimetableEntries
            .Include(t => t.ClassRoom).ThenInclude(c => c.AcademicYear)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (entry == null) return NotFound();

        var isAdmin = User.IsInRole("HOD");
        if (!isAdmin && User.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);
            if (teacher == null) return Unauthorized();

            var isAllocated = await _db.TeacherAllocations.AnyAsync(a => a.TeacherId == teacher.Id && a.ClassRoomId == entry.ClassRoomId && !a.IsDeleted);
            if (!isAllocated && entry.TeacherId != teacher.Id)
            {
                return Forbid("You can only remove periods for your allocated classroom or faculty schedule.");
            }
        }

        if (entry.ClassRoom?.AcademicYearId != null)
        {
            var isLocked = await _db.AppSettings.AnyAsync(s => s.Key == $"Timetable_Fixed_Year_{entry.ClassRoom.AcademicYearId}" && s.Value == "true");
            if (isLocked)
            {
                return BadRequest(new { message = $"The timetable for {entry.ClassRoom.AcademicYear?.Name ?? "this academic year"} is fixed and locked. Please unlock it first to remove scheduled periods." });
            }
        }

        _db.TimetableEntries.Remove(entry);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("DeleteTimetableEntry", "TimetableEntry", id.ToString());
        return Ok(new { message = "Timetable entry removed." });
    }
}

[ApiController]
[Route("api/v1/teacher-attendance")]
[Authorize]
public class TeacherAttendanceController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public TeacherAttendanceController(ApplicationDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    [HttpGet]
    public async Task<ActionResult<List<TeacherAttendanceDto>>> GetAttendance([FromQuery] DateTime? date)
    {
        var targetDate = DateTime.SpecifyKind((date ?? DateTime.UtcNow).Date, DateTimeKind.Utc);
        var nextDate = targetDate.AddDays(1);

        var records = await _db.TeacherAttendances
            .Where(a => a.Date >= targetDate && a.Date < nextDate)
            .Include(a => a.Teacher).ThenInclude(t => t.User)
            .Select(a => new TeacherAttendanceDto
            {
                Id = a.Id,
                TeacherId = a.TeacherId,
                TeacherName = a.Teacher.User.FullName,
                Date = a.Date,
                Status = a.Status,
                Remarks = a.Remarks
            })
            .ToListAsync();

        return Ok(records);
    }

    [HttpPost]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> Mark([FromBody] MarkTeacherAttendanceRequest request)
    {
        var targetDate = DateTime.SpecifyKind(request.Date.Date, DateTimeKind.Utc);
        var nextDate = targetDate.AddDays(1);
        var existing = await _db.TeacherAttendances
            .FirstOrDefaultAsync(a => a.TeacherId == request.TeacherId && a.Date >= targetDate && a.Date < nextDate);

        if (existing != null)
        {
            existing.Status = request.Status;
            existing.Remarks = request.Remarks;
        }
        else
        {
            _db.TeacherAttendances.Add(new TeacherAttendance
            {
                TeacherId = request.TeacherId,
                Date = DateTime.SpecifyKind(targetDate, DateTimeKind.Utc),
                Status = request.Status,
                Remarks = request.Remarks
            });
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("MarkTeacherAttendance", "TeacherAttendance", null, null, request);

        return Ok(new { message = "Teacher attendance recorded." });
    }
}
