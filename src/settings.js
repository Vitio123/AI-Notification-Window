'use strict';

const $ = (id) => document.getElementById(id);
let cfg = {};

const ANIMS = ['pop', 'fade', 'slide', 'zoom', 'drop'];

// ---------------------------------------------------------------------------
// i18n: textos de la UI en 5 idiomas
// ---------------------------------------------------------------------------
const I18N = {
  es: {
    subtitle: 'Notificador de terminal en segundo plano',
    language: 'Idioma', position: 'Posicion del aviso', appearance: 'Apariencia',
    iconColor: 'Color del icono Claude', animIn: 'Animacion de entrada', animOut: 'Animacion de salida',
    sound: 'Sonido de notificacion', noSound: 'Sin sonido (wav o mp3)', choose: 'Elegir…', remove: 'Quitar',
    soundEnable: 'Activar sonido propio', behavior: 'Comportamiento', startup: 'Iniciar con Windows',
    autoHide: 'Ocultar aviso tras', seconds: 'segundos', never: '(0 = nunca)', port: 'Puerto local',
    portHint: 'No suele tocarse. Dejalo en 4317. Solo cambialo si ese puerto esta ocupado; el hook de Claude se actualiza solo al guardar.',
    terminals: 'Terminales con Claude Code', search: 'Buscar', searchHint: 'Pulsa "Buscar" para detectar terminales.',
    searching: 'Buscando…', noTerminals: 'No se detectaron terminales con Claude Code ahora mismo.',
    testBtn: 'Probar', saveBtn: 'Guardar', saved: 'Guardado ✓',
    anim_pop: 'Pop (rebote)', anim_fade: 'Desvanecer', anim_slide: 'Deslizar', anim_zoom: 'Zoom', anim_drop: 'Caer'
  },
  en: {
    subtitle: 'Background terminal notifier',
    language: 'Language', position: 'Notification position', appearance: 'Appearance',
    iconColor: 'Claude icon color', animIn: 'Entry animation', animOut: 'Exit animation',
    sound: 'Notification sound', noSound: 'No sound (wav or mp3)', choose: 'Choose…', remove: 'Remove',
    soundEnable: 'Enable custom sound', behavior: 'Behavior', startup: 'Start with Windows',
    autoHide: 'Hide notification after', seconds: 'seconds', never: '(0 = never)', port: 'Local port',
    portHint: 'Rarely changed. Leave it at 4317. Only change it if that port is busy; the Claude hook updates itself on save.',
    terminals: 'Terminals running Claude Code', search: 'Search', searchHint: 'Press "Search" to detect terminals.',
    searching: 'Searching…', noTerminals: 'No terminals running Claude Code right now.',
    testBtn: 'Test', saveBtn: 'Save', saved: 'Saved ✓',
    anim_pop: 'Pop (bounce)', anim_fade: 'Fade', anim_slide: 'Slide', anim_zoom: 'Zoom', anim_drop: 'Drop'
  },
  pt: {
    subtitle: 'Notificador de terminal em segundo plano',
    language: 'Idioma', position: 'Posicao do aviso', appearance: 'Aparencia',
    iconColor: 'Cor do icone Claude', animIn: 'Animacao de entrada', animOut: 'Animacao de saida',
    sound: 'Som da notificacao', noSound: 'Sem som (wav ou mp3)', choose: 'Escolher…', remove: 'Remover',
    soundEnable: 'Ativar som proprio', behavior: 'Comportamento', startup: 'Iniciar com o Windows',
    autoHide: 'Ocultar aviso apos', seconds: 'segundos', never: '(0 = nunca)', port: 'Porta local',
    portHint: 'Raramente mexido. Deixe em 4317. So mude se a porta estiver ocupada; o hook do Claude se atualiza ao salvar.',
    terminals: 'Terminais com Claude Code', search: 'Buscar', searchHint: 'Clique em "Buscar" para detectar terminais.',
    searching: 'Buscando…', noTerminals: 'Nenhum terminal com Claude Code no momento.',
    testBtn: 'Testar', saveBtn: 'Salvar', saved: 'Salvo ✓',
    anim_pop: 'Pop (salto)', anim_fade: 'Desvanecer', anim_slide: 'Deslizar', anim_zoom: 'Zoom', anim_drop: 'Cair'
  },
  fr: {
    subtitle: 'Notificateur de terminal en arriere-plan',
    language: 'Langue', position: 'Position de l avis', appearance: 'Apparence',
    iconColor: 'Couleur de l icone Claude', animIn: 'Animation d entree', animOut: 'Animation de sortie',
    sound: 'Son de notification', noSound: 'Aucun son (wav ou mp3)', choose: 'Choisir…', remove: 'Retirer',
    soundEnable: 'Activer un son personnalise', behavior: 'Comportement', startup: 'Demarrer avec Windows',
    autoHide: 'Masquer l avis apres', seconds: 'secondes', never: '(0 = jamais)', port: 'Port local',
    portHint: 'Rarement modifie. Laissez 4317. Changez-le seulement si ce port est occupe; le hook de Claude se met a jour a l enregistrement.',
    terminals: 'Terminaux avec Claude Code', search: 'Rechercher', searchHint: 'Cliquez sur "Rechercher" pour detecter les terminaux.',
    searching: 'Recherche…', noTerminals: 'Aucun terminal avec Claude Code pour le moment.',
    testBtn: 'Tester', saveBtn: 'Enregistrer', saved: 'Enregistre ✓',
    anim_pop: 'Pop (rebond)', anim_fade: 'Fondu', anim_slide: 'Glisser', anim_zoom: 'Zoom', anim_drop: 'Chute'
  },
  de: {
    subtitle: 'Terminal-Benachrichtiger im Hintergrund',
    language: 'Sprache', position: 'Position des Hinweises', appearance: 'Darstellung',
    iconColor: 'Farbe des Claude-Symbols', animIn: 'Eingangsanimation', animOut: 'Ausgangsanimation',
    sound: 'Benachrichtigungston', noSound: 'Kein Ton (wav oder mp3)', choose: 'Waehlen…', remove: 'Entfernen',
    soundEnable: 'Eigenen Ton aktivieren', behavior: 'Verhalten', startup: 'Mit Windows starten',
    autoHide: 'Hinweis ausblenden nach', seconds: 'Sekunden', never: '(0 = nie)', port: 'Lokaler Port',
    portHint: 'Selten geaendert. Lass es bei 4317. Nur aendern, wenn der Port belegt ist; der Claude-Hook aktualisiert sich beim Speichern.',
    terminals: 'Terminals mit Claude Code', search: 'Suchen', searchHint: 'Auf "Suchen" klicken, um Terminals zu erkennen.',
    searching: 'Suche…', noTerminals: 'Derzeit keine Terminals mit Claude Code.',
    testBtn: 'Testen', saveBtn: 'Speichern', saved: 'Gespeichert ✓',
    anim_pop: 'Pop (Sprung)', anim_fade: 'Verblassen', anim_slide: 'Schieben', anim_zoom: 'Zoom', anim_drop: 'Fallen'
  }
};

function dict() { return I18N[cfg.language] || I18N.es; }

function applyI18n() {
  const d = dict();
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    if (d[k] != null) el.textContent = d[k];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const k = el.getAttribute('data-i18n-ph');
    if (d[k] != null) el.placeholder = d[k];
  });
  fillAnimSelect($('animIn'));
  fillAnimSelect($('animOut'));
  document.documentElement.lang = cfg.language || 'es';
}

function fillAnimSelect(sel) {
  const d = dict();
  const keep = sel.value;
  sel.innerHTML = '';
  ANIMS.forEach((a) => {
    const o = document.createElement('option');
    o.value = a;
    o.textContent = d['anim_' + a] || a;
    sel.appendChild(o);
  });
  if (keep) sel.value = keep;
}

function paintPos(pos) {
  document.querySelectorAll('.cell').forEach((c) => {
    c.classList.toggle('active', c.dataset.pos === pos);
  });
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function msToUI(ms) {
  ms = ms || 0;
  if (ms !== 0 && ms % 1000 === 0) return { val: ms / 1000, unit: 's' };
  if (ms === 0) return { val: 0, unit: 's' };
  return { val: ms, unit: 'ms' };
}
function uiToMs(val, unit) {
  const n = parseFloat(val) || 0;
  return unit === 's' ? Math.round(n * 1000) : Math.round(n);
}

async function init() {
  cfg = await window.api.getConfig();
  $('language').value = cfg.language || 'es';
  $('animIn').value = cfg.animIn || 'pop';
  $('animOut').value = cfg.animOut || 'pop';
  applyI18n();
  paintPos(cfg.position);
  $('iconColor').value = cfg.iconColor || '#ffffff';
  $('soundPath').value = cfg.soundPath || '';
  $('soundEnabled').checked = !!cfg.soundEnabled;
  $('launchAtStartup').checked = !!cfg.launchAtStartup;
  const ui = msToUI(cfg.autoHideMs);
  $('autoHideVal').value = ui.val;
  $('autoHideUnit').value = ui.unit;
  $('port').value = cfg.port ?? 4317;
}

$('language').addEventListener('change', () => { cfg.language = $('language').value; applyI18n(); });

document.querySelectorAll('.cell').forEach((c) => {
  c.addEventListener('click', () => { cfg.position = c.dataset.pos; paintPos(cfg.position); });
});

$('pickSound').addEventListener('click', async () => {
  const p = await window.api.pickSound();
  if (p) { cfg.soundPath = p; $('soundPath').value = p; }
});
$('clearSound').addEventListener('click', () => { cfg.soundPath = ''; $('soundPath').value = ''; });

$('test').addEventListener('click', () => window.api.testNotification());

$('refreshTerms').addEventListener('click', async () => {
  const d = dict();
  const box = $('termList');
  box.innerHTML = `<span class="muted">${d.searching}</span>`;
  const list = await window.api.listTerminals();
  if (!list || !list.length) {
    box.innerHTML = `<span class="muted">${d.noTerminals}</span>`;
    return;
  }
  box.innerHTML = '';
  list.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'term';
    row.innerHTML = `<span class="dot"></span><div><b>${t.terminal || '?'}</b>
      <div class="muted">${(t.title || '').replace(/</g, '&lt;')}</div></div>`;
    box.appendChild(row);
  });
});

$('save').addEventListener('click', async () => {
  const next = {
    position: cfg.position,
    language: $('language').value,
    animIn: $('animIn').value,
    animOut: $('animOut').value,
    iconColor: $('iconColor').value,
    soundPath: $('soundPath').value,
    soundEnabled: $('soundEnabled').checked,
    launchAtStartup: $('launchAtStartup').checked,
    autoHideMs: uiToMs($('autoHideVal').value, $('autoHideUnit').value),
    port: parseInt($('port').value, 10) || 4317
  };
  cfg = await window.api.saveConfig(next);
  toast(dict().saved);
});

init();
