$baseUrl = "http://127.0.0.1:8080"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$loginBody = @{ username = "admin"; password = "admin123" } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginRes.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "Fetching a station..."
$stations = Invoke-RestMethod -Uri "$baseUrl/api/stations" -Headers $headers
$stationId = $stations[0].id

Write-Host "Creating a new order (TESTORD06)..."
$createOrderBody = @{
    orderNo = "TESTORD06"
    customerName = "Test Customer"
    stockCode = "TESTSTK04"
    productName = "Test Product"
    gtin = "8690000000004"
    productPerCarton = 12
    expectedQuantity = 120
    plannedDate = [DateTime]::UtcNow.ToString("O")
} | ConvertTo-Json
$createRes = Invoke-RestMethod -Uri "$baseUrl/api/orders" -Method Post -Body $createOrderBody -ContentType "application/json" -Headers $headers
$orderId = $createRes.id

Write-Host "Activating order..."
docker exec track_trace_db psql -U postgres -d track_trace -c "UPDATE Orders SET Status = 'Active' WHERE Id = '$orderId';"

$preprintBody = @{
    orderId = $orderId
    quantity = 10
    format = "zpl"
    batchId = [guid]::NewGuid().ToString()
} | ConvertTo-Json

Invoke-RestMethod -Uri "$baseUrl/api/cartons/preprint" -Method Post -Body $preprintBody -ContentType "application/json" -Headers $headers > $null
Write-Host "PASS: Successfully called PrePrint API."

$cartonNo = "TESTORD06-1"
Write-Host "Using Carton No: $cartonNo"

# Open the carton by scanning its barcode
$scanCartonBody = @{
    code = $cartonNo
    stationId = $stationId
} | ConvertTo-Json

try {
    $scan1 = Invoke-RestMethod -Uri "$baseUrl/api/scan/preprinted/open-carton" -Method Post -Body $scanCartonBody -ContentType "application/json" -Headers $headers
    Write-Host "PASS: Scanned Carton Barcode. Response: $($scan1.message) Status: $($scan1.status)"
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "FAIL: Failed to open carton:" $reader.ReadToEnd()
}

$serialNumber = -join ((48..57) + (65..90) | Get-Random -Count 10 | % {[char]$_})
$productCode = "010" + "8690000000004" + "10" + $serialNumber

Write-Host "Inserting dummy ProductCode to DB..."
docker exec track_trace_db psql -U postgres -d track_trace -c "INSERT INTO ProductCodes (Id, OrderId, RawCode, Gtin, SerialNo, Status) VALUES (gen_random_uuid(), '$orderId', '$productCode', '8690000000004', '$serialNumber', 'Uploaded');"

$scanProductBody = @{
    orderId = $orderId
    rawCode = $productCode
    stationId = $stationId
    mode = "PrePrinted"
    activeCartonId = $scan1.cartonId
} | ConvertTo-Json

try {
    $scan2 = Invoke-RestMethod -Uri "$baseUrl/api/scan/product" -Method Post -Body $scanProductBody -ContentType "application/json" -Headers $headers
    Write-Host "PASS: Scanned Product Barcode. Response: $($scan2.message) Status: $($scan2.status) Qty: $($scan2.cartonCurrentQty)/$($scan2.cartonTargetQty)"
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "FAIL: Failed to scan product barcode:" $reader.ReadToEnd()
}

# Check old auto scan mode
Write-Host "Testing old mode (Auto Scan)..."
$serialNumber2 = -join ((48..57) + (65..90) | Get-Random -Count 10 | % {[char]$_})
$productCode2 = "010" + "8690000000004" + "10" + $serialNumber2
Write-Host "Inserting second dummy ProductCode to DB..."
docker exec track_trace_db psql -U postgres -d track_trace -c "INSERT INTO ProductCodes (Id, OrderId, RawCode, Gtin, SerialNo, Status) VALUES (gen_random_uuid(), '$orderId', '$productCode2', '8690000000004', '$serialNumber2', 'Uploaded');"

$autoScanProductBody = @{
    orderId = $orderId
    rawCode = $productCode2
    stationId = $stationId
    mode = "Scan"
    activeCartonId = $null
} | ConvertTo-Json

try {
    $scan3 = Invoke-RestMethod -Uri "$baseUrl/api/scan/product" -Method Post -Body $autoScanProductBody -ContentType "application/json" -Headers $headers
    Write-Host "PASS: Old Auto Scan Mode. Response: $($scan3.message) Status: $($scan3.status)"
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "FAIL: Failed to auto scan product barcode:" $reader.ReadToEnd()
}

Write-Host "TESTS COMPLETE"
