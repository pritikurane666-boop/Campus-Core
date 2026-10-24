using System.Net;
using System.Security.Claims;
using System.Text.Json;
using FluentAssertions;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using InstitutionErp.Api.Controllers;
using InstitutionErp.Api.Middleware;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Application.DTOs;
using InstitutionErp.Application.Validators;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Persistence;
using InstitutionErp.Infrastructure.Storage;

namespace InstitutionErp.UnitTests;

public class ScopeSixChangesTests
{
    // =========================================================================
    // CHANGE 1: Staff & Roles Module - Principal removed, HOD active
    // =========================================================================
    [Fact]
    public void Change1_UserRoleType_ContainsHod_AndDoesNotContainPrincipal()
    {
        var roleNames = Enum.GetNames(typeof(UserRoleType));
        roleNames.Should().Contain("HOD");
        roleNames.Should().NotContain("Principal");
    }

    [Theory]
    [InlineData("HOD", true)]
    [InlineData("Teacher", true)]
    [InlineData("Principal", false)]
    [InlineData("Admin", false)]
    [InlineData("Student", false)]
    public void Change1_CreateUserRequestValidator_OnlyAllowsHodAndTeacherRoles(string role, bool shouldBeValid)
    {
        var validator = new CreateUserRequestValidator();
        var request = new CreateUserRequest(
            Email: "staff@institution.edu",
            FirstName: "Test",
            LastName: "User",
            Roles: new List<string> { role },
            PhoneNumber: "9876543210",
            Password: "TemporaryPassword123"
        );

        var result = validator.Validate(request);
        if (shouldBeValid)
        {
            result.IsValid.Should().BeTrue();
        }
        else
        {
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "Roles");
        }
    }

    // =========================================================================
    // CHANGE 2: Admission Form - Blood Group, 2 MB PDF limit, Mandatory Docs
    // =========================================================================
    [Theory]
    [InlineData("A+", true)]
    [InlineData("A-", true)]
    [InlineData("B+", true)]
    [InlineData("B-", true)]
    [InlineData("AB+", true)]
    [InlineData("AB-", true)]
    [InlineData("O+", true)]
    [InlineData("O-", true)]
    [InlineData("XYZ", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Change2_ApplyAdmissionRequestValidator_ValidatesBloodGroup(string? bloodGroup, bool shouldBeValid)
    {
        var validator = new ApplyAdmissionRequestValidator();
        var request = new ApplyAdmissionRequest(
            FirstName: "Rohan",
            LastName: "Verma",
            Email: "rohan@example.com",
            PhoneNumber: "9876543210",
            DateOfBirth: DateTime.UtcNow.AddYears(-15),
            Gender: Gender.Male,
            BloodGroup: bloodGroup,
            Address: "123 Main St",
            GuardianName: "Suresh Verma",
            GuardianPhone: "9876543211",
            GuardianEmail: "suresh@example.com",
            GuardianRelation: "Father",
            DesiredClassRoomId: Guid.NewGuid(),
            PreviousSchoolName: "Previous School",
            PreviousSchoolPercentage: 88.5m
        );

        var result = validator.Validate(request);
        if (shouldBeValid)
        {
            result.Errors.Should().NotContain(e => e.PropertyName == "BloodGroup");
        }
        else
        {
            result.Errors.Should().Contain(e => e.PropertyName == "BloodGroup");
        }
    }

    [Fact]
    public async Task Change2_FileStorageService_RejectsFilesOver2MB_AndNonPdf()
    {
        var optionsMock = Options.Create(new SupabaseOptions());
        var httpClientFactoryMock = new Mock<IHttpClientFactory>();
        var configMock = new Mock<IConfiguration>();
        var loggerMock = new Mock<ILogger<FileStorageService>>();

        var service = new FileStorageService(optionsMock, httpClientFactoryMock.Object, configMock.Object, loggerMock.Object);

        // 1. Rejects non-PDF
        using var smallStream = new MemoryStream(new byte[100]);
        var nonPdfAct = async () => await service.SaveFileAsync(smallStream, "doc.png", "admissions");
        await nonPdfAct.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Only PDF documents (.pdf) are accepted*");

        // 2. Rejects PDF > 2 MB (2 * 1024 * 1024 = 2,097,152 bytes)
        var oversizedBytes = new byte[2 * 1024 * 1024 + 1];
        using var oversizedStream = new MemoryStream(oversizedBytes);
        var oversizedAct = async () => await service.SaveFileAsync(oversizedStream, "marksheet.pdf", "admissions");
        await oversizedAct.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*File size exceeds the 2 MB limit*");
    }

    [Fact]
    public async Task Change2_AdmissionsApproval_RejectsWhenMandatoryDocumentsMissing()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var db = new ApplicationDbContext(dbOptions);

        var classRoom = new ClassRoom { Name = "Class 10", Section = "A" };
        db.Classes.Add(classRoom);

        var admission = new Admission
        {
            FirstName = "Aarav",
            LastName = "Patel",
            Email = "aarav@example.com",
            PhoneNumber = "9876543210",
            BloodGroup = "B+",
            DesiredClassRoomId = classRoom.Id,
            Status = AdmissionStatus.Submitted,
            GuardianName = "Pooja Patel",
            GuardianPhone = "9876543211",
            ReferenceNumber = "ADM-2026-TEST1"
        };
        db.Admissions.Add(admission);
        await db.SaveChangesAsync();

        var currentUserServiceMock = new Mock<ICurrentUserService>();
        currentUserServiceMock.Setup(s => s.Email).Returns("hod@institution.edu");

        var fileStorageMock = new Mock<IFileStorage>();
        var passwordHasherMock = new Mock<IPasswordHasher>();
        var notificationSenderMock = new Mock<INotificationSender>();
        var auditLogServiceMock = new Mock<IAuditLogService>();
        var sequenceGeneratorMock = new Mock<ISequenceGenerator>();

        var controller = new AdmissionsController(
            db,
            fileStorageMock.Object,
            passwordHasherMock.Object,
            notificationSenderMock.Object,
            auditLogServiceMock.Object,
            currentUserServiceMock.Object,
            sequenceGeneratorMock.Object);

        // Attempt approval without documents - must reject
        var result = await controller.UpdateStatus(admission.Id, new UpdateAdmissionStatusRequest(AdmissionStatus.Approved, "Approved"));
        result.Should().BeOfType<BadRequestObjectResult>();

        var badRequest = (BadRequestObjectResult)result;
        var json = JsonSerializer.Serialize(badRequest.Value);
        json.Should().Contain("required documents (Birth Certificate / Identity Proof and Previous School Marksheet) are missing");
    }

    [Fact]
    public async Task Change2_AdmissionsApproval_Succeeds_AndCopiesBloodGroup_WhenDocumentsPresent()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var db = new ApplicationDbContext(dbOptions);

        var classRoom = new ClassRoom { Name = "Class 10", Section = "A" };
        db.Classes.Add(classRoom);

        var admission = new Admission
        {
            FirstName = "Aarav",
            LastName = "Patel",
            Email = "aarav@example.com",
            PhoneNumber = "9876543210",
            BloodGroup = "B+",
            DesiredClassRoomId = classRoom.Id,
            Status = AdmissionStatus.Submitted,
            GuardianName = "Pooja Patel",
            GuardianPhone = "9876543211",
            ReferenceNumber = "ADM-2026-TEST2"
        };

        // Attach mandatory documents
        admission.Documents.Add(new AdmissionDocument
        {
            AdmissionId = admission.Id,
            DocumentType = "BirthCertificate",
            FileName = "birth_certificate.pdf",
            FilePath = "admissions/birth.pdf",
            FileSize = 50000,
            ContentType = "application/pdf"
        });
        admission.Documents.Add(new AdmissionDocument
        {
            AdmissionId = admission.Id,
            DocumentType = "PreviousMarksheet",
            FileName = "marksheet.pdf",
            FilePath = "admissions/marksheet.pdf",
            FileSize = 60000,
            ContentType = "application/pdf"
        });

        db.Admissions.Add(admission);
        var roleStudent = new Role { Name = "Student" };
        db.Roles.Add(roleStudent);
        await db.SaveChangesAsync();

        var currentUserServiceMock = new Mock<ICurrentUserService>();
        currentUserServiceMock.Setup(s => s.Email).Returns("hod@institution.edu");

        var fileStorageMock = new Mock<IFileStorage>();
        var passwordHasherMock = new Mock<IPasswordHasher>();
        passwordHasherMock.Setup(p => p.HashPassword(It.IsAny<string>())).Returns("hashed_pass");
        var notificationSenderMock = new Mock<INotificationSender>();
        var auditLogServiceMock = new Mock<IAuditLogService>();
        var sequenceGeneratorMock = new Mock<ISequenceGenerator>();
        sequenceGeneratorMock.Setup(s => s.NextStudentRegistrationNumberAsync(It.IsAny<CancellationToken>())).ReturnsAsync("STU-2026-999");

        var controller = new AdmissionsController(
            db,
            fileStorageMock.Object,
            passwordHasherMock.Object,
            notificationSenderMock.Object,
            auditLogServiceMock.Object,
            currentUserServiceMock.Object,
            sequenceGeneratorMock.Object);

        var approvedResult = await controller.UpdateStatus(admission.Id, new UpdateAdmissionStatusRequest(AdmissionStatus.Approved, "Approved"));
        approvedResult.Should().BeOfType<OkObjectResult>();

        // Verify blood group copied to created student
        var createdStudent = await db.Students.Include(s => s.User).FirstOrDefaultAsync(s => s.User.Email == admission.Email);
        createdStudent.Should().NotBeNull();
        createdStudent!.BloodGroup.Should().Be("B+");
    }

    // =========================================================================
    // CHANGE 4: Simple, Correct Error Messages - Sanitization & Status Mapping
    // =========================================================================
    [Fact]
    public async Task Change4_ExceptionHandlingMiddleware_Sanitizes500_AndNeverLeaksSqlOrInternalException()
    {
        var loggerMock = new Mock<ILogger<ExceptionHandlingMiddleware>>();
        var envMock = new Mock<IWebHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");

        RequestDelegate next = (ctx) =>
        {
            throw new Exception("SELECT * FROM sensitive_db WHERE password_hash = 'secret123'; at System.Data.Npgsql.Connection.Open()");
        };

        var middleware = new ExceptionHandlingMiddleware(next, loggerMock.Object, envMock.Object);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be((int)HttpStatusCode.InternalServerError);
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var responseBody = await reader.ReadToEndAsync();

        responseBody.Should().NotContain("SELECT");
        responseBody.Should().NotContain("password_hash");
        responseBody.Should().NotContain("Npgsql");
        responseBody.Should().Contain("Something went wrong on our end. Please try again in a moment. If the problem continues, contact support.");
        responseBody.Should().Contain("traceId");
    }

    [Fact]
    public async Task Change4_ExceptionHandlingMiddleware_MapsPostgresUniqueViolation23505_To409()
    {
        var loggerMock = new Mock<ILogger<ExceptionHandlingMiddleware>>();
        var envMock = new Mock<IWebHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");

        var innerPostgresException = new Exception("duplicate key value violates unique constraint 'ix_users_email' (23505)");
        var dbException = new DbUpdateException("An error occurred while saving the entity changes.", innerPostgresException);

        RequestDelegate next = (ctx) => throw dbException;

        var middleware = new ExceptionHandlingMiddleware(next, loggerMock.Object, envMock.Object);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be((int)HttpStatusCode.Conflict);
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var responseBody = await reader.ReadToEndAsync();

        responseBody.Should().NotContain("23505");
        responseBody.Should().NotContain("ix_users_email");
        responseBody.Should().Contain("A record with this information already exists.");
    }

    [Fact]
    public async Task Change4_ExceptionHandlingMiddleware_MapsPostgresForeignKeyViolation23503_To409()
    {
        var loggerMock = new Mock<ILogger<ExceptionHandlingMiddleware>>();
        var envMock = new Mock<IWebHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");

        var innerPostgresException = new Exception("update or delete on table 'classes' violates foreign key constraint 'fk_students_classes' (23503)");
        var dbException = new DbUpdateException("An error occurred while saving the entity changes.", innerPostgresException);

        RequestDelegate next = (ctx) => throw dbException;

        var middleware = new ExceptionHandlingMiddleware(next, loggerMock.Object, envMock.Object);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be((int)HttpStatusCode.Conflict);
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var responseBody = await reader.ReadToEndAsync();

        responseBody.Should().NotContain("23503");
        responseBody.Should().NotContain("fk_students_classes");
        responseBody.Should().Contain("This item cannot be deleted because it is being used by other records.");
    }

    // =========================================================================
    // CHANGE 5: Timetable - Several periods on same day & proper clash check
    // =========================================================================
    [Fact]
    public async Task Change5_Timetable_AllowsTeacherMultiplePeriods_AndBackToBackPeriods()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var db = new ApplicationDbContext(dbOptions);

        var academicYear = new AcademicYear { Name = "2026-2027", StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow.AddYears(1) };
        var classRoomA = new ClassRoom { Name = "Grade 10", Section = "A", AcademicYear = academicYear };
        var subjectMath = new Subject { Name = "Mathematics", Code = "MATH10" };
        var subjectScience = new Subject { Name = "Science", Code = "SCI10" };

        var userTeacher = new User { FirstName = "Sunita", LastName = "Deshmukh", Email = "sunita@institution.edu" };
        var teacher = new Teacher { User = userTeacher, EmployeeCode = "TCH-001" };

        db.AcademicYears.Add(academicYear);
        db.Classes.Add(classRoomA);
        db.Subjects.AddRange(subjectMath, subjectScience);
        db.Users.Add(userTeacher);
        db.Teachers.Add(teacher);
        db.ClassSubjects.Add(new ClassSubject { ClassRoom = classRoomA, Subject = subjectMath });
        db.ClassSubjects.Add(new ClassSubject { ClassRoom = classRoomA, Subject = subjectScience });

        await db.SaveChangesAsync();

        var auditMock = new Mock<IAuditLogService>();
        var currentUserServiceMock = new Mock<ICurrentUserService>();
        currentUserServiceMock.Setup(c => c.UserId).Returns(userTeacher.Id);

        var controller = new TimetableController(db, auditMock.Object, currentUserServiceMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.Role, "HOD")
                }, "mock"))
            }
        };

        // 1. Schedule Period 1: 10:15 - 11:15 on Monday
        var period1Request = new CreateTimetableEntryRequest(
            ClassRoomId: classRoomA.Id,
            SubjectId: subjectMath.Id,
            TeacherId: teacher.Id,
            DayOfWeek: DayOfWeek.Monday,
            PeriodNumber: 1,
            StartTime: "10:15",
            EndTime: "11:15",
            RoomNumber: "Room 101"
        );
        var result1 = await controller.Create(period1Request);
        result1.Result.Should().BeOfType<OkObjectResult>();

        // 2. Schedule Period 2: 11:15 - 12:15 on Monday - Back to back!
        // Adjacent periods: start (11:15) == existing.EndTime (11:15), strict inequality start < existing.EndTime is false -> NO CLASH
        var period2Request = new CreateTimetableEntryRequest(
            ClassRoomId: classRoomA.Id,
            SubjectId: subjectScience.Id,
            TeacherId: teacher.Id,
            DayOfWeek: DayOfWeek.Monday,
            PeriodNumber: 2,
            StartTime: "11:15",
            EndTime: "12:15",
            RoomNumber: "Room 101"
        );
        var result2 = await controller.Create(period2Request);
        result2.Result.Should().BeOfType<OkObjectResult>();

        // 3. Schedule Period 4: 14:00 - 15:00 on Monday - Multiple periods on same day!
        var period4Request = new CreateTimetableEntryRequest(
            ClassRoomId: classRoomA.Id,
            SubjectId: subjectMath.Id,
            TeacherId: teacher.Id,
            DayOfWeek: DayOfWeek.Monday,
            PeriodNumber: 4,
            StartTime: "14:00",
            EndTime: "15:00",
            RoomNumber: "Room 101"
        );
        var result4 = await controller.Create(period4Request);
        result4.Result.Should().BeOfType<OkObjectResult>();

        var teacherEntries = await db.TimetableEntries.Where(t => t.TeacherId == teacher.Id && t.DayOfWeek == DayOfWeek.Monday).ToListAsync();
        teacherEntries.Should().HaveCount(3);
    }

    [Fact]
    public async Task Change5_Timetable_RejectsRealClash_WithExactMessage()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var db = new ApplicationDbContext(dbOptions);

        var academicYear = new AcademicYear { Name = "2026-2027", StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow.AddYears(1) };
        var classRoomA = new ClassRoom { Name = "Grade 10", Section = "A", AcademicYear = academicYear };
        var classRoomB = new ClassRoom { Name = "Grade 9", Section = "B", AcademicYear = academicYear };
        var subjectMath = new Subject { Name = "Mathematics", Code = "MATH10" };

        var userTeacher = new User { FirstName = "Sunita", LastName = "Deshmukh", Email = "sunita@institution.edu" };
        var teacher = new Teacher { User = userTeacher, EmployeeCode = "TCH-001" };

        db.AcademicYears.Add(academicYear);
        db.Classes.AddRange(classRoomA, classRoomB);
        db.Subjects.Add(subjectMath);
        db.Users.Add(userTeacher);
        db.Teachers.Add(teacher);
        db.ClassSubjects.Add(new ClassSubject { ClassRoom = classRoomA, Subject = subjectMath });
        db.ClassSubjects.Add(new ClassSubject { ClassRoom = classRoomB, Subject = subjectMath });

        // Existing entry: Teacher Sunita is teaching Grade 10 - A in Period 1 on Monday
        db.TimetableEntries.Add(new TimetableEntry
        {
            ClassRoomId = classRoomA.Id,
            ClassRoom = classRoomA,
            SubjectId = subjectMath.Id,
            TeacherId = teacher.Id,
            Teacher = teacher,
            DayOfWeek = DayOfWeek.Monday,
            PeriodNumber = 1,
            StartTime = new TimeSpan(10, 15, 0),
            EndTime = new TimeSpan(11, 15, 0),
            RoomNumber = "Room 101"
        });

        await db.SaveChangesAsync();

        var auditMock = new Mock<IAuditLogService>();
        var currentUserServiceMock = new Mock<ICurrentUserService>();
        currentUserServiceMock.Setup(c => c.UserId).Returns(userTeacher.Id);

        var controller = new TimetableController(db, auditMock.Object, currentUserServiceMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.Role, "HOD")
                }, "mock"))
            }
        };

        // Attempt to schedule Teacher Sunita for Grade 9 - B in Period 1 on Monday (SAME PERIOD & TIME)
        var clashRequest = new CreateTimetableEntryRequest(
            ClassRoomId: classRoomB.Id,
            SubjectId: subjectMath.Id,
            TeacherId: teacher.Id,
            DayOfWeek: DayOfWeek.Monday,
            PeriodNumber: 1,
            StartTime: "10:15",
            EndTime: "11:15",
            RoomNumber: "Room 202"
        );

        var result = await controller.Create(clashRequest);
        result.Result.Should().BeOfType<BadRequestObjectResult>();

        var badRequest = (BadRequestObjectResult)result.Result!;
        var json = JsonSerializer.Serialize(badRequest.Value);

        // Required error format: "This teacher is already teaching {className} in period {periodNumber} at that time."
        json.Should().Contain("This teacher is already teaching Grade 10 - A in period 1 at that time.");
    }
}
