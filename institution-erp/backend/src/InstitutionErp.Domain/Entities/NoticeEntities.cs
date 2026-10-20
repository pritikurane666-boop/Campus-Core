using InstitutionErp.Domain.Common;
using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Domain.Entities;

public class Notice : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public NoticeAudience Audience { get; set; } = NoticeAudience.All;
    public Guid? TargetClassRoomId { get; set; }
    public ClassRoom? TargetClassRoom { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? AttachmentUrl { get; set; }
    public bool IsPinned { get; set; } = false;
    public string PostedBy { get; set; } = string.Empty;
}

public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationChannelType Channel { get; set; } = NotificationChannelType.InApp;
    public bool IsRead { get; set; } = false;
    public DateTime? ReadAt { get; set; }
    public string? ReferenceType { get; set; } // "Attendance", "Fee", "Exam", "Notice"
    public string? ReferenceId { get; set; }
}

public class NotificationOutbox : BaseEntity
{
    public NotificationChannelType Channel { get; set; }
    public string Recipient { get; set; } = string.Empty; // Email, phone, or user identifier
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;
    public int RetryCount { get; set; } = 0;
    public DateTime? NextRetryAt { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime? ProcessedAt { get; set; }
}
