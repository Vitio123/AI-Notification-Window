'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, dialog } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// ---------------------------------------------------------------------------
// Single instance lock: app vive en segundo plano, una sola copia.
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const ICON_PATH = path.join(__dirname, '..', 'assets', 'claude-color.ico');
const DEFAULT_PORT = 4317;

// Textos localizados de los avisos por defecto (el mensaje real lo manda Claude).
const MSG = {
  es: { attention: 'Claude necesita tu atencion.',     done: 'Claude termino. Revisa la terminal.',        test: 'Notificacion de prueba. Claude pide seleccionar una opcion.' },
  en: { attention: 'Claude needs your attention.',      done: 'Claude finished. Check the terminal.',        test: 'Test notification. Claude is asking you to choose an option.' },
  pt: { attention: 'Claude precisa da sua atencao.',    done: 'Claude terminou. Verifique o terminal.',      test: 'Notificacao de teste. Claude pede para selecionar uma opcao.' },
  fr: { attention: 'Claude a besoin de votre attention.', done: 'Claude a termine. Verifiez le terminal.',    test: 'Notification de test. Claude vous demande de choisir une option.' },
  de: { attention: 'Claude braucht deine Aufmerksamkeit.', done: 'Claude ist fertig. Pruefe das Terminal.',   test: 'Testbenachrichtigung. Claude bittet dich, eine Option zu waehlen.' }
};
function t(key) {
  const l = MSG[config.language] || MSG.es;
  return l[key] || MSG.es[key];
}

let tray = null;
let overlayWin = null;
let settingsWin = null;
let server = null;

// ---------------------------------------------------------------------------
// Config persistente (userData/config.json)
// ---------------------------------------------------------------------------
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const DEFAULT_CONFIG = {
  position: 'top-right', // top-left|top-center|top-right|bottom-left|bottom-center|bottom-right
  soundPath: '',          // ruta a wav/mp3, vacio = sin sonido propio
  soundEnabled: true,
  port: DEFAULT_PORT,
  autoHideMs: 9000,       // ocultar overlay tras N ms sin interaccion (0 = nunca)
  launchAtStartup: true,
  iconColor: '#ffffff',   // color del sunburst de Claude
  language: 'es',         // es|en|pt|fr|de
  animIn: 'pop',          // pop|fade|slide|zoom|drop
  animOut: 'pop'          // pop|fade|slide|zoom|drop
};

// Ruta del settings.json de Claude Code y del script de hook (para sincronizar puerto)
const CLAUDE_SETTINGS = path.join(require('os').homedir(), '.claude', 'settings.json');
const HOOK_SCRIPT = path.join(__dirname, '..', 'hooks', 'forward-notify.ps1');

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
  } catch (_) {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

function saveConfig(cfg) {
  config = Object.assign({}, config, cfg);
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('No se pudo guardar config:', e);
  }
  applyStartupSetting();
  syncHookPort();
  return config;
}

// Reescribe el puerto en los hooks de ~/.claude/settings.json para que el
// usuario nunca tenga que tocarlo a mano. Si el puerto != 4317 añade -Port.
function syncHookPort() {
  try {
    if (!fs.existsSync(CLAUDE_SETTINGS)) return;
    const raw = fs.readFileSync(CLAUDE_SETTINGS, 'utf8');
    const s = JSON.parse(raw);
    if (!s.hooks) return;
    let changed = false;
    const fix = (cmd) => {
      if (typeof cmd !== 'string' || !cmd.includes('forward-notify.ps1')) return cmd;
      // quitar cualquier -Port previo
      let c = cmd.replace(/\s+-Port\s+\d+/i, '');
      if (config.port && config.port !== DEFAULT_PORT) c = c + ' -Port ' + config.port;
      if (c !== cmd) changed = true;
      return c;
    };
    for (const ev of ['Notification', 'Stop']) {
      const arr = s.hooks[ev];
      if (!Array.isArray(arr)) continue;
      for (const block of arr) {
        for (const h of (block.hooks || [])) {
          if (h.type === 'command') h.command = fix(h.command);
        }
      }
    }
    if (changed) fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(s, null, 2), 'utf8');
  } catch (e) {
    console.error('No se pudo sincronizar el puerto del hook:', e.message);
  }
}

let config = loadConfig();

// ---------------------------------------------------------------------------
// Auto-arranque con Windows
// ---------------------------------------------------------------------------
function applyStartupSetting() {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!config.launchAtStartup,
      path: process.execPath,
      args: []
    });
  } catch (_) { /* dev mode puede fallar, ignorar */ }
}

// ---------------------------------------------------------------------------
// Geometria del overlay segun posicion elegida
// ---------------------------------------------------------------------------
const WIN_W = 420;
const WIN_H = 260;
const MARGIN = 12;

function computeBounds() {
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea; // respeta barra de tareas
  let x = wa.x + MARGIN;
  let y = wa.y + MARGIN;

  const pos = config.position || 'top-right';
  const [vert, horiz] = pos.split('-'); // [top|bottom, left|center|right]

  if (horiz === 'center') x = wa.x + Math.round((wa.width - WIN_W) / 2);
  else if (horiz === 'right') x = wa.x + wa.width - WIN_W - MARGIN;
  else x = wa.x + MARGIN;

  if (vert === 'bottom') y = wa.y + wa.height - WIN_H - MARGIN;
  else y = wa.y + MARGIN;

  return { x, y, width: WIN_W, height: WIN_H };
}

// ---------------------------------------------------------------------------
// Ventana overlay (frameless, transparente, siempre arriba, no roba foco)
// ---------------------------------------------------------------------------
function createOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin;

  const b = computeBounds();
  overlayWin = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.loadFile(path.join(__dirname, 'overlay.html'));

  overlayWin.on('closed', () => { overlayWin = null; });
  return overlayWin;
}

// Cola de notificaciones pendientes hasta que renderer este listo
let overlayReady = false;
const pending = [];

function showNotification(payload) {
  const win = createOverlay();
  const b = computeBounds();
  win.setBounds(b);

  const send = () => {
    win.showInactive(); // mostrar SIN robar foco al editor
    win.setAlwaysOnTop(true, 'screen-saver');
    win.webContents.send('notify', Object.assign({ anchor: config.position }, payload));
  };

  if (overlayReady) send();
  else pending.push(send);
}

// ---------------------------------------------------------------------------
// Servidor HTTP local: recibe POST del hook de Claude Code
// ---------------------------------------------------------------------------
function startServer() {
  server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/notify') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        let data = {};
        try { data = JSON.parse(body || '{}'); } catch (_) {}
        const payload = normalizePayload(data);
        showNotification(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200); res.end('pong'); return;
    }
    res.writeHead(404); res.end();
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error('Puerto ' + config.port + ' ocupado. App quiza ya corriendo.');
    } else {
      console.error('Error servidor:', e);
    }
  });

  server.listen(config.port, '127.0.0.1', () => {
    console.log('Claude Notificator escuchando en 127.0.0.1:' + config.port);
  });
}

// Convierte el JSON del hook de Claude Code en el payload del overlay.
// Claude pasa por stdin: { session_id, cwd, hook_event_name, message, ... }
function normalizePayload(data) {
  const cwd = data.cwd || data.workspace || '';
  const project = cwd ? path.basename(cwd) : 'terminal';
  let message = data.message || data.title || '';
  const event = data.hook_event_name || data.event || '';

  if (!message) {
    message = (event === 'Stop') ? t('done') : t('attention');
  }

  return {
    project,
    message: String(message).trim(),
    cwd,
    event,
    hwnd: data.hwnd ? String(data.hwnd) : '',   // ventana exacta de la terminal con Claude
    sound: config.soundEnabled ? config.soundPath : '',
    autoHideMs: config.autoHideMs,
    iconColor: config.iconColor,
    animIn: config.animIn,
    animOut: config.animOut
  };
}

// ---------------------------------------------------------------------------
// Enfocar VS Code en la carpeta del cwd (Win32 SetForegroundWindow)
// ---------------------------------------------------------------------------
// Trae al frente la terminal donde corre Claude.
// 1) Si el hook mando el hwnd exacto, se enfoca esa ventana (Windows Terminal,
//    VS Code, PowerShell... la que sea).
// 2) Si no, fallback: busca VS Code por el nombre de la carpeta del cwd.
function focusTerminal(cwd, hwnd) {
  const folder = cwd ? path.basename(cwd) : '';
  const ps = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
}
"@
function Focus-Handle([IntPtr]$h) {
  if ($h -eq [IntPtr]::Zero -or -not [Win]::IsWindow($h)) { return $false }
  if ([Win]::IsIconic($h)) { [Win]::ShowWindow($h, 9) | Out-Null }  # SW_RESTORE
  [Win]::SetForegroundWindow($h) | Out-Null
  return $true
}

$ok = $false
$hwnd = '${String(hwnd || '').replace(/[^0-9]/g, '')}'
if ($hwnd -ne '') { $ok = Focus-Handle ([IntPtr][int64]$hwnd) }

if (-not $ok) {
  $folder = '${folder.replace(/'/g, "''")}'
  $procs = Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and ($_.Name -eq 'Code' -or $_.Name -eq 'Code - Insiders' -or $_.Name -eq 'WindowsTerminal' -or $_.MainWindowTitle -like '*Visual Studio Code*') }
  $target = $null
  if ($folder -ne '') { $target = $procs | Where-Object { $_.MainWindowTitle -like "*$folder*" } | Select-Object -First 1 }
  if ($null -eq $target) { $target = $procs | Select-Object -First 1 }
  if ($null -ne $target) { Focus-Handle ($target.MainWindowHandle) | Out-Null }
}
`;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], (err) => {
    if (err) console.error('focusTerminal error:', err.message);
  });
}

// Escanea procesos que ejecutan Claude Code y devuelve la ventana terminal que los hospeda.
function listClaudeTerminals() {
  return new Promise((resolve) => {
    const ps = `
$ErrorActionPreference='SilentlyContinue'
$rows = @()
$procs = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and ($_.CommandLine -match 'claude') -and ($_.Name -match 'node|claude|pwsh|powershell|bash')
}
foreach ($p in $procs) {
  # subir por el arbol de padres hasta una ventana visible (la terminal)
  $cur = $p.ProcessId; $host_ = $null; $depth = 0
  while ($cur -and $depth -lt 8) {
    $pr = Get-Process -Id $cur -ErrorAction SilentlyContinue
    if ($pr -and $pr.MainWindowHandle -ne 0 -and $pr.MainWindowTitle -ne '') { $host_ = $pr; break }
    $pp = (Get-CimInstance Win32_Process -Filter "ProcessId=$cur").ParentProcessId
    if (-not $pp -or $pp -eq $cur) { break }
    $cur = $pp; $depth++
  }
  if ($host_) {
    $rows += [pscustomobject]@{ pid=$p.ProcessId; terminal=$host_.ProcessName; title=$host_.MainWindowTitle }
  }
}
$rows | Sort-Object title -Unique | ConvertTo-Json -Compress
`;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 8000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (_) { resolve([]); }
    });
  });
}

// ---------------------------------------------------------------------------
// IPC desde renderer
// ---------------------------------------------------------------------------
ipcMain.on('overlay-ready', () => {
  overlayReady = true;
  while (pending.length) pending.shift()();
});

ipcMain.on('overlay-click', (_e, payload) => {
  focusTerminal(payload && payload.cwd, payload && payload.hwnd);
  // NO ocultar aqui: el renderer anima la salida (state-leave, 380ms) y luego
  // pide 'overlay-dismiss'. Ocultar la ventana al instante se comia esa animacion.
});

ipcMain.on('overlay-dismiss', () => {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.hide();
});

ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (_e, cfg) => saveConfig(cfg));
ipcMain.handle('list-terminals', () => listClaudeTerminals());
ipcMain.handle('pick-sound', async () => {
  const r = await dialog.showOpenDialog(settingsWin, {
    title: 'Elegir sonido de notificacion',
    filters: [{ name: 'Audio', extensions: ['wav', 'mp3'] }],
    properties: ['openFile']
  });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths[0];
});
ipcMain.on('test-notification', () => {
  showNotification(normalizePayload({
    message: t('test'),
    cwd: process.cwd(),
    hook_event_name: 'Notification'
  }));
});

// ---------------------------------------------------------------------------
// Ventana de configuracion
// ---------------------------------------------------------------------------
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 500,
    height: 760,
    title: 'Claude Notificator — Configuracion',
    resizable: false,
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------
function createTray() {
  let img = nativeImage.createFromPath(ICON_PATH);
  if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip('Claude Notificator');
  const menu = Menu.buildFromTemplate([
    { label: 'Probar notificacion', click: () => ipcMain.emit('test-notification') },
    { label: 'Configuracion', click: openSettings },
    { type: 'separator' },
    { label: 'Salir', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', openSettings);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
app.on('second-instance', () => openSettings());

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.vitio.claudenotificator');
  applyStartupSetting();
  syncHookPort();
  createTray();
  createOverlay();
  startServer();
});

// No cerrar app al cerrar ventanas: vive en tray.
app.on('window-all-closed', (e) => { /* mantener vivo */ });
app.on('before-quit', () => { if (server) server.close(); });
