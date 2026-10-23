using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace InstitutionErp.IntegrationTests;

public class HealthEndpointIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HealthEndpointIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/v1/health")]
    public async Task HealthEndpoint_ReturnsOk_WithoutAuthentication(string url)
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(url);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("/api/v1/students")]
    [InlineData("/api/v1/teachers")]
    [InlineData("/api/v1/users")]
    [InlineData("/api/v1/fees/reports/collection")]
    public async Task ProtectedEndpoints_ReturnUnauthorized_WhenTokenIsMissing(string url)
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(url);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TotpVerify_RouteExists_ReturnsBadRequest_WhenChallengeEmpty()
    {
        var client = _factory.CreateClient();
        var content = new StringContent("{\"challengeId\":\"00000000-0000-0000-0000-000000000000\"}", System.Text.Encoding.UTF8, "application/json");
        var response = await client.PostAsync("/api/v1/auth/2fa/verify", content);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
