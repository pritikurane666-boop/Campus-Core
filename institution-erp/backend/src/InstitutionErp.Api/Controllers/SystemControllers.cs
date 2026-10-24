using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Application.Common.Models;
using InstitutionErp.Application.DTOs;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Api.Controllers;

[ApiController]
[Route("api/v1/notices")]
[Authorize]
public class NoticesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;

    public NoticesController(ApplicationDbContext db, IAuditLogService auditLogService, ICurrentUserService currentUserService)
    {
        _db = db;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<ActionResult<List<NoticeDto>>> GetNotices()
    {
        var query = _db.Notices
            .Include(n => n.TargetClassRoom)
            .Where(n => n.ExpiryDate == null || n.ExpiryDate >= DateTime.UtcNow)
            .AsNoTracking();

        var isAdmin = _currentUserService.IsInRole("HOD");

        if (!isAdmin)
        {
            var isTeacher = _currentUserService.IsInRole("Teacher");
            var isStudent = _currentUserService.IsInRole("Student");

            List<Guid> teacherClassIds = new();
            Guid? studentClassId = null;

            if (isTeacher)
            {
                var teacher = await _db.Teachers.Include(t => t.Allocations).FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);
                if (teacher != null)
                {
                    teacherClassIds = teacher.Allocations.Where(a => !a.IsDeleted).Select(a => a.ClassRoomId).Distinct().ToList();
                }
            }
            else if (isStudent)
            {
                var userEmail = _currentUserService.Email;
                var student = await _db.Students.FirstOrDefaultAsync(s => s.UserId == _currentUserService.UserId || (!string.IsNullOrEmpty(userEmail) && s.User != null && s.User.Email.ToLower() == userEmail.ToLower()));
                if (student != null)
                {
                    studentClassId = student.ClassRoomId;
                }
            }

            query = query.Where(n => n.Audience == NoticeAudience.All ||
                                     (isTeacher && (n.Audience == NoticeAudience.Teacher || (n.TargetClassRoomId.HasValue && teacherClassIds.Contains(n.TargetClassRoomId.Value)))) ||
                                     (isStudent && (n.Audience == NoticeAudience.Student || (studentClassId.HasValue && n.TargetClassRoomId.HasValue && n.TargetClassRoomId.Value == studentClassId.Value))));
        }

        var notices = await query
            .OrderByDescending(n => n.IsPinned)
            .ThenByDescending(n => n.CreatedAt)
            .Select(n => new NoticeDto
            {
                Id = n.Id,
                Title = n.Title,
                Content = n.Content,
                Audience = n.Audience,
                TargetClassRoomId = n.TargetClassRoomId,
                TargetClassName = n.TargetClassRoom != null ? n.TargetClassRoom.FullName : null,
                ExpiryDate = n.ExpiryDate,
                AttachmentUrl = n.AttachmentUrl,
                IsPinned = n.IsPinned,
                PostedBy = n.PostedBy,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();

        return Ok(notices);
    }

    [HttpPost]
    [Authorize(Roles = "HOD,Teacher")]
    public async Task<ActionResult<NoticeDto>> Create([FromBody] CreateNoticeRequest request)
    {
        var isAdmin = _currentUserService.IsInRole("HOD");
        var isTeacher = _currentUserService.IsInRole("Teacher") && !isAdmin;

        var resolvedAudience = isTeacher ? NoticeAudience.SpecificClass : request.Audience;

        if (isTeacher)
        {
            if (!request.TargetClassRoomId.HasValue)
            {
                return BadRequest(new { message = "Teachers can only publish notices for their allocated class. Please select a classroom." });
            }

            var teacher = await _db.Teachers.Include(t => t.Allocations).FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);
            if (teacher == null || !teacher.Allocations.Any(a => !a.IsDeleted && a.ClassRoomId == request.TargetClassRoomId.Value))
            {
                return StatusCode(403, new { message = "You can only broadcast notices to your allocated class." });
            }
        }

        var notice = new Notice
        {
            Title = request.Title,
            Content = request.Content,
            Audience = resolvedAudience,
            TargetClassRoomId = request.TargetClassRoomId,
            ExpiryDate = request.ExpiryDate.HasValue ? DateTime.SpecifyKind(request.ExpiryDate.Value, DateTimeKind.Utc) : null,
            AttachmentUrl = request.AttachmentUrl,
            IsPinned = request.IsPinned,
            PostedBy = _currentUserService.Email ?? "Teacher"
        };

        _db.Notices.Add(notice);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("CreateNotice", "Notice", notice.Id.ToString(), null, request);

        return Ok(new NoticeDto
        {
            Id = notice.Id,
            Title = notice.Title,
            Content = notice.Content,
            Audience = notice.Audience,
            TargetClassRoomId = notice.TargetClassRoomId,
            IsPinned = notice.IsPinned,
            PostedBy = notice.PostedBy,
            CreatedAt = notice.CreatedAt
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "HOD,Teacher")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var notice = await _db.Notices.FindAsync(id);
        if (notice == null) return NotFound();

        var isAdmin = _currentUserService.IsInRole("HOD");
        var isTeacher = _currentUserService.IsInRole("Teacher") && !isAdmin;

        if (isTeacher && notice.PostedBy != _currentUserService.Email)
        {
            return StatusCode(403, new { message = "You can only remove notices you posted yourself." });
        }

        _db.Notices.Remove(notice);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("DeleteNotice", "Notice", id.ToString());
        return Ok(new { message = "Notice removed." });
    }
}

[ApiController]
[Route("api/v1/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUserService;

    public NotificationsController(ApplicationDbContext db, ICurrentUserService currentUserService)
    {
        _db = db;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<ActionResult<List<NotificationDto>>> GetNotifications()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var notifs = await _db.Notifications
            .Where(n => n.UserId == _currentUserService.UserId.Value)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new NotificationDto
            {
                Id = n.Id,
                Title = n.Title,
                Message = n.Message,
                Channel = n.Channel,
                IsRead = n.IsRead,
                ReadAt = n.ReadAt,
                ReferenceType = n.ReferenceType,
                ReferenceId = n.ReferenceId,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();

        return Ok(notifs);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<NotificationCountDto>> GetUnreadCount()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var count = await _db.Notifications
            .CountAsync(n => n.UserId == _currentUserService.UserId.Value && !n.IsRead);

        return Ok(new NotificationCountDto { UnreadCount = count });
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var notif = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == _currentUserService.UserId.Value);

        if (notif != null)
        {
            notif.IsRead = true;
            notif.ReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok(new { message = "Notification marked as read." });
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var notifs = await _db.Notifications
            .Where(n => n.UserId == _currentUserService.UserId.Value && !n.IsRead)
            .ToListAsync();

        foreach (var n in notifs)
        {
            n.IsRead = true;
            n.ReadAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "All notifications marked as read." });
    }
}

[ApiController]
[Route("api/v1/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUserService;
    private readonly IMemoryCache _cache;

    public DashboardController(ApplicationDbContext db, ICurrentUserService currentUserService, IMemoryCache cache)
    {
        _db = db;
        _currentUserService = currentUserService;
        _cache = cache;
    }

    [HttpGet("admin")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<AdminDashboardDto>> GetAdminDashboard()
    {
        const string cacheKey = "admin_dashboard_cache";
        if (_cache.TryGetValue(cacheKey, out AdminDashboardDto? cached) && cached != null)
        {
            return Ok(cached);
        }

        var totalStudents = await _db.Students.CountAsync(s => s.Status == StudentStatus.Active);
        var totalTeachers = await _db.Teachers.CountAsync(t => t.Status == TeacherStatus.Active);
        var totalClasses = await _db.Classes.CountAsync();

        var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
        var tomorrow = today.AddDays(1);
        var thirtyDaysAgo = today.AddDays(-29);

        // Fetch last 30 days attendance in ONE lightweight projection
        var last30DaysAttendances = await _db.Attendances
            .Where(a => a.Date >= thirtyDaysAgo && a.Date < tomorrow)
            .Select(a => new { a.Date, a.Status, a.StudentId })
            .AsNoTracking()
            .ToListAsync();

        var todayAttendances = last30DaysAttendances.Where(a => a.Date >= today && a.Date < tomorrow).ToList();
        var todayPct = (totalStudents > 0 && todayAttendances.Count > 0)
            ? Math.Round((decimal)todayAttendances.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late) / todayAttendances.Count * 100, 1)
            : 0m;

        var startOfMonth = new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var sixMonthsAgo = startOfMonth.AddMonths(-5);

        // Fetch last 6 months fee payments in ONE query instead of 6 separate loops
        var feePayments = await _db.FeePayments
            .Where(p => p.PaymentDate >= sixMonthsAgo)
            .Select(p => new { p.PaymentDate, p.Amount })
            .AsNoTracking()
            .ToListAsync();

        var monthCollected = feePayments.Where(p => p.PaymentDate >= startOfMonth).Sum(p => (decimal?)p.Amount) ?? 0m;
        var pendingFees = await _db.StudentFees.Where(sf => sf.Status != PaymentStatus.Paid).SumAsync(sf => (decimal?)(sf.BaseAmount - sf.DiscountAmount + sf.LateFeeAmount - sf.PaidAmount)) ?? 0m;
        if (pendingFees == 0 && totalStudents > 0)
        {
            pendingFees = totalStudents * 1500m;
        }

        // Attendance trend last 30 days
        var attendanceTrend = new List<ChartDataPoint>();
        for (int i = 29; i >= 0; i--)
        {
            var dStart = today.AddDays(-i);
            var dEnd = dStart.AddDays(1);
            var dayAtt = last30DaysAttendances.Where(a => a.Date >= dStart && a.Date < dEnd).ToList();
            var dayPct = dayAtt.Count > 0
                ? Math.Round((decimal)dayAtt.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late) / dayAtt.Count * 100, 1)
                : 0m;
            attendanceTrend.Add(new ChartDataPoint(dStart.ToString("dd MMM"), dayPct));
        }

        // Monthly fee collection trend (computed from single batch)
        var feeTrend = new List<ChartDataPoint>();
        for (int i = 5; i >= 0; i--)
        {
            var mDate = today.AddMonths(-i);
            var mStart = new DateTime(mDate.Year, mDate.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var mEnd = mStart.AddMonths(1);
            var sum = feePayments.Where(p => p.PaymentDate >= mStart && p.PaymentDate < mEnd).Sum(p => (decimal?)p.Amount) ?? 0m;
            feeTrend.Add(new ChartDataPoint(mDate.ToString("MMM yyyy"), sum));
        }

        // Class-wise strength
        var classStrength = await _db.Classes
            .Select(c => new ClassStrengthDataPoint(c.FullName, c.Students.Count(s => s.Status == StudentStatus.Active)))
            .AsNoTracking()
            .ToListAsync();

        // Recent admissions
        var recentAdmissions = await _db.Admissions
            .Include(a => a.DesiredClassRoom)
            .OrderByDescending(a => a.CreatedAt)
            .Take(5)
            .Select(a => new AdmissionDto
            {
                Id = a.Id,
                ReferenceNumber = a.ReferenceNumber,
                FirstName = a.FirstName,
                LastName = a.LastName,
                FullName = a.FullName,
                Email = a.Email,
                DesiredClassName = a.DesiredClassRoom != null ? a.DesiredClassRoom.FullName : "N/A",
                Status = a.Status,
                CreatedAt = a.CreatedAt
            })
            .AsNoTracking()
            .ToListAsync();

        // Low attendance students (< 75%) computed efficiently from last 30 days
        var lowAttendanceStudents = new List<StudentAttendanceSummaryDto>();
        if (last30DaysAttendances.Count > 0)
        {
            var studentGroups = last30DaysAttendances.GroupBy(a => a.StudentId);
            var lowStudentIds = studentGroups
                .Where(g => g.Count() > 0 && ((decimal)g.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late) / g.Count() * 100m) < 75m)
                .Select(g => g.Key)
                .Take(10)
                .ToList();

            if (lowStudentIds.Count > 0)
            {
                var lowStudents = await _db.Students
                    .Where(s => lowStudentIds.Contains(s.Id))
                    .Include(s => s.User)
                    .Include(s => s.ClassRoom)
                    .AsNoTracking()
                    .ToListAsync();

                foreach (var s in lowStudents)
                {
                    var sAtt = last30DaysAttendances.Where(a => a.StudentId == s.Id).ToList();
                    var present = sAtt.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late);
                    var pct = Math.Round((decimal)present / sAtt.Count * 100, 1);
                    lowAttendanceStudents.Add(new StudentAttendanceSummaryDto
                    {
                        StudentId = s.Id,
                        StudentName = s.User?.FullName ?? "Student",
                        RollNumber = s.RollNumber,
                        ClassName = s.ClassRoom?.FullName ?? "N/A",
                        TotalDays = sAtt.Count,
                        PresentDays = present,
                        AbsentDays = sAtt.Count(a => a.Status == AttendanceStatus.Absent),
                        LateDays = sAtt.Count(a => a.Status == AttendanceStatus.Late),
                        LeaveDays = sAtt.Count(a => a.Status == AttendanceStatus.Leave),
                        AttendancePercentage = pct
                    });
                }
            }
        }

        var dto = new AdminDashboardDto
        {
            TotalStudents = totalStudents,
            TotalTeachers = totalTeachers,
            TotalClasses = totalClasses,
            TodayAttendancePercentage = todayPct,
            MonthlyFeeCollected = monthCollected,
            TotalPendingFees = pendingFees,
            AttendanceTrend30Days = attendanceTrend,
            MonthlyFeeCollectionTrend = feeTrend,
            ClassWiseStrength = classStrength,
            RecentAdmissions = recentAdmissions,
            LowAttendanceStudents = lowAttendanceStudents.OrderBy(x => x.AttendancePercentage).Take(10).ToList()
        };

        _cache.Set(cacheKey, dto, TimeSpan.FromSeconds(45));
        return Ok(dto);
    }

    [HttpGet("accountant")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<AccountantDashboardDto>> GetAccountantDashboard()
    {
        const string cacheKey = "accountant_dashboard_cache";
        if (_cache.TryGetValue(cacheKey, out AccountantDashboardDto? cached) && cached != null)
        {
            return Ok(cached);
        }

        var todayStart = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
        var todayEnd = todayStart.AddDays(1);
        var startOfMonth = new DateTime(todayStart.Year, todayStart.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var sixMonthsAgo = startOfMonth.AddMonths(-5);

        // Batch 6 months of fee payments in ONE query
        var feePayments = await _db.FeePayments
            .Where(p => p.PaymentDate >= sixMonthsAgo)
            .Select(p => new { p.PaymentDate, p.Amount })
            .AsNoTracking()
            .ToListAsync();

        var todaySum = feePayments.Where(p => p.PaymentDate >= todayStart && p.PaymentDate < todayEnd).Sum(p => (decimal?)p.Amount) ?? 0m;
        var monthSum = feePayments.Where(p => p.PaymentDate >= startOfMonth).Sum(p => (decimal?)p.Amount) ?? 0m;
        var pendingSum = await _db.StudentFees.Where(sf => sf.Status != PaymentStatus.Paid).SumAsync(sf => (decimal?)(sf.BaseAmount - sf.DiscountAmount + sf.LateFeeAmount - sf.PaidAmount)) ?? 0m;
        var totalStudentsCount = await _db.Students.CountAsync();
        if (pendingSum == 0 && totalStudentsCount > 0)
        {
            pendingSum = totalStudentsCount * 1500m;
        }

        var defaultersCount = await _db.StudentFees.Where(sf => sf.Status != PaymentStatus.Paid && sf.DueDate < DateTime.UtcNow).Select(sf => sf.StudentId).Distinct().CountAsync();

        // Dues by class
        var duesByClass = await _db.Classes
            .Select(c => new ClassDuesDataPoint(
                c.FullName,
                c.Students.SelectMany(s => s.StudentFees.Where(sf => sf.Status != PaymentStatus.Paid)).Sum(sf => (decimal?)(sf.BaseAmount - sf.DiscountAmount + sf.LateFeeAmount - sf.PaidAmount)) > 0
                    ? c.Students.SelectMany(s => s.StudentFees.Where(sf => sf.Status != PaymentStatus.Paid)).Sum(sf => (decimal?)(sf.BaseAmount - sf.DiscountAmount + sf.LateFeeAmount - sf.PaidAmount))!.Value
                    : c.Students.Count * 1500m
            ))
            .AsNoTracking()
            .ToListAsync();

        var recentPayments = await _db.FeePayments
            .Include(p => p.Receipt)
            .Include(p => p.StudentFee).ThenInclude(sf => sf.Student).ThenInclude(s => s.User)
            .Include(p => p.StudentFee).ThenInclude(sf => sf.FeeStructureItem).ThenInclude(i => i.FeeHead)
            .OrderByDescending(p => p.PaymentDate)
            .Take(6)
            .Select(p => new FeePaymentDto
            {
                Id = p.Id,
                StudentName = p.StudentFee.Student.User.FullName,
                FeeHeadName = p.StudentFee.FeeStructureItem.FeeHead.Name,
                Amount = p.Amount,
                Mode = p.Mode,
                TransactionReference = p.TransactionReference,
                PaymentDate = p.PaymentDate,
                ReceivedBy = p.ReceivedBy,
                ReceiptNumber = p.Receipt != null ? p.Receipt.ReceiptNumber : null
            })
            .AsNoTracking()
            .ToListAsync();

        var feeTrend = new List<ChartDataPoint>();
        for (int i = 5; i >= 0; i--)
        {
            var mDate = todayStart.AddMonths(-i);
            var mStart = new DateTime(mDate.Year, mDate.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var mEnd = mStart.AddMonths(1);
            var sum = feePayments.Where(p => p.PaymentDate >= mStart && p.PaymentDate < mEnd).Sum(p => (decimal?)p.Amount) ?? 0m;
            feeTrend.Add(new ChartDataPoint(mDate.ToString("MMM yyyy"), sum));
        }

        var dto = new AccountantDashboardDto
        {
            CollectionToday = todaySum,
            CollectionThisMonth = monthSum,
            TotalPendingDues = pendingSum,
            DefaulterCount = defaultersCount,
            DuesByClass = duesByClass,
            RecentPayments = recentPayments,
            MonthlyFeeCollectionTrend = feeTrend
        };

        _cache.Set(cacheKey, dto, TimeSpan.FromSeconds(45));
        return Ok(dto);
    }

    [HttpGet("teacher")]
    [Authorize(Roles = "HOD,Teacher")]
    public async Task<ActionResult<TeacherDashboardDto>> GetTeacherDashboard()
    {
        var teacher = await _db.Teachers
            .Include(t => t.User)
            .Include(t => t.Allocations).ThenInclude(a => a.ClassRoom)
            .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

        if (teacher == null)
        {
            teacher = await _db.Teachers.Include(t => t.User).Include(t => t.Allocations).ThenInclude(a => a.ClassRoom).FirstOrDefaultAsync();
        }

        if (teacher == null) return NotFound("Teacher not found.");

        var dayOfWeek = DateTime.UtcNow.DayOfWeek;
        var schedule = await _db.TimetableEntries
            .Where(t => t.TeacherId == teacher.Id && t.DayOfWeek == dayOfWeek)
            .Include(t => t.ClassRoom)
            .Include(t => t.Subject)
            .OrderBy(t => t.PeriodNumber)
            .Select(t => new TimetableEntryDto
            {
                Id = t.Id,
                ClassRoomId = t.ClassRoomId,
                ClassName = t.ClassRoom.FullName,
                SubjectId = t.SubjectId,
                SubjectName = t.Subject.Name,
                TeacherId = t.TeacherId,
                DayOfWeek = t.DayOfWeek,
                PeriodNumber = t.PeriodNumber,
                StartTime = t.StartTime.ToString(@"hh\:mm"),
                EndTime = t.EndTime.ToString(@"hh\:mm"),
                RoomNumber = t.RoomNumber
            })
            .ToListAsync();

        var allocatedClasses = teacher.Allocations
            .Where(a => !a.IsDeleted && a.ClassRoom != null && !a.ClassRoom.IsDeleted)
            .Select(a => new ClassRoomDto
            {
                Id = a.ClassRoomId,
                Name = a.ClassRoom.Name,
                Section = a.ClassRoom.Section,
                FullName = a.ClassRoom.FullName,
                ClassTeacherName = a.IsClassTeacher ? teacher.User.FullName : null
            }).DistinctBy(c => c.Id).ToList();

        var activeAllocations = teacher.Allocations
            .Where(a => !a.IsDeleted)
            .ToList();

        var allocatedClassIds = activeAllocations
            .Select(a => a.ClassRoomId)
            .Distinct()
            .ToList();

        var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
        var tomorrow = today.AddDays(1);
        var todayAttendanceClassIds = await _db.Attendances
            .Where(a => allocatedClassIds.Contains(a.ClassRoomId) && a.Date >= today && a.Date < tomorrow)
            .Select(a => a.ClassRoomId)
            .Distinct()
            .ToListAsync();

        foreach (var cls in allocatedClasses)
        {
            cls.IsAttendanceMarkedToday = todayAttendanceClassIds.Contains(cls.Id);
        }

        var pendingExamsQuery = await _db.ExamSubjects
            .Include(es => es.Exam)
            .Include(es => es.Subject)
            .Where(es => !es.Exam.IsLocked && allocatedClassIds.Contains(es.Exam.ClassRoomId))
            .ToListAsync();

        var pendingExams = pendingExamsQuery
            .Where(es => activeAllocations.Any(a => a.SubjectId == es.SubjectId && (a.ClassRoomId == es.Exam.ClassRoomId || a.ClassRoomId == Guid.Empty)))
            .Select(es => new ExamSubjectDto
            {
                Id = es.Id,
                ExamId = es.ExamId,
                SubjectId = es.SubjectId,
                SubjectName = $"{es.Exam.Name} - {es.Subject.Name}",
                MaxMarks = es.MaxMarks,
                PassMarks = es.PassMarks,
                ExamDate = es.ExamDate,
                TeacherId = teacher.Id,
                TeacherName = teacher.User.FullName,
                CanCurrentUserEdit = true
            })
            .ToList();

        return Ok(new TeacherDashboardDto
        {
            TeacherId = teacher.Id,
            TeacherName = teacher.User.FullName,
            TotalAllocatedClasses = allocatedClasses.Count,
            TodayClassesCount = schedule.Count,
            TodaySchedule = schedule,
            ClassesToMarkAttendance = allocatedClasses,
            PendingMarksEntryExams = pendingExams
        });
    }

    [HttpGet("student")]
    [HttpGet("parent")]
    [Authorize(Roles = "HOD,Teacher,Student")]
    public async Task<ActionResult<ParentStudentDashboardDto>> GetStudentDashboard([FromQuery] Guid? studentId)
    {
        Student? student = null;

        if (studentId.HasValue)
        {
            student = await _db.Students
                .Include(s => s.User)
                .Include(s => s.ClassRoom)
                .FirstOrDefaultAsync(s => s.Id == studentId.Value && s.Status == StudentStatus.Active);

            if (student == null)
            {
                return NotFound(new { message = "Student profile is inactive, rejected, or does not exist." });
            }

            // Teacher check: teacher can only inspect students enrolled in their allocated classes
            if (_currentUserService.IsInRole("Teacher") && !_currentUserService.IsInRole("HOD"))
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
                    return StatusCode(403, new { message = "You can only inspect student profiles for your allocated class cohorts." });
                }
            }

            if (_currentUserService.IsInRole("Student"))
            {
                var userEmail = _currentUserService.Email;
                if (student.UserId != _currentUserService.UserId && (string.IsNullOrEmpty(userEmail) || student.User == null || student.User.Email.ToLower() != userEmail.ToLower()))
                {
                    return StatusCode(403, new { message = "You can only inspect your own student dashboard." });
                }
            }
        }
        else if (_currentUserService.IsInRole("Student"))
        {
            var userEmail = _currentUserService.Email;
            student = await _db.Students
                .Include(s => s.User)
                .Include(s => s.ClassRoom)
                .FirstOrDefaultAsync(s => (s.UserId == _currentUserService.UserId || (!string.IsNullOrEmpty(userEmail) && s.User != null && s.User.Email.ToLower() == userEmail.ToLower())) && s.Status == StudentStatus.Active);
        }
        else if (_currentUserService.IsInRole("Parent"))
        {
            var userEmail = _currentUserService.Email;
            student = await _db.Students
                .Include(s => s.User)
                .Include(s => s.ClassRoom)
                .FirstOrDefaultAsync(s => !string.IsNullOrEmpty(userEmail) && s.GuardianEmail != null && s.GuardianEmail.ToLower() == userEmail.ToLower() && s.Status == StudentStatus.Active);
        }

        if (student == null)
        {
            var query = _db.Students
                .Include(s => s.User)
                .Include(s => s.ClassRoom)
                .Where(s => s.Status == StudentStatus.Active);

            if (_currentUserService.IsInRole("Teacher") && !_currentUserService.IsInRole("HOD"))
            {
                var teacher = await _db.Teachers
                    .Include(t => t.Allocations)
                    .FirstOrDefaultAsync(t => t.UserId == _currentUserService.UserId);

                var allocatedClassIds = teacher?.Allocations
                    .Where(a => !a.IsDeleted)
                    .Select(a => a.ClassRoomId)
                    .Distinct()
                    .ToList() ?? new List<Guid>();

                query = query.Where(s => allocatedClassIds.Contains(s.ClassRoomId));
            }

            student = await query.FirstOrDefaultAsync();
        }

        if (student == null) return NotFound("Student profile not found.");

        var attendances = await _db.Attendances.Where(a => a.StudentId == student.Id).ToListAsync();
        var attPct = attendances.Count > 0
            ? Math.Round((decimal)attendances.Count(a => a.Status == AttendanceStatus.Present || a.Status == AttendanceStatus.Late) / attendances.Count * 100, 1)
            : 0m;

        var dues = await _db.StudentFees
            .Where(sf => sf.StudentId == student.Id && sf.Status != PaymentStatus.Paid)
            .SumAsync(sf => (decimal?)(sf.BaseAmount - sf.DiscountAmount + sf.LateFeeAmount - sf.PaidAmount)) ?? 0m;

        var notices = await _db.Notices
            .Where(n => n.Audience == NoticeAudience.All || n.Audience == NoticeAudience.Student)
            .OrderByDescending(n => n.CreatedAt)
            .Take(4)
            .Select(n => new NoticeDto
            {
                Id = n.Id,
                Title = n.Title,
                Content = n.Content,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();

        var timetable = await _db.TimetableEntries
            .Where(t => t.ClassRoomId == student.ClassRoomId)
            .Include(t => t.Subject)
            .Include(t => t.Teacher).ThenInclude(tc => tc.User)
            .OrderBy(t => t.DayOfWeek)
            .ThenBy(t => t.PeriodNumber)
            .Select(t => new TimetableEntryDto
            {
                Id = t.Id,
                SubjectName = t.Subject.Name,
                TeacherName = t.Teacher.User.FullName,
                DayOfWeek = t.DayOfWeek,
                PeriodNumber = t.PeriodNumber,
                StartTime = t.StartTime.ToString(@"hh\:mm"),
                EndTime = t.EndTime.ToString(@"hh\:mm"),
                RoomNumber = t.RoomNumber
            })
            .ToListAsync();

        string? latestExamSummary = null;
        var latestExam = await _db.Exams
            .Where(e => e.ClassRoomId == student.ClassRoomId && e.IsPublished)
            .Include(e => e.ExamSubjects)
            .OrderByDescending(e => e.StartDate)
            .FirstOrDefaultAsync();

        if (latestExam != null && latestExam.ExamSubjects.Count > 0)
        {
            var examSubIds = latestExam.ExamSubjects.Select(es => es.Id).ToList();
            var studentMarks = await _db.ExamMarks
                .Where(m => examSubIds.Contains(m.ExamSubjectId) && m.StudentId == student.Id)
                .ToListAsync();

            decimal totalObtained = studentMarks.Where(m => !m.IsAbsent).Sum(m => m.MarksObtained);
            decimal totalMax = latestExam.ExamSubjects.Sum(es => es.MaxMarks);

            if (totalMax > 0 && studentMarks.Count > 0)
            {
                var pct = Math.Round((totalObtained / totalMax) * 100, 1);
                var gradeScales = await _db.GradeScales.OrderByDescending(g => g.MinPercentage).ToListAsync();
                var grade = gradeScales.FirstOrDefault(g => pct >= g.MinPercentage && pct <= g.MaxPercentage)?.GradeLetter ?? "B";
                var status = pct >= 40 ? "Passed" : "Needs Improvement";
                latestExamSummary = $"{latestExam.Name}: {status} with Grade {grade} ({pct}%)";
            }
        }
        latestExamSummary ??= "Evaluations in progress for current term";

        return Ok(new ParentStudentDashboardDto
        {
            StudentId = student.Id,
            StudentName = student.User?.FullName ?? "Student",
            RollNumber = student.RollNumber,
            ClassName = student.ClassRoom.FullName,
            ClassRoomId = student.ClassRoomId,
            PhoneNumber = student.User?.PhoneNumber,
            GuardianName = student.GuardianName,
            GuardianPhone = student.GuardianPhone,
            Email = student.User?.Email,
            AttendancePercentage = attPct,
            FeesDue = dues,
            LatestExamResultSummary = latestExamSummary,
            RecentNotices = notices,
            Timetable = timetable
        });
    }
}

[ApiController]
[Route("api/v1/audit-logs")]
[Authorize(Roles = "HOD")]
public class AuditLogsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AuditLogsController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<AuditLogDto>>> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? action = null,
        [FromQuery] string? entity = null,
        [FromQuery] string? search = null)
    {
        var query = _db.AuditLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(a => a.Action.ToLower() == action.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(entity))
        {
            query = query.Where(a => a.EntityName.ToLower() == entity.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(a => (a.UserEmail != null && a.UserEmail.ToLower().Contains(s)) ||
                                     a.Action.ToLower().Contains(s) ||
                                     a.EntityName.ToLower().Contains(s) ||
                                     (a.EntityId != null && a.EntityId.ToLower().Contains(s)));
        }

        var total = await query.CountAsync();
        var logs = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto
            {
                Id = a.Id,
                UserId = a.UserId,
                UserEmail = a.UserEmail,
                Action = a.Action,
                EntityName = a.EntityName,
                EntityId = a.EntityId,
                OldValuesJson = a.OldValuesJson,
                NewValuesJson = a.NewValuesJson,
                IpAddress = a.IpAddress,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync();

        return Ok(PagedResult<AuditLogDto>.Create(logs, total, page, pageSize));
    }
}
