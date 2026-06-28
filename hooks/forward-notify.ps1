# Reenvia el evento de hook de Claude Code al Claude Notificator (app local).
# Ademas detecta la VENTANA de la terminal donde corre Claude (Windows Terminal,
# VS Code, PowerShell...) subiendo por el arbol de procesos padre, y manda su hwnd
# para que el click lleve exactamente a esa terminal.
#
# settings.json:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<ruta>\forward-notify.ps1" -Event Notification
param(
  [string]$Event = "Notification",
  [int]$Port = 4317
)

$ErrorActionPreference = 'SilentlyContinue'

# --- Detectar la ventana de la terminal hospedadora ---
# Subimos desde este proceso (hijo de Claude) hasta hallar una ventana visible.
function Get-HostWindow {
  $cur = $PID
  for ($i = 0; $i -lt 10 -and $cur; $i++) {
    $pr = Get-Process -Id $cur -ErrorAction SilentlyContinue
    if ($pr -and $pr.MainWindowHandle -ne 0 -and $pr.MainWindowTitle -ne '') {
      return [int64]$pr.MainWindowHandle
    }
    $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$cur" -ErrorAction SilentlyContinue).ParentProcessId
    if (-not $parent -or $parent -eq $cur) { break }
    $cur = $parent
  }
  return 0
}

$hwnd = Get-HostWindow

# --- Leer el JSON del hook (stdin) y añadir campos ---
$raw = [Console]::In.ReadToEnd()
$body = $null
try {
  $obj = $raw | ConvertFrom-Json
  if (-not $obj.hook_event_name) { $obj | Add-Member -NotePropertyName hook_event_name -NotePropertyValue $Event -Force }
  $obj | Add-Member -NotePropertyName hwnd -NotePropertyValue $hwnd -Force
  $body = $obj | ConvertTo-Json -Depth 8 -Compress
} catch {
  $body = (@{ hook_event_name = $Event; cwd = (Get-Location).Path; hwnd = $hwnd } | ConvertTo-Json -Compress)
}

try {
  Invoke-RestMethod -Uri "http://127.0.0.1:$Port/notify" `
    -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 2 | Out-Null
} catch {
  # App apagada: silencioso.
}
