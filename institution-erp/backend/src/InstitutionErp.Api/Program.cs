using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using InstitutionErp.Api.Filters;
using InstitutionErp.Api.Middleware;
using InstitutionErp.Api.Services;
using InstitutionErp.Application;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Application.Common.Interfaces;
using InstitutionErp.Infrastructure;
using InstitutionErp.Infrastructure.Persistence;
using InstitutionErp.Infrastructure.Seeding;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

// Break-glass CLI — exits before starting HTTP server if a CLI command is detected
if (await InstitutionErp.Api.CliRunner.TryRunCliAsync(args))
    return;

var builder = WebApplication.CreateBuilder(args);

// Dynamic PORT binding for Render / container deployments
var portEnv = Environment.GetEnvironmentVariable("PORT");
var mainPort = 10000;
if (!string.IsNullOrEmpty(portEnv) && int.TryParse(portEnv, out var parsedPort))
{
    mainPort = parsedPort;
}

builder.WebHost.ConfigureKestrel(opt =>
{
    opt.ListenAnyIP(mainPort);
    if (mainPort != 10000) try { opt.ListenAnyIP(10000); } catch { }
    if (mainPort != 8080) try { opt.ListenAnyIP(8080); } catch { }
    if (mainPort != 5050) try { opt.ListenAnyIP(5050); } catch { }
});

// 1. Serilog Setup
var serilogConfig = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console();

if (builder.Environment.IsDevelopment())
{
    serilogConfig.WriteTo.File("logs/erp-.log", rollingInterval: RollingInterval.Day);
}

Log.Logger = serilogConfig.CreateLogger();
builder.Host.UseSerilog();

// 2. Strongly Typed Options & Startup Validation
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(opt =>
    {
        if (string.IsNullOrWhiteSpace(opt.Secret) || Encoding.UTF8.GetByteCount(opt.Secret) < 32)
            return false;
        return true;
    }, "Jwt:Secret must be configured with at least 32 bytes (256 bits).")
    .ValidateOnStart();

builder.Services.AddOptions<AdminOptions>()
    .Bind(builder.Configuration.GetSection(AdminOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(opt =>
    {
        if (!string.IsNullOrWhiteSpace(opt.Password) && opt.Password.Length < 6)
            return false;
        return true;
    }, "Admin:Password, if provided, must be at least 6 characters.")
    .ValidateOnStart();

builder.Services.AddOptions<CorsOptions>()
    .Bind(builder.Configuration.GetSection(CorsOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(opt =>
    {
        if (opt.AllowedOrigins == null || opt.AllowedOrigins.Length == 0)
            return false;
        return true;
    }, "Cors:AllowedOrigins must contain at least one origin URL.")
    .ValidateOnStart();

builder.Services.AddOptions<AppOptions>()
    .Bind(builder.Configuration.GetSection(AppOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(opt =>
    {
        if (string.IsNullOrWhiteSpace(opt.FrontendBaseUrl))
            return false;
        return true;
    }, "App:FrontendBaseUrl is required.")
    .ValidateOnStart();

builder.Services.AddOptions<EmailOptions>()
    .Bind(builder.Configuration.GetSection(EmailOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(opt =>
    {
        if (builder.Environment.IsProduction() &&
            string.Equals(opt.Provider, "Brevo", StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(opt.ApiKey))
                return false;
            if (string.IsNullOrWhiteSpace(opt.FromAddress))
                return false;
        }
        return true;
    }, "In Production with Email:Provider=Brevo, Email:ApiKey and Email:FromAddress must be configured.")
    .ValidateOnStart();

builder.Services.AddOptions<SupabaseOptions>()
    .Bind(builder.Configuration.GetSection(SupabaseOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(opt =>
    {
        if (!string.IsNullOrWhiteSpace(opt.Url) && !opt.Url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return false;
        return true;
    }, "Supabase:Url must be a valid HTTP or HTTPS URL when specified.")
    .ValidateOnStart();

builder.Services.AddOptions<PaymentOptions>()
    .Bind(builder.Configuration.GetSection(PaymentOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddOptions<DatabaseOptions>()
    .Bind(builder.Configuration.GetSection(DatabaseOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(opt =>
    {
        if (string.IsNullOrWhiteSpace(opt.DefaultConnection))
            return false;
        if (builder.Environment.IsProduction())
        {
            if (opt.DefaultConnection.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
                opt.DefaultConnection.Contains("Password=root", StringComparison.OrdinalIgnoreCase))
                return false;
        }
        return true;
    }, "ConnectionStrings:DefaultConnection is required and cannot be a default/localhost connection in Production.")
    .ValidateOnStart();

// TOTP 2FA Options
builder.Services.AddOptions<TotpOptions>()
    .Bind(builder.Configuration.GetSection(TotpOptions.SectionName))
    .PostConfigure(opt =>
    {
        // If EncryptionKey is not explicitly set in environment variables or configuration,
        // automatically derive a deterministic 32-byte (256-bit) AES-GCM key from Jwt:Secret
        // so the service starts and operates securely in any environment (including Render)
        // without requiring manual downtime or missing-config crashes.
        if (string.IsNullOrWhiteSpace(opt.EncryptionKey))
        {
            var seed = builder.Configuration["Jwt:Secret"] ?? "CampusCore-Fallback-Totp-Encryption-Key-Seed-32Bytes!";
            using var sha = SHA256.Create();
            var derived = sha.ComputeHash(Encoding.UTF8.GetBytes($"CampusCore:Totp:AesGcmKey:{seed}"));
            opt.EncryptionKey = Convert.ToBase64String(derived);
        }
    })
    .ValidateDataAnnotations()
    .Validate(opt =>
    {
        if (!opt.Enabled) return true; // Disabled globally: no key needed
        if (string.IsNullOrWhiteSpace(opt.EncryptionKey)) return false;
        try
        {
            var bytes = Convert.FromBase64String(opt.EncryptionKey);
            return bytes.Length == 32; // Must be exactly 32 bytes for AES-256
        }
        catch { return false; }
    }, "Auth:Totp:EncryptionKey must be a base64-encoded 32-byte key.")
    .ValidateOnStart();

// 3. Add Layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// 4. Current User & HttpContext
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// 5. JWT Authentication
var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
var jwtSecretKey = jwtOptions.Secret;

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = builder.Environment.IsProduction();
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey ?? string.Empty)),
        ValidateIssuer = true,
        ValidIssuer = jwtOptions.Issuer,
        ValidateAudience = true,
        ValidAudience = jwtOptions.Audience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

// 6. Authorization Policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireHod", policy => policy.RequireRole("HOD"));
    options.AddPolicy("RequireTeacher", policy => policy.RequireRole("HOD", "Teacher"));
    options.AddPolicy("RequireStudent", policy => policy.RequireRole("HOD", "Student"));
    // Backward compatibility aliases
    options.AddPolicy("RequirePrincipal", policy => policy.RequireRole("HOD"));
    options.AddPolicy("RequireSuperAdmin", policy => policy.RequireRole("HOD"));
    options.AddPolicy("RequireAdmin", policy => policy.RequireRole("HOD"));
    options.AddPolicy("RequireAccountant", policy => policy.RequireRole("HOD"));
    options.AddPolicy("RequireParentOrStudent", policy => policy.RequireRole("HOD", "Student"));
});

// 7. CORS
var corsOptions = builder.Configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions();
var parsedOrigins = (corsOptions.AllowedOrigins ?? Array.Empty<string>())
    .SelectMany(o => o.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        if (parsedOrigins.Length > 0)
        {
            policy.WithOrigins(parsedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            policy.SetIsOriginAllowed(_ => false);
        }
    });
});

// 8. Rate Limiter
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("auth-limit", opt =>
    {
        opt.PermitLimit = 15;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 2;
    });
    // Separate stricter limit for 2FA endpoints
    options.AddFixedWindowLimiter("totp-limit", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 1;
    });
});

// 9. Controllers & RFC 7807 Validation Handling
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilterAttribute>();
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
})
.ConfigureApiBehaviorOptions(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var problemDetails = new ValidationProblemDetails(context.ModelState)
        {
            Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
            Title = "Validation Error",
            Status = StatusCodes.Status400BadRequest,
            Detail = "One or more validation errors occurred.",
            Instance = context.HttpContext.Request.Path
        };
        problemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;

        return new BadRequestObjectResult(problemDetails)
        {
            ContentTypes = { "application/problem+json" }
        };
    };
});

builder.Services.AddHealthChecks();
builder.Services.AddMemoryCache();

// 10. Swagger / OpenAPI with JWT Bearer
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Campus Core Institution ERP API",
        Version = "v1",
        Description = "Enterprise Digital Institution Management System API with RBAC, admissions, attendance, exams, and fees."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT Bearer token into the field below."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// 11. Database initialization & Seeding
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var db = services.GetRequiredService<ApplicationDbContext>();
        if (db.Database.IsRelational())
        {
            var autoMigrate = app.Environment.IsDevelopment() || 
                string.Equals(Environment.GetEnvironmentVariable("AUTO_MIGRATE"), "true", StringComparison.OrdinalIgnoreCase);
            if (autoMigrate)
            {
                await db.Database.MigrateAsync();
                Log.Information("Database migrations applied successfully.");
            }
        }
        else
        {
            await db.Database.EnsureCreatedAsync();
        }

        var seeder = services.GetRequiredService<DatabaseSeeder>();
        await seeder.SeedAsync();
        Log.Information("Database verification and seeding completed successfully.");
    }
    catch (Exception ex)
    {
        Log.Error(ex, "An error occurred during database migration or seeding.");
    }
}

// 12. Middleware Pipeline
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();

app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Institution ERP API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseCors("CorsPolicy");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<MustChangePasswordMiddleware>();

app.MapControllers();
app.MapGet("/", () => Results.Ok(new { status = "Healthy", message = "CampusCore ERP API is running" }));
app.MapHealthChecks("/health");
app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));
app.MapHealthChecks("/api/v1/health");
app.MapGet("/api/v1/health", () => Results.Ok(new { status = "Healthy" }));

app.Run();

public partial class Program { }
