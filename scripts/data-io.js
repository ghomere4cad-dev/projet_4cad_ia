/* ═══════════════════════════════════════════════════════════════
   data-io.js — Export / Import de toutes les données locales en JSON
   (Todo, Suivi, Ressources, Portfolio)
   ═══════════════════════════════════════════════════════════════ */

const _DATA_IO_VERSION = 1;

function _collectAppData() {
  return {
    _version: _DATA_IO_VERSION,
    exportedAt: new Date().toISOString(),
    todo: _todoData,
    suivi: _suiviState,
    resources: resources,
    gho: (typeof _buildGhoPayload === 'function') ? _buildGhoPayload() : null,
    portfolio: _serializePortfolio(portfolio),
    portfolioFirm: _serializePortfolio(portfolioFirm)
  };
}

function exportAppData() {
  const data = _collectAppData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `4cad-project-manager-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importAppData() {
  const input = document.getElementById('dataImportInput');
  if (!input) return;
  input.value = '';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = JSON.parse(evt.target.result);
        _applyImportedAppData(data);
      } catch(e) {
        alert('Erreur d\'import : fichier JSON invalide.\n' + e.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function _applyImportedAppData(data) {
  if (!data || typeof data !== 'object') {
    alert('Fichier invalide.');
    return;
  }
  if (!confirm('Importer ce fichier remplacera toutes les données locales (Todo, Suivi, Ressources, Portefeuille).\n\nContinuer ?')) return;

  const _warnCountBefore = _storageWarned.size;

  if (data.todo) {
    _todoData = data.todo;
    _todoWriteLS();
  }
  if (data.suivi) {
    _suiviState = data.suivi;
    _suiviWriteLS();
  }
  if (Array.isArray(data.resources)) {
    resources = data.resources;
    saveResources();
  }
  if (data.gho) {
    try { localStorage.setItem(GHO_KEY, JSON.stringify(data.gho)); }
    catch(e) { _warnStorageFailure('données GHO (charges par ressource)', e); }
    if (typeof _mergeGhoData === 'function') _mergeGhoData(data.gho);
  }
  if (Array.isArray(data.portfolio)) {
    saveFirmPortfolio(Array.isArray(data.portfolioFirm) ? data.portfolioFirm : []);
    portfolio = _deserializePortfolio(data.portfolio);
    savePortfolio();
  }

  if (_storageWarned.size === _warnCountBefore) alert('Import terminé.');
  location.reload();
}
