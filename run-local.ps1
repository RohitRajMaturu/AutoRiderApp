param(
  [switch]$SkipInstall,
  [switch]$ClearExpoCache
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir = Join-Path $Root "web"
$MobileDir = Join-Path $Root "mobile"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-Command {
  param([string]$Command)
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    throw "'$Command' was not found. Install Node.js/npm first, then run this script again."
  }
}

function Ensure-Dependencies {
  param(
    [string]$Name,
    [string]$Directory
  )

  $NodeModules = Join-Path $Directory "node_modules"
  if ($SkipInstall) {
    Write-Host "Skipping $Name npm install because -SkipInstall was passed."
    return
  }

  if (Test-Path $NodeModules) {
    Write-Host "$Name dependencies already installed."
    return
  }

  Write-Step "Installing $Name dependencies"
  Push-Location $Directory
  try {
    npm install
  } finally {
    Pop-Location
  }
}

function Get-LanIpAddress {
  $Address = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Select-Object -First 1 -ExpandProperty IPAddress

  if (-not $Address) {
    return "127.0.0.1"
  }

  return $Address
}

function Wait-ForBackend {
  param([string]$Url)

  Write-Step "Waiting for backend at $Url"
  for ($i = 1; $i -le 30; $i++) {
    try {
      $Response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
      if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 500) {
        Write-Host "Backend is responding."
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  Write-Warning "Backend did not respond within 30 seconds. Expo will still start, but API calls may fail."
}

Ensure-Command "node"
Ensure-Command "npm.cmd"

Ensure-Dependencies -Name "web/backend" -Directory $WebDir
Ensure-Dependencies -Name "mobile" -Directory $MobileDir

$LanIp = Get-LanIpAddress
$BackendUrl = "http://${LanIp}:4000"
$BackendLocalUrl = "http://127.0.0.1:4000"

Write-Step "Starting web app and API"
$BackendCommand = "Set-Location '$WebDir'; npm.cmd run dev:lan"
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $BackendCommand

Wait-ForBackend -Url $BackendLocalUrl

Write-Step "Starting Expo Go"
Write-Host "Backend URL for your phone: $BackendUrl"
Write-Host "Web app local URL:           $BackendLocalUrl"
Write-Host "Admin login local URL:       $BackendLocalUrl/admin-login"
Write-Host "Web app LAN URL:             $BackendUrl"
Write-Host "Scan the Expo QR code with Expo Go."
Write-Host ""

$env:EXPO_PUBLIC_CREATE_ENV = "DEVELOPMENT"
$env:EXPO_PUBLIC_BASE_URL = $BackendUrl
$env:EXPO_PUBLIC_APP_URL = $BackendUrl
$env:EXPO_PUBLIC_PROXY_BASE_URL = $BackendUrl
$env:EXPO_PUBLIC_HOST = "${LanIp}:4000"

Push-Location $MobileDir
try {
  $ExpoArgs = @("expo", "start", "--go", "--lan")
  if ($ClearExpoCache) {
    $ExpoArgs += "--clear"
  }
  npx @ExpoArgs
} finally {
  Pop-Location
}
