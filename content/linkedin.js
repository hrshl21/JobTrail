/**
 * content/linkedin.js
 *
 * LinkedIn content script. Detects when the user clicks an "Apply" button
 * on a LinkedIn job listing and automatically scrapes and saves the job
 * data. Uses three independent detection methods:
 *
 * 1. Delegated click listener on known Apply button selectors
 * 2. Text-based detection (walking up DOM to find buttons with "Apply" text)
 * 3. MutationObserver watching for LinkedIn's "Did you finish applying?" dialog
 *
 * Also includes a URL change watcher to reset state when navigating between jobs
 * (LinkedIn is an SPA, so page loads don't trigger new script injection).
 */
(() => {
  if (window.jtLinkedInTrackerLoaded) return;
  window.jtLinkedInTrackerLoaded = true;

  const PLATFORM = 'LinkedIn';
  console.log('[JobTrail] LinkedIn script loaded');

  // -- Job ID Extraction --

  /**
   * Extract the LinkedIn job ID from the current URL or DOM.
   * @returns {string|null} Job ID or null
   */
  function getJobId() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('currentJobId')) return params.get('currentJobId');

    const fromPath = window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
    if (fromPath) return fromPath;

    if (params.get('selectedJobId')) return params.get('selectedJobId');

    const fromDom = document.querySelector('[data-job-id]')?.dataset?.jobId
      || document.querySelector('[data-occludable-job-id]')?.dataset?.occludableJobId;
    if (fromDom) return fromDom;

    return null;
  }

  // -- Field Scraping --

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
      { selector: '.job-details-jobs-unified-top-card__job-title h1' },
      { selector: '.job-details-jobs-unified-top-card__job-title a' },
      { selector: '.job-details-jobs-unified-top-card__job-title' },
      { selector: '.jobs-unified-top-card__job-title h1' },
      { selector: '.jobs-unified-top-card__job-title' },
      { selector: 'h1.t-24' },
      { selector: 'h1' }
    ]) || document.title.split('|')[0].split('-')[0].trim();
  }

  function scrapeCompany() {
    return scrapeField('company', [
      { selector: '.job-details-jobs-unified-top-card__company-name a' },
      { selector: '.job-details-jobs-unified-top-card__company-name' },
      { selector: '[class*="jobs-unified-top-card"] [class*="company-name"] a' },
      { selector: '[class*="jobs-unified-top-card"] [class*="company-name"]' },
      { selector: '[class*="job-details-jobs-unified-top-card"] a[href*="/company/"]' },
      {
        selector: 'a[href*="/company/"]',
        extract: (el) => {
          const text = el.innerText?.trim();
          return (text && text.length > 1 && text.length < 80) ? text : null;
        }
      }
    ]) || 'Unknown Company';
  }

  function scrapeLocation() {
    return scrapeField('location', [
      {
        selector: '.job-details-jobs-unified-top-card__bullet',
        extract: (el) => {
          const raw = el.innerText?.trim() || '';
          const loc = raw.split('\u00B7')[0].trim().replace(/^[\s\p{Emoji}]+/u, '').trim();
          return loc.length > 1 ? loc : null;
        }
      },
      { selector: '.job-details-jobs-unified-top-card__primary-description-container span[class*="location"]' },
      {
        selector: '[class*="jobs-unified-top-card"] .t-black--light span',
        extract: (el) => {
          const raw = el.innerText?.trim() || '';
          const loc = raw.split('\u00B7')[0].trim();
          return loc.length > 1 ? loc : null;
        }
      }
    ]);
  }

  function scrapeSalary() {
    return scrapeField('salary', [
      { selector: '.salary-main-rail__data-body' },
      { selector: '.compensation__salary' }
    ]);
  }

  function cleanDescriptionEl(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('[data-testid="expandable-text-button"]').forEach(btn => btn.remove());
    return clone.innerHTML;
  }

  function scrapeDescription() {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const aboutJobH2 = h2s.find(h => /about the job/i.test(h.innerText || ''));
    if (aboutJobH2) {
      const section = aboutJobH2.closest('[data-sdui-component]') || aboutJobH2.closest('div');
      const box = section?.querySelector('[data-testid="expandable-text-box"]');
      if (box && box.innerText?.trim().length > 50) return cleanDescriptionEl(box);
    }

    const allBoxes = document.querySelectorAll('[data-testid="expandable-text-box"]');
    for (const box of allBoxes) {
      if (box.innerText?.trim().length > 200) return cleanDescriptionEl(box);
    }

    return scrapeField('description', [
      { selector: '#job-details', extract: (el) => el.innerHTML },
      { selector: '.jobs-description__content', extract: (el) => el.innerHTML },
      { selector: '.jobs-description', extract: (el) => el.innerHTML },
      { selector: '[class*="jobs-description"]', extract: (el) => el.innerHTML },
      { selector: '.job-view-layout [class*="description"]', extract: (el) => el.innerHTML }
    ]) || '';
  }

  function scrapePostAge() {
    const raw = scrapeField('post_age', [
      { selector: '.jobs-unified-top-card__posted-date' },
      { selector: 'span[class*="posted-time-ago"]' }
    ]);
    if (!raw) return null;
    if (/just\s*now|today/i.test(raw)) return 0;
    const match = raw.match(/(\d+)\s*(hour|day|week|month)/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('hour')) return 0;
    if (unit.startsWith('day')) return value;
    if (unit.startsWith('week')) return value * 7;
    if (unit.startsWith('month')) return value * 30;
    return null;
  }

  function scrapeApplicantCount() {
    const raw = scrapeField('applicant_count', [
      { selector: '.jobs-unified-top-card__applicant-count' },
      { selector: 'span[class*="num-applicants"]' },
      {
        selector: '.job-details-jobs-unified-top-card__bullet',
        extract: (el) => (/applicant/i.test(el.innerText) ? el.innerText : null)
      }
    ]);
    if (!raw) return null;
    const match = raw.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, ''), 10) : null;
  }

  // -- Status Indicator --

  function showIndicator(status, label) {
    let pill = document.getElementById('jt-indicator');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'jt-indicator';
      pill.style.cssText = `
        position: fixed; bottom: 16px; right: 16px; z-index: 999999;
        padding: 8px 14px; border-radius: 20px; font-size: 13px;
        font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        transition: opacity 0.4s ease; pointer-events: none;
      `;
      document.body.appendChild(pill);
    }
    const colors = { success: '#10b981', info: '#3b82f6', warning: '#f59e0b', error: '#ef4444' };
    pill.style.background = colors[status] || '#3b82f6';
    pill.textContent = label;
    pill.style.opacity = '1';
    setTimeout(() => { pill.style.opacity = '0'; }, 3500);
  }

  // -- Core Tracking Logic --

  let lastTrackedJobId = null;
  let isTracking = false;

  async function handleApplyClick() {
    const jobId = getJobId();
    if (!jobId) { console.warn('[JobTrail] No jobId found'); return; }
    if (jobId === lastTrackedJobId) return;
    if (isTracking) return;

    isTracking = true;
    lastTrackedJobId = jobId;

    const jobData = {
      jobId,
      jobTitle: scrapeJobTitle() || 'Unknown Role',
      company: scrapeCompany(),
      jobUrl: `https://www.linkedin.com/jobs/view/${jobId}/`,
      source: PLATFORM,
      description: scrapeDescription(),
      location: scrapeLocation() || '',
      salary: scrapeSalary() || '',
      postAgeDays: scrapePostAge(),
      applicantCount: scrapeApplicantCount()
    };

    function retryDescription(delayMs) {
      setTimeout(() => {
        const desc = scrapeDescription();
        if (desc && desc.length > 100) {
          window.JobStorage?.update(jobId, { description: desc }).catch(() => {});
        }
      }, delayMs);
    }

    try {
      if (!window.JobStorage) throw new Error('JobStorage not available');
      const result = await window.JobStorage.save(jobData);

      if (result.saved) {
        showIndicator('success', `Tracked: ${jobData.jobTitle}`);
        retryDescription(2000);
        retryDescription(5000);
        if (result.crossDuplicate) {
          setTimeout(() => showIndicator('warning', `Also tracked from ${result.crossDuplicate.source}`), 4000);
        }
      } else {
        showIndicator('info', `Already tracking: ${jobData.jobTitle}`);
        retryDescription(2000);
      }
    } catch (error) {
      console.error('[JobTrail] Save failed:', error);
      showIndicator('error', 'JobTrail: Could not save job');
    }

    isTracking = false;
    setTimeout(() => { lastTrackedJobId = null; }, 30000);
  }

  // -- Apply Detection --

  const APPLY_SELECTORS = [
    '#jobs-apply-button-id',
    '[data-live-test-job-apply-button]',
    '.jobs-apply-button',
    '[class*="jobs-apply-button"]',
    '.jobs-apply-button--top-card',
    'button[data-job-id]',
    'button[aria-label*="Apply"]',
    'button[aria-label*="Continue"]',
    'a[aria-label*="Apply"]'
  ].join(',');

  const APPLY_EXCLUDE = /see more|similar|follow|save|share|learn|premium|undo|alert|set alert|interested/i;

  document.addEventListener('click', (e) => {
    try {
      if (e.target.closest(APPLY_SELECTORS)) {
        handleApplyClick();
        return;
      }
    } catch (_) {}

    let el = e.target;
    for (let i = 0; el && i < 8; i++, el = el.parentElement) {
      if (el.tagName !== 'A' && el.tagName !== 'BUTTON') continue;
      const text = (el.innerText || '').trim();
      if (text.length < 30 && /\bapply\b/i.test(text) && !APPLY_EXCLUDE.test(text)) {
        handleApplyClick();
        return;
      }
    }
  }, { capture: true });

  // -- "Did you finish applying?" dialog watcher --

  let lastDialogDetectTime = 0;
  const applyDialogObserver = new MutationObserver(() => {
    if (Date.now() - lastDialogDetectTime < 5000) return;
    if (/did you finish applying/i.test(document.body.innerText || '')) {
      lastDialogDetectTime = Date.now();
      handleApplyClick();
    }
  });
  applyDialogObserver.observe(document.body, { childList: true, subtree: true });

  // -- URL Change Watcher --

  let currentUrl = window.location.href;
  let currentJobId = getJobId();

  function onJobChange() {
    const newJobId = getJobId();
    if (newJobId !== currentJobId) {
      currentJobId = newJobId;
      lastTrackedJobId = null;
      isTracking = false;
      lastDialogDetectTime = 0;
    }
  }

  setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      onJobChange();
    }
  }, 500);

  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      onJobChange();
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });
})();
