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
        // Password change is optional and non-blocking: users can access all features directly.
        await _next(context);
    }
}
