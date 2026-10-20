namespace InstitutionErp.Application.DTOs;

public class AdminDashboardDto
{
    public int TotalStudents { get; set; }
    public int TotalTeachers { get; set; }
    public int TotalClasses { get; set; }
    public decimal TodayAttendancePercentage { get; set; }
    public decimal MonthlyFeeCollected { get; set; }
    public decimal TotalPendingFees { get; set; }

    public List<ChartDataPoint> AttendanceTrend30Days { get; set; } = new();
    public List<ChartDataPoint> MonthlyFeeCollectionTrend { get; set; } = new();
    public List<ClassStrengthDataPoint> ClassWiseStrength { get; set; } = new();
    public List<AdmissionDto> RecentAdmissions { get; set; } = new();
    public List<StudentAttendanceSummaryDto> LowAttendanceStudents { get; set; } = new();
}

public class AccountantDashboardDto
{
    public decimal CollectionToday { get; set; }
    public decimal CollectionThisMonth { get; set; }
    public decimal TotalPendingDues { get; set; }
    public int DefaulterCount { get; set; }

    public List<ClassDuesDataPoint> DuesByClass { get; set; } = new();
    public List<FeePaymentDto> RecentPayments { get; set; } = new();
    public List<ChartDataPoint> MonthlyFeeCollectionTrend { get; set; } = new();
}

public class TeacherDashboardDto
{
    public Guid TeacherId { get; set; }
    public string TeacherName { get; set; } = string.Empty;
    public int TotalAllocatedClasses { get; set; }
    public int TodayClassesCount { get; set; }
    public List<TimetableEntryDto> TodaySchedule { get; set; } = new();
    public List<ClassRoomDto> ClassesToMarkAttendance { get; set; } = new();
    public List<ExamSubjectDto> PendingMarksEntryExams { get; set; } = new();
}

public class ParentStudentDashboardDto
{
    public Guid StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public Guid ClassRoomId { get; set; }
    public string? PhoneNumber { get; set; }
    public string? GuardianName { get; set; }
    public string? GuardianPhone { get; set; }
    public string? Email { get; set; }
    public decimal AttendancePercentage { get; set; }
    public decimal FeesDue { get; set; }
    public string? LatestExamResultSummary { get; set; }
    public List<NoticeDto> RecentNotices { get; set; } = new();
    public List<TimetableEntryDto> Timetable { get; set; } = new();
}

public record ChartDataPoint(string Label, decimal Value);
public record ClassStrengthDataPoint(string ClassName, int StudentCount);
public record ClassDuesDataPoint(string ClassName, decimal DueAmount);
