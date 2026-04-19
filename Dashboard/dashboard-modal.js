/**
 * Dashboard/dashboard-modal.js
 *
 * Job detail modal: displays full job information, status timeline,
 * editable notes/CTC/resume fields, an AI context copy button,
 * and a two-click delete confirmation.
 *
 * Also defines sanitizeCompanyName which is shared with dashboard-board.js.
 *
 * Dependencies: dashboard-state.js, storage-crud.js, dashboard-board.js
 */

/**
 * Strip rating artifacts from scraped company names.
 * @param {string} rawName
 * @returns {string}
 */
function sanitizeCompanyName(rawName) {
  if (!rawName) return 'Unknown Company';
  return rawName
    .replace(/[0-9.,kK+]+\s*Reviews?/gi, '')
    .replace(/[0-9]\.[0-9]/g, '')
    .replace(/\u2B50/g, '')
    .replace(/-\s*$/, '')
    .trim() || 'Unknown Company';
}

/**
 * Open the job detail modal and populate it with the given job's data.
 * @param {Object} job - The full job object from storage
 */
function openModal(job) {
  window.DashboardState.currentJobId = job.jobId;

  document.getElementById('modal-title').textContent = job.jobTitle;
  document.getElementById('modal-company').textContent = sanitizeCompanyName(job.company);
  document.getElementById('modal-url').href = job.jobUrl;
  document.getElementById('modal-description').innerHTML = job.description || '<i style="color:#94a3b8">No description saved.</i>';

  document.getElementById('modal-ctc').value = job.ctc || '';
  document.getElementById('modal-resume').value = job.resumeVersion || '';
  document.getElementById('modal-notes').value = job.notes || '';

  // Meta tags (source, location, salary, etc.)
  const metaTags = document.getElementById('modal-meta-tags');
  const tags = [];
  if (job.source) tags.push(`<span class="meta-tag">${job.source}</span>`);
  if (job.location) tags.push(`<span class="meta-tag">${job.location}</span>`);
  if (job.salary) tags.push(`<span class="meta-tag">${job.salary}</span>`);
  if (job.employmentType) tags.push(`<span class="meta-tag">${job.employmentType}</span>`);
  if (job.experienceLevel) tags.push(`<span class="meta-tag">${job.experienceLevel}</span>`);
  if (metaTags) metaTags.innerHTML = tags.join('');

  renderTimeline(job);
  document.getElementById('job-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('job-modal').classList.add('hidden');
  window.DashboardState.currentJobId = null;
}

function renderTimeline(job) {
  const container = document.getElementById('modal-timeline');
  if (!container) return;

  const rawHistory = job.statusHistory || [{ status: job.status, timestamp: job.appliedAt }];
  const history = rawHistory.filter((entry, i, arr) => i === 0 || entry.status !== arr[i - 1].status);

  container.innerHTML = history.map((entry, i) => {
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const isLast = i === history.length - 1;
    return `
      <div class="timeline-item ${isLast ? 'timeline-current' : ''}">
        <div class="timeline-dot"></div>
        ${!isLast ? '<div class="timeline-line"></div>' : ''}
        <div class="timeline-content">
          <span class="timeline-status">${entry.status}</span>
          <span class="timeline-date">${dateStr} \u2022 ${timeStr}</span>
        </div>
      </div>
    `;
  }).join('');
}

function initModalEvents() {
  document.getElementById('close-modal')?.addEventListener('click', closeModal);
  document.getElementById('job-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'job-modal') closeModal();
  });

  // Save Notes
  document.getElementById('save-notes-btn')?.addEventListener('click', async () => {
    const { currentJobId } = window.DashboardState;
    if (!currentJobId) return;
    const btn = document.getElementById('save-notes-btn');
    const ctc = document.getElementById('modal-ctc')?.value || '';
    const notes = document.getElementById('modal-notes')?.value || '';
    const resumeVersion = document.getElementById('modal-resume')?.value || '';

    if (btn) { btn.textContent = 'Saving...'; btn.style.opacity = '0.7'; }
    await window.JobStorage.update(currentJobId, { ctc, notes, resumeVersion });

    if (btn) {
      btn.style.opacity = '1';
      btn.innerHTML = `<span>Saved!</span>`;
      setTimeout(() => {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Updates`;
      }, 2000);
    }
    renderBoard();
  });

  // AI Context Copy
  document.getElementById('llm-copy-btn')?.addEventListener('click', async () => {
    const { currentJobId } = window.DashboardState;
    if (!currentJobId) return;
    const jobs = await window.JobStorage.getAll();
    const job = jobs.find(j => j.jobId === currentJobId);
    if (!job) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = job.description || 'No description available.';
    const cleanDescription = tempDiv.innerText.trim();

    const ctc = document.getElementById('modal-ctc')?.value || job.ctc || 'Not specified';
    const notes = document.getElementById('modal-notes')?.value || job.notes || 'No specific notes yet.';
    const resumeVersion = document.getElementById('modal-resume')?.value || job.resumeVersion || 'Not specified';

    const promptText = `I am preparing for an application/interview. Please analyze the following job description and my notes, and help me tailor a cover letter and anticipate interview questions.

  --- JOB DETAILS ---
  Role: ${job.jobTitle}
  Company: ${job.company}
  Location: ${job.location || 'Not specified'}
  Salary: ${job.salary || ctc || 'Not specified'}
  Source: ${job.source}
  Resume Version Used: ${resumeVersion}

  --- MY NOTES ---
  ${notes}

  --- JOB DESCRIPTION ---
  ${cleanDescription}`;

    try {
      await navigator.clipboard.writeText(promptText);
      const btn = document.getElementById('llm-copy-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span>Copied to Clipboard</span>`;
      btn.style.background = 'rgba(16, 185, 129, 0.15)';
      btn.style.color = '#10b981';
      btn.style.borderColor = '#10b981';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }, 2500);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = promptText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
  });

  // Delete Job (two-click confirmation)
  let deleteConfirmPending = false;
  let deleteConfirmTimer = null;

  document.getElementById('delete-job-btn')?.addEventListener('click', async () => {
    const { currentJobId } = window.DashboardState;
    if (!currentJobId) return;
    const btn = document.getElementById('delete-job-btn');

    if (!deleteConfirmPending) {
      deleteConfirmPending = true;
      const original = btn.innerHTML;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Click again to confirm`;
      btn.style.borderColor = 'rgba(239, 68, 68, 0.8)';
      btn.style.background = 'rgba(239, 68, 68, 0.12)';
      deleteConfirmTimer = setTimeout(() => {
        deleteConfirmPending = false;
        btn.innerHTML = original;
        btn.style.borderColor = '';
        btn.style.background = '';
      }, 3000);
    } else {
      clearTimeout(deleteConfirmTimer);
      deleteConfirmPending = false;
      await window.JobStorage.deleteJob(currentJobId);
      closeModal();
      renderBoard();
    }
  });
}
