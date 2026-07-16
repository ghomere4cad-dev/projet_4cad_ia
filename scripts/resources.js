/* ═══════════════════════════════════════════════════════════════
   resources.js — Base ressources (liste du personnel)
   Alimentée uniquement par l'import Excel (bouton "Ressource" du header).
   ═══════════════════════════════════════════════════════════════ */

/* ── État global ressources ── */
const RESOURCES_KEY = 'gantt4cad_resources';
let resources = [];

/* Filtre type — conservé pour le message de résumé de l'import Liste
   (voir resources-import.js : parseListExcel). */
let _resTypeFilter = 'Employee';

/* ══════════════════════════════════
   CRUD ressources
   ══════════════════════════════════ */
function saveResources() {
  try { localStorage.setItem(RESOURCES_KEY, JSON.stringify(resources)); }
  catch(e) { _warnStorageFailure('ressources', e); }
}

function loadResources() {
  try {
    const raw = localStorage.getItem(RESOURCES_KEY);
    if (raw) resources = _migrateResources(JSON.parse(raw));
  } catch(e) { resources = []; }
}

function genResId() {
  return 'r_' + Math.random().toString(36).slice(2, 9);
}

/* Migration données anciennes : {nom, prenom} → {fullName} */
function _migrateResources(list) {
  return (list || []).map(r => {
    if (!r.fullName && (r.nom !== undefined || r.prenom !== undefined)) {
      r = { ...r, fullName: [r.prenom, r.nom].filter(Boolean).join(' ') };
    }
    return r;
  });
}

/* ══════════════════════════════════
   INIT
   ══════════════════════════════════ */
function initResources() {
  loadResources();
}
