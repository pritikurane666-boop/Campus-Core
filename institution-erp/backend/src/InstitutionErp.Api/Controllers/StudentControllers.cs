using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Application.Common.Models;
using InstitutionErp.Application.Common.Utils;
using InstitutionErp.Application.DTOs;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Api.Controllers;

[ApiController]
[Route("api/v1/students")]
[Authorize]
public class StudentsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly INotificationSender _notificationSender;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ISequenceGenerator _sequenceGenerator;

    public StudentsController(
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
    public async Task<ActionResult<PagedResult<StudentDto>>> GetStudents(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] Guid? classId = null,
        [FromQuery] StudentStatus? status = null)
    {
        var query = _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .AsNoTracking();

        if (classId.HasValue)
        {
            query = query.Where(s => s.ClassRoomId == classId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(s => s.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x => x.User.FirstName.ToLower().Contains(s) ||
                                     x.User.LastName.ToLower().Contains(s) ||
                                     x.User.Email.ToLower().Contains(s) ||
                                     x.StudentRegistrationNumber.ToLower().Contains(s) ||
                                     x.RollNumber.ToLower().Contains(s));
        }

        var isAdmin = User.IsInRole("Principal");

        // Teacher restriction: Teachers can only view students enrolled in their allocated classes
        if (!isAdmin)
        {
            if (User.IsInRole("Teacher"))
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
                    query = query.Where(s => allocatedClassIds.Contains(s.ClassRoomId));
                }
                else
                {
                    query = query.Where(s => false);
                }
            }
            else
            {
                // Enrolled students cannot dump the student directory
                return Forbid();
            }
        }

        var total = await query.CountAsync();
        var students = await query
            .OrderBy(s => s.RollNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
                Status = s.Status,
                AdmissionDate = s.AdmissionDate,
                ClassRoomId = s.ClassRoomId,
                ClassName = s.ClassRoom.FullName,
                GuardianName = s.GuardianName,
                GuardianPhone = s.GuardianPhone,
                GuardianEmail = s.GuardianEmail,
                GeneratedPassword = isAdmin ? s.User.DefaultPassword : null
            })
            .ToListAsync();

        if (isAdmin)
        {
            foreach (var st in students)
            {
                if (string.IsNullOrWhiteSpace(st.GeneratedPassword))
                {
                    st.GeneratedPassword = PasswordGenerator.GenerateStudentPassword(st.FirstName);
                }
            }
        }

        return Ok(PagedResult<StudentDto>.Create(students, total, page, pageSize));
    }

    [HttpGet("me")]
    public async Task<ActionResult<StudentDto>> GetMyProfile()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var s = await _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .FirstOrDefaultAsync(s => s.UserId == _currentUserService.UserId.Value);

        if (s == null)
        {
            var email = _currentUserService.Email;
            if (!string.IsNullOrEmpty(email))
            {
                s = await _db.Students
                    .Include(s => s.User)
                    .Include(s => s.ClassRoom)
                    .FirstOrDefaultAsync(s => s.User != null && s.User.Email.ToLower() == email.ToLower());

                if (s != null)
                {
                    s.UserId = _currentUserService.UserId.Value;
                    s.IsDeleted = false;
                    await _db.SaveChangesAsync();
                }
            }
        }

        if (s == null) return NotFound("Student profile not found.");

        return Ok(new StudentDto
        {
            Id = s.Id,
            UserId = s.UserId,
            StudentRegistrationNumber = s.StudentRegistrationNumber,
            RollNumber = s.RollNumber,
            FirstName = s.User?.FirstName ?? "",
            LastName = s.User?.LastName ?? "",
            FullName = s.User?.FullName ?? "",
            Email = s.User?.Email ?? "",
            PhoneNumber = s.User?.PhoneNumber,
            DateOfBirth = s.DateOfBirth,
            Gender = s.Gender,
            BloodGroup = s.BloodGroup,
            Address = s.Address,
            Status = s.Status,
            AdmissionDate = s.AdmissionDate,
            ClassRoomId = s.ClassRoomId,
            ClassName = s.ClassRoom != null ? s.ClassRoom.FullName : "",
            GuardianName = s.GuardianName,
            GuardianPhone = s.GuardianPhone,
            GuardianEmail = s.GuardianEmail
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StudentDto>> GetStudent(Guid id)
    {
        var s = await _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (s == null) return NotFound();

        var isAdmin = User.IsInRole("Principal");

        if (!isAdmin)
        {
            if (User.IsInRole("Teacher"))
            {
                var teacher = await _db.Teachers
                    .Include(t => t.Allocations)
                    .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

                if (teacher == null || !teacher.Allocations.Any(a => !a.IsDeleted && a.ClassRoomId == s.ClassRoomId))
                {
                    return Forbid();
                }
            }
            else if (User.IsInRole("Student"))
            {
                if (s.UserId != _currentUserService.UserId)
                {
                    return Forbid();
                }
            }
            else
            {
                return Forbid();
            }
        }

        return Ok(new StudentDto
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
            Status = s.Status,
            AdmissionDate = s.AdmissionDate,
            ClassRoomId = s.ClassRoomId,
            ClassName = s.ClassRoom.FullName,
            GuardianName = s.GuardianName,
            GuardianPhone = s.GuardianPhone,
            GuardianEmail = s.GuardianEmail,
            GeneratedPassword = isAdmin
                ? (!string.IsNullOrWhiteSpace(s.User.DefaultPassword)
                    ? s.User.DefaultPassword
                    : PasswordGenerator.GenerateStudentPassword(s.User.FirstName))
                : null
        });
    }

    [HttpPost]
    [Authorize(Roles = "Principal")]
    public async Task<ActionResult<StudentDto>> Create([FromBody] CreateStudentRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == request.Email.ToLower()))
        {
            return BadRequest(new { message = "Email already in use." });
        }

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<StudentDto>>(async () =>
        {
            var regNo = await _sequenceGenerator.NextStudentRegistrationNumberAsync();

            var studentRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == UserRoleType.Student.ToString());
            var studentPassword = string.IsNullOrWhiteSpace(request.Password)
                ? PasswordGenerator.GenerateStudentPassword(request.FirstName)
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
                    PasswordHash = _passwordHasher.HashPassword(studentPassword),
                    DefaultPassword = studentPassword,
                    MustChangePassword = true,
                    IsActive = true
                };
                if (studentRole != null) user.UserRoles.Add(new UserRole { RoleId = studentRole.Id });
                _db.Users.Add(user);
                await _db.SaveChangesAsync();

                var student = new Student
                {
                    UserId = user.Id,
                    StudentRegistrationNumber = regNo,
                    RollNumber = request.RollNumber,
                    DateOfBirth = DateTime.SpecifyKind(request.DateOfBirth, DateTimeKind.Utc),
                    Gender = request.Gender,
                    BloodGroup = request.BloodGroup,
                    Address = request.Address,
                    ClassRoomId = request.ClassRoomId,
                    AdmissionDate = DateTime.SpecifyKind(request.AdmissionDate, DateTimeKind.Utc),
                    Status = StudentStatus.Active,
                    GuardianName = request.GuardianName,
                    GuardianPhone = request.GuardianPhone,
                    GuardianEmail = request.GuardianEmail,
                    GuardianRelation = request.GuardianRelation
                };
                _db.Students.Add(student);
                await _db.SaveChangesAsync();

                // Auto-assign classroom fee structures if any exist
                var feeStructures = await _db.FeeStructures
                    .Include(f => f.Items)
                    .Where(f => f.ClassRoomId == request.ClassRoomId && !f.IsDeleted)
                    .ToListAsync();

                foreach (var fs in feeStructures)
                {
                    foreach (var item in fs.Items.Where(i => !i.IsDeleted))
                    {
                        _db.StudentFees.Add(new StudentFee
                        {
                            StudentId = student.Id,
                            FeeStructureItemId = item.Id,
                            BaseAmount = item.Amount,
                            DueDate = DateTime.SpecifyKind(item.DueDate, DateTimeKind.Utc),
                            PaidAmount = 0,
                            Status = PaymentStatus.Pending
                        });
                    }
                }
                if (feeStructures.Count > 0)
                {
                    await _db.SaveChangesAsync();
                }

                // Queue credentials email to student without plaintext password
                try
                {
                    var classroom = await _db.Classes.FindAsync(request.ClassRoomId);
                    var className = classroom?.FullName ?? "Assigned Class";
                    var emailBody = $@"
                        <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;"">
                            <div style=""background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; color: #ffffff;"">
                                <h1 style=""margin: 0; font-size: 22px; font-weight: bold;"">CampusCore Student Portal</h1>
                                <p style=""margin: 6px 0 0; font-size: 14px; opacity: 0.9;"">Student Enrollment & Account Details</p>
                            </div>
                            <div style=""background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;"">
                                <p style=""font-size: 15px;"">Dear <strong>{user.FullName}</strong>,</p>
                                <p>You have been officially enrolled into <strong>{className}</strong> at CampusCore Institution.</p>
                                <p>Your student ID is <strong>{regNo}</strong>. Your temporary login password has been issued directly to the administrator on a secure credential slip. Please contact your administrator to receive your one-time temporary password, then sign in and change your password.</p>
                                <div style=""text-align: center; margin: 28px 0;"">
                                    <a href=""/login"" style=""background: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;"">Sign In to Student Portal</a>
                                </div>
                            </div>
                        </div>";

                    await _notificationSender.QueueOutboxAsync(
                        NotificationChannelType.Email,
                        request.Email,
                        $"Welcome to CampusCore - Your Student Portal Account ({regNo})",
                        emailBody
                    );
                }
                catch
                {
                    // Silently ignore email failures
                }

                await _auditLogService.LogAsync("CreateStudent", "Student", student.Id.ToString(), null, new { request.Email, regNo, request.RollNumber });

                if (transaction != null)
                {
                    await transaction.CommitAsync();
                }

                var credentialSlip = new CredentialSlipDto
                {
                    UserId = user.Id,
                    Email = user.Email,
                    FullName = user.FullName,
                    Role = "Student",
                    TemporaryPassword = studentPassword,
                    MustChangePassword = true,
                    Identifier = regNo,
                    GeneratedAtUtc = DateTime.UtcNow
                };

                return CreatedAtAction(nameof(GetStudent), new { id = student.Id }, new CreateStudentResponse
                {
                    Id = student.Id,
                    UserId = student.UserId,
                    StudentRegistrationNumber = student.StudentRegistrationNumber,
                    RollNumber = student.RollNumber,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    FullName = user.FullName,
                    Email = user.Email,
                    PhoneNumber = user.PhoneNumber,
                    DateOfBirth = student.DateOfBirth,
                    Gender = student.Gender,
                    BloodGroup = student.BloodGroup,
                    Address = student.Address,
                    Status = student.Status,
                    AdmissionDate = student.AdmissionDate,
                    ClassRoomId = student.ClassRoomId,
                    GuardianName = student.GuardianName,
                    GuardianPhone = student.GuardianPhone,
                    GuardianEmail = student.GuardianEmail,
                    GeneratedPassword = studentPassword,
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
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetStudentPasswordRequest? request = null)
    {
        var student = await _db.Students
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (student == null) return NotFound(new { message = "Student not found." });

        var newPassword = !string.IsNullOrWhiteSpace(request?.NewPassword)
            ? request.NewPassword
            : PasswordGenerator.GenerateStudentPassword(student.User.FirstName);

        student.User.PasswordHash = _passwordHasher.HashPassword(newPassword);
        student.User.DefaultPassword = newPassword;
        student.User.MustChangePassword = true;
        student.User.LockoutEnd = null;
        student.User.AccessFailedCount = 0;
        student.User.PasswordResetToken = null;
        student.User.PasswordResetTokenExpires = null;

        // Revoke active refresh tokens
        var refreshTokens = await _db.RefreshTokens
            .Where(rt => rt.UserId == student.UserId)
            .ToListAsync();
        foreach (var rt in refreshTokens) rt.IsRevoked = true;

        await _db.SaveChangesAsync();

        // Queue email notification without plaintext password
        try
        {
            var emailBody = $@"
                <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;"">
                    <div style=""background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; color: #ffffff;"">
                        <h1 style=""margin: 0; font-size: 22px; font-weight: bold;"">CampusCore Student Portal</h1>
                        <p style=""margin: 6px 0 0; font-size: 14px; opacity: 0.9;"">Password Reset Notice</p>
                    </div>
                    <div style=""background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;"">
                        <p style=""font-size: 15px;"">Dear <strong>{student.User.FullName}</strong>,</p>
                        <p>Your password for the Student Portal has been reset by the institution administrator.</p>
                        <p>Please obtain your temporary credential slip from the administrator to sign in.</p>
                        <div style=""text-align: center; margin: 28px 0;"">
                            <a href=""/login"" style=""background: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;"">Login to Student Portal</a>
                        </div>
                    </div>
                </div>";

            await _notificationSender.QueueOutboxAsync(
                NotificationChannelType.Email,
                student.User.Email,
                "Your CampusCore Student Portal Password Has Been Reset",
                emailBody
            );
        }
        catch
        {
            // Ignore notification errors
        }

        await _auditLogService.LogAsync("ResetStudentPassword", "Student", student.Id.ToString(), null, new { email = student.User.Email });

        var slip = new CredentialSlipDto
        {
            UserId = student.UserId,
            Email = student.User.Email,
            FullName = student.User.FullName,
            Role = "Student",
            TemporaryPassword = newPassword,
            MustChangePassword = true,
            Identifier = student.StudentRegistrationNumber,
            GeneratedAtUtc = DateTime.UtcNow
        };

        return Ok(new
        {
            message = "Student password reset successfully.",
            email = student.User.Email,
            newPassword,
            credentialSlip = slip
        });
    }


    [HttpPut("{id}")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStudentRequest request)
    {
        var student = await _db.Students.Include(s => s.User).FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound();

        if (student.User != null)
        {
            student.User.FirstName = request.FirstName;
            student.User.LastName = request.LastName;
            student.User.PhoneNumber = request.PhoneNumber;
            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                student.User.Email = request.Email;
            }
        }

        student.RollNumber = request.RollNumber;
        student.DateOfBirth = DateTime.SpecifyKind(request.DateOfBirth, DateTimeKind.Utc);
        student.Gender = request.Gender;
        student.BloodGroup = request.BloodGroup;
        student.Address = request.Address;
        student.ClassRoomId = request.ClassRoomId;
        student.Status = request.Status;

        student.GuardianName = request.GuardianName;
        student.GuardianPhone = request.GuardianPhone;
        student.GuardianEmail = request.GuardianEmail;
        if (!string.IsNullOrWhiteSpace(request.GuardianRelation))
        {
            student.GuardianRelation = request.GuardianRelation;
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("UpdateStudent", "Student", student.Id.ToString(), null, request);

        return Ok(new { message = "Student updated successfully." });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var student = await _db.Students.Include(s => s.User).FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound();

        student.IsDeleted = true;
        if (student.User != null)
        {
            student.User.IsActive = false;
            student.User.IsDeleted = true;
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("DeleteStudent", "Student", id.ToString());

        return Ok(new { message = "Student successfully deleted." });
    }

    [HttpGet("export")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> ExportToCsv([FromQuery] Guid? classId)
    {
        var query = _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .AsNoTracking();

        if (classId.HasValue) query = query.Where(s => s.ClassRoomId == classId.Value);

        var list = await query.ToListAsync();
        var sb = new StringBuilder();
        sb.AppendLine("RegistrationNumber,RollNumber,FirstName,LastName,Email,Phone,Class,Gender,Status");

        foreach (var s in list)
        {
            sb.AppendLine($"\"{s.StudentRegistrationNumber}\",\"{s.RollNumber}\",\"{s.User.FirstName}\",\"{s.User.LastName}\",\"{s.User.Email}\",\"{s.User.PhoneNumber}\",\"{s.ClassRoom?.FullName}\",\"{s.Gender}\",\"{s.Status}\"");
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"students_export_{DateTime.UtcNow:yyyyMMdd}.csv");
    }
}

[ApiController]
[Route("api/v1/parents")]
[Authorize]
public class ParentsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUserService;

    public ParentsController(ApplicationDbContext db, ICurrentUserService currentUserService)
    {
        _db = db;
        _currentUserService = currentUserService;
    }

    [HttpGet("my-children")]
    public async Task<ActionResult<List<StudentDto>>> GetMyChildren()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var userEmail = _currentUserService.Email;
        var query = _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .AsNoTracking();

        if (_currentUserService.IsInRole("Parent") && !string.IsNullOrEmpty(userEmail))
        {
            query = query.Where(s => (s.GuardianEmail != null && s.GuardianEmail.ToLower() == userEmail.ToLower()) || s.UserId == _currentUserService.UserId.Value);
        }
        else if (_currentUserService.IsInRole("Student") && !string.IsNullOrEmpty(userEmail))
        {
            query = query.Where(s => s.UserId == _currentUserService.UserId.Value || (s.User != null && s.User.Email.ToLower() == userEmail.ToLower()));
        }
        else
        {
            query = query.Where(s => s.UserId == _currentUserService.UserId.Value);
        }

        var students = await query.Select(student => new StudentDto
        {
            Id = student.Id,
            UserId = student.UserId,
            StudentRegistrationNumber = student.StudentRegistrationNumber,
            RollNumber = student.RollNumber,
            FirstName = student.User.FirstName,
            LastName = student.User.LastName,
            FullName = student.User.FullName,
            Email = student.User.Email,
            PhoneNumber = student.User.PhoneNumber,
            DateOfBirth = student.DateOfBirth,
            Gender = student.Gender,
            BloodGroup = student.BloodGroup,
            Address = student.Address,
            Status = student.Status,
            AdmissionDate = student.AdmissionDate,
            ClassRoomId = student.ClassRoomId,
            ClassName = student.ClassRoom.FullName,
            GuardianName = student.GuardianName,
            GuardianPhone = student.GuardianPhone,
            GuardianEmail = student.GuardianEmail
        }).ToListAsync();

        return Ok(students);
    }
}

public record ResetStudentPasswordRequest(string? NewPassword);

