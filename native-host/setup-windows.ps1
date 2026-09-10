$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$HostName = 'com.bonsai.ext_install'
$ExtensionId = '06647b6f49cbcc96de88f26ab75221b3'
$Exe = Join-Path $PSScriptRoot 'ext-install-native-host.exe'
$Manifest = Join-Path $PSScriptRoot "$HostName.json"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
  throw 'Go is required to build the native messaging host. Install Go, then run this script again.'
}

Push-Location $PSScriptRoot
try {
  go build -o $Exe .
} finally {
  Pop-Location
}

$manifestObject = [ordered]@{
  name = $HostName
  description = 'Bonsai Ext Install native messaging host'
  path = $Exe
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifestObject | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $Manifest

$registrations = @(
  'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\' + $HostName,
  'HKCU:\Software\Google\Chrome\NativeMessagingHosts\' + $HostName
)
foreach ($key in $registrations) {
  New-Item -Path $key -Force | Out-Null
  Set-ItemProperty -Path $key -Name '(default)' -Value $Manifest
  Write-Host "registered: $key -> $Manifest"
}

Write-Host "Native host ready: $HostName"
Write-Host "Extension ID: $ExtensionId"
