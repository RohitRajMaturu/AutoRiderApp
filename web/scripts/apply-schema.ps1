param(
  [string]$DatabaseUrl,
  [string]$MigrationFile = "db/migrations/001_init_autoconnect.sql"
)

$ErrorActionPreference = "Stop"

$WebRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvPath = Join-Path $WebRoot ".env"
$SqlPath = Join-Path $WebRoot $MigrationFile

if (-not $DatabaseUrl) {
  if (-not (Test-Path $EnvPath)) {
    throw "DATABASE_URL was not provided and web/.env was not found."
  }

  $DatabaseUrl = Get-Content $EnvPath |
    Where-Object { $_ -match "^DATABASE_URL=" } |
    Select-Object -First 1

  $DatabaseUrl = $DatabaseUrl -replace "^DATABASE_URL=", ""
}

if (-not $DatabaseUrl) {
  throw "DATABASE_URL is missing. Pass -DatabaseUrl or set it in web/.env."
}

if (-not (Test-Path $SqlPath)) {
  throw "Migration file was not found: $SqlPath"
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql was not found. Install PostgreSQL client tools, then run this script again."
}

Write-Host "Applying schema from $SqlPath"
psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $SqlPath
Write-Host "Schema applied successfully."
