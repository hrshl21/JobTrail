/**
 * content/naukri.js
 *
 * Naukri.com content script. Detects when the user clicks an "Apply" button
 * on a Naukri job listing and automatically scrapes and saves the job data.
 *
 * Naukri has multiple apply flows (internal, external, chat apply) so this
 * script uses a broad set of selectors. A MutationObserver and URL polling
 * handle Naukri's SPA-like navigation.
 */
(() => {
  if (window.jtNaukriTrackerLoaded) return;
  window.jtNaukriTrackerLoaded = true;

  const PLATFORM = 'Naukri';
  console.log('[JobTrail] Naukri script loaded');

  function getJobId() {
    const fromPath = window.location.pathname.match(/-(\d{8,})(\?|$)/)?.[1];
    const fromSearch = new URLSearchParams(window.location.search).get('jobId');
    return fromSearch || fromPath || document.querySelector('[data-job-id]')?.dataset?.jobId || null;
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
      { selector: '[class*="styles_jd-header-title"]' },
      { selector: 'h1[class*="styles_"]' },
      { selector: '.jd-header-title' },
      { selector: 'h1' }
    ]) || document.title.split('-')[0].trim();
  }

  function scrapeCompany() {
    return scrapeField('company', [
      { selector: '[class*="styles_jd-header-comp-name"] a' },
      { selector: '[class*="styles_jd-header-comp-name"]' },
      { selector: '.jd-header-comp-name a' },
      { selector: '.jd-header-comp-name' },
      { selector: '[class*="comp-name"] a' },
      { selector: '[class*="comp-name"]' },
      { selector: 'a[href*="/company-details/"]' }
    ]) || 'Unknown Company';
  }

  function scrapeLocation() {
    return scrapeField('location', [
      { selector: '[class*="styles_jhc__location"] a' },
      { selector: '[class*="styles_jhc__location"]' },
      { selector: '.loc-links-wrap a' },
      { selector: '[class*="location"] a' }
    ]);
  }

  function scrapeSalary() {
    return scrapeField('salary', [
      { selector: '[class*="styles_jhc__salary"]', extract: (el) => /(lpa|\u20B9|usd|\$|salary|p\.a\.|ctc|not disclosed)/i.test(el.innerText) ? el.innerText.trim() : null },
      { selector: '.salary-wrap span', extract: (el) => /(lpa|\u20B9|usd|\$|salary|p\.a\.)/i.test(el.innerText) ? el.innerText.trim() : null },
      { selector: '[class*="salary"] span', extract: (el) => /(lpa|\u20B9|usd|\$|salary|p\.a\.)/i.test(el.innerText) ? el.innerText.trim() : null }
    ]);
  }

  function scrapeDescription() {
    const headings = Array.from(document.querySelectorAll('h2, h3, div[class*="styles_heading"], div[class*="heading"], label'));
    for (const heading of headings) {
      if (/^job\s+description$/i.test(heading.innerText?.trim())) {
        const sibling = heading.nextElementSibling;
        if (sibling && sibling.innerText?.trim().length > 50) return sibling.innerHTML;
        const parentSibling = heading.parentElement?.nextElementSibling;
        if (parentSibling && parentSibling.innerText?.trim().length > 50) return parentSibling.innerHTML;
      }
    }
    const specificSelectors = ['[class*="styles_jd-desc-main"]', '[class*="styles_job-desc-container"]', '[class*="styles_jobDescriptionContainer"]', '.job-desc', '#job_jd', '.dang-inner-html'];
    for (const sel of specificSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText?.trim().length > 50) return el.innerHTML;
    }
    return '';
  }

  function scrapePostAge() {
    const raw = scrapeField('post_age', [
      { selector: 'span[class*="posted-day"]' },
      { selector: '.posted-update span' },
      { selector: '.jd-stats span', extract: (el) => (/ago|day|week|month/i.test(el.innerText) ? el.innerText : null) }
    ]);
    if (!raw) return null;
    const match = raw.match(/(\d+)\s*(day|week|month)/i);
    if (!match) return 0;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('day')) return value;
    if (unit.startsWith('week')) return value * 7;
    if (unit.startsWith('month')) return value * 30;
    return null;
  }

  function scrapeApplicantCount() {
    const raw = scrapeField('applicant_count', [
      { selector: 'span[class*="applicant"]' },
      { selector: '.jd-stats span', extract: (el) => (/applicant|applied/i.test(el.innerText) ? el.innerText : null) }
    ]);
    if (!raw) return null;
    const match = raw.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, ''), 10) : null;
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
      jobUrl: window.location.href.split('?')[0],
      source: PLATFORM,
      description: scrapeDescription(),
      location: scrapeLocation() || '',
      salary: scrapeSalary() || '',
      postAgeDays: scrapePostAge(),
      applicantCount: scrapeApplicantCount()
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
      console.error('[JobTrail] Naukri save failed:', error);
      showIndicator('error', 'JobTrail: Could not save job');
    }

    isTracking = false;
    setTimeout(() => { lastTrackedJobId = null; }, 30000);
  }

  const APPLY_SELECTORS = [
    '#apply-button', '.apply-button-container button', 'button[class*="apply-button"]',
    'a[id*="apply"]', '.jd-header .primary-btn', '#company-site-button',
    '[class*="company-site-button"]', 'a[class*="apply-on-company"]',
    'a[href*="apply-on-company-site"]', 'button[class*="applyButton"]',
    '.apply-button-container a', 'button[class*="chatApply"]',
    'button[aria-label*="Apply"]', 'a[aria-label*="Apply"]', 'button[aria-label*="Continue"]'
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
