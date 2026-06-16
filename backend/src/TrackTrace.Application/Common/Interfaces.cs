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
}
