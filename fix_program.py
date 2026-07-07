import sys

file_path = r'c:\Users\alper.ates.LIDER\Desktop\track-trace\backend\src\TrackTrace.Api\Program.cs'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = 'app.MapPost("/api/cartons/{id:guid}/print-network"'
end_marker = 'app.MapPost("/api/pallets", async ([FromQuery] Guid orderId, IMediator mediator) =>'

idx_start = content.find(start_marker)
idx_end = content.find(end_marker)

if idx_start == -1 or idx_end == -1:
    print('Markers not found')
    sys.exit(1)

fixed_content = '''app.MapPost("/api/cartons/{id:guid}/print-network", async (Guid id, [FromBody] PrintNetworkRequest request, IMediator mediator) =>
{
    try
    {
        if (string.IsNullOrWhiteSpace(request.IpAddress))
        {
            return Results.BadRequest(new { message = "IP adresi boş olamaz." });
        }
        if (request.Port <= 0 || request.Port > 65535)
        {
            return Results.BadRequest(new { message = "Geçersiz port numarası." });
        }

        var (_, zplText) = await mediator.Send(new PrintCartonLabelCommand(id, "ZPL"));
        if (string.IsNullOrWhiteSpace(zplText))
        {
            return Results.BadRequest(new { message = "Koli ZPL etiketi oluşturulamadı." });
        }

        using (var client = new System.Net.Sockets.TcpClient())
        {
            var connectTask = client.ConnectAsync(request.IpAddress, request.Port);
            if (await Task.WhenAny(connectTask, Task.Delay(4000)) == connectTask)
            {
                await connectTask; // Wait for it to complete/throw
                using (var stream = client.GetStream())
                {
                    byte[] zplBytes = System.Text.Encoding.UTF8.GetBytes(zplText);
                    await stream.WriteAsync(zplBytes, 0, zplBytes.Length);
                    await stream.FlushAsync();
                }
                return Results.Ok(new { message = "Koli etiketi yazıcıya gönderildi." });
            }
            else
            {
                return Results.BadRequest(new { message = "Yazıcıya bağlanırken zaman aşımı oluştu. Lütfen IP adresi ve portu kontrol edin." });
            }
        }
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = $"Yazdırma hatası: {ex.Message}" });
    }
}).RequireAuthorization("OperatorOrAdmin");

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

app.MapPost("/api/cartons/{id:guid}/transfer", async (Guid id, [FromBody] TransferCartonRequest request, IMediator mediator) =>
{
    try
    {
        await mediator.Send(new TransferCartonCommand(id, request));
        return Results.Ok();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).RequireAuthorization("AdminOnly");

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

'''

new_content = content[:idx_start] + fixed_content + content[idx_end:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Fixed Program.cs')
