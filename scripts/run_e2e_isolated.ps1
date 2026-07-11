$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot "docker-compose.test.yml"

Push-Location $repoRoot
try {
    docker compose -f $composeFile up -d --build --wait api
    if ($LASTEXITCODE -ne 0) {
        throw "Isolated test environment could not be started."
    }

    & (Join-Path $PSScriptRoot "test_e2e.ps1") -BaseUrl "http://127.0.0.1:18081" -ComposeFile $composeFile
}
finally {
    docker compose -f $composeFile down --volumes --remove-orphans
    Pop-Location
}
