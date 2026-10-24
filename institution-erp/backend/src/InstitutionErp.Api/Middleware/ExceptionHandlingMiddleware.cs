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

        int statusCode;
        string title;
        string typeUri;
        string detail;

        if (exception is UnauthorizedAccessException)
        {
            statusCode = (int)HttpStatusCode.Forbidden;
            title = "Forbidden";
            typeUri = "https://tools.ietf.org/html/rfc7231#section-6.5.3";
            detail = "You do not have permission to perform this action.";
        }
        else if (exception is KeyNotFoundException)
        {
            statusCode = (int)HttpStatusCode.NotFound;
            title = "Not Found";
            typeUri = "https://tools.ietf.org/html/rfc7231#section-6.5.4";
            detail = "The requested record was not found.";
        }
        else if (exception is FluentValidation.ValidationException)
        {
            statusCode = (int)HttpStatusCode.BadRequest;
            title = "Validation Error";
            typeUri = "https://tools.ietf.org/html/rfc7231#section-6.5.1";
            detail = "One or more validation errors occurred.";
        }
        else if (exception is Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException)
        {
            statusCode = (int)HttpStatusCode.Conflict;
            title = "Conflict";
            typeUri = "https://tools.ietf.org/html/rfc7231#section-6.5.8";
            detail = "Someone else changed this record. Please refresh and try again.";
        }
        else if (exception is Microsoft.EntityFrameworkCore.DbUpdateException dbEx)
        {
            statusCode = (int)HttpStatusCode.Conflict;
            title = "Conflict";
            typeUri = "https://tools.ietf.org/html/rfc7231#section-6.5.8";

            var innerMsg = dbEx.InnerException?.Message ?? dbEx.Message;
            if (innerMsg.Contains("23505") || innerMsg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase) || innerMsg.Contains("unique constraint", StringComparison.OrdinalIgnoreCase))
            {
                detail = "A record with this information already exists.";
            }
            else if (innerMsg.Contains("23503") || innerMsg.Contains("foreign key", StringComparison.OrdinalIgnoreCase) || innerMsg.Contains("reference constraint", StringComparison.OrdinalIgnoreCase))
            {
                detail = "This item cannot be deleted because it is being used by other records.";
            }
            else
            {
                detail = "This record cannot be saved because it conflicts with existing data.";
            }
        }
        else if (exception is InvalidOperationException invEx)
        {
            statusCode = (int)HttpStatusCode.BadRequest;
            title = "Bad Request";
            typeUri = "https://tools.ietf.org/html/rfc7231#section-6.5.1";
            if (invEx.Message.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) ||
                invEx.Message.Contains("Exception", StringComparison.OrdinalIgnoreCase) ||
                invEx.Message.Contains("SQL", StringComparison.OrdinalIgnoreCase) ||
                invEx.Message.Contains("at ", StringComparison.OrdinalIgnoreCase))
            {
                detail = "The operation could not be completed. Please check your request and try again.";
            }
            else
            {
                detail = invEx.Message;
            }
        }
        else
        {
            statusCode = (int)HttpStatusCode.InternalServerError;
            title = "Internal Server Error";
            typeUri = "https://tools.ietf.org/html/rfc7231#section-6.6.1";
            detail = "Something went wrong on our end. Please try again in a moment. If the problem continues, contact support.";
        }

        context.Response.StatusCode = statusCode;

        var problemDetails = new ProblemDetails
        {
            Type = typeUri,
            Status = statusCode,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path
        };

        problemDetails.Extensions["message"] = detail;
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

