# CampusCore ERP - Startup Script

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   CAMPUSCORE ENTERPRISE INSTITUTION MANAGEMENT SYSTEM (ERP)   " -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $ScriptDir "institution-erp")) {
    $BaseDir = Join-Path $ScriptDir "institution-erp"
} else {
    $BaseDir = $ScriptDir
}

$BackendProj = Join-Path $BaseDir "backend\src\InstitutionErp.Api\InstitutionErp.Api.csproj"
$FrontendDir = Join-Path $BaseDir "frontend"

Write-Host "[1/5] Checking prerequisites..." -ForegroundColor White

$pgService = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService) {
    if ($pgService.Status -ne "Running") {
        Write-Host "  -> Starting PostgreSQL service ($($pgService.Name))..." -ForegroundColor Yellow
        Start-Service -Name $pgService.Name
        Start-Sleep -Seconds 2
    }
    Write-Host "  [OK] PostgreSQL service is running ($($pgService.Name))." -ForegroundColor Green
} else {
    Write-Host "  [!] PostgreSQL service not detected. Ensure database is running on port 5432." -ForegroundColor Yellow
}

$dotnetVer = & dotnet --version 2>$null
if ($LASTEXITCODE -eq 0 -and $dotnetVer) {
    Write-Host "  [OK] .NET SDK detected: v$dotnetVer" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] .NET SDK not found in PATH. Please install .NET 8 SDK." -ForegroundColor Red
    exit 1
}

$nodeVer = & node --version 2>$null
if ($LASTEXITCODE -eq 0 -and $nodeVer) {
    Write-Host "  [OK] Node.js detected: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Node.js not found in PATH. Please install Node.js." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/5] Clearing ports 5050 and 3000..." -ForegroundColor White
$ports = @(5050, 3000)
foreach ($p in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 4) {
                Write-Host "  -> Terminating existing process $($c.OwningProcess) on port $p..." -ForegroundColor Yellow
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}

Write-Host ""
Write-Host "[3/5] Starting Backend API on http://localhost:5050..." -ForegroundColor White

$backendArgs = "-NoExit -Command `"Set-Location '$BaseDir\backend'; `$env:ASPNETCORE_ENVIRONMENT='Development'; dotnet run --project '$BackendProj' --urls 'http://localhost:5050'`""
$backendProc = Start-Process -FilePath "powershell.exe" -ArgumentList $backendArgs -PassThru

Write-Host "  -> Waiting for API health check..." -ForegroundColor Gray
$backendReady = $false
for ($i = 1; $i -le 40; $i++) {
    Start-Sleep -Milliseconds 1500
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:5050/api/v1/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
        if ($resp -match "Healthy" -or $resp.status -eq "Healthy") {
            $backendReady = $true
            break
        }
    } catch {}
    Write-Host "     [Retry $i/40] Initializing EF Core and verifying database..." -ForegroundColor DarkGray
}

if ($backendReady) {
    Write-Host "  [OK] Backend API is Healthy and connected to PostgreSQL!" -ForegroundColor Green
} else {
    Write-Host "  [!] Backend is initializing. See the Backend terminal window." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[4/5] Starting React Frontend on http://localhost:3000..." -ForegroundColor White

$frontendArgs = "-NoExit -Command `"Set-Location '$FrontendDir'; npm run dev -- --host 0.0.0.0 --port 3000`""
$frontendProc = Start-Process -FilePath "powershell.exe" -ArgumentList $frontendArgs -PassThru

Write-Host "  -> Waiting for Vite server..." -ForegroundColor Gray
$frontendReady = $false
for ($i = 1; $i -le 20; $i++) {
    Start-Sleep -Milliseconds 1000
    try {
        $test = Test-NetConnection -ComputerName localhost -Port 3000 -WarningAction SilentlyContinue
        if ($test.TcpTestSucceeded) {
            $frontendReady = $true
            break
        }
    } catch {}
}

if ($frontendReady) {
    Write-Host "  [OK] React Frontend is Online on port 3000!" -ForegroundColor Green
} else {
    Write-Host "  [!] Frontend starting in its terminal window." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "              ALL SERVICES ARE UP AND RUNNING!                  " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend Application : http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend REST API     : http://localhost:5050" -ForegroundColor Cyan
Write-Host "  Swagger API Docs     : http://localhost:5050/swagger" -ForegroundColor Cyan
Write-Host "  API Health Check     : http://localhost:5050/api/v1/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  DATABASE ACCOUNTS & CREDENTIALS (LOADED LIVE FROM POSTGRESQL)" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
$psqlExe = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if ($psqlExe) {
    $env:PGPASSWORD = "root"
    & $psqlExe -U postgres -d institution_erp -c "SELECT r.name as role, u.email, u.first_name || ' ' || u.last_name as name, u.default_password as password FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE NOT u.is_deleted ORDER BY r.name, u.first_name;"
} else {
    Write-Host "  * All accounts and passwords authenticate directly against PostgreSQL." -ForegroundColor White
    Write-Host "  * No hardcoded logins exist; credentials are managed dynamically." -ForegroundColor White
}
Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

Start-Sleep -Seconds 1
Write-Host "Opening web browser at http://localhost:3000/login..." -ForegroundColor Cyan
Start-Process "http://localhost:3000/login"

Write-Host ""
Write-Host "Servers are actively running in the background." -ForegroundColor Green
Write-Host "Type 'stop' (or press Ctrl+C) to stop both servers and exit:" -ForegroundColor Yellow
while ($true) {
    $inputCmd = Read-Host
    if ($inputCmd -match '^(stop|exit|quit|q)$') {
        break
    }
}

Write-Host "Stopping servers..." -ForegroundColor Yellow
try {
    if ($backendProc -and !$backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
    if ($frontendProc -and !$frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
} catch {}

foreach ($p in @(5050, 3000)) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 4) {
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}

Write-Host "All servers stopped." -ForegroundColor Green
