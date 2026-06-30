namespace TrackTrace.Domain.Enums;

public enum OrderStatus
{
    Draft,
    Active,
    Completed,
    Cancelled
}

public enum ProductCodeStatus
{
    Uploaded,
    Scanned,
    Packed,
    Shipped
}

public enum CartonStatus
{
    Open,
    Closed,
    Printed,
    Palletized
}

public enum PalletStatus
{
    Open,
    Closed,
    Printed,
    Shipped
}

public enum UserRole
{
    Admin,
    Operator,
    Viewer
}

public enum ExportJobStatus
{
    Pending,
    Processing,
    Completed,
    Failed
}
