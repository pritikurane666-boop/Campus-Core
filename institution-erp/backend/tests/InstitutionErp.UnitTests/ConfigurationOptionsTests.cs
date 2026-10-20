using System.ComponentModel.DataAnnotations;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Infrastructure.Auth;
using InstitutionErp.Infrastructure.Payment;

namespace InstitutionErp.UnitTests;

public class ConfigurationOptionsTests
{
    [Fact]
    public void JwtOptions_FailsValidation_WhenSecretIsLessThan32Chars()
    {
        var options = new JwtOptions
        {
            Secret = "TooShortSecretKey123",
            Issuer = "InstitutionErp",
            Audience = "InstitutionErpApp"
        };

        var context = new ValidationContext(options);
        var results = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(options, context, results, true);

        isValid.Should().BeFalse();
        results.Should().Contain(r => r.ErrorMessage != null && r.ErrorMessage.Contains("at least 32 characters"));
    }

    [Fact]
    public void JwtOptions_PassesValidation_WhenSecretIsAtLeast32Chars()
    {
        var options = new JwtOptions
        {
            Secret = "CryptographicallySecureKeyWith32CharsMinimumLength!",
            Issuer = "InstitutionErp",
            Audience = "InstitutionErpApp"
        };

        var context = new ValidationContext(options);
        var results = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(options, context, results, true);

        isValid.Should().BeTrue();
    }

    [Fact]
    public void AdminOptions_FailsValidation_WhenEmailIsInvalid()
    {
        var options = new AdminOptions
        {
            Email = "not-an-email",
            Password = "ValidPassword123!"
        };

        var context = new ValidationContext(options);
        var results = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(options, context, results, true);

        isValid.Should().BeFalse();
        results.Should().Contain(r => r.ErrorMessage != null && r.ErrorMessage.Contains("valid email"));
    }

    [Fact]
    public void RazorpayGateway_FailsClosed_WhenDisabled()
    {
        var options = Options.Create(new PaymentOptions
        {
            Razorpay = new RazorpayOptions { Enabled = false }
        });

        var gateway = new RazorpayPaymentGateway(options, NullLogger<RazorpayPaymentGateway>.Instance);

        // VerifySignature must return false when disabled
        var isValid = gateway.VerifySignature("order_123", "pay_123", "mock_signature");
        isValid.Should().BeFalse();

        // CreateOrderAsync must throw NotSupportedException when disabled
        var act = () => gateway.CreateOrderAsync(1000m, "REC-001");
        act.Should().ThrowAsync<NotSupportedException>();
    }

    [Fact]
    public void JwtTokenService_Throws_WhenSecretIsMissing()
    {
        var options = Options.Create(new JwtOptions
        {
            Secret = "",
            Issuer = "InstitutionErp",
            Audience = "InstitutionErpApp"
        });

        var service = new JwtTokenService(options);
        var user = new User { Id = Guid.NewGuid(), Email = "user@institution.edu", FirstName = "Test", LastName = "User" };

        var act = () => service.GenerateAccessToken(user, new[] { "Student" });
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Jwt:Secret*");
    }
}
