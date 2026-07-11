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

    # Shipment fixtures are created only in the disposable test database.
    $standaloneCartonId = [guid]::NewGuid()
    $palletCartonId = [guid]::NewGuid()
    $palletId = [guid]::NewGuid()
    $palletCartonLinkId = [guid]::NewGuid()
    $standaloneSscc = "900000000000000001"
    $palletCartonSscc = "900000000000000002"
    $palletSscc = "800000000000000001"

    Invoke-TestSql "INSERT INTO Cartons (Id, OrderId, CartonNo, SSCC, TargetQuantity, ActualQuantity, Status, CreatedAt, ClosedAt) VALUES ('$standaloneCartonId', '$orderId', 'E2E-SHIP-C1', '$standaloneSscc', 1, 1, 'Closed', NOW(), NOW());" | Out-Null
    Invoke-TestSql "INSERT INTO Cartons (Id, OrderId, CartonNo, SSCC, TargetQuantity, ActualQuantity, Status, CreatedAt, ClosedAt) VALUES ('$palletCartonId', '$orderId', 'E2E-SHIP-C2', '$palletCartonSscc', 1, 1, 'Palletized', NOW(), NOW());" | Out-Null
    Invoke-TestSql "INSERT INTO Pallets (Id, OrderId, PalletNo, SSCC, Status, CreatedAt, ClosedAt) VALUES ('$palletId', '$orderId', 'E2E-SHIP-P1', '$palletSscc', 'Closed', NOW(), NOW());" | Out-Null
    Invoke-TestSql "INSERT INTO PalletCartons (Id, PalletId, CartonId, CreatedAt) VALUES ('$palletCartonLinkId', '$palletId', '$palletCartonId', NOW());" | Out-Null
    Invoke-TestSql "INSERT INTO ProductCodes (Id, OrderId, RawCode, Gtin, SerialNo, Status, CartonId, CreatedAt) VALUES (gen_random_uuid(), '$orderId', 'E2E-SHIP-PRODUCT-1', '8690000000004', 'SHIP01', 'Scanned', '$standaloneCartonId', NOW()), (gen_random_uuid(), '$orderId', 'E2E-SHIP-PRODUCT-2', '8690000000004', 'SHIP02', 'Scanned', '$palletCartonId', NOW());" | Out-Null

    $shipment = Invoke-RestMethod -Uri "$BaseUrl/api/shipments" -Method Post -Headers $headers
    $shipmentId = $shipment.id

    $standaloneScanBody = @{ code = $standaloneSscc } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId/scan" -Method Post -Body $standaloneScanBody -ContentType "application/json" -Headers $headers | Out-Null

    $duplicateRejected = $false
    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId/scan" -Method Post -Body $standaloneScanBody -ContentType "application/json" -Headers $headers | Out-Null
    } catch {
        $duplicateRejected = $true
    }
    if (-not $duplicateRejected) {
        throw "Duplicate shipment scan was not rejected."
    }

    $shipmentDetail = Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId" -Headers $headers
    $standaloneItem = @($shipmentDetail.items | Where-Object { $_.itemType -eq "Carton" })[0]
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId/items/$($standaloneItem.id)" -Method Delete -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId/scan" -Method Post -Body $standaloneScanBody -ContentType "application/json" -Headers $headers | Out-Null

    $palletScanBody = @{ code = $palletSscc } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId/scan" -Method Post -Body $palletScanBody -ContentType "application/json" -Headers $headers | Out-Null

    $shipmentDetail = Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId" -Headers $headers
    if ($shipmentDetail.shipment.palletCount -ne 1 -or $shipmentDetail.shipment.cartonCount -ne 2 -or $shipmentDetail.shipment.productCount -ne 2) {
        throw "Shipment totals are incorrect."
    }

    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId/complete" -Method Post -Headers $headers | Out-Null
    $shipmentState = Invoke-TestSql "SELECT s.Status || '|' || c1.Status || '|' || c2.Status || '|' || p.Status FROM Shipments s, Cartons c1, Cartons c2, Pallets p WHERE s.Id = '$shipmentId' AND c1.Id = '$standaloneCartonId' AND c2.Id = '$palletCartonId' AND p.Id = '$palletId';"
    if ($shipmentState -ne "Shipped|Shipped|Shipped|Shipped") {
        throw "Shipment completion did not update container states atomically: $shipmentState"
    }

    $productStates = Invoke-TestSql "SELECT string_agg(DISTINCT Status, ',') FROM ProductCodes WHERE CartonId IN ('$standaloneCartonId', '$palletCartonId');"
    if ($productStates -ne "Scanned") {
        throw "Shipment changed production product-code states: $productStates"
    }

    $secondShipment = Invoke-RestMethod -Uri "$BaseUrl/api/shipments" -Method Post -Headers $headers
    $shippedItemRejected = $false
    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$($secondShipment.id)/scan" -Method Post -Body $standaloneScanBody -ContentType "application/json" -Headers $headers | Out-Null
    } catch {
        $shippedItemRejected = $true
    }
    if (-not $shippedItemRejected) {
        throw "Previously shipped carton was accepted into another shipment."
    }

    $draftDeleteRejected = $false
    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$($secondShipment.id)" -Method Delete -Headers $headers | Out-Null
    } catch {
        $draftDeleteRejected = $true
    }
    if (-not $draftDeleteRejected) {
        throw "Draft shipment was deleted without cancellation."
    }
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$($secondShipment.id)/cancel" -Method Post -Headers $headers | Out-Null

    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId/cancel" -Method Post -Headers $headers | Out-Null
    $reversedState = Invoke-TestSql "SELECT s.Status || '|' || c1.Status || '|' || c2.Status || '|' || p.Status || '|' || (c1.ShippedAt IS NULL) || '|' || (p.ShippedAt IS NULL) FROM Shipments s, Cartons c1, Cartons c2, Pallets p WHERE s.Id = '$shipmentId' AND c1.Id = '$standaloneCartonId' AND c2.Id = '$palletCartonId' AND p.Id = '$palletId';"
    if ($reversedState -ne "Cancelled|Closed|Palletized|Closed|true|true") {
        throw "Admin shipment reversal did not restore container states: $reversedState"
    }

    $retryShipment = Invoke-RestMethod -Uri "$BaseUrl/api/shipments" -Method Post -Headers $headers
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$($retryShipment.id)/scan" -Method Post -Body $standaloneScanBody -ContentType "application/json" -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$($retryShipment.id)/scan" -Method Post -Body $palletScanBody -ContentType "application/json" -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$($retryShipment.id)/cancel" -Method Post -Headers $headers | Out-Null

    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$shipmentId" -Method Delete -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$($secondShipment.id)" -Method Delete -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$BaseUrl/api/shipments/$($retryShipment.id)" -Method Delete -Headers $headers | Out-Null
    $remainingShipments = Invoke-TestSql "SELECT COUNT(*) FROM Shipments;"
    if ($remainingShipments -ne "0") {
        throw "Cancelled shipment records were not deleted: $remainingShipments remain."
    }

    Write-Host "PASS: isolated shipment create, scan, duplicate protection, remove/re-scan, pallet cascade, completion, admin reversal, reuse, cancellation and admin deletion flows."
}
finally {
    Pop-Location
}
