using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Reports;

public class ExportJobDto
{
    public Guid Id { get; set; }
    public string OrderNo { get; set; } = null!;
    public string? StockCode { get; set; }
    public string ExportFormat { get; set; } = null!;
    public string Status { get; set; } = null!;
    public int Progress { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? DownloadToken { get; set; }
}

public record CreateExportJobCommand(string OrderNo, string? StockCode, string Format) : IRequest<Guid>;
public record GetExportJobsQuery : IRequest<List<ExportJobDto>>;
public record GetExportJobStatusQuery(Guid JobId) : IRequest<ExportJobDto?>;

public class ExportJobFeaturesHandler : 
    IRequestHandler<CreateExportJobCommand, Guid>,
    IRequestHandler<GetExportJobsQuery, List<ExportJobDto>>,
    IRequestHandler<GetExportJobStatusQuery, ExportJobDto?>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;

    public ExportJobFeaturesHandler(IDbConnectionFactory dbConnectionFactory, ICurrentUserService currentUserService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
    }

    public async Task<Guid> Handle(CreateExportJobCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserService.UserId.HasValue)
            throw new UnauthorizedAccessException("Giriş yapmanız gerekiyor.");

        var userId = _currentUserService.UserId.Value;
        var jobId = Guid.NewGuid();

        const string sql = @"
            INSERT INTO ExportJobs (Id, UserId, OrderNo, StockCode, ExportFormat, Status, Progress, CreatedAt)
            VALUES (@Id, @UserId, @OrderNo, @StockCode, @ExportFormat, 'Pending', 0, @CreatedAt)
        ";

        using var connection = _dbConnectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, new 
        {
            Id = jobId,
            UserId = userId,
            OrderNo = request.OrderNo,
            StockCode = request.StockCode,
            ExportFormat = request.Format,
            CreatedAt = DateTime.UtcNow
        });

        return jobId;
    }

    public async Task<List<ExportJobDto>> Handle(GetExportJobsQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserService.UserId.HasValue)
            throw new UnauthorizedAccessException();

        var userId = _currentUserService.UserId.Value;
        var role = _currentUserService.Role;

        using var connection = _dbConnectionFactory.CreateConnection();
        string sql;
        object parameters;

        if (role == "Admin")
        {
            sql = "SELECT * FROM ExportJobs ORDER BY CreatedAt DESC LIMIT 100";
            parameters = new { };
        }
        else
        {
            sql = "SELECT * FROM ExportJobs WHERE UserId = @UserId ORDER BY CreatedAt DESC LIMIT 100";
            parameters = new { UserId = userId };
        }

        var results = await connection.QueryAsync<ExportJobDto>(sql, parameters);
        return results.ToList();
    }

    public async Task<ExportJobDto?> Handle(GetExportJobStatusQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserService.UserId.HasValue)
            throw new UnauthorizedAccessException();

        var userId = _currentUserService.UserId.Value;
        var role = _currentUserService.Role;

        using var connection = _dbConnectionFactory.CreateConnection();
        var sql = "SELECT * FROM ExportJobs WHERE Id = @Id";
        var job = await connection.QueryFirstOrDefaultAsync<ExportJobDto>(sql, new { Id = request.JobId });

        if (job != null)
        {
            var dbJobUserId = await connection.QueryFirstOrDefaultAsync<Guid>("SELECT UserId FROM ExportJobs WHERE Id = @Id", new { Id = request.JobId });
            if (role != "Admin" && dbJobUserId != userId)
            {
                throw new UnauthorizedAccessException("Bu işleme erişim yetkiniz yok.");
            }
        }

        return job;
    }
}
