# JobTrail - Architecture Overview

A Chrome extension that automatically tracks job applications across LinkedIn,
Indeed, and Naukri with a Kanban dashboard and built-in analytics. All data is stored locally on the user's device.

## System Architecture

```
User's Browser
|
+-- Content Scripts (per-site)
|   |-- linkedin.js     Intercept "Apply" click, scrape job data
|   |-- indeed.js       Intercept "Apply" click, scrape job data
|   |-- naukri.js        Intercept "Apply" click, scrape job data
|   |-- content.css      Injected UI styles (buttons, toasts, badges)
|
+-- Shared Utilities
|   |-- scraper-utils.js       Multi-strategy CSS selector engine, parsers
|   |-- storage-crud.js        CRUD operations on chrome.storage.local
|   |-- storage-analytics.js   Analytics computation from stored jobs
|
+-- Service Worker
|   |-- background.js          Alarms, notifications, storage init
|
+-- Popup
|   |-- popup.html / .css / .js  Triage action center (quick view)
|   |-- popup-triage.js           Renders priority action items
|
+-- Dashboard (full-page SPA)
    |-- dashboard.html / .css     Kanban board layout
    |-- dashboard-state.js        Shared mutable state
    |-- dashboard-board.js        Renders Kanban cards
    |-- dashboard-modal.js        Job detail modal
    |-- dashboard-drag-drop.js    Column drag-and-drop
    |-- dashboard-filters.js      Search, filter chips, view toggle
    |-- dashboard-analytics.js    Canvas charts (velocity, funnel, etc.)
    |-- dashboard-import-export.js JSON export/import
```

## Core Data Flow

1. **User browses a job site** (LinkedIn, Indeed, or Naukri).
2. **Content script detects an "Apply" click** via CSS selectors, text
   matching, or a MutationObserver (for LinkedIn's external apply dialog).
3. **Data is scraped** from the page: title, company, location, salary,
   post age, applicant count, and full job description.
4. **Job is saved to `chrome.storage.local`** with deduplication checks
   (exact match and cross-source fingerprinting).
5. **User sees a confirmation pill** on the page ("Tracked: Software Engineer").
6. **Dashboard reads from local storage** to render the Kanban board,
   analytics charts, and job detail modals.

## Feature Details

### Feature 1: Auto-Tracking

Each content script uses a multi-strategy approach:
- Primary CSS selectors for current site layout
- Fallback selectors for older layouts
- Text-based button detection (walk up DOM for "Apply" text)
- MutationObserver for async dialog detection (LinkedIn)
- URL polling for SPA navigation


### Feature 3: Kanban Dashboard

Six columns: Applied, Follow-up, Interview, Offer, Ghosted, Rejected.
- Jobs in "Applied" for 7+ days auto-promote to "Follow-up".
- Drag-and-drop between columns updates status and records a timeline.
- Each job card shows: title, company, source badge, and action signal.

### Feature 4: Analytics

Canvas-rendered charts (no external libraries):
- Application velocity (bar chart, 8 weeks)
- Pipeline funnel (horizontal bars)
- Source distribution (donut chart)
- Top companies (horizontal bars)
- Key metrics: total, response rate, avg pipeline days

### Feature 5: Follow-up Notifications

The service worker (`background.js`) runs a 12-hour alarm that checks
for stale applications. If any jobs need attention, a native desktop
notification is fired.

### Feature 6: AI Context Copy

The job detail modal includes a "Copy Context for AI" button that formats
the job description + user notes into a structured prompt, ready to paste
into ChatGPT or Claude for cover letter generation and interview prep.

## Storage Schema

All data lives in `chrome.storage.local` under the `jobs` key.
Each job object:

```json
{
  "jobId": "3956123456",
  "jobTitle": "Software Engineer",
  "company": "Google",
  "jobUrl": "https://linkedin.com/jobs/view/3956123456",
  "source": "LinkedIn",
  "description": "<html>...",
  "location": "Bangalore, India",
  "salary": "25-40 LPA",
  "status": "Applied",
  "appliedAt": 1713500000000,
  "postAgeDays": 12,
  "applicantCount": 340,
  "notes": "",
  "ctc": "",
  "resumeVersion": "",
  "fingerprint": "softwareengineer::google",
  "statusHistory": [
    { "status": "Applied", "timestamp": 1713500000000 }
  ]
}
```

## Privacy

- **No accounts, no login**: The extension works without any user identity.
- **No network requests**: All data stays on the user's device.
- **No telemetry**: The extension does not phone home.
- **Offline-first**: Everything works without an internet connection.
