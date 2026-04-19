/**
 * utils/scraper-utils.js
 *
 * Shared scraping utilities used by all platform-specific content scripts.
 * Provides a multi-strategy CSS selector engine that tries multiple paths
 * to extract data, making the extension resilient to website UI changes.
 *
 * Also includes parsers for post age, applicant counts, salary, and
 * employment type, plus a toast notification system and job fingerprinting.
 */

const ScraperUtils = {

  /**
   * Try multiple CSS selectors to extract a single field value.
   * Falls through strategies in order until one succeeds.
   *
   * @param {Array<{selector: string, extract?: function}>} strategies
   *   Each strategy has a CSS selector and an optional extract function.
   *   If extract is omitted, innerText.trim() is used.
   * @returns {string|null} The first successfully extracted value, or null
   */
  scrapeField(strategies) {
    for (const s of strategies) {
      try {
        const el = document.querySelector(s.selector);
        if (el) {
          const value = s.extract ? s.extract(el) : el.innerText.trim();
          if (value && value.length > 0) return value;
        }
      } catch (_) { /* skip broken selector */ }
    }
    return null;
  },

  /**
   * Like scrapeField, but returns an array of all matched values
   * from the first successful strategy.
   *
   * @param {Array<{selector: string, extract?: function}>} strategies
   * @returns {string[]} Array of extracted values, or empty array
   */
  scrapeFieldAll(strategies) {
    for (const s of strategies) {
      try {
        const els = document.querySelectorAll(s.selector);
        if (els.length > 0) {
          return Array.from(els).map(el =>
            s.extract ? s.extract(el) : el.innerText.trim()
          ).filter(v => v && v.length > 0);
        }
      } catch (_) { /* skip */ }
    }
    return [];
  },

  /**
   * Parse a human-readable "posted X ago" string into days.
   * Handles formats like "2 days ago", "3 weeks ago", "Just now", etc.
   *
   * @param {string} text - Raw post age text from the page
   * @returns {number|null} Number of days, or null if unparseable
   */
  parsePostAge(text) {
    if (!text) return null;
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    if (/just\s*(now|posted)|today|moments?\s*ago/i.test(clean)) return 0;
    if (/yesterday/i.test(clean)) return 1;

    const hours = clean.match(/(\d+)\s*hours?\s*ago/);
    if (hours) return 0;

    const days = clean.match(/(\d+)\s*days?\s*ago/);
    if (days) return parseInt(days[1], 10);

    const weeks = clean.match(/(\d+)\s*weeks?\s*ago/);
    if (weeks) return parseInt(weeks[1], 10) * 7;

    const months = clean.match(/(\d+)\s*months?\s*ago/);
    if (months) return parseInt(months[1], 10) * 30;

    const daysPlus = clean.match(/(\d+)\+?\s*days/);
    if (daysPlus) return parseInt(daysPlus[1], 10);

    // Fallback: try parsing as a date string
    try {
      const parsed = new Date(text.trim());
      if (!isNaN(parsed.getTime())) {
        const diffMs = Date.now() - parsed.getTime();
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
    } catch (_) { }

    return null;
  },

  /**
   * Parse applicant count from various formats.
   * Handles "Over 200", "150 applicants", "Be among the first 25", etc.
   *
   * @param {string} text - Raw applicant text from the page
   * @returns {number|null} Parsed count, or null if unparseable
   */
  parseApplicantCount(text) {
    if (!text) return null;
    const clean = text.toLowerCase().replace(/,/g, '');

    const over = clean.match(/over\s*(\d+)/);
    if (over) return parseInt(over[1], 10);

    const exact = clean.match(/(\d+)\s*applicants?/);
    if (exact) return parseInt(exact[1], 10);

    const first = clean.match(/first\s*(\d+)/);
    if (first) return Math.floor(parseInt(first[1], 10) / 2);

    const numOnly = clean.match(/(\d+)/);
    if (numOnly) return parseInt(numOnly[1], 10);

    return null;
  },

  /**
   * Strip review ratings, stars, and other noise from scraped company names.
   *
   * @param {string} rawName - Company name as scraped
   * @returns {string} Cleaned company name
   */
  sanitizeCompanyName(rawName) {
    if (!rawName) return 'Unknown Company';
    return rawName
      .replace(/[0-9.,kK+]+\s*Reviews?/gi, '')
      .replace(/\d+\.\d+/g, '')
      .replace(/\u2B50/g, '')
      .replace(/-\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Unknown Company';
  },

  /**
   * Generate a fingerprint for cross-source duplicate detection.
   * Two jobs from different platforms with the same title + company
   * will produce the same fingerprint.
   *
   * @param {string} title - Job title
   * @param {string} company - Company name
   * @returns {string} Normalized fingerprint string
   */
  generateJobFingerprint(title, company) {
    const normalize = (str) => (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/\s+/g, '');
    return `${normalize(title)}::${normalize(company)}`;
  },

  /**
   * Validate and clean a salary string.
   * Returns null if the text doesn't look like compensation data.
   *
   * @param {string} text - Raw salary text
   * @returns {string|null} Cleaned salary string, or null
   */
  parseSalary(text) {
    if (!text) return null;
    const clean = text.trim();
    if (clean.length < 3 || clean.length > 100) return null;
    if (/[\$\u20B9\u20AC\u00A3]|lpa|lac|lakh|crore|per\s*(year|month|annum|hour)|salary|ctc|compensation/i.test(clean)) {
      return clean.replace(/\s+/g, ' ').trim();
    }
    return null;
  },

  /**
   * Extract employment type from a text string.
   *
   * @param {string} text - Text that may contain employment type
   * @returns {string|null} Normalized type (e.g. 'Full-time'), or null
   */
  parseEmploymentType(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    if (/\bfull[\s-]?time\b/.test(lower)) return 'Full-time';
    if (/\bpart[\s-]?time\b/.test(lower)) return 'Part-time';
    if (/\bcontract\b/.test(lower)) return 'Contract';
    if (/\binternship?\b/.test(lower)) return 'Internship';
    if (/\bfreelance\b/.test(lower)) return 'Freelance';
    if (/\btemporary\b/.test(lower)) return 'Temporary';
    return null;
  },

  /**
   * Show a floating toast notification on the current page.
   * Used to confirm job tracking, warn about duplicates, etc.
   *
   * @param {string} message - Notification text
   * @param {'info'|'success'|'warning'|'error'} type - Visual style
   * @param {number} durationMs - How long to show the toast
   */
  showToast(message, type = 'info', durationMs = 4000) {
    const existing = document.getElementById('jt-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'jt-toast';
    toast.className = `jt-toast jt-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('jt-toast-visible'));

    setTimeout(() => {
      toast.classList.remove('jt-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, durationMs);
  }
};

window.ScraperUtils = ScraperUtils;