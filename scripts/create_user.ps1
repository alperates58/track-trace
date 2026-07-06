$baseUrl = "http://127.0.0.1:8080"

# Login as admin to get token
$loginBody = @{ username = "admin"; password = "admin123" } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginRes.token
$headers = @{ Authorization = "Bearer $token" }

# Create user
$userBody = @{
    name = "Alper Ates"
    username = "alperates"
    password = "3255890"
    role = "Admin"
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method Post -Body $userBody -ContentType "application/json" -Headers $headers
    Write-Host "Success: User created with ID $($res.id)"
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Error creating user:" $reader.ReadToEnd()
}
