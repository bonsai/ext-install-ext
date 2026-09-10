param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Repository,
  [ValidateSet('edge','chrome','auto')]
  [string]$Browser = 'auto',
  [string]$Url = ''
)

$ErrorActionPreference = 'Stop'
$Version = '0.5.0'
Write-Host "Bonsai Ext Install v$Version"
Write-Host "--------------------------------"

function Normalize-Repository {
  param([Parameter(Mandatory=$true)][string]$Value)
  $v = $Value.Trim()
  if ($v -match '^https://github\.com/([^/]+)/([^/#?]+?)(?:\.git)?/?$') { return "$($Matches[1])/$($Matches[2])" }
  if ($v -match '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { return $v }
  throw "GitHub repository must be owner/repo or https://github.com/owner/repo: $Value"
}

function Get-DownloadsDirectory {
  $downloads = Join-Path $HOME 'Downloads'
  if (-not (Test-Path $downloads)) { New-Item -ItemType Directory -Force -Path $downloads | Out-Null }
  return $downloads
}

function Get-BrowserPath {
  param([Parameter(Mandatory=$true)][string]$Name)
  $candidates = @()
  if ($Name -in @('edge','auto')) {
    $candidates += @("$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe", "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe")
  }
  if ($Name -in @('chrome','auto')) {
    $candidates += @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
  }
  foreach ($path in $candidates) { if ($path -and (Test-Path $path -PathType Leaf)) { return $path } }
  if ($Name -eq 'edge') { $command = 'msedge' } elseif ($Name -eq 'chrome') { $command = 'chrome' } else { $command = $null }
  if ($command) { $found = Get-Command $command -ErrorAction SilentlyContinue; if ($found) { return $found.Source } }
  return $null
}

function Find-Manifest {
  param([Parameter(Mandatory=$true)][string]$Root)
  $rootManifest = Join-Path $Root 'manifest.json'
  if (Test-Path $rootManifest -PathType Leaf) { return $Root }
  $rootDepth = ($Root.TrimEnd('\').Split('\')).Count
  $found = Get-ChildItem -Path $Root -Filter 'manifest.json' -File -Recurse -ErrorAction SilentlyContinue | Where-Object { ($_.FullName.Split('\').Count) -le ($rootDepth + 4) } | Select-Object -First 1
  if ($found) { return $found.DirectoryName }
  throw "manifest.json not found under $Root"
}

function Test-ExtensionManifest {
  param([Parameter(Mandatory=$true)][string]$ManifestPath)
  try { $manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json } catch { throw "Invalid manifest.json: $ManifestPath" }
  if ($manifest.manifest_version -notin @(2,3)) { throw 'manifest_version must be 2 or 3' }
  if ([string]::IsNullOrWhiteSpace($manifest.name)) { throw 'manifest.json has no name' }
  return $manifest
}

$repo = Normalize-Repository $Repository
$parts = $repo.Split('/')
$owner = $parts[0]
$name = $parts[1]
$downloads = Get-DownloadsDirectory
$base = Join-Path $downloads 'ext-install'
$dir = Join-Path $base "$owner-$name"
New-Item -ItemType Directory -Force -Path $base | Out-Null

Write-Host ""
Write-Host "[1/3] source: $dir"
if (Test-Path (Join-Path $dir '.git')) {
  Write-Host '      updating repository...'
  git -C $dir pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw "git pull failed ($LASTEXITCODE)" }
} else {
  Write-Host '      cloning repository...'
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh repo clone $repo $dir
    if ($LASTEXITCODE -ne 0) { throw "gh repo clone failed ($LASTEXITCODE)" }
  } else {
    git clone "https://github.com/$repo.git" $dir
    if ($LASTEXITCODE -ne 0) { throw "git clone failed ($LASTEXITCODE)" }
  }
}

$extensionDir = Find-Manifest $dir
$manifestPath = Join-Path $extensionDir 'manifest.json'
$manifest = Test-ExtensionManifest $manifestPath
Write-Host ""
Write-Host "[2/3] manifest: $manifestPath"
Write-Host "      name:    $($manifest.name)"
Write-Host "      version: $($manifest.version)"
Write-Host "      manifest: v$($manifest.manifest_version)"

$browserPath = Get-BrowserPath $Browser
if (-not $browserPath) { throw "Browser not found: $Browser" }
$browserName = Split-Path $browserPath -Leaf
Write-Host ""
Write-Host "      browser: $browserName"
Write-Host ""
Write-Host "[3/3] launch: $browserPath"
$extensionArgument = "--load-extension=$extensionDir"
Write-Host "      $extensionArgument"
$args = @($extensionArgument)
if (-not [string]::IsNullOrWhiteSpace($Url)) { $args += '--new-window'; $args += $Url; Write-Host "      url: $Url" }
Start-Process -FilePath $browserPath -ArgumentList $args

Write-Host ""
Write-Host '========================================'
Write-Host 'Installed and launched'
Write-Host '========================================'
Write-Host "Repository : $repo"
Write-Host "Extension  : $($manifest.name)"
Write-Host "Version    : $($manifest.version)"
Write-Host "Browser    : $browserName"
Write-Host "Path       : $extensionDir"
Write-Host "Downloads  : $downloads"
Write-Host ""
