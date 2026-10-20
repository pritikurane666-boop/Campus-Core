# CampusCore ERP - Migrate Local PostgreSQL Database to Supabase Cloud
param(
    [string]$SupabaseDbPassword
)

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   CAMPUSCORE ERP - POSTGRESQL TO SUPABASE CLOUD MIGRATION      " -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$SupabaseHost = "db.iodxtlpdpxhzqegxzeyd.supabase.co"
$SupabasePort = "5432"
$SupabaseDb   = "postgres"
$SupabaseUser = "postgres"

# Prompt for password if not passed as parameter
if ([string]::IsNullOrWhiteSpace($SupabaseDbPassword)) {
    Write-Host "Please enter the database password you set when creating the Supabase project." -ForegroundColor Gray
    $SupabaseDbPassword = Read-Host -Prompt "Supabase Database Password"
}

if ([string]::IsNullOrWhiteSpace($SupabaseDbPassword)) {
    Write-Host "[ERROR] Password cannot be blank." -ForegroundColor Red
    exit 1
}

$pgDumpExe = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Recurse -Filter "pg_dump.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$psqlExe   = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

if (-not $pgDumpExe -or -not $psqlExe) {
    Write-Host "[ERROR] PostgreSQL client tools (pg_dump/psql) not found in C:\Program Files\PostgreSQL." -ForegroundColor Red
    exit 1
}

$dumpFile = Join-Path $PSScriptRoot "campuscore_backup.sql"

# 1. Export local database
Write-Host "[1/3] Exporting local database (institution_erp)..." -ForegroundColor White
$env:PGPASSWORD = "root"
& $pgDumpExe -U postgres -d institution_erp -F p --no-owner --no-privileges -f $dumpFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Local database export failed." -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Local database dumped to: $dumpFile" -ForegroundColor Green

# 2. Test Connection and Import into Supabase
Write-Host ""
Write-Host "[2/3] Connecting and importing into Supabase Cloud ($SupabaseHost)..." -ForegroundColor White
$env:PGPASSWORD = $SupabaseDbPassword

# First do a fast connectivity test
$testOutput = & $psqlExe -h $SupabaseHost -p $SupabasePort -U $SupabaseUser -d $SupabaseDb -c "SELECT current_database();" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Could not connect to Supabase database. Please check your password." -ForegroundColor Red
    Write-Host "Error details: $testOutput" -ForegroundColor DarkRed
    Write-Host ""
    Write-Host "Hint: You can reset your database password in the Supabase Dashboard under:" -ForegroundColor Yellow
    Write-Host "  Project Settings -> Database -> Database Password" -ForegroundColor Yellow
    exit 1
}

Write-Host "  [OK] Connection to Supabase PostgreSQL verified!" -ForegroundColor Green
Write-Host "  -> Applying schema and data..." -ForegroundColor Gray

& $psqlExe -h $SupabaseHost -p $SupabasePort -U $SupabaseUser -d $SupabaseDb -f $dumpFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Note: Some schema elements may have already existed. Verify tables in Supabase Table Editor." -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Schema and data imported successfully!" -ForegroundColor Green
}

# 3. Update configuration only on verified connection
Write-Host ""
Write-Host "[3/3] Updating appsettings.Development.json connection string..." -ForegroundColor White
$appsettingsDev = Join-Path $PSScriptRoot "institution-erp\backend\src\InstitutionErp.Api\appsettings.Development.json"
if (Test-Path $appsettingsDev) {
    $json = Get-Content $appsettingsDev -Raw | ConvertFrom-Json
    $connStr = "Host=$SupabaseHost;Port=$SupabasePort;Database=$SupabaseDb;Username=$SupabaseUser;Password=$SupabaseDbPassword;SSL Mode=Require;Trust Server Certificate=true;"
    $json.ConnectionStrings.DefaultConnection = $connStr
    $json | ConvertTo-Json -Depth 10 | Set-Content $appsettingsDev
    Write-Host "  [OK] DefaultConnection in appsettings.Development.json is now connected to Supabase Cloud!" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "              MIGRATION TO SUPABASE COMPLETE!                   " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
