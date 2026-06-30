using System;
using System.IO;
using System.Collections.Generic;
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

namespace TrackTrace.Application.Features.Orders;

public record GetOrdersQuery(int PageNumber = 1, int PageSize = 10, string? Search = null, string? Status = null) 
    : IRequest<(IEnumerable<OrderDto> Items, int TotalCount)>;

public record GetOrderByIdQuery(Guid Id) : IRequest<OrderDto>;

public record CreateOrderCommand(CreateOrderRequest Request) : IRequest<Guid>;

public record UpdateOrderCommand(Guid Id, UpdateOrderRequest Request) : IRequest<Unit>;

public record ActivateOrderCommand(Guid Id) : IRequest<Unit>;

public record CompleteOrderCommand(Guid Id) : IRequest<Unit>;

public record CancelOrderCommand(Guid Id) : IRequest<Unit>;

public record DeleteOrderCommand(Guid Id) : IRequest<Unit>;

public record PrintOrderCodesResult(byte[] FileContents, string ContentType, string FileName);

public record PrintOrderCodesPdfQuery(
    Guid OrderId,
    int Cols,
    int Rows,
    int Size,
    bool AddText,
    string? Line1,
    string? Line2,
    bool LabelBelow,
    int SplitSize) : IRequest<PrintOrderCodesResult>;

public record OrderImportResultDto(
    int TotalRows,
    int ImportedCount,
    int DuplicateCount,
    int InvalidCount,
    global::System.Collections.Generic.List<ImportErrorDto> Errors
);

public record ImportOrdersExcelCommand(global::System.IO.Stream FileStream, string FileName) : IRequest<OrderImportResultDto>;

public class OrderKeyDto
{
    public string OrderNo { get; set; } = "";
    public string? StockCode { get; set; }
}

#region Validators

public class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.Request.OrderNo).NotEmpty().WithMessage("Sipariş numarası boş olamaz.");
        RuleFor(x => x.Request.CustomerName).NotEmpty().WithMessage("Müşteri adı boş olamaz.");
        RuleFor(x => x.Request.StockCode).NotEmpty().WithMessage("Stok kodu boş olamaz.");
        RuleFor(x => x.Request.ProductName).NotEmpty().WithMessage("Stok ismi boş olamaz.");
        RuleFor(x => x.Request.GTIN).NotEmpty().WithMessage("İş emri numarası boş olamaz.");
        RuleFor(x => x.Request.ProductPerCarton).GreaterThan(0).WithMessage("Koli içi ürün sayısı 0'dan büyük olmalıdır.");
        RuleFor(x => x.Request.CartonPerPallet).GreaterThan(0).WithMessage("Palet içi koli sayısı 0'dan büyük olmalıdır.");
        RuleFor(x => x.Request.ExpectedQuantity).GreaterThan(0).WithMessage("Beklenen miktar 0'dan büyük olmalıdır.");
    }
}

public class UpdateOrderCommandValidator : AbstractValidator<UpdateOrderCommand>
{
    public UpdateOrderCommandValidator()
    {
        RuleFor(x => x.Request.CustomerName).NotEmpty().WithMessage("Müşteri adı boş olamaz.");
        RuleFor(x => x.Request.StockCode).NotEmpty().WithMessage("Stok kodu boş olamaz.");
        RuleFor(x => x.Request.ProductName).NotEmpty().WithMessage("Stok ismi boş olamaz.");
        RuleFor(x => x.Request.GTIN).NotEmpty().WithMessage("İş emri numarası boş olamaz.");
        RuleFor(x => x.Request.ProductPerCarton).GreaterThan(0).WithMessage("Koli içi ürün sayısı 0'dan büyük olmalıdır.");
        RuleFor(x => x.Request.CartonPerPallet).GreaterThan(0).WithMessage("Palet içi koli sayısı 0'dan büyük olmalıdır.");
        RuleFor(x => x.Request.ExpectedQuantity).GreaterThan(0).WithMessage("Beklenen miktar 0'dan büyük olmalıdır.");
    }
}

#endregion

#region Handlers

public class OrderHandlers : 
    IRequestHandler<GetOrdersQuery, (IEnumerable<OrderDto> Items, int TotalCount)>,
    IRequestHandler<GetOrderByIdQuery, OrderDto>,
    IRequestHandler<CreateOrderCommand, Guid>,
    IRequestHandler<UpdateOrderCommand, Unit>,
    IRequestHandler<ActivateOrderCommand, Unit>,
    IRequestHandler<CompleteOrderCommand, Unit>,
    IRequestHandler<CancelOrderCommand, Unit>,
    IRequestHandler<DeleteOrderCommand, Unit>,
    IRequestHandler<PrintOrderCodesPdfQuery, PrintOrderCodesResult>,
    IRequestHandler<ImportOrdersExcelCommand, OrderImportResultDto>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IAuditLogService _auditLogService;
    private readonly ILabelGenerator _labelGenerator;

    public OrderHandlers(IDbConnectionFactory dbConnectionFactory, IAuditLogService auditLogService, ILabelGenerator labelGenerator)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _auditLogService = auditLogService;
        _labelGenerator = labelGenerator;
    }

    public async Task<(IEnumerable<OrderDto> Items, int TotalCount)> Handle(GetOrdersQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var builder = new SqlBuilder();
        
        var selector = builder.AddTemplate(@"
            SELECT o.*, 
                   COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0) as ScannedCount
            FROM Orders o
            /**where**/
            ORDER BY o.CreatedAt DESC
            LIMIT @Limit OFFSET @Offset", new { Limit = request.PageSize, Offset = (request.PageNumber - 1) * request.PageSize });

        var countTemplate = builder.AddTemplate("SELECT COUNT(*) FROM Orders o /**where**/");

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            builder.Where("(o.OrderNo ILIKE @Search OR o.CustomerName ILIKE @Search OR o.ProductName ILIKE @Search OR o.StockCode ILIKE @Search)", 
                new { Search = $"%{request.Search}%" });
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            builder.Where("o.Status = @Status", new { Status = request.Status });
        }

        var items = await connection.QueryAsync<dynamic>(selector.RawSql, selector.Parameters);
        var totalCount = await connection.ExecuteScalarAsync<int>(countTemplate.RawSql, countTemplate.Parameters);

        var orderDtos = items.Select(x => new OrderDto(
            (Guid)x.id,
            (string)x.orderno,
            (string)x.customername,
            (string?)x.stockcode,
            (string?)x.productname,
            (string)x.gtin,
            (int)x.productpercarton,
            (int)x.cartonperpallet,
            (int)x.expectedquantity,
            (string?)x.description,
            (string)x.status,
            (DateTime)x.createdat,
            (DateTime)x.updatedat,
            Convert.ToInt32(x.ScannedCount)
        ));

        return (orderDtos, totalCount);
    }

    public async Task<OrderDto> Handle(GetOrderByIdQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = @"
            SELECT o.*, 
                   COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0) as ScannedCount
            FROM Orders o
            WHERE o.Id = @Id";

        var x = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { Id = request.Id });
        if (x == null)
        {
            throw new KeyNotFoundException("Sipariş bulunamadı.");
        }

        return new OrderDto(
            (Guid)x.id,
            (string)x.orderno,
            (string)x.customername,
            (string?)x.stockcode,
            (string?)x.productname,
            (string)x.gtin,
            (int)x.productpercarton,
            (int)x.cartonperpallet,
            (int)x.expectedquantity,
            (string?)x.description,
            (string)x.status,
            (DateTime)x.createdat,
            (DateTime)x.updatedat,
            Convert.ToInt32(x.ScannedCount)
        );
    }

    public async Task<Guid> Handle(CreateOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var id = Guid.NewGuid();
        const string sql = @"
            INSERT INTO Orders (Id, OrderNo, CustomerName, StockCode, ProductName, GTIN, ProductPerCarton, CartonPerPallet, ExpectedQuantity, Description, Status, CreatedAt, UpdatedAt)
            VALUES (@Id, @OrderNo, @CustomerName, @StockCode, @ProductName, @GTIN, @ProductPerCarton, @CartonPerPallet, @ExpectedQuantity, @Description, @Status, @CreatedAt, @UpdatedAt)";

        var req = request.Request;
        var parameters = new
        {
            Id = id,
            OrderNo = req.OrderNo,
            CustomerName = req.CustomerName,
            StockCode = req.StockCode,
            ProductName = req.ProductName,
            GTIN = req.GTIN,
            ProductPerCarton = req.ProductPerCarton,
            CartonPerPallet = req.CartonPerPallet,
            ExpectedQuantity = req.ExpectedQuantity,
            Description = req.Description,
            Status = OrderStatus.Draft.ToString(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await connection.ExecuteAsync(sql, parameters);
        await _auditLogService.LogAsync("Orders", id, "Create", null, parameters);
        return id;
    }

    public async Task<Unit> Handle(UpdateOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        // Check current status
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>("SELECT Status FROM Orders WHERE Id = @Id", new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("Sipariş bulunamadı.");
        if (existing.status != OrderStatus.Draft.ToString())
        {
            throw new InvalidOperationException("Sadece taslak durumundaki siparişler güncellenebilir.");
        }

        const string sql = @"
            UPDATE Orders 
            SET CustomerName = @CustomerName, StockCode = @StockCode, ProductName = @ProductName, GTIN = @GTIN, 
                ProductPerCarton = @ProductPerCarton, CartonPerPallet = @CartonPerPallet, ExpectedQuantity = @ExpectedQuantity, 
                Description = @Description, UpdatedAt = @UpdatedAt
            WHERE Id = @Id";

        var req = request.Request;
        var parameters = new
        {
            Id = request.Id,
            CustomerName = req.CustomerName,
            StockCode = req.StockCode,
            ProductName = req.ProductName,
            GTIN = req.GTIN,
            ProductPerCarton = req.ProductPerCarton,
            CartonPerPallet = req.CartonPerPallet,
            ExpectedQuantity = req.ExpectedQuantity,
            Description = req.Description,
            UpdatedAt = DateTime.UtcNow
        };

        await connection.ExecuteAsync(sql, parameters);
        await _auditLogService.LogAsync("Orders", request.Id, "Update", existing, parameters);
        return Unit.Value;
    }

    public async Task<Unit> Handle(ActivateOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>("SELECT Status FROM Orders WHERE Id = @Id", new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("Sipariş bulunamadı.");
        
        if (existing.status != OrderStatus.Draft.ToString() && existing.status != OrderStatus.Cancelled.ToString())
        {
            throw new InvalidOperationException("Yalnızca taslak veya iptal durumundaki siparişler aktifleştirilebilir.");
        }

        const string sql = "UPDATE Orders SET Status = @Status, UpdatedAt = @UpdatedAt WHERE Id = @Id";
        await connection.ExecuteAsync(sql, new { Id = request.Id, Status = OrderStatus.Active.ToString(), UpdatedAt = DateTime.UtcNow });
        await _auditLogService.LogAsync("Orders", request.Id, "Activate");
        return Unit.Value;
    }

    public async Task<Unit> Handle(CompleteOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>("SELECT Status FROM Orders WHERE Id = @Id", new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("Sipariş bulunamadı.");

        if (existing.status != OrderStatus.Active.ToString())
        {
            throw new InvalidOperationException("Yalnızca aktif durumundaki siparişler tamamlanabilir.");
        }

        const string sql = "UPDATE Orders SET Status = @Status, UpdatedAt = @UpdatedAt WHERE Id = @Id";
        await connection.ExecuteAsync(sql, new { Id = request.Id, Status = OrderStatus.Completed.ToString(), UpdatedAt = DateTime.UtcNow });
        await _auditLogService.LogAsync("Orders", request.Id, "Complete");
        return Unit.Value;
    }

    public async Task<Unit> Handle(CancelOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>("SELECT Status FROM Orders WHERE Id = @Id", new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("Sipariş bulunamadı.");

        if (existing.status == OrderStatus.Completed.ToString() || existing.status == OrderStatus.Cancelled.ToString())
        {
            throw new InvalidOperationException("Tamamlanmış veya iptal edilmiş siparişler tekrar iptal edilemez.");
        }

        const string sql = "UPDATE Orders SET Status = @Status, UpdatedAt = @UpdatedAt WHERE Id = @Id";
        await connection.ExecuteAsync(sql, new { Id = request.Id, Status = OrderStatus.Cancelled.ToString(), UpdatedAt = DateTime.UtcNow });
        await _auditLogService.LogAsync("Orders", request.Id, "Cancel");
        return Unit.Value;
    }

    public async Task<Unit> Handle(DeleteOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>("SELECT Status FROM Orders WHERE Id = @Id", new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("Sipariş bulunamadı.");

        if (existing.status != OrderStatus.Draft.ToString() && existing.status != OrderStatus.Cancelled.ToString())
        {
            throw new InvalidOperationException("Yalnızca taslak veya iptal durumundaki siparişler silinebilir.");
        }

        const string sql = "DELETE FROM Orders WHERE Id = @Id";
        await connection.ExecuteAsync(sql, new { Id = request.Id });
        await _auditLogService.LogAsync("Orders", request.Id, "Delete", existing, null);
        return Unit.Value;
    }

    public async Task<PrintOrderCodesResult> Handle(PrintOrderCodesPdfQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var order = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT OrderNo FROM Orders WHERE Id = @Id", new { Id = request.OrderId });
        if (order == null) throw new KeyNotFoundException("Sipariş bulunamadı.");
        string orderNo = order.orderno;

        var codes = (await connection.QueryAsync<string>(
            "SELECT RawCode FROM ProductCodes WHERE OrderId = @OrderId ORDER BY CreatedAt ASC",
            new { OrderId = request.OrderId })).ToList();

        if (codes.Count == 0)
        {
            throw new InvalidOperationException("Siparişe ait yüklenmiş barkod bulunamadı.");
        }

        if (request.SplitSize > 0 && codes.Count > request.SplitSize)
        {
            using var zipMs = new MemoryStream();
            using (var archive = new global::System.IO.Compression.ZipArchive(zipMs, global::System.IO.Compression.ZipArchiveMode.Create, true))
            {
                int partNo = 1;
                for (int i = 0; i < codes.Count; i += request.SplitSize)
                {
                    var chunk = codes.Skip(i).Take(request.SplitSize).ToList();
                    byte[] pdfBytes = _labelGenerator.GenerateDataMatrixCodesPdf(
                        chunk, request.Cols, request.Rows, request.Size, request.AddText, request.Line1, request.Line2, request.LabelBelow);

                    var entry = archive.CreateEntry($"dm_labels_{orderNo}_part{partNo}.pdf");
                    using var entryStream = entry.Open();
                    await entryStream.WriteAsync(pdfBytes, 0, pdfBytes.Length, cancellationToken);
                    partNo++;
                }
            }

            return new PrintOrderCodesResult(zipMs.ToArray(), "application/zip", $"dm_labels_{orderNo}.zip");
        }
        else
        {
            byte[] pdfBytes = _labelGenerator.GenerateDataMatrixCodesPdf(
                codes, request.Cols, request.Rows, request.Size, request.AddText, request.Line1, request.Line2, request.LabelBelow);

            return new PrintOrderCodesResult(pdfBytes, "application/pdf", $"dm_labels_{orderNo}.pdf");
        }
    }

    public async Task<OrderImportResultDto> Handle(ImportOrdersExcelCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        if (connection.State != global::System.Data.ConnectionState.Open) connection.Open();

        var ordersToInsert = new List<dynamic>();
        var errors = new List<ImportErrorDto>();
        int totalRows = 0;
        int importedCount = 0;
        int duplicateCount = 0;
        int invalidCount = 0;

        try
        {
            using var workbook = new ClosedXML.Excel.XLWorkbook(request.FileStream);
            var worksheet = workbook.Worksheets.FirstOrDefault();
            if (worksheet == null)
            {
                throw new InvalidOperationException("Çalışma sayfası bulunamadı.");
            }

            var rows = worksheet.RangeUsed().RowsUsed().ToList();
            if (rows.Count <= 1)
            {
                throw new InvalidOperationException("Excel dosyası boş veya sadece başlık satırı içeriyor.");
            }

            // Identify column headers
            var headerRow = rows.First();
            int colCount = headerRow.CellCount();
            
            int orderNoCol = -1;
            int customerNameCol = -1;
            int gtinCol = -1;
            int stockCodeCol = -1;
            int productNameCol = -1;
            int productPerCartonCol = -1;
            int cartonPerPalletCol = -1;
            int qtyCol = -1;

            for (int col = 1; col <= colCount; col++)
            {
                string header = headerRow.Cell(col).GetValue<string>().Trim().ToLowerInvariant();
                if (header.Contains("sipariş no") || header.Contains("siparis no") || header.Contains("order no"))
                    orderNoCol = col;
                else if (header.Contains("firma") || header.Contains("müşteri") || header.Contains("musteri") || header.Contains("customer"))
                    customerNameCol = col;
                else if (header.Contains("iş emri") || header.Contains("is emri") || header.Contains("işemri") || header.Contains("isemri") || header.Contains("work order"))
                    gtinCol = col;
                else if (header.Contains("stok kodu") || header.Contains("stokkodu") || header.Contains("stock code") || header.Contains("sku"))
                    stockCodeCol = col;
                else if (header.Contains("stok ismi") || header.Contains("stok adı") || header.Contains("stok adi") || header.Contains("product name") || header.Contains("ürün adı") || header.Contains("urun adi"))
                    productNameCol = col;
                else if (header.Contains("koli içi") || header.Contains("koli ici") || header.Contains("koli içi adet") || header.Contains("koli ici adet") || header.Contains("product per carton") || header.Contains("per carton"))
                    productPerCartonCol = col;
                else if (header.Contains("palet içi") || header.Contains("palet ici") || header.Contains("palet içi koli") || header.Contains("palet ici koli") || header.Contains("carton per pallet") || header.Contains("per pallet"))
                    cartonPerPalletCol = col;
                else if (header.Contains("miktar") || header.Contains("adet") || header.Contains("expected quantity") || header.Contains("quantity") || header.Contains("qty"))
                    qtyCol = col;
            }

            // Fallback to position-based indexing if headers not detected
            if (orderNoCol == -1) orderNoCol = 1;
            if (customerNameCol == -1) customerNameCol = 2;
            if (gtinCol == -1) gtinCol = 3;
            if (stockCodeCol == -1) stockCodeCol = 4;
            if (productNameCol == -1) productNameCol = 5;
            if (qtyCol == -1) qtyCol = 6;
            if (productPerCartonCol == -1) productPerCartonCol = 7;
            if (cartonPerPalletCol == -1) cartonPerPalletCol = 8;

            // Load existing OrderNo and StockCode combinations from database
            var existingOrdersList = await connection.QueryAsync<OrderKeyDto>("SELECT OrderNo, StockCode FROM Orders");
            var existingOrders = existingOrdersList
                .Select(x => $"{x.OrderNo.Trim()}|||{(x.StockCode ?? "").Trim()}")
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var seenOrdersInFile = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            for (int i = 1; i < rows.Count; i++) // Skip header
            {
                var row = rows[i];
                int rowNo = row.RowNumber();

                string orderNo = orderNoCol <= colCount ? GetCellValueAsString(row.Cell(orderNoCol)) : "";
                string customerName = customerNameCol <= colCount ? GetCellValueAsString(row.Cell(customerNameCol)) : "";
                string gtin = gtinCol <= colCount ? GetCellValueAsString(row.Cell(gtinCol)) : "";
                string stockCode = stockCodeCol <= colCount ? GetCellValueAsString(row.Cell(stockCodeCol)) : "";
                string productName = productNameCol <= colCount ? GetCellValueAsString(row.Cell(productNameCol)) : "";
                string qtyStr = qtyCol <= colCount ? GetCellValueAsString(row.Cell(qtyCol)) : "";
                string productPerCartonStr = productPerCartonCol <= colCount ? GetCellValueAsString(row.Cell(productPerCartonCol)) : "";
                string cartonPerPalletStr = cartonPerPalletCol <= colCount ? GetCellValueAsString(row.Cell(cartonPerPalletCol)) : "";

                if (string.IsNullOrWhiteSpace(orderNo))
                {
                    // If the whole row is empty, just skip it silently
                    if (string.IsNullOrWhiteSpace(customerName) && string.IsNullOrWhiteSpace(qtyStr))
                    {
                        continue;
                    }
                    invalidCount++;
                    errors.Add(new ImportErrorDto(rowNo, "", "Sipariş numarası boş olamaz."));
                    continue;
                }

                totalRows++;

                if (string.IsNullOrWhiteSpace(customerName) || string.IsNullOrWhiteSpace(qtyStr))
                {
                    invalidCount++;
                    errors.Add(new ImportErrorDto(rowNo, orderNo, "Eksik bilgi (Firma veya Miktar boş olamaz)."));
                    continue;
                }

                if (string.IsNullOrWhiteSpace(gtin))
                {
                    gtin = $"WO-{orderNo}";
                }

                if (!TryParseExcelInt(qtyStr, out int expectedQty) || expectedQty <= 0)
                {
                    invalidCount++;
                    errors.Add(new ImportErrorDto(rowNo, orderNo, $"Miktar bilgisi hatalı: {qtyStr}. 0'dan büyük tam sayı olmalıdır."));
                    continue;
                }

                if (string.IsNullOrWhiteSpace(productPerCartonStr))
                {
                    invalidCount++;
                    errors.Add(new ImportErrorDto(rowNo, orderNo, "Koli içi adet bilgisi boş olamaz."));
                    continue;
                }

                if (!TryParseExcelInt(productPerCartonStr, out int productPerCarton) || productPerCarton <= 0)
                {
                    invalidCount++;
                    errors.Add(new ImportErrorDto(rowNo, orderNo, $"Koli içi adet bilgisi hatalı: {productPerCartonStr}. 0'dan büyük tam sayı olmalıdır."));
                    continue;
                }

                int cartonPerPallet = 20; // Default if not provided
                if (!string.IsNullOrWhiteSpace(cartonPerPalletStr))
                {
                    if (!TryParseExcelInt(cartonPerPalletStr, out cartonPerPallet) || cartonPerPallet <= 0)
                    {
                        invalidCount++;
                        errors.Add(new ImportErrorDto(rowNo, orderNo, $"Palet içi koli bilgisi hatalı: {cartonPerPalletStr}. 0'dan büyük tam sayı olmalıdır."));
                        continue;
                    }
                }

                string orderKey = $"{orderNo.Trim()}|||{stockCode.Trim()}";

                if (existingOrders.Contains(orderKey))
                {
                    duplicateCount++;
                    errors.Add(new ImportErrorDto(rowNo, orderNo, $"Veritabanında bu sipariş numarası ve stok kodu ({stockCode}) kombinasyonu zaten mevcut."));
                    continue;
                }

                if (seenOrdersInFile.Contains(orderKey))
                {
                    duplicateCount++;
                    errors.Add(new ImportErrorDto(rowNo, orderNo, $"Dosya içerisinde mükerrer sipariş numarası ve stok kodu ({stockCode}) kombinasyonu."));
                    continue;
                }

                seenOrdersInFile.Add(orderKey);

                ordersToInsert.Add(new
                {
                    Id = Guid.NewGuid(),
                    OrderNo = orderNo,
                    CustomerName = customerName,
                    StockCode = string.IsNullOrWhiteSpace(stockCode) ? (string?)null : stockCode,
                    ProductName = string.IsNullOrWhiteSpace(productName) ? (string?)null : productName,
                    GTIN = gtin,
                    ProductPerCarton = productPerCarton,
                    CartonPerPallet = cartonPerPallet,
                    ExpectedQuantity = expectedQty,
                    Description = "Excel ile toplu aktarıldı.",
                    Status = OrderStatus.Draft.ToString(),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            // Bulk Insert
            if (ordersToInsert.Count > 0)
            {
                using var transaction = connection.BeginTransaction();
                try
                {
                    const string sql = @"
                        INSERT INTO Orders (Id, OrderNo, CustomerName, StockCode, ProductName, GTIN, ProductPerCarton, CartonPerPallet, ExpectedQuantity, Description, Status, CreatedAt, UpdatedAt)
                        VALUES (@Id, @OrderNo, @CustomerName, @StockCode, @ProductName, @GTIN, @ProductPerCarton, @CartonPerPallet, @ExpectedQuantity, @Description, @Status, @CreatedAt, @UpdatedAt)";

                    await connection.ExecuteAsync(sql, ordersToInsert, transaction);
                    transaction.Commit();
                    importedCount = ordersToInsert.Count;

                    // Log Audit for each order
                    foreach (var order in ordersToInsert)
                    {
                        await _auditLogService.LogAsync("Orders", order.Id, "BulkImport", null, order);
                    }
                }
                catch (Exception ex)
                {
                    transaction.Rollback();
                    throw new InvalidOperationException("Siparişler kaydedilirken veritabanı hatası oluştu: " + ex.Message, ex);
                }
            }
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Excel dosyası okunurken hata oluştu: " + ex.Message, ex);
        }

        return new OrderImportResultDto(totalRows, importedCount, duplicateCount, invalidCount, errors);
    }

    private static string GetCellValueAsString(ClosedXML.Excel.IXLCell cell)
    {
        if (cell.DataType == ClosedXML.Excel.XLDataType.Number)
        {
            return cell.Value.GetNumber().ToString("F0", global::System.Globalization.CultureInfo.InvariantCulture).Trim();
        }
        return cell.GetFormattedString().Trim();
    }

    private static bool TryParseExcelInt(string input, out int value)
    {
        value = 0;
        if (string.IsNullOrWhiteSpace(input)) return false;

        if (int.TryParse(input, global::System.Globalization.NumberStyles.Integer, global::System.Globalization.CultureInfo.InvariantCulture, out value))
        {
            return true;
        }

        if (double.TryParse(input, global::System.Globalization.NumberStyles.Float, global::System.Globalization.CultureInfo.InvariantCulture, out double doubleVal))
        {
            value = (int)Math.Round(doubleVal);
            return true;
        }

        if (double.TryParse(input.Replace(",", "."), global::System.Globalization.NumberStyles.Float, global::System.Globalization.CultureInfo.InvariantCulture, out double doubleValComma))
        {
            value = (int)Math.Round(doubleValComma);
            return true;
        }

        return false;
    }
}

#endregion
