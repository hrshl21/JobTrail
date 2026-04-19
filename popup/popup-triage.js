/**
 * popup/popup-triage.js
 *
 * Renders the triage action center in the popup. Displays up to 5 jobs
 * that need immediate attention (follow-ups, interviews, offers) and
 * a summary strip with counts.
 *
 * Dependencies: storage-crud.js (window.JobStorage)
 */

/**
 * Strip rating artifacts (e.g. "4.2", "1.2K Reviews") from company names
 * that get accidentally scraped from job site DOM.
 *
 * @param {string} rawName - Company name as scraped from the page
 * @returns {string} Cleaned company name
 */
function sanitizeCompanyName(rawName) {
  if (!rawName) return 'Unknown Company';
  return rawName
    .replace(/[0-9.,kK+]+\s*Reviews?/gi, '')
    .replace(/[0-9]\.[0-9]/g, '')
    .replace(/\u2B50/g, '')
    .replace(/-\s*$/, '')
    .trim();
}

/**
 * Fetch all tracked jobs, compute which ones need attention, and render
 * them as triage cards in the popup list. Also updates the summary strip
 * with follow-up / interview counts.
 */
async function renderTriageCenter() {
  const jobs = await window.JobStorage.getAll();
  const triageList = document.getElementById('triage-list');
  const summaryText = document.getElementById('summary-text');
  if (!triageList || !summaryText) return;

  let actionRequired = [];
  let followUpCount = 0;
  let prepCount = 0;

  jobs.forEach(job => {
    const daysOld = Math.floor((Date.now() - job.appliedAt) / (1000 * 60 * 60 * 24));

    // Auto-promote "Applied" jobs older than 7 days to "Follow-up" status
    job.calculatedStatus = (job.status === 'Applied' && daysOld >= 7) ? 'Follow-up' : job.status;

    if (job.calculatedStatus === 'Follow-up') {
      followUpCount++;
      job.intentClass = 'dot-urgent';
      job.intentWeight = 3;
      actionRequired.push(job);
    } else if (job.calculatedStatus === 'Interview' || job.calculatedStatus === 'Offer') {
      prepCount++;
      job.intentClass = job.calculatedStatus === 'Offer' ? 'dot-win' : 'dot-prep';
      job.intentWeight = 2;
      actionRequired.push(job);
    }
  });

  // Sort by urgency (highest weight first), then by oldest first within same weight
  actionRequired.sort((a, b) =>
    b.intentWeight !== a.intentWeight ? b.intentWeight - a.intentWeight : a.appliedAt - b.appliedAt
  );

  // Build summary text
  const parts = [];
  if (followUpCount > 0) parts.push(`${followUpCount} Follow-ups`);
  if (prepCount > 0) parts.push(`${prepCount} Interviews/Offers`);
  summaryText.textContent = parts.length > 0 ? parts.join(' \u2022 ') : 'Pipeline Active \u2022 No urgent actions';

  triageList.innerHTML = '';

  // Show empty state if nothing needs attention
  if (actionRequired.length === 0) {
    triageList.innerHTML = `
      <div class="zero-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <div>You're all caught up!</div>
      </div>
    `;
    return;
  }

  // Render top 5 action items as triage cards
  actionRequired.slice(0, 5).forEach(job => {
    const cleanCompany = sanitizeCompanyName(job.company);
    const safeTitle = (job.jobTitle === 'Indeed' || job.jobTitle === 'Naukri') ? 'Unknown Role' : job.jobTitle;

    const card = document.createElement('div');
    card.className = 'triage-card';

    card.innerHTML = `
      <div class="card-row">
        <h4 class="job-title" title="${safeTitle}">${safeTitle}</h4>
        <div class="intent-dot ${job.intentClass}"></div>
      </div>
      <div class="card-row">
        <span class="company">${cleanCompany}</span>
        ${job.source ? `<span class="source-badge">${job.source}</span>` : ''}
      </div>
    `;

    card.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('Dashboard/dashboard.html') });
    });

    triageList.appendChild(card);
  });
}
