using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Application.Common.Utils;
using InstitutionErp.Application.DTOs;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IJwtTokenService _jwtService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ICurrentUserService _currentUserService;
    private readonly INotificationSender _notificationSender;
    private readonly IAuditLogService _auditLogService;

    public AuthController(
        ApplicationDbContext db,
        IJwtTokenService jwtService,
        IPasswordHasher passwordHasher,
        ICurrentUserService currentUserService,
        INotificationSender notificationSender,
        IAuditLogService auditLogService)
    {
        _db = db;
        _jwtService = jwtService;
        _passwordHasher = passwordHasher;
        _currentUserService = currentUserService;
        _notificationSender = notificationSender;
        _auditLogService = auditLogService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-limit")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var rawIdentifier = (request.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(rawIdentifier))
        {
            return Unauthorized(new { message = "Please enter your email, student ID, or employee code." });
        }

        // 1. Search by User Email
        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == rawIdentifier.ToLower());

        // 2. If not found by email, check if identifier is a Student Registration Number (Student ID) or Roll Number
        if (user == null)
        {
            var matchedStudent = await _db.Students
                .IgnoreQueryFilters()
                .Include(s => s.User)
                    .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(s => 
                    !s.IsDeleted &&
                    (s.StudentRegistrationNumber.ToLower() == rawIdentifier.ToLower() ||
                     s.RollNumber.ToLower() == rawIdentifier.ToLower()));

            if (matchedStudent?.User != null)
            {
                user = matchedStudent.User;
            }
        }

        // 3. If not found, check if identifier is a Teacher Employee Code
        if (user == null)
        {
            var matchedTeacher = await _db.Teachers
                .IgnoreQueryFilters()
                .Include(t => t.User)
                    .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(t => 
                    !t.IsDeleted &&
                    t.EmployeeCode.ToLower() == rawIdentifier.ToLower());

            if (matchedTeacher?.User != null)
            {
                user = matchedTeacher.User;
            }
        }

        if (user == null)
        {
            return Unauthorized(new { message = "Invalid email, ID, or password." });
        }

        if (!user.IsActive || user.IsDeleted)
        {
            return Unauthorized(new { message = "Your account has been deactivated. Please contact administrator." });
        }

        // Check if account is currently locked out
        if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTime.UtcNow)
        {
            var remaining = (user.LockoutEnd.Value - DateTime.UtcNow).Minutes;
            return StatusCode(StatusCodes.Status423Locked, new { message = $"Account locked due to excessive failed attempts. Try again in {remaining + 1} minutes." });
        }

        var reqPass = request.Password ?? string.Empty;
        bool passwordMatches = _passwordHasher.VerifyPassword(reqPass, user.PasswordHash);

        // Fallback: If hash verification fails, verify directly against the DefaultPassword stored in the database
        if (!passwordMatches && !string.IsNullOrEmpty(user.DefaultPassword) && reqPass == user.DefaultPassword)
        {
            passwordMatches = true;
            user.PasswordHash = _passwordHasher.HashPassword(reqPass);
            await _db.SaveChangesAsync();
        }

        if (!passwordMatches)
        {
            user.AccessFailedCount++;
            if (user.AccessFailedCount >= 5)
            {
                user.LockoutEnd = DateTime.UtcNow.AddMinutes(15);
                await _db.SaveChangesAsync();
                await _auditLogService.LogAsync("AccountLockout", "User", user.Id.ToString(), null, new { reason = "5 failed password attempts" });
                return StatusCode(StatusCodes.Status423Locked, new { message = "Account locked for 15 minutes due to multiple failed login attempts." });
            }
            await _db.SaveChangesAsync();
            return Unauthorized(new { message = "Invalid email, ID, or password." });
        }

        // Reset lockout upon success
        user.AccessFailedCount = 0;
        user.LockoutEnd = null;
        await _db.SaveChangesAsync();

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var accessToken = _jwtService.GenerateAccessToken(user, roles);
        var rawRefreshToken = _jwtService.GenerateRefreshToken();

        // Hash and store refresh token
        var hashedToken = HashToken(rawRefreshToken);
        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = hashedToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false
        };

        _db.RefreshTokens.Add(refreshTokenEntity);
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("Login", "User", user.Id.ToString());

        var userDto = new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            FullName = user.FullName,
            PhoneNumber = user.PhoneNumber,
            AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive,
            MustChangePassword = user.MustChangePassword,
            Roles = roles
        };

        return Ok(new LoginResponse(accessToken, rawRefreshToken, DateTime.UtcNow.AddMinutes(15), userDto));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-limit")]
    public async Task<ActionResult<LoginResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var principal = _jwtService.GetPrincipalFromExpiredToken(request.AccessToken);
        if (principal == null)
        {
            return BadRequest(new { message = "Invalid access token." });
        }

        var userIdClaim = principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                          ?? principal.FindFirst("sub")?.Value;

        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var hashedToken = HashToken(request.RefreshToken);
        var savedRefreshToken = await _db.RefreshTokens
            .FirstOrDefaultAsync(r => r.UserId == userId && r.TokenHash == hashedToken);

        if (savedRefreshToken == null)
        {
            return Unauthorized(new { message = "Refresh token is invalid or expired." });
        }

        if (savedRefreshToken.IsRevoked)
        {
            // Token reuse detected! Revoke all tokens for this user immediately
            var allUserTokens = await _db.RefreshTokens
                .Where(r => r.UserId == userId && !r.IsRevoked)
                .ToListAsync();

            foreach (var token in allUserTokens)
            {
                token.IsRevoked = true;
            }

            await _db.SaveChangesAsync();
            await _auditLogService.LogAsync("SecurityBreach", "User", userId.ToString(), null, new { reason = "Revoked refresh token reuse detected. All sessions revoked." });
            return Unauthorized(new { message = "Token reuse detected. All active sessions have been terminated." });
        }

        if (savedRefreshToken.ExpiresAt <= DateTime.UtcNow)
        {
            return Unauthorized(new { message = "Refresh token is expired." });
        }

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null || !user.IsActive || user.IsDeleted)
        {
            return Unauthorized(new { message = "User not found or inactive." });
        }

        // Rotate refresh token
        savedRefreshToken.IsRevoked = true;
        var newRawRefreshToken = _jwtService.GenerateRefreshToken();
        var newHashedToken = HashToken(newRawRefreshToken);
        savedRefreshToken.ReplacedByTokenHash = newHashedToken;

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = newHashedToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false
        });

        await _db.SaveChangesAsync();

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var newAccessToken = _jwtService.GenerateAccessToken(user, roles);

        var userDto = new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            FullName = user.FullName,
            PhoneNumber = user.PhoneNumber,
            AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive,
            MustChangePassword = user.MustChangePassword,
            Roles = roles
        };

        return Ok(new LoginResponse(newAccessToken, newRawRefreshToken, DateTime.UtcNow.AddMinutes(15), userDto));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        if (_currentUserService.UserId.HasValue)
        {
            var tokens = await _db.RefreshTokens
                .Where(r => r.UserId == _currentUserService.UserId.Value && !r.IsRevoked)
                .ToListAsync();

            foreach (var t in tokens)
            {
                t.IsRevoked = true;
            }
            await _db.SaveChangesAsync();
            await _auditLogService.LogAsync("Logout", "User", _currentUserService.UserId.Value.ToString());
        }

        return Ok(new { message = "Logged out successfully." });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<LoginResponse>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "New password must be at least 6 characters long." });
        }

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == _currentUserService.UserId.Value);
        if (user == null) return NotFound();

        if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "Current password is incorrect." });
        }

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.DefaultPassword = request.NewPassword;
        user.MustChangePassword = false;
        user.LockoutEnd = null;
        user.AccessFailedCount = 0;

        // Revoke all existing refresh tokens
        var existingTokens = await _db.RefreshTokens
            .Where(r => r.UserId == user.Id && !r.IsRevoked)
            .ToListAsync();
        foreach (var t in existingTokens) t.IsRevoked = true;

        // Generate fresh session tokens with MustChangePassword = false
        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var newAccessToken = _jwtService.GenerateAccessToken(user, roles);
        var rawRefreshToken = _jwtService.GenerateRefreshToken();
        var refreshTokenExpiry = DateTime.UtcNow.AddDays(7);

        var newRefreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawRefreshToken),
            ExpiresAt = refreshTokenExpiry
        };
        _db.RefreshTokens.Add(newRefreshTokenEntity);

        await _db.SaveChangesAsync();

        // Queue security notification email
        try
        {
            await _notificationSender.QueueOutboxAsync(
                NotificationChannelType.Email,
                user.Email,
                "Your CampusCore Password Has Been Changed",
                $@"
                    <div style=""font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; color: #1e293b; line-height: 1.6;"">
                        <h2 style=""color: #4f46e5;"">Security Notification</h2>
                        <p>Hello <strong>{user.FirstName}</strong>,</p>
                        <p>This is confirmation that the password for your CampusCore ERP account (<strong>{user.Email}</strong>) was changed successfully.</p>
                        <p style=""font-size: 13px; color: #64748b;"">If you did not perform this change, please contact your institution administrator immediately.</p>
                    </div>"
            );
        }
        catch
        {
            // Ignore notification failure
        }

        await _auditLogService.LogAsync("ChangePassword", "User", user.Id.ToString());

        return Ok(new LoginResponse(
            newAccessToken,
            rawRefreshToken,
            refreshTokenExpiry,
            new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                FullName = user.FullName,
                PhoneNumber = user.PhoneNumber,
                AvatarUrl = user.AvatarUrl,
                IsActive = user.IsActive,
                MustChangePassword = false,
                Roles = roles
            }
        ));
    }

    [HttpPost("keep-password")]
    [Authorize]
    public async Task<ActionResult<LoginResponse>> KeepPassword()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == _currentUserService.UserId.Value);

        if (user == null) return NotFound();

        // Mark must-change-password as completed (user elected to keep their current password)
        user.MustChangePassword = false;

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var newAccessToken = _jwtService.GenerateAccessToken(user, roles);
        var rawRefreshToken = _jwtService.GenerateRefreshToken();
        var refreshTokenExpiry = DateTime.UtcNow.AddDays(7);

        var newRefreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawRefreshToken),
            ExpiresAt = refreshTokenExpiry
        };
        _db.RefreshTokens.Add(newRefreshTokenEntity);

        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("KeepPassword", "User", user.Id.ToString());

        return Ok(new LoginResponse(
            newAccessToken,
            rawRefreshToken,
            refreshTokenExpiry,
            new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                FullName = user.FullName,
                PhoneNumber = user.PhoneNumber,
                AvatarUrl = user.AvatarUrl,
                IsActive = user.IsActive,
                MustChangePassword = false,
                Roles = roles
            }
        ));
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-limit")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());
        if (user != null && user.IsActive && !user.IsDeleted)
        {
            // Generate a 32-byte cryptographically secure random token
            var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
            user.PasswordResetToken = HashToken(rawToken);
            user.PasswordResetTokenExpires = DateTime.UtcNow.AddMinutes(15);
            await _db.SaveChangesAsync();

            var resetUrl = $"/reset-password?email={Uri.EscapeDataString(user.Email)}&token={rawToken}";
            var emailBody = $@"
                <div style=""font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; color: #1e293b; line-height: 1.6;"">
                    <div style=""background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 20px; border-radius: 10px 10px 0 0; text-align: center; color: #ffffff;"">
                        <h2 style=""margin: 0; font-size: 20px;"">CampusCore ERP</h2>
                        <p style=""margin: 4px 0 0; font-size: 13px; opacity: 0.9;"">Password Reset Request</p>
                    </div>
                    <div style=""background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; padding: 24px;"">
                        <p style=""font-size: 14px;"">Hello <strong>{user.FirstName}</strong>,</p>
                        <p style=""font-size: 14px;"">We received a request to reset the password for your CampusCore portal account (<strong>{user.Email}</strong>).</p>
                        
                        <div style=""text-align: center; margin: 24px 0;"">
                            <p style=""font-size: 12px; color: #64748b; margin-bottom: 6px;"">YOUR SECURE RESET TOKEN</p>
                            <span style=""font-size: 16px; font-weight: bold; color: #4f46e5; background: #e0e7ff; padding: 8px 16px; border-radius: 8px; font-family: monospace; display: inline-block; word-break: break-all;"">{rawToken}</span>
                        </div>

                        <p style=""font-size: 13px; text-align: center;"">
                            <a href=""{resetUrl}"" style=""display: inline-block; background-color: #4f46e5; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;"">Reset Password Directly</a>
                        </p>

                        <p style=""font-size: 12px; color: #64748b; margin-top: 20px;"">This token is valid for 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>
                    </div>
                </div>";

            await _notificationSender.QueueOutboxAsync(
                NotificationChannelType.Email,
                user.Email,
                "Password Reset Code - CampusCore ERP",
                emailBody
            );
        }

        return Ok(new { message = "If the email exists, a password reset instruction has been dispatched." });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-limit")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Password must be at least 6 characters long." });
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());
        var tokenHash = !string.IsNullOrWhiteSpace(request.Token) ? HashToken(request.Token.Trim()) : null;

        if (user == null ||
            string.IsNullOrWhiteSpace(user.PasswordResetToken) ||
            tokenHash == null ||
            !string.Equals(user.PasswordResetToken, tokenHash, StringComparison.Ordinal) ||
            user.PasswordResetTokenExpires <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Invalid or expired reset token. Please request a new one." });
        }

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.DefaultPassword = request.NewPassword;
        user.MustChangePassword = false;
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpires = null;
        user.LockoutEnd = null;
        user.AccessFailedCount = 0;

        // Revoke any active refresh tokens to terminate stale sessions
        var refreshTokens = await _db.RefreshTokens
            .Where(rt => rt.UserId == user.Id && !rt.IsRevoked)
            .ToListAsync();
        foreach (var rt in refreshTokens) rt.IsRevoked = true;

        await _db.SaveChangesAsync();

        // Send confirmation email
        try
        {
            await _notificationSender.QueueOutboxAsync(
                NotificationChannelType.Email,
                user.Email,
                "Your CampusCore Password Has Been Reset Successfully",
                $@"
                    <div style=""font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; color: #1e293b; line-height: 1.6;"">
                        <h2 style=""color: #10b981;"">Password Reset Complete</h2>
                        <p>Hello <strong>{user.FirstName}</strong>,</p>
                        <p>Your password for CampusCore ERP has been successfully reset. You can now log in using your new password.</p>
                        <div style=""text-align: center; margin: 20px 0;"">
                            <a href=""/login"" style=""background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;"">Sign In to Portal</a>
                        </div>
                    </div>"
            );
        }
        catch
        {
            // Ignore notification failure
        }

        await _auditLogService.LogAsync("ResetPassword", "User", user.Id.ToString());

        return Ok(new { message = "Password reset successfully. You can now login with your new password." });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetCurrentUser()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == _currentUserService.UserId.Value);

        if (user == null) return NotFound();

        return Ok(new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            FullName = user.FullName,
            PhoneNumber = user.PhoneNumber,
            AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive,
            MustChangePassword = user.MustChangePassword,
            Roles = user.UserRoles.Select(ur => ur.Role.Name).ToList()
        });
    }

    private static string HashToken(string token)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }
}
