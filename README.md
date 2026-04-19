# JobTrail

<img src="https://github.com/hrshl21/JobTrail/blob/main/image.png?raw=true" alt="JobTrail Header image" />

**A privacy-first, local-only Chrome Extension to automatically track your job applications.**

JobTrail takes the manual work out of your job search. Whenever you click "Apply" on LinkedIn, Indeed, or Naukri, JobTrail seamlessly intercepts the application, scrapes the job details, and organizes them in a beautiful Kanban dashboard right inside your browser. 

No more messy spreadsheets, and no more forgetting what salary you applied for.

## ✨ Features

- **🪄 Auto-Tracking**: Automatically detects when you apply for a job on **LinkedIn, Indeed, or Naukri**.
- **📋 Kanban Dashboard**: Manage your application pipeline with drag-and-drop columns (Applied, Follow-up, Interview, Offer, Ghosted, Rejected).
- **📊 Analytics Engine**: Visualize your application velocity, response rates, and pipeline funnel using built-in HTML5 canvas charts.
- **📱 Triage Center Popup**: A quick-access extension popup that highlights jobs needing immediate attention (like follow-ups and interviews).
- **🤖 AI Context Generator**: A one-click button in the job details modal to generate a structured prompt loaded with the job description and your notes—ready to paste into ChatGPT/Claude for tailored cover letters and interview prep.
- **🔒 100% Privacy-First & Local-Only**: 
  - Zero accounts or logins required.
  - Zero network requests to external servers.
  - Zeo telemetry.
  - All your data is stored locally on your device in `chrome.storage.local`.

## 📸 Screenshots

<p align="center">
  <img src="https://github.com/hrshl21/JobTrail/blob/main/screely-jobtrail-dashboard-20260419-201558%20(1).png?raw=true" alt="JobTrail Dashboard View" width="48%" />
  &nbsp;
  <img src="https://github.com/hrshl21/JobTrail/blob/main/screely-jobtrail-dashboard-20260419-201814%20(1).png?raw=true" alt="JobTrail Analytics View" width="48%" />
</p>

## 🚀 Installation 

Since this is an unpacked open-source extension, you can install it directly in Developer Mode:

1. Download or clone this repository to your local machine:
   ```bash
   git clone https://github.com/YOUR-USERNAME/job-tracker-extension.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `job-tracker-extension` folder that you just cloned.
6. Look for the JobTrail icon in your extensions menu, pin it, and start applying!

## 🛠️ Architecture

*For full technical details, please see [ARCHITECTURE.md](ARCHITECTURE.md).*

JobTrail is a purely client-side application utilizing:
- **Manifest V3**
- **Content Scripts** for DOM parsing, MutationObservers, and scraping on job portals.
- **Background Service Worker** to handle reminders and desktop notifications.
- **Vanilla structure** (HTML/CSS/JS) with no external bloated frameworks or charting libraries.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/YOUR-USERNAME/job-tracker-extension/issues). 

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).
