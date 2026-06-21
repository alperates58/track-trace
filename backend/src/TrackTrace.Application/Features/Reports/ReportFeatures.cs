using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Reports;

// Existing Queries
public record GetDashboardSummaryQuery : IRequest<DashboardSummaryDto>;

public record BarcodeSearchQuery(string RawCode) : IRequest<BarcodeSearchResultDto?>;

public record GetSystemInfoQuery(string AppVersion, string BuildDate, string GitCommitSha, string FrontendApiUrl) : IRequest<SystemInfoDto>;

public record GetPrintJobsQuery(int PageNumber = 1, int PageSize = 10) : IRequest<(IEnumerable<PrintJobDto> Items, int TotalCount)>;

// New Report Queries
public record GetOrderReportsQuery(
    int PageNumber = 1,
    int PageSize = 10,
    string? OrderNo = null,
    string? StockCode = null,
    DateTime? StartDate = null,
    DateTime? EndDate = null,
    string? Status = null,
    bool? OnlyMissing = null,
    bool? OnlyUsed = null,
    bool? OnlyCartoned = null,
    bool? OnlyPalletized = null
) : IRequest<(IEnumerable<object> Items, int TotalCount)>;

public record GetOrderDetailReportQuery(string OrderNo) : IRequest<object>;

public record GetStockCodeDetailQuery(Guid OrderId) : IRequest<object>;

public record GetStockCodeUsedCodesQuery(
    Guid OrderId,
    int PageNumber = 1,
    int PageSize = 10,
    string? Search = null,
    string? CartonNo = null,
    string? PalletNo = null
) : IRequest<(IEnumerable<object> Items, int TotalCount)>;

public record GetStockCodeMissingCodesQuery(
    Guid OrderId,
    int PageNumber = 1,
    int PageSize = 10,
    string? Search = null
) : IRequest<(IEnumerable<object> Items, int TotalCount)>;

public record GetStockCodeCartonsQuery(
    Guid OrderId,
    int PageNumber = 1,
    int PageSize = 10,
    string? Search = null
) : IRequest<(IEnumerable<object> Items, int TotalCount)>;

public record GetStockCodePalletsQuery(
    Guid OrderId,
    int PageNumber = 1,
    int PageSize = 10,
    string? Search = null
) : IRequest<(IEnumerable<object> Items, int TotalCount)>;

public record GetOrderReportExcelQuery(string OrderNo, string? StockCode = null) : IRequest<byte[]>;

public record GetOrderReportPdfQuery(string OrderNo) : IRequest<byte[]>;

public class ReportHandlers :
    IRequestHandler<GetDashboardSummaryQuery, DashboardSummaryDto>,
    IRequestHandler<BarcodeSearchQuery, BarcodeSearchResultDto?>,
    IRequestHandler<GetSystemInfoQuery, SystemInfoDto>,
    IRequestHandler<GetPrintJobsQuery, (IEnumerable<PrintJobDto> Items, int TotalCount)>,
    
    // New Handlers
    IRequestHandler<GetOrderReportsQuery, (IEnumerable<object> Items, int TotalCount)>,
    IRequestHandler<GetOrderDetailReportQuery, object>,
    IRequestHandler<GetStockCodeDetailQuery, object>,
    IRequestHandler<GetStockCodeUsedCodesQuery, (IEnumerable<object> Items, int TotalCount)>,
    IRequestHandler<GetStockCodeMissingCodesQuery, (IEnumerable<object> Items, int TotalCount)>,
    IRequestHandler<GetStockCodeCartonsQuery, (IEnumerable<object> Items, int TotalCount)>,
    IRequestHandler<GetStockCodePalletsQuery, (IEnumerable<object> Items, int TotalCount)>,
    IRequestHandler<GetOrderReportExcelQuery, byte[]>,
    IRequestHandler<GetOrderReportPdfQuery, byte[]>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IReportPdfGenerator _reportPdfGenerator;

    public ReportHandlers(IDbConnectionFactory dbConnectionFactory, IReportPdfGenerator reportPdfGenerator)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _reportPdfGenerator = reportPdfGenerator;
    }

    #region Existing Handlers
    public async Task<DashboardSummaryDto> Handle(GetDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        const string sql = @"
            SELECT 
                (SELECT COUNT(*) FROM Orders WHERE Status = 'Active') as ActiveOrders,
                (SELECT COUNT(*) FROM Cartons WHERE Status = 'Open') as OpenCartons,
                (SELECT COUNT(*) FROM Pallets WHERE Status = 'Open') as OpenPallets,
                (SELECT COUNT(*) FROM ProductCodes WHERE Status = 'Scanned' AND ScannedAt >= CURRENT_DATE) as ScannedToday,
                (SELECT COUNT(*) FROM Cartons WHERE CreatedAt >= CURRENT_DATE) as CartonsToday,
                (SELECT COUNT(*) FROM Pallets WHERE CreatedAt >= CURRENT_DATE) as PalletsToday";

        var stats = await connection.QueryFirstOrDefaultAsync<dynamic>(sql);

        // Fetch recent activities
        const string actSql = @"
            SELECT al.Action, al.EntityName, al.CreatedAt, u.Name as UserName
            FROM AuditLogs al
            LEFT JOIN Users u ON al.UserId = u.Id
            ORDER BY al.CreatedAt DESC
            LIMIT 10";

        var activities = await connection.QueryAsync<dynamic>(actSql);

        var recentActivities = activities.Select(x => {
            string userName = x.username ?? "Sistem";
            string action = x.action;
            string entity = x.entityname;
            string message = $"{userName} tarafından {entity} tablosunda '{action}' işlemi yapıldı.";
            return new RecentActivityDto(message, (DateTime)x.createdat, userName);
        }).ToList();

        return new DashboardSummaryDto(
            stats == null ? 0 : (int)stats.activeorders,
            stats == null ? 0 : (int)stats.opencartons,
            stats == null ? 0 : (int)stats.openpallets,
            stats == null ? 0 : Convert.ToInt32(stats.scannedtoday),
            stats == null ? 0 : Convert.ToInt32(stats.cartonstoday),
            stats == null ? 0 : Convert.ToInt32(stats.palletstoday),
            recentActivities
        );
    }

    private static string ExtractSscc(string query)
    {
        return Gs1AutoHelper.ExtractSscc(query);
    }

    public async Task<BarcodeSearchResultDto?> Handle(BarcodeSearchQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = @"
            SELECT pc.RawCode, pc.Gtin, pc.SerialNo, pc.Status, pc.ScannedAt, u.Name as ScannedBy,
                   o.OrderNo, o.CustomerName, o.ProductName,
                   c.CartonNo, c.SSCC as CartonSSCC,
                   p.PalletNo, p.SSCC as PalletSSCC
            FROM ProductCodes pc
            INNER JOIN Orders o ON pc.OrderId = o.Id
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            LEFT JOIN Cartons c ON pc.CartonId = c.Id
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            WHERE pc.RawCode = @RawCode";

        var x = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { RawCode = request.RawCode });
        if (x != null)
        {
            return new BarcodeSearchResultDto(
                (string)x.rawcode,
                (string?)x.gtin,
                (string?)x.serialno,
                (string)x.status,
                (DateTime?)x.scannedat,
                (string?)x.scannedby,
                (string?)x.orderno,
                (string?)x.customername,
                (string?)x.productname,
                (string?)x.cartonno,
                (string?)x.cartonsscc,
                (string?)x.palletno,
                (string?)x.palletsscc
            );
        }

        // Try searching for Carton if not found as a product code
        string cleanSearch = ExtractSscc(request.RawCode);
        const string cartonSql = @"
            SELECT c.Id, c.CartonNo, c.SSCC as CartonSSCC, c.Status, c.CreatedAt,
                   o.OrderNo, o.CustomerName, o.ProductName, o.Gtin,
                   p.PalletNo, p.SSCC as PalletSSCC
            FROM Cartons c
            INNER JOIN Orders o ON c.OrderId = o.Id
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            WHERE c.SSCC = @Search OR c.CartonNo = @Search";

        var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(cartonSql, new { Search = cleanSearch });
        if (carton != null)
        {
            const string itemsSql = "SELECT RawCode FROM ProductCodes WHERE CartonId = @CartonId ORDER BY ScannedAt DESC";
            var items = await connection.QueryAsync<string>(itemsSql, new { CartonId = (Guid)carton.id });

            return new BarcodeSearchResultDto(
                RawCode: request.RawCode,
                Gtin: (string?)carton.gtin,
                SerialNo: null,
                Status: (string)carton.status,
                ScannedAt: (DateTime)carton.createdat,
                ScannedBy: null,
                OrderNo: (string?)carton.orderno,
                CustomerName: (string?)carton.customername,
                ProductName: (string?)carton.productname,
                CartonNo: (string?)carton.cartonno,
                CartonSSCC: (string?)carton.cartonsscc,
                PalletNo: (string?)carton.palletno,
                PalletSSCC: (string?)carton.palletsscc,
                CartonItems: items
            );
        }

        return null;
    }

    public async Task<SystemInfoDto> Handle(GetSystemInfoQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        string dbConnectivity = "Sağlıklı";
        int totalOrders = 0;
        int totalCodes = 0;

        try
        {
            totalOrders = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Orders");
            totalCodes = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM ProductCodes");
        }
        catch (Exception)
        {
            dbConnectivity = "Hatalı / Bağlantı Yok";
        }

        return new SystemInfoDto(
            request.AppVersion,
            request.BuildDate,
            request.GitCommitSha,
            "Aktif",
            dbConnectivity,
            request.FrontendApiUrl,
            totalOrders,
            totalCodes
        );
    }

    public async Task<(IEnumerable<PrintJobDto> Items, int TotalCount)> Handle(GetPrintJobsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        const string sql = @"
            SELECT pj.*, u.Name as PrintedByName,
                   CASE 
                     WHEN pj.LabelType = 'Carton' THEN (SELECT CartonNo FROM Cartons WHERE Id = pj.EntityId)
                     ELSE (SELECT PalletNo FROM Pallets WHERE Id = pj.EntityId)
                   END as EntityNo
            FROM PrintJobs pj
            LEFT JOIN Users u ON pj.PrintedBy = u.Id
            ORDER BY pj.CreatedAt DESC
            LIMIT @Limit OFFSET @Offset";

        const string countSql = "SELECT COUNT(*) FROM PrintJobs";

        var items = await connection.QueryAsync<dynamic>(sql, new { Limit = request.PageSize, Offset = (request.PageNumber - 1) * request.PageSize });
        var totalCount = await connection.ExecuteScalarAsync<int>(countSql);

        var dtos = items.Select(x => new PrintJobDto(
            (Guid)x.id,
            (string)x.labeltype,
            (Guid)x.entityid,
            x.entityno ?? "Bilinmiyor",
            (string?)x.printedbyname,
            (int)x.printcount,
            (string)x.format,
            (DateTime)x.createdat
        ));

        return (dtos, totalCount);
    }
    #endregion

    #region New Reporting Handlers
    public async Task<(IEnumerable<object> Items, int TotalCount)> Handle(GetOrderReportsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        string baseCte = @"
        WITH RawReport AS (
            SELECT 
                o.OrderNo,
                MAX(o.CustomerName) as CustomerName,
                COUNT(DISTINCT o.StockCode) as TotalStockCodes,
                SUM(o.ExpectedQuantity) as ExpectedQuantity,
                COALESCE(SUM(pc.UsedCount), 0) as UsedQuantity,
                COALESCE(SUM(pc.UploadedCount), 0) as MissingQuantity,
                COALESCE(SUM(c.CartonCount), 0) as TotalCartons,
                COALESCE(SUM(p.PalletCount), 0) as TotalPallets,
                COALESCE(MAX(pc.LastScannedAt), MAX(o.UpdatedAt)) as LastProcessedAt
            FROM Orders o
            LEFT JOIN (
                SELECT 
                    OrderId,
                    COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount,
                    COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount,
                    MAX(ScannedAt) as LastScannedAt
                FROM ProductCodes
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId
            ) p ON o.Id = p.OrderId
            {0}
            GROUP BY o.OrderNo
        )";

        var innerFilters = new List<string>();
        var outerFilters = new List<string>();
        var parameters = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(request.OrderNo))
        {
            innerFilters.Add("o.OrderNo ILIKE @OrderNo");
            parameters.Add("OrderNo", $"%{request.OrderNo}%");
        }
        if (!string.IsNullOrWhiteSpace(request.StockCode))
        {
            innerFilters.Add("o.StockCode ILIKE @StockCode");
            parameters.Add("StockCode", $"%{request.StockCode}%");
        }
        if (request.StartDate.HasValue)
        {
            innerFilters.Add("o.CreatedAt >= @StartDate");
            parameters.Add("StartDate", request.StartDate.Value);
        }
        if (request.EndDate.HasValue)
        {
            innerFilters.Add("o.CreatedAt <= @EndDate");
            parameters.Add("EndDate", request.EndDate.Value);
        }
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            innerFilters.Add("o.Status = @Status");
            parameters.Add("Status", request.Status);
        }

        if (request.OnlyMissing == true)
        {
            outerFilters.Add("MissingQuantity > 0");
        }
        if (request.OnlyUsed == true)
        {
            outerFilters.Add("UsedQuantity > 0");
        }
        if (request.OnlyCartoned == true)
        {
            outerFilters.Add("TotalCartons > 0");
        }
        if (request.OnlyPalletized == true)
        {
            outerFilters.Add("TotalPallets > 0");
        }

        string innerWhere = innerFilters.Any() ? "WHERE " + string.Join(" AND ", innerFilters) : "";
        string outerWhere = outerFilters.Any() ? "WHERE " + string.Join(" AND ", outerFilters) : "";

        string cte = string.Format(baseCte, innerWhere);

        string querySql = $@"
        {cte}
        SELECT * FROM RawReport
        {outerWhere}
        ORDER BY LastProcessedAt DESC
        LIMIT @Limit OFFSET @Offset";

        string countSql = $@"
        {cte}
        SELECT COUNT(*) FROM RawReport
        {outerWhere}";

        parameters.Add("Limit", request.PageSize);
        parameters.Add("Offset", (request.PageNumber - 1) * request.PageSize);

        var items = await connection.QueryAsync<dynamic>(querySql, parameters);
        var total = await connection.ExecuteScalarAsync<int>(countSql, parameters);

        return (items, total);
    }

    public async Task<object> Handle(GetOrderDetailReportQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        const string summarySql = @"
            SELECT 
                o.OrderNo,
                MAX(o.CustomerName) as CustomerName,
                COUNT(DISTINCT o.StockCode) as TotalStockCodes,
                SUM(o.ExpectedQuantity) as ExpectedQuantity,
                COALESCE(SUM(pc.UsedCount), 0) as UsedQuantity,
                COALESCE(SUM(pc.UploadedCount), 0) as MissingQuantity,
                COALESCE(SUM(c.CartonCount), 0) as TotalCartons,
                COALESCE(SUM(p.PalletCount), 0) as TotalPallets,
                COALESCE(MAX(pc.LastScannedAt), MAX(o.UpdatedAt)) as LastProcessedAt
            FROM Orders o
            LEFT JOIN (
                SELECT 
                    OrderId,
                    COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount,
                    COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount,
                    MAX(ScannedAt) as LastScannedAt
                FROM ProductCodes
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId
            ) p ON o.Id = p.OrderId
            WHERE o.OrderNo = @OrderNo
            GROUP BY o.OrderNo";

        var summary = await connection.QueryFirstOrDefaultAsync<dynamic>(summarySql, new { OrderNo = request.OrderNo });
        if (summary == null)
        {
            throw new KeyNotFoundException("Sipariş bulunamadı.");
        }

        const string stockCodesSql = @"
            SELECT 
                o.Id as OrderId,
                o.StockCode,
                o.ProductName,
                o.ExpectedQuantity,
                COALESCE(pc.UsedCount, 0) as UsedQuantity,
                COALESCE(pc.UploadedCount, 0) as MissingQuantity,
                COALESCE(c.CartonCount, 0) as CartonCount,
                COALESCE(p.PalletCount, 0) as PalletCount,
                o.Status
            FROM Orders o
            LEFT JOIN (
                SELECT 
                    OrderId,
                    COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount,
                    COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount
                FROM ProductCodes
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId
            ) p ON o.Id = p.OrderId
            WHERE o.OrderNo = @OrderNo
            ORDER BY o.StockCode ASC";

        var stockCodes = await connection.QueryAsync<dynamic>(stockCodesSql, new { OrderNo = request.OrderNo });

        return new { Summary = summary, StockCodes = stockCodes };
    }

    public async Task<object> Handle(GetStockCodeDetailQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        const string sql = @"
            SELECT 
                o.Id as OrderId,
                o.OrderNo,
                o.CustomerName,
                o.StockCode,
                o.ProductName,
                o.GTIN,
                o.ExpectedQuantity,
                COALESCE(pc.UsedCount, 0) as UsedQuantity,
                COALESCE(pc.UploadedCount, 0) as MissingQuantity,
                COALESCE(c.CartonCount, 0) as CartonCount,
                COALESCE(p.PalletCount, 0) as PalletCount,
                o.Status,
                o.CreatedAt
            FROM Orders o
            LEFT JOIN (
                SELECT 
                    OrderId,
                    COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount,
                    COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount
                FROM ProductCodes
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId
            ) p ON o.Id = p.OrderId
            WHERE o.Id = @OrderId";

        var detail = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { OrderId = request.OrderId });
        if (detail == null)
        {
            throw new KeyNotFoundException("Stok kodu sipariş kaydı bulunamadı.");
        }

        return detail;
    }

    public async Task<(IEnumerable<object> Items, int TotalCount)> Handle(GetStockCodeUsedCodesQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        string countSql = @"
            SELECT COUNT(*) 
            FROM ProductCodes pc
            LEFT JOIN Cartons c ON pc.CartonId = c.Id
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            WHERE pc.OrderId = @OrderId AND pc.Status != 'Uploaded'";

        string querySql = @"
            SELECT 
                pc.Id,
                pc.RawCode,
                pc.Gtin,
                pc.SerialNo,
                pc.Status,
                pc.ScannedAt,
                u.Name as ScannedBy,
                c.CartonNo,
                p.PalletNo,
                (SELECT COUNT(*) FROM AuditLogs WHERE EntityName = 'ProductCodes' AND EntityId = pc.Id AND Action = 'DoubleScanAttempt') as DoubleScanAttempts
            FROM ProductCodes pc
            LEFT JOIN Cartons c ON pc.CartonId = c.Id
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            WHERE pc.OrderId = @OrderId AND pc.Status != 'Uploaded'";

        var parameters = new DynamicParameters();
        parameters.Add("OrderId", request.OrderId);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            string searchFilter = " AND (pc.RawCode ILIKE @Search OR pc.SerialNo ILIKE @Search OR c.CartonNo ILIKE @Search OR p.PalletNo ILIKE @Search)";
            countSql += searchFilter;
            querySql += searchFilter;
            parameters.Add("Search", $"%{request.Search}%");
        }
        if (!string.IsNullOrWhiteSpace(request.CartonNo))
        {
            string cartonFilter = " AND c.CartonNo = @CartonNo";
            countSql += cartonFilter;
            querySql += cartonFilter;
            parameters.Add("CartonNo", request.CartonNo);
        }
        if (!string.IsNullOrWhiteSpace(request.PalletNo))
        {
            string palletFilter = " AND p.PalletNo = @PalletNo";
            countSql += palletFilter;
            querySql += palletFilter;
            parameters.Add("PalletNo", request.PalletNo);
        }

        querySql += " ORDER BY pc.ScannedAt DESC LIMIT @Limit OFFSET @Offset";
        parameters.Add("Limit", request.PageSize);
        parameters.Add("Offset", (request.PageNumber - 1) * request.PageSize);

        var items = await connection.QueryAsync<dynamic>(querySql, parameters);
        var total = await connection.ExecuteScalarAsync<int>(countSql, parameters);

        return (items, total);
    }

    public async Task<(IEnumerable<object> Items, int TotalCount)> Handle(GetStockCodeMissingCodesQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        string countSql = "SELECT COUNT(*) FROM ProductCodes WHERE OrderId = @OrderId AND Status = 'Uploaded'";
        string querySql = "SELECT Id, RawCode, Gtin, SerialNo, Status FROM ProductCodes WHERE OrderId = @OrderId AND Status = 'Uploaded'";

        var parameters = new DynamicParameters();
        parameters.Add("OrderId", request.OrderId);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            string searchFilter = " AND (RawCode ILIKE @Search OR SerialNo ILIKE @Search)";
            countSql += searchFilter;
            querySql += searchFilter;
            parameters.Add("Search", $"%{request.Search}%");
        }

        querySql += " ORDER BY RawCode ASC LIMIT @Limit OFFSET @Offset";
        parameters.Add("Limit", request.PageSize);
        parameters.Add("Offset", (request.PageNumber - 1) * request.PageSize);

        var items = await connection.QueryAsync<dynamic>(querySql, parameters);
        var total = await connection.ExecuteScalarAsync<int>(countSql, parameters);

        return (items, total);
    }

    public async Task<(IEnumerable<object> Items, int TotalCount)> Handle(GetStockCodeCartonsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        string countSql = "SELECT COUNT(*) FROM Cartons WHERE OrderId = @OrderId";
        string querySql = @"
            SELECT 
                c.Id,
                c.CartonNo,
                c.SSCC,
                c.TargetQuantity,
                c.ActualQuantity,
                c.Status,
                c.CreatedAt,
                p.PalletNo
            FROM Cartons c
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            WHERE c.OrderId = @OrderId";

        var parameters = new DynamicParameters();
        parameters.Add("OrderId", request.OrderId);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            string searchFilter = " AND (c.CartonNo ILIKE @Search OR c.SSCC ILIKE @Search OR p.PalletNo ILIKE @Search)";
            countSql += searchFilter;
            querySql += searchFilter;
            parameters.Add("Search", $"%{request.Search}%");
        }

        querySql += " ORDER BY c.CreatedAt DESC LIMIT @Limit OFFSET @Offset";
        parameters.Add("Limit", request.PageSize);
        parameters.Add("Offset", (request.PageNumber - 1) * request.PageSize);

        var items = await connection.QueryAsync<dynamic>(querySql, parameters);
        var total = await connection.ExecuteScalarAsync<int>(countSql, parameters);

        return (items, total);
    }

    public async Task<(IEnumerable<object> Items, int TotalCount)> Handle(GetStockCodePalletsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        string countSql = "SELECT COUNT(*) FROM Pallets WHERE OrderId = @OrderId";
        string querySql = @"
            SELECT 
                p.Id,
                p.PalletNo,
                p.SSCC,
                p.Status,
                p.CreatedAt,
                (SELECT COUNT(*) FROM PalletCartons WHERE PalletId = p.Id) as CartonCount
            FROM Pallets p
            WHERE p.OrderId = @OrderId";

        var parameters = new DynamicParameters();
        parameters.Add("OrderId", request.OrderId);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            string searchFilter = " AND (p.PalletNo ILIKE @Search OR p.SSCC ILIKE @Search)";
            countSql += searchFilter;
            querySql += searchFilter;
            parameters.Add("Search", $"%{request.Search}%");
        }

        querySql += " ORDER BY p.CreatedAt DESC LIMIT @Limit OFFSET @Offset";
        parameters.Add("Limit", request.PageSize);
        parameters.Add("Offset", (request.PageNumber - 1) * request.PageSize);

        var pallets = (await connection.QueryAsync<dynamic>(querySql, parameters)).ToList();
        var total = await connection.ExecuteScalarAsync<int>(countSql, parameters);

        var resultList = new List<dynamic>();
        foreach (var pallet in pallets)
        {
            Guid palletId = pallet.id;
            const string cartonsSql = @"
                SELECT c.CartonNo, c.SSCC, c.ActualQuantity, c.TargetQuantity
                FROM Cartons c
                INNER JOIN PalletCartons pc ON c.Id = pc.CartonId
                WHERE pc.PalletId = @PalletId
                ORDER BY c.CreatedAt ASC";
            var cartons = await connection.QueryAsync<dynamic>(cartonsSql, new { PalletId = palletId });
            
            resultList.Add(new
            {
                id = pallet.id,
                palletNo = pallet.palletno,
                sscc = pallet.sscc,
                status = pallet.status,
                createdAt = pallet.createdat,
                cartonCount = pallet.cartoncount,
                cartons = cartons
            });
        }

        return (resultList, total);
    }

    public async Task<byte[]> Handle(GetOrderReportExcelQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        // 1. Get Summary
        const string summarySql = @"
            SELECT 
                o.OrderNo AS ""OrderNo"",
                MAX(o.CustomerName) as ""CustomerName"",
                COUNT(DISTINCT o.StockCode) as ""TotalStockCodes"",
                SUM(o.ExpectedQuantity) as ""ExpectedQuantity"",
                COALESCE(SUM(pc.UsedCount), 0) as ""UsedQuantity"",
                COALESCE(SUM(pc.UploadedCount), 0) as ""MissingQuantity"",
                COALESCE(SUM(c.CartonCount), 0) as ""TotalCartons"",
                COALESCE(SUM(p.PalletCount), 0) as ""TotalPallets"",
                COALESCE(MAX(pc.LastScannedAt), MAX(o.UpdatedAt)) as ""LastProcessedAt""
            FROM Orders o
            LEFT JOIN (
                SELECT 
                    OrderId,
                    COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount,
                    COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount,
                    MAX(ScannedAt) as LastScannedAt
                FROM ProductCodes
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId
            ) p ON o.Id = p.OrderId
            WHERE o.OrderNo = @OrderNo
            GROUP BY o.OrderNo";

        var summary = await connection.QueryFirstOrDefaultAsync<dynamic>(summarySql, new { OrderNo = request.OrderNo });
        if (summary == null)
        {
            throw new KeyNotFoundException("Sipariş bulunamadı.");
        }

        // 2. Get Stock Codes under this OrderNo
        const string stockCodesSql = @"
            SELECT 
                o.Id as ""OrderId"",
                o.StockCode as ""StockCode"",
                o.ProductName as ""ProductName"",
                o.GTIN as ""GTIN"",
                o.ExpectedQuantity as ""ExpectedQuantity"",
                COALESCE(pc.UsedCount, 0) as ""UsedQuantity"",
                COALESCE(pc.UploadedCount, 0) as ""MissingQuantity"",
                COALESCE(c.CartonCount, 0) as ""CartonCount"",
                COALESCE(p.PalletCount, 0) as ""PalletCount""
            FROM Orders o
            LEFT JOIN (
                SELECT 
                    OrderId,
                    COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount,
                    COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount
                FROM ProductCodes
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId
            ) p ON o.Id = p.OrderId
            WHERE o.OrderNo = @OrderNo";

        var stockCodes = (await connection.QueryAsync<dynamic>(stockCodesSql, new { OrderNo = request.OrderNo })).ToList();
        if (!string.IsNullOrEmpty(request.StockCode))
        {
            stockCodes = stockCodes.Where(x => (string)x.StockCode == request.StockCode).ToList();
        }

        using var workbook = new ClosedXML.Excel.XLWorkbook();
        
        // --- Tab 1: Özet (Summary) ---
        var wsSummary = workbook.Worksheets.Add("Özet");
        
        // Header Style
        wsSummary.Cell("A1").Value = "TRACK & TRACE SİPARİŞ RAPORU";
        wsSummary.Cell("A1").Style.Font.Bold = true;
        wsSummary.Cell("A1").Style.Font.FontSize = 16;
        wsSummary.Cell("A1").Style.Font.FontColor = ClosedXML.Excel.XLColor.DarkBlue;
        
        wsSummary.Cell("A3").Value = "Sipariş No:";
        wsSummary.Cell("B3").Value = (string)summary.OrderNo;
        wsSummary.Cell("B3").Style.Font.Bold = true;
        
        wsSummary.Cell("A4").Value = "Müşteri / Cari:";
        wsSummary.Cell("B4").Value = (string)summary.CustomerName;
        
        wsSummary.Cell("A5").Value = "Rapor Tarihi:";
        wsSummary.Cell("B5").Value = DateTime.Now.ToString("dd.MM.yyyy HH:mm");
        
        int expectedQuantity = Convert.ToInt32(summary.ExpectedQuantity);
        int usedQuantity = Convert.ToInt32(summary.UsedQuantity);
        int missingQuantity = Convert.ToInt32(summary.MissingQuantity);
        int totalCartons = Convert.ToInt32(summary.TotalCartons);
        int totalPallets = Convert.ToInt32(summary.TotalPallets);
        int totalStockCodes = Convert.ToInt32(summary.TotalStockCodes);

        if (!string.IsNullOrEmpty(request.StockCode) && stockCodes.Any())
        {
            var sc = stockCodes.First();
            expectedQuantity = Convert.ToInt32(sc.ExpectedQuantity);
            usedQuantity = Convert.ToInt32(sc.UsedQuantity);
            missingQuantity = Convert.ToInt32(sc.MissingQuantity);
            totalCartons = Convert.ToInt32(sc.CartonCount);
            totalPallets = Convert.ToInt32(sc.PalletCount);
            totalStockCodes = 1;
            
            wsSummary.Cell("A2").Value = $"FİLTRELENEN STOK: {request.StockCode} - {(string)sc.ProductName}";
            wsSummary.Cell("A2").Style.Font.Italic = true;
            wsSummary.Cell("A2").Style.Font.FontSize = 11;
        }

        wsSummary.Cell("A6").Value = "Toplam Stok Kodu:";
        wsSummary.Cell("B6").Value = totalStockCodes;
        
        // KPI Headers and Values
        int kpiStartRow = 8;
        wsSummary.Cell(kpiStartRow, 1).Value = "Metrik";
        wsSummary.Cell(kpiStartRow, 2).Value = "Değer";
        wsSummary.Range(kpiStartRow, 1, kpiStartRow, 2).Style.Font.Bold = true;
        wsSummary.Range(kpiStartRow, 1, kpiStartRow, 2).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

        string[] metrics = { "Beklenen QR", "Kullanılan QR", "Eksik QR", "Toplam Koli", "Toplam Palet", "Tamamlanma Oranı" };
        double compRate = expectedQuantity > 0 ? (double)usedQuantity / expectedQuantity : 0;
        object[] values = { expectedQuantity, usedQuantity, missingQuantity, totalCartons, totalPallets, compRate };

        for (int i = 0; i < metrics.Length; i++)
        {
            wsSummary.Cell(kpiStartRow + 1 + i, 1).Value = metrics[i];
            var valCell = wsSummary.Cell(kpiStartRow + 1 + i, 2);
            if (metrics[i] == "Tamamlanma Oranı")
            {
                valCell.Value = compRate;
                valCell.Style.NumberFormat.Format = "0.0%";
            }
            else
            {
                valCell.Value = Convert.ToInt32(values[i]);
            }
        }
        
        // Adjust Columns
        wsSummary.Columns().AdjustToContents();

        // --- Each Stock Code Sheet ---
        foreach (var sc in stockCodes)
        {
            string sheetName = string.IsNullOrWhiteSpace((string)sc.StockCode) ? "Bilinmeyen" : (string)sc.StockCode;
            if (sheetName.Length > 31) sheetName = sheetName.Substring(0, 31);
            var wsSc = workbook.Worksheets.Add(sheetName);

            Guid orderId = sc.OrderId;

            // Title
            wsSc.Cell("A1").Value = $"STOK RAPORU - {(string)sc.StockCode}";
            wsSc.Cell("A1").Style.Font.Bold = true;
            wsSc.Cell("A1").Style.Font.FontSize = 14;
            wsSc.Cell("A1").Style.Font.FontColor = ClosedXML.Excel.XLColor.DarkBlue;

            // A) Stok Özeti
            wsSc.Cell("A3").Value = "A) STOK ÖZETİ";
            wsSc.Cell("A3").Style.Font.Bold = true;
            wsSc.Cell("A3").Style.Font.FontSize = 11;
            
            wsSc.Cell("A4").Value = "Stok Kodu:";
            wsSc.Cell("B4").Value = (string)sc.StockCode;
            wsSc.Cell("A5").Value = "Ürün Adı:";
            wsSc.Cell("B5").Value = (string)sc.ProductName;
            wsSc.Cell("A6").Value = "Beklenen QR:";
            wsSc.Cell("B6").Value = Convert.ToInt32(sc.ExpectedQuantity);
            wsSc.Cell("A7").Value = "Kullanılan QR:";
            wsSc.Cell("B7").Value = Convert.ToInt32(sc.UsedQuantity);
            wsSc.Cell("A8").Value = "Eksik QR:";
            wsSc.Cell("B8").Value = Convert.ToInt32(sc.MissingQuantity);
            wsSc.Cell("A9").Value = "Koli Sayısı:";
            wsSc.Cell("B9").Value = Convert.ToInt32(sc.CartonCount);
            wsSc.Cell("A10").Value = "Palet Sayısı:";
            wsSc.Cell("B10").Value = Convert.ToInt32(sc.PalletCount);

            // B) Kullanılan QR Kodlar
            int rowIdx = 12;
            wsSc.Cell(rowIdx, 1).Value = "B) KULLANILAN QR KODLAR";
            wsSc.Cell(rowIdx, 1).Style.Font.Bold = true;
            
            rowIdx++;
            wsSc.Cell(rowIdx, 1).Value = "QR / RawCode";
            wsSc.Cell(rowIdx, 2).Value = "GTIN";
            wsSc.Cell(rowIdx, 3).Value = "Seri No";
            wsSc.Cell(rowIdx, 4).Value = "Koli No";
            wsSc.Cell(rowIdx, 5).Value = "Palet No";
            wsSc.Cell(rowIdx, 6).Value = "Okutan Kullanıcı";
            wsSc.Cell(rowIdx, 7).Value = "Okutma Tarihi";
            wsSc.Cell(rowIdx, 8).Value = "Durum";
            wsSc.Range(rowIdx, 1, rowIdx, 8).Style.Font.Bold = true;
            wsSc.Range(rowIdx, 1, rowIdx, 8).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

            const string usedCodesSql = @"
                SELECT 
                    pc.RawCode AS ""RawCode"",
                    pc.Gtin AS ""Gtin"",
                    pc.SerialNo AS ""SerialNo"",
                    c.CartonNo AS ""CartonNo"",
                    p.PalletNo AS ""PalletNo"",
                    u.Name AS ""ScannedByName"",
                    pc.ScannedAt AS ""ScannedAt"",
                    pc.Status AS ""Status""
                FROM ProductCodes pc
                LEFT JOIN Cartons c ON pc.CartonId = c.Id
                LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
                LEFT JOIN Pallets p ON plc.PalletId = p.Id
                LEFT JOIN Users u ON pc.ScannedBy = u.Id
                WHERE pc.OrderId = @OrderId AND pc.Status != 'Uploaded'
                ORDER BY pc.ScannedAt DESC";
            var usedCodes = await connection.QueryAsync<dynamic>(usedCodesSql, new { OrderId = orderId });

            foreach (var code in usedCodes)
            {
                rowIdx++;
                wsSc.Cell(rowIdx, 1).Value = (string)code.RawCode;
                wsSc.Cell(rowIdx, 2).Value = (string)code.Gtin;
                wsSc.Cell(rowIdx, 3).Value = (string)code.SerialNo;
                wsSc.Cell(rowIdx, 4).Value = (string)code.CartonNo ?? "-";
                wsSc.Cell(rowIdx, 5).Value = (string)code.PalletNo ?? "-";
                wsSc.Cell(rowIdx, 6).Value = (string)code.ScannedByName ?? "-";
                wsSc.Cell(rowIdx, 7).Value = code.ScannedAt != null ? ((DateTime)code.ScannedAt).ToString("dd.MM.yyyy HH:mm") : "-";
                wsSc.Cell(rowIdx, 8).Value = (string)code.Status;
            }

            // C) Eksik / Kullanılmayan QR Kodlar
            rowIdx += 2;
            wsSc.Cell(rowIdx, 1).Value = "C) EKSİK / KULLANILMAYAN QR KODLAR";
            wsSc.Cell(rowIdx, 1).Style.Font.Bold = true;

            rowIdx++;
            wsSc.Cell(rowIdx, 1).Value = "QR / RawCode";
            wsSc.Cell(rowIdx, 2).Value = "GTIN";
            wsSc.Cell(rowIdx, 3).Value = "Seri No";
            wsSc.Cell(rowIdx, 4).Value = "Durum";
            wsSc.Cell(rowIdx, 5).Value = "Açıklama";
            wsSc.Range(rowIdx, 1, rowIdx, 5).Style.Font.Bold = true;
            wsSc.Range(rowIdx, 1, rowIdx, 5).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

            const string missingCodesSql = @"
                SELECT 
                    RawCode AS ""RawCode"", 
                    Gtin AS ""Gtin"", 
                    SerialNo AS ""SerialNo"", 
                    Status AS ""Status"" 
                FROM ProductCodes 
                WHERE OrderId = @OrderId AND Status = 'Uploaded'
                ORDER BY RawCode ASC";
            var missingCodes = await connection.QueryAsync<dynamic>(missingCodesSql, new { OrderId = orderId });

            foreach (var code in missingCodes)
            {
                rowIdx++;
                wsSc.Cell(rowIdx, 1).Value = (string)code.RawCode;
                wsSc.Cell(rowIdx, 2).Value = (string)code.Gtin;
                wsSc.Cell(rowIdx, 3).Value = (string)code.SerialNo;
                wsSc.Cell(rowIdx, 4).Value = (string)code.Status;
                wsSc.Cell(rowIdx, 5).Value = "Kullanılmadı (Beklemede)";
            }

            // D) Koli Bazlı Dağılım
            rowIdx += 2;
            wsSc.Cell(rowIdx, 1).Value = "D) KOLİ BAZLI DAĞILIM";
            wsSc.Cell(rowIdx, 1).Style.Font.Bold = true;

            rowIdx++;
            wsSc.Cell(rowIdx, 1).Value = "Koli No";
            wsSc.Cell(rowIdx, 2).Value = "SSCC";
            wsSc.Cell(rowIdx, 3).Value = "QR / RawCode";
            wsSc.Cell(rowIdx, 4).Value = "Seri No";
            wsSc.Cell(rowIdx, 5).Value = "Palet No";
            wsSc.Cell(rowIdx, 6).Value = "Okutma Tarihi";
            wsSc.Range(rowIdx, 1, rowIdx, 6).Style.Font.Bold = true;
            wsSc.Range(rowIdx, 1, rowIdx, 6).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

            const string cartonDistSql = @"
                SELECT 
                    c.CartonNo AS ""CartonNo"",
                    c.SSCC AS ""SSCC"",
                    pc.RawCode AS ""RawCode"",
                    pc.SerialNo AS ""SerialNo"",
                    p.PalletNo AS ""PalletNo"",
                    pc.ScannedAt AS ""ScannedAt""
                FROM ProductCodes pc
                INNER JOIN Cartons c ON pc.CartonId = c.Id
                LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
                LEFT JOIN Pallets p ON plc.PalletId = p.Id
                WHERE pc.OrderId = @OrderId AND pc.Status != 'Uploaded'
                ORDER BY c.CartonNo ASC, pc.ScannedAt ASC";
            var cartonDist = await connection.QueryAsync<dynamic>(cartonDistSql, new { OrderId = orderId });

            foreach (var dist in cartonDist)
            {
                rowIdx++;
                wsSc.Cell(rowIdx, 1).Value = (string)dist.CartonNo;
                wsSc.Cell(rowIdx, 2).Value = (string)dist.SSCC;
                wsSc.Cell(rowIdx, 3).Value = (string)dist.RawCode;
                wsSc.Cell(rowIdx, 4).Value = (string)dist.SerialNo;
                wsSc.Cell(rowIdx, 5).Value = (string)dist.PalletNo ?? "-";
                wsSc.Cell(rowIdx, 6).Value = dist.ScannedAt != null ? ((DateTime)dist.ScannedAt).ToString("dd.MM.yyyy HH:mm") : "-";
            }

            // E) Palet Bazlı Dağılım
            rowIdx += 2;
            wsSc.Cell(rowIdx, 1).Value = "E) PALET BAZLI DAĞILIM";
            wsSc.Cell(rowIdx, 1).Style.Font.Bold = true;

            rowIdx++;
            wsSc.Cell(rowIdx, 1).Value = "Palet No";
            wsSc.Cell(rowIdx, 2).Value = "Koli No";
            wsSc.Cell(rowIdx, 3).Value = "SSCC";
            wsSc.Cell(rowIdx, 4).Value = "QR Sayısı";
            wsSc.Range(rowIdx, 1, rowIdx, 4).Style.Font.Bold = true;
            wsSc.Range(rowIdx, 1, rowIdx, 4).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

            const string palletDistSql = @"
                SELECT 
                    p.PalletNo AS ""PalletNo"",
                    c.CartonNo AS ""CartonNo"",
                    c.SSCC AS ""SSCC"",
                    c.ActualQuantity AS ""QrCount""
                FROM Pallets p
                INNER JOIN PalletCartons pc ON p.Id = pc.PalletId
                INNER JOIN Cartons c ON pc.CartonId = c.Id
                WHERE p.OrderId = @OrderId
                ORDER BY p.PalletNo ASC, c.CartonNo ASC";
            var palletDist = await connection.QueryAsync<dynamic>(palletDistSql, new { OrderId = orderId });

            foreach (var dist in palletDist)
            {
                rowIdx++;
                wsSc.Cell(rowIdx, 1).Value = (string)dist.PalletNo;
                wsSc.Cell(rowIdx, 2).Value = (string)dist.CartonNo;
                wsSc.Cell(rowIdx, 3).Value = (string)dist.SSCC;
                wsSc.Cell(rowIdx, 4).Value = Convert.ToInt32(dist.QrCount);
            }

            wsSc.Columns().AdjustToContents();
        }

        using var memoryStream = new MemoryStream();
        workbook.SaveAs(memoryStream);
        return memoryStream.ToArray();
    }

    public async Task<byte[]> Handle(GetOrderReportPdfQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        // 1. Get Summary
        const string summarySql = @"
            SELECT 
                o.OrderNo AS ""OrderNo"",
                MAX(o.CustomerName) AS ""CustomerName"",
                COUNT(DISTINCT o.StockCode) AS ""TotalStockCodes"",
                SUM(o.ExpectedQuantity) AS ""ExpectedQuantity"",
                COALESCE(SUM(pc.UsedCount), 0) AS ""UsedQuantity"",
                COALESCE(SUM(pc.UploadedCount), 0) AS ""MissingQuantity"",
                COALESCE(SUM(c.CartonCount), 0) AS ""TotalCartons"",
                COALESCE(SUM(p.PalletCount), 0) AS ""TotalPallets"",
                COALESCE(MAX(pc.LastScannedAt), MAX(o.UpdatedAt)) AS ""LastProcessedAt""
            FROM Orders o
            LEFT JOIN (
                SELECT 
                    OrderId,
                    COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount,
                    COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount,
                    MAX(ScannedAt) as LastScannedAt
                FROM ProductCodes
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId
            ) p ON o.Id = p.OrderId
            WHERE o.OrderNo = @OrderNo
            GROUP BY o.OrderNo";

        var summary = await connection.QueryFirstOrDefaultAsync<dynamic>(summarySql, new { OrderNo = request.OrderNo });
        if (summary == null)
        {
            throw new KeyNotFoundException("Sipariş bulunamadı.");
        }

        // 2. Get Stock Codes under this OrderNo
        const string stockCodesSql = @"
            SELECT 
                o.Id AS ""OrderId"",
                o.StockCode AS ""StockCode"",
                o.ProductName AS ""ProductName"",
                o.ExpectedQuantity AS ""ExpectedQuantity"",
                COALESCE(pc.UsedCount, 0) AS ""UsedQuantity"",
                COALESCE(pc.UploadedCount, 0) AS ""MissingQuantity"",
                COALESCE(c.CartonCount, 0) AS ""CartonCount"",
                COALESCE(p.PalletCount, 0) AS ""PalletCount""
            FROM Orders o
            LEFT JOIN (
                SELECT 
                    OrderId,
                    COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount,
                    COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount
                FROM ProductCodes
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId
            ) p ON o.Id = p.OrderId
            WHERE o.OrderNo = @OrderNo";

        var stockCodes = await connection.QueryAsync<dynamic>(stockCodesSql, new { OrderNo = request.OrderNo });

        // 3. Get Cartons under this OrderNo
        const string cartonsSql = @"
            SELECT 
                c.CartonNo AS ""CartonNo"",
                c.SSCC AS ""SSCC"",
                c.TargetQuantity AS ""TargetQuantity"",
                c.ActualQuantity AS ""ActualQuantity"",
                c.Status AS ""Status"",
                c.CreatedAt AS ""CreatedAt"",
                p.PalletNo AS ""PalletNo""
            FROM Cartons c
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            WHERE c.OrderId IN (SELECT Id FROM Orders WHERE OrderNo = @OrderNo)
            ORDER BY c.CreatedAt DESC";

        var cartons = await connection.QueryAsync<dynamic>(cartonsSql, new { OrderNo = request.OrderNo });

        // 4. Get Pallets under this OrderNo
        const string palletsSql = @"
            SELECT 
                p.PalletNo AS ""PalletNo"",
                p.SSCC AS ""SSCC"",
                p.Status AS ""Status"",
                p.CreatedAt AS ""CreatedAt"",
                (SELECT COUNT(*) FROM PalletCartons WHERE PalletId = p.Id) AS ""CartonCount""
            FROM Pallets p
            WHERE p.OrderId IN (SELECT Id FROM Orders WHERE OrderNo = @OrderNo)
            ORDER BY p.CreatedAt DESC";

        var pallets = await connection.QueryAsync<dynamic>(palletsSql, new { OrderNo = request.OrderNo });

        // 5. Get Missing Summary (Grouped by stock code)
        const string missingSummarySql = @"
            SELECT 
                o.StockCode AS ""StockCode"",
                o.ProductName AS ""ProductName"",
                COUNT(*) AS ""MissingCount""
            FROM ProductCodes pc
            INNER JOIN Orders o ON pc.OrderId = o.Id
            WHERE o.OrderNo = @OrderNo AND pc.Status = 'Uploaded'
            GROUP BY o.StockCode, o.ProductName";

        var missingSummary = await connection.QueryAsync<dynamic>(missingSummarySql, new { OrderNo = request.OrderNo });

        return _reportPdfGenerator.GenerateOrderReportPdf(request.OrderNo, summary, stockCodes, cartons, pallets, missingSummary);
    }
    #endregion
}
