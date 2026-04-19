/**
 * utils/storage-crud.js
 *
 * Core CRUD operations for the local job database (chrome.storage.local).
 * All job data lives entirely on the user's device. This module handles
 * creating, reading, updating, deleting, and importing jobs.
 *
 * Also handles cross-source duplicate detection via fingerprinting
 * and maintains a status history timeline for each job.
 */

const JobStorage = {

  /**
   * Get all tracked jobs from local storage.
   * @returns {Promise<Object[]>} Array of job objects
   */
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ jobs: [] }, (result) => {
        resolve(result.jobs);
      });
    });
  },

  /**
   * Save a new job to local storage.
   * Checks for exact duplicates (same jobId + source) and cross-source
   * duplicates (same title + company from a different platform).
   *
   * @param {Object} jobData - Scraped job data
   * @returns {Promise<{saved: boolean, reason?: string, crossDuplicate?: Object}>}
   */
  async save(jobData) {
    const jobs = await this.getAll();
    const safeJobId = jobData.jobId || `manual_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Exact duplicate check: same jobId from the same platform
    const existsExact = jobs.find(j => j.jobId === safeJobId && j.source === jobData.source);
    if (existsExact) return { saved: false, reason: 'duplicate_exact' };

    // Cross-source duplicate detection via title+company fingerprint
    const fingerprint = window.ScraperUtils
      ? window.ScraperUtils.generateJobFingerprint(jobData.jobTitle, jobData.company)
      : null;

    let crossDuplicate = null;
    if (fingerprint) {
      crossDuplicate = jobs.find(j => {
        const fp = window.ScraperUtils.generateJobFingerprint(j.jobTitle, j.company);
        return fp === fingerprint && j.source !== jobData.source;
      });
    }

    const newJob = {
      ...jobData,
      jobId: safeJobId,
      fingerprint,
      status: 'Applied',
      appliedAt: Date.now(),
      notes: '',
      ctc: jobData.salary || '',
      resumeVersion: '',
      location: jobData.location || '',
      salary: jobData.salary || '',
      employmentType: jobData.employmentType || '',
      experienceLevel: jobData.experienceLevel || '',
      postAgeDays: jobData.postAgeDays || null,
      applicantCount: jobData.applicantCount || null,
      statusHistory: [{ status: 'Applied', timestamp: Date.now() }]
    };

    jobs.unshift(newJob);
    return new Promise((resolve) => {
      chrome.storage.local.set({ jobs }, () => resolve({
        saved: true,
        crossDuplicate: crossDuplicate
          ? { jobTitle: crossDuplicate.jobTitle, company: crossDuplicate.company, source: crossDuplicate.source }
          : null
      }));
    });
  },

  /**
   * Update fields on an existing job. Tracks status changes in a timeline,
   * supporting both forward progression and rollbacks.
   *
   * @param {string} jobId - The job to update
   * @param {Object} updates - Fields to merge into the job
   * @returns {Promise<boolean>} True if the job was found and updated
   */
  async update(jobId, updates) {
    const jobs = await this.getAll();
    const index = jobs.findIndex(j => j.jobId == jobId);

    if (index !== -1) {
      // Track status changes in the timeline
      if (updates.status && updates.status !== jobs[index].status) {
        let history = jobs[index].statusHistory || [];
        const lastRecordedStatus = history.length > 0 ? history[history.length - 1].status : null;

        if (updates.status !== lastRecordedStatus) {
          const previousIndex = history.findIndex(h => h.status === updates.status);

          if (previousIndex !== -1) {
            // Rolling back to a previous status: truncate timeline to that point
            history = history.slice(0, previousIndex + 1);
          } else {
            // New status: append to timeline
            history.push({ status: updates.status, timestamp: Date.now() });
          }
          updates.statusHistory = history;
        }
      }

      jobs[index] = { ...jobs[index], ...updates };

      return new Promise((resolve) => {
        chrome.storage.local.set({ jobs }, () => resolve(true));
      });
    }
    return false;
  },

  /**
   * Delete a single job by ID.
   * @param {string} jobId - The job to delete
   * @returns {Promise<boolean>}
   */
  async deleteJob(jobId) {
    const jobs = await this.getAll();
    const filtered = jobs.filter(j => j.jobId != jobId);
    return new Promise((resolve) => {
      chrome.storage.local.set({ jobs: filtered }, () => resolve(true));
    });
  },

  /**
   * Delete all tracked jobs.
   * @returns {Promise<boolean>}
   */
  async deleteAll() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ jobs: [] }, () => resolve(true));
    });
  },

  /**
   * Import jobs from a JSON array, skipping duplicates.
   *
   * @param {Object[]} importedJobs - Array of job objects to import
   * @returns {Promise<number>} Count of newly imported jobs
   */
  async importJobs(importedJobs) {
    const existing = await this.getAll();
    const existingIds = new Set(existing.map(j => `${j.jobId}::${j.source}`));
    let imported = 0;
    for (const job of importedJobs) {
      const key = `${job.jobId}::${job.source}`;
      if (!existingIds.has(key)) {
        existing.unshift(job);
        existingIds.add(key);
        imported++;
      }
    }
    return new Promise((resolve) => {
      chrome.storage.local.set({ jobs: existing }, () => resolve(imported));
    });
  }
};

window.JobStorage = JobStorage;
