param(
  [string]$RepoUrl = 'https://github.com/bonsai/ext-install-ext',
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Assert-File($Path) {
  if (-not (Test-Path (Join-Path $RepoRoot $Path))) {
    throw "Missing required file: $Path"
  }
  Write-Host "PASS file: $Path"
}

Write-Host '== ext-install-ext / UiPath CLI smoke check =='

$uip = Get-Command uip -ErrorAction SilentlyContinue
if (-not $uip) {
  throw 'uip CLI was not found. Install UiPath CLI and retry.'
}

Write-Host "uip: $($uip.Source)"
& $uip.Source --version
if ($LASTEXITCODE -ne 0) { throw "uip --version failed ($LASTEXITCODE)" }

Assert-File 'manifest.json'
Assert-File 'popup.html'
Assert-File 'popup.js'
Assert-File 'service-worker.js'
Assert-File 'content.js'

$manifest = Get-Content (Join-Path $RepoRoot 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.manifest_version -ne 3) { throw 'Expected Manifest V3.' }
if ($manifest.background.service_worker -ne 'service-worker.js') { throw 'Service worker is not registered.' }
if (-not ($manifest.permissions -contains 'tabs')) { throw 'tabs permission is missing.' }

Write-Host 'PASS manifest: MV3 / tabs / service-worker'

$popup = Get-Content (Join-Path $RepoRoot 'popup.js') -Raw
$worker = Get-Content (Join-Path $RepoRoot 'service-worker.js') -Raw

if ($popup -notmatch "type: 'browser_action'") { throw 'popup.js does not dispatch browser_action.' }
if ($popup -notmatch "open_url") { throw 'popup.js does not dispatch open_url.' }
if ($worker -notmatch "open_url") { throw 'service-worker.js does not implement open_url.' }
if ($worker -notmatch "navigate") { throw 'service-worker.js does not implement navigate.' }
if ($worker -notmatch "focus_tab") { throw 'service-worker.js does not implement focus_tab.' }

Write-Host 'PASS browser action contract: open_url / navigate / focus_tab'

if ($OpenBrowser) {
  Write-Host "Opening target: $RepoUrl"
  Start-Process $RepoUrl
}

Write-Host ''
Write-Host 'SMOKE PASS'
Write-Host 'UiPath CLI availability + extension contract verified.'
Write-Host 'Note: actual popup/click/tab behavior still requires a browser E2E run.'
