/**
 * content/indeed.js
 *
 * Indeed content script. Detects when the user clicks an "Apply" button
 * on an Indeed job listing and automatically scrapes and saves the job data.
 *
 * Uses a WeakSet-based listener approach to dynamically attach click handlers
 * to apply buttons as they appear in the DOM (Indeed's UI is highly dynamic).
 */
(() => {
  if (window.jtIndeedTrackerLoaded) return;
  window.jtIndeedTrackerLoaded = true;

  const PLATFORM = 'Indeed';
  console.log('[JobTrail] Indeed script loaded');

  function getJobId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('vjk') || params.get('jk') ||
      window.location.pathname.match(/jk=([a-z0-9]+)/i)?.[1] ||
      document.querySelector('[data-jk]')?.dataset?.jk || null;
  }

  function scrapeField(fieldName, selectors) {
    for (let i = 0; i < selectors.length; i++) {
      const { selector, extract } = selectors[i];
      try {
        const el = document.querySelector(selector);
        if (!el) continue;
        const value = extract ? extract(el) : el.innerText?.trim();
        if (value) return value;
      } catch (err) {
        console.warn(`[JobTrail] Scrape failed for ${fieldName}:`, err.message);
      }
    }
    return null;
  }

  function scrapeJobTitle() {
    return scrapeField('job_title', [
      { selector: '.jobsearch-JobInfoHeader-title span:first-child' },
      { selector: '.jobsearch-JobInfoHeader-title' },
      { selector: '[class*="jobTitle"] h1' },
      { selector: 'h1' }
    ]) || document.title.split('|')[0].split('-')[0].trim();
  }

  function scrapeCompany() {
    return scrapeField('company', [
      { selector: '[data-testid="inlineHeader-companyName"] a' },
      { selector: '[data-testid="inlineHeader-companyName"]' },
      { selector: '[data-company-name="true"] a' },
      { selector: '[data-company-name="true"]' },
      { selector: '[data-company-name]', extract: (el) => el.dataset.companyName !== 'true' ? el.dataset.companyName : null },
      { selector: '[class*="companyName"] a' },
      { selector: '[class*="companyName"]' },
      { selector: 'a[data-tn-element="companyName"]' }
    ]) || 'Unknown Company';
  }

  function scrapeLocation() {
    return scrapeField('location', [
      { selector: '[data-testid="job-location"]' },
      { selector: '[class*="companyLocation"]' }
    ]);
  }

  function scrapeSalary() {
    return scrapeField('salary', [
      { selector: '[id*="salaryInfoAndJobType"] span:first-child' },
      { selector: '[class*="salary"]' },
      { selector: '[data-testid="attribute_snippet_testid"]', extract: (el) => (/[\$]|lpa|salary|per\b/i.test(el.innerText) ? el.innerText.trim() : null) }
    ]);
  }

  function scrapeDescription() {
    return scrapeField('description', [
      { selector: '#jobDescriptionText', extract: (el) => el.innerHTML },
      { selector: '.jobsearch-jobDescriptionText', extract: (el) => el.innerHTML }
    ]) || '';
  }

  function scrapePostAge() {
    const raw = scrapeField('post_age', [
      { selector: '[data-testid="myJobsStateDate"]' },
      { selector: 'span[class*="PostedDate"]' },
      { selector: 'span.date' }
    ]);
    if (!raw) return null;
    if (/just\s*posted|today/i.test(raw)) return 0;
    const match = raw.match(/(\d+)\s*(day|week|month)/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('day')) return value;
    if (unit.startsWith('week')) return value * 7;
    if (unit.startsWith('month')) return value * 30;
    return null;
  }

  function showIndicator(status, label) {
    let pill = document.getElementById('jt-indicator');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'jt-indicator';
      pill.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:999999;padding:8px 14px;border-radius:20px;font-size:13px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.25);transition:opacity 0.4s ease;pointer-events:none;';
      document.body.appendChild(pill);
    }
    const colors = { success: '#10b981', info: '#3b82f6', warning: '#f59e0b', error: '#ef4444' };
    pill.style.background = colors[status] || '#3b82f6';
    pill.textContent = label;
    pill.style.opacity = '1';
    setTimeout(() => { pill.style.opacity = '0'; }, 3500);
  }

  let lastTrackedJobId = null;
  let isTracking = false;

  async function handleApplyClick() {
    const jobId = getJobId();
    if (!jobId || jobId === lastTrackedJobId || isTracking) return;

    isTracking = true;
    lastTrackedJobId = jobId;

    const jobData = {
      jobId,
      jobTitle: scrapeJobTitle() || 'Unknown Role',
      company: scrapeCompany(),
      jobUrl: `https://www.indeed.com/viewjob?jk=${jobId}`,
      source: PLATFORM,
      description: scrapeDescription(),
      location: scrapeLocation() || '',
      salary: scrapeSalary() || '',
      postAgeDays: scrapePostAge(),
      applicantCount: null
    };

    try {
      if (!window.JobStorage) throw new Error('JobStorage not available');
      const result = await window.JobStorage.save(jobData);
      if (result.saved) {
        showIndicator('success', `Tracked: ${jobData.jobTitle}`);
        if (result.crossDuplicate) {
          setTimeout(() => showIndicator('warning', `Also tracked from ${result.crossDuplicate.source}`), 4000);
        }
      } else {
        showIndicator('info', `Already tracking: ${jobData.jobTitle}`);
      }
    } catch (error) {
      console.error('[JobTrail] Indeed save failed:', error);
      showIndicator('error', 'JobTrail: Could not save job');
    }

    isTracking = false;
    setTimeout(() => { lastTrackedJobId = null; }, 30000);
  }

  const APPLY_SELECTORS = [
    '#indeedApplyButton', '.jobsearch-IndeedApplyButton-buttonWrapper button',
    '[class*="indeed-apply-button"]', '#applyButtonLinkContainer a',
    '#applyButtonLinkContainer button', 'a[class*="apply-button"]',
    'button[class*="apply-button"]', 'a[aria-label*="Apply"]',
    'button[aria-label*="Apply"]', '[id^="apply-button-"]'
  ];

  const listenedButtons = new WeakSet();

  function attachListeners() {
    APPLY_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((btn) => {
        if (listenedButtons.has(btn)) return;
        listenedButtons.add(btn);
        btn.addEventListener('click', handleApplyClick, { capture: true });
      });
    });
  }

  const observer = new MutationObserver(attachListeners);
  observer.observe(document.body, { childList: true, subtree: true });

  let currentUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      lastTrackedJobId = null;
      setTimeout(attachListeners, 800);
    }
  }, 500);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(attachListeners, 800));
  } else {
    setTimeout(attachListeners, 800);
  }
})();
