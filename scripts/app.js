/* ═══════════════════════════════════════════
   app.js — Initialisation de l'application (locale, sans authentification)
   ═══════════════════════════════════════════ */

/* ── Thème clair/sombre ───────────────────────────────────────────────────── */
const _ICON_SUN  = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const _ICON_MOON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function _setBtnTheme(isDark) {
  const btn = document.getElementById('btnTheme');
  if (!btn) return;
  btn.innerHTML = isDark
    ? _ICON_SUN  + ' <span class="btn-theme-lbl">Clair</span>'
    : _ICON_MOON + ' <span class="btn-theme-lbl">Sombre</span>';
}

function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next   = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('gantt4cad_theme', next);
  _setBtnTheme(!isDark);
}

(function () {
  const saved = localStorage.getItem('gantt4cad_theme');
  _setBtnTheme(saved === 'dark');
})();

/* ── Chargement des données locales ──────────────────────────────────────────
   Tout est stocké en localStorage : portfolio (alimenté par l'import GHO dans
   Ressources), ressources, Todo, Suivi. Chargement synchrone, pas d'auth. ── */
loadPortfolio();
loadFirmPortfolio();

try { usePlanned = localStorage.getItem('4cap_useplanned') === '1'; } catch(_) {}

if (typeof initResources === 'function') initResources();
if (typeof _startTodoLoad === 'function') _startTodoLoad();
if (typeof _startSuiviLoad === 'function') _startSuiviLoad();
