using TrackTrace.Application.Common;

namespace TrackTrace.Application.Tests;

public class AuditLogPolicyTests
{
    [Theory]
    [InlineData("ProductCodes", "DoubleScanAttempt")]
    [InlineData("Orders", "Delete")]
    [InlineData("Cartons", "TransferStation")]
    [InlineData("Users", "Update")]
    [InlineData("Shipments", "Cancel")]
    [InlineData("productcodes", "doublescanattempt")]
    public void ShouldLog_ReturnsTrue_ForCriticalEvents(string entityName, string action)
    {
        Assert.True(AuditLogPolicy.ShouldLog(entityName, action));
    }

    [Theory]
    [InlineData("ProductCodes", "Scan")]
    [InlineData("Cartons", "AddProduct")]
    [InlineData("Pallets", "AddCarton")]
    [InlineData("Shipments", "ScanItem")]
    [InlineData("Users", "Login")]
    [InlineData("Orders", "BulkImport")]
    [InlineData("Unknown", "Delete")]
    public void ShouldLog_ReturnsFalse_ForNoncriticalEvents(string entityName, string action)
    {
        Assert.False(AuditLogPolicy.ShouldLog(entityName, action));
    }
}
