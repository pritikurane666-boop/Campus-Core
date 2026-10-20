using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using Xunit;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Notifications;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.UnitTests;

public class BrevoEmailChannelTests
{
    private readonly Mock<ILogger<BrevoEmailChannel>> _loggerMock = new();
    private readonly List<string> _loggedMessages = new();

    public BrevoEmailChannelTests()
    {
        BrevoEmailChannel.ResetDailyCount();

        // Capture all log messages to verify API key and body are never logged
        _loggerMock.Setup(l => l.Log(
            It.IsAny<LogLevel>(),
            It.IsAny<EventId>(),
            It.IsAny<It.IsAnyType>(),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
            .Callback(new InvocationAction(invocation =>
            {
                var state = invocation.Arguments[2];
                var exception = invocation.Arguments[3] as Exception;
                _loggedMessages.Add(state?.ToString() ?? string.Empty);
                if (exception != null)
                {
                    _loggedMessages.Add(exception.Message);
                }
            }));
    }

    private (BrevoEmailChannel Channel, Mock<HttpMessageHandler> HandlerMock) CreateChannel(
        EmailOptions options,
        HttpResponseMessage? cannedResponse = null,
        Exception? cannedException = null)
    {
        var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);

        if (cannedException != null)
        {
            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ThrowsAsync(cannedException);
        }
        else
        {
            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(cannedResponse ?? new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"messageId\":\"<test-123@smtp-relay.mailin.fr>\"}", Encoding.UTF8, "application/json")
                });
        }

        var client = new HttpClient(handlerMock.Object);
        var factoryMock = new Mock<IHttpClientFactory>();
        factoryMock.Setup(f => f.CreateClient("Brevo")).Returns(client);

        var channel = new BrevoEmailChannel(factoryMock.Object, Options.Create(options), _loggerMock.Object);
        return (channel, handlerMock);
    }

    [Fact]
    public async Task SendAsync_OnHttp2xx_SendsPostWithHeaderAndPayload_ReturnsTrue()
    {
        // Arrange
        var options = new EmailOptions
        {
            Provider = "Brevo",
            ApiKey = "xkeysib-secret-1234567890",
            FromAddress = "sender@institution.edu",
            FromName = "Institution ERP",
            DailyLimit = 300
        };

        HttpRequestMessage? capturedRequest = null;
        string? capturedBody = null;

        var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) =>
            {
                capturedRequest = req;
                capturedBody = req.Content?.ReadAsStringAsync().GetAwaiter().GetResult();
            })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = new StringContent("{\"messageId\":\"msg-001\"}", Encoding.UTF8, "application/json")
            });

        var client = new HttpClient(handlerMock.Object);
        var factoryMock = new Mock<IHttpClientFactory>();
        factoryMock.Setup(f => f.CreateClient("Brevo")).Returns(client);

        var channel = new BrevoEmailChannel(factoryMock.Object, Options.Create(options), _loggerMock.Object);

        // Act
        var result = await channel.SendAsync("student@campus.edu", "Welcome Subject", "<p>Welcome Body</p>");

        // Assert
        result.Should().BeTrue();
        capturedRequest.Should().NotBeNull();
        capturedRequest!.Method.Should().Be(HttpMethod.Post);
        capturedRequest.RequestUri.Should().Be(new Uri("https://api.brevo.com/v3/smtp/email"));

        // Header api-key: <key> (not Bearer)
        capturedRequest.Headers.Contains("api-key").Should().BeTrue();
        capturedRequest.Headers.GetValues("api-key").Should().ContainSingle().Which.Should().Be("xkeysib-secret-1234567890");
        capturedRequest.Headers.Authorization.Should().BeNull();

        // JSON payload format: sender {name, email}, to [{email}], subject, htmlContent
        using var doc = JsonDocument.Parse(capturedBody!);
        var root = doc.RootElement;
        root.GetProperty("sender").GetProperty("name").GetString().Should().Be("Institution ERP");
        root.GetProperty("sender").GetProperty("email").GetString().Should().Be("sender@institution.edu");
        root.GetProperty("to")[0].GetProperty("email").GetString().Should().Be("student@campus.edu");
        root.GetProperty("subject").GetString().Should().Be("Welcome Subject");
        root.GetProperty("htmlContent").GetString().Should().Be("<p>Welcome Body</p>");
    }

    [Fact]
    public async Task SendAsync_OnHttp429_ReturnsFalseForRetry()
    {
        // Arrange
        var options = new EmailOptions { Provider = "Brevo", ApiKey = "mock-key", DailyLimit = 300 };
        var response = new HttpResponseMessage((HttpStatusCode)429)
        {
            Content = new StringContent("{\"message\":\"Too many requests\"}")
        };
        var (channel, _) = CreateChannel(options, cannedResponse: response);

        // Act
        var result = await channel.SendAsync("test@campus.edu", "Subject", "Body");

        // Assert
        result.Should().BeFalse();
        channel.LastErrorMessage.Should().Be("HTTP 429");
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError, 500)]
    [InlineData(HttpStatusCode.BadGateway, 502)]
    [InlineData(HttpStatusCode.ServiceUnavailable, 503)]
    public async Task SendAsync_OnHttp5xx_ReturnsFalseForRetry(HttpStatusCode statusCode, int codeNumber)
    {
        // Arrange
        var options = new EmailOptions { Provider = "Brevo", ApiKey = "mock-key", DailyLimit = 300 };
        var response = new HttpResponseMessage(statusCode)
        {
            Content = new StringContent("{\"message\":\"Temporary server error\"}")
        };
        var (channel, _) = CreateChannel(options, cannedResponse: response);

        // Act
        var result = await channel.SendAsync("test@campus.edu", "Subject", "Body");

        // Assert
        result.Should().BeFalse();
        channel.LastErrorMessage.Should().Be($"HTTP {codeNumber}");
    }

    [Fact]
    public async Task SendAsync_OnNetworkErrorOrTimeout_ReturnsFalseForRetry()
    {
        // Arrange
        var options = new EmailOptions { Provider = "Brevo", ApiKey = "mock-key", DailyLimit = 300 };
        var (channel, _) = CreateChannel(options, cannedException: new HttpRequestException("Connection reset"));

        // Act
        var result = await channel.SendAsync("test@campus.edu", "Subject", "Body");

        // Assert
        result.Should().BeFalse();
        channel.LastErrorMessage.Should().Be("Network error");
    }

    [Fact]
    public async Task SendAsync_OnTimeoutException_ReturnsFalseForRetry()
    {
        // Arrange
        var options = new EmailOptions { Provider = "Brevo", ApiKey = "mock-key", DailyLimit = 300 };
        var (channel, _) = CreateChannel(options, cannedException: new TimeoutException("The request timed out."));

        // Act
        var result = await channel.SendAsync("test@campus.edu", "Subject", "Body");

        // Assert
        result.Should().BeFalse();
        channel.LastErrorMessage.Should().Be("Timeout");
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, 400)]
    [InlineData(HttpStatusCode.Unauthorized, 401)]
    [InlineData(HttpStatusCode.Forbidden, 403)]
    [InlineData(HttpStatusCode.NotFound, 404)]
    public async Task SendAsync_OnPermanent4xx_ThrowsPermanentFailureException_WithStatusOnly(HttpStatusCode statusCode, int codeNumber)
    {
        // Arrange
        var options = new EmailOptions { Provider = "Brevo", ApiKey = "mock-key", DailyLimit = 300 };
        var response = new HttpResponseMessage(statusCode)
        {
            Content = new StringContent("{\"error\":\"detailed sensitive server trace or error body\"}")
        };
        var (channel, _) = CreateChannel(options, cannedResponse: response);

        // Act
        Func<Task> act = async () => await channel.SendAsync("test@campus.edu", "Subject", "Body");

        // Assert
        var ex = await act.Should().ThrowAsync<PermanentFailureException>();
        ex.Which.Message.Should().Be($"HTTP {codeNumber}");
        ex.Which.Message.Should().NotContain("detailed sensitive server trace");
        channel.LastErrorMessage.Should().Be($"HTTP {codeNumber}");
    }

    [Fact]
    public async Task SendAsync_WhenDailyCapReached_ThrowsDailyLimitExceededException_DoesNotCallBrevo()
    {
        // Arrange
        var options = new EmailOptions
        {
            Provider = "Brevo",
            ApiKey = "mock-key",
            DailyLimit = 2
        };

        var (channel, handlerMock) = CreateChannel(options);

        // Act: First 2 succeed
        var res1 = await channel.SendAsync("recipient1@test.com", "Subj 1", "Body 1");
        var res2 = await channel.SendAsync("recipient2@test.com", "Subj 2", "Body 2");

        res1.Should().BeTrue();
        res2.Should().BeTrue();

        // 3rd call exceeds limit
        Func<Task> act = async () => await channel.SendAsync("recipient3@test.com", "Subj 3", "Body 3");

        // Assert
        await act.Should().ThrowAsync<DailyLimitExceededException>()
            .WithMessage("*daily limit of 2 reached*");

        // Verify Brevo API was only called 2 times
        handlerMock.Protected().Verify(
            "SendAsync",
            Times.Exactly(2),
            ItExpr.IsAny<HttpRequestMessage>(),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task BrevoEmailChannel_NeverLogsApiKeyOrEmailBodies()
    {
        // Arrange
        const string secretApiKey = "super-secret-brevo-key-999999999";
        const string secretEmailBody = "SECRET_PASSCODE_123456_CONFIDENTIAL";

        var options = new EmailOptions
        {
            Provider = "Brevo",
            ApiKey = secretApiKey,
            FromAddress = "test@institution.edu",
            DailyLimit = 300
        };

        var (channel, _) = CreateChannel(options);

        // Act
        await channel.SendAsync("user@campus.edu", "Confidential Subject", secretEmailBody);

        // Assert
        _loggedMessages.Should().NotBeEmpty();
        foreach (var msg in _loggedMessages)
        {
            msg.Should().NotContain(secretApiKey, "API key must NEVER appear in logs");
            msg.Should().NotContain(secretEmailBody, "Email body must NEVER appear in logs");
        }
    }

    [Fact]
    public async Task NotificationOutboxWorker_WhenDailyLimitReachedInDb_LeavesItemPendingWithoutSending()
    {
        // Arrange: In-memory DB with Sent email items today equal to DailyLimit
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var db = new ApplicationDbContext(dbOptions);

        var todayUtc = DateTime.UtcNow.Date;
        // Seed 2 sent emails today
        db.NotificationOutboxes.AddRange(
            new NotificationOutbox
            {
                Channel = NotificationChannelType.Email,
                Recipient = "sent1@test.com",
                Subject = "Sent 1",
                Body = "Body 1",
                Status = NotificationStatus.Sent,
                ProcessedAt = todayUtc.AddHours(2)
            },
            new NotificationOutbox
            {
                Channel = NotificationChannelType.Email,
                Recipient = "sent2@test.com",
                Subject = "Sent 2",
                Body = "Body 2",
                Status = NotificationStatus.Sent,
                ProcessedAt = todayUtc.AddHours(4)
            }
        );

        // Pending item that should be deferred due to DailyLimit = 2
        var pendingItem = new NotificationOutbox
        {
            Channel = NotificationChannelType.Email,
            Recipient = "pending@test.com",
            Subject = "Pending Subj",
            Body = "Pending Body",
            Status = NotificationStatus.Pending,
            CreatedAt = todayUtc.AddHours(5)
        };
        db.NotificationOutboxes.Add(pendingItem);
        await db.SaveChangesAsync();

        var channelMock = new Mock<INotificationChannel>();
        channelMock.Setup(c => c.Channel).Returns(NotificationChannelType.Email);

        var serviceProviderMock = new Mock<IServiceProvider>();
        var scopeMock = new Mock<IServiceScope>();
        var scopeProviderMock = new Mock<IServiceProvider>();

        scopeProviderMock.Setup(sp => sp.GetService(typeof(ApplicationDbContext))).Returns(db);
        scopeProviderMock.Setup(sp => sp.GetService(typeof(IEnumerable<INotificationChannel>)))
            .Returns(new List<INotificationChannel> { channelMock.Object });
        scopeMock.Setup(s => s.ServiceProvider).Returns(scopeProviderMock.Object);

        var scopeFactoryMock = new Mock<IServiceScopeFactory>();
        scopeFactoryMock.Setup(sf => sf.CreateScope()).Returns(scopeMock.Object);
        serviceProviderMock.Setup(sp => sp.GetService(typeof(IServiceScopeFactory))).Returns(scopeFactoryMock.Object);

        var workerLoggerMock = new Mock<ILogger<NotificationOutboxWorker>>();
        var emailOptions = Options.Create(new EmailOptions { DailyLimit = 2 });

        var worker = new NotificationOutboxWorker(serviceProviderMock.Object, workerLoggerMock.Object, emailOptions);

        // Act: Execute worker cancellation after 1 loop
        using var cts = new CancellationTokenSource();
        cts.CancelAfter(TimeSpan.FromMilliseconds(500));
        await worker.StartAsync(cts.Token);
        await Task.Delay(150);
        await worker.StopAsync(CancellationToken.None);

        // Assert
        var reloaded = await db.NotificationOutboxes.FindAsync(pendingItem.Id);
        reloaded.Should().NotBeNull();
        reloaded!.Status.Should().Be(NotificationStatus.Pending, "Item must remain Pending and NOT marked Failed");
        reloaded.NextRetryAt.Should().BeAfter(DateTime.UtcNow, "Item NextRetryAt should be set to tomorrow after daily reset");
        reloaded.ErrorMessage.Should().Contain("daily limit");

        // Verify channel.SendAsync was NOT called
        channelMock.Verify(c => c.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task NotificationOutboxWorker_OnPermanentFailureException_MarksFailedImmediately()
    {
        // Arrange
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var db = new ApplicationDbContext(dbOptions);

        var pendingItem = new NotificationOutbox
        {
            Channel = NotificationChannelType.Email,
            Recipient = "bad@test.com",
            Subject = "Subject",
            Body = "Body",
            Status = NotificationStatus.Pending,
            RetryCount = 0
        };
        db.NotificationOutboxes.Add(pendingItem);
        await db.SaveChangesAsync();

        var channelMock = new Mock<INotificationChannel>();
        channelMock.Setup(c => c.Channel).Returns(NotificationChannelType.Email);
        channelMock.Setup(c => c.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new PermanentFailureException(400));

        var serviceProviderMock = new Mock<IServiceProvider>();
        var scopeMock = new Mock<IServiceScope>();
        var scopeProviderMock = new Mock<IServiceProvider>();

        scopeProviderMock.Setup(sp => sp.GetService(typeof(ApplicationDbContext))).Returns(db);
        scopeProviderMock.Setup(sp => sp.GetService(typeof(IEnumerable<INotificationChannel>)))
            .Returns(new List<INotificationChannel> { channelMock.Object });
        scopeMock.Setup(s => s.ServiceProvider).Returns(scopeProviderMock.Object);

        var scopeFactoryMock = new Mock<IServiceScopeFactory>();
        scopeFactoryMock.Setup(sf => sf.CreateScope()).Returns(scopeMock.Object);
        serviceProviderMock.Setup(sp => sp.GetService(typeof(IServiceScopeFactory))).Returns(scopeFactoryMock.Object);

        var workerLoggerMock = new Mock<ILogger<NotificationOutboxWorker>>();
        var emailOptions = Options.Create(new EmailOptions { DailyLimit = 300 });

        var worker = new NotificationOutboxWorker(serviceProviderMock.Object, workerLoggerMock.Object, emailOptions);

        // Act
        using var cts = new CancellationTokenSource();
        cts.CancelAfter(TimeSpan.FromMilliseconds(500));
        await worker.StartAsync(cts.Token);
        await Task.Delay(150);
        await worker.StopAsync(CancellationToken.None);

        // Assert
        var reloaded = await db.NotificationOutboxes.FindAsync(pendingItem.Id);
        reloaded.Should().NotBeNull();
        reloaded!.Status.Should().Be(NotificationStatus.Failed, "Permanent 4xx should fail immediately without exhausting retries");
        reloaded.ErrorMessage.Should().Be("HTTP 400", "ErrorMessage should be the HTTP status code only");
        reloaded.ProcessedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task EmailNotificationChannel_Smtp_ReturnsFalseOnFailure_OutsideDevelopment()
    {
        // Arrange
        var envBefore = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        try
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production");

            var factoryMock = new Mock<IHttpClientFactory>();
            var loggerMock = new Mock<ILogger<EmailNotificationChannel>>();
            var options = Options.Create(new EmailOptions
            {
                Provider = "Smtp",
                SmtpHost = "127.0.0.1",
                SmtpPort = 19999 // Unused port to guarantee connection failure
            });

            var channel = new EmailNotificationChannel(factoryMock.Object, options, loggerMock.Object);

            // Act
            var result = await channel.SendAsync("recipient@test.com", "Subj", "Body");

            // Assert: Outside development, failure returns false
            result.Should().BeFalse();
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", envBefore);
        }
    }

    [Fact]
    public async Task EmailNotificationChannel_Smtp_ReturnsTrueOnFailure_InDevelopment()
    {
        // Arrange
        var envBefore = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        try
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");

            var factoryMock = new Mock<IHttpClientFactory>();
            var loggerMock = new Mock<ILogger<EmailNotificationChannel>>();
            var options = Options.Create(new EmailOptions
            {
                Provider = "Smtp",
                SmtpHost = "127.0.0.1",
                SmtpPort = 19999 // Unused port to guarantee connection failure
            });

            var channel = new EmailNotificationChannel(factoryMock.Object, options, loggerMock.Object);

            // Act
            var result = await channel.SendAsync("recipient@test.com", "Subj", "Body");

            // Assert: In Development, failure returns true (lenient behavior)
            result.Should().BeTrue();
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", envBefore);
        }
    }
}
