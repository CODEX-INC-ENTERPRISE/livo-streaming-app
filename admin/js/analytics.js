import { AdminAPI } from './api.js';
import { showToast, formatNumber, formatCurrency, escapeHtml } from './utils.js';

const CHART_COLORS = {
  primary: 'rgba(192, 38, 211, 1)',
  primaryLight: 'rgba(192, 38, 211, 0.15)',
  blue: 'rgba(37, 99, 235, 1)',
  blueLight: 'rgba(37, 99, 235, 0.15)',
  green: 'rgba(5, 150, 105, 1)',
  greenLight: 'rgba(5, 150, 105, 0.15)',
  orange: 'rgba(234, 88, 12, 1)',
  orangeLight: 'rgba(234, 88, 12, 0.15)',
};

const chartInstances = {};

function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    delete chartInstances[key];
  }
}

function render() {
  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="space-y-6">

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" id="kpi-cards">
        ${renderSkeletonCard()}${renderSkeletonCard()}${renderSkeletonCard()}${renderSkeletonCard()}
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="chart-card">
          <h3>User Growth</h3>
          <div class="chart-wrapper"><canvas id="chart-user-growth"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>Revenue Trend</h3>
          <div class="chart-wrapper"><canvas id="chart-revenue"></canvas></div>
        </div>
      </div>

      <!-- Second charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="chart-card">
          <h3>Stream Activity</h3>
          <div class="chart-wrapper"><canvas id="chart-streams"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>Daily Active Users</h3>
          <div class="chart-wrapper"><canvas id="chart-dau"></canvas></div>
        </div>
      </div>

      <!-- Export -->
      <div class="flex justify-end">
        <button id="export-analytics-btn" class="btn btn-secondary">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export CSV
        </button>
      </div>

    </div>
  `;

  document.getElementById('export-analytics-btn').addEventListener('click', exportAnalytics);

  loadAll();
}

function renderSkeletonCard() {
  return `
    <div class="stat-card">
      <div class="skeleton h-4 w-24 mb-3"></div>
      <div class="skeleton h-8 w-16 mb-2"></div>
      <div class="skeleton h-3 w-20"></div>
    </div>
  `;
}

function renderKpiCard({ label, value, change, changeLabel, iconBg, iconColor, iconPath }) {
  const isPositive = change >= 0;
  return `
    <div class="stat-card">
      <div class="flex items-start justify-between mb-3">
        <div>
          <p class="stat-label">${escapeHtml(label)}</p>
          <p class="stat-value mt-1">${escapeHtml(String(value))}</p>
        </div>
        <div class="stat-icon ${iconBg}">
          <svg class="w-5 h-5 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"/>
          </svg>
        </div>
      </div>
      <p class="stat-change ${isPositive ? 'positive' : 'negative'}">
        ${isPositive ? '↑' : '↓'} ${Math.abs(change)}% ${escapeHtml(changeLabel)}
      </p>
    </div>
  `;
}

async function loadAll() {
  await Promise.allSettled([
    loadKpis(),
    loadUserGrowthChart(),
    loadRevenueChart(),
    loadStreamChart(),
    loadDauChart(),
  ]);
}

async function loadKpis() {
  try {
    const [usersData, revenueData, streamsData, engagementData] = await Promise.all([
      AdminAPI.analytics.users(),
      AdminAPI.financial.revenue(),
      AdminAPI.analytics.streams(),
      AdminAPI.analytics.engagement(),
    ]);

    const kpiEl = document.getElementById('kpi-cards');
    if (!kpiEl) return;

    kpiEl.innerHTML = [
      {
        label: 'Total Users',
        value: formatNumber(usersData.total || 0),
        change: usersData.growthPercent || 0,
        changeLabel: 'vs last month',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      },
      {
        label: 'Total Revenue',
        value: formatCurrency(revenueData.total || 0),
        change: revenueData.growthPercent || 0,
        changeLabel: 'vs last month',
        iconBg: 'bg-green-50',
        iconColor: 'text-green-600',
        iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        label: 'Active Streams',
        value: formatNumber(streamsData.active || 0),
        change: streamsData.growthPercent || 0,
        changeLabel: 'vs yesterday',
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
        iconPath: 'M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z',
      },
      {
        label: 'Daily Active Users',
        value: formatNumber(engagementData.dau || 0),
        change: engagementData.dauGrowthPercent || 0,
        changeLabel: 'vs yesterday',
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-600',
        iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
      },
    ].map(renderKpiCard).join('');
  } catch (err) {
    showToast('Failed to load KPIs: ' + err.message, 'error');
  }
}

async function loadUserGrowthChart() {
  try {
    const data = await AdminAPI.analytics.users({ period: 'monthly' });
    const labels = (data.trend || []).map((d) => d.label || d.date);
    const values = (data.trend || []).map((d) => d.count || d.value || 0);

    destroyChart('userGrowth');
    const ctx = document.getElementById('chart-user-growth');
    if (!ctx) return;

    chartInstances.userGrowth = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'New Users',
          data: values,
          borderColor: CHART_COLORS.blue,
          backgroundColor: CHART_COLORS.blueLight,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        }],
      },
      options: chartOptions('Users'),
    });
  } catch (_) {}
}

async function loadRevenueChart() {
  try {
    const data = await AdminAPI.financial.revenue({ period: 'monthly' });
    const labels = (data.trend || []).map((d) => d.label || d.date);
    const values = (data.trend || []).map((d) => d.amount || d.value || 0);

    destroyChart('revenue');
    const ctx = document.getElementById('chart-revenue');
    if (!ctx) return;

    chartInstances.revenue = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue (USD)',
          data: values,
          backgroundColor: CHART_COLORS.greenLight,
          borderColor: CHART_COLORS.green,
          borderWidth: 2,
          borderRadius: 4,
        }],
      },
      options: chartOptions('USD'),
    });
  } catch (_) {}
}

async function loadStreamChart() {
  try {
    const data = await AdminAPI.analytics.streams({ period: 'daily' });
    const labels = (data.trend || []).map((d) => d.label || d.date);
    const values = (data.trend || []).map((d) => d.count || d.value || 0);

    destroyChart('streams');
    const ctx = document.getElementById('chart-streams');
    if (!ctx) return;

    chartInstances.streams = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Streams',
          data: values,
          borderColor: CHART_COLORS.primary,
          backgroundColor: CHART_COLORS.primaryLight,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        }],
      },
      options: chartOptions('Streams'),
    });
  } catch (_) {}
}

async function loadDauChart() {
  try {
    const data = await AdminAPI.analytics.engagement({ period: 'daily' });
    const labels = (data.trend || []).map((d) => d.label || d.date);
    const values = (data.trend || []).map((d) => d.dau || d.value || 0);

    destroyChart('dau');
    const ctx = document.getElementById('chart-dau');
    if (!ctx) return;

    chartInstances.dau = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'DAU',
          data: values,
          borderColor: CHART_COLORS.orange,
          backgroundColor: CHART_COLORS.orangeLight,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        }],
      },
      options: chartOptions('Users'),
    });
  } catch (_) {}
}

function chartOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e1b4b',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 11 } },
      },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: { color: '#9ca3af', font: { size: 11 } },
        title: { display: false },
      },
    },
  };
}

async function exportAnalytics() {
  const btn = document.getElementById('export-analytics-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }

  try {
    const data = await AdminAPI.analytics.export();
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livo-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Analytics exported successfully.', 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Export CSV`; }
  }
}

function cleanup() {
  Object.keys(chartInstances).forEach(destroyChart);
}

export { render, cleanup };
