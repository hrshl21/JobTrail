/**
 * utils/storage-analytics.js
 *
 * Extends window.JobStorage with analytics computation methods.
 * Calculates metrics like source distribution, response rate,
 * and application velocity from local data.
 *
 * Dependencies: storage-crud.js (window.JobStorage must exist)
 */

/**
 * Compute analytics from all locally stored jobs.
 *
 * @returns {Promise<Object>} Analytics data including:
 *   - total: Total tracked jobs
 *   - bySource: Job count per platform
 *   - byStatus: Job count per status (with auto-promote logic)
 *   - weeklyApps: Application count per week for the last 8 weeks
 *   - topCompanies: Top 10 companies by application count
 *   - responseRate: Percentage of jobs that reached Interview or Offer
 *   - avgDaysInPipeline: Average days active jobs have been in the pipeline
 */
window.JobStorage.getAnalytics = async function () {
  const jobs = await this.getAll();
  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;

  // Source distribution (LinkedIn, Indeed, Naukri, etc.)
  const bySource = {};
  jobs.forEach(j => {
    bySource[j.source || 'Unknown'] = (bySource[j.source || 'Unknown'] || 0) + 1;
  });

  // Status distribution with auto-promote: jobs in "Applied" for 7+ days
  // are counted as "Follow-up" for display purposes
  const byStatus = { 'Applied': 0, 'Follow-up': 0, 'Interview': 0, 'Offer': 0, 'Ghosted': 0, 'Rejected': 0 };
  jobs.forEach(j => {
    const daysOld = Math.floor((now - j.appliedAt) / dayMs);
    let displayStatus = j.status;
    if (j.status === 'Applied' && daysOld >= 7) displayStatus = 'Follow-up';
    byStatus[displayStatus] = (byStatus[displayStatus] || 0) + 1;
  });

  // Application velocity: apps per week for the last 8 weeks
  const weeklyApps = [];
  for (let w = 0; w < 8; w++) {
    const weekStart = now - (w + 1) * 7 * dayMs;
    const weekEnd = now - w * 7 * dayMs;
    const count = jobs.filter(j => j.appliedAt >= weekStart && j.appliedAt < weekEnd).length;
    weeklyApps.unshift({ week: w, count });
  }

  // Top companies by number of applications
  const companyMap = {};
  jobs.forEach(j => {
    const name = (j.company || 'Unknown').trim();
    companyMap[name] = (companyMap[name] || 0) + 1;
  });
  const topCompanies = Object.entries(companyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Response rate: percentage of jobs that reached Interview or Offer
  const total = jobs.length;
  const responded = jobs.filter(j => ['Interview', 'Offer'].includes(j.status)).length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  // Average days active jobs have been sitting in the pipeline
  const activePipeline = jobs.filter(j => !['Ghosted', 'Rejected'].includes(j.status));
  const avgDaysInPipeline = activePipeline.length > 0
    ? Math.round(activePipeline.reduce((sum, j) => sum + Math.floor((now - j.appliedAt) / dayMs), 0) / activePipeline.length)
    : 0;

  return { total, bySource, byStatus, weeklyApps, topCompanies, responseRate, avgDaysInPipeline };
};
