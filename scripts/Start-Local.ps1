$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskLocal = Join-Path $taskRoot '.local'
New-Item -ItemType Directory -Force -Path $taskLocal | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'backend/appsettings.Local.json'))) {
    throw 'Falta backend/appsettings.Local.json. Revisa las instrucciones de README.md.'
}
function Test-PortalUrl([string]$Url) {
    try { $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3; return $response.StatusCode -eq 200 } catch { return $false }
}
$taskProcesses = @()
if (-not (Test-PortalUrl 'http://127.0.0.1:5080/api/health')) {
    $taskOutput = Join-Path $taskLocal ('api-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    & dotnet publish (Join-Path $taskRoot 'backend/backend.csproj') -c Release -o $taskOutput -p:UseAppHost=false --nologo -v quiet
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la API.' }
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = 'http://127.0.0.1:5080'
    $taskApi = Start-Process -FilePath 'dotnet' -ArgumentList @('"' + (Join-Path $taskOutput 'backend.dll') + '"') -WorkingDirectory (Join-Path $taskRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLocal 'api.stdout.log') -RedirectStandardError (Join-Path $taskLocal 'api.stderr.log')
    $taskProcesses += @{ id = $taskApi.Id; component = 'API'; startedAt = $taskApi.StartTime.ToUniversalTime().ToString('o') }
}
if (-not (Test-PortalUrl 'http://127.0.0.1:3000')) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'frontend/node_modules'))) {
        Push-Location (Join-Path $taskRoot 'frontend')
        try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' } } finally { Pop-Location }
    }
    $taskNode = (Get-Command node).Source
    $taskNext = Join-Path $taskRoot 'frontend/node_modules/next/dist/bin/next'
    $taskWebArguments = '"' + $taskNext + '" dev --hostname 127.0.0.1 --port 3000'
    $taskWeb = Start-Process -FilePath $taskNode -ArgumentList $taskWebArguments -WorkingDirectory (Join-Path $taskRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLocal 'web.stdout.log') -RedirectStandardError (Join-Path $taskLocal 'web.stderr.log')
    $taskProcesses += @{ id = $taskWeb.Id; component = 'Web'; startedAt = $taskWeb.StartTime.ToUniversalTime().ToString('o') }
}
if ($taskProcesses.Count -gt 0) { $taskProcesses | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $taskLocal 'processes.json') -Encoding UTF8 }
$taskDeadline = (Get-Date).AddSeconds(55)
do {
    if ((Test-PortalUrl 'http://127.0.0.1:5080/api/health') -and (Test-PortalUrl 'http://127.0.0.1:3000')) {
        Write-Host 'Plataforma disponible: http://127.0.0.1:3000' -ForegroundColor Green
        Write-Host 'Administración: http://127.0.0.1:3000/admin'
        Write-Host 'Credenciales privadas: .local/ACCESO-ADMIN.txt'
        exit 0
    }
    Start-Sleep -Milliseconds 800
} while ((Get-Date) -lt $taskDeadline)
throw 'El inicio está tardando. Revisa los archivos .local/api.stderr.log y .local/web.stderr.log.'
