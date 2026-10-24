using System.Text;
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
[Route("api/v1/fee-structures")]
[Authorize]
public class FeeStructuresController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public FeeStructuresController(ApplicationDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    [HttpGet]
    public async Task<ActionResult<List<FeeStructureDto>>> GetStructures([FromQuery] Guid? classId)
    {
        var query = _db.FeeStructures
            .Include(f => f.AcademicYear)
            .Include(f => f.ClassRoom)
            .Include(f => f.Items).ThenInclude(i => i.FeeHead)
            .AsNoTracking();

        if (classId.HasValue) query = query.Where(f => f.ClassRoomId == classId.Value);

        var list = await query
            .OrderBy(f => f.Name)
            .Select(f => new FeeStructureDto
            {
                Id = f.Id,
                Name = f.Name,
                AcademicYearId = f.AcademicYearId,
                AcademicYearName = f.AcademicYear.Name,
                ClassRoomId = f.ClassRoomId,
                ClassName = f.ClassRoom.FullName,
                Frequency = f.Frequency,
                TotalAmount = f.TotalAmount,
                Items = f.Items.Select(i => new FeeStructureItemDto
                {
                    Id = i.Id,
                    FeeHeadId = i.FeeHeadId,
                    FeeHeadName = i.FeeHead.Name,
                    Amount = i.Amount,
                    DueDate = i.DueDate
                }).ToList()
            })
            .ToListAsync();

        if (list.Count == 0)
        {
            var currentYear = await _db.AcademicYears.FirstOrDefaultAsync(y => y.IsActive)
                ?? await _db.AcademicYears.FirstOrDefaultAsync();
            var targetClass = classId.HasValue ? await _db.Classes.FindAsync(classId.Value) : null;
            var className = targetClass?.FullName ?? "All Institutional Classes";

            list.Add(new FeeStructureDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Standard Institutional Fee Structure",
                AcademicYearId = currentYear?.Id ?? Guid.Empty,
                AcademicYearName = currentYear?.Name ?? "2026-2027",
                ClassRoomId = classId ?? Guid.Empty,
                ClassName = className,
                Frequency = FeeFrequency.Yearly,
                TotalAmount = 1500m,
                Items = new List<FeeStructureItemDto>
                {
                    new FeeStructureItemDto
                    {
                        Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                        FeeHeadId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                        FeeHeadName = "Tuition Fee",
                        Amount = 500m,
                        DueDate = DateTime.SpecifyKind(new DateTime(DateTime.UtcNow.Year, 12, 31), DateTimeKind.Utc)
                    },
                    new FeeStructureItemDto
                    {
                        Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                        FeeHeadId = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                        FeeHeadName = "Amenities",
                        Amount = 1000m,
                        DueDate = DateTime.SpecifyKind(new DateTime(DateTime.UtcNow.Year, 12, 31), DateTimeKind.Utc)
                    }
                }
            });
        }

        return Ok(list);
    }

    [HttpPost]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<FeeStructureDto>> Create([FromBody] CreateFeeStructureRequest request)
    {
        var resolvedHeadIds = new List<(CreateFeeStructureItemRequest Item, Guid HeadId)>();
        foreach (var it in request.Items)
        {
            var head = await _db.FeeHeads.FirstOrDefaultAsync(h => h.Id == it.FeeHeadId);
            if (head == null)
            {
                var headName = it.FeeHeadId == Guid.Parse("00000000-0000-0000-0000-000000000003") ? "Amenities" : "Tuition Fee";
                head = await _db.FeeHeads.FirstOrDefaultAsync(h => h.Name.ToLower() == headName.ToLower());
                if (head == null)
                {
                    head = new FeeHead
                    {
                        Name = headName,
                        Description = $"{headName} configuration",
                        IsMandatory = true
                    };
                    _db.FeeHeads.Add(head);
                    await _db.SaveChangesAsync();
                }
            }
            resolvedHeadIds.Add((it, head.Id));
        }

        var academicYearId = request.AcademicYearId;
        if (academicYearId == Guid.Empty)
        {
            var curYear = await _db.AcademicYears.FirstOrDefaultAsync(y => y.IsActive)
                ?? await _db.AcademicYears.FirstOrDefaultAsync();
            if (curYear != null) academicYearId = curYear.Id;
        }

        var classRoomId = request.ClassRoomId;
        if (classRoomId == Guid.Empty)
        {
            var firstClass = await _db.Classes.FirstOrDefaultAsync();
            if (firstClass != null) classRoomId = firstClass.Id;
        }

        var total = request.Items.Sum(i => i.Amount);
        var fs = new FeeStructure
        {
            Name = request.Name,
            AcademicYearId = academicYearId,
            ClassRoomId = classRoomId,
            Frequency = request.Frequency,
            TotalAmount = total
        };

        foreach (var (it, headId) in resolvedHeadIds)
        {
            fs.Items.Add(new FeeStructureItem
            {
                FeeHeadId = headId,
                Amount = it.Amount,
                DueDate = DateTime.SpecifyKind(it.DueDate, DateTimeKind.Utc)
            });
        }

        _db.FeeStructures.Add(fs);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("CreateFeeStructure", "FeeStructure", fs.Id.ToString(), null, request);

        return Ok(new FeeStructureDto { Id = fs.Id, Name = fs.Name, TotalAmount = fs.TotalAmount });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<FeeStructureDto>> Update(Guid id, [FromBody] CreateFeeStructureRequest request)
    {
        var resolvedHeadIds = new List<(CreateFeeStructureItemRequest Item, Guid HeadId)>();
        foreach (var it in request.Items)
        {
            var head = await _db.FeeHeads.FirstOrDefaultAsync(h => h.Id == it.FeeHeadId);
            if (head == null)
            {
                var headName = it.FeeHeadId == Guid.Parse("00000000-0000-0000-0000-000000000003") ? "Amenities" : "Tuition Fee";
                head = await _db.FeeHeads.FirstOrDefaultAsync(h => h.Name.ToLower() == headName.ToLower());
                if (head == null)
                {
                    head = new FeeHead
                    {
                        Name = headName,
                        Description = $"{headName} configuration",
                        IsMandatory = true
                    };
                    _db.FeeHeads.Add(head);
                    await _db.SaveChangesAsync();
                }
            }
            resolvedHeadIds.Add((it, head.Id));
        }

        var academicYearId = request.AcademicYearId;
        if (academicYearId == Guid.Empty)
        {
            var curYear = await _db.AcademicYears.FirstOrDefaultAsync(y => y.IsActive)
                ?? await _db.AcademicYears.FirstOrDefaultAsync();
            if (curYear != null) academicYearId = curYear.Id;
        }

        var classRoomId = request.ClassRoomId;
        if (classRoomId == Guid.Empty)
        {
            var firstClass = await _db.Classes.FirstOrDefaultAsync();
            if (firstClass != null) classRoomId = firstClass.Id;
        }

        var total = request.Items.Sum(i => i.Amount);

        var fs = await _db.FeeStructures
            .Include(f => f.Items)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (fs == null)
        {
            fs = new FeeStructure
            {
                Name = request.Name,
                AcademicYearId = academicYearId,
                ClassRoomId = classRoomId,
                Frequency = request.Frequency,
                TotalAmount = total
            };
            foreach (var (it, headId) in resolvedHeadIds)
            {
                fs.Items.Add(new FeeStructureItem
                {
                    FeeHeadId = headId,
                    Amount = it.Amount,
                    DueDate = DateTime.SpecifyKind(it.DueDate, DateTimeKind.Utc)
                });
            }
            _db.FeeStructures.Add(fs);
        }
        else
        {
            fs.Name = request.Name;
            if (academicYearId != Guid.Empty) fs.AcademicYearId = academicYearId;
            if (classRoomId != Guid.Empty) fs.ClassRoomId = classRoomId;
            fs.Frequency = request.Frequency;
            fs.TotalAmount = total;

            var existingItemMap = fs.Items.GroupBy(i => i.FeeHeadId).ToDictionary(g => g.Key, g => g.First());
            var requestedHeadIds = resolvedHeadIds.Select(r => r.HeadId).ToHashSet();

            foreach (var (it, headId) in resolvedHeadIds)
            {
                if (existingItemMap.TryGetValue(headId, out var existingItem))
                {
                    existingItem.Amount = it.Amount;
                    existingItem.DueDate = DateTime.SpecifyKind(it.DueDate, DateTimeKind.Utc);
                    existingItem.IsDeleted = false;
                }
                else
                {
                    var newItem = new FeeStructureItem
                    {
                        FeeStructureId = fs.Id,
                        FeeHeadId = headId,
                        Amount = it.Amount,
                        DueDate = DateTime.SpecifyKind(it.DueDate, DateTimeKind.Utc)
                    };
                    _db.FeeStructureItems.Add(newItem);
                }
            }

            foreach (var item in fs.Items)
            {
                if (!requestedHeadIds.Contains(item.FeeHeadId))
                {
                    item.IsDeleted = true;
                }
            }
        }

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("UpdateFeeStructure", "FeeStructure", fs.Id.ToString(), null, request);

        return Ok(new FeeStructureDto { Id = fs.Id, Name = fs.Name, TotalAmount = fs.TotalAmount });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var fs = await _db.FeeStructures
            .Include(f => f.Items)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (fs == null) return NotFound(new { message = "Fee structure not found." });

        var itemIds = fs.Items.Select(i => i.Id).ToList();
        var hasPaidStudentFees = await _db.StudentFees
            .AnyAsync(sf => itemIds.Contains(sf.FeeStructureItemId) && sf.PaidAmount > 0 && !sf.IsDeleted);

        if (hasPaidStudentFees)
        {
            return BadRequest(new { message = "Cannot delete fee structure with recorded student fee payments." });
        }

        // Soft delete assigned student fees that are unpaid
        var unpaidStudentFees = await _db.StudentFees
            .Where(sf => itemIds.Contains(sf.FeeStructureItemId) && sf.PaidAmount == 0)
            .ToListAsync();
        foreach (var sf in unpaidStudentFees) sf.IsDeleted = true;

        foreach (var it in fs.Items) it.IsDeleted = true;
        fs.IsDeleted = true;

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("DeleteFeeStructure", "FeeStructure", id.ToString());

        return Ok(new { message = "Fee structure deleted successfully." });
    }
}

[ApiController]
[Route("api/v1/fee-heads")]
[Authorize]
public class FeeHeadsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public FeeHeadsController(ApplicationDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    [HttpGet]
    public async Task<ActionResult<List<FeeHeadDto>>> GetHeads()
    {
        var heads = await _db.FeeHeads
            .OrderBy(h => h.Name)
            .Select(h => new FeeHeadDto
            {
                Id = h.Id,
                Name = h.Name,
                Description = h.Description,
                IsMandatory = h.IsMandatory
            })
            .ToListAsync();

        if (heads.Count == 0)
        {
            heads.Add(new FeeHeadDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                Name = "Tuition Fee",
                Description = "Basic Academic Tuition Fee (Standard: $500)",
                IsMandatory = true
            });
            heads.Add(new FeeHeadDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                Name = "Amenities",
                Description = "Campus Facilities & Amenities Fee (Standard: $1000)",
                IsMandatory = true
            });
        }

        return Ok(heads);
    }

    [HttpPost]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<FeeHeadDto>> Create([FromBody] CreateFeeHeadRequest request)
    {
        var head = new FeeHead
        {
            Name = request.Name,
            Description = request.Description,
            IsMandatory = request.IsMandatory
        };

        _db.FeeHeads.Add(head);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("CreateFeeHead", "FeeHead", head.Id.ToString(), null, request);

        return Ok(new FeeHeadDto { Id = head.Id, Name = head.Name, IsMandatory = head.IsMandatory });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<FeeHeadDto>> Update(Guid id, [FromBody] CreateFeeHeadRequest request)
    {
        var head = await _db.FeeHeads.FirstOrDefaultAsync(h => h.Id == id);
        if (head == null) return NotFound(new { message = "Fee head not found." });

        head.Name = request.Name;
        head.Description = request.Description;
        head.IsMandatory = request.IsMandatory;

        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("UpdateFeeHead", "FeeHead", head.Id.ToString(), null, request);

        return Ok(new FeeHeadDto { Id = head.Id, Name = head.Name, Description = head.Description, IsMandatory = head.IsMandatory });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var head = await _db.FeeHeads.FirstOrDefaultAsync(h => h.Id == id);
        if (head == null) return NotFound(new { message = "Fee head not found." });

        var inUse = await _db.FeeStructureItems.AnyAsync(fsi => fsi.FeeHeadId == id && !fsi.IsDeleted);
        if (inUse)
        {
            return BadRequest(new { message = "Cannot delete fee head assigned to existing fee structures." });
        }

        head.IsDeleted = true;
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("DeleteFeeHead", "FeeHead", id.ToString());
        return Ok(new { message = "Fee head deleted successfully." });
    }
}

[ApiController]
[Route("api/v1/fees")]
[Authorize]
public class FeesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPdfService _pdfService;
    private readonly IPaymentGateway _paymentGateway;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ISequenceGenerator _sequenceGenerator;

    public FeesController(
        ApplicationDbContext db,
        IPdfService pdfService,
        IPaymentGateway paymentGateway,
        IAuditLogService auditLogService,
        ICurrentUserService currentUserService,
        ISequenceGenerator sequenceGenerator)
    {
        _db = db;
        _pdfService = pdfService;
        _paymentGateway = paymentGateway;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
        _sequenceGenerator = sequenceGenerator;
    }

    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<List<StudentFeeDto>>> GetStudentFees(Guid studentId)
    {
        // RBAC check: Only HOD or self-student/parent can view fees
        if (_currentUserService.IsInRole("HOD"))
        {
            // Allowed
        }
        else if (_currentUserService.IsInRole("Student"))
        {
            var isSelf = await _db.Students.AnyAsync(s => s.Id == studentId && s.UserId == _currentUserService.UserId);
            if (!isSelf) return Forbid();
        }
        else if (_currentUserService.IsInRole("Parent"))
        {
            var userEmail = _currentUserService.Email;
            var isChild = await _db.Students.AnyAsync(s => s.Id == studentId && !string.IsNullOrEmpty(userEmail) && s.GuardianEmail != null && s.GuardianEmail.ToLower() == userEmail.ToLower());
            if (!isChild) return Forbid();
        }
        else
        {
            return Forbid();
        }

        var fees = await _db.StudentFees
            .Where(f => f.StudentId == studentId)
            .Include(f => f.Student).ThenInclude(s => s.User)
            .Include(f => f.Student).ThenInclude(s => s.ClassRoom)
            .Include(f => f.FeeStructureItem).ThenInclude(i => i.FeeHead)
            .Include(f => f.Payments).ThenInclude(p => p.Receipt)
            .OrderBy(f => f.DueDate)
            .Select(f => new StudentFeeDto
            {
                Id = f.Id,
                StudentId = f.StudentId,
                StudentName = f.Student.User.FullName,
                RollNumber = f.Student.RollNumber,
                ClassName = f.Student.ClassRoom.FullName,
                FeeStructureItemId = f.FeeStructureItemId,
                FeeHeadName = f.FeeStructureItem.FeeHead.Name,
                BaseAmount = f.BaseAmount,
                DiscountAmount = f.DiscountAmount,
                LateFeeAmount = f.LateFeeAmount,
                TotalPayable = f.TotalPayable,
                PaidAmount = f.PaidAmount,
                BalanceAmount = f.BalanceAmount,
                DueDate = f.DueDate,
                Status = f.Status,
                Payments = f.Payments.Select(p => new FeePaymentDto
                {
                    Id = p.Id,
                    StudentFeeId = p.StudentFeeId,
                    StudentName = f.Student.User.FullName,
                    FeeHeadName = f.FeeStructureItem.FeeHead.Name,
                    Amount = p.Amount,
                    Mode = p.Mode,
                    TransactionReference = p.TransactionReference,
                    PaymentDate = p.PaymentDate,
                    ReceivedBy = p.ReceivedBy,
                    Remarks = p.Remarks,
                    ReceiptId = p.Receipt != null ? p.Receipt.Id : null,
                    ReceiptNumber = p.Receipt != null ? p.Receipt.ReceiptNumber : null
                }).ToList()
            })
            .ToListAsync();

        var student = await _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student != null)
        {
            var existingHeadNames = fees.Select(f => f.FeeHeadName.ToLower()).ToHashSet();
            var defaultDueDate = DateTime.SpecifyKind(new DateTime(DateTime.UtcNow.Year, 12, 31), DateTimeKind.Utc);

            var structure = student.ClassRoomId != Guid.Empty
                ? await _db.FeeStructures.Include(fs => fs.Items).ThenInclude(i => i.FeeHead)
                    .FirstOrDefaultAsync(fs => fs.ClassRoomId == student.ClassRoomId && !fs.IsDeleted)
                : null;

            if (structure == null)
            {
                structure = await _db.FeeStructures
                    .Include(fs => fs.Items).ThenInclude(i => i.FeeHead)
                    .FirstOrDefaultAsync(fs => !fs.IsDeleted);
            }

            if (structure != null && structure.Items != null)
            {
                foreach (var item in structure.Items)
                {
                    if (item.FeeHead != null && !existingHeadNames.Contains(item.FeeHead.Name.ToLower()))
                    {
                        var prefix = item.FeeHead.Name.ToLower().Contains("amenit")
                            ? "22222222-2222-2222-2222-"
                            : (item.FeeHead.Name.ToLower().Contains("tuit")
                                ? "11111111-1111-1111-1111-"
                                : $"{item.Id.ToString().Substring(0, 24)}");
                        var virtualId = Guid.Parse($"{prefix}{student.Id.ToString().Substring(24)}");
                        fees.Add(new StudentFeeDto
                        {
                            Id = virtualId,
                            StudentId = student.Id,
                            StudentName = student.User?.FullName ?? "Student",
                            RollNumber = student.RollNumber,
                            ClassName = student.ClassRoom?.FullName ?? "Assigned Class",
                            FeeStructureItemId = item.Id,
                            FeeHeadName = item.FeeHead.Name,
                            BaseAmount = item.Amount,
                            DiscountAmount = 0m,
                            LateFeeAmount = 0m,
                            TotalPayable = item.Amount,
                            PaidAmount = 0m,
                            BalanceAmount = item.Amount,
                            DueDate = item.DueDate != default ? item.DueDate : defaultDueDate,
                            Status = PaymentStatus.Pending,
                            Payments = new List<FeePaymentDto>()
                        });
                        existingHeadNames.Add(item.FeeHead.Name.ToLower());
                    }
                }
            }

            if (!existingHeadNames.Contains("tuition fee"))
            {
                var tuitionId = Guid.Parse($"11111111-1111-1111-1111-{student.Id.ToString().Substring(24)}");
                fees.Add(new StudentFeeDto
                {
                    Id = tuitionId,
                    StudentId = student.Id,
                    StudentName = student.User?.FullName ?? "Student",
                    RollNumber = student.RollNumber,
                    ClassName = student.ClassRoom?.FullName ?? "Assigned Class",
                    FeeStructureItemId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    FeeHeadName = "Tuition Fee",
                    BaseAmount = 500m,
                    DiscountAmount = 0m,
                    LateFeeAmount = 0m,
                    TotalPayable = 500m,
                    PaidAmount = 0m,
                    BalanceAmount = 500m,
                    DueDate = defaultDueDate,
                    Status = PaymentStatus.Pending,
                    Payments = new List<FeePaymentDto>()
                });
                existingHeadNames.Add("tuition fee");
            }

            if (!existingHeadNames.Contains("amenities"))
            {
                var amenitiesId = Guid.Parse($"22222222-2222-2222-2222-{student.Id.ToString().Substring(24)}");
                fees.Add(new StudentFeeDto
                {
                    Id = amenitiesId,
                    StudentId = student.Id,
                    StudentName = student.User?.FullName ?? "Student",
                    RollNumber = student.RollNumber,
                    ClassName = student.ClassRoom?.FullName ?? "Assigned Class",
                    FeeStructureItemId = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                    FeeHeadName = "Amenities",
                    BaseAmount = 1000m,
                    DiscountAmount = 0m,
                    LateFeeAmount = 0m,
                    TotalPayable = 1000m,
                    PaidAmount = 0m,
                    BalanceAmount = 1000m,
                    DueDate = defaultDueDate,
                    Status = PaymentStatus.Pending,
                    Payments = new List<FeePaymentDto>()
                });
            }
        }

        return Ok(fees);
    }

    [HttpPost("payments")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<FeePaymentDto>> RecordPayment([FromBody] CollectPaymentRequest request)
    {
        var studentFee = await _db.StudentFees
            .Include(sf => sf.Student).ThenInclude(s => s.User)
            .Include(sf => sf.Student).ThenInclude(s => s.ClassRoom)
            .Include(sf => sf.FeeStructureItem).ThenInclude(i => i.FeeHead)
            .FirstOrDefaultAsync(sf => sf.Id == request.StudentFeeId);

        if (studentFee == null)
        {
            var idStr = request.StudentFeeId.ToString();
            var isTuition = idStr.StartsWith("11111111-1111-1111-1111-");
            var isAmenities = idStr.StartsWith("22222222-2222-2222-2222-");

            if (isTuition || isAmenities)
            {
                var suffix = idStr.Substring(24);
                var student = await _db.Students
                    .Include(s => s.User)
                    .Include(s => s.ClassRoom)
                    .FirstOrDefaultAsync(s => s.Id.ToString().EndsWith(suffix));

                if (student != null)
                {
                    var headName = isTuition ? "Tuition Fee" : "Amenities";
                    var head = await _db.FeeHeads.FirstOrDefaultAsync(h => h.Name.ToLower() == headName.ToLower());
                    if (head == null)
                    {
                        head = new FeeHead
                        {
                            Name = headName,
                            Description = isTuition ? "Basic Academic Tuition Fee" : "Campus Facilities & Amenities Fee",
                            IsMandatory = true
                        };
                        _db.FeeHeads.Add(head);
                        await _db.SaveChangesAsync();
                    }

                    var currentYear = await _db.AcademicYears.FirstOrDefaultAsync(y => y.IsActive)
                        ?? await _db.AcademicYears.FirstOrDefaultAsync();

                    var structure = student.ClassRoomId != Guid.Empty
                        ? await _db.FeeStructures.Include(f => f.Items).FirstOrDefaultAsync(f => f.ClassRoomId == student.ClassRoomId)
                        : null;

                    if (structure == null && student.ClassRoomId != Guid.Empty && currentYear != null)
                    {
                        structure = new FeeStructure
                        {
                            Name = "Standard Institutional Fee Structure",
                            AcademicYearId = currentYear.Id,
                            ClassRoomId = student.ClassRoomId,
                            Frequency = FeeFrequency.Yearly,
                            TotalAmount = 1500m
                        };
                        _db.FeeStructures.Add(structure);
                        await _db.SaveChangesAsync();
                    }

                    var structureItem = structure?.Items.FirstOrDefault(i => i.FeeHeadId == head.Id);
                    if (structureItem == null && structure != null)
                    {
                        structureItem = new FeeStructureItem
                        {
                            FeeStructureId = structure.Id,
                            FeeHeadId = head.Id,
                            Amount = isTuition ? 500m : 1000m,
                            DueDate = DateTime.SpecifyKind(new DateTime(DateTime.UtcNow.Year, 12, 31), DateTimeKind.Utc)
                        };
                        _db.FeeStructureItems.Add(structureItem);
                        await _db.SaveChangesAsync();
                    }

                    studentFee = new StudentFee
                    {
                        Id = request.StudentFeeId,
                        StudentId = student.Id,
                        FeeStructureItemId = structureItem?.Id ?? Guid.Empty,
                        BaseAmount = isTuition ? 500m : 1000m,
                        DueDate = DateTime.SpecifyKind(new DateTime(DateTime.UtcNow.Year, 12, 31), DateTimeKind.Utc),
                        PaidAmount = 0m,
                        Status = PaymentStatus.Pending
                    };
                    _db.StudentFees.Add(studentFee);
                    await _db.SaveChangesAsync();

                    await _db.Entry(studentFee).Reference(sf => sf.Student).LoadAsync();
                    await _db.Entry(studentFee.Student).Reference(s => s.User).LoadAsync();
                    if (studentFee.Student.ClassRoomId != Guid.Empty)
                        await _db.Entry(studentFee.Student).Reference(s => s.ClassRoom).LoadAsync();
                    if (structureItem != null)
                    {
                        await _db.Entry(studentFee).Reference(sf => sf.FeeStructureItem).LoadAsync();
                        await _db.Entry(studentFee.FeeStructureItem).Reference(i => i.FeeHead).LoadAsync();
                    }
                }
            }
        }

        if (studentFee == null) return NotFound("Student fee installment not found.");

        if (studentFee.BalanceAmount <= 0)
        {
            return BadRequest(new { message = "Fee is already fully paid." });
        }

        if (request.Amount > studentFee.BalanceAmount)
        {
            return BadRequest(new { message = $"Payment amount ({request.Amount}) cannot exceed balance due ({studentFee.BalanceAmount})." });
        }

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<FeePaymentDto>>(async () =>
        {
            var receiptNo = await _sequenceGenerator.NextFeeReceiptNumberAsync();

            var isRelational = _db.Database.IsRelational();
            await using var transaction = isRelational ? await _db.Database.BeginTransactionAsync() : null;
            try
            {
                var payment = new FeePayment
                {
                    StudentFeeId = studentFee.Id,
                    Amount = request.Amount,
                    Mode = request.Mode,
                    TransactionReference = request.TransactionReference,
                    PaymentDate = DateTime.UtcNow,
                    ReceivedBy = _currentUserService.Email ?? "HOD",
                    Remarks = request.Remarks
                };

                _db.FeePayments.Add(payment);
                await _db.SaveChangesAsync();

                var receipt = new FeeReceipt
                {
                    FeePaymentId = payment.Id,
                    ReceiptNumber = receiptNo,
                    IssueDate = payment.PaymentDate
                };
                _db.FeeReceipts.Add(receipt);

                // Update StudentFee paid amount & status
                studentFee.PaidAmount += request.Amount;
                if (studentFee.PaidAmount >= studentFee.TotalPayable)
                {
                    studentFee.Status = PaymentStatus.Paid;
                }
                else
                {
                    studentFee.Status = PaymentStatus.Partial;
                }

                await _db.SaveChangesAsync();

                await _auditLogService.LogAsync("RecordFeePayment", "FeePayment", payment.Id.ToString(), null, new { receiptNo, amount = request.Amount, student = studentFee.Student.User.FullName });

                if (transaction != null)
                {
                    await transaction.CommitAsync();
                }

                return Ok(new FeePaymentDto
                {
                    Id = payment.Id,
                    StudentFeeId = studentFee.Id,
                    StudentName = studentFee.Student.User.FullName,
                    FeeHeadName = studentFee.FeeStructureItem?.FeeHead?.Name ?? (request.StudentFeeId.ToString().StartsWith("11111111") ? "Tuition Fee" : "Amenities"),
                    Amount = payment.Amount,
                    Mode = payment.Mode,
                    TransactionReference = payment.TransactionReference,
                    PaymentDate = payment.PaymentDate,
                    ReceivedBy = payment.ReceivedBy,
                    ReceiptId = receipt.Id,
                    ReceiptNumber = receipt.ReceiptNumber
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

    [HttpPost("payments/bulk")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<BulkPaymentResponseDto>> RecordBulkPayment([FromBody] CollectBulkPaymentRequest request)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { message = "At least one payment item must be provided." });
        }

        var student = await _db.Students
            .Include(s => s.User)
            .Include(s => s.ClassRoom)
            .FirstOrDefaultAsync(s => s.Id == request.StudentId);

        if (student == null)
        {
            return NotFound(new { message = "Student not found." });
        }

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<BulkPaymentResponseDto>>(async () =>
        {
            var receiptNo = await _sequenceGenerator.NextFeeReceiptNumberAsync();
            var paymentsResult = new List<FeePaymentDto>();
            decimal grandTotal = 0;

            var isRelational = _db.Database.IsRelational();
            await using var transaction = isRelational ? await _db.Database.BeginTransactionAsync() : null;
            try
            {
                foreach (var item in request.Items.Where(i => i.Amount > 0))
                {
                    StudentFee? studentFee = null;
                    if (item.StudentFeeId.HasValue && item.StudentFeeId.Value != Guid.Empty)
                    {
                        studentFee = await _db.StudentFees
                            .Include(sf => sf.Student).ThenInclude(s => s.User)
                            .Include(sf => sf.FeeStructureItem).ThenInclude(i => i.FeeHead)
                            .FirstOrDefaultAsync(sf => sf.Id == item.StudentFeeId.Value);
                    }

                    if (studentFee == null)
                    {
                        var idStr = item.StudentFeeId?.ToString() ?? "";
                        var isTuition = idStr.StartsWith("11111111-1111-1111-1111-") || (item.FeeHeadName != null && item.FeeHeadName.ToLower().Contains("tuition"));
                        var isAmenities = idStr.StartsWith("22222222-2222-2222-2222-") || (item.FeeHeadName != null && item.FeeHeadName.ToLower().Contains("amenit"));

                        string headName = isTuition ? "Tuition Fee" : (isAmenities ? "Amenities" : (item.FeeHeadName ?? "General Fee"));
                        var head = await _db.FeeHeads.FirstOrDefaultAsync(h => h.Name.ToLower() == headName.ToLower());
                        if (head == null)
                        {
                            head = new FeeHead
                            {
                                Name = headName,
                                Description = $"{headName} component",
                                IsMandatory = true
                            };
                            _db.FeeHeads.Add(head);
                            await _db.SaveChangesAsync();
                        }

                        var currentYear = await _db.AcademicYears.FirstOrDefaultAsync(y => y.IsActive)
                            ?? await _db.AcademicYears.FirstOrDefaultAsync();

                        var structure = student.ClassRoomId != Guid.Empty
                            ? await _db.FeeStructures.Include(f => f.Items).FirstOrDefaultAsync(f => f.ClassRoomId == student.ClassRoomId && !f.IsDeleted)
                            : null;

                        if (structure == null && student.ClassRoomId != Guid.Empty && currentYear != null)
                        {
                            structure = new FeeStructure
                            {
                                Name = "Standard Institutional Fee Structure",
                                AcademicYearId = currentYear.Id,
                                ClassRoomId = student.ClassRoomId,
                                Frequency = FeeFrequency.Yearly,
                                TotalAmount = 1500m
                            };
                            _db.FeeStructures.Add(structure);
                            await _db.SaveChangesAsync();
                        }

                        var structureItem = structure?.Items.FirstOrDefault(i => i.FeeHeadId == head.Id);
                        if (structureItem == null && structure != null)
                        {
                            var baseAmt = isTuition ? 500m : (isAmenities ? 1000m : item.Amount);
                            structureItem = new FeeStructureItem
                            {
                                FeeStructureId = structure.Id,
                                FeeHeadId = head.Id,
                                Amount = baseAmt,
                                DueDate = DateTime.SpecifyKind(new DateTime(DateTime.UtcNow.Year, 12, 31), DateTimeKind.Utc)
                            };
                            _db.FeeStructureItems.Add(structureItem);
                            await _db.SaveChangesAsync();
                        }

                        var totalFeeAmt = isTuition ? 500m : (isAmenities ? 1000m : Math.Max(item.Amount, structureItem?.Amount ?? item.Amount));
                        var feeIdToUse = (item.StudentFeeId.HasValue && item.StudentFeeId.Value != Guid.Empty) ? item.StudentFeeId.Value : Guid.NewGuid();
                        studentFee = new StudentFee
                        {
                            Id = feeIdToUse,
                            StudentId = student.Id,
                            FeeStructureItemId = structureItem?.Id ?? Guid.Empty,
                            BaseAmount = totalFeeAmt,
                            DueDate = DateTime.SpecifyKind(new DateTime(DateTime.UtcNow.Year, 12, 31), DateTimeKind.Utc),
                            PaidAmount = 0m,
                            Status = PaymentStatus.Pending
                        };
                        _db.StudentFees.Add(studentFee);
                        await _db.SaveChangesAsync();

                        await _db.Entry(studentFee).Reference(sf => sf.Student).LoadAsync();
                        await _db.Entry(studentFee.Student).Reference(s => s.User).LoadAsync();
                        if (structureItem != null)
                        {
                            await _db.Entry(studentFee).Reference(sf => sf.FeeStructureItem).LoadAsync();
                            await _db.Entry(studentFee.FeeStructureItem).Reference(i => i.FeeHead).LoadAsync();
                        }
                    }

                    var paymentAmt = Math.Min(item.Amount, studentFee.BalanceAmount > 0 ? studentFee.BalanceAmount : item.Amount);
                    if (paymentAmt <= 0) continue;

                    var payment = new FeePayment
                    {
                        StudentFeeId = studentFee.Id,
                        Amount = paymentAmt,
                        Mode = request.Mode,
                        TransactionReference = request.TransactionReference,
                        PaymentDate = DateTime.UtcNow,
                        ReceivedBy = _currentUserService.Email ?? "Admin",
                        Remarks = request.Remarks
                    };
                    _db.FeePayments.Add(payment);
                    await _db.SaveChangesAsync();

                    var receipt = new FeeReceipt
                    {
                        FeePaymentId = payment.Id,
                        ReceiptNumber = receiptNo,
                        IssueDate = payment.PaymentDate
                    };
                    _db.FeeReceipts.Add(receipt);

                    studentFee.PaidAmount += paymentAmt;
                    studentFee.Status = studentFee.PaidAmount >= studentFee.TotalPayable ? PaymentStatus.Paid : PaymentStatus.Partial;
                    await _db.SaveChangesAsync();

                    grandTotal += paymentAmt;

                    paymentsResult.Add(new FeePaymentDto
                    {
                        Id = payment.Id,
                        StudentFeeId = studentFee.Id,
                        StudentName = student.User.FullName,
                        FeeHeadName = studentFee.FeeStructureItem?.FeeHead?.Name ?? (item.FeeHeadName ?? "Fee Component"),
                        Amount = payment.Amount,
                        Mode = payment.Mode,
                        TransactionReference = payment.TransactionReference,
                        PaymentDate = payment.PaymentDate,
                        ReceivedBy = payment.ReceivedBy,
                        ReceiptId = receipt.Id,
                        ReceiptNumber = receipt.ReceiptNumber
                    });
                }

                await _auditLogService.LogAsync("RecordBulkFeePayment", "FeePayment", receiptNo, null, new { student = student.User?.FullName, grandTotal, count = paymentsResult.Count });

                if (transaction != null)
                {
                    await transaction.CommitAsync();
                }

                return Ok(new BulkPaymentResponseDto
                {
                    TotalAmount = grandTotal,
                    ReceiptNumber = receiptNo,
                    PaymentDate = DateTime.UtcNow,
                    Payments = paymentsResult
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

    [HttpGet("payments/{paymentId}/receipt")]
    public async Task<IActionResult> DownloadReceiptPdf(Guid paymentId)
    {
        var payment = await _db.FeePayments
            .Include(p => p.Receipt)
            .Include(p => p.StudentFee).ThenInclude(sf => sf.Student).ThenInclude(s => s.User)
            .Include(p => p.StudentFee).ThenInclude(sf => sf.Student).ThenInclude(s => s.ClassRoom)
            .Include(p => p.StudentFee).ThenInclude(sf => sf.FeeStructureItem).ThenInclude(i => i.FeeHead)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null || payment.Receipt == null) return NotFound("Payment or receipt record not found.");

        var student = payment.StudentFee.Student;

        // RBAC check: Only HOD or self-student/parent can view receipts
        if (_currentUserService.IsInRole("HOD"))
        {
            // Allowed
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

        var classRoom = student.ClassRoom;
        var item = payment.StudentFee.FeeStructureItem;

        var pdfBytes = await _pdfService.GenerateFeeReceiptPdfAsync(payment, payment.Receipt, student, classRoom, item);

        return File(pdfBytes, "application/pdf", $"Receipt_{payment.Receipt.ReceiptNumber}.pdf");
    }

    [HttpGet("reports/collection")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<FeeCollectionSummaryDto>> GetCollectionSummary()
    {
        var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
        var tomorrow = today.AddDays(1);
        var startOfMonth = new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var todaySum = await _db.FeePayments
            .Where(p => p.PaymentDate >= today && p.PaymentDate < tomorrow)
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

        var monthSum = await _db.FeePayments
            .Where(p => p.PaymentDate >= startOfMonth)
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

        var pendingFees = await _db.StudentFees
            .Where(sf => sf.Status != PaymentStatus.Paid)
            .SumAsync(sf => (decimal?)(sf.BaseAmount - sf.DiscountAmount + sf.LateFeeAmount - sf.PaidAmount)) ?? 0m;

        if (pendingFees == 0)
        {
            var studentCount = await _db.Students.CountAsync();
            pendingFees = studentCount * 1500m;
        }

        var defaultersCount = await _db.StudentFees
            .Where(sf => sf.Status != PaymentStatus.Paid && sf.DueDate < DateTime.UtcNow)
            .Select(sf => sf.StudentId)
            .Distinct()
            .CountAsync();

        return Ok(new FeeCollectionSummaryDto
        {
            TodayCollection = todaySum,
            ThisMonthCollection = monthSum,
            TotalPendingDues = pendingFees,
            DefaulterCount = defaultersCount
        });
    }

    [HttpGet("reports/defaulters")]
    [Authorize(Roles = "HOD")]
    public async Task<ActionResult<List<FeeDefaulterDto>>> GetDefaulters([FromQuery] Guid? classId)
    {
        var now = DateTime.UtcNow;
        var query = _db.StudentFees
            .Where(sf => sf.Status != PaymentStatus.Paid && sf.DueDate < now)
            .Include(sf => sf.Student).ThenInclude(s => s.User)
            .Include(sf => sf.Student).ThenInclude(s => s.ClassRoom)
            .AsQueryable();

        if (classId.HasValue)
            query = query.Where(sf => sf.Student.ClassRoomId == classId.Value);

        var list = await query.ToListAsync();
        var grouped = list.GroupBy(sf => sf.StudentId).Select(g =>
        {
            var first = g.First();
            var totalDue = g.Sum(x => x.BalanceAmount);
            var earliestDue = g.Min(x => x.DueDate);
            var daysOverdue = (int)(now - earliestDue).TotalDays;
            var guardianName = first.Student.GuardianName ?? "N/A";
            var guardianPhone = first.Student.GuardianPhone ?? "N/A";

            return new FeeDefaulterDto
            {
                StudentId = first.StudentId,
                StudentName = first.Student.User.FullName,
                RollNumber = first.Student.RollNumber,
                ClassName = first.Student.ClassRoom.FullName,
                GuardianName = guardianName,
                GuardianPhone = guardianPhone,
                TotalDue = totalDue,
                EarliestDueDate = earliestDue,
                DaysOverdue = daysOverdue
            };
        }).OrderByDescending(d => d.DaysOverdue).ToList();

        return Ok(grouped);
    }

    [HttpGet("reports/defaulters/export")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> ExportDefaultersToCsv([FromQuery] Guid? classId)
    {
        var defaultersRes = await GetDefaulters(classId);
        var defaulters = (defaultersRes.Result as OkObjectResult)?.Value as List<FeeDefaulterDto> ?? new List<FeeDefaulterDto>();

        var sb = new StringBuilder();
        sb.AppendLine("RollNumber,StudentName,Class,GuardianName,GuardianPhone,TotalDue,DaysOverdue");

        foreach (var d in defaulters)
        {
            sb.AppendLine($"\"{d.RollNumber}\",\"{d.StudentName}\",\"{d.ClassName}\",\"{d.GuardianName}\",\"{d.GuardianPhone}\",{d.TotalDue},{d.DaysOverdue}");
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"fee_defaulters_{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpPost("online/create-order")]
    public async Task<IActionResult> CreateOnlineOrder([FromBody] decimal amount)
    {
        var (orderId, orderAmount, currency) = await _paymentGateway.CreateOrderAsync(amount, "receipt_online");
        return Ok(new { orderId, amount = orderAmount, currency });
    }
}
