#
# rebuild-sihatuna.ps1 -- does the actual work for REBUILD_SIHATUNA.bat.
# A PowerShell script (not more nested batch quoting) because this project's
# own folder path contains a space ("Eng.Huda Elmuthefer"), which is fragile
# to quote correctly across batch -> powershell -Command -> batch layers.
# PowerShell handles it natively via $PSScriptRoot.
#
# NOTE: kept to plain ASCII on purpose -- Windows PowerShell 5.1 does not
# reliably auto-detect UTF-8 without a BOM, and non-ASCII punctuation here
# previously corrupted into invalid syntax when re-read.
#
$ErrorActionPreference = 'Stop'
$ProjDir = $PSScriptRoot

function Write-Step($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

# --- Step 1: verify this really is the SIHATUNA IRAQ frontend, not Irtiqaa
#     or any other project, before touching anything. ---------------------
Write-Step "Verifying this is the SIHATUNA IRAQ frontend..."
$pkgPath = Join-Path $ProjDir 'package.json'
$indexHtmlPath = Join-Path $ProjDir 'public\index.html'
if (-not (Test-Path $pkgPath)) {
    Write-Fail "package.json not found beside this script ($ProjDir). Aborting."
    exit 1
}
if (-not (Test-Path $indexHtmlPath) -or -not (Select-String -Path $indexHtmlPath -Pattern 'SIHATUNA' -Quiet)) {
    Write-Fail "public\index.html does not contain the SIHATUNA marker. This does not look like the Sihatuna frontend. Aborting."
    exit 1
}
if (-not (Test-Path (Join-Path $ProjDir 'src\components\HealthBanner.js'))) {
    Write-Fail "src\components\HealthBanner.js not found. Aborting."
    exit 1
}
Write-Ok "Confirmed SIHATUNA IRAQ frontend at: $ProjDir"

# --- Step 2: find whatever currently owns port 3000 and stop ONLY that
#     exact PID -- never a blanket `taskkill /IM node.exe /F` (this machine
#     runs other Node processes, including Claude Code itself, and a
#     different project -- Ertiqaa/Irtiqaa -- has previously ended up bound
#     to this same port). -------------------------------------------------
Write-Step "Checking what currently owns port 3000..."
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    foreach ($c in $conn) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" -ErrorAction SilentlyContinue
        Write-Host "    PID $($c.OwningProcess): $($proc.CommandLine)"
        if ($proc.CommandLine -notmatch [regex]::Escape($ProjDir)) {
            Write-Host "    (this process's command line does not mention this Sihatuna folder -- inspect it yourself if unsure before this script stops it)" -ForegroundColor Yellow
        }
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Ok "Stopped PID $($c.OwningProcess) (that exact PID only)."
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "    Port 3000 is currently free."
}

# --- Step 3: clear CRA's own stale dev cache. NOT node_modules, NOT a full
#     reinstall -- just the incremental-build cache CRA/webpack keeps. ----
Write-Step "Clearing stale frontend build cache..."
$cacheDir = Join-Path $ProjDir 'node_modules\.cache'
if (Test-Path $cacheDir) {
    Remove-Item -Recurse -Force $cacheDir
    Write-Ok "Removed node_modules\.cache"
} else {
    Write-Host "    (no cache present -- nothing to clear)"
}

# --- Step 4: launch react-scripts start fully hidden -- no visible node.exe
#     console window, ever. Output goes to a log file instead. -----------
Write-Step "Starting the SIHATUNA dev server (react-scripts start), hidden..."
$env:BROWSER = 'none'
$reactScriptsJs = Join-Path $ProjDir 'node_modules\react-scripts\bin\react-scripts.js'
$logOut = Join-Path $ProjDir 'sihatuna-dev.log'
$logErr = Join-Path $ProjDir 'sihatuna-dev.err.log'

$psi = Start-Process -FilePath 'node' `
    -ArgumentList @("`"$reactScriptsJs`"", 'start') `
    -WorkingDirectory $ProjDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr `
    -PassThru

Write-Ok "Launched (PID $($psi.Id)). Log: $logOut"

# --- Step 5: wait for localhost:3000 to actually respond before declaring
#     success -- don't just assume it started. -----------------------------
Write-Step "Waiting for http://localhost:3000 to respond..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    Write-Fail "Timed out waiting for localhost:3000. Check $logOut and $logErr for compile errors."
    exit 1
}

# --- Step 6: confirm the PID that answers on 3000 now is actually this
#     project (not some other app that happened to grab the port first). --
$finalConn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$finalProc = Get-CimInstance Win32_Process -Filter "ProcessId=$($finalConn.OwningProcess)" -ErrorAction SilentlyContinue
Write-Host ""
Write-Ok "http://localhost:3000 is up and responding."
Write-Host "    Owning PID: $($finalConn.OwningProcess)"
Write-Host "    Command line: $($finalProc.CommandLine)"
if ($finalProc.CommandLine -match [regex]::Escape($ProjDir)) {
    Write-Ok "Confirmed: port 3000 is served from THIS Sihatuna folder."
} else {
    Write-Fail "WARNING: the process on port 3000 does NOT reference this Sihatuna folder. Something else may own the port."
}
