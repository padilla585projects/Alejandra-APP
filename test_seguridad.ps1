# test_seguridad.ps1 — Validación end-to-end de seguridad de departamentos y chat privado
# Requisitos: usuarios de prueba ya creados en D1
# Uso: .\test_seguridad.ps1

param(
    [string]$ApiBase = "https://alejandra-app-api.alejandra-app.workers.dev",
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$script:testsPassed = 0
$script:testsFailed = 0

function Write-Test {
    param([string]$Message, [string]$Status)
    $color = if ($Status -eq "PASS") { "Green" } elseif ($Status -eq "FAIL") { "Red" } else { "Yellow" }
    Write-Host "[$Status] $Message" -ForegroundColor $color
    if ($Status -eq "PASS") { $script:testsPassed++ } else { $script:testsFailed++ }
}

function Invoke-ApiCall {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [object]$Body,
        [string]$Token
    )

    $url = "$ApiBase$Endpoint"
    $headers = @{
        "Content-Type" = "application/json"
    }

    if ($Token) {
        $headers["X-Token"] = $Token
    }

    $params = @{
        Uri     = $url
        Method  = $Method
        Headers = $headers
    }

    if ($Body) {
        $params["Body"] = $Body | ConvertTo-Json
    }

    try {
        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        $errorResponse = $_.Exception.Response
        if ($errorResponse) {
            $stream = $errorResponse.GetResponseStream()
            $reader = [System.IO.StreamReader]::new($stream)
            $body = $reader.ReadToEnd()
            $reader.Dispose()

            return @{
                error     = $true
                statusCode = [int]$errorResponse.StatusCode
                message   = $body
            }
        }
        throw
    }
}

# ============================================================================
# TEST 1: Login Alberto (encargado + oficina, eléctrico)
# ============================================================================
Write-Host "`n=== TEST 1: Login Alberto (encargado + oficina) ===" -ForegroundColor Cyan
$respAlberto = Invoke-ApiCall -Method POST -Endpoint "/verificar" `
    -Body @{
        email    = "alberto@test.local"
        password = "Manolete2026"
    }

if ($respAlberto.token) {
    $tokenAlberto = $respAlberto.token
    Write-Test "Alberto login exitoso" "PASS"
    if ($Verbose) { Write-Host "  Token: $($tokenAlberto.Substring(0, 20))..." -ForegroundColor Gray }
}
else {
    Write-Test "Alberto login fallido: $($respAlberto.message)" "FAIL"
    exit 1
}

# ============================================================================
# TEST 2: Alberto solo ve datos de eléctrico
# ============================================================================
Write-Host "`n=== TEST 2: Alberto filtra datos por departamento (solo eléctrico) ===" -ForegroundColor Cyan
$respBobinas = Invoke-ApiCall -Method GET -Endpoint "/bobinas" -Token $tokenAlberto

if ($respBobinas.error -and $respBobinas.statusCode -eq 401) {
    Write-Test "Token inválido en /bobinas (inesperado)" "FAIL"
    exit 1
}

if ($respBobinas -is [array]) {
    $otrosDepts = $respBobinas | Where-Object { $_.departamento -and $_.departamento -ne "electrico" } | Measure-Object
    if ($otrosDepts.Count -gt 0) {
        Write-Test "Alberto ve bobinas de otros departamentos (FALLO DE SEGURIDAD)" "FAIL"
        if ($Verbose) {
            $respBobinas | Where-Object { $_.departamento -and $_.departamento -ne "electrico" } | ForEach-Object {
                Write-Host "  - Bobina: $_[nombre] (dept: $_.departamento)" -ForegroundColor Red
            }
        }
    }
    else {
        Write-Test "Alberto solo ve datos de eléctrico" "PASS"
    }
}
else {
    Write-Test "Respuesta inesperada en /bobinas" "FAIL"
}

# ============================================================================
# TEST 3: Login María (oficina, eléctrico)
# ============================================================================
Write-Host "`n=== TEST 3: Login María (oficina) ===" -ForegroundColor Cyan
$respMaria = Invoke-ApiCall -Method POST -Endpoint "/verificar" `
    -Body @{
        email    = "maria@test.local"
        password = "Maria2026"
    }

if ($respMaria.token) {
    $tokenMaria = $respMaria.token
    Write-Test "María login exitoso" "PASS"
    if ($Verbose) { Write-Host "  Token: $($tokenMaria.Substring(0, 20))..." -ForegroundColor Gray }
}
else {
    Write-Test "María login fallido: $($respMaria.message)" "FAIL"
    exit 1
}

# ============================================================================
# TEST 4: María solo ve datos de eléctrico (diferente usuario mismo depto)
# ============================================================================
Write-Host "`n=== TEST 4: María filtra datos por departamento ===" -ForegroundColor Cyan
$respPersonal = Invoke-ApiCall -Method GET -Endpoint "/personal" -Token $tokenMaria

if ($respPersonal.error -and $respPersonal.statusCode -eq 401) {
    Write-Test "Token inválido en /personal (inesperado)" "FAIL"
    exit 1
}

if ($respPersonal -is [array]) {
    $otrosDepts = $respPersonal | Where-Object { $_.departamento -and $_.departamento -ne "electrico" } | Measure-Object
    if ($otrosDepts.Count -gt 0) {
        Write-Test "María ve datos de otros departamentos (FALLO DE SEGURIDAD)" "FAIL"
    }
    else {
        Write-Test "María solo ve datos de eléctrico" "PASS"
    }
}
else {
    Write-Test "Respuesta inesperada en /personal" "FAIL"
}

# ============================================================================
# TEST 5: Login Carlos (oficina, seguridad)
# ============================================================================
Write-Host "`n=== TEST 5: Login Carlos (oficina, seguridad) ===" -ForegroundColor Cyan
$respCarlos = Invoke-ApiCall -Method POST -Endpoint "/verificar" `
    -Body @{
        email    = "carlos@test.local"
        password = "Carlos2026"
    }

if ($respCarlos.token) {
    $tokenCarlos = $respCarlos.token
    Write-Test "Carlos login exitoso" "PASS"
    if ($Verbose) { Write-Host "  Token: $($tokenCarlos.Substring(0, 20))..." -ForegroundColor Gray }
}
else {
    Write-Test "Carlos login fallido: $($respCarlos.message)" "FAIL"
    exit 1
}

# ============================================================================
# TEST 6: Carlos solo ve datos de seguridad (diferente depto a María)
# ============================================================================
Write-Host "`n=== TEST 6: Carlos ve solo seguridad (diferente depto a María) ===" -ForegroundColor Cyan
$respCarlosBobinas = Invoke-ApiCall -Method GET -Endpoint "/bobinas" -Token $tokenCarlos

if ($respCarlosBobinas.error -and $respCarlosBobinas.statusCode -eq 401) {
    Write-Test "Token inválido en /bobinas para Carlos" "FAIL"
    exit 1
}

if ($respCarlosBobinas -is [array]) {
    $otrosDepts = $respCarlosBobinas | Where-Object { $_.departamento -and $_.departamento -ne "seguridad" } | Measure-Object
    if ($otrosDepts.Count -gt 0) {
        Write-Test "Carlos ve bobinas de otros departamentos (FALLO DE SEGURIDAD)" "FAIL"
    }
    else {
        Write-Test "Carlos solo ve datos de seguridad" "PASS"
    }
}

# ============================================================================
# TEST 7: Token inválido devuelve 401
# ============================================================================
Write-Host "`n=== TEST 7: Token inválido devuelve 401 ===" -ForegroundColor Cyan
$respInvalid = Invoke-ApiCall -Method GET -Endpoint "/bobinas" -Token "token_invalido_12345"

if ($respInvalid.error -and $respInvalid.statusCode -eq 401) {
    Write-Test "Token inválido rechazado con 401" "PASS"
}
else {
    Write-Test "Token inválido no rechazado correctamente (statusCode: $($respInvalid.statusCode // 'unknown'))" "FAIL"
}

# ============================================================================
# TEST 8: Chat privado - validar que no hay fugas de historial
# ============================================================================
Write-Host "`n=== TEST 8: Chat privado (validar aislamiento de usuario) ===" -ForegroundColor Cyan

# Obtener historial de Alberto
$respHistAlberto = Invoke-ApiCall -Method GET -Endpoint "/ia-chat-history?usuario_id=46" -Token $tokenAlberto
if (-not $respHistAlberto.error) {
    Write-Test "Alberto puede acceder a su historial de chat" "PASS"
}

# Intentar que Alberto vea el historial de María (TEST DE SEGURIDAD)
$respHistMaria = Invoke-ApiCall -Method GET -Endpoint "/ia-chat-history?usuario_id=47" -Token $tokenAlberto
if ($respHistMaria.ok -eq $true) {
    # Si devuelve ok pero está vacio, está bien
    if (($respHistMaria.mensajes | Measure-Object).Count -eq 0) {
        Write-Test "Alberto no puede acceder al historial de María (vacío o denegado)" "PASS"
    }
    else {
        Write-Test "Alberto VE el historial de María (FALLO DE SEGURIDAD / PRIVACY LEAK)" "FAIL"
    }
}
else {
    # Si devuelve error, también está bien (la forma más correcta)
    Write-Test "Alberto intenta acceder a historial de otra persona y es rechazado" "PASS"
}

# ============================================================================
# RESUMEN
# ============================================================================
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ RESUMEN DE TESTS                                               ║" -ForegroundColor Cyan
Write-Host "║─────────────────────────────────────────────────────────────────║" -ForegroundColor Cyan
Write-Host ("║ PASADOS:  {0,2}  ✓" -f $script:testsPassed).PadRight(64) + "║" -ForegroundColor Green
Write-Host ("║ FALLIDOS: {0,2}  ✗" -f $script:testsFailed).PadRight(64) + "║" -ForegroundColor $(if ($script:testsFailed -eq 0) { "Green" } else { "Red" })
Write-Host "║─────────────────────────────────────────────────────────────────║" -ForegroundColor Cyan

if ($script:testsFailed -eq 0) {
    Write-Host "║ ✅ SEGURIDAD DE DEPARTAMENTOS OK                              ║" -ForegroundColor Green
    Write-Host "║ ✅ CHAT PRIVADO OK                                            ║" -ForegroundColor Green
    Write-Host "║ ✅ LISTO PARA DESPLEGAR                                       ║" -ForegroundColor Green
}
else {
    Write-Host "║ ❌ FALLOS DETECTADOS — NO DESPLEGAR TODAVÍA                    ║" -ForegroundColor Red
}

Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

exit $script:testsFailed
