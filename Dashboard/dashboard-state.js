/**
 * Dashboard/dashboard-state.js
 *
 * Shared mutable state object used across all dashboard modules.
 * Centralized here to avoid circular dependencies between modules.
 */

window.DashboardState = {
  /** Job ID of the currently open modal, or null */
  currentJobId: null,
  /** True while a drag operation is in progress (prevents click-on-drop) */
  isDragging: false,
  /** Active filter chip value: 'all', 'LinkedIn', 'Indeed', 'Naukri' */
  currentFilter: 'all',
  /** Current search query (lowercased), or empty string */
  searchQuery: ''
};
