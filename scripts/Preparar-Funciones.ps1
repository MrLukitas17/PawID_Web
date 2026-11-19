# Solo genera archivos locales para pegarlos en el editor de Supabase. No despliega.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$target = Join-Path $root 'supabase/dashboard'
New-Item -ItemType Directory -Force -Path $target | Out-Null
$enc = New-Object Text.UTF8Encoding($false)
$handler = [IO.File]::ReadAllText((Join-Path $root 'supabase/functions/pawid-api/handler.js'))
$entry = [IO.File]::ReadAllText((Join-Path $root 'supabase/functions/pawid-api/index.ts'))
$entry = [regex]::Replace($entry, '(?m)^import \{ createHandler \} from ''\./handler\.js'';\r?\n?', '')
$handler = $handler.Replace('export function createHandler', 'function createHandler')
$source = '// @ts-nocheck' + [Environment]::NewLine + '// Generado por scripts/Preparar-Funciones.ps1. No editar este archivo directamente.' + [Environment]::NewLine + $entry.Replace('const admin =', $handler + [Environment]::NewLine + 'const admin =')
[IO.File]::WriteAllText((Join-Path $target 'pawid-api.ts'), $source, $enc)
$recovery = [IO.File]::ReadAllText((Join-Path $root 'supabase/functions/password-recovery/index.ts'))
[IO.File]::WriteAllText((Join-Path $target 'password-recovery.ts'), $recovery, $enc)
Write-Output 'Archivos locales preparados en supabase/dashboard. No se desplego ninguna funcion.'
