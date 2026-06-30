using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TrackTrace.LocalAgent;
using System.IO;
using System;
using System.Security.Cryptography;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = WindowsServiceHelpers.IsWindowsService() ? AppContext.BaseDirectory : default
});

builder.Host.UseWindowsService();

builder.Services.AddSingleton<IPrintService, RawPrintService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecific", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "https://track.alperates.com.tr", "http://127.0.0.1:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configuration Setup
string dataDir = @"C:\ProgramData\TrackTraceAgent";
string logsDir = Path.Combine(dataDir, "Logs");
string configPath = Path.Combine(dataDir, "agent.config.json");

if (!Directory.Exists(dataDir)) Directory.CreateDirectory(dataDir);
if (!Directory.Exists(logsDir)) Directory.CreateDirectory(logsDir);

AgentConfig agentConfig;

if (!File.Exists(configPath))
{
    agentConfig = new AgentConfig
    {
        PairingToken = Guid.NewGuid().ToString(),
        DefaultPrinter = "ARGOX CP-2140"
    };
    File.WriteAllText(configPath, JsonSerializer.Serialize(agentConfig, new JsonSerializerOptions { WriteIndented = true }));
    Console.WriteLine($"[INIT] Created new config at {configPath}");
    Console.WriteLine($"[INIT] ----------------------------------------------------");
    Console.WriteLine($"[INIT] YOUR PAIRING TOKEN IS: {agentConfig.PairingToken}");
    Console.WriteLine($"[INIT] ----------------------------------------------------");
}
else
{
    agentConfig = JsonSerializer.Deserialize<AgentConfig>(File.ReadAllText(configPath));
    if (string.IsNullOrEmpty(agentConfig.PairingToken))
    {
        agentConfig.PairingToken = Guid.NewGuid().ToString();
        File.WriteAllText(configPath, JsonSerializer.Serialize(agentConfig, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine($"[INIT] Generated new token in existing config.");
        Console.WriteLine($"[INIT] YOUR PAIRING TOKEN IS: {agentConfig.PairingToken}");
    }
}

app.UseCors("AllowSpecific");

// Token Middleware
app.Use(async (context, next) =>
{
    if (!context.Request.Path.StartsWithSegments("/api"))
    {
        await next(context);
        return;
    }
    
    // Require token
    var authHeader = context.Request.Headers["Authorization"].ToString();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
    {
        context.Response.StatusCode = 401;
        await context.Response.WriteAsync("Unauthorized: Missing or invalid token");
        return;
    }
    
    var token = authHeader.Substring("Bearer ".Length).Trim();
    if (token != agentConfig.PairingToken)
    {
        context.Response.StatusCode = 401;
        await context.Response.WriteAsync("Unauthorized: Invalid pairing token");
        return;
    }
    
    await next(context);
});

// Endpoints
app.MapGet("/api/agent/status", () =>
{
    return Results.Ok(new { status = "Online", printer = agentConfig.DefaultPrinter });
});

app.MapPost("/api/printer/test", (PrintRequest req, IPrintService printService, ILogger<Program> logger) =>
{
    logger.LogInformation("Test print requested.");
    var success = printService.PrintRawZpl(req.Data, agentConfig.DefaultPrinter);
    return success ? Results.Ok(new { message = "Test print triggered" }) : Results.Problem("Failed to print");
});

app.MapPost("/api/print", (PrintRequest req, IPrintService printService, ILogger<Program> logger) =>
{
    logger.LogInformation("ZPL print requested.");
    var success = printService.PrintRawZpl(req.Data, agentConfig.DefaultPrinter);
    return success ? Results.Ok(new { message = "Print triggered" }) : Results.Problem("Failed to print");
});

app.MapPost("/api/print/zpl", (PrintRequest req, IPrintService printService, ILogger<Program> logger) =>
{
    logger.LogInformation("ZPL print requested.");
    var success = printService.PrintRawZpl(req.Data, agentConfig.DefaultPrinter);
    return success ? Results.Ok(new { message = "Print triggered" }) : Results.Problem("Failed to print");
});

app.Run("http://127.0.0.1:5000");

public class AgentConfig
{
    public string PairingToken { get; set; }
    public string DefaultPrinter { get; set; }
}

public class PrintRequest
{
    [JsonPropertyName("data")]
    public string Data { get; set; }
}
