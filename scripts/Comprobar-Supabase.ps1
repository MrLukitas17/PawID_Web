# SOLO LECTURA: consultas GET con cero filas. No intenta login ni cambia datos.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$config = [IO.File]::ReadAllText((Join-Path $root 'js/config.js'))
$base = [regex]::Match($config, "supabaseUrl:\s*'([^']+)'").Groups[1].Value
$key = [regex]::Match($config, "publishableKey:\s*'([^']+)'").Groups[1].Value
if (!$base -or !$key) { throw 'Revisar js/config.js: no se encontró la URL o la clave pública.' }
Write-Output ('Proyecto consultado: ' + ([Uri]$base).Host + '. Tipo de entorno: confirmar en el panel; no se deduce de la URL.')
$checks = @(
  @{Name='Función pawid-api'; Path='/functions/v1/pawid-api'},
  @{Name='Función password-recovery'; Path='/functions/v1/password-recovery'}
)
foreach ($column in @('id','fotos','peso_kg','vacunas','descripcion')) {
  $checks += @{Name=('Columna mascotas.'+$column); Path=('/rest/v1/mascotas?select='+$column+'&limit=0')}
}
foreach ($table in @('publicacion_adopcion','publicaciones_hogares__temporales')) {
  $checks += @{Name=('Tabla '+$table); Path=('/rest/v1/'+$table+'?select=id&limit=0')}
}
foreach ($check in $checks) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Method Get -Uri ($base+$check.Path) -Headers @{apikey=$key} -TimeoutSec 15
    $status = [int]$r.StatusCode
    $info = if (($check.Name.StartsWith('Columna') -or $check.Name.StartsWith('Tabla'))) {'Accesible; no se solicitaron filas.'} else {'La función responde; revisar health para comprobar dependencias.'}
    if ($check.Name -eq 'Función pawid-api') {
      try { $body = $r.Content | ConvertFrom-Json; if ($body.service -eq 'pawid-api') { $info = ('Health ready=' + $body.ready) } } catch {}
    }
  } catch {
    $response = $_.Exception.Response
    $status = if ($response) {[int]$response.StatusCode} else {0}
    $info = switch ($status) {
      404 {'No se encontró el recurso; verificar despliegue en el panel.'}
      400 {'La consulta no fue aceptada; verificar columna en el diagnóstico SQL.'}
      401 {'Acceso no autorizado; no demuestra que falte la tabla o función.'}
      403 {'Acceso denegado; revisar permisos sin abrir acceso anónimo.'}
      503 {'La función no está lista o no puede iniciar; revisar configuración y health.'}
      default {'Revisar red, configuración y logs del proyecto.'}
    }
  }
  [pscustomobject]@{Comprobacion=$check.Name; HTTP=$status; Resultado=$info} | ConvertTo-Json -Compress
}
