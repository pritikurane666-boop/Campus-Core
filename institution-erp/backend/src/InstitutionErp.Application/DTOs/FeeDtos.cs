using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Application.DTOs;

public class FeeHeadDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsMandatory { get; set; }
}

public record CreateFeeHeadRequest(string Name, string? Description, bool IsMandatory);

public class FeeStructureItemDto
{
    public Guid Id { get; set; }
    public Guid FeeHeadId { get; set; }
    public string FeeHeadName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime DueDate { get; set; }
}

public class FeeStructureDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid AcademicYearId { get; set; }
    public string AcademicYearName { get; set; } = string.Empty;
    public Guid ClassRoomId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public FeeFrequency Frequency { get; set; }
    public decimal TotalAmount { get; set; }
    public List<FeeStructureItemDto> Items { get; set; } = new();
}

public record CreateFeeStructureItemRequest(Guid FeeHeadId, decimal Amount, DateTime DueDate);

public record CreateFeeStructureRequest(
    string Name,
    Guid AcademicYearId,
    Guid ClassRoomId,
    FeeFrequency Frequency,
    List<CreateFeeStructureItemRequest> Items
);

public class StudentFeeDto
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public Guid FeeStructureItemId { get; set; }
    public string FeeHeadName { get; set; } = string.Empty;
    public decimal BaseAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LateFeeAmount { get; set; }
    public decimal TotalPayable { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal BalanceAmount { get; set; }
    public DateTime DueDate { get; set; }
    public PaymentStatus Status { get; set; }
    public bool IsOverdue => DueDate < DateTime.UtcNow && Status != PaymentStatus.Paid;
    public List<FeePaymentDto> Payments { get; set; } = new();
}

public class FeePaymentDto
{
    public Guid Id { get; set; }
    public Guid StudentFeeId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string FeeHeadName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public PaymentMode Mode { get; set; }
    public string? TransactionReference { get; set; }
    public DateTime PaymentDate { get; set; }
    public string ReceivedBy { get; set; } = string.Empty;
    public string? Remarks { get; set; }
    public Guid? ReceiptId { get; set; }
    public string? ReceiptNumber { get; set; }
}

public record CollectPaymentRequest(
    Guid StudentFeeId,
    decimal Amount,
    PaymentMode Mode,
    string? TransactionReference,
    string? Remarks
);

public class BulkPaymentItemDto
{
    public Guid? StudentFeeId { get; set; }
    public Guid? FeeHeadId { get; set; }
    public string? FeeHeadName { get; set; }
    public decimal Amount { get; set; }
}

public class CollectBulkPaymentRequest
{
    public Guid StudentId { get; set; }
    public PaymentMode Mode { get; set; }
    public string? TransactionReference { get; set; }
    public string? Remarks { get; set; }
    public List<BulkPaymentItemDto> Items { get; set; } = new();
}

public class BulkPaymentResponseDto
{
    public decimal TotalAmount { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public DateTime PaymentDate { get; set; }
    public List<FeePaymentDto> Payments { get; set; } = new();
}

public class FeeReceiptDto
{
    public Guid Id { get; set; }
    public Guid FeePaymentId { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public DateTime IssueDate { get; set; }
    public decimal AmountPaid { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string FeeHeadName { get; set; } = string.Empty;
    public PaymentMode Mode { get; set; }
    public string ReceivedBy { get; set; } = string.Empty;
}

public class FeeDefaulterDto
{
    public Guid StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string GuardianName { get; set; } = string.Empty;
    public string GuardianPhone { get; set; } = string.Empty;
    public decimal TotalDue { get; set; }
    public DateTime EarliestDueDate { get; set; }
    public int DaysOverdue { get; set; }
}

public class FeeCollectionSummaryDto
{
    public decimal TodayCollection { get; set; }
    public decimal ThisMonthCollection { get; set; }
    public decimal TotalPendingDues { get; set; }
    public int DefaulterCount { get; set; }
}
