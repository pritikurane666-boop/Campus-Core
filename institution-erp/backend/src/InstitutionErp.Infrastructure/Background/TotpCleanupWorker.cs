using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Infrastructure.Background;

/// <summary>
/// Background service that periodically removes expired login challenges
/// and expired trusted devices from the database.
/// Runs every 15 minutes.
/// </summary>
public sealed class TotpCleanupWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TotpCleanupWorker> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    public TotpCleanupWorker(IServiceScopeFactory scopeFactory, ILogger<TotpCleanupWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Stagger startup by 2 minutes so it doesn't compete with DB migrations
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TOTP cleanup worker encountered an error.");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var now = DateTime.UtcNow;

        var deletedChallenges = await db.LoginChallenges
            .Where(c => c.ExpiresAt < now)
            .ExecuteDeleteAsync(ct);

        var deletedDevices = await db.TrustedDevices
            .Where(d => d.ExpiresAt < now)
            .ExecuteDeleteAsync(ct);

        if (deletedChallenges > 0 || deletedDevices > 0)
        {
            _logger.LogInformation(
                "TOTP cleanup: removed {Challenges} expired challenges, {Devices} expired trusted devices.",
                deletedChallenges, deletedDevices);
        }
    }
}
