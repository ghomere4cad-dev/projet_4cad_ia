/* ═══════════════════════════════════════════
   data.js — Portfolio (clients/projets/tâches), persistance locale
   Le portfolio alimente la liste des clients pour Todo/Suivi et sert
   de cible à l'import GHO (Ressources). Pas d'UI Gantt : uniquement
   le modèle de données et sa persistance.
   ═══════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   PERSISTANCE — localStorage
   ══════════════════════════════════════════════ */
function _serializePortfolio(data){
  return data.map(p=>({
    id:p.id, name:p.name, client:p.client||'', folder:p.folder||'',
    rows: (p.rows||[])
      .filter(r=>r._type!=='jalon')
      .map(r=>{
        const{_srcPid,...rest}=r;
        return{...rest,
          debut:r.debut?r.debut.toISOString():null,
          fin:r.fin?r.fin.toISOString():null,
          assignments:(Array.isArray(r.assignments)?r.assignments:[]).map(a=>({
            ...a,
            debut:a.debut instanceof Date?a.debut.toISOString():(a.debut||null),
            fin:  a.fin   instanceof Date?a.fin.toISOString()  :(a.fin  ||null),
            daily:a.daily?Object.fromEntries(
              Object.entries(a.daily).map(([k,v])=>[k.replace(/\//g,'-'),v])
            ):{}
          }))
        };
      }),
    jalons: (p.jalons||[]).map(j=>{const{_srcPid,...rest}=j;return{...rest,
      date:j.date?j.date.toISOString():null
    };}),
    projectColors: p.projectColors||{},
    collapsed: p.collapsed||{},
    lissageConfig: p.lissageConfig||null,
    _appCreated: p._appCreated || false,
    updatedAt: p.updatedAt || null
  }));
}

function savePortfolio(){
  try {
    const serialized = _serializePortfolio(portfolio);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch(e){
    console.warn('localStorage save failed:', e);
    _warnStorageFailure('portfolio (clients/projets)', e);
  }
}

function loadPortfolio(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!Array.isArray(data) || !data.length) return false;
    portfolio = _deserializePortfolio(data);
    return true;
  }catch(e){ return false; }
}

function _deserializePortfolio(data){
  return data.map(p=>({
    ...p,
    client: p.client||'',
    folder: p.folder||'',
    projectColors: p.projectColors||{},
    collapsed: p.collapsed||{},
    updatedAt: p.updatedAt || null,
    rows: (p.rows||[]).filter(r=>r._type!=='jalon').map(r=>({
      ...r,
      debut: r.debut ? new Date(r.debut) : null,
      fin:   r.fin   ? new Date(r.fin)   : null,
      assignments: (Array.isArray(r.assignments)?r.assignments:[]).map(a=>({
        ...a,
        debut: a.debut ? new Date(a.debut) : null,
        fin:   a.fin   ? new Date(a.fin)   : null,
        daily: a.daily ? Object.fromEntries(
          Object.entries(a.daily).map(([k,v])=>[k.includes('/')?k:k.replace(/-/g,'/'),v])
        ) : {}
      }))
    })),
    jalons: (p.jalons||[]).map(j=>({
      ...j,
      date: j.date ? new Date(j.date) : null
    }))
  }));
}

/* ══════════════════════════════════════════════
   BASE FERME — couche import-only
   ══════════════════════════════════════════════ */

/* Clé stable par tâche (pour comparer ferme vs planifié) */
function _taskKey(row) {
  if (row.externalTaskId) return 'ext:' + row.externalTaskId;
  return (row.niveaux || []).join('\x1F') + '\x1F' + (row.tache || '');
}

/* Sauvegarde la base ferme en localStorage */
function saveFirmPortfolio(firmData) {
  portfolioFirm = firmData;
  try {
    localStorage.setItem(FIRM_STORAGE_KEY, JSON.stringify(_serializePortfolio(firmData)));
  } catch(e) {
    console.warn('Firm localStorage save failed:', e);
    _warnStorageFailure('base ferme (import GHO)', e);
  }
}

/* Chargement de la base ferme depuis localStorage */
function loadFirmPortfolio() {
  try {
    const raw = localStorage.getItem(FIRM_STORAGE_KEY);
    if (!raw) return false;
    portfolioFirm = _deserializePortfolio(JSON.parse(raw));
    return true;
  } catch(e) { return false; }
}

/* Fusionne un projet ferme dans sa version de travail
   (les tâches _source:'planned' de l'utilisateur sont préservées) */
function _mergeFirmProject(workProj, firmProj) {
  const firmTaskKeys = new Set((firmProj.rows || []).map(_taskKey));
  const newRows = [];
  (firmProj.rows || []).forEach(ft => {
    const key = _taskKey(ft);
    const workTask = (workProj.rows || []).find(wt => _taskKey(wt) === key);
    if (workTask && workTask._source === 'planned') {
      newRows.push(workTask);   // version planifiée par l'utilisateur prime
    } else {
      newRows.push({ ...ft });  // version ferme (sans _source)
    }
  });
  // Tâches créées par l'utilisateur sans contrepartie ferme
  (workProj.rows || [])
    .filter(wt => wt._source === 'planned' && !firmTaskKeys.has(_taskKey(wt)))
    .forEach(wt => newRows.push(wt));
  return { ...workProj, rows: newRows, name: firmProj.name, client: firmProj.client };
}

/* Fusionne toute la nouvelle base ferme dans le portfolio de travail */
function mergeFirmIntoWorking(newFirmData) {
  const firmIds = new Set(newFirmData.map(p => p.id));
  newFirmData.forEach(firmProj => {
    const workIdx = portfolio.findIndex(p => p.id === firmProj.id);
    if (workIdx === -1) {
      portfolio.push({ ...firmProj, rows: (firmProj.rows || []).map(r => ({ ...r })) });
    } else {
      portfolio[workIdx] = _mergeFirmProject(portfolio[workIdx], firmProj);
    }
  });
  // Projets retirés de la base ferme (et non créés dans l'appli)
  const removedFromFirm = portfolio.filter(p => !p._appCreated && !firmIds.has(p.id));
  if (removedFromFirm.length > 0) {
    const msg = `La base ferme a été mise à jour.\n\nLes projets suivants ne sont plus dans l'import :\n${removedFromFirm.map(p => `• ${p.name} (${p.client || 'sans client'})`).join('\n')}\n\nVoulez-vous les conserver dans la planification ?`;
    if (!confirm(msg)) {
      removedFromFirm.forEach(p => {
        const idx = portfolio.indexOf(p);
        if (idx !== -1) portfolio.splice(idx, 1);
        selectedProjectIds.delete(p.id);
      });
    } else {
      removedFromFirm.forEach(p => { p._appCreated = true; });
    }
  }
}

/* Notifie l'utilisateur si des tâches planifiées existent sur des projets mis à jour */
let _pendingConflictCallback = null;
let _pendingConflictProjs    = null;
let _pendingConflictFirmData = null;

function _notifyFirmConflicts(newFirmData, onDone) {
  const conflictProjs = newFirmData
    .map(fp => portfolio.find(wp => wp.id === fp.id))
    .filter(wp => wp && (wp.rows || []).some(r => r._source === 'planned'));
  if (conflictProjs.length === 0) { if (onDone) onDone(); return; }

  const msg = `⚠ La base ferme a été mise à jour.\n\nDes modifications planifiées existent sur :\n${conflictProjs.map(p => `• ${p.name}`).join('\n')}\n\nVoulez-vous réinitialiser ces projets à la nouvelle base ferme ?\n(Les modifications planifiées seront perdues)`;
  const modal = document.getElementById('firmConflictModal');
  if (!modal) {
    /* Fallback si la modal n'est pas présente */
    if (confirm(msg)) conflictProjs.forEach(p => _resetProjectToFirmSilent(p.id, newFirmData));
    if (onDone) onDone();
    return;
  }
  const textEl = document.getElementById('firmConflictText');
  if (textEl) textEl.textContent = msg;
  _pendingConflictCallback = onDone || null;
  _pendingConflictProjs    = conflictProjs;
  _pendingConflictFirmData = newFirmData;
  modal.style.display = 'flex';
}

function confirmFirmConflict() {
  const modal = document.getElementById('firmConflictModal');
  if (modal) modal.style.display = 'none';
  if (_pendingConflictProjs && _pendingConflictFirmData) {
    _pendingConflictProjs.forEach(p => _resetProjectToFirmSilent(p.id, _pendingConflictFirmData));
  }
  _pendingConflictProjs = null; _pendingConflictFirmData = null;
  const cb = _pendingConflictCallback; _pendingConflictCallback = null;
  if (cb) cb();
}

function cancelFirmConflict() {
  const modal = document.getElementById('firmConflictModal');
  if (modal) modal.style.display = 'none';
  _pendingConflictProjs = null; _pendingConflictFirmData = null;
  const cb = _pendingConflictCallback; _pendingConflictCallback = null;
  if (cb) cb();
}

/* Réinitialise un projet à la base ferme sans confirmation */
function _resetProjectToFirmSilent(projectId, firmDataSrc) {
  const src = firmDataSrc || portfolioFirm;
  const firmProj = src.find(p => p.id === projectId);
  if (!firmProj) return;
  const idx = portfolio.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  const cur = portfolio[idx];
  const deser = _deserializePortfolio([JSON.parse(JSON.stringify(_serializePortfolio([firmProj])[0]))])[0];
  portfolio[idx] = {
    ...deser,
    /* Préserver les métadonnées utilisateur : client, dossier, couleurs, état replié */
    client:        cur.client        || deser.client,
    folder:        cur.folder        !== undefined ? cur.folder : (deser.folder || ''),
    collapsed:     cur.collapsed     || {},
    projectColors: cur.projectColors || firmProj.projectColors || {},
    jalons:        cur.jalons        || firmProj.jalons        || []
  };
}

/* ── Modal import — options avant commit ── */
let _pendingImportCallback = null;

function showImportModal(summaryText, onConfirm) {
  _pendingImportCallback = onConfirm;
  const el = document.getElementById('importSummaryText');
  if (el) el.textContent = summaryText;
  const cb = document.getElementById('importResetPlanned');
  if (cb) cb.checked = false;
  const modal = document.getElementById('importOptionsModal');
  if (modal) modal.style.display = 'flex';
}

function confirmImport() {
  const cb = document.getElementById('importResetPlanned');
  const resetPlanned = cb ? cb.checked : false;
  const modal = document.getElementById('importOptionsModal');
  if (modal) modal.style.display = 'none';
  if (_pendingImportCallback) {
    const fn = _pendingImportCallback;
    _pendingImportCallback = null;
    fn(resetPlanned);
  }
}

function cancelImport() {
  _pendingImportCallback = null;
  const modal = document.getElementById('importOptionsModal');
  if (modal) modal.style.display = 'none';
}

/* Supprime les marqueurs planifiés sur tous les projets présents dans firmData,
   retire aussi les tâches sans contrepartie ferme (orphelines d'anciens imports),
   et supprime les projets créés manuellement (_appCreated:true) */
function _resetPlannedForFirmProjects(firmData) {
  firmData.forEach(fp => {
    const wp = portfolio.find(p => p.id === fp.id);
    if (!wp) return;
    /* Remplacer intégralement les rows par la base ferme :
       - supprime les tâches orphelines d'anciens imports (absentes de fp.rows)
       - écrase les versions planifiées par l'utilisateur (même celles qui matchent une tâche ferme)
       - supprime tous les marqueurs _source */
    wp.rows = (fp.rows || []).map(r => {
      const { _source, ...rest } = r;
      return {
        ...rest,
        assignments: (rest.assignments||[]).map(a=>({...a, daily:a.daily?{...a.daily}:{}}))
      };
    });
  });
  /* Supprimer les projets créés manuellement */
  const appCreatedIds = portfolio.filter(p => p._appCreated).map(p => p.id);
  if (appCreatedIds.length) {
    portfolio = portfolio.filter(p => !p._appCreated);
    appCreatedIds.forEach(id => {
      selectedProjectIds.delete(id);
      if (activeProjectId === id) activeProjectId = null;
    });
  }
}

