using TrackTrace.Application.Features.Orders;

namespace TrackTrace.Application.Tests;

public class OrderGroupKeyHelperTests
{
    [Fact]
    public void CreateAndDecodeGroupKey_RoundTripsTrimmedUnicodeValues()
    {
        var key = OrderGroupKeyHelper.CreateGroupKey("  ORD-42  ", "  Örnek Müşteri  ");

        var payload = OrderGroupKeyHelper.DecodeGroupKey(key);

        Assert.StartsWith("v1.", key);
        Assert.Equal("ORD-42", payload.OrderNo);
        Assert.Equal("Örnek Müşteri", payload.CustomerName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("invalid")]
    [InlineData("v1.!")]
    public void DecodeGroupKey_RejectsInvalidValues(string key)
    {
        Assert.Throws<ArgumentException>(() => OrderGroupKeyHelper.DecodeGroupKey(key));
    }
}
