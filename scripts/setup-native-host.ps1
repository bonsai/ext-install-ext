$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Setup = Join-Path $Root 'native-host\setup-windows.ps1'

if (-not (Test-Path $Setup -PathType Leaf)) {
  throw "Native host setup script not found: $Setup"
}

Write-Host 'Bonsai Ext Install - Native Host Setup'
Write-Host '--------------------------------------'
& $Setup
if ($LASTEXITCODE -ne 0) {
  throw "Native host setup failed ($LASTEXITCODE)"
}

Write-Host ''
Write-Host 'Setup complete. Restart Chrome/Edge before testing the extension.'
