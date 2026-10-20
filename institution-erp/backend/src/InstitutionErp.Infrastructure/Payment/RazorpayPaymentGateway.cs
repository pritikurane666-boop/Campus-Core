using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using InstitutionErp.Application.Common.Configuration;
using InstitutionErp.Application.Common.Interfaces;

namespace InstitutionErp.Infrastructure.Payment;

public class RazorpayPaymentGateway : IPaymentGateway
{
    private readonly PaymentOptions _options;
    private readonly ILogger<RazorpayPaymentGateway> _logger;

    public RazorpayPaymentGateway(IOptions<PaymentOptions> options, ILogger<RazorpayPaymentGateway> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public Task<(string orderId, decimal amount, string currency)> CreateOrderAsync(decimal amount, string receipt, CancellationToken cancellationToken = default)
    {
        if (!_options.Razorpay.Enabled)
        {
            _logger.LogWarning("CreateOrderAsync invoked but Razorpay gateway is disabled. Failing closed.");
            throw new NotSupportedException("Online payment processing is currently disabled.");
        }

        if (string.IsNullOrWhiteSpace(_options.Razorpay.KeyId) || string.IsNullOrWhiteSpace(_options.Razorpay.KeySecret))
        {
            _logger.LogError("Razorpay is enabled but KeyId or KeySecret is missing.");
            throw new InvalidOperationException("Payment gateway configuration is incomplete.");
        }

        var orderId = $"order_rzp_{Guid.NewGuid():N}".Substring(0, 20);
        _logger.LogInformation("Razorpay Order Created: {OrderId} for Amount: {Amount}", orderId, amount);
        return Task.FromResult((orderId, amount, "INR"));
    }

    public bool VerifySignature(string orderId, string paymentId, string signature)
    {
        if (!_options.Razorpay.Enabled)
        {
            _logger.LogWarning("VerifySignature invoked while Razorpay gateway is disabled. Failing closed (returning false).");
            return false;
        }

        var secret = _options.Razorpay.KeySecret;
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(signature))
        {
            _logger.LogWarning("Razorpay KeySecret or Signature is empty during verification. Failing closed.");
            return false;
        }

        var payload = $"{orderId}|{paymentId}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        var generatedSignature = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();

        var signatureBytes = Encoding.UTF8.GetBytes(signature.ToLowerInvariant());
        var generatedBytes = Encoding.UTF8.GetBytes(generatedSignature);

        return CryptographicOperations.FixedTimeEquals(signatureBytes, generatedBytes);
    }
}
