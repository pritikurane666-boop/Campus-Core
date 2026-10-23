using FluentAssertions;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Infrastructure.Auth;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace InstitutionErp.UnitTests;

public class EmailOtpServiceTests
{
    private readonly Mock<INotificationSender> _notificationSenderMock;
    private readonly EmailOtpService _service;

    public EmailOtpServiceTests()
    {
        _notificationSenderMock = new Mock<INotificationSender>();
        _service = new EmailOtpService(_notificationSenderMock.Object, NullLogger<EmailOtpService>.Instance);
    }

    [Fact]
    public void GenerateOtpCode_ReturnsSixNumericDigits()
    {
        for (int i = 0; i < 50; i++)
        {
            var code = _service.GenerateOtpCode();
            code.Should().HaveLength(6);
            code.Should().MatchRegex(@"^\d{6}$");
            int.Parse(code).Should().BeInRange(100000, 999999);
        }
    }

    [Fact]
    public void HashOtp_ReturnsSha256Hex()
    {
        var code = "123456";
        var hash = _service.HashOtp(code);

        hash.Should().HaveLength(64);
        hash.Should().MatchRegex(@"^[0-9A-Fa-f]{64}$");

        // Idempotent
        _service.HashOtp(code).Should().Be(hash);
    }

    [Fact]
    public void VerifyOtp_ReturnsTrue_ForCorrectCode()
    {
        var code = "654321";
        var hash = _service.HashOtp(code);

        _service.VerifyOtp(code, hash).Should().BeTrue();
    }

    [Fact]
    public void VerifyOtp_ReturnsFalse_ForIncorrectCode()
    {
        var hash = _service.HashOtp("123456");

        _service.VerifyOtp("654321", hash).Should().BeFalse();
        _service.VerifyOtp("", hash).Should().BeFalse();
        _service.VerifyOtp("12345", hash).Should().BeFalse();
        _service.VerifyOtp("abcdef", hash).Should().BeFalse();
    }

    [Theory]
    [InlineData("admin@gmail.com", "a***n@gmail.com")]
    [InlineData("test@domain.org", "t**t@domain.org")]
    [InlineData("ab@domain.com", "a*@domain.com")]
    [InlineData("a@domain.com", "a*@domain.com")]
    public void MaskEmail_CorrectlyMasksEmailAddresses(string input, string expected)
    {
        _service.MaskEmail(input).Should().Be(expected);
    }

    [Fact]
    public async Task SendOtpEmailAsync_CallsQueueOutbox()
    {
        await _service.SendOtpEmailAsync("admin@gmail.com", "Admin User", "492018", 10);

        _notificationSenderMock.Verify(s => s.QueueOutboxAsync(
            InstitutionErp.Domain.Enums.NotificationChannelType.Email,
            "admin@gmail.com",
            It.Is<string>(subject => subject.Contains("492018")),
            It.Is<string>(body => body.Contains("492018") && body.Contains("Admin User")),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()
        ), Times.Once);
    }
}
