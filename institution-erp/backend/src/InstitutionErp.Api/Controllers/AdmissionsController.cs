using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
[Route("api/v1/[controller]")]
public class AdmissionsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IFileStorage _fileStorage;
    private readonly IPasswordHasher _passwordHasher;
    private readonly INotificationSender _notificationSender;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ISequenceGenerator _sequenceGenerator;

    public AdmissionsController(
        ApplicationDbContext db,
        IFileStorage fileStorage,
        IPasswordHasher passwordHasher,
        INotificationSender notificationSender,
        IAuditLogService auditLogService,
        ICurrentUserService currentUserService,
        ISequenceGenerator sequenceGenerator)
    {
        _db = db;
        _fileStorage = fileStorage;
        _passwordHasher = passwordHasher;
        _notificationSender = notificationSender;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
        _sequenceGenerator = sequenceGenerator;
    }

    [HttpPost("apply")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-limit")]
    public async Task<ActionResult<AdmissionDto>> Apply([FromBody] ApplyAdmissionRequest request)
    {
        var refNumber = await _sequenceGenerator.NextAdmissionReferenceNumberAsync();

        var admission = new Admission
        {
            ReferenceNumber = refNumber,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            PhoneNumber = request.PhoneNumber,
            DateOfBirth = DateTime.SpecifyKind(request.DateOfBirth, DateTimeKind.Utc),
            Gender = request.Gender,
            Address = request.Address,
            GuardianName = request.GuardianName,
            GuardianPhone = request.GuardianPhone,
            GuardianEmail = request.GuardianEmail,
            GuardianRelation = request.GuardianRelation,
            DesiredClassRoomId = request.DesiredClassRoomId,
            PreviousSchoolName = request.PreviousSchoolName,
            PreviousSchoolPercentage = request.PreviousSchoolPercentage,
            Status = AdmissionStatus.Submitted
        };

        admission.StatusHistory.Add(new AdmissionStatusHistory
        {
            FromStatus = AdmissionStatus.Submitted,
            ToStatus = AdmissionStatus.Submitted,
            Remarks = "Application submitted online.",
            ChangedBy = "Applicant"
        });

        _db.Admissions.Add(admission);
        await _db.SaveChangesAsync();

        // Queue notification to applicant
        await _notificationSender.QueueOutboxAsync(
            NotificationChannelType.Email,
            admission.Email,
            $"Admission Application Received - {refNumber}",
            $"<p>Dear {admission.FirstName},</p><p>Your application <strong>{refNumber}</strong> has been received and is currently under review.</p>"
        );

        return Ok(new AdmissionDto
        {
            Id = admission.Id,
            ReferenceNumber = admission.ReferenceNumber,
            FirstName = admission.FirstName,
            LastName = admission.LastName,
            FullName = admission.FullName,
            Email = admission.Email,
            PhoneNumber = admission.PhoneNumber,
            Status = admission.Status,
            CreatedAt = admission.CreatedAt
        });
    }

    [HttpGet("status/{referenceNumber}")]
    [AllowAnonymous]
    public async Task<ActionResult<AdmissionDto>> GetStatus(string referenceNumber)
    {
        var adm = await _db.Admissions
            .Include(a => a.DesiredClassRoom)
            .Include(a => a.StatusHistory)
            .FirstOrDefaultAsync(a => a.ReferenceNumber.ToUpper() == referenceNumber.ToUpper());

        if (adm == null) return NotFound(new { message = "Application reference number not found." });

        return Ok(new AdmissionDto
        {
            Id = adm.Id,
            ReferenceNumber = adm.ReferenceNumber,
            FirstName = adm.FirstName,
            LastName = adm.LastName,
            FullName = adm.FullName,
            Email = adm.Email,
            PhoneNumber = adm.PhoneNumber,
            DesiredClassName = adm.DesiredClassRoom?.FullName ?? "N/A",
            Status = adm.Status,
            ReviewRemarks = adm.ReviewRemarks,
            ReviewedAt = adm.ReviewedAt,
            CreatedAt = adm.CreatedAt,
            StatusHistory = adm.StatusHistory.Select(h => new AdmissionStatusHistoryDto
            {
                Id = h.Id,
                FromStatus = h.FromStatus,
                ToStatus = h.ToStatus,
                Remarks = h.Remarks,
                ChangedBy = h.ChangedBy,
                ChangedAt = h.ChangedAt
            }).ToList()
        });
    }

    [HttpPost("{id}/documents")]
    [Consumes("multipart/form-data")]
    [AllowAnonymous]
    public async Task<IActionResult> UploadDocument(Guid id, [FromForm] AdmissionDocumentUploadRequest request)
    {
        var admission = await _db.Admissions.FindAsync(id);
        if (admission == null) return NotFound("Admission application not found.");

        if (request.File == null || request.File.Length == 0) return BadRequest("File is empty.");

        var ext = Path.GetExtension(request.File.FileName).ToLowerInvariant();
        if (ext != ".pdf")
        {
            return BadRequest(new { message = "Only PDF documents (.pdf) are accepted." });
        }

        if (request.File.Length > 5 * 1024 * 1024)
        {
            return BadRequest(new { message = "File size must not exceed 5 MB." });
        }

        using var stream = request.File.OpenReadStream();
        var storagePath = await _fileStorage.SaveFileAsync(stream, request.File.FileName, "admissions");

        var doc = new AdmissionDocument
        {
            AdmissionId = id,
            DocumentType = request.DocumentType,
            FileName = request.File.FileName,
            FilePath = storagePath,
            FileSize = request.File.Length,
            ContentType = request.File.ContentType
        };

        _db.AdmissionDocuments.Add(doc);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Document uploaded successfully.", documentId = doc.Id, fileName = doc.FileName });
    }

    [HttpGet("{id}/documents/{documentId}")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> DownloadDocument(Guid id, Guid documentId)
    {
        var doc = await _db.AdmissionDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.AdmissionId == id);
        if (doc == null) return NotFound(new { message = "Document not found." });

        try
        {
            var stream = await _fileStorage.GetFileStreamAsync(doc.FilePath);
            return File(stream, doc.ContentType ?? "application/pdf", doc.FileName);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { message = "File not found on storage." });
        }
    }

    [HttpGet]
    [Authorize(Roles = "Principal")]
    public async Task<ActionResult<PagedResult<AdmissionDto>>> GetAdmissions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] AdmissionStatus? status = null,
        [FromQuery] Guid? classId = null)
    {
        var query = _db.Admissions
            .Include(a => a.DesiredClassRoom)
            .Include(a => a.Documents)
            .AsNoTracking();

        if (status.HasValue)
        {
            query = query.Where(a => a.Status == status.Value);
        }

        if (classId.HasValue)
        {
            query = query.Where(a => a.DesiredClassRoomId == classId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(a => a.FirstName.ToLower().Contains(s) ||
                                     a.LastName.ToLower().Contains(s) ||
                                     a.ReferenceNumber.ToLower().Contains(s) ||
                                     a.Email.ToLower().Contains(s));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AdmissionDto
            {
                Id = a.Id,
                ReferenceNumber = a.ReferenceNumber,
                FirstName = a.FirstName,
                LastName = a.LastName,
                FullName = a.FullName,
                Email = a.Email,
                PhoneNumber = a.PhoneNumber,
                DateOfBirth = a.DateOfBirth,
                Gender = a.Gender,
                Address = a.Address,
                GuardianName = a.GuardianName,
                GuardianPhone = a.GuardianPhone,
                GuardianEmail = a.GuardianEmail,
                GuardianRelation = a.GuardianRelation,
                DesiredClassRoomId = a.DesiredClassRoomId,
                DesiredClassName = a.DesiredClassRoom.FullName,
                PreviousSchoolName = a.PreviousSchoolName,
                PreviousSchoolPercentage = a.PreviousSchoolPercentage,
                Status = a.Status,
                ReviewRemarks = a.ReviewRemarks,
                ReviewedAt = a.ReviewedAt,
                ReviewedBy = a.ReviewedBy,
                CreatedAt = a.CreatedAt,
                CreatedStudentId = a.CreatedStudentId,
                Documents = a.Documents.Select(d => new AdmissionDocumentDto
                {
                    Id = d.Id,
                    DocumentType = d.DocumentType,
                    FileName = d.FileName,
                    FileSize = d.FileSize,
                    ContentType = d.ContentType,
                    DownloadUrl = $"/api/v1/admissions/documents/{d.Id}/download"
                }).ToList()
            })
            .ToListAsync();

        return Ok(PagedResult<AdmissionDto>.Create(items, total, page, pageSize));
    }

    [HttpGet("documents/{id}/download")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> DownloadDocument(Guid id)
    {
        var doc = await _db.AdmissionDocuments.FindAsync(id);
        if (doc == null) return NotFound();

        var stream = await _fileStorage.GetFileStreamAsync(doc.FilePath);
        return File(stream, doc.ContentType, doc.FileName);
    }

    [HttpGet("export")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> ExportToCsv([FromQuery] AdmissionStatus? status, [FromQuery] Guid? classId)
    {
        var query = _db.Admissions
            .Include(a => a.DesiredClassRoom)
            .AsNoTracking();

        if (status.HasValue) query = query.Where(a => a.Status == status.Value);
        if (classId.HasValue) query = query.Where(a => a.DesiredClassRoomId == classId.Value);

        var list = await query.ToListAsync();
        var sb = new StringBuilder();
        sb.AppendLine("ReferenceNumber,FirstName,LastName,Email,Phone,AppliedClass,GuardianName,GuardianPhone,Status,SubmissionDate");

        foreach (var a in list)
        {
            sb.AppendLine($"\"{a.ReferenceNumber}\",\"{a.FirstName}\",\"{a.LastName}\",\"{a.Email}\",\"{a.PhoneNumber}\",\"{a.DesiredClassRoom?.FullName}\",\"{a.GuardianName}\",\"{a.GuardianPhone}\",\"{a.Status}\",\"{a.CreatedAt:yyyy-MM-dd}\"");
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"admissions_export_{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateAdmissionStatusRequest request)
    {
        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            var admission = await _db.Admissions
                .Include(a => a.DesiredClassRoom)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (admission == null) return NotFound();

            var isRelational = _db.Database.IsRelational();
            await using var transaction = isRelational ? await _db.Database.BeginTransactionAsync() : null;
            try
        {
            var oldStatus = admission.Status;
            admission.Status = request.NewStatus;
            admission.ReviewRemarks = request.Remarks;
            admission.ReviewedAt = DateTime.UtcNow;
            admission.ReviewedBy = _currentUserService.Email ?? "Principal";

            _db.AdmissionStatusHistories.Add(new AdmissionStatusHistory
            {
                AdmissionId = admission.Id,
                FromStatus = oldStatus,
                ToStatus = request.NewStatus,
                Remarks = request.Remarks,
                ChangedBy = admission.ReviewedBy
            });

            string? generatedPassword = null;
            string? enrolledRegNo = null;
            Guid? createdUserId = null;

            // 1. If Rejected or Waitlisted: revoke student access, remove from class roster & portal
            if (request.NewStatus == AdmissionStatus.Rejected || request.NewStatus == AdmissionStatus.Waitlisted)
            {
                if (admission.CreatedStudentId.HasValue)
                {
                    var student = await _db.Students
                        .IgnoreQueryFilters()
                        .Include(s => s.User)
                        .FirstOrDefaultAsync(s => s.Id == admission.CreatedStudentId.Value);

                    if (student != null)
                    {
                        student.Status = StudentStatus.Inactive;
                        student.IsDeleted = true; // Soft-delete so EF Core filters automatically exclude from class & directory

                        if (student.User != null)
                        {
                            student.User.IsActive = false;
                            student.User.IsDeleted = true;

                            // Revoke any active refresh tokens
                            var refreshTokens = await _db.RefreshTokens
                                .Where(rt => rt.UserId == student.UserId)
                                .ToListAsync();
                            foreach (var rt in refreshTokens)
                            {
                                rt.IsRevoked = true;
                            }
                        }

                        // Soft-delete any pending fees
                        var pendingFees = await _db.StudentFees
                            .Where(sf => sf.StudentId == student.Id && sf.Status == PaymentStatus.Pending)
                            .ToListAsync();
                        foreach (var pf in pendingFees)
                        {
                            pf.IsDeleted = true;
                        }
                    }
                }
            }
            // 2. If Approved: restore existing student or create new student account & fees
            else if (request.NewStatus == AdmissionStatus.Approved)
            {
                if (admission.CreatedStudentId.HasValue)
                {
                    var existingStudent = await _db.Students
                        .IgnoreQueryFilters()
                        .Include(s => s.User)
                        .FirstOrDefaultAsync(s => s.Id == admission.CreatedStudentId.Value);

                    if (existingStudent != null)
                    {
                        // Restore previously created student
                        existingStudent.Status = StudentStatus.Active;
                        existingStudent.IsDeleted = false;
                        existingStudent.ClassRoomId = admission.DesiredClassRoomId;
                        enrolledRegNo = existingStudent.StudentRegistrationNumber;

                        var newStudentPass = PasswordGenerator.Generate(14);
                        generatedPassword = newStudentPass;

                        if (existingStudent.User != null)
                        {
                            existingStudent.User.IsActive = true;
                            existingStudent.User.IsDeleted = false;
                            existingStudent.User.MustChangePassword = true;
                            existingStudent.User.PasswordHash = _passwordHasher.HashPassword(newStudentPass);
                            existingStudent.User.LockoutEnd = null;
                            existingStudent.User.AccessFailedCount = 0;
                            createdUserId = existingStudent.UserId;
                        }

                        // Restore fees or re-assign
                        var restoredFees = await _db.StudentFees
                            .IgnoreQueryFilters()
                            .Where(sf => sf.StudentId == existingStudent.Id)
                            .ToListAsync();

                        if (restoredFees.Count > 0)
                        {
                            foreach (var rf in restoredFees)
                            {
                                rf.IsDeleted = false;
                            }
                        }
                        else
                        {
                            var feeStructures = await _db.FeeStructures
                                .Include(f => f.Items)
                                .Where(f => f.ClassRoomId == admission.DesiredClassRoomId)
                                .ToListAsync();

                            foreach (var fs in feeStructures)
                            {
                                foreach (var item in fs.Items)
                                {
                                    _db.StudentFees.Add(new StudentFee
                                    {
                                        StudentId = existingStudent.Id,
                                        FeeStructureItemId = item.Id,
                                        BaseAmount = item.Amount,
                                        DueDate = DateTime.SpecifyKind(item.DueDate, DateTimeKind.Utc),
                                        PaidAmount = 0,
                                        Status = PaymentStatus.Pending
                                    });
                                }
                            }
                        }

                        // Send email notification without plaintext password
                        try
                        {
                            var className = admission.DesiredClassRoom?.FullName ?? "Enrolled Class";
                            var emailBody = $@"
                                <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;"">
                                    <div style=""background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; color: #ffffff;"">
                                        <h1 style=""margin: 0; font-size: 22px; font-weight: bold;"">CampusCore Institution ERP</h1>
                                        <p style=""margin: 6px 0 0; font-size: 14px; opacity: 0.9;"">Admission Approved & Enrollment Confirmed</p>
                                    </div>
                                    <div style=""background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;"">
                                        <p style=""font-size: 15px;"">Dear <strong>{admission.FirstName} {admission.LastName}</strong>,</p>
                                        <p>Congratulations! Your admission application (<strong>{admission.ReferenceNumber}</strong>) has been formally approved and you have been officially enrolled into <strong>{className}</strong>.</p>
                                        <p>Your student ID is <strong>{existingStudent.StudentRegistrationNumber}</strong>. Your temporary login password has been issued directly to the administrator on a secure credential slip. Please contact your administrator to receive your one-time temporary password, then sign in and change your password.</p>
                                        <div style=""text-align: center; margin: 28px 0;"">
                                            <a href=""/login"" style=""background: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;"">Sign In to Student Portal</a>
                                        </div>
                                    </div>
                                </div>";

                            await _notificationSender.QueueOutboxAsync(
                                NotificationChannelType.Email,
                                admission.Email,
                                $"Admission Approved & Enrolled - Your Student Portal Account ({existingStudent.StudentRegistrationNumber})",
                                emailBody
                            );
                        }
                        catch
                        {
                            // Silently ignore notification failure so transaction completes successfully
                        }
                    }
                    else
                    {
                        admission.CreatedStudentId = null;
                    }
                }

                if (admission.CreatedStudentId == null)
                {
                    var regNo = await _sequenceGenerator.NextStudentRegistrationNumberAsync();
                    enrolledRegNo = regNo;

                    // Determine next roll number in target classroom
                    var existingRolls = await _db.Students
                        .IgnoreQueryFilters()
                        .Where(s => s.ClassRoomId == admission.DesiredClassRoomId)
                        .Select(s => s.RollNumber)
                        .ToListAsync();

                    int maxRoll = 100;
                    foreach (var r in existingRolls)
                    {
                        if (int.TryParse(r, out var rNum) && rNum > maxRoll)
                        {
                            maxRoll = rNum;
                        }
                    }
                    var rollNo = (maxRoll + 1).ToString();

                    var newStudentPass = PasswordGenerator.GenerateStudentPassword(admission.FirstName);
                    generatedPassword = newStudentPass;

                    // 1. Student User account (find existing or create new to prevent duplicate email constraint violations)
                    var studentRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == UserRoleType.Student.ToString());
                    var sUser = await _db.Users
                        .IgnoreQueryFilters()
                        .Include(u => u.UserRoles)
                        .FirstOrDefaultAsync(u => u.Email.ToLower() == admission.Email.ToLower());

                    if (sUser == null)
                    {
                        sUser = new User
                        {
                            Email = admission.Email,
                            FirstName = admission.FirstName,
                            LastName = admission.LastName,
                            PhoneNumber = admission.PhoneNumber,
                            PasswordHash = _passwordHasher.HashPassword(newStudentPass),
                            DefaultPassword = newStudentPass,
                            MustChangePassword = true,
                            IsActive = true
                        };
                        if (studentRole != null)
                        {
                            sUser.UserRoles.Add(new UserRole { RoleId = studentRole.Id });
                        }
                        _db.Users.Add(sUser);
                        await _db.SaveChangesAsync();
                    }
                    else
                    {
                        sUser.IsActive = true;
                        sUser.IsDeleted = false;
                        sUser.FirstName = admission.FirstName;
                        sUser.LastName = admission.LastName;
                        sUser.MustChangePassword = true;
                        sUser.PasswordHash = _passwordHasher.HashPassword(newStudentPass);
                        sUser.DefaultPassword = newStudentPass;
                        sUser.LockoutEnd = null;
                        sUser.AccessFailedCount = 0;
                        if (!string.IsNullOrWhiteSpace(admission.PhoneNumber))
                        {
                            sUser.PhoneNumber = admission.PhoneNumber;
                        }
                        if (studentRole != null && !sUser.UserRoles.Any(ur => ur.RoleId == studentRole.Id))
                        {
                            sUser.UserRoles.Add(new UserRole { RoleId = studentRole.Id });
                        }
                        await _db.SaveChangesAsync();
                    }

                    createdUserId = sUser.Id;

                    // 2. Student record
                    var student = new Student
                    {
                        UserId = sUser.Id,
                        StudentRegistrationNumber = regNo,
                        RollNumber = rollNo,
                        DateOfBirth = DateTime.SpecifyKind(admission.DateOfBirth, DateTimeKind.Utc),
                        Gender = admission.Gender,
                        BloodGroup = "O+",
                        Address = admission.Address,
                        ClassRoomId = admission.DesiredClassRoomId,
                        AdmissionDate = DateTime.UtcNow,
                        Status = StudentStatus.Active,
                        GuardianName = admission.GuardianName,
                        GuardianPhone = admission.GuardianPhone,
                        GuardianEmail = admission.GuardianEmail,
                        GuardianRelation = string.IsNullOrWhiteSpace(admission.GuardianRelation) ? "Parent" : admission.GuardianRelation
                    };
                    _db.Students.Add(student);
                    await _db.SaveChangesAsync();

                    admission.CreatedStudentId = student.Id;

                    // 3. Auto-assign class fees
                    var feeStructures = await _db.FeeStructures
                        .Include(f => f.Items)
                        .Where(f => f.ClassRoomId == admission.DesiredClassRoomId)
                        .ToListAsync();

                    foreach (var fs in feeStructures)
                    {
                        foreach (var item in fs.Items)
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

                    // 4. Send credentials notification to student (fault-tolerant)
                    try
                    {
                        var className = admission.DesiredClassRoom?.FullName ?? "Enrolled Class";
                        var emailBody = $@"
                            <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;"">
                                <div style=""background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; color: #ffffff;"">
                                    <h1 style=""margin: 0; font-size: 22px; font-weight: bold;"">CampusCore Institution ERP</h1>
                                    <p style=""margin: 6px 0 0; font-size: 14px; opacity: 0.9;"">Admission Approved & Enrollment Confirmed</p>
                                </div>
                                <div style=""background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;"">
                                    <p style=""font-size: 15px;"">Dear <strong>{admission.FirstName} {admission.LastName}</strong>,</p>
                                    <p>Congratulations! Your admission application (<strong>{admission.ReferenceNumber}</strong>) has been formally approved and you have been officially enrolled into <strong>{className}</strong>.</p>
                                    <p>Your student ID is <strong>{regNo}</strong>. Your temporary login password has been issued directly to the administrator on a secure credential slip. Please contact your administrator to receive your one-time temporary password, then sign in and change your password.</p>
                                    <div style=""text-align: center; margin: 28px 0;"">
                                        <a href=""/login"" style=""background: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;"">Sign In to Student Portal</a>
                                    </div>
                                </div>
                            </div>";

                        await _notificationSender.QueueOutboxAsync(
                            NotificationChannelType.Email,
                            admission.Email,
                            $"Admission Approved & Enrolled - Your Student Portal Account ({regNo})",
                            emailBody
                        );
                    }
                    catch
                    {
                        // Silently ignore notification failure so transaction completes successfully
                    }
                }
            }

            await _db.SaveChangesAsync();
            await _auditLogService.LogAsync("UpdateAdmissionStatus", "Admission", admission.Id.ToString(), new { oldStatus }, new { newStatus = request.NewStatus });

            if (transaction != null)
            {
                await transaction.CommitAsync();
            }

            CredentialSlipDto? credentialSlip = null;
            if (generatedPassword != null && createdUserId.HasValue)
            {
                credentialSlip = new CredentialSlipDto
                {
                    UserId = createdUserId.Value,
                    Email = admission.Email,
                    FullName = $"{admission.FirstName} {admission.LastName}",
                    Role = "Student",
                    TemporaryPassword = generatedPassword,
                    MustChangePassword = true,
                    Identifier = enrolledRegNo,
                    GeneratedAtUtc = DateTime.UtcNow
                };
            }

            return Ok(new
            {
                message = $"Admission status transitioned to {request.NewStatus}.",
                generatedPassword,
                credentialSlip,
                email = admission.Email,
                studentRegistrationNumber = enrolledRegNo
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


    [HttpDelete("{id}")]
    [Authorize(Roles = "Principal")]
    public async Task<IActionResult> DeleteAdmission(Guid id)
    {
        var admission = await _db.Admissions
            .Include(a => a.Documents)
            .Include(a => a.StatusHistory)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (admission == null) return NotFound(new { message = "Admission application not found." });

        // Delete associated uploaded physical files
        foreach (var doc in admission.Documents)
        {
            if (!string.IsNullOrEmpty(doc.FilePath))
            {
                try
                {
                    await _fileStorage.DeleteFileAsync(doc.FilePath);
                }
                catch
                {
                    // Continue cleanup even if physical file is missing
                }
            }
        }

        var refNumber = admission.ReferenceNumber;
        var fullName = admission.FullName;

        _db.AdmissionDocuments.RemoveRange(admission.Documents);
        _db.AdmissionStatusHistories.RemoveRange(admission.StatusHistory);
        _db.Admissions.Remove(admission);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync(
            "DeleteAdmission",
            "Admission",
            id.ToString(),
            new { ReferenceNumber = refNumber, FullName = fullName, admission.Email, admission.Status },
            null
        );

        return Ok(new { message = $"Admission application {refNumber} ({fullName}) deleted successfully." });
    }
}

public class AdmissionDocumentUploadRequest
{
    public IFormFile File { get; set; } = null!;
    public string DocumentType { get; set; } = string.Empty;
}
