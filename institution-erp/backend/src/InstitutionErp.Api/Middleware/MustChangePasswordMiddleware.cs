using System.Text.Json;

namespace InstitutionErp.Api.Middleware;

/// <summary>
/// Server-side enforcement middleware that blocks all API operations
/// when an authenticated user has the MustChangePassword flag active,
/// until they complete a password change.
/// </summary>
public class MustChangePasswordMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly HashSet<string> AllowedPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/v1/auth/change-password",
        "/api/v1/auth/keep-password",
        "/api/v1/auth/logout",
        "/api/v1/auth/me",
        "/health",
        "/api/v1/health"
    };

    public MustChangePasswordMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var mustChange = context.User.FindFirst("must_change_password")?.Value;
            if (string.Equals(mustChange, "true", StringComparison.OrdinalIgnoreCase))
            {
                var path = context.Request.Path.Value?.TrimEnd('/') ?? string.Empty;
                if (!AllowedPaths.Contains(path))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";

                    var response = new
                    {
                        statusCode = StatusCodes.Status403Forbidden,
                        message = "Password change required before accessing other features.",
                        mustChangePassword = true
                    };

                    await context.Response.WriteAsync(JsonSerializer.Serialize(response));
                    return;
                }
            }
        }

        await _next(context);
    }
}
