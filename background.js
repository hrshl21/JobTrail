/**
 * background.js
 *
 * Manifest V3 service worker. Handles:
 * - Extension installation and storage initialization
 * - Follow-up reminder alarms (every 12 hours)
 * - Desktop notifications for jobs needing attention
 */

// -- Extension Install / Update --

chrome.runtime.onInstalled.addListener(() => {
  console.log('JobTrail Extension Installed!');

  // Initialize empty job storage if it doesn't already exist
  chrome.storage.local.get({ jobs: [] }, (result) => {
    if (!result.jobs) {
      chrome.storage.local.set({ jobs: [] });
    }
  });

  // Schedule a repeating alarm to check for stale applications.
  // Fires once after 1 minute, then every 12 hours.
  chrome.alarms.create('followup-check', {
    delayInMinutes: 1,
    periodInMinutes: 60 * 12
  });
});

// -- Follow-up Alarm Handler --

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'followup-check') return;

  try {
    const result = await chrome.storage.local.get({ jobs: [] });
    const jobs = result.jobs;
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    let followUpCount = 0;
    let interviewCount = 0;
    let offerCount = 0;

    jobs.forEach((job) => {
      const daysOld = Math.floor((now - job.appliedAt) / dayMs);

      if (job.status === 'Applied' && daysOld >= 7) {
        followUpCount++;
      } else if (job.status === 'Interview') {
        interviewCount++;
      } else if (job.status === 'Offer') {
        offerCount++;
      }
    });

    const parts = [];
    if (followUpCount > 0) parts.push(`${followUpCount} follow-up${followUpCount > 1 ? 's' : ''} needed`);
    if (interviewCount > 0) parts.push(`${interviewCount} interview${interviewCount > 1 ? 's' : ''} to prep`);
    if (offerCount > 0) parts.push(`${offerCount} offer${offerCount > 1 ? 's' : ''} to review`);

    if (parts.length > 0) {
      chrome.notifications.create('jobtrail-followup', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'JobTrail - Action Required',
        message: parts.join(' - '),
        priority: 1
      });
    }
  } catch (err) {
    console.warn('[JobTrail] Follow-up check failed:', err);
  }
});

// -- Notification Click Handler --

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'jobtrail-followup') {
    chrome.tabs.create({ url: chrome.runtime.getURL('Dashboard/dashboard.html') });
    chrome.notifications.clear(notificationId);
  }
});
