using System;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.SystemSettings;

public class SettingDto
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

public class GetSettingQuery : IRequest<SettingDto?>
{
    public string Key { get; set; }
    public GetSettingQuery(string key) => Key = key;
}

public class GetSettingQueryHandler : IRequestHandler<GetSettingQuery, SettingDto?>
{
    private readonly IDbConnectionFactory _connectionFactory;

    public GetSettingQueryHandler(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<SettingDto?> Handle(GetSettingQuery request, CancellationToken cancellationToken)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = "SELECT Key, Value, UpdatedAt FROM SystemSettings WHERE Key = @Key";
        return await connection.QueryFirstOrDefaultAsync<SettingDto>(sql, new { request.Key });
    }
}

public class UpdateSettingCommand : IRequest<bool>
{
    public string Key { get; set; }
    public string Value { get; set; }
    public UpdateSettingCommand(string key, string value)
    {
        Key = key;
        Value = value;
    }
}

public class UpdateSettingCommandHandler : IRequestHandler<UpdateSettingCommand, bool>
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ICurrentUserService _currentUserService;

    public UpdateSettingCommandHandler(IDbConnectionFactory connectionFactory, ICurrentUserService currentUserService)
    {
        _connectionFactory = connectionFactory;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(UpdateSettingCommand request, CancellationToken cancellationToken)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = @"
            INSERT INTO SystemSettings (Id, Key, Value, UpdatedBy, UpdatedAt)
            VALUES (@Id, @Key, @Value::jsonb, @UpdatedBy, @UpdatedAt)
            ON CONFLICT (Key) 
            DO UPDATE SET Value = @Value::jsonb, UpdatedBy = @UpdatedBy, UpdatedAt = @UpdatedAt;
        ";
        
        var rows = await connection.ExecuteAsync(sql, new 
        {
            Id = Guid.NewGuid(),
            Key = request.Key,
            Value = request.Value,
            UpdatedBy = _currentUserService.UserId,
            UpdatedAt = DateTime.UtcNow
        });

        return rows > 0;
    }
}
