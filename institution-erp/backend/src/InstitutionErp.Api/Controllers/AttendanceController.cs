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
[Route("api/v1/[controller]")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly INotificationSender _notificationSender;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;

    public AttendanceController(
        ApplicationDbContext db,
        INotificationSender notificationSender,
        IAuditLogService auditLogService,
        ICurrentUserService currentUserService)
    {
        _db = db;
        _notificationSender = notificationSender;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
    }

    [HttpPost("mark")]
    [Authorize(Roles = "HOD,Teacher")]
    public async Task<IActionResult> MarkAttendance([FromBody] BulkMarkAttendanceRequest request)
    {
        var targetDate = DateTime.SpecifyKind(request.Date.Date, DateTimeKind.Utc);
        var nextDate = targetDate.AddDays(1);
        var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);

        var isAdmin = _currentUserService.IsInRole("HOD");

        // Teacher can only edit the same day
        if (!isAdmin && targetDate != today)
        {
            return BadRequest(new { message = "Attendance can only be marked or edited on the same day. Please contact administrator for past date corrections." });
        }

        // Teacher resource-level check: verify teacher is allocated to class or is class teacher
        if (_currentUserService.IsInRole("Teacher") && !isAdmin)
        {
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);
            if (teacher == null) return Unauthorized();

            var isAllocated = await _db.TeacherAllocations.AnyAsync(a => a.TeacherId == teacher.Id && a.ClassRoomId == request.ClassRoomId && !a.IsDeleted);
            if (!isAllocated)
            {
                return Forbid("You are not allocated to this class.");
            }
        }

        var classStudents = await _db.Students
            .Where(s => s.ClassRoomId == request.ClassRoomId && s.Status == StudentStatus.Active)
            .Include(s => s.User)
            .ToListAsync();

        var existingAttendances = await _db.Attendances
            .Where(a => a.ClassRoomId == request.ClassRoomId && a.Date >= targetDate && a.Date < nextDate)
            .ToListAsync();

        var absentStudentsToNotify = new List<Student>();

        foreach (var record in request.Records)
        {
            var student = classStudents.FirstOrDefault(s => s.Id == record.StudentId);
            if (student == null) continue;

            var existing = existingAttendances.FirstOrDefault(a => a.StudentId == student.Id);
            if (existing != null)
            {
                var wasAbsent = existing.Status == AttendanceStatus.Absent;
                existing.Status = record.Status;
                existing.Remarks = record.Remarks;
                existing.MarkedBy = _currentUserService.Email ?? "Teacher";

                if (record.Status == AttendanceStatus.Absent && !wasAbsent)
                {
                    absentStudentsToNotify.Add(student);
                }
            }
            else
            {
                var att = new Attendance
                {
                    StudentId = student.Id,
                    ClassRoomId = request.ClassRoomId,
                    Date = DateTime.SpecifyKind(targetDate, DateTimeKind.Utc),
                    Status = record.Status,
                    Remarks = record.Remarks,
                    MarkedBy = _currentUserService.Email ?? "Teacher"
                };
                _db.Attendances.Add(att);

                if (record.Status == AttendanceStatus.Absent)
                {
                    absentStudentsToNotify.Add(student);
                }
            }
        }

        await _db.SaveChangesAsync();

        // Automated notification to absent students
        foreach (var student in absentStudentsToNotify)
        {
            var msg = $"You were marked ABSENT on {targetDate:dd MMM yyyy}. Please submit an explanation or leave application if applicable.";
            await _notificationSender.SendNotificationAsync(
                student.UserId,
                "Student Absence Alert",
                msg,
                NotificationChannelType.InApp,
                "Attendance",
                student.Id.ToString()
            );

            if (!string.IsNullOrEmpty(student.User?.Email))
            {
                await _notificationSender.QueueOutboxAsync(
                    NotificationChannelType.Email,
                    student.User.Email,
                    "Attendance Notice - Absenteeism Alert",
                    $"<p>Dear {student.User.FirstName},</p><p>{msg}</p><p>Please contact the HOD or class teacher if this was unintended.</p>"
                );
            }
        }

        await _auditLogService.LogAsync("MarkAttendance", "Attendance", request.ClassRoomId.ToString(), null, new { date = targetDate, count = request.Records.Count });

        return Ok(new { message = "Attendance recorded successfully.", notificationsSent = absentStudentsToNotify.Count });
    }

    [HttpGet("class/{classId}")]
    public async Task<ActionResult<ClassAttendanceSummaryDto>> GetClassAttendance(Guid classId, [FromQuery] DateTime? date)
    {
        var targetDate = DateTime.SpecifyKind((date ?? DateTime.UtcNow).Date, DateTimeKind.Utc);
        var nextDate = targetDate.AddDays(1);

        var classRoom = await _db.Classes.FindAsync(classId);
        if (classRoom == null) return NotFound("Class not found.");

        var isAdmin = _currentUserService.IsInRole("HOD");
        if (isAdmin)
        {
            // Allowed
        }
        else if (_currentUserService.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);
            if (teacher == null) return Unauthorized();

            var isAllocated = await _db.TeacherAllocations.AnyAsync(a => a.TeacherId == teacher.Id && a.ClassRoomId == classId && !a.IsDeleted);
            if (!isAllocated)
            {
                return Forbid("You are not allocated to this class.");
            }
        }
        else
        {
            return Forbid("Only administrators and assigned teachers can view class attendance sheets.");
        }

        var students = await _db.Students
            .Where(s => s.ClassRoomId == classId && s.Status == StudentStatus.Active)
            .Include(s => s.User)
            .OrderBy(s => s.RollNumber)
            .ToListAsync();

        var attendances = await _db.Attendances
            .Where(a => a.ClassRoomId == classId && a.Date >= targetDate && a.Date < nextDate)
            .ToListAsync();

        var records = students.Select(s =>
        {
            var att = attendances.FirstOrDefault(a => a.StudentId == s.Id);
            return new AttendanceRecordDto
            {
                Id = att?.Id ?? Guid.Empty,
                StudentId = s.Id,
                StudentName = s.User?.FullName ?? "Student",
                RollNumber = s.RollNumber,
                Date = targetDate,
                Status = att?.Status ?? AttendanceStatus.Present,
                Remarks = att?.Remarks,
                MarkedBy = att?.MarkedBy
            };
        }).ToList();

        var presentCount = records.Count(r => r.Status == AttendanceStatus.Present || r.Status == AttendanceStatus.Late);
        var absentCount = records.Count(r => r.Status == AttendanceStatus.Absent);
        var lateCount = records.Count(r => r.Status == AttendanceStatus.Late);
        var leaveCount = records.Count(r => r.Status == AttendanceStatus.Leave);

        var isMarked = attendances.Count > 0;

        return Ok(new ClassAttendanceSummaryDto
        {
            ClassRoomId = classId,
            ClassName = classRoom.FullName,
            Date = targetDate,
            TotalStudents = students.Count,
            PresentCount = presentCount,
            AbsentCount = absentCount,
            LateCount = lateCount,
            LeaveCount = leaveCount,
            PresentPercentage = students.Count > 0 ? Math.Round((decimal)presentCount / students.Count * 100, 1) : 0,
            IsMarked = isMarked,
            Records = records
        });
    }

    [HttpGet("student/{studentId}/summary")]
    public async Task<ActionResult<StudentAttendanceSummaryDto>> GetStudentSummary(Guid studentId)
    {
        var student = await _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null) return NotFound();

        // RBAC check: HOD/Admin, allocated Teacher, or self-student/parent
        var isAdmin = _currentUserService.IsInRole("HOD");
        if (isAdmin)
        {
            // Allowed
        }
        else if (_currentUserService.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);
            if (teacher == null) return Unauthorized();

            var isAllocated = await _db.TeacherAllocations.AnyAsync(a => a.TeacherId == teacher.Id && a.ClassRoomId == student.ClassRoomId && !a.IsDeleted);
            if (!isAllocated)
            {
                return Forbid("You are not allocated to this student's class.");
            }
        }
        else if (_currentUserService.IsInRole("Student"))
        {
            if (student.UserId != _currentUserService.UserId) return Forbid();
        }
        else if (_currentUserService.IsInRole("Parent"))
        {
            var userEmail = _currentUserService.Email;
            if (string.IsNullOrEmpty(userEmail) || string.IsNullOrEmpty(student.GuardianEmail) || student.GuardianEmail.ToLower() != userEmail.ToLower()) return Forbid();
        }
        else
        {
            return Forbid();
        }

        var attendances = await _db.Attendances
            .Where(a => a.StudentId == studentId)
            .ToListAsync();

        var total = attendances.Count;
        var present = attendances.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late);
        var absent = attendances.Count(a => a.Status == AttendanceStatus.Absent);
        var late = attendances.Count(a => a.Status == AttendanceStatus.Late);
        var leave = attendances.Count(a => a.Status == AttendanceStatus.Leave);
        var pct = total > 0 ? Math.Round((decimal)present / total * 100, 1) : 0;

        return Ok(new StudentAttendanceSummaryDto
        {
            StudentId = student.Id,
            StudentName = student.User?.FullName ?? "Student",
            RollNumber = student.RollNumber,
            ClassName = student.ClassRoom?.FullName ?? "N/A",
            TotalDays = total,
            PresentDays = present,
            AbsentDays = absent,
            LateDays = late,
            LeaveDays = leave,
            AttendancePercentage = pct
        });
    }

    [HttpGet("low-attendance")]
    [Authorize(Roles = "HOD,Teacher")]
    public async Task<ActionResult<List<StudentAttendanceSummaryDto>>> GetLowAttendanceStudents([FromQuery] Guid? classId)
    {
        var query = _db.Students
            .Where(s => s.Status == StudentStatus.Active)
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .AsNoTracking();

        var isAdmin = _currentUserService.IsInRole("HOD");
        if (!isAdmin && _currentUserService.IsInRole("Teacher"))
        {
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);
            if (teacher == null) return Unauthorized();

            var allocatedClassIds = await _db.TeacherAllocations
                .Where(a => a.TeacherId == teacher.Id && !a.IsDeleted)
                .Select(a => a.ClassRoomId)
                .ToListAsync();

            query = query.Where(s => allocatedClassIds.Contains(s.ClassRoomId));
        }

        if (classId.HasValue) query = query.Where(s => s.ClassRoomId == classId.Value);

        var students = await query.ToListAsync();
        var allAttendances = await _db.Attendances.ToListAsync();

        var lowList = new List<StudentAttendanceSummaryDto>();

        foreach (var s in students)
        {
            var studentAtt = allAttendances.Where(a => a.StudentId == s.Id).ToList();
            var total = studentAtt.Count;
            if (total == 0) continue;

            var present = studentAtt.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late);
            var pct = Math.Round((decimal)present / total * 100, 1);

            if (pct < 75.0m)
            {
                lowList.Add(new StudentAttendanceSummaryDto
                {
                    StudentId = s.Id,
                    StudentName = s.User?.FullName ?? "Student",
                    RollNumber = s.RollNumber,
                    ClassName = s.ClassRoom?.FullName ?? "N/A",
                    TotalDays = total,
                    PresentDays = present,
                    AbsentDays = studentAtt.Count(a => a.Status == AttendanceStatus.Absent),
                    LateDays = studentAtt.Count(a => a.Status == AttendanceStatus.Late),
                    LeaveDays = studentAtt.Count(a => a.Status == AttendanceStatus.Leave),
                    AttendancePercentage = pct
                });
            }
        }

        return Ok(lowList);
    }
}
