using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Application.DTOs;

public class NoticeDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public NoticeAudience Audience { get; set; }
    public Guid? TargetClassRoomId { get; set; }
    public string? TargetClassName { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? AttachmentUrl { get; set; }
    public bool IsPinned { get; set; }
    public string PostedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public record CreateNoticeRequest(
    string Title,
    string Content,
    NoticeAudience Audience,
    Guid? TargetClassRoomId,
    DateTime? ExpiryDate,
    string? AttachmentUrl,
    bool IsPinned
);

public class NotificationDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationChannelType Channel { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public string? ReferenceType { get; set; }
    public string? ReferenceId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotificationCountDto
{
    public int UnreadCount { get; set; }
}
