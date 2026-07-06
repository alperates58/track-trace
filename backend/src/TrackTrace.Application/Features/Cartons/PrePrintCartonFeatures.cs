using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using FluentValidation;
using MediatR;
using Npgsql;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;
using TrackTrace.Domain.Enums;

namespace TrackTrace.Application.Features.Cartons;

public record PrePrintCartonsCommand(Guid OrderId, int Quantity, string Format, Guid BatchId) : IRequest<(byte[]? FileContent, string? ZplText)>;

public record MarkCartonsPrintedCommand(Guid BatchId) : IRequest<bool>;

public record VoidCartonCommand(Guid CartonId, string Reason) : IRequest<bool>;

public record ReprintCartonCommand(Guid CartonId, string Format) : IRequest<(byte[]? FileContent, string? ZplText)>;

public record OpenPrePrintedCartonCommand(string Code, Guid StationId) : IRequest<ScanResponse>;

public class PrePrintCartonsCommandValidator : AbstractValidator<PrePrintCartonsCommand>
{
    public PrePrintCartonsCommandValidator()
    {
        RuleFor(v => v.OrderId).NotEmpty();
        RuleFor(v => v.Quantity).GreaterThan(0).LessThanOrEqualTo(100);
        RuleFor(v => v.Format).NotEmpty();
        RuleFor(v => v.BatchId).NotEmpty();
    }
}

public class PrePrintCartonsCommandHandler : IRequestHandler<PrePrintCartonsCommand, (byte[]? FileContent, string? ZplText)>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;
    private readonly ILabelGenerator _labelGenerator;

    public PrePrintCartonsCommandHandler(
        IDbConnectionFactory dbConnectionFactory,
        ICurrentUserService currentUserService,
        IAuditLogService auditLogService,
        ILabelGenerator labelGenerator)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
        _labelGenerator = labelGenerator;
    }

    public async Task<(byte[]? FileContent, string? ZplText)> Handle(PrePrintCartonsCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        
        // Idempotency Check: check if batch already exists
        var existingCartonsSql = @"
            SELECT c.*, o.OrderNo, o.StockCode, o.CustomerName, o.ProductName, o.GTIN
            FROM Cartons c
            JOIN Orders o ON c.OrderId = o.Id
            WHERE c.PrePrintBatchId = @BatchId
            ORDER BY c.CreatedAt ASC";
            
        var existingRecords = await connection.QueryAsync(existingCartonsSql, new { BatchId = request.BatchId });
        var dtos = new List<CartonDto>();
        OrderDto? orderDto = null;
        
        if (existingRecords.Any())
        {
            // Batch exists. Return labels again.
            var firstRow = existingRecords.First();
            orderDto = new OrderDto(
                (Guid)firstRow.orderid, (string)firstRow.orderno, (string)firstRow.customername, (string?)firstRow.stockcode, (string?)firstRow.productname,
                (string)firstRow.gtin, 0, 0, 0, null, "", DateTime.UtcNow, DateTime.UtcNow, 0);
                
            foreach(var row in existingRecords)
            {
                dtos.Add(new CartonDto(
                    (Guid)row.id, (Guid)row.orderid, (string)row.orderno, (string?)row.stockcode,
                    null, null, (string)row.cartonno, (string)row.sscc,
                    (int)row.targetquantity, (int)row.actualquantity,
                    ((CartonStatus)row.status).ToString(),
                    (DateTime)row.createdat, (DateTime?)row.closedat, (DateTime?)row.printedat,
                    null, (string)row.mode, (Guid?)row.preprintbatchid, (int)row.printcount, (string?)row.voidreason
                ));
            }
        }
        else
        {
            // Create new cartons
            using var transaction = connection.BeginTransaction();

            var order = await connection.QueryFirstOrDefaultAsync(
                "SELECT * FROM Orders WHERE Id = @OrderId FOR UPDATE",
                new { request.OrderId }, transaction);

            if (order == null) throw new Exception("Sipariş bulunamadı.");

            orderDto = new OrderDto(
                (Guid)order.id, (string)order.orderno, (string)order.customername, (string?)order.stockcode, (string?)order.productname,
                (string)order.gtin, (int)order.productpercarton, (int)order.cartonperpallet, (int)order.expectedquantity, null, "", DateTime.UtcNow, DateTime.UtcNow, 0);

            var generatedCartons = new List<dynamic>();
            var now = DateTime.UtcNow;

            for (int i = 0; i < request.Quantity; i++)
            {
                int nextCartonCount = await connection.ExecuteScalarAsync<int>(
                    "SELECT COALESCE(MAX(CAST(SPLIT_PART(CartonNo, '-', 2) AS INTEGER)), 0) + 1 FROM Cartons WHERE OrderId = @OrderId",
                    new { request.OrderId }, transaction);

                string cartonNo = $"{order.orderno}-{nextCartonCount}";
                string sscc = await GenerateSSCC18Async(connection, transaction);

                var cartonId = Guid.NewGuid();
                await connection.ExecuteAsync(@"
                    INSERT INTO Cartons (
                        Id, OrderId, CartonNo, SSCC, TargetQuantity, ActualQuantity, Status, CreatedBy, CreatedAt, 
                        Mode, PrePrintBatchId, PrePrintedAt, PrePrintedBy
                    ) VALUES (
                        @Id, @OrderId, @CartonNo, @SSCC, @TargetQuantity, 0, @Status, @CreatedBy, @CreatedAt, 
                        'PrePrinted', @BatchId, @PrePrintedAt, @PrePrintedBy
                    )",
                    new {
                        Id = cartonId,
                        OrderId = request.OrderId,
                        CartonNo = cartonNo,
                        SSCC = sscc,
                        TargetQuantity = order.productpercarton,
                        Status = CartonStatus.PrePrinted.ToString(),
                        CreatedBy = _currentUserService.UserId,
                        CreatedAt = now,
                        BatchId = request.BatchId,
                        PrePrintedAt = now,
                        PrePrintedBy = _currentUserService.UserId
                    }, transaction);

                generatedCartons.Add(new {
                    Id = cartonId, CartonNo = cartonNo, SSCC = sscc, TargetQuantity = order.productpercarton
                });
            }

            await transaction.CommitAsync();

            foreach(var c in generatedCartons)
            {
                dtos.Add(new CartonDto(
                    c.Id, request.OrderId, orderDto.OrderNo, orderDto.StockCode,
                    null, null, c.CartonNo, c.SSCC,
                    c.TargetQuantity, 0,
                    CartonStatus.PrePrinted.ToString(),
                    now, null, null, null, "PrePrinted", request.BatchId, 0, null
                ));
            }
            
            await _auditLogService.LogAsync("Orders", request.OrderId, "PrePrintCartonsGenerated", null, new { BatchId = request.BatchId, Quantity = request.Quantity });
        }

        // Generate Labels
        if (request.Format.ToLower() == "zpl" || request.Format.ToLower() == "pplb")
        {
            var zplSb = new global::System.Text.StringBuilder();
            foreach (var dto in dtos)
            {
                if (request.Format.ToLower() == "zpl")
                    zplSb.AppendLine(_labelGenerator.GenerateCartonZplLabel(dto, orderDto));
                else
                    zplSb.AppendLine(_labelGenerator.GenerateCartonPplbLabel(dto, orderDto));
            }
            return (null, zplSb.ToString());
        }
        else // pdf
        {
            var pdfBytes = _labelGenerator.GenerateBatchCartonPdfLabel(dtos, orderDto);
            return (pdfBytes, null);
        }
    }

    private async Task<string> GenerateSSCC18Async(NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        const string extensionDigit = "3";
        const string companyPrefix = "463047737";
        int totalUnits = await connection.ExecuteScalarAsync<int>("SELECT nextval('sscc_seq')", null, transaction);
        string serialRef = totalUnits.ToString().PadLeft(7, '0');
        string baseCode = extensionDigit + companyPrefix + serialRef;
        int checkDigit = CalculateLuhnCheckDigit(baseCode);
        return baseCode + checkDigit;
    }

    private static int CalculateLuhnCheckDigit(string baseCode)
    {
        int sum = 0;
        bool multiplyBy3 = true;
        for (int i = baseCode.Length - 1; i >= 0; i--)
        {
            sum += (baseCode[i] - '0') * (multiplyBy3 ? 3 : 1);
            multiplyBy3 = !multiplyBy3;
        }
        int remainder = sum % 10;
        return remainder == 0 ? 0 : 10 - remainder;
    }
}

public class MarkCartonsPrintedCommandHandler : IRequestHandler<MarkCartonsPrintedCommand, bool>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;

    public MarkCartonsPrintedCommandHandler(IDbConnectionFactory dbConnectionFactory, ICurrentUserService currentUserService, IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(MarkCartonsPrintedCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var affected = await connection.ExecuteAsync(@"
            UPDATE Cartons 
            SET PrintCount = PrintCount + 1,
                LastPrintedAt = @Now,
                LastPrintedBy = @UserId
            WHERE PrePrintBatchId = @BatchId 
              AND (Status = @StatusPrePrinted OR Status = @StatusFilling)",
            new { 
                BatchId = request.BatchId, 
                Now = DateTime.UtcNow, 
                UserId = _currentUserService.UserId,
                StatusPrePrinted = CartonStatus.PrePrinted.ToString(),
                StatusFilling = CartonStatus.Filling.ToString()
            });
            
        if (affected > 0)
        {
            await _auditLogService.LogAsync("CartonBatch", request.BatchId, "MarkPrinted", null, new { Affected = affected });
        }
        return affected > 0;
    }
}

public class VoidCartonCommandHandler : IRequestHandler<VoidCartonCommand, bool>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;

    public VoidCartonCommandHandler(IDbConnectionFactory dbConnectionFactory, ICurrentUserService currentUserService, IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(VoidCartonCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var affected = await connection.ExecuteAsync(@"
            UPDATE Cartons 
            SET Status = @StatusVoid,
                VoidAt = @Now,
                VoidBy = @UserId,
                VoidReason = @Reason
            WHERE Id = @Id AND Status != @StatusPalletized",
            new { 
                Id = request.CartonId, 
                Now = DateTime.UtcNow, 
                UserId = _currentUserService.UserId,
                Reason = request.Reason,
                StatusVoid = CartonStatus.Void.ToString(),
                StatusPalletized = CartonStatus.Palletized.ToString()
            });
            
        if (affected > 0)
        {
            await _auditLogService.LogAsync("Cartons", request.CartonId, "Voided", null, new { Reason = request.Reason });
        }
        return affected > 0;
    }
}

public class ReprintCartonCommandHandler : IRequestHandler<ReprintCartonCommand, (byte[]? FileContent, string? ZplText)>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;
    private readonly ILabelGenerator _labelGenerator;

    public ReprintCartonCommandHandler(IDbConnectionFactory dbConnectionFactory, ICurrentUserService currentUserService, IAuditLogService auditLogService, ILabelGenerator labelGenerator)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
        _labelGenerator = labelGenerator;
    }

    public async Task<(byte[]? FileContent, string? ZplText)> Handle(ReprintCartonCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var cartonRow = await connection.QueryFirstOrDefaultAsync(@"
            SELECT c.*, o.OrderNo, o.StockCode, o.CustomerName, o.ProductName, o.GTIN,
                   s.Name as StationName, u.Name as UserName
            FROM Cartons c
            JOIN Orders o ON c.OrderId = o.Id
            LEFT JOIN Stations s ON c.StationId = s.Id
            LEFT JOIN Users u ON c.AssignedUserId = u.Id OR c.CreatedBy = u.Id
            WHERE c.Id = @Id", new { Id = request.CartonId });

        if (cartonRow == null) throw new Exception("Koli bulunamadı.");

        await connection.ExecuteAsync(@"
            UPDATE Cartons 
            SET PrintCount = PrintCount + 1, LastPrintedAt = @Now, LastPrintedBy = @UserId 
            WHERE Id = @Id", 
            new { Id = request.CartonId, Now = DateTime.UtcNow, UserId = _currentUserService.UserId });
            
        await _auditLogService.LogAsync("Cartons", request.CartonId, "Reprint", null, new { Format = request.Format });
        
        var orderDto = new OrderDto(
            (Guid)cartonRow.orderid, (string)cartonRow.orderno, (string)cartonRow.customername, (string?)cartonRow.stockcode, (string?)cartonRow.productname,
            (string)cartonRow.gtin, 0, 0, 0, null, "", DateTime.UtcNow, DateTime.UtcNow, 0);
            
        var cartonDto = new CartonDto(
            (Guid)cartonRow.id, (Guid)cartonRow.orderid, (string)cartonRow.orderno, (string?)cartonRow.stockcode,
            (Guid?)cartonRow.stationid, (string?)cartonRow.stationname, (string)cartonRow.cartonno, (string)cartonRow.sscc,
            (int)cartonRow.targetquantity, (int)cartonRow.actualquantity, ((CartonStatus)cartonRow.status).ToString(),
            (DateTime)cartonRow.createdat, (DateTime?)cartonRow.closedat, (DateTime?)cartonRow.printedat,
            (string?)cartonRow.username, (string)cartonRow.mode, (Guid?)cartonRow.preprintbatchid, (int)cartonRow.printcount + 1, (string?)cartonRow.voidreason
        );

        if (request.Format.ToLower() == "zpl")
            return (null, _labelGenerator.GenerateCartonZplLabel(cartonDto, orderDto));
        if (request.Format.ToLower() == "pplb")
            return (null, _labelGenerator.GenerateCartonPplbLabel(cartonDto, orderDto));

        return (_labelGenerator.GenerateCartonPdfLabel(cartonDto, orderDto), null);
    }
}

public class OpenPrePrintedCartonCommandHandler : IRequestHandler<OpenPrePrintedCartonCommand, ScanResponse>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;

    public OpenPrePrintedCartonCommandHandler(IDbConnectionFactory dbConnectionFactory, ICurrentUserService currentUserService, IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
    }

    public async Task<ScanResponse> Handle(OpenPrePrintedCartonCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        var code = Gs1AutoHelper.ExtractSscc(request.Code);

        // Fetch carton with names for detailed errors
        var carton = await connection.QueryFirstOrDefaultAsync(@"
            SELECT c.*, u.Name as UserName, s.Name as StationName 
            FROM Cartons c
            LEFT JOIN Users u ON c.AssignedUserId = u.Id
            LEFT JOIN Stations s ON c.StationId = s.Id
            WHERE (c.SSCC = @Code OR c.CartonNo = @Code) AND c.Mode = 'PrePrinted' 
            FOR UPDATE OF c", 
            new { Code = code }, transaction);

        if (carton == null)
            return new ScanResponse(false, "Koli bulunamadı veya bu koli ön etiketli koli değil.", request.Code, null, null, null, null, 0, 0, "Error");
            
        if (carton.status == CartonStatus.Filling.ToString())
        {
            if ((Guid?)carton.assigneduserid == _currentUserService.UserId && (Guid?)carton.stationid == request.StationId)
            {
                // Resume existing carton
                await transaction.CommitAsync();
                return new ScanResponse(true, "Mevcut koliye devam ediliyor. Ürün okutmaya başlayabilirsiniz.", request.Code, null, null, (string)carton.cartonno, (string)carton.sscc, (int)carton.actualquantity, (int)carton.targetquantity, "Success", (Guid)carton.id);
            }
            else if ((Guid?)carton.assigneduserid != _currentUserService.UserId)
            {
                return new ScanResponse(false, $"Bu koli şu anda {(string?)carton.username ?? "başka bir kullanıcı"} tarafından {(string?)carton.stationname ?? "başka bir"} istasyonunda dolduruluyor.", request.Code, null, null, null, null, 0, 0, "Error");
            }
            else 
            {
                return new ScanResponse(false, $"Bu koli başka bir istasyonda dolduruluyor.", request.Code, null, null, null, null, 0, 0, "Error");
            }
        }
        else if (carton.status != CartonStatus.PrePrinted.ToString())
        {
            string statusStr = ((CartonStatus)carton.status).ToString();
            return new ScanResponse(false, $"Koli durumu uygun değil (Mevcut Durum: {statusStr}). Sadece PrePrinted koliler açılabilir.", request.Code, null, null, (string)carton.cartonno, (string)carton.sscc, (int)carton.actualquantity, (int)carton.targetquantity, "Error");
        }

        await connection.ExecuteAsync(@"
            UPDATE Cartons 
            SET Status = @StatusFilling,
                StationId = @StationId,
                OpenedAt = @Now,
                OpenedBy = @UserId,
                AssignedUserId = @UserId
            WHERE Id = @Id",
            new {
                StatusFilling = CartonStatus.Filling.ToString(),
                StationId = request.StationId,
                Now = DateTime.UtcNow,
                UserId = _currentUserService.UserId,
                Id = (Guid)carton.id
            }, transaction);

        await _auditLogService.LogAsync("Cartons", (Guid)carton.id, "PrePrintedOpened", null, new { StationId = request.StationId });

        await transaction.CommitAsync();

        return new ScanResponse(true, "Koli başarıyla açıldı. Ürün okutmaya başlayabilirsiniz.", request.Code, null, null, (string)carton.cartonno, (string)carton.sscc, (int)carton.actualquantity, (int)carton.targetquantity, "Success", (Guid)carton.id);
    }
}
