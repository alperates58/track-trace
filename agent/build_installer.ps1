$ErrorActionPreference = "Stop"

$AgentDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent $AgentDir
$InstallerDir = Join-Path $AgentDir "installer"
$PublishDir = Join-Path $InstallerDir "publish"
$ProjectPath = Join-Path $AgentDir "TrackTrace.LocalAgent\TrackTrace.LocalAgent.csproj"
$ExpectedAgentExe = Join-Path $PublishDir "TrackTrace.LocalAgent.exe"
$ExtensionlessAgentExe = Join-Path $PublishDir "TrackTrace.LocalAgent"
$InstallerOutput = Join-Path (Join-Path $InstallerDir "Output") "TrackTraceLocalAgentSetup.exe"
$FrontendDownloadsDir = Join-Path $RepoRoot "frontend\public\downloads"
$FrontendInstallerOutput = Join-Path $FrontendDownloadsDir "TrackTraceLocalAgentSetup.exe"

Write-Host "1. Publishing TrackTrace.LocalAgent (Self-Contained)..."
$ResolvedPublishDir = [System.IO.Path]::GetFullPath($PublishDir)
$ExpectedPublishDir = [System.IO.Path]::GetFullPath((Join-Path $InstallerDir "publish"))
if ($ResolvedPublishDir -ne $ExpectedPublishDir) {
    throw "Refusing to clean unexpected publish directory: $ResolvedPublishDir"
}

if (Test-Path $PublishDir) {
    Remove-Item -LiteralPath $PublishDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $PublishDir | Out-Null

$Dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if ($null -ne $Dotnet) {
    dotnet publish $ProjectPath -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -p:UseAppHost=true -p:TargetName=TrackTrace.LocalAgent -o $PublishDir
}
else {
    $Docker = Get-Command docker -ErrorAction SilentlyContinue
    if ($null -eq $Docker) {
        throw "Neither dotnet nor Docker is available to publish the Local Agent."
    }

    Write-Host "dotnet was not found; publishing with the .NET SDK Docker image..."
    docker run --rm -v "${RepoRoot}:/src" -w /src/agent/TrackTrace.LocalAgent mcr.microsoft.com/dotnet/sdk:8.0 `
        dotnet publish TrackTrace.LocalAgent.csproj -c Release -r win-x64 --self-contained true `
        -p:PublishSingleFile=false -p:UseAppHost=true -p:TargetName=TrackTrace.LocalAgent `
        -o /src/agent/installer/publish
}
if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $ExpectedAgentExe)) {
    if (Test-Path $ExtensionlessAgentExe) {
        Move-Item -LiteralPath $ExtensionlessAgentExe -Destination $ExpectedAgentExe -Force
    }
}

if (-not (Test-Path $ExpectedAgentExe)) {
    throw "Publish validation failed: $ExpectedAgentExe was not created."
}

Write-Host "2. Building installer with Inno Setup Compiler..."
$InnoPaths = @(
    "C:\Program Files\Inno Setup 7\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 7\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 7\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Users\alper.ates.LIDER\AppData\Local\Programs\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
)
$InnoPath = $null
foreach ($path in $InnoPaths) {
    if (Test-Path $path) {
        $InnoPath = $path
        break
    }
}
if ($null -eq $InnoPath) {
    throw "Inno Setup was not found in any standard locations."
}

& $InnoPath "$InstallerDir\setup.iss"
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup compiler failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $InstallerOutput)) {
    throw "Installer validation failed: $InstallerOutput was not created."
}

Write-Host "3. Copying installer to frontend downloads..."
if (-not (Test-Path $FrontendDownloadsDir)) {
    New-Item -ItemType Directory -Force -Path $FrontendDownloadsDir | Out-Null
}

Copy-Item $InstallerOutput -Destination $FrontendInstallerOutput -Force

Write-Host "Build completed. Installer: $FrontendInstallerOutput"
