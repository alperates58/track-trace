$ErrorActionPreference = "Stop"

$AgentDir = "c:\Users\alper.ates.LIDER\Desktop\track-trace\agent"
$PublishDir = "$AgentDir\installer\publish"
$InstallerDir = "$AgentDir\installer"
$FrontendDownloadsDir = "c:\Users\alper.ates.LIDER\Desktop\track-trace\frontend\public\downloads"

Write-Host "1. TrackTrace.LocalAgent publish ediliyor (Single File & Self-Contained)..."
dotnet publish "$AgentDir\TrackTrace.LocalAgent\TrackTrace.LocalAgent.csproj" -c Release -r win-x64 --self-contained -o $PublishDir

Write-Host "2. Inno Setup Compiler ile exe uretiliyor..."
$InnoPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (Test-Path $InnoPath) {
    & $InnoPath "$InstallerDir\setup.iss"
    
    Write-Host "3. Frontend downloads klasörüne kopyalanıyor..."
    if (-not (Test-Path $FrontendDownloadsDir)) {
        New-Item -ItemType Directory -Force -Path $FrontendDownloadsDir
    }
    
    # Inno Setup default olarak Output klasorune cikarir
    Copy-Item "$InstallerDir\Output\TrackTraceLocalAgentSetup.exe" -Destination "$FrontendDownloadsDir\TrackTraceLocalAgentSetup.exe" -Force
    
    Write-Host "Build tamamlandı! EXE dosyası şurada: $FrontendDownloadsDir\TrackTraceLocalAgentSetup.exe"
} else {
    Write-Host "Uyari: Inno Setup bulunamadi. Lutfen manuel iscc calistirin veya Inno Setup yukleyin."
}
