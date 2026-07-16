/* ═══════════════════════════════════════════
   data.js — Base clients (liste simple de noms de sociétés)
   Alimentée par l'import Excel (bouton "Client" du header, une seule
   colonne "Société"). Sert uniquement à faire apparaître les dossiers
   Todo correspondants dans Suivi (voir suivi.js : _suiviGetLinkedClients).
   ═══════════════════════════════════════════ */

function saveClients() {
  try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients)); }
  catch(e) { _warnStorageFailure('clients', e); }
}

function loadClients() {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    if (raw) clients = JSON.parse(raw);
  } catch(e) { clients = []; }
}

/* Ajoute un client s'il n'existe pas déjà (comparaison insensible à la
   casse/accents). Ne retire jamais un client existant : un import ne fait
   qu'ajouter des clients, jamais en supprimer. Retourne true si ajouté. */
function _addClient(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  const norm = normalizeStr(trimmed);
  if (clients.some(c => normalizeStr(c) === norm)) return false;
  clients.push(trimmed);
  return true;
}
