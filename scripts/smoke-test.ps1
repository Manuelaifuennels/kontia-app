# Kontia — smoke test de endpoints críticos contra un despliegue real.
# Uso:
#   .\scripts\smoke-test.ps1 -BaseUrl "https://tu-app.easypanel.host" -Email "admin@empresa.com" -Password "xxxx"
# No modifica datos: solo lecturas y comprobaciones de que los guards responden lo esperado.

param(
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password
)

$BaseUrl = $BaseUrl.TrimEnd('/')
$results = @()

function Test-Endpoint {
  param([string]$Name, [scriptblock]$Check)
  try {
    $ok = & $Check
    $script:results += [pscustomobject]@{ Test = $Name; Resultado = $(if ($ok) { "PASS" } else { "FAIL" }) }
  } catch {
    $script:results += [pscustomobject]@{ Test = $Name; Resultado = "FAIL ($($_.Exception.Message))" }
  }
}

function Invoke-Api {
  param([string]$Method, [string]$Path, [hashtable]$Body, [string]$Token)
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; Headers = $headers; TimeoutSec = 30 }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json) }
  Invoke-RestMethod @params
}

function Get-StatusCode {
  param([string]$Method, [string]$Path, [hashtable]$Body, [string]$Token)
  try {
    Invoke-Api -Method $Method -Path $Path -Body $Body -Token $Token | Out-Null
    return 200
  } catch {
    $resp = $_.Exception.Response
    if ($resp) { return [int]$resp.StatusCode }
    throw
  }
}

Write-Host "Kontia smoke test contra $BaseUrl" -ForegroundColor Cyan

# 1. Salud del servidor y la base de datos
Test-Endpoint "GET /api/status responde ok" {
  (Invoke-Api GET "/api/status").status -eq "ok"
}

# 2. Login
$token = $null
Test-Endpoint "POST /api/auth/login devuelve token" {
  $r = Invoke-Api POST "/api/auth/login" @{ email = $Email; password = $Password }
  $script:token = $r.token
  [bool]$r.token
}

if (-not $token) {
  Write-Host "Sin token: se omiten las pruebas autenticadas." -ForegroundColor Yellow
} else {
  # 3. Lecturas críticas
  Test-Endpoint "GET facturas devuelve lista" {
    $null -ne (Invoke-Api GET "/api/data/facturas?limit=1" -Token $token).list
  }
  Test-Endpoint "GET ejercicios devuelve lista" {
    $null -ne (Invoke-Api GET "/api/data/ejercicios" -Token $token).list
  }
  Test-Endpoint "GET apuntes (via JOIN asientos) devuelve lista" {
    $null -ne (Invoke-Api GET "/api/data/apuntes?limit=1" -Token $token).list
  }
  Test-Endpoint "GET usuarios devuelve lista sin passwords" {
    $r = (Invoke-Api GET "/api/data/usuarios" -Token $token).list
    ($null -ne $r) -and (-not ($r | Where-Object { $_.PSObject.Properties.Name -contains "password" }))
  }
  # Estas dos dependen de las migraciones 007 y 008: si fallan, no se aplicaron
  Test-Endpoint "Migracion 007 (tabla conectores) aplicada" {
    $null -ne (Invoke-Api GET "/api/data/conectores" -Token $token).list
  }
  Test-Endpoint "Migracion 008 (VeriFactu) aplicada" {
    $r = Invoke-Api GET "/api/verifactu/estado" -Token $token
    $null -ne $r.totalRegistros
  }
  Test-Endpoint "GET auth/me devuelve empresas" {
    $null -ne (Invoke-Api GET "/api/auth/me" -Token $token).user
  }

  # 4. Guards de seguridad — deben RECHAZAR
  Test-Endpoint "POST asientos (readonly) devuelve 403" {
    (Get-StatusCode POST "/api/data/asientos" @{ concepto = "x" } $token) -eq 403
  }
  Test-Endpoint "PATCH usuarios (blocked) devuelve 403" {
    (Get-StatusCode PATCH "/api/data/usuarios" @{ Id = 1; email = "x@x.com" } $token) -eq 403
  }
  Test-Endpoint "Tabla desconocida devuelve 400" {
    (Get-StatusCode GET "/api/data/tabla_inexistente" $null $token) -eq 400
  }
  Test-Endpoint "Webhook no permitido devuelve 400" {
    (Get-StatusCode POST "/api/webhook/endpoint-malo" @{} $token) -eq 400
  }
}

# 5. Sin token — debe rechazar
Test-Endpoint "GET facturas sin token devuelve 401" {
  (Get-StatusCode GET "/api/data/facturas") -eq 401
}

Write-Host ""
$results | Format-Table -AutoSize
$fails = @($results | Where-Object { $_.Resultado -notlike "PASS*" })
if ($fails.Count -gt 0) {
  Write-Host "$($fails.Count) prueba(s) FALLIDA(s)" -ForegroundColor Red
  exit 1
}
Write-Host "Todas las pruebas PASS ($($results.Count))" -ForegroundColor Green
exit 0
