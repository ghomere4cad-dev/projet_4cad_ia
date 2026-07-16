/* ═══════════════════════════════════════════════════════════════
   resources-import.js — Import Excel : liste ressources + liste clients
   Dépendances : resources.js (saveResources, resources[]), data.js
                 (saveClients, _addClient, clients[]), XLSX
   ═══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════
   IMPORT LISTE RESSOURCES (Excel 3 colonnes : ID / Name / Profession)
   ══════════════════════════════════ */
function triggerListImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => parseListExcel(evt.target.result);
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

/* Normalise une chaîne lue depuis Excel :
   - apostrophes typographiques (' ') → apostrophe standard (')
   - guillemets typographiques (" ") → guillemets droits (")
   - espaces insécables et espaces spéciaux → espace normal
   - NFC pour les caractères accentués composés */
function _normalizeExcelStr(val) {
  if (val == null) return '';
  return String(val)
    .normalize('NFC')
    .replace(/[\u2018\u2019\u201A\u201B\u02BC\uFF07]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u00A0\u202F\u2009\u2007\u2008\u200B]/g, ' ')
    .trim();
}

function parseListExcel(buffer) {
  try {
    if (typeof XLSX === 'undefined') {
      alert('SheetJS non disponible — vérifiez le chargement de la librairie.');
      return;
    }
    const wb  = XLSX.read(buffer, { type: 'array', cellDates: false });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    if (raw.length < 2) { alert('Fichier vide ou format invalide.'); return; }

    /* ── Détection flexible des colonnes ──
       Stratégie :
         1. Cherche la première colonne dont l'en-tête contient le mot-clé
         2. Si non trouvée, fallback sur la position (0=ID, 1=Nom, 2=Rôle)
       → l'import ne se bloque jamais sur un nom de colonne inattendu        */
    /* Normaliser les en-têtes (espaces insécables, apostrophes typographiques, etc.) */
    const header = (raw[0] || []).map(h => _normalizeExcelStr(h).toLowerCase());

    const _findCol = (patterns, fallback) => {
      const idx = header.findIndex(h => patterns.some(p => p.test(h)));
      return idx >= 0 ? idx : fallback;
    };

    const colId   = _findCol([/\bid\b/, /resource[\s_-]?id/, /id[\s_-]?resource/], 0);
    const colName = _findCol([/\bname\b/, /\bnom\b/, /resource[\s_-]?name/],       1);
    const colProf = _findCol([/\brole\b/, /\bprof/, /\bfonction/, /\bposte\b/,
                              /\btitre\b/, /\btitle\b/, /\bjob\b/],                2);
    const colType = _findCol([/\btype\b/],                                        -1); // pas de fallback positionnel

    /* ── Clé de correspondance : externalId + fullName normalisé ── */
    const _matchKey = (externalId, fullName) =>
      (String(externalId).trim() + '|' + String(fullName).trim()).toLowerCase();

    /* ── 1. Construire la liste des ressources du fichier ── */
    const importedKeys = new Set();
    const importRows   = [];

    for (let ri = 1; ri < raw.length; ri++) {
      const row = raw[ri];
      if (!row) continue;
      const externalId   = _normalizeExcelStr(row[colId]);
      const fullName     = _normalizeExcelStr(row[colName]);
      const profession   = _normalizeExcelStr(colProf >= 0 ? row[colProf] : null);
      const resourceType = _normalizeExcelStr(colType >= 0 ? row[colType] : null);
      if (!externalId && !fullName) continue;
      const key = _matchKey(externalId, fullName);
      importedKeys.add(key);
      importRows.push({ externalId, fullName, profession, resourceType, key });
    }

    if (!importRows.length) { alert('Aucune ligne valide trouvée dans le fichier.'); return; }

    /* ── 2. Upsert : mise à jour ou création ── */
    let created = 0, updated = 0, deleted = 0;

    for (const { externalId, fullName, profession, resourceType, key } of importRows) {
      /* Correspondance par couple ID + Nom (normalisé) */
      const existing = resources.find(r =>
        _matchKey(r.externalId || '', r.fullName || '') === key
      );
      if (existing) {
        existing.fullName     = fullName;
        existing.profession   = profession;
        existing.externalId   = externalId;
        existing.resourceType = resourceType || existing.resourceType || '';
        updated++;
      } else {
        resources.push({ id: genResId(), externalId, fullName, profession, resourceType: resourceType || '' });
        created++;
      }
    }

    /* ── 3. Suppression des ressources absentes du fichier
            (uniquement celles qui avaient un externalId — les ressources
             créées manuellement sans externalId sont préservées) ── */
    const before = resources.length;
    resources = resources.filter(r => {
      if (!r.externalId) return true; // ressource manuelle → conserver
      const key = _matchKey(r.externalId, r.fullName || '');
      return importedKeys.has(key);
    });
    deleted = before - resources.length;

    /* ── 4. Auto-reset du filtre type si aucune ressource ne correspond ── */
    const typesFound = [...new Set(resources.map(r => r.resourceType || '').filter(Boolean))].sort();
    if (_resTypeFilter && !resources.some(r =>
      (r.resourceType || '').toLowerCase() === _resTypeFilter.toLowerCase()
    )) {
      _resTypeFilter = typesFound.length ? typesFound[0] : '';
    }

    saveResources();
    const typesSummary = typesFound.length
      ? `\n• Types détectés : ${typesFound.join(', ')}`
      : '\n• ⚠ Colonne "Resource Type" non détectée (filtre réinitialisé à "Tous")';
    alert(`Import Liste ✓\n• ${created} créée(s)\n• ${updated} mise(s) à jour\n• ${deleted} supprimée(s)${typesSummary}`);
  } catch (err) {
    console.error('List import error:', err);
    alert('Erreur import Liste : ' + err.message);
  }
}

/* ══════════════════════════════════
   IMPORT LISTE CLIENTS (Excel 1 colonne : Société)
   N'ajoute que des clients — n'en retire jamais, même si un nom présent
   auparavant n'apparaît plus dans le fichier ré-importé.
   ══════════════════════════════════ */
function triggerGHOImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => parseClientExcel(evt.target.result);
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

function parseClientExcel(buffer) {
  try {
    if (typeof XLSX === 'undefined') {
      alert('SheetJS non disponible — vérifiez le chargement de la librairie.');
      return;
    }
    const wb  = XLSX.read(buffer, { type: 'array', cellDates: false });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    if (raw.length < 2) { alert('Fichier vide ou format invalide.'); return; }

    /* Colonne "Société" — recherche flexible du header, sinon 1ère colonne */
    const header = (raw[0] || []).map(h => _normalizeExcelStr(h).toLowerCase());
    const colIdx = (() => {
      const idx = header.findIndex(h => /soci[eé]t[eé]|client|company/.test(h));
      return idx >= 0 ? idx : 0;
    })();

    const names = [];
    for (let ri = 1; ri < raw.length; ri++) {
      const row = raw[ri];
      if (!row) continue;
      const name = _normalizeExcelStr(row[colIdx]);
      if (name) names.push(name);
    }

    if (!names.length) { alert('Aucun client trouvé dans le fichier.'); return; }

    let created = 0;
    names.forEach(name => { if (_addClient(name)) created++; });

    saveClients();
    if (typeof _suiviRenderSidebar === 'function') _suiviRenderSidebar();
    alert(`Import Client ✓\n• ${created} nouveau(x) client(s) ajouté(s)\n• ${clients.length} au total`);
  } catch (err) {
    console.error('Client import error:', err);
    alert('Erreur import Client : ' + err.message);
  }
}
