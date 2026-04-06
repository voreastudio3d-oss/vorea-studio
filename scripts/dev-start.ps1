# dev-start.ps1 — Levanta frontend (Vite) + backend (API) de Vorea Studio
# Uso: .\scripts\dev-start.ps1
# Para matar todo: .\scripts\dev-start.ps1 -Kill

param(
    [switch]$Kill
)

$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

if ($Kill) {
    Write-Host "`n[VOREA] Matando procesos node..." -ForegroundColor Yellow
    Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    Write-Host "[VOREA] Todos los procesos node detenidos." -ForegroundColor Green
    exit 0
}

# Liberar puertos 3001 y 5173
Write-Host "`n[VOREA] Liberando puertos 3001 y 5173..." -ForegroundColor Yellow
$ports = @(3001, 5173)
foreach ($p in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}
Start-Sleep -Seconds 1

Write-Host "[VOREA] Levantando backend API (puerto 3001)..." -ForegroundColor Cyan
$apiJob = Start-Job -ScriptBlock {
    Set-Location $using:ProjectRoot
    & node ./node_modules/tsx/dist/cli.mjs --env-file=.env --watch server/server.ts 2>&1
}

Write-Host "[VOREA] Levantando frontend Vite (puerto 5173)..." -ForegroundColor Cyan
$viteJob = Start-Job -ScriptBlock {
    Set-Location $using:ProjectRoot
    & node ./node_modules/vite/bin/vite.js --host 2>&1
}

Start-Sleep -Seconds 3

Write-Host "`n[VOREA] ========================================" -ForegroundColor Green
Write-Host "[VOREA]   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "[VOREA]   Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "[VOREA]   Admin:    http://localhost:5173/admin" -ForegroundColor White
Write-Host "[VOREA] ========================================" -ForegroundColor Green
Write-Host "[VOREA] Presiona Ctrl+C para detener ambos servers" -ForegroundColor DarkGray
Write-Host ""

try {
    while ($true) {
        # Print any output from API
        $apiOutput = Receive-Job -Job $apiJob -ErrorAction SilentlyContinue
        if ($apiOutput) {
            foreach ($line in $apiOutput) {
                Write-Host "[API] $line" -ForegroundColor DarkCyan
            }
        }

        # Print any output from Vite
        $viteOutput = Receive-Job -Job $viteJob -ErrorAction SilentlyContinue
        if ($viteOutput) {
            foreach ($line in $viteOutput) {
                Write-Host "[VITE] $line" -ForegroundColor DarkGreen
            }
        }

        # Check if jobs died
        if ($apiJob.State -eq "Failed") {
            Write-Host "[VOREA] API crashed. Re-check server/server.ts" -ForegroundColor Red
        }
        if ($viteJob.State -eq "Failed") {
            Write-Host "[VOREA] Vite crashed." -ForegroundColor Red
        }

        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "`n[VOREA] Deteniendo servers..." -ForegroundColor Yellow
    Stop-Job -Job $apiJob -ErrorAction SilentlyContinue
    Stop-Job -Job $viteJob -ErrorAction SilentlyContinue
    Remove-Job -Job $apiJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $viteJob -Force -ErrorAction SilentlyContinue
    foreach ($p in $ports) {
        try {
            $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
            if ($conns) {
                foreach ($c in $conns) {
                    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        } catch {}
    }
    Write-Host "[VOREA] Todo detenido." -ForegroundColor Green
}
