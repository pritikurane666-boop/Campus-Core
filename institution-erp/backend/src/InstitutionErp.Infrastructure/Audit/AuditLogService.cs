using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Domain.Entities;
using InstitutionErp.Infrastructure.Persistence;

namespace InstitutionErp.Infrastructure.Audit;

public class AuditLogService : IAuditLogService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(
        IServiceProvider serviceProvider,
        ICurrentUserService currentUserService,
        ILogger<AuditLogService> logger)
    {
        _serviceProvider = serviceProvider;
        _currentUserService = currentUserService;
        _logger = logger;
    }

    public async Task LogAsync(
        string action,
        string entityName,
        string? entityId = null,
        object? oldValues = null,
        object? newValues = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var log = new AuditLog
            {
                UserId = _currentUserService.UserId,
                UserEmail = _currentUserService.Email ?? "Anonymous",
                Action = action,
                EntityName = entityName,
                EntityId = entityId,
                OldValuesJson = oldValues != null ? JsonSerializer.Serialize(oldValues) : null,
                NewValuesJson = newValues != null ? JsonSerializer.Serialize(newValues) : null,
                IpAddress = _currentUserService.IpAddress,
                CreatedAt = DateTime.UtcNow
            };

            db.AuditLogs.Add(log);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write audit log for {Action} on {EntityName}", action, entityName);
        }
    }
}
