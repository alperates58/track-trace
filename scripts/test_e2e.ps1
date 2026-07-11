param(
    [string]$BaseUrl = "http://127.0.0.1:18081",
    [string]$ComposeFile = "docker-compose.test.yml"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$orderNo = "E2E-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"

function Invoke-TestSql {
    param([Parameter(Mandatory)][string]$Sql)

    $result = docker compose -f $ComposeFile exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d track_trace_test -tA -c $Sql
    if ($LASTEXITCODE -ne 0) {
        throw "Test database command failed."
    }
    return ($result | Select-Object -Last 1).Trim()
}

Push-Location $repoRoot
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health"
    if ($health.status -ne "Healthy") {
        throw "API health check failed."
    }

    $loginBody = @{ username = "admin"; password = "admin123" } | ConvertTo-Json
    $loginRes = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $headers = @{ Authorization = "Bearer $($loginRes.token)" }

    $stations = @(Invoke-RestMethod -Uri "$BaseUrl/api/stations" -Headers $headers)
    if ($stations.Count -eq 0) {
        throw "No seeded station was found."
    }
    $stationId = $stations[0].id

    $createOrderBody = @{
        orderNo = $orderNo
        customerName = "Isolated E2E Customer"
        stockCode = "E2E-STOCK"
        productName = "Isolated E2E Product"
        gtin = "8690000000004"
        productPerCarton = 12
        expectedQuantity = 120
        plannedDate = [DateTime]::UtcNow.ToString("O")
    } | ConvertTo-Json
    $createRes = Invoke-RestMethod -Uri "$BaseUrl/api/orders" -Method Post -Body $createOrderBody -ContentType "application/json" -Headers $headers
    $orderId = $createRes.id

    Invoke-TestSql "UPDATE Orders SET Status = 'Active' WHERE Id = '$orderId';" | Out-Null

    $preprintBody = @{
        orderId = $orderId
        quantity = 2
        format = "zpl"
        batchId = [guid]::NewGuid().ToString()
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/api/cartons/preprint" -Method Post -Body $preprintBody -ContentType "application/json" -Headers $headers | Out-Null

    $cartonNo = Invoke-TestSql "SELECT CartonNo FROM Cartons WHERE OrderId = '$orderId' ORDER BY CreatedAt LIMIT 1;"
    if ([string]::IsNullOrWhiteSpace($cartonNo)) {
        throw "Pre-print flow did not create a carton."
    }

    $openCartonBody = @{ code = $cartonNo; stationId = $stationId } | ConvertTo-Json
    $openedCarton = Invoke-RestMethod -Uri "$BaseUrl/api/scan/preprinted/open-carton" -Method Post -Body $openCartonBody -ContentType "application/json" -Headers $headers

    $serialNumber = -join ((48..57) + (65..90) | Get-Random -Count 10 | ForEach-Object { [char]$_ })
    $productCode = "010869000000000410$serialNumber"
    Invoke-TestSql "INSERT INTO ProductCodes (Id, OrderId, RawCode, Gtin, SerialNo, Status) VALUES (gen_random_uuid(), '$orderId', '$productCode', '8690000000004', '$serialNumber', 'Uploaded');" | Out-Null

    $scanProductBody = @{
        orderId = $orderId
        rawCode = $productCode
        stationId = $stationId
        mode = "PrePrinted"
        activeCartonId = $openedCarton.cartonId
    } | ConvertTo-Json
    $scanResult = Invoke-RestMethod -Uri "$BaseUrl/api/scan/product" -Method Post -Body $scanProductBody -ContentType "application/json" -Headers $headers
    if (-not $scanResult.success) {
        throw "Product scan failed: $($scanResult.message)"
    }

    Write-Host "PASS: isolated health, authentication, order, pre-print, carton-open and product-scan flows."
}
finally {
    Pop-Location
}
