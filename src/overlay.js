'use strict';

const stage = document.getElementById('stage');
const pill = document.getElementById('pill');
const elProject = document.getElementById('project');
const elMessage = document.getElementById('message');
const elIcon = document.getElementById('icon');
const snd = document.getElementById('snd');
const closeBtn = document.getElementById('close');

let current = null;
let hideTimer = null;
let morphTimer = null;
let hovered = false;

// --- Construir el sunburst oficial de Claude (12 rayos) ---
// Cada rayo va en su propio <g rotate> (atributo) y el <rect> pulsa por CSS,
// asi rotacion y escala no se pisan.
(function buildIcon() {
  const RAYS = 14;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'spark');

  const group = document.createElementNS(ns, 'g');
  group.setAttribute('class', 'rays');

  for (let i = 0; i < RAYS; i++) {
    const angle = (360 / RAYS) * i;
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `rotate(${angle} 50 50)`);

    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('class', 'ray');
    // rayos largos/cortos alternados (como el logo real). Llegan hasta el centro.
    const outerY = (i % 2 === 0) ? 6 : 15;
    r.setAttribute('x', '46.5');
    r.setAttribute('y', String(outerY));
    r.setAttribute('width', '7');
    r.setAttribute('height', String(50 - outerY)); // termina cerca del centro (y=50)
    r.setAttribute('rx', '3.5');
    r.style.animationDelay = (i * (1.8 / RAYS)).toFixed(2) + 's';

    g.appendChild(r);
    group.appendChild(g);
  }

  // disco central solido (el "circulo del medio" que faltaba)
  const core = document.createElementNS(ns, 'circle');
  core.setAttribute('class', 'core');
  core.setAttribute('cx', '50');
  core.setAttribute('cy', '50');
  core.setAttribute('r', '9');

  svg.appendChild(group);
  svg.appendChild(core); // encima de los rayos -> centro solido limpio
  elIcon.appendChild(svg);
})();

function applyAnchor(anchor) {
  stage.className = '';
  const [v, h] = (anchor || 'top-right').split('-');
  stage.classList.add('anchor-' + v);
  stage.classList.add('anchor-' + h);
}

function clearTimers() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  if (morphTimer) { clearTimeout(morphTimer); morphTimer = null; }
}

function setState(s) {
  pill.classList.remove('state-hidden', 'state-circle', 'state-pill', 'state-expanded', 'state-leave');
  pill.classList.add(s);
}

function playSound(p) {
  if (!p) return;
  try {
    snd.src = 'file:///' + p.replace(/\\/g, '/');
    snd.currentTime = 0;
    snd.play().catch(() => {});
  } catch (_) {}
}

// Programa el auto-ocultado SOLO si no esta el mouse encima.
function scheduleHide() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  const ms = current && current.autoHideMs;
  if (!ms || ms <= 0) return;     // 0 = nunca
  if (hovered) return;            // mientras hover, no ocultar
  hideTimer = setTimeout(() => leave(false), ms);
}

function show(payload) {
  current = payload;
  hovered = false;
  clearTimers();

  // tipo de animacion de entrada/salida (CSS las lee de estos data-attrs)
  pill.dataset.animIn = payload.animIn || 'pop';
  pill.dataset.animOut = payload.animOut || 'pop';

  applyAnchor(payload.anchor);
  elProject.textContent = payload.project || 'terminal';
  elMessage.textContent = payload.message || '';
  if (payload.iconColor) document.documentElement.style.setProperty('--icon-color', payload.iconColor);

  playSound(payload.sound);

  setState('state-hidden');
  void pill.offsetWidth; // reflow
  requestAnimationFrame(() => {
    setState('state-circle');
    morphTimer = setTimeout(() => {
      if (!hovered) setState('state-pill');
      scheduleHide();
    }, 850);
  });
}

// Hover sobre el STAGE (ventana, tamaño fijo) en vez del pill: el pill cambia de
// tamaño al expandir y eso causaba flicker mouseenter/leave que lo hacia desaparecer.
// El stage no se redimensiona -> hover estable. Solo se oculta por click o timeout.
// Debounce del colapso: Windows manda leaves espurios (~1/seg) en ventanas
// transparent+alwaysOnTop aunque el cursor este quieto. Esperamos 180ms antes de
// colapsar; si vuelve a entrar (re-enter espurio) se cancela -> sin parpadeo.
let collapseTimer = null;

stage.addEventListener('mouseenter', () => {
  if (pill.classList.contains('state-leave') || pill.classList.contains('state-hidden')) return;
  if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
  hovered = true;
  clearTimers();
  if (!pill.classList.contains('state-expanded')) setState('state-expanded');
});

stage.addEventListener('mouseleave', () => {
  if (pill.classList.contains('state-leave') || pill.classList.contains('state-hidden')) return;
  if (collapseTimer) clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => {
    collapseTimer = null;
    hovered = false;
    setState('state-pill');
    scheduleHide();
  }, 180);
});

// Click sobre el pill -> enfoca la terminal con Claude (main: focusTerminal) y sale.
// pointerdown+pointerup para confirmar que el boton se solto sobre el pill.
let pressing = false;
pill.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pressing = true;
});
pill.addEventListener('pointerup', (e) => {
  if (e.button !== 0 || !pressing) return;
  pressing = false;
  if (!current) return;
  window.api.click({ cwd: current.cwd, hwnd: current.hwnd });
  leave(true);
});
window.addEventListener('pointerup', () => { pressing = false; }, true);

// Boton cerrar (solo visible en expandido): solo cierra, NO enfoca terminal.
// stopPropagation evita que el pointerdown/up dispare el click del pill.
closeBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
closeBtn.addEventListener('pointerup', (e) => {
  e.stopPropagation();
  pressing = false;
  leave(false);
});

pill.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pill.click(); }
  if (e.key === 'Escape') leave(false);
});

function leave(clicked) {
  clearTimers();
  hovered = false;
  // Salida espejo de la entrada: colapsa a circulo y encoge a 0 con el mismo spring.
  setState('state-leave');
  setTimeout(() => {
    setState('state-hidden');
    // Ocultar la ventana SIEMPRE despues de animar (antes el caso clicked dependia
    // de que main ocultara al instante -> sin animacion de salida).
    window.api.dismiss();
  }, 460);
}

window.api.onNotify((data) => show(data));
window.api.ready();
