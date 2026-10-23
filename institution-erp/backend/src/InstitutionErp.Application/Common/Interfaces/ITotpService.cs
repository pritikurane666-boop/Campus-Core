namespace InstitutionErp.Application.Common.Interfaces;

/// <summary>
/// TOTP (RFC 6238) service: secret generation, URI building, code verification,
/// AES-256-GCM encryption/decryption, and recovery code management.
/// Never writes its own crypto for TOTP — uses Otp.NET.
/// </summary>
public interface ITotpService
{
    /// <summary>
    /// Generates 20 cryptographically random bytes, base32-encodes them,
    /// and returns the base32 string (without padding). This is the raw secret
    /// to embed in the otpauth URI and encrypt for storage.
    /// </summary>
    string GenerateBase32Secret();

    /// <summary>
    /// Builds the otpauth URI per spec:
    /// otpauth://totp/{issuer}:{email}?secret={base32}&amp;issuer={issuer}&amp;algorithm=SHA1&amp;digits=6&amp;period=30
    /// </summary>
    string BuildOtpAuthUri(string email, string base32Secret, string issuer);

    /// <summary>
    /// Decrypts the stored secret, computes the valid codes for the ±window steps
    /// around the current UTC time, and verifies the incoming code in constant time.
    /// Also enforces anti-replay via lastUsedStep.
    /// </summary>
    /// <param name="encryptedSecret">AES-256-GCM ciphertext from DB.</param>
    /// <param name="nonce">12-byte GCM nonce from DB.</param>
    /// <param name="keyVersion">Key version for rotation support.</param>
    /// <param name="code">The 6-digit code supplied by the user.</param>
    /// <param name="lastUsedStep">The last accepted time step from DB. -1 if never used.</param>
    /// <param name="window">Number of steps before and after current to accept.</param>
    /// <param name="acceptedStep">The step that matched (for storing as new LastUsedStep).</param>
    /// <returns>True if the code is valid and not a replay.</returns>
    bool VerifyCode(
        byte[] encryptedSecret,
        byte[] nonce,
        int keyVersion,
        string code,
        long lastUsedStep,
        int window,
        out long acceptedStep);

    /// <summary>Encrypts a base32 secret with AES-256-GCM using a random 12-byte nonce.</summary>
    (byte[] Encrypted, byte[] Nonce) EncryptSecret(string base32Secret, int keyVersion);

    /// <summary>Decrypts a base32 secret from AES-256-GCM ciphertext.</summary>
    string DecryptSecret(byte[] encrypted, byte[] nonce, int keyVersion);

    /// <summary>
    /// Generates <paramref name="count"/> single-use recovery codes using CSPRNG.
    /// Each code uses 8–10 characters from an unambiguous alphabet (no 0,O,1,I,l).
    /// </summary>
    string[] GenerateRecoveryCodes(int count);

    /// <summary>
    /// Returns the SHA-256 hex digest of a recovery code (upper-cased, trimmed).
    /// Used for constant-time storage and comparison.
    /// </summary>
    string HashRecoveryCode(string code);

    /// <summary>
    /// Verifies a raw recovery code against a list of stored hashes in constant time.
    /// Returns the matching hash if valid, null otherwise.
    /// </summary>
    string? VerifyRecoveryCode(string rawCode, IEnumerable<string> storedHashes);
}
