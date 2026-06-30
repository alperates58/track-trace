using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.System;

public class AuditLogDto
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public string EntityName { get; set; } = null!;
    public Guid? EntityId { get; set; }
    public string Action { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string? IpAddress { get; set; }
}

public class AuditLogDetailDto : AuditLogDto
{
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
}

public class PaginatedList<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
}

public record GetAuditLogsQuery(
    int PageNumber = 1, 
    int PageSize = 50, 
    DateTime? StartDate = null, 
    DateTime? EndDate = null, 
    Guid? UserId = null, 
    string? EntityName = null, 
    string? Action = null) : IRequest<PaginatedList<AuditLogDto>>;

public record GetAuditLogDetailQuery(Guid Id) : IRequest<AuditLogDetailDto?>;

public class AuditLogFeaturesHandler : 
    IRequestHandler<GetAuditLogsQuery, PaginatedList<AuditLogDto>>,
    IRequestHandler<GetAuditLogDetailQuery, AuditLogDetailDto?>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public AuditLogFeaturesHandler(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<PaginatedList<AuditLogDto>> Handle(GetAuditLogsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var filters = new List<string>();
        var parameters = new DynamicParameters();

        if (request.StartDate.HasValue)
        {
            filters.Add("a.CreatedAt >= @StartDate");
            parameters.Add("StartDate", request.StartDate.Value);
        }
        if (request.EndDate.HasValue)
        {
            filters.Add("a.CreatedAt <= @EndDate");
            parameters.Add("EndDate", request.EndDate.Value);
        }
        if (request.UserId.HasValue)
        {
            filters.Add("a.UserId = @UserId");
            parameters.Add("UserId", request.UserId.Value);
        }
        if (!string.IsNullOrWhiteSpace(request.EntityName))
        {
            filters.Add("a.EntityName = @EntityName");
            parameters.Add("EntityName", request.EntityName);
        }
        if (!string.IsNullOrWhiteSpace(request.Action))
        {
            filters.Add("a.Action = @Action");
            parameters.Add("Action", request.Action);
        }

        string whereClause = filters.Any() ? "WHERE " + string.Join(" AND ", filters) : "";

        string countSql = $"SELECT COUNT(*) FROM AuditLogs a {whereClause}";
        int totalCount = await connection.ExecuteScalarAsync<int>(countSql, parameters);

        string querySql = $@"
            SELECT 
                a.Id, a.UserId, u.Name as UserName, a.EntityName, a.EntityId, a.Action, a.CreatedAt, a.IpAddress
            FROM AuditLogs a
            LEFT JOIN Users u ON a.UserId = u.Id
            {whereClause}
            ORDER BY a.CreatedAt DESC
            LIMIT @Limit OFFSET @Offset";

        parameters.Add("Limit", request.PageSize);
        parameters.Add("Offset", (request.PageNumber - 1) * request.PageSize);

        var items = await connection.QueryAsync<AuditLogDto>(querySql, parameters);

        return new PaginatedList<AuditLogDto>
        {
            Items = items.ToList(),
            TotalCount = totalCount
        };
    }

    public async Task<AuditLogDetailDto?> Handle(GetAuditLogDetailQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        string sql = @"
            SELECT 
                a.Id, a.UserId, u.Name as UserName, a.EntityName, a.EntityId, a.Action, a.CreatedAt, a.IpAddress,
                a.OldValue::text, a.NewValue::text
            FROM AuditLogs a
            LEFT JOIN Users u ON a.UserId = u.Id
            WHERE a.Id = @Id";

        return await connection.QueryFirstOrDefaultAsync<AuditLogDetailDto>(sql, new { Id = request.Id });
    }
}
