using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using OtpNet;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Application.Common.Interfaces;

namespace InstitutionErp.Infrastructure.Auth;

/// <summary>
/// TOTP service implementation using Otp.NET (MIT licence, no custom crypto).
/// Secret encryption: AES-256-GCM with random 12-byte nonce per record.
/// Recovery codes: 8-char CSPRNG from unambiguous alphabet.
/// All verifications use constant-time comparison (CryptographicOperations.FixedTimeEquals).
/// NEVER logs secrets, URIs, or codes.
/// </summary>
public sealed class TotpService : ITotpService
{
    // Unambiguous alphabet: excludes 0,O,I,1,l to avoid visual confusion
    private const string RecoveryAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const int RecoveryCodeLength = 8;
    private const int NonceSizeBytes = 12;  // GCM standard nonce
    private const int SecretBytes = 20;     // RFC 6238 recommended

    private readonly TotpOptions _options;

    public TotpService(IOptions<TotpOptions> options)
    {
        _options = options.Value;
    }

    // ─── Secret generation ───────────────────────────────────────────────────

    /// <inheritdoc/>
    public string GenerateBase32Secret()
    {
        var rawBytes = RandomNumberGenerator.GetBytes(SecretBytes);
        // OtpNet.Base32Encoding.ToString produces standard base32 without padding
        return Base32Encoding.ToString(rawBytes);
    }

    // ─── OtpAuth URI ─────────────────────────────────────────────────────────

    /// <inheritdoc/>
    public string BuildOtpAuthUri(string email, string base32Secret, string issuer)
    {
        // Format: otpauth://totp/{issuer}:{email}?secret={base32}&issuer={issuer}&algorithm=SHA1&digits=6&period=30
        var label = Uri.EscapeDataString($"{issuer}:{email}");
        var secret = Uri.EscapeDataString(base32Secret);
        var issuerEncoded = Uri.EscapeDataString(issuer);
        return $"otpauth://totp/{label}?secret={secret}&issuer={issuerEncoded}&algorithm=SHA1&digits=6&period=30";
    }

    // ─── TOTP Code Verification ──────────────────────────────────────────────

    /// <inheritdoc/>
    public bool VerifyCode(
        byte[] encryptedSecret,
        byte[] nonce,
        int keyVersion,
        string code,
        long lastUsedStep,
        int window,
        out long acceptedStep)
    {
        acceptedStep = -1;

        if (string.IsNullOrWhiteSpace(code) || code.Length != 6)
            return false;

        string base32Secret;
        try
        {
            base32Secret = DecryptSecret(encryptedSecret, nonce, keyVersion);
        }
        catch
        {
            return false;
        }

        byte[] secretBytes;
        try
        {
            secretBytes = Base32Encoding.ToBytes(base32Secret);
        }
        catch
        {
            return false;
        }

        var totp = new Totp(secretBytes, step: 30, mode: OtpHashMode.Sha1, totpSize: 6);
        var currentStep = GetCurrentStep();

        // Encode the user-supplied code as bytes for constant-time comparison
        var codeBytes = Encoding.ASCII.GetBytes(code.Trim());

        for (var offset = -window; offset <= window; offset++)
        {
            var candidateStep = currentStep + offset;

            // Anti-replay: step must be strictly greater than the last accepted step
            if (candidateStep <= lastUsedStep)
                continue;

            var candidateCode = totp.ComputeTotp(StepToUtc(candidateStep));
            var candidateBytes = Encoding.ASCII.GetBytes(candidateCode);

            if (codeBytes.Length == candidateBytes.Length &&
                CryptographicOperations.FixedTimeEquals(codeBytes, candidateBytes))
            {
                acceptedStep = candidateStep;
                return true;
            }
        }

        return false;
    }

    // ─── Encryption / Decryption ─────────────────────────────────────────────

    /// <inheritdoc/>
    public (byte[] Encrypted, byte[] Nonce) EncryptSecret(string base32Secret, int keyVersion)
    {
        var keyBytes = _options.GetEncryptionKeyBytes();
        var nonce = RandomNumberGenerator.GetBytes(NonceSizeBytes);
        var plaintext = Encoding.UTF8.GetBytes(base32Secret);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[16]; // GCM auth tag

        using var aes = new AesGcm(keyBytes, 16);
        aes.Encrypt(nonce, plaintext, ciphertext, tag);

        // Store ciphertext + tag concatenated so we can split on decrypt
        var combined = new byte[ciphertext.Length + tag.Length];
        ciphertext.CopyTo(combined, 0);
        tag.CopyTo(combined, ciphertext.Length);

        return (combined, nonce);
    }

    /// <inheritdoc/>
    public string DecryptSecret(byte[] encrypted, byte[] nonce, int keyVersion)
    {
        if (encrypted.Length < 17)
            throw new InvalidOperationException("Encrypted payload is too short.");

        var keyBytes = _options.GetEncryptionKeyBytes();
        var tagOffset = encrypted.Length - 16;
        var ciphertext = encrypted[..tagOffset];
        var tag = encrypted[tagOffset..];
        var plaintext = new byte[ciphertext.Length];

        using var aes = new AesGcm(keyBytes, 16);
        aes.Decrypt(nonce, ciphertext, tag, plaintext);

        return Encoding.UTF8.GetString(plaintext);
    }

    // ─── Recovery Codes ──────────────────────────────────────────────────────

    /// <inheritdoc/>
    public string[] GenerateRecoveryCodes(int count)
    {
        var codes = new string[count];
        for (var i = 0; i < count; i++)
        {
            var buf = RandomNumberGenerator.GetBytes(RecoveryCodeLength);
            var sb = new char[RecoveryCodeLength];
            for (var j = 0; j < RecoveryCodeLength; j++)
            {
                sb[j] = RecoveryAlphabet[buf[j] % RecoveryAlphabet.Length];
            }
            codes[i] = new string(sb);
        }
        return codes;
    }

    /// <inheritdoc/>
    public string HashRecoveryCode(string code)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    /// <inheritdoc/>
    public string? VerifyRecoveryCode(string rawCode, IEnumerable<string> storedHashes)
    {
        var targetHash = HashRecoveryCode(rawCode);
        var targetBytes = Encoding.UTF8.GetBytes(targetHash);

        foreach (var stored in storedHashes)
        {
            var storedBytes = Encoding.UTF8.GetBytes(stored);
            if (targetBytes.Length == storedBytes.Length &&
                CryptographicOperations.FixedTimeEquals(targetBytes, storedBytes))
            {
                return stored;
            }
        }

        return null;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /// <summary>Returns the current 30-second time step as a Unix integer.</summary>
    private static long GetCurrentStep()
        => DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;

    /// <summary>Converts a step index back to the UTC DateTime it represents.</summary>
    private static DateTime StepToUtc(long step)
        => DateTimeOffset.FromUnixTimeSeconds(step * 30).UtcDateTime;
}
