using System;
using System.Text.Json;
using System.Threading.Tasks;
using Dapper;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Infrastructure.Services;

public class AuditLogService : IAuditLogService
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;

    public AuditLogService(IDbConnectionFactory dbConnectionFactory, ICurrentUserService currentUserService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
    }

    public async Task LogAsync(string entityName, Guid? entityId, string action, object? oldValue = null, object? newValue = null)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = @"
            INSERT INTO AuditLogs (Id, UserId, EntityName, EntityId, Action, OldValue, NewValue, CreatedAt, IpAddress)
            VALUES (@Id, @UserId, @EntityName, @EntityId, @Action, @OldValue::jsonb, @NewValue::jsonb, @CreatedAt, @IpAddress)";

        string? oldJson = oldValue != null ? JsonSerializer.Serialize(oldValue) : null;
        string? newJson = newValue != null ? JsonSerializer.Serialize(newValue) : null;

        await connection.ExecuteAsync(sql, new
        {
            Id = Guid.NewGuid(),
            UserId = _currentUserService.UserId,
            EntityName = entityName,
            EntityId = entityId,
            Action = action,
            OldValue = oldJson,
            NewValue = newJson,
            CreatedAt = DateTime.UtcNow,
            IpAddress = _currentUserService.IpAddress
        });
    }
}
