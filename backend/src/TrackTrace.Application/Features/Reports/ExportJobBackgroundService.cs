using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Reports;

public class ExportJobBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ExportJobBackgroundService> _logger;

    public ExportJobBackgroundService(IServiceProvider serviceProvider, ILogger<ExportJobBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RecoverStuckJobsAsync(stoppingToken);
                await ProcessPendingJobsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Background export job processing error.");
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task ProcessPendingJobsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbConnectionFactory = scope.ServiceProvider.GetRequiredService<IDbConnectionFactory>();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        using var connection = dbConnectionFactory.CreateConnection();
        connection.Open();

        // Find a pending job
        // In PostgreSQL we could use FOR UPDATE SKIP LOCKED, but let's do a simple lock for now
        var job = await connection.QueryFirstOrDefaultAsync<ExportJobDto>(
            "SELECT * FROM ExportJobs WHERE Status = 'Pending' ORDER BY CreatedAt ASC LIMIT 1"
        );

        if (job == null) return;

        // Try to lock it to Processing
        var rowsAffected = await connection.ExecuteAsync(
            "UPDATE ExportJobs SET Status = 'Processing', StartedAt = @StartedAt WHERE Id = @Id AND Status = 'Pending'",
            new { StartedAt = DateTime.UtcNow, Id = job.Id }
        );

        if (rowsAffected == 0) return; // Someone else picked it up

        try
        {
            _logger.LogInformation($"Starting export job {job.Id}");
            
            // Mocking progress
            await connection.ExecuteAsync("UPDATE ExportJobs SET Progress = 10 WHERE Id = @Id", new { Id = job.Id });

            // Generate report using existing query
            var result = await mediator.Send(new GetOrderReportExcelQuery(job.OrderNo, job.StockCode, false), cancellationToken);

            await connection.ExecuteAsync("UPDATE ExportJobs SET Progress = 90 WHERE Id = @Id", new { Id = job.Id });

            // Save to disk
            var exportDir = "/app/data/exports";
            if (Environment.OSVersion.Platform == PlatformID.Win32NT)
            {
                exportDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "exports");
            }
            
            if (!Directory.Exists(exportDir))
            {
                Directory.CreateDirectory(exportDir);
            }

            var filePath = Path.Combine(exportDir, $"{job.Id}_{result.FileName}");
            await File.WriteAllBytesAsync(filePath, result.Bytes, cancellationToken);

            // Mark complete
            var downloadToken = Guid.NewGuid();
            await connection.ExecuteAsync(
                @"UPDATE ExportJobs 
                  SET Status = 'Completed', Progress = 100, CompletedAt = @CompletedAt, 
                      FilePath = @FilePath, DownloadToken = @DownloadToken, ExpiresAt = @ExpiresAt
                  WHERE Id = @Id",
                new 
                { 
                    CompletedAt = DateTime.UtcNow,
                    FilePath = filePath,
                    DownloadToken = downloadToken,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    Id = job.Id 
                }
            );

            _logger.LogInformation($"Export job {job.Id} completed successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Export job {job.Id} failed.");
            await connection.ExecuteAsync(
                "UPDATE ExportJobs SET Status = 'Failed', ErrorMessage = @Error, CompletedAt = @CompletedAt WHERE Id = @Id",
                new { Error = ex.Message, CompletedAt = DateTime.UtcNow, Id = job.Id }
            );
        }
    }

    private async Task RecoverStuckJobsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbConnectionFactory = scope.ServiceProvider.GetRequiredService<IDbConnectionFactory>();

        using var connection = dbConnectionFactory.CreateConnection();
        // Since we call this every 5 seconds, let's just do a quick check without tracking.
        var threshold = DateTime.UtcNow.AddMinutes(-30);
        
        var stuckJobs = await connection.QueryAsync<ExportJobDto>(
            "SELECT * FROM ExportJobs WHERE Status = 'Processing' AND StartedAt < @Threshold",
            new { Threshold = threshold }
        );

        foreach (var job in stuckJobs)
        {
            _logger.LogWarning($"Recovering stuck job {job.Id}");
            
            await connection.ExecuteAsync(
                "UPDATE ExportJobs SET Status = 'Failed', ErrorMessage = 'Job interrupted and reset/recovered after timeout.', CompletedAt = @CompletedAt WHERE Id = @Id",
                new { CompletedAt = DateTime.UtcNow, Id = job.Id }
            );

            // Delete orphaned files if any
            var exportDir = "/app/data/exports";
            if (Environment.OSVersion.Platform == PlatformID.Win32NT)
            {
                exportDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "exports");
            }

            if (Directory.Exists(exportDir))
            {
                var files = Directory.GetFiles(exportDir, $"{job.Id}_*.*");
                foreach (var file in files)
                {
                    try
                    {
                        File.Delete(file);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Failed to delete orphaned file {file} for stuck job {job.Id}");
                    }
                }
            }
        }
    }
}
