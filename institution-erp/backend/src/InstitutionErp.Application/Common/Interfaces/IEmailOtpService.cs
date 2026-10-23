namespace InstitutionErp.Application.Common.Interfaces;

public interface IEmailOtpService
{
    /// <summary>Generates a cryptographically random 6-digit numeric OTP string (e.g. "482910").</summary>
    string GenerateOtpCode();

    /// <summary>Returns a SHA-256 hex string of the OTP code.</summary>
    string HashOtp(string code);

    /// <summary>Constant-time verification of raw input code against the stored SHA-256 hash.</summary>
    bool VerifyOtp(string inputCode, string storedHash);

    /// <summary>Masks an email for user display, e.g. "a***n@gmail.com".</summary>
    string MaskEmail(string email);

    /// <summary>Sends the OTP verification email with a professional HTML template.</summary>
    Task SendOtpEmailAsync(string recipientEmail, string recipientName, string otpCode, int expiryMinutes, CancellationToken cancellationToken = default);
}
