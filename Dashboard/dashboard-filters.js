/**
 * Dashboard/dashboard-filters.js
 *
 * Implements the search bar, platform filter chips, and the
 * Kanban/Analytics view toggle. All three update shared state
 * and trigger a board re-render.
 *
 * Dependencies: dashboard-state.js, dashboard-board.js (renderBoard),
 *               dashboard-analytics.js (renderAnalytics)
 */

/** Initialize the search bar with a 200ms debounce. */
function initSearch() {
  const input = document.getElementById('search-input');
  let debounceTimer;
  input?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      window.DashboardState.searchQuery = e.target.value.toLowerCase().trim();
      renderBoard();
    }, 200);
  });
}

/** Initialize platform filter chips (All, LinkedIn, Indeed, Naukri). */
function initFilters() {
  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      window.DashboardState.currentFilter = chip.dataset.filter;
      renderBoard();
    });
  });
}

/** Initialize the Kanban/Analytics view toggle buttons. */
function initViewToggle() {
  const kanbanBtn = document.getElementById('view-kanban');
  const analyticsBtn = document.getElementById('view-analytics');
  const kanbanView = document.getElementById('kanban-view');
  const analyticsView = document.getElementById('analytics-view');

  kanbanBtn?.addEventListener('click', () => {
    kanbanBtn.classList.add('active');
    analyticsBtn.classList.remove('active');
    kanbanView.classList.remove('hidden');
    analyticsView.classList.add('hidden');
  });

  analyticsBtn?.addEventListener('click', async () => {
    analyticsBtn.classList.add('active');
    kanbanBtn.classList.remove('active');
    analyticsView.classList.remove('hidden');
    kanbanView.classList.add('hidden');
    await renderAnalytics();
  });
}
