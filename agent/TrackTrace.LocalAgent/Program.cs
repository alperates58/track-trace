using System.Management;
using System.Runtime.Versioning;
using System.Security.Cryptography;
using Microsoft.Extensions.Hosting.WindowsServices;
using TrackTrace.LocalAgent;

[assembly: SupportedOSPlatform("windows")]

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});

builder.Host.UseWindowsService();

var dataDirectory = Environment.GetEnvironmentVariable("TRACKTRACE_AGENT_DATA_DIR")
    ?? @"C:\ProgramData\TrackTraceAgent";
var configStore = new AgentConfigStore(dataDirectory);
var eventStore = new DigiEyeEventStore(dataDirectory);

builder.Services.AddSingleton(configStore);
builder.Services.AddSingleton(eventStore);
builder.Services.AddSingleton<DigiEyeRuntimeState>();
builder.Services.AddSingleton<DigiEyeFrameCache>();
builder.Services.AddSingleton<IPrintService, RawPrintService>();
builder.Services.AddHttpClient("DigiEyeCamera", client =>
{
    client.Timeout = Timeout.InfiniteTimeSpan;
    client.DefaultRequestHeaders.UserAgent.ParseAdd("TrackTrace-LocalAgent/2.0");
});
builder.Services.AddHostedService<DigiEyeScannerService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecific", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:3030",
                "http://127.0.0.1:3030",
                "https://track.alperates.com.tr")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors("AllowSpecific");

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("Access-Control-Allow-Private-Network", "true");

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    if (!context.Request.Path.StartsWithSegments("/api"))
    {
        await next(context);
        return;
    }

    var authHeader = context.Request.Headers.Authorization.ToString();
    if (!authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsync("Unauthorized: Missing or invalid token");
        return;
    }

    var token = authHeader["Bearer ".Length..].Trim();
    if (!CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(token),
            System.Text.Encoding.UTF8.GetBytes(configStore.PairingToken)))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsync("Unauthorized: Invalid pairing token");
        return;
    }

    await next(context);
});

app.MapGet("/api/agent/status", (AgentConfigStore store) =>
{
    var config = store.Snapshot();
    return Results.Ok(new { status = "Online", printer = config.DefaultPrinter });
});

app.MapGet("/api/agent/printers", () =>
{
    try
    {
        var printers = new List<string>();
        using var searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_Printer");
        foreach (var printer in searcher.Get())
            printers.Add(printer["Name"]?.ToString() ?? string.Empty);
        return Results.Ok(printers);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Failed to get printers: {ex.Message}");
    }
});

app.MapPost("/api/agent/config", (AgentConfig request, AgentConfigStore store) =>
{
    var config = store.UpdateAgent(request);
    return Results.Ok(new
    {
        message = "Configuration updated successfully",
        printer = config.DefaultPrinter,
        dummyMode = config.EnableDummyMode
    });
});

app.MapGet("/api/digieye/config", (AgentConfigStore store) => Results.Ok(store.Snapshot().DigiEye));

app.MapPost("/api/digieye/config", (DigiEyeConfigRequest request, AgentConfigStore store) =>
{
    try
    {
        return Results.Ok(store.UpdateDigiEye(request));
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

app.MapGet("/api/digieye/status", (
    AgentConfigStore store,
    DigiEyeRuntimeState runtime,
    DigiEyeEventStore events) =>
{
    return Results.Ok(runtime.Snapshot(store.Snapshot().DigiEye, events.PendingCount));
});

app.MapGet("/api/digieye/events", (long? after, int? limit, DigiEyeEventStore events) =>
{
    return Results.Ok(events.GetAfter(after ?? 0, limit ?? 25));
});

app.MapPost("/api/digieye/events/ack", (DigiEyeAckRequest request, DigiEyeEventStore events) =>
{
    if (request.Sequence <= 0)
        return Results.BadRequest(new { message = "Sequence must be greater than zero." });

    var result = events.Acknowledge(request.Sequence);
    if (result == DigiEyeAcknowledgeResult.OutOfOrder)
        return Results.Conflict(new { message = "Events must be acknowledged in FIFO order." });

    return Results.Ok(new
    {
        acknowledged = result == DigiEyeAcknowledgeResult.Acknowledged ? 1 : 0,
        alreadyAcknowledged = result == DigiEyeAcknowledgeResult.AlreadyAcknowledged
    });
});

app.MapGet("/api/digieye/frame", (HttpContext context, DigiEyeFrameCache frames) =>
{
    var frame = frames.Get();
    if (frame is null)
        return Results.NotFound(new { message = "Henüz kamera karesi alınmadı." });

    context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
    return Results.File(frame.Bytes, frame.ContentType);
});

app.MapPost("/api/digieye/simulate", (DigiEyeSimulationRequest request, AgentConfigStore store, DigiEyeEventStore events) =>
{
    if (!store.Snapshot().EnableDummyMode)
        return Results.BadRequest(new { message = "Simulation requires Agent dummy mode." });
    if (string.IsNullOrWhiteSpace(request.RawCode))
        return Results.BadRequest(new { message = "RawCode is required." });

    var item = events.Add(
        request.RawCode.Trim(),
        string.IsNullOrWhiteSpace(request.Format) ? "Simulation" : request.Format,
        DateTimeOffset.UtcNow,
        0,
        "simulation");
    return Results.Ok(item);
});

MapPrintEndpoint("/api/printer/test", "Test print requested.");
MapPrintEndpoint("/api/print", "Print requested.");
MapPrintEndpoint("/api/print/zpl", "ZPL print requested.");

var agentUrl = Environment.GetEnvironmentVariable("TRACKTRACE_AGENT_URL")
    ?? "http://127.0.0.1:5000";
app.Run(agentUrl);

void MapPrintEndpoint(string path, string logMessage)
{
    app.MapPost(path, (PrintRequest request, IPrintService printService, AgentConfigStore store, ILogger<Program> logger) =>
    {
        logger.LogInformation("{Message}", logMessage);
        var config = store.Snapshot();
        var result = printService.PrintRawZpl(request.Data, config.DefaultPrinter, config.EnableDummyMode);
        if (result.Success)
            return Results.Ok(new { message = "Print triggered", dummyMode = result.DummyMode });
        if (result.ErrorMessage.Contains("OpenPrinter failed", StringComparison.OrdinalIgnoreCase))
            return Results.BadRequest(new { error = $"Printer '{config.DefaultPrinter}' not found or inaccessible.", details = result.ErrorMessage });
        return Results.Problem(result.ErrorMessage);
    });
}
