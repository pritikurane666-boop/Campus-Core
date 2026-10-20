using System.Security.Claims;
using FluentAssertions;
using InstitutionErp.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace InstitutionErp.UnitTests;

public class MustChangePasswordMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_WhenUnauthenticated_PassesThrough()
    {
        var invokedNext = false;
        RequestDelegate next = _ =>
        {
            invokedNext = true;
            return Task.CompletedTask;
        };

        var middleware = new MustChangePasswordMiddleware(next);
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/v1/students";

        await middleware.InvokeAsync(context);

        invokedNext.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    [Fact]
    public async Task InvokeAsync_WhenAuthenticatedWithoutMustChangePasswordClaim_PassesThrough()
    {
        var invokedNext = false;
        RequestDelegate next = _ =>
        {
            invokedNext = true;
            return Task.CompletedTask;
        };

        var middleware = new MustChangePasswordMiddleware(next);
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/v1/students";

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Role, "Student")
        }, "TestAuth");
        context.User = new ClaimsPrincipal(identity);

        await middleware.InvokeAsync(context);

        invokedNext.Should().BeTrue();
    }

    [Theory]
    [InlineData("/api/v1/students")]
    [InlineData("/api/v1/attendance/class/123")]
    [InlineData("/api/v1/fees/student/456")]
    [InlineData("/api/v1/exams")]
    public async Task InvokeAsync_WhenMustChangePasswordIsTrue_BlocksGeneralEndpoints(string path)
    {
        var invokedNext = false;
        RequestDelegate next = _ =>
        {
            invokedNext = true;
            return Task.CompletedTask;
        };

        var middleware = new MustChangePasswordMiddleware(next);
        var context = new DefaultHttpContext();
        context.Request.Path = path;

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim("must_change_password", "true")
        }, "TestAuth");
        context.User = new ClaimsPrincipal(identity);

        await middleware.InvokeAsync(context);

        invokedNext.Should().BeFalse();
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Theory]
    [InlineData("/api/v1/auth/change-password")]
    [InlineData("/api/v1/auth/keep-password")]
    [InlineData("/api/v1/auth/logout")]
    [InlineData("/api/v1/auth/me")]
    [InlineData("/health")]
    [InlineData("/api/v1/health")]
    public async Task InvokeAsync_WhenMustChangePasswordIsTrue_AllowsWhitelistedEndpoints(string path)
    {
        var invokedNext = false;
        RequestDelegate next = _ =>
        {
            invokedNext = true;
            return Task.CompletedTask;
        };

        var middleware = new MustChangePasswordMiddleware(next);
        var context = new DefaultHttpContext();
        context.Request.Path = path;

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim("must_change_password", "true")
        }, "TestAuth");
        context.User = new ClaimsPrincipal(identity);

        await middleware.InvokeAsync(context);

        invokedNext.Should().BeTrue();
    }
}
