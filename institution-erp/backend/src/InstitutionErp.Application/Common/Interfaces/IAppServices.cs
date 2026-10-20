using System.Security.Claims;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Application.Common.Interfaces;

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Email { get; }
    IReadOnlyList<string> Roles { get; }
    bool IsInRole(string role);
    string? IpAddress { get; }
}

public interface IJwtTokenService
{
    string GenerateAccessToken(User user, IEnumerable<string> roles);
    string GenerateRefreshToken();
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}

public interface IFileStorage
{
    Task<string> SaveFileAsync(Stream stream, string fileName, string folder, CancellationToken cancellationToken = default);
    Task DeleteFileAsync(string filePath, CancellationToken cancellationToken = default);
    Task<Stream> GetFileStreamAsync(string filePath, CancellationToken cancellationToken = default);
}

public interface IPdfService
{
    Task<byte[]> GenerateFeeReceiptPdfAsync(FeePayment payment, FeeReceipt receipt, Student student, ClassRoom classRoom, FeeStructureItem item);
    Task<byte[]> GenerateReportCardPdfAsync(Student student, Exam exam, IReadOnlyList<(ExamSubject subject, ExamMark mark)> results, decimal attendancePercentage, string grade, decimal totalMarks, decimal maxMarks, decimal percentage, int rank);
}

public interface INotificationSender
{
    Task SendNotificationAsync(Guid userId, string title, string message, NotificationChannelType channel, string? refType = null, string? refId = null, CancellationToken cancellationToken = default);
    Task QueueOutboxAsync(NotificationChannelType channel, string recipient, string subject, string body, string? payloadJson = null, CancellationToken cancellationToken = default);
}

public interface IPaymentGateway
{
    Task<(string orderId, decimal amount, string currency)> CreateOrderAsync(decimal amount, string receipt, CancellationToken cancellationToken = default);
    bool VerifySignature(string orderId, string paymentId, string signature);
}

public interface IAuditLogService
{
    Task LogAsync(string action, string entityName, string? entityId = null, object? oldValues = null, object? newValues = null, CancellationToken cancellationToken = default);
}

public interface ISequenceGenerator
{
    Task<string> NextStudentRegistrationNumberAsync(CancellationToken cancellationToken = default);
    Task<string> NextAdmissionReferenceNumberAsync(CancellationToken cancellationToken = default);
    Task<string> NextFeeReceiptNumberAsync(CancellationToken cancellationToken = default);
    Task<string> NextTeacherEmployeeCodeAsync(CancellationToken cancellationToken = default);
}
