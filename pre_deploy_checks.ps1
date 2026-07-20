# pre_deploy_checks.ps1 — Verificaciones antes de desplegar
# Verifica: encoding, versiones sincronizadas, syntax

param([switch]$SkipEncoding)

$ErrorActionPreference = "Stop"

Write-Host "`n╔═════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ PRE-DEPLOY CHECKS                                               ║" -ForegroundColor Cyan
Write-Host "╚═════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ============================================================================
# 1. VERIFICAR ENCODING
# ============================================================================
if (-not $SkipEncoding) {
    Write-Host "1️⃣  Verificando encoding..." -ForegroundColor Yellow

    $corruptedChars = @("Ã", "Â", "â€", "ï»¿")
    $filesToCheck = @("worker.js", "index.html", "panel.html", "sw.js")
    $foundCorruption = $false

    foreach ($file in $filesToCheck) {
        if (Test-Path $file) {
            $content = Get-Content $file -Raw
            foreach ($char in $corruptedChars) {
                if ($content -match [regex]::Escape($char)) {
                    Write-Host "  ❌ $file contiene carácter corrupto: $char" -ForegroundColor Red
                    $foundCorruption = $true
                }
            }
        }
    }

    if (-not $foundCorruption) {
        Write-Host "  ✅ Encoding limpio (sin caracteres corruptos)" -ForegroundColor Green
    }
    else {
        Write-Host "`n⚠️  DETENER: Hay corrupción de encoding. No desplegar." -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# 2. VERIFICAR SINCRONIZACIÓN DE VERSIONES
# ============================================================================
Write-Host "`n2️⃣  Verificando sincronización de versiones..." -ForegroundColor Yellow

$versionJson = (Get-Content version.json | ConvertFrom-Json).v
$versionSw = [regex]::Match((Get-Content sw.js -Raw), "alejandra-v([^']+)'").Groups[1].Value
$versionHtml = [regex]::Match((Get-Content index.html -Raw), "APP_VERSION = '([^']+)'").Groups[1].Value

Write-Host "  version.json: $versionJson" -ForegroundColor Gray
Write-Host "  sw.js:        $versionSw" -ForegroundColor Gray
Write-Host "  index.html:   $versionHtml" -ForegroundColor Gray

if ($versionJson -eq $versionSw -and $versionJson -eq $versionHtml) {
    Write-Host "  ✅ Versiones sincronizadas: $versionJson" -ForegroundColor Green
}
else {
    Write-Host "`n⚠️  DESINCRONIZADO: json=$versionJson sw=$versionSw html=$versionHtml" -ForegroundColor Red
    Write-Host "    Corregir ANTES de desplegar (causa bucles infinitos en producción)." -ForegroundColor Red
    exit 1
}

# ============================================================================
# 3. VERIFICAR SINTAXIS JAVASCRIPT
# ============================================================================
Write-Host "`n3️⃣  Verificando sintaxis JavaScript..." -ForegroundColor Yellow

$jsFiles = @("worker.js", "sw.js")
$syntaxOk = $true

foreach ($file in $jsFiles) {
    if (Test-Path $file) {
        try {
            $checkResult = & node -c $file 2>&1
            Write-Host "  ✅ $file: OK" -ForegroundColor Green
        }
        catch {
            Write-Host "  ❌ $file: Error de sintaxis" -ForegroundColor Red
            Write-Host "     $_" -ForegroundColor Red
            $syntaxOk = $false
        }
    }
}

if (-not $syntaxOk) {
    Write-Host "`n⚠️  DETENER: Hay errores de sintaxis." -ForegroundColor Red
    exit 1
}

# ============================================================================
# 4. VERIFICAR GIT STATUS
# ============================================================================
Write-Host "`n4️⃣  Verificando estado de git..." -ForegroundColor Yellow

$gitStatus = git status --porcelain 2>$null | Where-Object { $_ -notmatch '^\?\?' }
if ($gitStatus) {
    Write-Host "  ⚠️  Cambios sin commitear:" -ForegroundColor Yellow
    $gitStatus | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
}
else {
    Write-Host "  ✅ Working tree limpio" -ForegroundColor Green
}

# ============================================================================
# RESUMEN
# ============================================================================
Write-Host "`n╔═════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ ✅ TODAS LAS VERIFICACIONES PASARON                              ║" -ForegroundColor Cyan
Write-Host "║    Versión: $versionJson                                           ║" -ForegroundColor Green
Write-Host "║    Listo para: git commit + git push + wrangler deploy           ║" -ForegroundColor Green
Write-Host "╚═════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
