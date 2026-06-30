using System;
using TrackTrace.Domain.Enums;

namespace TrackTrace.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Username { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Order
{
    public Guid Id { get; set; }
    public string OrderNo { get; set; } = null!;
    public string CustomerName { get; set; } = null!;
    public string? StockCode { get; set; }
    public string? ProductName { get; set; }
    public string GTIN { get; set; } = null!;
    public int ProductPerCarton { get; set; }
    public int CartonPerPallet { get; set; }
    public int ExpectedQuantity { get; set; }
    public string? Description { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ProductCode
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid? ImportBatchId { get; set; }
    public string RawCode { get; set; } = null!;
    public string? Gtin { get; set; }
    public string? SerialNo { get; set; }
    public string? CryptoTail { get; set; }
    public ProductCodeStatus Status { get; set; } = ProductCodeStatus.Uploaded;
    public Guid? CartonId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ScannedAt { get; set; }
    public Guid? ScannedBy { get; set; }
}

public class Carton
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string CartonNo { get; set; } = null!;
    public string SSCC { get; set; } = null!;
    public int TargetQuantity { get; set; }
    public int ActualQuantity { get; set; }
    public CartonStatus Status { get; set; } = CartonStatus.Open;
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }
    public DateTime? PrintedAt { get; set; }
}

public class Pallet
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string PalletNo { get; set; } = null!;
    public string SSCC { get; set; } = null!;
    public PalletStatus Status { get; set; } = PalletStatus.Open;
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }
    public DateTime? PrintedAt { get; set; }
}

public class PalletCarton
{
    public Guid Id { get; set; }
    public Guid PalletId { get; set; }
    public Guid CartonId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ImportBatch
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string? FileName { get; set; }
    public int TotalRows { get; set; }
    public int ImportedCount { get; set; }
    public int DuplicateCount { get; set; }
    public int InvalidCount { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ImportError
{
    public Guid Id { get; set; }
    public Guid ImportBatchId { get; set; }
    public int RowNo { get; set; }
    public string? RawLine { get; set; }
    public string ErrorMessage { get; set; } = null!;
}

public class PrintJob
{
    public Guid Id { get; set; }
    public string LabelType { get; set; } = null!; // "Carton" or "Pallet"
    public Guid EntityId { get; set; }
    public Guid? PrintedBy { get; set; }
    public int PrintCount { get; set; } = 1;
    public string Format { get; set; } = null!; // "PDF" or "ZPL"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string EntityName { get; set; } = null!;
    public Guid? EntityId { get; set; }
    public string Action { get; set; } = null!;
    public string? OldValue { get; set; } // JSON format
    public string? NewValue { get; set; } // JSON format
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
}

public class ExportJob
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string OrderNo { get; set; } = null!;
    public string? StockCode { get; set; }
    public string ExportFormat { get; set; } = null!;
    public ExportJobStatus Status { get; set; } = ExportJobStatus.Pending;
    public int Progress { get; set; } = 0;
    public string? FilePath { get; set; }
    public Guid? DownloadToken { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}
