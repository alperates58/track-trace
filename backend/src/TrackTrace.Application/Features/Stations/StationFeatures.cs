using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using FluentValidation;
using MediatR;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Stations;

public record GetStationsQuery(bool IncludeInactive = false) : IRequest<IEnumerable<StationDto>>;

public record CreateStationCommand(CreateStationRequest Request) : IRequest<StationDto>;

public record UpdateStationCommand(Guid Id, UpdateStationRequest Request) : IRequest<StationDto>;

public class StationHandlers :
    IRequestHandler<GetStationsQuery, IEnumerable<StationDto>>,
    IRequestHandler<CreateStationCommand, StationDto>,
    IRequestHandler<UpdateStationCommand, StationDto>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IAuditLogService _auditLogService;

    public StationHandlers(IDbConnectionFactory dbConnectionFactory, IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _auditLogService = auditLogService;
    }

    public async Task<IEnumerable<StationDto>> Handle(GetStationsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var sql = "SELECT * FROM Stations";
        if (!request.IncludeInactive)
        {
            sql += " WHERE IsActive = TRUE";
        }
        sql += " ORDER BY Name ASC";

        var stations = await connection.QueryAsync<dynamic>(sql);
        
        return stations.Select(x => new StationDto(
            (Guid)x.id,
            (string)x.name,
            (bool)x.isactive,
            (DateTime)x.createdat
        ));
    }

    public async Task<StationDto> Handle(CreateStationCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        var id = Guid.NewGuid();
        var createdAt = DateTime.UtcNow;

        const string sql = @"
            INSERT INTO Stations (Id, Name, IsActive, CreatedAt) 
            VALUES (@Id, @Name, @IsActive, @CreatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            Id = id,
            Name = request.Request.Name,
            IsActive = request.Request.IsActive,
            CreatedAt = createdAt
        });

        await _auditLogService.LogAsync("Stations", id, "Create", null, new { Name = request.Request.Name, IsActive = request.Request.IsActive });

        return new StationDto(id, request.Request.Name, request.Request.IsActive, createdAt);
    }

    public async Task<StationDto> Handle(UpdateStationCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        const string checkSql = "SELECT * FROM Stations WHERE Id = @Id";
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>(checkSql, new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("İstasyon bulunamadı.");

        const string updateSql = @"
            UPDATE Stations 
            SET Name = @Name, IsActive = @IsActive 
            WHERE Id = @Id";

        await connection.ExecuteAsync(updateSql, new
        {
            Id = request.Id,
            Name = request.Request.Name,
            IsActive = request.Request.IsActive
        });

        await _auditLogService.LogAsync("Stations", request.Id, "Update", 
            new { Name = existing.name, IsActive = existing.isactive }, 
            new { Name = request.Request.Name, IsActive = request.Request.IsActive });

        return new StationDto(request.Id, request.Request.Name, request.Request.IsActive, (DateTime)existing.createdat);
    }
}
