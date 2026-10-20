using InstitutionErp.Domain.Common;
using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Domain.Entities;

public class FeeHead : BaseEntity
{
    public string Name { get; set; } = string.Empty; // e.g. "Tuition Fee"
    public string? Description { get; set; }
    public bool IsMandatory { get; set; } = true;
}

public class FeeStructure : BaseEntity
{
    public string Name { get; set; } = string.Empty; // e.g. "Grade 10 General Fee 2026-27"
    public Guid AcademicYearId { get; set; }
    public AcademicYear AcademicYear { get; set; } = null!;

    public Guid ClassRoomId { get; set; }
    public ClassRoom ClassRoom { get; set; } = null!;

    public FeeFrequency Frequency { get; set; } = FeeFrequency.Term;
    public decimal TotalAmount { get; set; }

    public ICollection<FeeStructureItem> Items { get; set; } = new List<FeeStructureItem>();
}

public class FeeStructureItem : BaseEntity
{
    public Guid FeeStructureId { get; set; }
    public FeeStructure FeeStructure { get; set; } = null!;

    public Guid FeeHeadId { get; set; }
    public FeeHead FeeHead { get; set; } = null!;

    public decimal Amount { get; set; }
    public DateTime DueDate { get; set; }
}

public class StudentFee : BaseEntity
{
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;

    public Guid FeeStructureItemId { get; set; }
    public FeeStructureItem FeeStructureItem { get; set; } = null!;

    public decimal BaseAmount { get; set; }
    public decimal DiscountAmount { get; set; } = 0;
    public decimal LateFeeAmount { get; set; } = 0;
    public decimal TotalPayable => BaseAmount - DiscountAmount + LateFeeAmount;
    public decimal PaidAmount { get; set; } = 0;
    public decimal BalanceAmount => TotalPayable - PaidAmount;
    public DateTime DueDate { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    public ICollection<FeePayment> Payments { get; set; } = new List<FeePayment>();
}

public class FeePayment : BaseEntity
{
    public Guid StudentFeeId { get; set; }
    public StudentFee StudentFee { get; set; } = null!;

    public decimal Amount { get; set; }
    public PaymentMode Mode { get; set; } = PaymentMode.Cash;
    public string? TransactionReference { get; set; } // Cheque/UPI/Bank ref
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
    public string ReceivedBy { get; set; } = string.Empty; // Staff username/name
    public string? Remarks { get; set; }

    public FeeReceipt? Receipt { get; set; }
}

public class FeeReceipt : BaseEntity
{
    public Guid FeePaymentId { get; set; }
    public FeePayment FeePayment { get; set; } = null!;

    public string ReceiptNumber { get; set; } = string.Empty; // e.g. "REC-2026-0001"
    public DateTime IssueDate { get; set; } = DateTime.UtcNow;
    public string? PdfStoragePath { get; set; }
}
