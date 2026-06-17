using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using QuestPDF.Infrastructure;
using Serilog;
using TrackTrace.Application;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;
using TrackTrace.Application.Features.Auth;
using TrackTrace.Application.Features.Cartons;
using TrackTrace.Application.Features.Orders;
using TrackTrace.Application.Features.Pallets;
using TrackTrace.Application.Features.Reports;
using TrackTrace.Application.Features.Scan;
using TrackTrace.Application.Features.Users;
using TrackTrace.Domain.Enums;
using TrackTrace.Infrastructure;
using TrackTrace.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

QuestPDF.Settings.License = LicenseType.Community;

// Add services
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultPolicy", policy =>
    {
        policy.WithOrigins(
                "https://track.alperates.com.tr", 
                "http://localhost:5173", 
                "http://localhost:3000", 
                "http://localhost")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure Authentication & Authorization
var jwtSecret = builder.Configuration["Jwt:Secret"];
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    throw new InvalidOperationException("Kritik Yapılandırma Hatası: JWT Secret (Jwt:Secret) tanımlanmamış.");
}
var key = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole(UserRole.Admin.ToString()));
    options.AddPolicy("OperatorOrAdmin", policy => policy.RequireRole(UserRole.Admin.ToString(), UserRole.Operator.ToString()));
    options.AddPolicy("ViewerOrAbove", policy => policy.RequireRole(UserRole.Admin.ToString(), UserRole.Operator.ToString(), UserRole.Viewer.ToString()));
});

// Swagger/OpenAPI setup with JWT Support
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "TrackTrace API", Version = "v1" });
    
    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "JWT Authentication",
        Description = "Enter JWT Bearer token **_only_**",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference
        {
            Id = JwtBearerDefaults.AuthenticationScheme,
            Type = ReferenceType.SecurityScheme
        }
    };
    c.AddSecurityDefinition(securityScheme.Reference.Id, securityScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { securityScheme, Array.Empty<string>() }
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("DefaultPolicy");

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Beklenmeyen API hatasi olustu.");

        if (context.Response.HasStarted)
        {
            throw;
        }

        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        await context.Response.WriteAsJsonAsync(new
        {
            message = "Sunucuda beklenmeyen bir hata olustu. Lutfen tekrar deneyin."
        });
    }
});

app.UseAuthentication();
app.UseAuthorization();

// Initialize DB and Seed Admin User
try
{
    using var scope = app.Services.CreateScope();
    var dbFactory = (DbConnectionFactory)scope.ServiceProvider.GetRequiredService<IDbConnectionFactory>();
    
    Log.Information("Veritabanı başlatılıyor...");
    dbFactory.InitializeDatabase();
    Log.Information("Veritabanı başarıyla başlatıldı ve güncellendi.");

    // Seed Admin User
    using var connection = dbFactory.CreateConnection();
    var adminUsername = builder.Configuration["Seed:AdminUsername"] ?? "admin";
    var adminPassword = builder.Configuration["Seed:AdminPassword"];
    var adminName = builder.Configuration["Seed:AdminName"] ?? "Sistem Yöneticisi";

    if (string.IsNullOrWhiteSpace(adminPassword))
    {
        throw new InvalidOperationException("Kritik Yapılandırma Hatası: Başlangıç yönetici şifresi (Seed:AdminPassword) tanımlanmamış.");
    }

    var adminExists = await connection.ExecuteScalarAsync<bool>(
        "SELECT EXISTS(SELECT 1 FROM Users WHERE Username = @Username)", new { Username = adminUsername });

    if (!adminExists)
    {
        Log.Information("Varsayılan Admin kullanıcısı oluşturuluyor...");
        string passwordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);
        
        await connection.ExecuteAsync(@"
            INSERT INTO Users (Id, Name, Username, PasswordHash, Role, IsActive, CreatedAt)
            VALUES (@Id, @Name, @Username, @PasswordHash, @Role, TRUE, @CreatedAt)",
            new
            {
                Id = Guid.NewGuid(),
                Name = adminName,
                Username = adminUsername,
                PasswordHash = passwordHash,
                Role = UserRole.Admin.ToString(),
                CreatedAt = DateTime.UtcNow
            });
        Log.Information("Varsayılan Admin kullanıcısı başarıyla oluşturuldu.");
    }
}
catch (Exception ex)
{
    Log.Fatal(ex, "Uygulama başlatılırken kritik veritabanı hatası oluştu.");
    throw; // Ensure application fails securely
}

// ==================== ENDPOINTS ====================

// Health Endpoint
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }))
   .AllowAnonymous();

// Auth Endpoints
app.MapPost("/api/auth/login", async (LoginRequest request, IMediator mediator) =>
{
    try
    {
        var result = await mediator.Send(new LoginCommand(request.Username, request.Password));
        return Results.Ok(result);
    }
    catch (UnauthorizedAccessException ex)
    {
        return Results.Json(new { message = ex.Message }, statusCode: 401);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).AllowAnonymous();

// Users Endpoints
app.MapGet("/api/users", async (IMediator mediator) =>
{
    var users = await mediator.Send(new GetUsersQuery());
    return Results.Ok(users);
}).RequireAuthorization("AdminOnly");

app.MapPost("/api/users", async (CreateUserRequest request, IMediator mediator) =>
{
    try
    {
        var id = await mediator.Send(new CreateUserCommand(request));
        return Results.Created($"/api/users/{id}", new { id });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("AdminOnly");

app.MapPut("/api/users/{id:guid}", async (Guid id, UpdateUserRequest request, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new UpdateUserCommand(id, request));
        return Results.NoContent();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("AdminOnly");

app.MapPost("/api/users/{id:guid}/toggle", async (Guid id, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new ToggleUserActiveCommand(id));
        return Results.NoContent();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("AdminOnly");

// Dashboard Summary
app.MapGet("/api/dashboard/summary", async (IMediator mediator) =>
{
    var summary = await mediator.Send(new GetDashboardSummaryQuery());
    return Results.Ok(summary);
}).RequireAuthorization("ViewerOrAbove");

// Orders Endpoints
app.MapGet("/api/orders", async (
    [FromQuery] int? pageNumber,
    [FromQuery] int? pageSize,
    [FromQuery] string? search,
    [FromQuery] string? status,
    IMediator mediator) =>
{
    var (items, count) = await mediator.Send(new GetOrdersQuery(pageNumber ?? 1, pageSize ?? 10, search, status));
    return Results.Ok(new { items, totalCount = count });
}).RequireAuthorization("ViewerOrAbove");

app.MapGet("/api/orders/{id:guid}", async (Guid id, IMediator mediator) =>
{
    try
    {
        var order = await mediator.Send(new GetOrderByIdQuery(id));
        return Results.Ok(order);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
}).RequireAuthorization("ViewerOrAbove");

app.MapPost("/api/orders", async (CreateOrderRequest request, IMediator mediator) =>
{
    try
    {
        var id = await mediator.Send(new CreateOrderCommand(request));
        return Results.Created($"/api/orders/{id}", new { id });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapPut("/api/orders/{id:guid}", async (Guid id, UpdateOrderRequest request, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new UpdateOrderCommand(id, request));
        return Results.NoContent();
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapPost("/api/orders/{id:guid}/activate", async (Guid id, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new ActivateOrderCommand(id));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapPost("/api/orders/{id:guid}/complete", async (Guid id, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new CompleteOrderCommand(id));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapPost("/api/orders/{id:guid}/cancel", async (Guid id, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new CancelOrderCommand(id));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapDelete("/api/orders/{id:guid}", async (Guid id, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new DeleteOrderCommand(id));
        return Results.NoContent();
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapPost("/api/orders/{id:guid}/print-codes", async (
    Guid id,
    [FromBody] PrintCodesRequest request,
    IMediator mediator) =>
{
    try
    {
        var query = new PrintOrderCodesPdfQuery(
            id,
            request.Cols,
            request.Rows,
            request.Size,
            request.AddText,
            request.Line1,
            request.Line2,
            request.LabelBelow,
            request.SplitSize);

        var result = await mediator.Send(query);
        return Results.File(result.FileContents, result.ContentType, result.FileName);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound(new { message = "Sipariş bulunamadı." });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

// Upload/Import Endpoints
app.MapPost("/api/orders/{id:guid}/import-codes", async (Guid id, IFormFile file, IMediator mediator) =>
{
    if (file == null || file.Length == 0)
    {
        return Results.BadRequest(new { message = "Lütfen geçerli bir dosya yükleyin." });
    }

    try
    {
        using var stream = file.OpenReadStream();
        var result = await mediator.Send(new ImportProductCodesCommand(id, file.FileName, stream));
        return Results.Ok(result);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound(new { message = "Sipariş bulunamadı." });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin").DisableAntiforgery();

app.MapPost("/api/orders/import-excel", async (IFormFile file, IMediator mediator) =>
{
    if (file == null || file.Length == 0)
    {
        return Results.BadRequest(new { message = "Lütfen geçerli bir dosya yükleyin." });
    }

    try
    {
        using var stream = file.OpenReadStream();
        var result = await mediator.Send(new ImportOrdersExcelCommand(stream, file.FileName));
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin").DisableAntiforgery();

app.MapPost("/api/datamatrix/analyze", async (HttpRequest request) =>
{
    try
    {
        var form = await request.ReadFormAsync();
        var file = form.Files.GetFile("file");
        if (file == null || file.Length == 0)
        {
            return Results.BadRequest(new { message = "Lütfen geçerli bir dosya yükleyin." });
        }

        var errors = new List<object>();
        var validCodes = new List<string>();
        int totalLines = 0;
        int rowNo = 0;

        using (var reader = new StreamReader(file.OpenReadStream()))
        {
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                rowNo++;
                if (string.IsNullOrWhiteSpace(line)) continue;
                totalLines++;

                var parseResult = TrackTrace.Application.Common.Gs1AutoHelper.NormalizeForEncoding(line);
                if (parseResult.Success)
                {
                    validCodes.Add(parseResult.Normalized);
                }
                else
                {
                    errors.Add(new { rowNo, rawLine = line, errorMessage = parseResult.ErrorMessage ?? "Geçersiz barkod formatı." });
                }
            }
        }

        return Results.Ok(new
        {
            totalLines,
            validCount = validCodes.Count,
            invalidCount = errors.Count,
            previewCodes = validCodes.Take(5).ToList(),
            errors
        });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin").DisableAntiforgery();

app.MapPost("/api/datamatrix/generate", async (HttpRequest request, ILabelGenerator labelGenerator) =>
{
    try
    {
        var form = await request.ReadFormAsync();
        var file = form.Files.GetFile("file");
        if (file == null || file.Length == 0)
        {
            return Results.BadRequest(new { message = "Lütfen geçerli bir dosya yükleyin." });
        }

        string format = form["format"].ToString() ?? "PDF";
        int cols = int.TryParse(form["cols"], out int c) ? c : 4;
        int rows = int.TryParse(form["rows"], out int r) ? r : 6;
        int size = int.TryParse(form["size"], out int s) ? s : 100;
        bool addText = bool.TryParse(form["addText"], out bool at) && at;
        string? line1 = form["line1"].ToString();
        string? line2 = form["line2"].ToString();
        bool labelBelow = !bool.TryParse(form["labelBelow"], out bool lb) || lb;

        var validCodes = new List<string>();
        using (var reader = new StreamReader(file.OpenReadStream()))
        {
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                var parseResult = TrackTrace.Application.Common.Gs1AutoHelper.NormalizeForEncoding(line);
                string finalCode = parseResult.Success ? parseResult.Normalized : line;
                validCodes.Add(finalCode);
            }
        }

        if (validCodes.Count == 0)
        {
            return Results.BadRequest(new { message = "Dosya içerisinde kod bulunamadı." });
        }

        if (string.Equals(format, "PNG", StringComparison.OrdinalIgnoreCase))
        {
            byte[] zipBytes = labelGenerator.GenerateDataMatrixZip(validCodes);
            return Results.File(zipBytes, "application/zip", "datamatrix_images.zip");
        }
        else // PDF
        {
            byte[] pdfBytes = labelGenerator.GenerateDataMatrixCodesPdf(
                validCodes, cols, rows, size, addText, line1, line2, labelBelow);

            return Results.File(pdfBytes, "application/pdf", "datamatrix_labels.pdf");
        }
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin").DisableAntiforgery();

app.MapGet("/api/datamatrix/preview", (string text, ILabelGenerator labelGenerator) =>
{
    try
    {
        var parseResult = TrackTrace.Application.Common.Gs1AutoHelper.NormalizeForEncoding(text);
        string finalCode = parseResult.Success ? parseResult.Normalized : text;
        byte[] imgBytes = labelGenerator.GenerateDataMatrixImage(finalCode);
        return Results.File(imgBytes, "image/png");
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

// Scan Endpoints
app.MapPost("/api/scan/product", async (ScanRequest request, IMediator mediator) =>
{
    var response = await mediator.Send(new ScanProductCommand(request));
    if (!response.Success)
    {
        return Results.BadRequest(response);
    }
    return Results.Ok(response);
}).RequireAuthorization("OperatorOrAdmin");

app.MapGet("/api/scan/current-carton", async ([FromQuery] Guid orderId, IMediator mediator) =>
{
    var response = await mediator.Send(new GetCurrentCartonQuery(orderId));
    return Results.Ok(response);
}).RequireAuthorization("OperatorOrAdmin");

// Cartons Endpoints
app.MapGet("/api/cartons", async (
    [FromQuery] int? pageNumber,
    [FromQuery] int? pageSize,
    [FromQuery] string? search,
    [FromQuery] string? status,
    [FromQuery] Guid? orderId,
    [FromQuery] Guid? palletId,
    IMediator mediator) =>
{
    var (items, count) = await mediator.Send(new GetCartonsQuery(pageNumber ?? 1, pageSize ?? 10, search, status, orderId, palletId));
    return Results.Ok(new { items, totalCount = count });
}).RequireAuthorization("ViewerOrAbove");

app.MapGet("/api/cartons/{id:guid}", async (Guid id, IMediator mediator) =>
{
    try
    {
        var carton = await mediator.Send(new GetCartonByIdQuery(id));
        return Results.Ok(carton);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
}).RequireAuthorization("ViewerOrAbove");

app.MapGet("/api/cartons/{id:guid}/items", async (Guid id, IMediator mediator) =>
{
    var items = await mediator.Send(new GetCartonItemsQuery(id));
    return Results.Ok(items);
}).RequireAuthorization("ViewerOrAbove");

app.MapPost("/api/cartons/{id:guid}/print", async (Guid id, [FromQuery] string format, IMediator mediator) =>
{
    try
    {
        var (fileContent, zplText) = await mediator.Send(new PrintCartonLabelCommand(id, format));
        if (format.Equals("PDF", StringComparison.OrdinalIgnoreCase))
        {
            return Results.Bytes(fileContent!, "application/pdf", $"carton_label_{id}.pdf");
        }
        return Results.Ok(new { zpl = zplText });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapGet("/api/cartons/{id:guid}/label.pdf", async (Guid id, IMediator mediator) =>
{
    try
    {
        var (fileContent, _) = await mediator.Send(new PrintCartonLabelCommand(id, "PDF"));
        return Results.Bytes(fileContent!, "application/pdf", $"carton_label_{id}.pdf");
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("ViewerOrAbove");

app.MapGet("/api/cartons/{id:guid}/label.zpl", async (Guid id, IMediator mediator) =>
{
    try
    {
        var (_, zplText) = await mediator.Send(new PrintCartonLabelCommand(id, "ZPL"));
        return Results.Ok(new { zpl = zplText });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("ViewerOrAbove");

app.MapPost("/api/cartons/{id:guid}/decompose", async (Guid id, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new DecomposeCartonCommand(id));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapPost("/api/cartons/{id:guid}/remove-product", async (Guid id, [FromQuery] string rawCode, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new RemoveProductFromCartonCommand(id, rawCode));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapPost("/api/cartons/{id:guid}/add-product", async (Guid id, [FromQuery] string rawCode, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new AddProductToCartonCommand(id, rawCode));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

// Pallets Endpoints
app.MapGet("/api/pallets", async (
    [FromQuery] int? pageNumber,
    [FromQuery] int? pageSize,
    [FromQuery] string? search,
    [FromQuery] string? status,
    [FromQuery] Guid? orderId,
    IMediator mediator) =>
{
    var (items, count) = await mediator.Send(new GetPalletsQuery(pageNumber ?? 1, pageSize ?? 10, search, status, orderId));
    return Results.Ok(new { items, totalCount = count });
}).RequireAuthorization("ViewerOrAbove");

app.MapPost("/api/pallets", async ([FromQuery] Guid orderId, IMediator mediator) =>
{
    try
    {
        var id = await mediator.Send(new CreatePalletCommand(orderId));
        return Results.Created($"/api/pallets/{id}", new { id });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapGet("/api/pallets/{id:guid}", async (Guid id, IMediator mediator) =>
{
    try
    {
        var pallet = await mediator.Send(new GetPalletByIdQuery(id));
        return Results.Ok(pallet);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
}).RequireAuthorization("ViewerOrAbove");

app.MapPost("/api/pallets/{id:guid}/add-carton", async (Guid id, [FromQuery] string cartonSscc, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new AddCartonToPalletCommand(id, cartonSscc));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapPost("/api/pallets/{id:guid}/transfer-carton", async (Guid id, [FromQuery] Guid cartonId, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new TransferCartonPalletCommand(cartonId, id));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapPost("/api/pallets/{id:guid}/close", async (Guid id, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new ClosePalletCommand(id));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapDelete("/api/pallets/{id:guid}", async (Guid id, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new DeletePalletCommand(id));
        return Results.NoContent();
    }
    catch (KeyNotFoundException ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("OperatorOrAdmin");

app.MapGet("/api/pallets/{id:guid}/label.pdf", async (Guid id, IMediator mediator) =>
{
    try
    {
        var (fileContent, _) = await mediator.Send(new PrintPalletLabelCommand(id, "PDF"));
        return Results.Bytes(fileContent!, "application/pdf", $"pallet_label_{id}.pdf");
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("ViewerOrAbove");

app.MapGet("/api/pallets/{id:guid}/label.zpl", async (Guid id, IMediator mediator) =>
{
    try
    {
        var (_, zplText) = await mediator.Send(new PrintPalletLabelCommand(id, "ZPL"));
        return Results.Ok(new { zpl = zplText });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("ViewerOrAbove");

// Barcode Search
app.MapGet("/api/barcodes/search", async ([FromQuery] string code, IMediator mediator) =>
{
    var result = await mediator.Send(new BarcodeSearchQuery(code));
    if (result == null)
    {
        return Results.NotFound(new { message = "Barkod bulunamadı." });
    }
    return Results.Ok(result);
}).RequireAuthorization("ViewerOrAbove");

app.MapGet("/api/barcodes/public/search", async ([FromQuery] string code, IMediator mediator) =>
{
    var result = await mediator.Send(new BarcodeSearchQuery(code));
    if (result == null)
    {
        return Results.NotFound(new { message = "Barkod bulunamadı." });
    }
    return Results.Ok(result);
});

// Print Jobs History
app.MapGet("/api/print-jobs", async (
    [FromQuery] int? pageNumber,
    [FromQuery] int? pageSize,
    IMediator mediator) =>
{
    var (items, count) = await mediator.Send(new GetPrintJobsQuery(pageNumber ?? 1, pageSize ?? 10));
    return Results.Ok(new { items, totalCount = count });
}).RequireAuthorization("ViewerOrAbove");

// System Info & Health (Admin Only)
app.MapGet("/api/system/info", async (IMediator mediator, IConfiguration config) =>
{
    var version = config["APP_VERSION"] ?? "v0.1.0-mvp";
    var date = config["BUILD_DATE"] ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
    var sha = config["GIT_COMMIT_SHA"] ?? "dev-sha";
    var frontendUrl = config["FRONTEND_URL"] ?? "https://track.alperates.com.tr";

    var result = await mediator.Send(new GetSystemInfoQuery(version, date, sha, frontendUrl));
    return Results.Ok(result);
}).RequireAuthorization("AdminOnly");

app.MapGet("/api/system/health", async (IDbConnectionFactory dbFactory) =>
{
    try
    {
        using var connection = dbFactory.CreateConnection();
        await connection.ExecuteScalarAsync<int>("SELECT 1");
        
        var workingSet = System.Diagnostics.Process.GetCurrentProcess().WorkingSet64;
        
        return Results.Ok(new
        {
            status = "Healthy",
            database = "Connected",
            memoryUsageMb = workingSet / (1024 * 1024),
            timestamp = DateTime.UtcNow
        });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, title: "Database Connection Failed");
    }
}).RequireAuthorization("AdminOnly");

app.Run();

public record PrintCodesRequest(
    int Cols,
    int Rows,
    int Size,
    bool AddText,
    string? Line1,
    string? Line2,
    bool LabelBelow,
    int SplitSize);
