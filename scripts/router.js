/* ═══════════════════════════════════════════
   router.js — Navigation entre les vues de l'application
   Vues : 'ressources' | 'todo' | 'suivi'
   Hash routing : location.hash = '#<vue>'
   ═══════════════════════════════════════════ */

const _VALID_VIEWS = ['ressources', 'todo', 'suivi'];

function _hashView() {
  const h = location.hash.replace(/^#/, '');
  return _VALID_VIEWS.includes(h) ? h : 'todo';
}

let currentView = 'todo';

function _applyView(view) {
  if (!_VALID_VIEWS.includes(view)) view = 'todo';
  currentView = view;

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });

  const viewRessources = document.getElementById('viewRessources');
  const viewTodo       = document.getElementById('viewTodo');
  const viewSuivi       = document.getElementById('viewSuivi');

  viewRessources.style.display = 'none';
  if (viewTodo)  viewTodo.style.display  = 'none';
  if (viewSuivi) viewSuivi.style.display = 'none';

  if (view === 'ressources') {
    viewRessources.style.display = '';
    if (typeof renderResourcesView === 'function') renderResourcesView();

  } else if (view === 'todo') {
    if (viewTodo) viewTodo.style.display = 'flex';
    if (typeof renderTodoView === 'function') renderTodoView();

  } else if (view === 'suivi') {
    if (viewSuivi) viewSuivi.style.display = 'flex';
    if (typeof renderSuiviView === 'function') renderSuiviView();
  }
}

/* Legacy: programmatic view switch (keeps working for any existing callers) */
function switchView(view) {
  if (view === currentView) return;
  location.hash = '#' + view;
}

function _navClick(e, view) {
  if (view === currentView) { e.preventDefault(); return; }
  /* else: let <a href="#view"> navigate naturally → hashchange → _applyView */
}

/* React to browser back/forward and programmatic hash changes */
window.addEventListener('hashchange', () => _applyView(_hashView()));

/* On initial page load: apply view from URL hash */
document.addEventListener('DOMContentLoaded', () => {
  _applyView(_hashView());
});
