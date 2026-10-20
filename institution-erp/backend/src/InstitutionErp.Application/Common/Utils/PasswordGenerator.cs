using System.Linq;
using System.Security.Cryptography;

namespace InstitutionErp.Application.Common.Utils;

public static class PasswordGenerator
{
    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // excludes easily confused I, O
    private const string Lower = "abcdefghijkmnpqrstuvwxyz"; // excludes easily confused l, o
    private const string Digits = "23456789";               // excludes 0, 1
    private const string Special = "!@#$%*";
    private static readonly string All = Upper + Lower + Digits + Special;

    /// <summary>
    /// Generates a student portal password following the format:
    /// "firstthreelettersofname@123"
    /// Example: name="Priti" -> "pri@123"
    /// Example: name="Rahul" -> "rah@123"
    /// </summary>
    public static string GenerateStudentPassword(string? name)
    {
        var clean = new string((name ?? string.Empty).Where(char.IsLetter).ToArray()).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(clean))
        {
            clean = "stu";
        }
        var prefix = clean.Length >= 3 ? clean.Substring(0, 3) : clean.PadRight(3, 'x');
        return $"{prefix}@123";
    }

    /// <summary>
    /// Generates a teacher portal password following the format:
    /// "firstthreelettersofname$123"
    /// Example: name="Amit" -> "ami$123"
    /// Example: name="Komal" -> "kom$123"
    /// </summary>
    public static string GenerateTeacherPassword(string? name)
    {
        var clean = new string((name ?? string.Empty).Where(char.IsLetter).ToArray()).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(clean))
        {
            clean = "tch";
        }
        var prefix = clean.Length >= 3 ? clean.Substring(0, 3) : clean.PadRight(3, 'x');
        return $"{prefix}$123";
    }

    /// <summary>
    /// Generates a cryptographically strong, human-readable temporary password (14+ chars)
    /// guaranteed to contain uppercase, lowercase, numeric, and special characters.
    /// Excludes ambiguous characters (0, O, l, 1, I).
    /// </summary>
    public static string Generate(int length = 14)
    {
        if (length < 14) length = 14;

        var result = new char[length];
        // Ensure at least one from each required set
        result[0] = Upper[RandomNumberGenerator.GetInt32(Upper.Length)];
        result[1] = Lower[RandomNumberGenerator.GetInt32(Lower.Length)];
        result[2] = Digits[RandomNumberGenerator.GetInt32(Digits.Length)];
        result[3] = Special[RandomNumberGenerator.GetInt32(Special.Length)];

        for (int i = 4; i < length; i++)
        {
            result[i] = All[RandomNumberGenerator.GetInt32(All.Length)];
        }

        // Cryptographic Fisher-Yates shuffle
        for (int i = length - 1; i > 0; i--)
        {
            int j = RandomNumberGenerator.GetInt32(i + 1);
            (result[i], result[j]) = (result[j], result[i]);
        }

        return new string(result);
    }
}

