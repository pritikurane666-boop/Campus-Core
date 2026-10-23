using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Infrastructure.Audit;
using InstitutionErp.Infrastructure.Auth;
using InstitutionErp.Infrastructure.Background;
using InstitutionErp.Infrastructure.Notifications;
using InstitutionErp.Infrastructure.Payment;
using InstitutionErp.Infrastructure.Pdf;
using InstitutionErp.Infrastructure.Persistence;
using InstitutionErp.Infrastructure.Seeding;
using InstitutionErp.Infrastructure.Storage;

namespace InstitutionErp.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Connection string 'DefaultConnection' is missing or not configured.");
        }

        // Auto-redirect direct Supabase hostname to IPv4 pooler on platforms without IPv6 (Render)
        if (connectionString.Contains("db.iodxtlpdpxhzqegxzeyd.supabase.co", StringComparison.OrdinalIgnoreCase))
        {
            connectionString = connectionString.Replace("db.iodxtlpdpxhzqegxzeyd.supabase.co", "aws-0-ap-southeast-2.pooler.supabase.com", StringComparison.OrdinalIgnoreCase);
            if (connectionString.Contains("Username=postgres;", StringComparison.OrdinalIgnoreCase))
            {
                connectionString = connectionString.Replace("Username=postgres;", "Username=postgres.iodxtlpdpxhzqegxzeyd;", StringComparison.OrdinalIgnoreCase);
            }
        }

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsql =>
            {
                npgsql.EnableRetryOnFailure(
                    maxRetryCount: 3,
                    maxRetryDelay: TimeSpan.FromSeconds(5),
                    errorCodesToAdd: null);
                npgsql.CommandTimeout(30);
                npgsql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
            })
            .UseSnakeCaseNamingConvention();
        });

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());
        services.AddScoped<ISequenceGenerator, DatabaseSequenceGenerator>();

        // HTTP Client Factory
        services.AddHttpClient();
        services.AddHttpClient("Brevo", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        // Auth & Security
        services.Configure<InstitutionErp.Application.Common.Configuration.EmailOtpOptions>(
            configuration.GetSection(InstitutionErp.Application.Common.Configuration.EmailOtpOptions.SectionName));
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IEmailOtpService, EmailOtpService>();
        services.AddScoped<ITotpService, TotpService>();

        // Storage & PDF
        services.AddScoped<IFileStorage, FileStorageService>();
        services.AddScoped<IPdfService, QuestPdfService>();

        // Payment
        services.AddScoped<IPaymentGateway, RazorpayPaymentGateway>();

        // Notifications
        services.AddScoped<INotificationChannel, InAppNotificationChannel>();

        var emailProvider = configuration["Email:Provider"];
        if (string.Equals(emailProvider, "Brevo", StringComparison.OrdinalIgnoreCase))
        {
            services.AddScoped<INotificationChannel, BrevoEmailChannel>();
        }
        else
        {
            services.AddScoped<INotificationChannel, EmailNotificationChannel>();
        }
        services.AddScoped<BrevoEmailChannel>();
        services.AddScoped<EmailNotificationChannel>();

        services.AddScoped<INotificationChannel, SmsNotificationChannel>();
        services.AddScoped<INotificationChannel, WhatsAppNotificationChannel>();
        services.AddScoped<INotificationSender, NotificationSender>();
        services.AddHostedService<NotificationOutboxWorker>();

        // Audit
        services.AddScoped<IAuditLogService, AuditLogService>();

        // TOTP background maintenance
        services.AddHostedService<TotpCleanupWorker>();

        // Seeder
        services.AddScoped<DatabaseSeeder>();

        return services;
    }
}
