param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Repository,
  [ValidateSet('edge','chrome','auto')]
  [string]$Browser = 'auto',
  [string]$Url = ''
)

$script = Join-Path $PSScriptRoot 'ext-install.ps1'
& $script -Repository $Repository -Browser $Browser -Url $Url
exit $LASTEXITCODE
