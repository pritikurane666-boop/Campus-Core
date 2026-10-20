namespace InstitutionErp.Application.Common.Configuration;

public class PaymentOptions
{
    public const string SectionName = "Payment";

    public RazorpayOptions Razorpay { get; set; } = new();
}

public class RazorpayOptions
{
    public bool Enabled { get; set; } = false;
    public string KeyId { get; set; } = string.Empty;
    public string KeySecret { get; set; } = string.Empty;
}
