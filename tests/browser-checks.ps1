param([int]$Width = 1280)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artifacts = Join-Path $PSScriptRoot 'browser-artifacts'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$enc = New-Object Text.UTF8Encoding($false)
$html = [IO.File]::ReadAllText((Join-Path $projectRoot 'templates/index.html'))
$html = [regex]::Replace($html, '<link rel="stylesheet" href="([^"?]+)[^""]*"[^>]*>', {param($match) '<style>' + [IO.File]::ReadAllText((Join-Path $projectRoot $match.Groups[1].Value.TrimStart('/'))) + '</style>'})
$html = $html.Replace('</head>', '<style>* { transition: none !important; animation: none !important; scroll-behavior: auto !important; }</style></head>')
$mock = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'browser-mocks.js'))
$html = [regex]::Replace($html, '<script src="([^"]+)"[^>]*></script>', {
  param($match)
  $src = $match.Groups[1].Value
  if ($src.Contains('@supabase/')) { return '<script>' + $mock + '</script>' }
  if ($src.StartsWith('https://')) { return '' }
  $local = $src.Split('?')[0].TrimStart('/')
  return '<script>' + [IO.File]::ReadAllText((Join-Path $projectRoot $local)) + '</script>'
})
$checks = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'browser-checks.js'))
$html = $html.Replace('</body>', '<script>' + $checks + '</script></body>')
$content = Join-Path $artifacts ('content-' + $Width + '.html')
[IO.File]::WriteAllText($content, $html, $enc)
$target = Join-Path $artifacts ('review-' + $Width + '.html')
$wrapper = '<!doctype html><html><body style="margin:0"><iframe id="app" style="border:0;display:block;width:' + $Width + 'px;height:1000px" src="content-' + $Width + '.html"></iframe><pre id="browser-check-results" hidden></pre><script>addEventListener("message",e=>{if(e.source===document.getElementById("app").contentWindow&&e.data.pawidBrowserReport)document.getElementById("browser-check-results").textContent=e.data.pawidBrowserReport;});</script></body></html>'
[IO.File]::WriteAllText($target, $wrapper, $enc)
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profile = Join-Path $artifacts ('profile-' + $Width + '-' + [guid]::NewGuid().ToString('N'))
$stdout = Join-Path $artifacts ('dom-' + $Width + '.txt')
$stderr = Join-Path $artifacts ('chrome-' + $Width + '.log')
$screenshot = Join-Path $artifacts ('review-' + $Width + '.png')
$url = ([Uri]$target).AbsoluteUri
$arguments = @('--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--allow-file-access-from-files', '--virtual-time-budget=5000', ('--window-size=' + $Width + ',1000'), ('--user-data-dir="' + $profile + '"'), '--dump-dom', ('--screenshot="' + $screenshot + '"'), $url)
$process = Start-Process -FilePath $chrome -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$dump = [IO.File]::ReadAllText($stdout)
$match = [regex]::Match($dump, '<pre id="browser-check-results"[^>]*>(.*?)</pre>')
if (!$match.Success) { throw ('Chrome no devolvió resultado. Revisar ' + $stderr) }
$result = [Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
Write-Output $result
if (!($result | ConvertFrom-Json).ok) { exit 1 }
