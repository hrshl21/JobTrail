/**
 * Dashboard/dashboard-drag-drop.js
 *
 * Implements Kanban column drag-and-drop. When a card is dropped into
 * a new column, updates the job status in storage and triggers a board
 * re-render.
 *
 * Dependencies: storage-crud.js, dashboard-board.js (renderBoard)
 */

/**
 * Attach drag-and-drop event listeners to all Kanban column bodies.
 * Handles dragenter/dragover/dragleave for visual feedback and drop
 * for updating the job's status.
 */
function initDragAndDrop() {
  document.querySelectorAll('.column-body').forEach(col => {
    col.addEventListener('dragenter', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('drag-over'); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over'); });
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const jobId = e.dataTransfer.getData('text/plain');
      const newStatus = col.dataset.status;

      if (jobId && newStatus) {
        // Optimistically move the card in the DOM before the async save
        const card = document.querySelector(`[data-id="${jobId}"]`);
        if (card) col.appendChild(card);

        const updates = { status: newStatus };
        if (newStatus === 'Applied') updates.appliedAt = Date.now();
        await window.JobStorage.update(jobId, updates);

        renderBoard();
      }
    });
  });
}
