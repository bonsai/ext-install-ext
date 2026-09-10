$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$HostName = 'com.bonsai.ext_install'
$ExtensionId = '06647b6f49cbcc96de88f26ab75221b3'
$Project = Join-Path $PSScriptRoot 'ExtInstallNativeHost.csproj'
$Exe = Join-Path $PSScriptRoot 'ext-install-native-host.exe'
$Manifest = Join-Path $PSScriptRoot "$HostName.json"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  throw 'dotnet is required to build the native messaging host. Install the .NET 8 SDK, then run this script again.'
}

Push-Location $PSScriptRoot
try {
  dotnet publish $Project -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o (Join-Path $PSScriptRoot 'publish')
} finally {
  Pop-Location
}

$PublishedExe = Join-Path $PSScriptRoot 'publish\ext-install-native-host.exe'
if (-not (Test-Path $PublishedExe)) {
  throw "Native host build failed: $PublishedExe was not created."
}

Copy-Item -Force $PublishedExe $Exe

$manifestObject = [ordered]@{
  name = $HostName
  description = 'Bonsai Ext Install native messaging host'
  path = $Exe
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifestObject | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $Manifest

# Register each browser independently.
$registrations = @()
$registrations += "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
$registrations += "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"

foreach ($key in $registrations) {
  New-Item -Path $key -Force | Out-Null
  New-ItemProperty -Path $key -Name '(default)' -PropertyType String -Value $Manifest -Force | Out-Null
  Write-Host "registered: $key -> $Manifest"
}

Write-Host "Native host ready: $HostName"
Write-Host "Executable: $Exe"
Write-Host "Extension ID: $ExtensionId"
