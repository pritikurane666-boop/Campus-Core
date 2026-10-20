using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace InstitutionErp.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception on {Method} {Path}: {Message}", context.Request.Method, context.Request.Path, ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/problem+json";

        var (statusCode, title, typeUri) = exception switch
        {
            UnauthorizedAccessException => (
                (int)HttpStatusCode.Unauthorized, 
                "Unauthorized", 
                "https://tools.ietf.org/html/rfc7235#section-3.1"),
            KeyNotFoundException => (
                (int)HttpStatusCode.NotFound, 
                "Resource Not Found", 
                "https://tools.ietf.org/html/rfc7231#section-6.5.4"),
            InvalidOperationException => (
                (int)HttpStatusCode.BadRequest, 
                "Bad Request", 
                "https://tools.ietf.org/html/rfc7231#section-6.5.1"),
            FluentValidation.ValidationException => (
                (int)HttpStatusCode.BadRequest, 
                "Validation Error", 
                "https://tools.ietf.org/html/rfc7231#section-6.5.1"),
            _ => (
                (int)HttpStatusCode.InternalServerError, 
                "Internal Server Error", 
                "https://tools.ietf.org/html/rfc7231#section-6.6.1")
        };

        context.Response.StatusCode = statusCode;

        var detail = statusCode == (int)HttpStatusCode.InternalServerError && !_env.IsDevelopment()
            ? "An unexpected internal server error occurred. Please contact system support."
            : exception.Message;

        var problemDetails = new ProblemDetails
        {
            Type = typeUri,
            Status = statusCode,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path
        };

        problemDetails.Extensions["traceId"] = context.TraceIdentifier;

        if (exception is FluentValidation.ValidationException validationEx)
        {
            problemDetails.Extensions["errors"] = validationEx.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    g => JsonNamingPolicy.CamelCase.ConvertName(g.Key), 
                    g => g.Select(e => e.ErrorMessage).ToArray()
                );
        }

        var json = JsonSerializer.Serialize(problemDetails, JsonOptions);
        return context.Response.WriteAsync(json);
    }
}

