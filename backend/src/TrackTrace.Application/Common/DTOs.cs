using System;
using System.Collections.Generic;

namespace TrackTrace.Application.Common;

public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token, UserDto User);
public record UserDto(Guid Id, string Name, string Username, string Role, bool IsActive);

public record OrderDto(
    Guid Id,
    string OrderNo,
    string CustomerName,
    string? StockCode,
    string? ProductName,
    string GTIN,
    int ProductPerCarton,
    int CartonPerPallet,
    int ExpectedQuantity,
    string? Description,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int ScannedCount
);

public record CreateOrderRequest(
    string OrderNo,
    string CustomerName,
    string? StockCode,
    string? ProductName,
    string GTIN,
    int ProductPerCarton,
    int CartonPerPallet,
    int ExpectedQuantity,
    string? Description
);

public record UpdateOrderRequest(
    string CustomerName,
    string? StockCode,
    string? ProductName,
    string GTIN,
    int ProductPerCarton,
    int CartonPerPallet,
    int ExpectedQuantity,
    string? Description
);

public record ImportResultDto(
    Guid BatchId,
    int TotalRows,
    int ImportedCount,
    int DuplicateCount,
    int InvalidCount,
    List<ImportErrorDto> Errors
);

public record ImportErrorDto(int RowNo, string? RawLine, string ErrorMessage);

public record ScanRequest(Guid OrderId, string RawCode);

public record ScanResponse(
    bool Success,
    string Message,
    string? RawCode,
    string? Gtin,
    string? SerialNo,
    string? CartonNo,
    string? SSCC,
    int CartonCurrentQty,
    int CartonTargetQty,
    string Status // "Success", "CartonClosed", "Warning", "Error"
);

public record CartonDto(
    Guid Id,
    Guid OrderId,
    string OrderNo,
    string CartonNo,
    string SSCC,
    int TargetQuantity,
    int ActualQuantity,
    string Status,
    DateTime CreatedAt,
    DateTime? ClosedAt,
    DateTime? PrintedAt
);

public record PalletDto(
    Guid Id,
    Guid OrderId,
    string OrderNo,
    string PalletNo,
    string SSCC,
    string Status,
    DateTime CreatedAt,
    DateTime? ClosedAt,
    DateTime? PrintedAt,
    int CartonCount
);

public record DashboardSummaryDto(
    int ActiveOrdersCount,
    int OpenCartonsCount,
    int OpenPalletsCount,
    int ScannedTodayCount,
    int CartonsCreatedTodayCount,
    int PalletsCreatedTodayCount,
    List<RecentActivityDto> RecentActivities
);

public record RecentActivityDto(
    string Message,
    DateTime CreatedAt,
    string User
);

public record BarcodeSearchResultDto(
    string RawCode,
    string? Gtin,
    string? SerialNo,
    string Status,
    DateTime? ScannedAt,
    string? ScannedBy,
    string? OrderNo,
    string? CustomerName,
    string? ProductName,
    string? CartonNo,
    string? CartonSSCC,
    string? PalletNo,
    string? PalletSSCC,
    System.Collections.Generic.IEnumerable<string>? CartonItems = null
);

public record PrintJobDto(
    Guid Id,
    string LabelType,
    Guid EntityId,
    string EntityNo,
    string? PrintedBy,
    int PrintCount,
    string Format,
    DateTime CreatedAt
);

public record SystemInfoDto(
    string AppVersion,
    string BuildDate,
    string GitCommitSHA,
    string ApiStatus,
    string DbConnectivity,
    string FrontendApiUrl,
    int TotalOrders,
    int TotalCodes
);
