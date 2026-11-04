# Kleiner Webserver für den Trainingsplaner – nur auf diesem PC erreichbar (localhost).
# Start: Doppelklick auf "Trainingsplaner starten.bat". Beenden: Fenster schließen.
# Port 8081: Unter dieser Adresse (localhost:8081) liegen deine Daten im Browser – nicht ändern.
param([int]$Port = 8081, [switch]$NoBrowser)

# Die App liegt im selben Ordner wie diese Datei (index.html daneben).
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"; ".webmanifest" = "application/manifest+json"
  ".svg" = "image/svg+xml"; ".png" = "image/png"; ".ico" = "image/x-icon"
}

$listener = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
  try {
    $l = New-Object Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    $l.Start(); $listener = $l; $Port = $p; break
  } catch { }
}
if (-not $listener) { Write-Host "Kein freier Port gefunden."; Read-Host "Enter zum Beenden"; exit 1 }

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  Trainingsplaner läuft:  $url"
Write-Host "  Dieses Fenster offen lassen, solange du die App am PC nutzt."
Write-Host "  Zum Beenden das Fenster schließen."
Write-Host ""
if (-not $NoBrowser) { Start-Process $url }

$rootFull = [IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
  $async = $listener.BeginGetContext($null, $null)
  while (-not $async.AsyncWaitHandle.WaitOne(500)) { }
  try { $ctx = $listener.EndGetContext($async) } catch { break }
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
    if ($rel -eq "") { $rel = "index.html" }
    $file = [IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    # Nur Dateien aus dem App-Ordner ausliefern, keine versteckten Ordner
    if (-not $file.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase) -or $rel -match '(^|/)\.' -or -not (Test-Path $file -PathType Leaf)) {
      $res.StatusCode = 404; $bytes = [Text.Encoding]::UTF8.GetBytes("Nicht gefunden")
    } else {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" })
      $res.Headers["Cache-Control"] = "no-cache"
      $bytes = [IO.File]::ReadAllBytes($file)
    }
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch { } finally { $res.Close() }
}
