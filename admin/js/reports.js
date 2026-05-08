import { AdminAPI } from './api.js';
import {
  showToast, escapeHtml, formatDate, statusBadge,
  renderPagination, showModal, hideModal,
  renderEmptyState, renderLoadingRows,
} from './utils.js';

let currentPage = 1;
let currentStatus = 'open';
const PAGE_SIZE = 20;

function render() {
  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="space-y-6">
      <div class="data-table-wrapper">
        <div class="data-table-header">
          <h2>Reports</h2>
          <select id="report-status-filter" class="form-select w-36">
            <option value="open" ${currentStatus === 'open' ? 'selected' : ''}>Open</option>
            <option value="resolved" ${currentStatus === 'resolved' ? 'selected' : ''}>Resolved</option>
            <option value="" ${currentStatus === '' ? 'selected' : ''}>All</option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="data-table" aria-label="Reports table">
            <thead>
              <tr>
                <th>Reporter</th>
                <th>Reported User</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Submitted</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="reports-tbody">
              ${renderLoadingRows(6)}
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <span id="reports-count" class="text-sm text-gray-500"></span>
          <div id="reports-pagination" class="pagination-controls"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('report-status-filter').addEventListener('change', (e) => {
    currentStatus = e.target.value;
    currentPage = 1;
    loadReports();
  });

  loadReports();
}

async function loadReports() {
  const tbody = document.getElementById('reports-tbody');
  if (!tbody) return;

  tbody.innerHTML = renderLoadingRows(6);

  try {
    const params = { page: currentPage, limit: PAGE_SIZE };
    if (currentStatus) params.status = currentStatus;

    const data = await AdminAPI.reports.list(params);
    const reports = data.reports || [];
    const total = data.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const countEl = document.getElementById('reports-count');
    if (countEl) countEl.textContent = `${total.toLocaleString()} report${total !== 1 ? 's' : ''}`;

    if (reports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">${renderEmptyState('No reports found')}</td></tr>`;
    } else {
      tbody.innerHTML = reports.map(renderReportRow).join('');
      attachRowListeners(tbody);
    }

    const paginationEl = document.getElementById('reports-pagination');
    renderPagination(paginationEl, {
      page: currentPage,
      totalPages,
      onPageChange: (p) => { currentPage = p; loadReports(); },
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">${renderEmptyState('Failed to load reports', err.message)}</td></tr>`;
    showToast('Failed to load reports: ' + err.message, 'error');
  }
}

function renderReportRow(report) {
  const reporter = escapeHtml(report.reporterName || report.reporterId || '—');
  const reported = escapeHtml(report.reportedUserName || report.reportedUserId || '—');
  const reason = escapeHtml(report.reason || '—');
  const status = report.status || 'open';

  return `
    <tr data-report-id="${escapeHtml(report._id || report.id)}">
      <td class="font-medium text-gray-900">${reporter}</td>
      <td>${reported}</td>
      <td class="td-muted capitalize">${reason}</td>
      <td>${statusBadge(status)}</td>
      <td class="td-muted">${formatDate(report.submittedAt || report.createdAt)}</td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1">
          <button class="btn btn-sm btn-secondary btn-view-report" title="View details">View</button>
          ${status !== 'resolved' ? `
            <button class="btn btn-sm btn-primary btn-resolve-report" title="Resolve report">Resolve</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `;
}

function attachRowListeners(tbody) {
  tbody.querySelectorAll('.btn-view-report').forEach((btn) => {
    btn.addEventListener('click', () => {
      const reportId = btn.closest('tr').dataset.reportId;
      viewReport(reportId);
    });
  });

  tbody.querySelectorAll('.btn-resolve-report').forEach((btn) => {
    btn.addEventListener('click', () => {
      const reportId = btn.closest('tr').dataset.reportId;
      resolveReport(reportId);
    });
  });
}

async function viewReport(reportId) {
  showModal('Report Details', '<div class="text-center py-8"><div class="skeleton h-4 w-3/4 mx-auto mb-3"></div></div>');

  try {
    const data = await AdminAPI.reports.get(reportId);
    const report = data.report || data;

    document.getElementById('modal-body').innerHTML = `
      <dl class="space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div><dt class="text-gray-500">Reporter</dt><dd class="mt-0.5 font-medium">${escapeHtml(report.reporterName || report.reporterId || '—')}</dd></div>
          <div><dt class="text-gray-500">Reported User</dt><dd class="mt-0.5 font-medium">${escapeHtml(report.reportedUserName || report.reportedUserId || '—')}</dd></div>
          <div><dt class="text-gray-500">Reason</dt><dd class="mt-0.5 font-medium capitalize">${escapeHtml(report.reason || '—')}</dd></div>
          <div><dt class="text-gray-500">Status</dt><dd class="mt-0.5">${statusBadge(report.status || 'open')}</dd></div>
          <div><dt class="text-gray-500">Submitted</dt><dd class="mt-0.5 font-medium">${formatDate(report.submittedAt)}</dd></div>
        </div>
        ${report.description ? `
          <div>
            <dt class="text-gray-500 mb-1">Description</dt>
            <dd class="text-gray-700 bg-gray-50 rounded-lg p-3">${escapeHtml(report.description)}</dd>
          </div>
        ` : ''}
        ${report.resolutionNotes ? `
          <div>
            <dt class="text-gray-500 mb-1">Resolution Notes</dt>
            <dd class="text-gray-700 bg-gray-50 rounded-lg p-3">${escapeHtml(report.resolutionNotes)}</dd>
          </div>
        ` : ''}
      </dl>
    `;

    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-secondary" id="modal-close-action">Close</button>
      ${report.status !== 'resolved' ? `<button class="btn btn-primary" id="modal-resolve-btn">Resolve</button>` : ''}
    `;

    document.getElementById('modal-close-action').addEventListener('click', hideModal);
    const resolveBtn = document.getElementById('modal-resolve-btn');
    if (resolveBtn) {
      resolveBtn.addEventListener('click', () => {
        hideModal();
        resolveReport(reportId);
      });
    }
  } catch (err) {
    document.getElementById('modal-body').innerHTML = `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
  }
}

function resolveReport(reportId) {
  showModal('Resolve Report', `
    <form id="resolve-form" class="space-y-4" novalidate>
      <div>
        <label class="form-label" for="resolve-action">Action</label>
        <select id="resolve-action" class="form-select">
          <option value="no_action">No action required</option>
          <option value="warning">Issue warning</option>
          <option value="suspension">Suspend user</option>
          <option value="ban">Ban user</option>
        </select>
      </div>
      <div>
        <label class="form-label" for="resolve-notes">Resolution Notes</label>
        <textarea id="resolve-notes" class="form-textarea" rows="3"
          placeholder="Add notes about the resolution…"></textarea>
      </div>
      <div id="resolve-error" class="hidden text-sm text-red-600"></div>
    </form>
  `, `
    <button class="btn btn-secondary" id="resolve-cancel-btn">Cancel</button>
    <button class="btn btn-primary" id="resolve-submit-btn">Resolve</button>
  `);

  document.getElementById('resolve-cancel-btn').addEventListener('click', hideModal);
  document.getElementById('resolve-submit-btn').addEventListener('click', async () => {
    const action = document.getElementById('resolve-action').value;
    const notes = document.getElementById('resolve-notes').value.trim();
    const errEl = document.getElementById('resolve-error');
    errEl.classList.add('hidden');

    const submitBtn = document.getElementById('resolve-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Resolving…';

    try {
      await AdminAPI.reports.resolve(reportId, { status: 'resolved', action, notes });
      hideModal();
      showToast('Report resolved successfully.', 'success');
      clearBadge();
      loadReports();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Resolve';
    }
  });
}

function onNewReport() {
  const badge = document.getElementById('badge-reports');
  if (badge) {
    const count = parseInt(badge.textContent || '0', 10) + 1;
    badge.textContent = count;
    badge.classList.remove('hidden');
  }
}

function clearBadge() {
  const badge = document.getElementById('badge-reports');
  if (badge) {
    badge.textContent = '';
    badge.classList.add('hidden');
  }
}

export { render, onNewReport };
