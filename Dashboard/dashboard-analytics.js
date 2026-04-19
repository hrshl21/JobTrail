/**
 * Dashboard/dashboard-analytics.js
 *
 * Renders the analytics view with four chart types:
 * 1. Application velocity (bar chart) - apps per week for the last 8 weeks
 * 2. Source distribution (donut chart) - LinkedIn vs Indeed vs Naukri
 * 3. Pipeline funnel (horizontal bars) - Applied > Follow-up > Interview > Offer
 * 4. Top companies (horizontal bars) - most frequently applied-to companies
 *
 * All charts are drawn with the HTML5 Canvas API (no external libraries).
 *
 * Dependencies: storage-analytics.js (JobStorage.getAnalytics)
 */

async function renderAnalytics() {
  const analytics = await window.JobStorage.getAnalytics();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('metric-total', analytics.total);
  set('metric-response', analytics.responseRate + '%');
  set('metric-avg-days', analytics.avgDaysInPipeline);
  set('metric-offers', analytics.byStatus['Offer'] || 0);

  renderVelocityChart(analytics.weeklyApps);
  renderSourceChart(analytics.bySource);
  renderFunnel(analytics.byStatus);
  renderTopCompanies(analytics.topCompanies);
}

function renderVelocityChart(weeklyApps) {
  const canvas = document.getElementById('chart-velocity');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = 180 * dpr;
  ctx.scale(dpr, dpr);

  const W = canvas.offsetWidth;
  const H = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...weeklyApps.map(w => w.count), 1);
  const barWidth = chartW / weeklyApps.length * 0.7;
  const gap = chartW / weeklyApps.length * 0.3;

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
  }

  weeklyApps.forEach((week, i) => {
    const x = padding.left + i * (barWidth + gap) + gap / 2;
    const barH = (week.count / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barH, 4);
    ctx.fill();

    if (week.count > 0) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(week.count, x + barWidth / 2, y - 6);
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const labelWeek = weeklyApps.length - 1 - week.week;
    ctx.fillText(`W${labelWeek + 1}`, x + barWidth / 2, H - 8);
  });
}

function renderSourceChart(bySource) {
  const canvas = document.getElementById('chart-sources');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = 180 * dpr;
  canvas.height = 180 * dpr;
  ctx.scale(dpr, dpr);

  const entries = Object.entries(bySource);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return;

  const colors = { 'LinkedIn': '#0a66c2', 'Indeed': '#2557a7', 'Naukri': '#275df5', 'Unknown': '#64748b' };
  const cx = 90, cy = 90, outerR = 80, innerR = 50;

  let startAngle = -Math.PI / 2;
  entries.forEach(([source, count]) => {
    const sliceAngle = (count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors[source] || '#64748b';
    ctx.fill();
    startAngle += sliceAngle;
  });

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 8);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText('Total', cx, cy + 12);

  const legend = document.getElementById('source-legend');
  if (legend) {
    legend.innerHTML = entries.map(([source, count]) =>
      `<div class="legend-item">
        <span class="legend-dot" style="background:${colors[source] || '#64748b'}"></span>
        <span>${source}</span>
        <strong>${count}</strong>
      </div>`
    ).join('');
  }
}

function renderFunnel(byStatus) {
  const container = document.getElementById('funnel-chart');
  if (!container) return;

  const stages = ['Applied', 'Follow-up', 'Interview', 'Offer'];
  const colors = ['#3b82f6', '#fbbf24', '#60a5fa', '#34d399'];
  const max = Math.max(...stages.map(s => byStatus[s] || 0), 1);

  container.innerHTML = stages.map((stage, i) => {
    const count = byStatus[stage] || 0;
    const pct = (count / max) * 100;
    return `
      <div class="funnel-stage">
        <span class="funnel-label">${stage}</span>
        <div class="funnel-bar-track">
          <div class="funnel-bar" style="width:${Math.max(pct, 4)}%;background:${colors[i]}"></div>
        </div>
        <span class="funnel-count">${count}</span>
      </div>
    `;
  }).join('');
}

function renderTopCompanies(topCompanies) {
  const container = document.getElementById('top-companies');
  if (!container) return;

  if (topCompanies.length === 0) {
    container.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px;">No data yet</div>';
    return;
  }

  const max = topCompanies[0].count;
  container.innerHTML = topCompanies.map(c => {
    const pct = (c.count / max) * 100;
    return `
      <div class="company-bar-item">
        <span class="company-name">${sanitizeCompanyName(c.name)}</span>
        <div class="company-bar-track">
          <div class="company-bar" style="width:${Math.max(pct, 8)}%"></div>
        </div>
        <span class="company-count">${c.count}</span>
      </div>
    `;
  }).join('');
}
