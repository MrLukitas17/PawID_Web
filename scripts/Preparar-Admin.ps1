# Solo genera la versión local de pawid-admin para el editor de Supabase. NO despliega.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourceRoot = Join-Path $root 'supabase/functions/pawid-admin'
$target = Join-Path $root 'supabase/dashboard'
$handler = [IO.File]::ReadAllText((Join-Path $sourceRoot 'handler.js'))
$entry = [IO.File]::ReadAllText((Join-Path $sourceRoot 'index.ts'))
$handler = $handler.Replace('export function createAdminHandler', 'function createAdminHandler')
$entry = $entry.Replace("import { createAdminHandler } from './handler.js';", $handler)
$source = '// @ts-nocheck' + [Environment]::NewLine + '// Generado por scripts/Preparar-Admin.ps1. NO desplegado.' + [Environment]::NewLine + $entry
New-Item -ItemType Directory -Force -Path $target | Out-Null
[IO.File]::WriteAllText((Join-Path $target 'pawid-admin.ts'), $source, (New-Object Text.UTF8Encoding($false)))
Write-Output 'pawid-admin preparada localmente en supabase/dashboard/pawid-admin.ts. No se desplego ninguna funcion.'
