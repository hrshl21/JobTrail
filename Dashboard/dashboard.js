/**
 * Dashboard/dashboard.js
 *
 * Entry point for the dashboard page. Initializes all feature modules
 * on DOM ready.
 */

document.addEventListener('DOMContentLoaded', () => {
  renderBoard();
  initDragAndDrop();
  initSearch();
  initFilters();
  initViewToggle();
  initModalEvents();
  initExportImport();
});