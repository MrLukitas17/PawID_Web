param([int]$Width = 1280, [ValidateSet('dashboard','adopciones','hogares','articulos')][string]$Preview = 'dashboard')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artifacts = Join-Path $PSScriptRoot 'browser-artifacts'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$enc = New-Object Text.UTF8Encoding($false)
$html = [IO.File]::ReadAllText((Join-Path $projectRoot 'templates/admin.html'))
$html = $html.Replace('<body class="admin-page">', ('<body class="admin-page" data-preview="' + $Preview + '">'))
$html = [regex]::Replace($html, '<link rel="stylesheet" href="([^"?]+)[^"]*"[^>]*>', {param($match) '<style>' + [IO.File]::ReadAllText((Join-Path $projectRoot $match.Groups[1].Value.TrimStart('/'))) + '</style>'})
$html = $html.Replace('</head>', '<style>*{transition:none!important;animation:none!important;scroll-behavior:auto!important}</style></head>')
$mock = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'admin-browser-mocks.js'))
$photo = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $projectRoot 'img/pluto.png')))
$mock = $mock.Replace('__ADMIN_TEST_PHOTO__', $photo)
# Se quita defer al insertar los scripts inline para conservar su orden real.
$scripts = New-Object System.Collections.Generic.List[string]
$html = [regex]::Replace($html, '<script defer src="([^"]+)"[^>]*></script>', {
  param($match)
  $src = $match.Groups[1].Value
  if ($src.Contains('@supabase/')) { $scripts.Add('<script>' + $mock + '</script>'); return '' }
  if ($src.StartsWith('https://')) { throw 'Dependencia remota inesperada en QA local.' }
  $local = $src.Split('?')[0].TrimStart('/')
  $scripts.Add('<script>' + [IO.File]::ReadAllText((Join-Path $projectRoot $local)) + '</script>')
  return ''
})
$checks = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'admin-browser-checks.js'))
$html = $html.Replace('</body>', (($scripts -join [Environment]::NewLine) + '<script>' + $checks + '</script></body>'))
$suffix = 'admin-' + $Width + '-' + $Preview
$content = Join-Path $artifacts ($suffix + '-content.html')
[IO.File]::WriteAllText($content, $html, $enc)
$target = Join-Path $artifacts ($suffix + '.html')
$wrapper = '<!doctype html><html><body style="margin:0"><iframe id="app" style="border:0;display:block;width:' + $Width + 'px;height:1000px" src="' + $suffix + '-content.html?acceso=administrador#login"></iframe><pre id="admin-browser-results" hidden></pre><script>addEventListener("message",e=>{if(e.source===document.getElementById("app").contentWindow&&e.data.adminBrowserReport)document.getElementById("admin-browser-results").textContent=e.data.adminBrowserReport;});</script></body></html>'
[IO.File]::WriteAllText($target, $wrapper, $enc)
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profile = Join-Path $artifacts ($suffix + '-profile-' + [guid]::NewGuid().ToString('N'))
$stdout = Join-Path $artifacts ($suffix + '-dom.txt')
$stderr = Join-Path $artifacts ($suffix + '-chrome.log')
$screenshot = Join-Path $artifacts ($suffix + '.png')
$url = ([Uri]$target).AbsoluteUri
$arguments = @('--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--allow-file-access-from-files', '--virtual-time-budget=15000', ('--window-size=' + $Width + ',1000'), ('--user-data-dir="' + $profile + '"'), '--dump-dom', ('--screenshot="' + $screenshot + '"'), $url)
$process = Start-Process -FilePath $chrome -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$dump = [IO.File]::ReadAllText($stdout)
$match = [regex]::Match($dump, '<pre id="admin-browser-results"[^>]*>(.*?)</pre>')
if (!$match.Success) { throw ('Chrome no devolvio resultado. Revisar ' + $stderr) }
$result = [Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
Write-Output $result
if (!($result | ConvertFrom-Json).ok) { exit 1 }
