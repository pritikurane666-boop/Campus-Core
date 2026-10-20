using Microsoft.EntityFrameworkCore;
using InstitutionErp.Domain.Entities;

namespace InstitutionErp.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<AcademicYear> AcademicYears { get; }
    DbSet<ClassRoom> Classes { get; }
    DbSet<Subject> Subjects { get; }
    DbSet<ClassSubject> ClassSubjects { get; }
    DbSet<Teacher> Teachers { get; }
    DbSet<TeacherAllocation> TeacherAllocations { get; }
    DbSet<TimetableEntry> TimetableEntries { get; }
    DbSet<TeacherAttendance> TeacherAttendances { get; }
    DbSet<Student> Students { get; }
    DbSet<Admission> Admissions { get; }
    DbSet<AdmissionDocument> AdmissionDocuments { get; }
    DbSet<AdmissionStatusHistory> AdmissionStatusHistories { get; }
    DbSet<FeeHead> FeeHeads { get; }
    DbSet<FeeStructure> FeeStructures { get; }
    DbSet<FeeStructureItem> FeeStructureItems { get; }
    DbSet<StudentFee> StudentFees { get; }
    DbSet<FeePayment> FeePayments { get; }
    DbSet<FeeReceipt> FeeReceipts { get; }
    DbSet<Attendance> Attendances { get; }
    DbSet<Exam> Exams { get; }
    DbSet<ExamSubject> ExamSubjects { get; }
    DbSet<ExamMark> ExamMarks { get; }
    DbSet<GradeScale> GradeScales { get; }
    DbSet<Notice> Notices { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<NotificationOutbox> NotificationOutboxes { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<AppSetting> AppSettings { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
