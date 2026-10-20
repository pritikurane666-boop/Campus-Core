using System.Security.Claims;
using FluentAssertions;
using InstitutionErp.Application.Common.Utils;
using InstitutionErp.Application.DTOs;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Infrastructure.Auth;
using Xunit;

namespace InstitutionErp.UnitTests;

public class AuthSecurityTests
{
    private readonly PasswordHasher _hasher = new();

    [Fact]
    public void PasswordHasher_HashesAndVerifiesCorrectly()
    {
        var password = PasswordGenerator.Generate(14);
        var hash = _hasher.HashPassword(password);

        hash.Should().NotBeNullOrWhiteSpace();
        hash.Should().StartWith("$2"); // BCrypt prefix
        _hasher.VerifyPassword(password, hash).Should().BeTrue();
        _hasher.VerifyPassword("WrongPassword123!", hash).Should().BeFalse();
    }

    [Fact]
    public void PasswordHasher_GeneratesWorkFactor12Hash()
    {
        var password = "SecureTestPassword123!";
        var hash = _hasher.HashPassword(password);

        // BCrypt format: $2a$12$... or $2b$12$...
        var parts = hash.Split('$');
        parts.Length.Should().BeGreaterThanOrEqualTo(3);
        parts[2].Should().Be("12", "BCrypt enhanced work factor must be 12");
    }

    [Fact]
    public void UserEntity_HasMustChangePasswordDefaultFalse()
    {
        var user = new User
        {
            Email = "test@campuscore.edu",
            FirstName = "Test",
            LastName = "User"
        };

        user.MustChangePassword.Should().BeFalse();
    }

    [Fact]
    public void CredentialSlip_ConstructsWithRequiredSecurityAttributes()
    {
        var slip = new CredentialSlipDto
        {
            UserId = Guid.NewGuid(),
            Email = "student@campuscore.edu",
            FullName = "Jane Doe",
            Role = "Student",
            TemporaryPassword = PasswordGenerator.Generate(14),
            MustChangePassword = true,
            Identifier = "2026-CLS-0001",
            GeneratedAtUtc = DateTime.UtcNow
        };

        slip.TemporaryPassword.Length.Should().BeGreaterThanOrEqualTo(14);
        slip.MustChangePassword.Should().BeTrue();
        slip.Identifier.Should().Be("2026-CLS-0001");
        slip.Role.Should().Be("Student");
    }
}
