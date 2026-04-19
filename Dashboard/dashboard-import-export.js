/**
 * Dashboard/dashboard-import-export.js
 *
 * JSON export and import of job data. Export downloads all jobs as a
 * timestamped JSON file. Import reads a JSON file, deduplicates against
 * existing jobs, and merges new ones into storage.
 *
 * Dependencies: storage-crud.js, dashboard-board.js (renderBoard)
 */

/** Wire up the export and import buttons. */
function initExportImport() {
  // Export all jobs as a JSON file download
  document.getElementById('export-btn')?.addEventListener('click', async () => {
    const jobs = await window.JobStorage.getAll();
    const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JobTrail_Export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Trigger hidden file input when import button is clicked
  document.getElementById('import-btn')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });

  // Handle the selected import file
  document.getElementById('import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const importedJobs = JSON.parse(text);
      if (!Array.isArray(importedJobs)) throw new Error('Invalid format: expected a JSON array');
      const count = await window.JobStorage.importJobs(importedJobs);
      alert(`Successfully imported ${count} new job(s).`);
      renderBoard();
    } catch (err) {
      console.error('[JobTrail] Import error:', err);
      alert('Failed to import jobs: ' + err.message);
    }
    // Reset the file input so the same file can be re-imported
    e.target.value = '';
  });
}
