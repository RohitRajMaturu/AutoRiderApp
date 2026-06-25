param(
  [switch]$Offline,
  [int]$Port = 8081
)

$ErrorActionPreference = "Stop"
$mobileRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $mobileRoot ".metro-temp"

New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
$env:TEMP = $cacheRoot
$env:TMP = $cacheRoot

$expoArgs = @("expo", "start", "--clear", "--port", "$Port")
if ($Offline) {
  $expoArgs += "--offline"
}

Write-Host "Starting Expo with isolated Metro cache: $cacheRoot"
& npx.cmd @expoArgs
exit $LASTEXITCODE
