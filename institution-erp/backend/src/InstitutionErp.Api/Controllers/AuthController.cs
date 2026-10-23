using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Application.Common.Utils;
using InstitutionErp.Application.DTOs;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Api.Controllers;

// ─── Request/Response DTOs (file-scoped for locality) ─────────────────────

public record TotpSetupRequest(string ChallengeId);
public record TotpConfirmRequest(string ChallengeId, string Code);
public record TotpVerifyRequest(string ChallengeId, string? Code, string? RecoveryCode, bool TrustDevice = false);
public record RegenerateCodesRequest(string Password, string Code);
public record AdminReset2faRequest(string TargetUserId, string PrincipalCode);

public record LoginChallengeResponse(bool RequiresTotp, bool RequiresTotpSetup, string ChallengeId);
public record TotpSetupResponse(string OtpAuthUri, string Base32Key);
public record TotpConfirmResponse(string[] RecoveryCodes, string AccessToken, string RefreshToken, DateTime ExpiresAt, UserDto User);
public record TotpVerifyResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt, UserDto User);
public record TwoFaStatusResponse(bool IsEnabled, int RecoveryCodesRemaining, int TrustedDeviceCount);

// ──────────────────────────────────────────────────────────────────────────

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
    private readonly ITotpService _totpService;
    private readonly TotpOptions _totpOptions;

    private const string TrustedDeviceCookieName = "cc_td";

    public AuthController(
        ApplicationDbContext db,
        IJwtTokenService jwtService,
        IPasswordHasher passwordHasher,
        ICurrentUserService currentUserService,
        INotificationSender notificationSender,
        IAuditLogService auditLogService,
        ITotpService totpService,
        IOptions<TotpOptions> totpOptions)
    {
        _db = db;
        _jwtService = jwtService;
        _passwordHasher = passwordHasher;
        _currentUserService = currentUserService;
        _notificationSender = notificationSender;
        _auditLogService = auditLogService;
        _totpService = totpService;
        _totpOptions = totpOptions.Value;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LOGIN
    // ═══════════════════════════════════════════════════════════════════════

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-limit")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var rawIdentifier = (request.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(rawIdentifier))
            return Unauthorized(new { message = "Please enter your email, student ID, or employee code." });

        // 1. Resolve user by email / student ID / employee code
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == rawIdentifier.ToLower());

        if (user == null)
        {
            var matchedStudent = await _db.Students
                .IgnoreQueryFilters()
                .Include(s => s.User).ThenInclude(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(s =>
                    !s.IsDeleted &&
                    (s.StudentRegistrationNumber.ToLower() == rawIdentifier.ToLower() ||
                     s.RollNumber.ToLower() == rawIdentifier.ToLower()));
            if (matchedStudent?.User != null) user = matchedStudent.User;
        }

        if (user == null)
        {
            var matchedTeacher = await _db.Teachers
                .IgnoreQueryFilters()
                .Include(t => t.User).ThenInclude(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(t => !t.IsDeleted && t.EmployeeCode.ToLower() == rawIdentifier.ToLower());
            if (matchedTeacher?.User != null) user = matchedTeacher.User;
        }

        // Generic: don't reveal whether the user exists
        if (user == null)
            return Unauthorized(new { message = "Invalid email, ID, or password." });

        if (!user.IsActive || user.IsDeleted)
            return Unauthorized(new { message = "Your account has been deactivated. Please contact administrator." });

        // Lockout check
        if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTime.UtcNow)
        {
            var remaining = (user.LockoutEnd.Value - DateTime.UtcNow).Minutes;
            return StatusCode(StatusCodes.Status423Locked,
                new { message = $"Account locked due to excessive failed attempts. Try again in {remaining + 1} minutes." });
        }

        // 2. Password verification
        var reqPass = request.Password ?? string.Empty;
        bool passwordMatches = _passwordHasher.VerifyPassword(reqPass, user.PasswordHash);

        // Fallback for legacy DefaultPassword (remove this block once DECISIONS.md cleanup is done)
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
                return StatusCode(StatusCodes.Status423Locked,
                    new { message = "Account locked for 15 minutes due to multiple failed login attempts." });
            }
            await _db.SaveChangesAsync();
            return Unauthorized(new { message = "Invalid email, ID, or password." });
        }

        // Reset lockout
        user.AccessFailedCount = 0;
        user.LockoutEnd = null;
        await _db.SaveChangesAsync();

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();

        // 3. TOTP gate (password succeeded — now check 2FA)
        if (_totpOptions.Enabled && RoleRequiresTotp(roles))
        {
            // Check trusted-device cookie
            if (await IsValidTrustedDevice(user.Id))
            {
                // Device is trusted — skip 2FA and issue tokens
                return Ok(await IssueTokensAsync(user, roles));
            }

            // Load existing TOTP record
            var totpRecord = await _db.UserTotps.FirstOrDefaultAsync(t => t.UserId == user.Id);
            var hasConfirmed2fa = totpRecord?.ConfirmedAt != null;

            // Create a login challenge
            var challengeType = hasConfirmed2fa ? LoginChallengeType.Verify : LoginChallengeType.Setup;
            var challenge = new LoginChallenge
            {
                UserId = user.Id,
                Type = challengeType,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_totpOptions.ChallengeExpiryMinutes),
                IpAddress = _currentUserService.IpAddress,
                UserAgent = Request.Headers.UserAgent.ToString()[..Math.Min(512, Request.Headers.UserAgent.ToString().Length)]
            };
            _db.LoginChallenges.Add(challenge);
            await _db.SaveChangesAsync();

            await _auditLogService.LogAsync("TotpChallengeCreated", "LoginChallenge", challenge.Id.ToString(),
                null, new { type = challengeType.ToString(), userId = user.Id });

            // Return challenge response — NO tokens yet
            return Ok(new LoginChallengeResponse(
                RequiresTotp: hasConfirmed2fa,
                RequiresTotpSetup: !hasConfirmed2fa,
                ChallengeId: challenge.Id.ToString()));
        }

        // 4. No 2FA required — issue tokens directly
        await _auditLogService.LogAsync("Login", "User", user.Id.ToString());
        return Ok(await IssueTokensAsync(user, roles));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  2FA SETUP — generates and stores a PENDING encrypted secret
    // ═══════════════════════════════════════════════════════════════════════

    [HttpPost("2fa/setup")]
    [AllowAnonymous]
    [EnableRateLimiting("totp-limit")]
    public async Task<IActionResult> TotpSetup([FromBody] TotpSetupRequest request)
    {
        var challenge = await ValidateChallengeAsync(request.ChallengeId, LoginChallengeType.Setup);
        if (challenge == null)
            return BadRequest(new { message = "Invalid or expired session. Please log in again." });

        // Generate a new secret and store it PENDING (confirmed_at = null)
        var base32Secret = _totpService.GenerateBase32Secret();
        var (encrypted, nonce) = _totpService.EncryptSecret(base32Secret, keyVersion: 1);

        // Replace any existing PENDING record (idempotent)
        var existing = await _db.UserTotps.FirstOrDefaultAsync(t => t.UserId == challenge.UserId);
        if (existing != null)
        {
            existing.EncryptedSecret = encrypted;
            existing.Nonce = nonce;
            existing.KeyVersion = 1;
            existing.ConfirmedAt = null; // keep pending
            existing.LastUsedStep = -1;
        }
        else
        {
            _db.UserTotps.Add(new UserTotp
            {
                UserId = challenge.UserId,
                EncryptedSecret = encrypted,
                Nonce = nonce,
                KeyVersion = 1,
                ConfirmedAt = null,
                LastUsedStep = -1
            });
        }
        await _db.SaveChangesAsync();

        // Build the otpauth URI and load the user's email
        var user = await _db.Users.FindAsync(challenge.UserId);
        var issuer = _totpOptions.Issuer;
        var uri = _totpService.BuildOtpAuthUri(user!.Email, base32Secret, issuer);

        // NOTE: We do NOT log the URI or the base32 secret
        // Return both URI (for QR) and base32 key (for manual entry)
        return Ok(new TotpSetupResponse(OtpAuthUri: uri, Base32Key: base32Secret));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  2FA CONFIRM — verifies first code, marks confirmed, issues tokens
    // ═══════════════════════════════════════════════════════════════════════

    [HttpPost("2fa/confirm")]
    [AllowAnonymous]
    [EnableRateLimiting("totp-limit")]
    public async Task<IActionResult> TotpConfirm([FromBody] TotpConfirmRequest request)
    {
        var challenge = await ValidateChallengeAsync(request.ChallengeId, LoginChallengeType.Setup);
        if (challenge == null)
            return BadRequest(new { message = "Invalid or expired session. Please log in again." });

        var totpRecord = await _db.UserTotps
            .FirstOrDefaultAsync(t => t.UserId == challenge.UserId && t.ConfirmedAt == null);

        if (totpRecord == null)
            return BadRequest(new { message = "No pending 2FA setup found. Please restart setup." });

        // Check max attempts
        if (challenge.Attempts >= _totpOptions.MaxAttempts)
            return BadRequest(new { message = "Too many attempts. Please log in again." });

        // Verify the code
        var valid = _totpService.VerifyCode(
            totpRecord.EncryptedSecret, totpRecord.Nonce, totpRecord.KeyVersion,
            request.Code ?? string.Empty, totpRecord.LastUsedStep, _totpOptions.Window,
            out var acceptedStep);

        if (!valid)
        {
            challenge.Attempts++;
            if (challenge.Attempts >= _totpOptions.MaxAttempts)
                challenge.ConsumedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            await _auditLogService.LogAsync("TotpConfirmFailed", "User", challenge.UserId.ToString());

            // Also count toward account lockout
            await IncrementAccountFailedCount(challenge.UserId);

            return BadRequest(new { message = "Invalid code. Please try again." });
        }

        // Confirm the 2FA enrollment
        totpRecord.ConfirmedAt = DateTime.UtcNow;
        totpRecord.LastUsedStep = acceptedStep;

        // Generate and store recovery codes
        var rawCodes = _totpService.GenerateRecoveryCodes(_totpOptions.RecoveryCodeCount);
        var existingCodes = await _db.RecoveryCodes.Where(rc => rc.UserId == challenge.UserId).ToListAsync();
        _db.RecoveryCodes.RemoveRange(existingCodes);
        foreach (var code in rawCodes)
        {
            _db.RecoveryCodes.Add(new RecoveryCode
            {
                UserId = challenge.UserId,
                CodeHash = _totpService.HashRecoveryCode(code)
            });
        }

        // Consume the challenge
        challenge.ConsumedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("TotpEnrolled", "User", challenge.UserId.ToString());

        // Send 2FA-enabled email (low priority, non-blocking)
        await TrySendEmailAsync(challenge.UserId, "Two-Factor Authentication Enabled",
            "Two-factor authentication has been enabled on your CampusCore account. If you did not do this, contact your administrator immediately.");

        var user = await _db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == challenge.UserId);
        var roles = user!.UserRoles.Select(ur => ur.Role.Name).ToList();
        var tokenResponse = await IssueTokensAsync(user, roles);

        // Return recovery codes ONCE — they are never stored in plaintext
        return Ok(new TotpConfirmResponse(
            RecoveryCodes: rawCodes,
            AccessToken: tokenResponse.AccessToken,
            RefreshToken: tokenResponse.RefreshToken,
            ExpiresAt: tokenResponse.ExpiresAt,
            User: tokenResponse.User));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  2FA VERIFY — validates TOTP or recovery code and issues tokens
    // ═══════════════════════════════════════════════════════════════════════

    [HttpPost("2fa/verify")]
    [AllowAnonymous]
    [EnableRateLimiting("totp-limit")]
    public async Task<IActionResult> TotpVerify([FromBody] TotpVerifyRequest request)
    {
        var challenge = await ValidateChallengeAsync(request.ChallengeId, LoginChallengeType.Verify);
        if (challenge == null)
            return BadRequest(new { message = "Invalid or expired session. Please log in again." });

        if (challenge.Attempts >= _totpOptions.MaxAttempts)
            return BadRequest(new { message = "Too many attempts. Please log in again." });

        var totpRecord = await _db.UserTotps
            .FirstOrDefaultAsync(t => t.UserId == challenge.UserId && t.ConfirmedAt != null);
        if (totpRecord == null)
            return BadRequest(new { message = "2FA is not set up for this account." });

        bool verified = false;
        bool usedRecoveryCode = false;

        // Path A: TOTP code
        if (!string.IsNullOrWhiteSpace(request.Code))
        {
            verified = _totpService.VerifyCode(
                totpRecord.EncryptedSecret, totpRecord.Nonce, totpRecord.KeyVersion,
                request.Code, totpRecord.LastUsedStep, _totpOptions.Window,
                out var acceptedStep);

            if (verified)
                totpRecord.LastUsedStep = acceptedStep;
        }
        // Path B: Recovery code
        else if (!string.IsNullOrWhiteSpace(request.RecoveryCode))
        {
            var availableCodes = await _db.RecoveryCodes
                .Where(rc => rc.UserId == challenge.UserId && rc.UsedAt == null)
                .ToListAsync();

            var hashes = availableCodes.Select(rc => rc.CodeHash);
            var matchedHash = _totpService.VerifyRecoveryCode(request.RecoveryCode, hashes);

            if (matchedHash != null)
            {
                var matchedCode = availableCodes.First(rc => rc.CodeHash == matchedHash);
                matchedCode.UsedAt = DateTime.UtcNow;
                verified = true;
                usedRecoveryCode = true;
            }
        }

        if (!verified)
        {
            challenge.Attempts++;
            if (challenge.Attempts >= _totpOptions.MaxAttempts)
                challenge.ConsumedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            await _auditLogService.LogAsync("TotpVerifyFailed", "User", challenge.UserId.ToString(),
                null, new { usingRecovery = !string.IsNullOrWhiteSpace(request.RecoveryCode) });

            await IncrementAccountFailedCount(challenge.UserId);

            return BadRequest(new { message = "Invalid code." });
        }

        // Consume the challenge (single-use)
        challenge.ConsumedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (usedRecoveryCode)
        {
            await _auditLogService.LogAsync("TotpRecoveryCodeUsed", "User", challenge.UserId.ToString());
            await TrySendEmailAsync(challenge.UserId, "Recovery Code Used",
                "A recovery code was used to sign in to your CampusCore account. If you did not do this, contact your administrator immediately.");

            // Warn if fewer than 3 remaining
            var remaining = await _db.RecoveryCodes.CountAsync(rc => rc.UserId == challenge.UserId && rc.UsedAt == null);
            if (remaining < 3)
            {
                await TrySendEmailAsync(challenge.UserId, "Low Recovery Codes Warning",
                    $"You only have {remaining} recovery code(s) remaining. Please regenerate them from your Security settings.");
            }
        }
        else
        {
            await _auditLogService.LogAsync("TotpVerified", "User", challenge.UserId.ToString());
        }

        // Trusted-device cookie
        if (request.TrustDevice && _totpOptions.TrustedDeviceDays > 0)
        {
            await CreateTrustedDeviceAsync(challenge.UserId);
        }

        var user = await _db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == challenge.UserId);
        var roles = user!.UserRoles.Select(ur => ur.Role.Name).ToList();

        await _auditLogService.LogAsync("Login", "User", user.Id.ToString());
        var tokenResponse = await IssueTokensAsync(user, roles);

        return Ok(new TotpVerifyResponse(
            AccessToken: tokenResponse.AccessToken,
            RefreshToken: tokenResponse.RefreshToken,
            ExpiresAt: tokenResponse.ExpiresAt,
            User: tokenResponse.User));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SECURITY PAGE — status, regenerate codes, forget trusted devices
    // ═══════════════════════════════════════════════════════════════════════

    [HttpGet("2fa/status")]
    [Authorize]
    public async Task<IActionResult> TwoFaStatus()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();
        var uid = _currentUserService.UserId.Value;

        var totpRecord = await _db.UserTotps.FirstOrDefaultAsync(t => t.UserId == uid);
        var codeCount = await _db.RecoveryCodes.CountAsync(rc => rc.UserId == uid && rc.UsedAt == null);
        var deviceCount = await _db.TrustedDevices.CountAsync(d => d.UserId == uid && d.ExpiresAt > DateTime.UtcNow);

        return Ok(new TwoFaStatusResponse(
            IsEnabled: totpRecord?.ConfirmedAt != null,
            RecoveryCodesRemaining: codeCount,
            TrustedDeviceCount: deviceCount));
    }

    [HttpPost("2fa/regenerate-codes")]
    [Authorize]
    [EnableRateLimiting("totp-limit")]
    public async Task<IActionResult> RegenerateRecoveryCodes([FromBody] RegenerateCodesRequest request)
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();
        var uid = _currentUserService.UserId.Value;

        var user = await _db.Users.FindAsync(uid);
        if (user == null) return NotFound();

        if (!_passwordHasher.VerifyPassword(request.Password ?? string.Empty, user.PasswordHash))
            return BadRequest(new { message = "Current password is incorrect." });

        var totpRecord = await _db.UserTotps.FirstOrDefaultAsync(t => t.UserId == uid && t.ConfirmedAt != null);
        if (totpRecord == null)
            return BadRequest(new { message = "2FA is not enabled on this account." });

        var valid = _totpService.VerifyCode(
            totpRecord.EncryptedSecret, totpRecord.Nonce, totpRecord.KeyVersion,
            request.Code ?? string.Empty, totpRecord.LastUsedStep, _totpOptions.Window,
            out var acceptedStep);

        if (!valid)
            return BadRequest(new { message = "Invalid code." });

        totpRecord.LastUsedStep = acceptedStep;

        // Invalidate old codes and generate new ones
        var oldCodes = await _db.RecoveryCodes.Where(rc => rc.UserId == uid).ToListAsync();
        _db.RecoveryCodes.RemoveRange(oldCodes);

        var rawCodes = _totpService.GenerateRecoveryCodes(_totpOptions.RecoveryCodeCount);
        foreach (var code in rawCodes)
        {
            _db.RecoveryCodes.Add(new RecoveryCode
            {
                UserId = uid,
                CodeHash = _totpService.HashRecoveryCode(code)
            });
        }
        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("TotpRecoveryCodesRegenerated", "User", uid.ToString());
        await TrySendEmailAsync(uid, "Recovery Codes Regenerated",
            "Your CampusCore 2FA recovery codes have been regenerated. If you did not do this, contact your administrator immediately.");

        return Ok(new { RecoveryCodes = rawCodes });
    }

    [HttpPost("2fa/forget-devices")]
    [Authorize]
    public async Task<IActionResult> ForgetTrustedDevices()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();
        var uid = _currentUserService.UserId.Value;

        await RevokeAllTrustedDevicesAsync(uid);
        await _auditLogService.LogAsync("TrustedDevicesRevoked", "User", uid.ToString());
        return Ok(new { message = "All trusted devices have been forgotten." });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ADMIN RESET 2FA (Principal only — step-up required)
    // ═══════════════════════════════════════════════════════════════════════

    [HttpPost("2fa/admin-reset")]
    [Authorize(Policy = "RequirePrincipal")]
    [EnableRateLimiting("totp-limit")]
    public async Task<IActionResult> AdminReset2fa([FromBody] AdminReset2faRequest request)
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();
        var principalId = _currentUserService.UserId.Value;

        // Step-up: verify the Principal's own current TOTP code
        var principalTotp = await _db.UserTotps
            .FirstOrDefaultAsync(t => t.UserId == principalId && t.ConfirmedAt != null);
        if (principalTotp == null)
            return BadRequest(new { message = "You must have 2FA enabled to reset another user's 2FA." });

        var valid = _totpService.VerifyCode(
            principalTotp.EncryptedSecret, principalTotp.Nonce, principalTotp.KeyVersion,
            request.PrincipalCode ?? string.Empty, principalTotp.LastUsedStep, _totpOptions.Window,
            out var acceptedStep);

        if (!valid)
            return BadRequest(new { message = "Invalid code." });

        principalTotp.LastUsedStep = acceptedStep;

        // Locate target user
        if (!Guid.TryParse(request.TargetUserId, out var targetId))
            return BadRequest(new { message = "Invalid target user ID." });

        var targetUser = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == targetId);

        if (targetUser == null) return NotFound(new { message = "User not found." });

        // Principals can only reset Teachers and Students (not other Principals)
        var targetRoles = targetUser.UserRoles.Select(ur => ur.Role.Name).ToList();
        if (targetRoles.Contains("Principal") && targetId != principalId)
            return Forbid();

        // Reset 2FA
        var targetTotp = await _db.UserTotps.FirstOrDefaultAsync(t => t.UserId == targetId);
        if (targetTotp != null) _db.UserTotps.Remove(targetTotp);

        var targetCodes = await _db.RecoveryCodes.Where(rc => rc.UserId == targetId).ToListAsync();
        _db.RecoveryCodes.RemoveRange(targetCodes);

        // Revoke all trusted devices
        await RevokeAllTrustedDevicesAsync(targetId);

        // Revoke all refresh tokens
        var refreshTokens = await _db.RefreshTokens.Where(rt => rt.UserId == targetId && !rt.IsRevoked).ToListAsync();
        foreach (var rt in refreshTokens) rt.IsRevoked = true;

        await _db.SaveChangesAsync();

        await _auditLogService.LogAsync("TotpAdminReset", "User", targetId.ToString(),
            null, new { resetBy = principalId });

        // Email notice to affected user (low priority, non-blocking)
        await TrySendEmailAsync(targetId, "2FA Reset by Administrator",
            $"Your CampusCore two-factor authentication has been reset by an administrator. You will be required to set it up again at your next login. If you have questions, contact your institution administrator.");

        return Ok(new { message = "2FA has been reset. The user will be required to re-enroll at next login." });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  REFRESH, LOGOUT, CHANGE-PASSWORD, KEEP-PASSWORD, FORGOT, RESET, ME
    //  (unchanged from previous version except ChangePassword revokes devices)
    // ═══════════════════════════════════════════════════════════════════════

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-limit")]
    public async Task<ActionResult<LoginResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var principal = _jwtService.GetPrincipalFromExpiredToken(request.AccessToken);
        if (principal == null)
            return BadRequest(new { message = "Invalid access token." });

        var userIdClaim = principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                          ?? principal.FindFirst("sub")?.Value;

        if (!Guid.TryParse(userIdClaim, out var userId)) return Unauthorized();

        var hashedToken = HashToken(request.RefreshToken);
        var savedRefreshToken = await _db.RefreshTokens
            .FirstOrDefaultAsync(r => r.UserId == userId && r.TokenHash == hashedToken);

        if (savedRefreshToken == null)
            return Unauthorized(new { message = "Refresh token is invalid or expired." });

        if (savedRefreshToken.IsRevoked)
        {
            // Token reuse detected — revoke all
            var allUserTokens = await _db.RefreshTokens
                .Where(r => r.UserId == userId && !r.IsRevoked).ToListAsync();
            foreach (var token in allUserTokens) token.IsRevoked = true;
            await _db.SaveChangesAsync();
            await _auditLogService.LogAsync("SecurityBreach", "User", userId.ToString(), null,
                new { reason = "Revoked refresh token reuse detected. All sessions revoked." });
            return Unauthorized(new { message = "Token reuse detected. All active sessions have been terminated." });
        }

        if (savedRefreshToken.ExpiresAt <= DateTime.UtcNow)
            return Unauthorized(new { message = "Refresh token is expired." });

        var user = await _db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null || !user.IsActive || user.IsDeleted)
            return Unauthorized(new { message = "User not found or inactive." });

        // Rotate
        savedRefreshToken.IsRevoked = true;
        var newRaw = _jwtService.GenerateRefreshToken();
        var newHash = HashToken(newRaw);
        savedRefreshToken.ReplacedByTokenHash = newHash;

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = newHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        });
        await _db.SaveChangesAsync();

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var newAccess = _jwtService.GenerateAccessToken(user, roles);

        return Ok(new LoginResponse(newAccess, newRaw, DateTime.UtcNow.AddMinutes(15), new UserDto
        {
            Id = user.Id, Email = user.Email, FirstName = user.FirstName, LastName = user.LastName,
            FullName = user.FullName, PhoneNumber = user.PhoneNumber, AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive, MustChangePassword = user.MustChangePassword, Roles = roles
        }));
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
            foreach (var t in tokens) t.IsRevoked = true;
            await _db.SaveChangesAsync();
            await _auditLogService.LogAsync("Logout", "User", _currentUserService.UserId.Value.ToString());
        }

        // Clear trusted-device cookie if present
        if (Request.Cookies.ContainsKey(TrustedDeviceCookieName))
            Response.Cookies.Delete(TrustedDeviceCookieName);

        return Ok(new { message = "Logged out successfully." });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<LoginResponse>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(new { message = "New password must be at least 6 characters long." });

        var user = await _db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == _currentUserService.UserId.Value);
        if (user == null) return NotFound();

        if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Current password is incorrect." });

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.DefaultPassword = request.NewPassword;
        user.MustChangePassword = false;
        user.LockoutEnd = null;
        user.AccessFailedCount = 0;

        // Revoke all refresh tokens
        var existingTokens = await _db.RefreshTokens
            .Where(r => r.UserId == user.Id && !r.IsRevoked).ToListAsync();
        foreach (var t in existingTokens) t.IsRevoked = true;

        // Revoke trusted devices on password change
        await RevokeAllTrustedDevicesAsync(user.Id);

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var newAccess = _jwtService.GenerateAccessToken(user, roles);
        var rawRefresh = _jwtService.GenerateRefreshToken();
        var refreshExpiry = DateTime.UtcNow.AddDays(7);

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawRefresh),
            ExpiresAt = refreshExpiry
        });
        await _db.SaveChangesAsync();

        try
        {
            await _notificationSender.QueueOutboxAsync(NotificationChannelType.Email, user.Email,
                "Your CampusCore Password Has Been Changed",
                $"<p>Hello <strong>{user.FirstName}</strong>,</p><p>Your CampusCore password was changed. If you did not do this, contact your administrator.</p>");
        }
        catch { /* Non-blocking */ }

        await _auditLogService.LogAsync("ChangePassword", "User", user.Id.ToString());

        return Ok(new LoginResponse(newAccess, rawRefresh, refreshExpiry, new UserDto
        {
            Id = user.Id, Email = user.Email, FirstName = user.FirstName, LastName = user.LastName,
            FullName = user.FullName, PhoneNumber = user.PhoneNumber, AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive, MustChangePassword = false, Roles = roles
        }));
    }

    [HttpPost("keep-password")]
    [Authorize]
    public async Task<ActionResult<LoginResponse>> KeepPassword()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var user = await _db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == _currentUserService.UserId.Value);
        if (user == null) return NotFound();

        user.MustChangePassword = false;

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var newAccess = _jwtService.GenerateAccessToken(user, roles);
        var rawRefresh = _jwtService.GenerateRefreshToken();
        var refreshExpiry = DateTime.UtcNow.AddDays(7);

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawRefresh),
            ExpiresAt = refreshExpiry
        });
        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("KeepPassword", "User", user.Id.ToString());

        return Ok(new LoginResponse(newAccess, rawRefresh, refreshExpiry, new UserDto
        {
            Id = user.Id, Email = user.Email, FirstName = user.FirstName, LastName = user.LastName,
            FullName = user.FullName, PhoneNumber = user.PhoneNumber, AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive, MustChangePassword = false, Roles = roles
        }));
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-limit")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());
        if (user != null && user.IsActive && !user.IsDeleted)
        {
            var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
            user.PasswordResetToken = HashToken(rawToken);
            user.PasswordResetTokenExpires = DateTime.UtcNow.AddMinutes(15);
            await _db.SaveChangesAsync();

            var resetUrl = $"/reset-password?email={Uri.EscapeDataString(user.Email)}&token={rawToken}";
            await _notificationSender.QueueOutboxAsync(NotificationChannelType.Email, user.Email,
                "Password Reset Code - CampusCore ERP",
                $@"<div style=""font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; color: #1e293b;"">
                    <h2 style=""color: #4f46e5;"">Password Reset</h2>
                    <p>Hello <strong>{user.FirstName}</strong>,</p>
                    <p>We received a request to reset your CampusCore password.</p>
                    <div style=""text-align: center; margin: 24px 0;"">
                        <span style=""font-size: 16px; font-weight: bold; color: #4f46e5; background: #e0e7ff; padding: 8px 16px; border-radius: 8px; font-family: monospace;"">{rawToken}</span>
                    </div>
                    <p style=""text-align: center;""><a href=""{resetUrl}"" style=""background-color: #4f46e5; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px;"">Reset Password</a></p>
                    <p style=""font-size: 12px; color: #64748b;"">This link expires in 15 minutes. Your 2FA settings are unaffected.</p>
                </div>");
        }
        // Generic response — never reveal whether email exists or has 2FA
        return Ok(new { message = "If the email exists, a password reset instruction has been dispatched." });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-limit")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters long." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());
        var tokenHash = !string.IsNullOrWhiteSpace(request.Token) ? HashToken(request.Token.Trim()) : null;

        if (user == null || string.IsNullOrWhiteSpace(user.PasswordResetToken) || tokenHash == null ||
            !string.Equals(user.PasswordResetToken, tokenHash, StringComparison.Ordinal) ||
            user.PasswordResetTokenExpires <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Invalid or expired reset token. Please request a new one." });
        }

        // NOTE: Password reset does NOT disable or bypass 2FA (per spec)
        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.DefaultPassword = request.NewPassword;
        user.MustChangePassword = false;
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpires = null;
        user.LockoutEnd = null;
        user.AccessFailedCount = 0;

        // Revoke refresh tokens
        var refreshTokens = await _db.RefreshTokens
            .Where(rt => rt.UserId == user.Id && !rt.IsRevoked).ToListAsync();
        foreach (var rt in refreshTokens) rt.IsRevoked = true;

        // Revoke trusted devices (password changed = re-auth required)
        await RevokeAllTrustedDevicesAsync(user.Id);

        await _db.SaveChangesAsync();

        try
        {
            await _notificationSender.QueueOutboxAsync(NotificationChannelType.Email, user.Email,
                "Your CampusCore Password Has Been Reset Successfully",
                $"<p>Hello <strong>{user.FirstName}</strong>,</p><p>Your CampusCore password was reset. Your 2FA settings are unchanged. <a href='/login'>Sign In</a></p>");
        }
        catch { /* Non-blocking */ }

        await _auditLogService.LogAsync("ResetPassword", "User", user.Id.ToString());
        return Ok(new { message = "Password reset successfully. You can now login with your new password." });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetCurrentUser()
    {
        if (!_currentUserService.UserId.HasValue) return Unauthorized();

        var user = await _db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == _currentUserService.UserId.Value);
        if (user == null) return NotFound();

        return Ok(new UserDto
        {
            Id = user.Id, Email = user.Email, FirstName = user.FirstName, LastName = user.LastName,
            FullName = user.FullName, PhoneNumber = user.PhoneNumber, AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive, MustChangePassword = user.MustChangePassword,
            Roles = user.UserRoles.Select(ur => ur.Role.Name).ToList()
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    private bool RoleRequiresTotp(IEnumerable<string> userRoles)
    {
        if (!_totpOptions.Enabled) return false;
        var required = _totpOptions.GetRequiredRoles();
        return userRoles.Any(r => required.Contains(r));
    }

    private async Task<bool> IsValidTrustedDevice(Guid userId)
    {
        if (_totpOptions.TrustedDeviceDays <= 0) return false;
        if (!Request.Cookies.TryGetValue(TrustedDeviceCookieName, out var rawToken) || string.IsNullOrEmpty(rawToken))
            return false;

        var hash = HashToken(rawToken);
        var device = await _db.TrustedDevices.FirstOrDefaultAsync(d =>
            d.UserId == userId && d.TokenHash == hash && d.ExpiresAt > DateTime.UtcNow);

        if (device == null) return false;

        device.LastUsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _auditLogService.LogAsync("TrustedDeviceUsed", "TrustedDevice", device.Id.ToString(),
            null, new { userId });
        return true;
    }

    private async Task CreateTrustedDeviceAsync(Guid userId)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var hash = HashToken(rawToken);
        var ua = Request.Headers.UserAgent.ToString();

        _db.TrustedDevices.Add(new TrustedDevice
        {
            UserId = userId,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(_totpOptions.TrustedDeviceDays),
            UserAgentSummary = ua.Length > 256 ? ua[..256] : ua
        });
        await _db.SaveChangesAsync();

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(_totpOptions.TrustedDeviceDays),
            Path = "/api/v1/auth"
        };
        Response.Cookies.Append(TrustedDeviceCookieName, rawToken, cookieOptions);
        await _auditLogService.LogAsync("TrustedDeviceCreated", "TrustedDevice", userId.ToString());
    }

    private async Task RevokeAllTrustedDevicesAsync(Guid userId)
    {
        await _db.TrustedDevices.Where(d => d.UserId == userId).ExecuteDeleteAsync();
    }

    private async Task<LoginChallenge?> ValidateChallengeAsync(string? challengeId, LoginChallengeType expectedType)
    {
        if (string.IsNullOrWhiteSpace(challengeId) || !Guid.TryParse(challengeId, out var id))
            return null;

        var challenge = await _db.LoginChallenges.FirstOrDefaultAsync(c =>
            c.Id == id &&
            c.Type == expectedType &&
            c.ExpiresAt > DateTime.UtcNow &&
            c.ConsumedAt == null);

        return challenge;
    }

    private async Task<LoginResponse> IssueTokensAsync(User user, List<string> roles)
    {
        var accessToken = _jwtService.GenerateAccessToken(user, roles);
        var rawRefresh = _jwtService.GenerateRefreshToken();
        var refreshExpiry = DateTime.UtcNow.AddDays(7);

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawRefresh),
            ExpiresAt = refreshExpiry
        });
        await _db.SaveChangesAsync();

        return new LoginResponse(accessToken, rawRefresh, DateTime.UtcNow.AddMinutes(15), new UserDto
        {
            Id = user.Id, Email = user.Email, FirstName = user.FirstName, LastName = user.LastName,
            FullName = user.FullName, PhoneNumber = user.PhoneNumber, AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive, MustChangePassword = user.MustChangePassword, Roles = roles
        });
    }

    private async Task IncrementAccountFailedCount(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return;
        user.AccessFailedCount++;
        if (user.AccessFailedCount >= 5)
        {
            user.LockoutEnd = DateTime.UtcNow.AddMinutes(15);
            await _auditLogService.LogAsync("AccountLockout", "User", userId.ToString(), null,
                new { reason = "5 failed 2FA attempts" });
        }
        await _db.SaveChangesAsync();
    }

    private async Task TrySendEmailAsync(Guid userId, string subject, string body)
    {
        try
        {
            var user = await _db.Users.FindAsync(userId);
            if (user == null) return;
            await _notificationSender.QueueOutboxAsync(NotificationChannelType.Email, user.Email,
                subject, $"<p>{body}</p>");
        }
        catch { /* Non-blocking — do not fail login for email errors */ }
    }

    private static string HashToken(string token)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }
}
