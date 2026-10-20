using System.Net;
using System.Text.Json;
using FluentAssertions;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using Xunit;
using InstitutionErp.Api.Filters;
using InstitutionErp.Api.Middleware;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Application.DTOs;
using InstitutionErp.Application.Validators;
using InstitutionErp.Domain.Enums;
using InstitutionErp.Infrastructure.Notifications;

namespace InstitutionErp.UnitTests;

public class Phase4BackendHardeningTests
{
    [Fact]
    public async Task ValidationFilter_ShouldReturn400ProblemDetails_WhenValidationFails()
    {
        // Arrange
        var services = new ServiceCollection();
        services.AddScoped<IValidator<ChangePasswordRequest>, ChangePasswordRequestValidator>();
        var serviceProvider = services.BuildServiceProvider();

        var filter = new ValidationFilterAttribute(serviceProvider);

        var actionContext = new ActionContext(
            new DefaultHttpContext(),
            new RouteData(),
            new ActionDescriptor());

        var invalidRequest = new ChangePasswordRequest("", "short");

        var actionExecutingContext = new ActionExecutingContext(
            actionContext,
            new List<IFilterMetadata>(),
            new Dictionary<string, object?> { { "request", invalidRequest } },
            new object());

        var nextCalled = false;
        ActionExecutionDelegate next = () =>
        {
            nextCalled = true;
            return Task.FromResult<ActionExecutedContext>(null!);
        };

        // Act
        await filter.OnActionExecutionAsync(actionExecutingContext, next);

        // Assert
        nextCalled.Should().BeFalse();
        actionExecutingContext.Result.Should().BeOfType<BadRequestObjectResult>();

        var badRequestResult = (BadRequestObjectResult)actionExecutingContext.Result!;
        badRequestResult.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        badRequestResult.ContentTypes.Should().Contain("application/problem+json");

        var problemDetails = badRequestResult.Value.Should().BeOfType<ValidationProblemDetails>().Subject;
        problemDetails.Status.Should().Be(400);
        problemDetails.Errors.Should().ContainKey("newPassword");
        problemDetails.Extensions.Should().ContainKey("traceId");
    }

    [Fact]
    public async Task ValidationFilter_ShouldCallNext_WhenValidationPasses()
    {
        // Arrange
        var services = new ServiceCollection();
        services.AddScoped<IValidator<ChangePasswordRequest>, ChangePasswordRequestValidator>();
        var serviceProvider = services.BuildServiceProvider();

        var filter = new ValidationFilterAttribute(serviceProvider);

        var actionContext = new ActionContext(
            new DefaultHttpContext(),
            new RouteData(),
            new ActionDescriptor());

        var validRequest = new ChangePasswordRequest("OldPassword123!", "NewStrongPassword123!");

        var actionExecutingContext = new ActionExecutingContext(
            actionContext,
            new List<IFilterMetadata>(),
            new Dictionary<string, object?> { { "request", validRequest } },
            new object());

        var nextCalled = false;
        ActionExecutionDelegate next = () =>
        {
            nextCalled = true;
            return Task.FromResult<ActionExecutedContext>(null!);
        };

        // Act
        await filter.OnActionExecutionAsync(actionExecutingContext, next);

        // Assert
        nextCalled.Should().BeTrue();
        actionExecutingContext.Result.Should().BeNull();
    }

    [Fact]
    public void ChangePasswordRequestValidator_ShouldFail_WhenNewPasswordTooShort()
    {
        // Arrange
        var validator = new ChangePasswordRequestValidator();
        var model = new ChangePasswordRequest("CurrentPassword123!", "short");

        // Act
        var result = validator.Validate(model);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "NewPassword" && e.ErrorMessage.Contains("8"));
    }

    [Fact]
    public void CreateUserRequestValidator_ShouldFail_WhenInvalidEmailOrRolesEmpty()
    {
        // Arrange
        var validator = new CreateUserRequestValidator();
        var model = new CreateUserRequest("not-an-email", "pwd", "", "", null, new List<string>());

        // Act
        var result = validator.Validate(model);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Email");
        result.Errors.Should().Contain(e => e.PropertyName == "Roles");
    }

    [Fact]
    public void UpdateAdmissionStatusRequestValidator_ShouldFail_WhenInvalidStatusEnum()
    {
        // Arrange
        var validator = new UpdateAdmissionStatusRequestValidator();
        var model = new UpdateAdmissionStatusRequest((AdmissionStatus)999, null);

        // Act
        var result = validator.Validate(model);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "NewStatus");
    }

    [Fact]
    public async Task ExceptionHandlingMiddleware_ShouldSanitize500_InProduction()
    {
        // Arrange
        var envMock = new Mock<IWebHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");

        var loggerMock = new Mock<ILogger<ExceptionHandlingMiddleware>>();

        RequestDelegate next = (ctx) => throw new Exception("Sensitive internal database connection failed: secret_user:secret_pass");

        var middleware = new ExceptionHandlingMiddleware(next, loggerMock.Object, envMock.Object);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be((int)HttpStatusCode.InternalServerError);
        context.Response.ContentType.Should().Be("application/problem+json");

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var json = await reader.ReadToEndAsync();

        json.Should().NotContain("secret_pass");
        json.Should().NotContain("Sensitive internal database");
        json.Should().Contain("An unexpected internal server error occurred. Please contact system support.");
        json.Should().Contain("traceId");
    }

    [Fact]
    public async Task EmailNotificationChannel_ShouldEnforceDailyLimit()
    {
        // Arrange
        var httpClientFactoryMock = new Mock<IHttpClientFactory>();
        var loggerMock = new Mock<ILogger<EmailNotificationChannel>>();

        var emailOptions = Options.Create(new EmailOptions
        {
            Provider = "Brevo",
            ApiKey = "mock_key",
            FromAddress = "test@institution.edu",
            FromName = "ERP",
            DailyLimit = 1 // Limit set to 1 for test
        });

        var handlerMock = new Mock<HttpMessageHandler>();
        // Mock successful Brevo response
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.Created,
                Content = new StringContent("{\"messageId\":\"msg_123\"}")
            });

        var client = new HttpClient(handlerMock.Object);
        httpClientFactoryMock.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(client);

        var channel = new EmailNotificationChannel(httpClientFactoryMock.Object, emailOptions, loggerMock.Object);

        // Act & Assert
        // First send succeeds within quota
        var firstResult = await channel.SendAsync("recipient1@test.com", "Subj 1", "Body 1");
        firstResult.Should().BeTrue();

        // Second send exceeds DailyLimit=1 and must throw DailyLimitExceededException
        Func<Task> act = async () => await channel.SendAsync("recipient2@test.com", "Subj 2", "Body 2");
        await act.Should().ThrowAsync<DailyLimitExceededException>()
            .WithMessage("*daily limit*");
    }
}
