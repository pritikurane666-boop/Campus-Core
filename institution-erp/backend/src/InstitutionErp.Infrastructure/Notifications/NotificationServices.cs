using System.Net.Http;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Infrastructure.Notifications;

public class DailyLimitExceededException : Exception
{
    public DailyLimitExceededException(string message) : base(message) { }
}

public class PermanentFailureException : Exception
{
    public int? StatusCode { get; }

    public PermanentFailureException(int statusCode) : base($"HTTP {statusCode}")
    {
        StatusCode = statusCode;
    }

    public PermanentFailureException(string message) : base(message) { }
}

public interface INotificationChannel
{
    NotificationChannelType Channel { get; }
    Task<bool> SendAsync(string recipient, string subject, string body, string? payloadJson = null, CancellationToken cancellationToken = default);
}

public class BrevoEmailChannel : INotificationChannel
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly EmailOptions _options;
    private readonly ILogger<BrevoEmailChannel> _logger;

    private static int _dailySentCount = 0;
    private static DateTime _countResetDate = DateTime.UtcNow.Date;
    private static readonly object _lock = new();

    public BrevoEmailChannel(
        IHttpClientFactory httpClientFactory,
        IOptions<EmailOptions> options,
        ILogger<BrevoEmailChannel> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public NotificationChannelType Channel => NotificationChannelType.Email;

    public string? LastErrorMessage { get; private set; }

    public static void ResetDailyCount()
    {
        lock (_lock)
        {
            _dailySentCount = 0;
            _countResetDate = DateTime.UtcNow.Date;
        }
    }

    public async Task<bool> SendAsync(string recipient, string subject, string body, string? payloadJson = null, CancellationToken cancellationToken = default)
    {
        // 1. Daily rate-limiting guard
        lock (_lock)
        {
            if (DateTime.UtcNow.Date > _countResetDate)
            {
                _dailySentCount = 0;
                _countResetDate = DateTime.UtcNow.Date;
            }

            if (_options.DailyLimit > 0 && _dailySentCount >= _options.DailyLimit)
            {
                _logger.LogWarning("Brevo email daily limit of {Limit} reached for {Date}. Deferring delivery for {Recipient}.",
                    _options.DailyLimit, _countResetDate.ToString("yyyy-MM-dd"), recipient);
                throw new DailyLimitExceededException($"Email daily limit of {_options.DailyLimit} reached for {_countResetDate:yyyy-MM-dd}.");
            }
        }

        try
        {
            var client = _httpClientFactory.CreateClient("Brevo");
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
            request.Headers.Add("api-key", _options.ApiKey ?? string.Empty);
            request.Headers.Add("Accept", "application/json");

            var payload = new
            {
                sender = new
                {
                    name = string.IsNullOrWhiteSpace(_options.FromName) ? "CampusCore ERP" : _options.FromName,
                    email = _options.FromAddress
                },
                to = new[]
                {
                    new { email = recipient }
                },
                subject = subject,
                htmlContent = body
            };

            request.Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json");

            var response = await client.SendAsync(request, cancellationToken);
            var statusCode = (int)response.StatusCode;

            // 1. HTTP 2xx = sent
            if (response.IsSuccessStatusCode)
            {
                lock (_lock) { _dailySentCount++; }
                _logger.LogInformation("Email successfully sent via Brevo to {Recipient} (HTTP {StatusCode})", recipient, statusCode);
                LastErrorMessage = null;
                return true;
            }

            // 2. HTTP 429 = retryable failure
            if (statusCode == 429)
            {
                _logger.LogWarning("Brevo rate limit (HTTP 429) reached for recipient {Recipient}. Will retry.", recipient);
                LastErrorMessage = "HTTP 429";
                return false;
            }

            // 3. HTTP 5xx = retryable failure
            if (statusCode >= 500 && statusCode <= 599)
            {
                _logger.LogWarning("Brevo server error (HTTP {StatusCode}) for recipient {Recipient}. Will retry.", statusCode, recipient);
                LastErrorMessage = $"HTTP {statusCode}";
                return false;
            }

            // 4. Other 4xx = permanent failure: record status code only, never response body, key, or email content
            if (statusCode >= 400 && statusCode <= 499)
            {
                _logger.LogError("Brevo client error (HTTP {StatusCode}) for recipient {Recipient}. Permanent failure.", statusCode, recipient);
                LastErrorMessage = $"HTTP {statusCode}";
                throw new PermanentFailureException(statusCode);
            }

            _logger.LogWarning("Brevo unexpected status (HTTP {StatusCode}) for recipient {Recipient}. Will retry.", statusCode, recipient);
            LastErrorMessage = $"HTTP {statusCode}";
            return false;
        }
        catch (DailyLimitExceededException)
        {
            throw;
        }
        catch (PermanentFailureException)
        {
            throw;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Brevo network error sending email to {Recipient}. Will retry.", recipient);
            LastErrorMessage = "Network error";
            return false;
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogWarning(ex, "Brevo request timed out sending email to {Recipient}. Will retry.", recipient);
            LastErrorMessage = "Timeout";
            return false;
        }
        catch (TimeoutException ex)
        {
            _logger.LogWarning(ex, "Brevo request timed out sending email to {Recipient}. Will retry.", recipient);
            LastErrorMessage = "Timeout";
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error sending email via Brevo to {Recipient}", recipient);
            LastErrorMessage = "Unexpected error";
            return false;
        }
    }
}

public class InAppNotificationChannel : INotificationChannel
{
    private readonly IServiceProvider _serviceProvider;

    public InAppNotificationChannel(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public NotificationChannelType Channel => NotificationChannelType.InApp;

    public async Task<bool> SendAsync(string recipient, string subject, string body, string? payloadJson = null, CancellationToken cancellationToken = default)
    {
        if (Guid.TryParse(recipient, out var userId))
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notification = new Notification
            {
                UserId = userId,
                Title = subject,
                Message = body,
                Channel = NotificationChannelType.InApp,
                IsRead = false
            };
            db.Notifications.Add(notification);
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        return false;
    }
}

public class EmailNotificationChannel : INotificationChannel
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly EmailOptions _options;
    private readonly ILogger<EmailNotificationChannel> _logger;

    private static int _dailySentCount = 0;
    private static DateTime _countResetDate = DateTime.UtcNow.Date;
    private static readonly object _lock = new();

    public EmailNotificationChannel(
        IHttpClientFactory httpClientFactory,
        IOptions<EmailOptions> options,
        ILogger<EmailNotificationChannel> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public NotificationChannelType Channel => NotificationChannelType.Email;

    public async Task<bool> SendAsync(string recipient, string subject, string body, string? payloadJson = null, CancellationToken cancellationToken = default)
    {
        // 1. Daily rate-limiting guard (enforces Brevo 300 daily emails free tier limit)
        lock (_lock)
        {
            if (DateTime.UtcNow.Date > _countResetDate)
            {
                _dailySentCount = 0;
                _countResetDate = DateTime.UtcNow.Date;
            }

            if (_dailySentCount >= _options.DailyLimit)
            {
                _logger.LogWarning("Email daily limit of {Limit} reached for {Date}. Deferring delivery for {Recipient}.",
                    _options.DailyLimit, _countResetDate.ToString("yyyy-MM-dd"), recipient);
                throw new DailyLimitExceededException($"Email daily limit of {_options.DailyLimit} reached for {_countResetDate:yyyy-MM-dd}.");
            }
        }

        try
        {
            if (string.Equals(_options.Provider, "Brevo", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(_options.ApiKey))
            {
                var success = await SendViaBrevoAsync(recipient, subject, body, cancellationToken);
                if (success)
                {
                    lock (_lock) { _dailySentCount++; }
                    return true;
                }
                return false;
            }
            else
            {
                var success = await SendViaSmtpAsync(recipient, subject, body, cancellationToken);
                if (success)
                {
                    lock (_lock) { _dailySentCount++; }
                    return true;
                }
                return false;
            }
        }
        catch (DailyLimitExceededException)
        {
            throw;
        }
        catch (Exception ex)
        {
            var isDevelopment = string.Equals(
                Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                "Development",
                StringComparison.OrdinalIgnoreCase);

            if (isDevelopment)
            {
                _logger.LogWarning(ex, "[DEV LENIENT] Failed to deliver SMTP email to {Recipient}. Tolerating in Development.", recipient);
                return true;
            }

            _logger.LogError(ex, "Failed to deliver email to {Recipient} with subject '{Subject}'", recipient, subject);
            return false;
        }
    }

    private async Task<bool> SendViaBrevoAsync(string recipient, string subject, string body, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("Brevo");
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
        request.Headers.Add("api-key", _options.ApiKey);
        request.Headers.Add("Accept", "application/json");

        var payload = new
        {
            sender = new
            {
                name = string.IsNullOrWhiteSpace(_options.FromName) ? "CampusCore ERP" : _options.FromName,
                email = _options.FromAddress
            },
            to = new[]
            {
                new { email = recipient }
            },
            subject = subject,
            htmlContent = body
        };

        request.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json");

        var response = await client.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
        {
            _logger.LogInformation("Email successfully sent via Brevo to {Recipient} (Status: {StatusCode})", recipient, response.StatusCode);
            return true;
        }

        var statusCode = (int)response.StatusCode;
        if (statusCode >= 400 && statusCode <= 499 && statusCode != 429)
        {
            _logger.LogError("Brevo API client error {StatusCode} sending email to {Recipient}", statusCode, recipient);
            throw new PermanentFailureException(statusCode);
        }

        _logger.LogWarning("Brevo API error sending email to {Recipient}. Status: {StatusCode}", recipient, statusCode);
        return false;
    }

    private async Task<bool> SendViaSmtpAsync(string recipient, string subject, string body, CancellationToken cancellationToken)
    {
        var host = string.IsNullOrWhiteSpace(_options.SmtpHost) ? "localhost" : _options.SmtpHost;
        var port = _options.SmtpPort > 0 ? _options.SmtpPort : 1025;
        var from = string.IsNullOrWhiteSpace(_options.FromAddress) ? "erp@institution.edu" : _options.FromAddress;
        var fromName = string.IsNullOrWhiteSpace(_options.FromName) ? "CampusCore ERP" : _options.FromName;

        var message = new MimeKit.MimeMessage();
        message.From.Add(new MimeKit.MailboxAddress(fromName, from));
        message.To.Add(new MimeKit.MailboxAddress(recipient, recipient));
        message.Subject = subject;
        message.Body = new MimeKit.TextPart("html") { Text = body };

        using var client = new MailKit.Net.Smtp.SmtpClient();
        await client.ConnectAsync(host, port, MailKit.Security.SecureSocketOptions.Auto, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);

        _logger.LogInformation("Email successfully sent via SMTP to {Recipient} with subject '{Subject}'", recipient, subject);
        return true;
    }
}

public class SmsNotificationChannel : INotificationChannel
{
    private readonly ILogger<SmsNotificationChannel> _logger;

    public SmsNotificationChannel(ILogger<SmsNotificationChannel> logger)
    {
        _logger = logger;
    }

    public NotificationChannelType Channel => NotificationChannelType.Sms;

    public Task<bool> SendAsync(string recipient, string subject, string body, string? payloadJson = null, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[SMS STUB - Pluggable for Twilio/MSG91] Recipient: {Recipient} | Content: {Body}", recipient, body);
        return Task.FromResult(true);
    }
}

public class WhatsAppNotificationChannel : INotificationChannel
{
    private readonly ILogger<WhatsAppNotificationChannel> _logger;

    public WhatsAppNotificationChannel(ILogger<WhatsAppNotificationChannel> logger)
    {
        _logger = logger;
    }

    public NotificationChannelType Channel => NotificationChannelType.WhatsApp;

    public Task<bool> SendAsync(string recipient, string subject, string body, string? payloadJson = null, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[WHATSAPP STUB - Pluggable for WhatsApp Cloud API] Recipient: {Recipient} | Content: {Body}", recipient, body);
        return Task.FromResult(true);
    }
}

public class NotificationSender : INotificationSender
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<NotificationSender> _logger;

    public NotificationSender(IServiceProvider serviceProvider, ILogger<NotificationSender> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task SendNotificationAsync(Guid userId, string title, string message, NotificationChannelType channel, string? refType = null, string? refId = null, CancellationToken cancellationToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var notif = new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Channel = channel,
            IsRead = false,
            ReferenceType = refType,
            ReferenceId = refId
        };

        db.Notifications.Add(notif);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task QueueOutboxAsync(NotificationChannelType channel, string recipient, string subject, string body, string? payloadJson = null, CancellationToken cancellationToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var outbox = new NotificationOutbox
        {
            Channel = channel,
            Recipient = recipient,
            Subject = subject,
            Body = body,
            PayloadJson = payloadJson,
            Status = NotificationStatus.Pending,
            RetryCount = 0
        };

        db.NotificationOutboxes.Add(outbox);
        await db.SaveChangesAsync(cancellationToken);
    }
}

public class NotificationOutboxWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<NotificationOutboxWorker> _logger;
    private readonly IOptions<EmailOptions>? _emailOptions;

    public NotificationOutboxWorker(
        IServiceProvider serviceProvider,
        ILogger<NotificationOutboxWorker> logger,
        IOptions<EmailOptions>? emailOptions = null)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _emailOptions = emailOptions;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Notification Outbox Worker starting...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var channels = scope.ServiceProvider.GetServices<INotificationChannel>();
                var emailOptions = _emailOptions?.Value
                    ?? scope.ServiceProvider.GetService<IOptions<EmailOptions>>()?.Value
                    ?? new EmailOptions();

                var pendingItems = await db.NotificationOutboxes
                    .Where(x => x.Status == NotificationStatus.Pending && (x.NextRetryAt == null || x.NextRetryAt <= DateTime.UtcNow))
                    .OrderBy(x => x.CreatedAt)
                    .Take(10)
                    .ToListAsync(stoppingToken);

                foreach (var item in pendingItems)
                {
                    var channelHandler = channels.FirstOrDefault(c => c.Channel == item.Channel);
                    if (channelHandler != null)
                    {
                        // Requirement 5: Daily cap - before sending, count today's Sent email outbox rows;
                        // if at or above Email:DailyLimit, leave remaining messages Pending (do not mark Failed)
                        if (item.Channel == NotificationChannelType.Email)
                        {
                            var todayUtc = DateTime.UtcNow.Date;
                            var tomorrowUtc = todayUtc.AddDays(1);
                            var sentTodayCount = await db.NotificationOutboxes
                                .CountAsync(x => x.Channel == NotificationChannelType.Email
                                    && x.Status == NotificationStatus.Sent
                                    && x.ProcessedAt >= todayUtc
                                    && x.ProcessedAt < tomorrowUtc, stoppingToken);

                            var dailyLimit = emailOptions.DailyLimit > 0 ? emailOptions.DailyLimit : 300;
                            if (sentTodayCount >= dailyLimit)
                            {
                                _logger.LogWarning("Email daily limit of {Limit} reached for {Date}. Leaving outbox item {Id} Pending until reset.",
                                    dailyLimit, todayUtc.ToString("yyyy-MM-dd"), item.Id);
                                item.ErrorMessage = $"Email daily limit of {dailyLimit} reached for {todayUtc:yyyy-MM-dd}.";
                                item.NextRetryAt = tomorrowUtc.AddMinutes(5);
                                // Leave item.Status as NotificationStatus.Pending - do not mark as Failed!
                                continue;
                            }
                        }

                        try
                        {
                            var success = await channelHandler.SendAsync(item.Recipient, item.Subject, item.Body, item.PayloadJson, stoppingToken);
                            if (success)
                            {
                                item.Status = NotificationStatus.Sent;
                                item.ProcessedAt = DateTime.UtcNow;
                                item.ErrorMessage = null;
                            }
                            else
                            {
                                item.RetryCount++;
                                if (item.RetryCount > 3)
                                {
                                    item.Status = NotificationStatus.Failed;
                                }
                                else
                                {
                                    item.NextRetryAt = DateTime.UtcNow.AddMinutes(item.RetryCount * 2);
                                }
                            }
                        }
                        catch (DailyLimitExceededException ex)
                        {
                            _logger.LogWarning("Email delivery deferred due to quota: {Message}", ex.Message);
                            item.ErrorMessage = ex.Message;
                            // Defer until next UTC day (00:05 UTC) without consuming failure retries
                            item.NextRetryAt = DateTime.UtcNow.Date.AddDays(1).AddMinutes(5);
                            // Leave item.Status as NotificationStatus.Pending!
                        }
                        catch (PermanentFailureException ex)
                        {
                            _logger.LogError("Permanent failure sending notification outbox item {Id}: {Message}", item.Id, ex.Message);
                            item.Status = NotificationStatus.Failed;
                            item.ErrorMessage = ex.Message; // Status code only, e.g. "HTTP 400"
                            item.ProcessedAt = DateTime.UtcNow;
                        }
                        catch (Exception ex)
                        {
                            item.RetryCount++;
                            item.ErrorMessage = ex.Message;
                            if (item.RetryCount > 3)
                            {
                                item.Status = NotificationStatus.Failed;
                            }
                            else
                            {
                                item.NextRetryAt = DateTime.UtcNow.AddMinutes(item.RetryCount * 2);
                            }
                        }
                    }
                }

                if (pendingItems.Count > 0)
                {
                    await db.SaveChangesAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing notification outbox batch");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
