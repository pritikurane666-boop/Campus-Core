using Microsoft.EntityFrameworkCore;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Domain.Common;
using InstitutionErp.Domain.Entities;

namespace InstitutionErp.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    private readonly ICurrentUserService? _currentUserService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentUserService? currentUserService = null) : base(options)
    {
        _currentUserService = currentUserService;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AcademicYear> AcademicYears => Set<AcademicYear>();
    public DbSet<ClassRoom> Classes => Set<ClassRoom>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<ClassSubject> ClassSubjects => Set<ClassSubject>();
    public DbSet<Teacher> Teachers => Set<Teacher>();
    public DbSet<TeacherAllocation> TeacherAllocations => Set<TeacherAllocation>();
    public DbSet<TimetableEntry> TimetableEntries => Set<TimetableEntry>();
    public DbSet<TeacherAttendance> TeacherAttendances => Set<TeacherAttendance>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Admission> Admissions => Set<Admission>();
    public DbSet<AdmissionDocument> AdmissionDocuments => Set<AdmissionDocument>();
    public DbSet<AdmissionStatusHistory> AdmissionStatusHistories => Set<AdmissionStatusHistory>();
    public DbSet<FeeHead> FeeHeads => Set<FeeHead>();
    public DbSet<FeeStructure> FeeStructures => Set<FeeStructure>();
    public DbSet<FeeStructureItem> FeeStructureItems => Set<FeeStructureItem>();
    public DbSet<StudentFee> StudentFees => Set<StudentFee>();
    public DbSet<FeePayment> FeePayments => Set<FeePayment>();
    public DbSet<FeeReceipt> FeeReceipts => Set<FeeReceipt>();
    public DbSet<Attendance> Attendances => Set<Attendance>();
    public DbSet<Exam> Exams => Set<Exam>();
    public DbSet<ExamSubject> ExamSubjects => Set<ExamSubject>();
    public DbSet<ExamMark> ExamMarks => Set<ExamMark>();
    public DbSet<GradeScale> GradeScales => Set<GradeScale>();
    public DbSet<Notice> Notices => Set<Notice>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationOutbox> NotificationOutboxes => Set<NotificationOutbox>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Global query filter for soft delete
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType)
                    .HasQueryFilter(ConvertFilterExpression(entityType.ClrType));
            }
        }

        // User & Auth
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Email).HasMaxLength(256).IsRequired();
            entity.Property(u => u.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(u => u.LastName).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasIndex(r => r.Name).IsUnique();
            entity.Property(r => r.Name).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(ur => new { ur.UserId, ur.RoleId });
            entity.HasOne(ur => ur.User)
                .WithMany(u => u.UserRoles)
                .HasForeignKey(ur => ur.UserId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ur => ur.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(ur => ur.RoleId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasIndex(rt => rt.TokenHash).IsUnique();
            entity.HasIndex(rt => rt.UserId);
        });

        // Academic Structure
        modelBuilder.Entity<ClassRoom>(entity =>
        {
            entity.HasIndex(c => new { c.Name, c.Section, c.AcademicYearId });
        });

        modelBuilder.Entity<Subject>(entity =>
        {
            entity.HasIndex(s => s.Code).IsUnique();
        });

        // Student & Attendance
        modelBuilder.Entity<Student>(entity =>
        {
            entity.HasIndex(s => s.StudentRegistrationNumber).IsUnique();
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => new { s.ClassRoomId, s.RollNumber });
            entity.HasIndex(s => s.Status);
        });

        modelBuilder.Entity<Attendance>(entity =>
        {
            entity.HasIndex(a => new { a.StudentId, a.Date }).IsUnique();
            entity.HasIndex(a => new { a.ClassRoomId, a.Date });
        });

        // Faculty
        modelBuilder.Entity<Teacher>(entity =>
        {
            entity.HasIndex(t => t.EmployeeCode).IsUnique();
            entity.HasIndex(t => t.UserId);
            entity.HasIndex(t => t.Status);
        });

        modelBuilder.Entity<TeacherAllocation>(entity =>
        {
            entity.HasIndex(a => new { a.TeacherId, a.ClassRoomId, a.SubjectId });
        });

        modelBuilder.Entity<TeacherAttendance>(entity =>
        {
            entity.HasIndex(ta => new { ta.TeacherId, ta.Date }).IsUnique();
        });

        modelBuilder.Entity<TimetableEntry>(entity =>
        {
            entity.HasIndex(t => new { t.ClassRoomId, t.DayOfWeek, t.PeriodNumber });
            entity.HasIndex(t => new { t.TeacherId, t.DayOfWeek, t.PeriodNumber });
        });

        // Admissions
        modelBuilder.Entity<Admission>(entity =>
        {
            entity.HasIndex(a => a.ReferenceNumber).IsUnique();
            entity.HasIndex(a => a.Status);
            entity.HasIndex(a => a.DesiredClassRoomId);
            entity.HasIndex(a => a.Email);
            entity.Property(a => a.PreviousSchoolPercentage).HasPrecision(5, 2);
        });

        modelBuilder.Entity<AdmissionDocument>(entity =>
        {
            entity.HasIndex(ad => ad.AdmissionId);
        });

        modelBuilder.Entity<AdmissionStatusHistory>(entity =>
        {
            entity.HasIndex(ash => ash.AdmissionId);
        });

        // Fees
        modelBuilder.Entity<FeeStructure>(entity =>
        {
            entity.Property(fs => fs.TotalAmount).HasPrecision(18, 2);
            entity.HasIndex(fs => new { fs.ClassRoomId, fs.AcademicYearId });
        });

        modelBuilder.Entity<FeeStructureItem>(entity =>
        {
            entity.Property(fsi => fsi.Amount).HasPrecision(18, 2);
            entity.HasIndex(fsi => fsi.FeeStructureId);
        });

        modelBuilder.Entity<StudentFee>(entity =>
        {
            entity.Property(sf => sf.BaseAmount).HasPrecision(18, 2);
            entity.Property(sf => sf.DiscountAmount).HasPrecision(18, 2);
            entity.Property(sf => sf.LateFeeAmount).HasPrecision(18, 2);
            entity.Property(sf => sf.PaidAmount).HasPrecision(18, 2);
            entity.HasIndex(sf => new { sf.StudentId, sf.Status });
            entity.HasIndex(sf => sf.DueDate);
        });

        modelBuilder.Entity<FeePayment>(entity =>
        {
            entity.Property(fp => fp.Amount).HasPrecision(18, 2);
            entity.HasIndex(fp => fp.StudentFeeId);
            entity.HasIndex(fp => fp.PaymentDate);
            entity.HasOne(p => p.Receipt)
                .WithOne(r => r.FeePayment)
                .HasForeignKey<FeeReceipt>(r => r.FeePaymentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FeeReceipt>(entity =>
        {
            entity.HasIndex(fr => fr.ReceiptNumber).IsUnique();
        });

        // Exams
        modelBuilder.Entity<Exam>(entity =>
        {
            entity.HasIndex(e => new { e.ClassRoomId, e.AcademicYearId });
            entity.HasIndex(e => e.IsPublished);
        });

        modelBuilder.Entity<ExamSubject>(entity =>
        {
            entity.Property(es => es.MaxMarks).HasPrecision(5, 2);
            entity.Property(es => es.PassMarks).HasPrecision(5, 2);
            entity.HasIndex(es => new { es.ExamId, es.SubjectId });
        });

        modelBuilder.Entity<ExamMark>(entity =>
        {
            entity.Property(em => em.MarksObtained).HasPrecision(5, 2);
            entity.HasIndex(em => new { em.ExamSubjectId, em.StudentId }).IsUnique();
        });

        modelBuilder.Entity<GradeScale>(entity =>
        {
            entity.Property(gs => gs.MinPercentage).HasPrecision(5, 2);
            entity.Property(gs => gs.MaxPercentage).HasPrecision(5, 2);
            entity.Property(gs => gs.GradePoint).HasPrecision(5, 2);
        });

        // Notifications & Auditing
        modelBuilder.Entity<NotificationOutbox>(entity =>
        {
            entity.HasIndex(no => new { no.Status, no.NextRetryAt, no.CreatedAt });
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasIndex(n => new { n.UserId, n.IsRead });
        });

        modelBuilder.Entity<Notice>(entity =>
        {
            entity.HasIndex(n => new { n.Audience, n.IsPinned, n.CreatedAt });
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasIndex(al => new { al.EntityName, al.EntityId });
            entity.HasIndex(al => al.CreatedAt);
            entity.HasIndex(al => al.UserId);
        });
    }

    private static System.Linq.Expressions.LambdaExpression ConvertFilterExpression(Type entityType)
    {
        var parameter = System.Linq.Expressions.Expression.Parameter(entityType, "e");
        var property = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.IsDeleted));
        var condition = System.Linq.Expressions.Expression.Equal(property, System.Linq.Expressions.Expression.Constant(false));
        return System.Linq.Expressions.Expression.Lambda(condition, parameter);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var userEmail = _currentUserService?.Email ?? "System";

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = DateTime.UtcNow;
                    entry.Entity.CreatedBy = userEmail;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = DateTime.UtcNow;
                    entry.Entity.UpdatedBy = userEmail;
                    break;
                case EntityState.Deleted:
                    // Soft delete
                    entry.State = EntityState.Modified;
                    entry.Entity.IsDeleted = true;
                    entry.Entity.UpdatedAt = DateTime.UtcNow;
                    entry.Entity.UpdatedBy = userEmail;
                    break;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
