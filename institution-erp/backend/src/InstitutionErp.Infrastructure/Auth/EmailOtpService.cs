using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Domain.Enums;

namespace InstitutionErp.Infrastructure.Auth;

public class EmailOtpService : IEmailOtpService
{
    private readonly INotificationSender _notificationSender;
    private readonly ILogger<EmailOtpService> _logger;

    public EmailOtpService(INotificationSender notificationSender, ILogger<EmailOtpService> logger)
    {
        _notificationSender = notificationSender;
        _logger = logger;
    }

    /// <inheritdoc/>
    public string GenerateOtpCode()
    {
        // Generates cryptographically secure 6-digit numeric OTP [100000, 999999]
        var code = RandomNumberGenerator.GetInt32(100000, 1000000);
        return code.ToString("D6");
    }

    /// <inheritdoc/>
    public string HashOtp(string code)
    {
        if (string.IsNullOrWhiteSpace(code)) return string.Empty;
        var bytes = Encoding.UTF8.GetBytes(code.Trim());
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    /// <inheritdoc/>
    public bool VerifyOtp(string inputCode, string storedHash)
    {
        if (string.IsNullOrWhiteSpace(inputCode) || string.IsNullOrWhiteSpace(storedHash))
            return false;

        var inputHash = HashOtp(inputCode);
        var inputBytes = Encoding.UTF8.GetBytes(inputHash);
        var storedBytes = Encoding.UTF8.GetBytes(storedHash);

        if (inputBytes.Length != storedBytes.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(inputBytes, storedBytes);
    }

    /// <inheritdoc/>
    public string MaskEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return string.Empty;
        var parts = email.Trim().Split('@');
        if (parts.Length != 2) return email;

        var local = parts[0];
        var domain = parts[1];

        if (local.Length <= 2)
            return $"{local[0]}*@{domain}";

        var first = local[0];
        var last = local[^1];
        var stars = new string('*', Math.Min(5, local.Length - 2));
        return $"{first}{stars}{last}@{domain}";
    }

    /// <inheritdoc/>
    public async Task SendOtpEmailAsync(string recipientEmail, string recipientName, string otpCode, int expiryMinutes, CancellationToken cancellationToken = default)
    {
        var subject = $"{otpCode} is your CampusCore verification code";

        var bodyHtml = $@"
<!DOCTYPE html>
<html>
<head>
  <meta charset=""utf-8"">
  <title>Verification Code</title>
</head>
<body style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px;"">
  <div style=""max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);"">
    <div style=""background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 28px 24px; text-align: center;"">
      <h1 style=""color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;"">CampusCore ERP</h1>
      <p style=""color: #e0e7ff; margin: 6px 0 0 0; font-size: 13px;"">Academic Governance Portal</p>
    </div>
    <div style=""padding: 32px 28px;"">
      <p style=""color: #1e293b; font-size: 15px; margin: 0 0 12px 0;"">Hello <strong>{System.Net.WebUtility.HtmlEncode(recipientName)}</strong>,</p>
      <p style=""color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;"">
        We received a sign-in attempt for your account. Please use the following one-time verification code to complete your login:
      </p>
      <div style=""background: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0; border: 1px solid #e2e8f0;"">
        <span style=""font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #1e293b; font-family: monospace;"">{otpCode}</span>
      </div>
      <p style=""color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 20px 0;"">
        This code is valid for <strong>{expiryMinutes} minutes</strong> and can only be used once. Never share this code with anyone.
      </p>
      <hr style=""border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;"">
      <p style=""color: #94a3b8; font-size: 12px; margin: 0;"">
        If you did not attempt to sign in, your password may have been compromised. Please contact your system administrator immediately.
      </p>
    </div>
  </div>
</body>
</html>";

        // Non-blocking queuing to outbox
        try
        {
            await _notificationSender.QueueOutboxAsync(
                NotificationChannelType.Email,
                recipientEmail,
                subject,
                bodyHtml,
                null,
                cancellationToken);

            _logger.LogInformation("Queued Email OTP to {Email}. Code: {Code}", recipientEmail, otpCode);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to queue OTP email for {Email}. Code: {Code}", recipientEmail, otpCode);
        }
    }
}
