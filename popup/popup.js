/**
 * popup/popup.js
 *
 * Entry point for the extension popup. Renders the triage action center
 * and wires up navigation buttons to open the full dashboard.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Render the priority action list (follow-ups, interviews, etc.)
  await renderTriageCenter();

  // Both buttons (header icon + footer button) open the dashboard in a new tab
  const openDashboard = () => chrome.tabs.create({ url: chrome.runtime.getURL('Dashboard/dashboard.html') });
  document.getElementById('top-dash-btn')?.addEventListener('click', openDashboard);
  document.getElementById('bottom-dash-btn')?.addEventListener('click', openDashboard);
});