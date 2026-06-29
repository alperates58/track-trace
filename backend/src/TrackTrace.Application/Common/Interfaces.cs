using System;
using System.Data;
using System.Threading.Tasks;
using TrackTrace.Application.Common;

namespace TrackTrace.Application.Common.Interfaces;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}

public interface IJwtTokenGenerator
{
    string GenerateToken(Guid userId, string username, string name, string role);
}

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Username { get; }
    string? Role { get; }
    string? IpAddress { get; }
}

public interface IAuditLogService
{
    Task LogAsync(string entityName, Guid? entityId, string action, object? oldValue = null, object? newValue = null);
}

public interface ILabelGenerator
{
    byte[] GenerateCartonPdfLabel(CartonDto carton, OrderDto order);
    string GenerateCartonZplLabel(CartonDto carton, OrderDto order);
    byte[] GeneratePalletPdfLabel(PalletDto pallet, OrderDto order, int cartonCount);
    string GeneratePalletZplLabel(PalletDto pallet, OrderDto order, int cartonCount);
    byte[] GenerateDataMatrixCodesPdf(System.Collections.Generic.IEnumerable<string> codes, int cols, int rows, int size, bool addText, string? line1, string? line2, bool labelBelow, int startIndex = 1, int totalCodes = -1, int fontSize = 10);
    byte[] GenerateDataMatrixZip(System.Collections.Generic.IEnumerable<string> codes, int startIndex = 1);
    byte[] GenerateDataMatrixImage(string text);
}

public interface IReportPdfGenerator
{
    byte[] GenerateOrderReportPdf(
        string orderNo,
        object summary,
        System.Collections.Generic.IEnumerable<object> stockCodes,
        System.Collections.Generic.IEnumerable<object> cartons,
        System.Collections.Generic.IEnumerable<object> pallets,
        System.Collections.Generic.IEnumerable<object> missingSummary,
        int maxPalletRows,
        int maxMissingSummaryRows,
        System.Threading.CancellationToken cancellationToken);
}
