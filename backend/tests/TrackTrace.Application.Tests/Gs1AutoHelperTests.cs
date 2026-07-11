using TrackTrace.Application.Common;

namespace TrackTrace.Application.Tests;

public class Gs1AutoHelperTests
{
    [Fact]
    public void NormalizeForEncoding_RejectsEmptyInput()
    {
        var result = Gs1AutoHelper.NormalizeForEncoding(string.Empty);

        Assert.False(result.Success);
        Assert.NotNull(result.ErrorMessage);
    }

    [Fact]
    public void NormalizeForEncoding_AcceptsPlainCodeInAutoProfile()
    {
        var result = Gs1AutoHelper.NormalizeForEncoding("  PLAIN-CODE-123  ");

        Assert.True(result.Success);
        Assert.False(result.IsGs1);
        Assert.Equal("PLAIN-CODE-123", result.Normalized);
    }

    [Theory]
    [InlineData("[00]123456789012345678", "123456789012345678")]
    [InlineData("(00)123456789012345678", "123456789012345678")]
    [InlineData("00123456789012345678", "123456789012345678")]
    [InlineData("prefix|[00]123456789012345678|suffix", "123456789012345678")]
    public void ExtractSscc_ReturnsEighteenDigitValue(string input, string expected)
    {
        Assert.Equal(expected, Gs1AutoHelper.ExtractSscc(input));
    }
}
