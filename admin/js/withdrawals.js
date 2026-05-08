import { AdminAPI } from './api.js';
import {
  showToast, escapeHtml, formatDate, formatNumber, statusBadge,
  renderPagination, showModal, hideModal,
  renderEmptyState, renderLoadingRows,
} from './utils.js';

let currentPage = 1;
let currentStatus = 'pending';
const PAGE_SIZE = 20;

function render() {
  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="space-y-6">
      <div class="data-table-wrapper">
        <div class="data-table-header">
          <h2>Withdrawal Requests</h2>
          <select id="withdrawal-status-filter" class="form-select w-40">
            <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="approved" ${currentStatus === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="rejected" ${currentStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
            <option value="completed" ${currentStatus === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="" ${currentStatus === '' ? 'selected' : ''}>All</option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="data-table" aria-label="Withdrawals table">
            <thead>
              <tr>
                <th>Host</th>
                <th>Diamonds</th>
                <th>Credit Amount</th>
                <th>Status</th>
                <th>Requested</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="withdrawals-tbody">
              ${renderLoadingRows(6)}
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <span id="withdrawals-count" class="text-sm text-gray-500"></span>
          <div id="withdrawals-pagination" class="pagination-controls"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('withdrawal-status-filter').addEventListener('change', (e) => {
    currentStatus = e.target.value;
    currentPage = 1;
    loadWithdrawals();
  });

  loadWithdrawals();
}

async function loadWithdrawals() {
  const tbody = document.getElementById('withdrawals-tbody');
  if (!tbody) return;

  tbody.innerHTML = renderLoadingRows(6);

  try {
    const params = { page: currentPage, limit: PAGE_SIZE };
    if (currentStatus) params.status = currentStatus;

    const data = await AdminAPI.financial.withdrawals(params);
    const withdrawals = data.withdrawals || [];
    const total = data.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const countEl = document.getElementById('withdrawals-count');
    if (countEl) countEl.textContent = `${total.toLocaleString()} request${total !== 1 ? 's' : ''}`;

    if (withdrawals.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">${renderEmptyState('No withdrawal requests found')}</td></tr>`;
    } else {
      tbody.innerHTML = withdrawals.map(renderWithdrawalRow).join('');
      attachRowListeners(tbody);
    }

    const paginationEl = document.getElementById('withdrawals-pagination');
    renderPagination(paginationEl, {
      page: currentPage,
      totalPages,
      onPageChange: (p) => { currentPage = p; loadWithdrawals(); },
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">${renderEmptyState('Failed to load withdrawals', err.message)}</td></tr>`;
    showToast('Failed to load withdrawals: ' + err.message, 'error');
  }
}

function renderWithdrawalRow(w) {
  const hostName = escapeHtml(w.hostName || w.userId || '—');
  const diamonds = formatNumber(w.diamondAmount || 0);
  const credit = w.creditAmount != null ? `$${Number(w.creditAmount).toFixed(2)}` : '—';
  const status = w.status || 'pending';

  return `
    <tr data-withdrawal-id="${escapeHtml(w._id || w.id)}">
      <td class="font-medium text-gray-900">${hostName}</td>
      <td class="td-muted">💎 ${diamonds}</td>
      <td class="font-medium text-gray-900">${credit}</td>
      <td>${statusBadge(status)}</td>
      <td class="td-muted">${formatDate(w.requestedAt || w.createdAt)}</td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1">
          ${status === 'pending' ? `
            <button class="btn btn-sm btn-success btn-approve-withdrawal" title="Approve">Approve</button>
            <button class="btn btn-sm btn-danger btn-reject-withdrawal" title="Reject">Reject</button>
          ` : `
            <button class="btn btn-sm btn-secondary btn-view-withdrawal" title="View details">View</button>
          `}
        </div>
      </td>
    </tr>
  `;
}

function attachRowListeners(tbody) {
  tbody.querySelectorAll('.btn-approve-withdrawal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('tr').dataset.withdrawalId;
      approveWithdrawal(id);
    });
  });

  tbody.querySelectorAll('.btn-reject-withdrawal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('tr').dataset.withdrawalId;
      rejectWithdrawal(id);
    });
  });

  tbody.querySelectorAll('.btn-view-withdrawal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('tr').dataset.withdrawalId;
      viewWithdrawal(id);
    });
  });
}

function approveWithdrawal(withdrawalId) {
  showModal('Approve Withdrawal', `
    <p class="text-sm text-gray-600 mb-4">Add optional notes before approving this withdrawal request.</p>
    <div>
      <label class="form-label" for="approve-notes">Notes (optional)</label>
      <textarea id="approve-notes" class="form-textarea" rows="3" placeholder="e.g. Processed via bank transfer…"></textarea>
    </div>
    <div id="approve-error" class="hidden mt-3 text-sm text-red-600"></div>
  `, `
    <button class="btn btn-secondary" id="approve-cancel-btn">Cancel</button>
    <button class="btn btn-success" id="approve-submit-btn">Approve</button>
  `);

  document.getElementById('approve-cancel-btn').addEventListener('click', hideModal);
  document.getElementById('approve-submit-btn').addEventListener('click', async () => {
    const notes = document.getElementById('approve-notes').value.trim();
    const errEl = document.getElementById('approve-error');
    errEl.classList.add('hidden');

    const submitBtn = document.getElementById('approve-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Approving…';

    try {
      await AdminAPI.financial.updateWithdrawal(withdrawalId, { status: 'approved', notes });
      hideModal();
      showToast('Withdrawal approved.', 'success');
      loadWithdrawals();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Approve';
    }
  });
}

function rejectWithdrawal(withdrawalId) {
  showModal('Reject Withdrawal', `
    <p class="text-sm text-gray-600 mb-4">Please provide a reason for rejecting this withdrawal request.</p>
    <div>
      <label class="form-label" for="reject-notes">Reason <span class="text-red-500">*</span></label>
      <textarea id="reject-notes" class="form-textarea" rows="3" placeholder="Reason for rejection…"></textarea>
    </div>
    <div id="reject-error" class="hidden mt-3 text-sm text-red-600"></div>
  `, `
    <button class="btn btn-secondary" id="reject-cancel-btn">Cancel</button>
    <button class="btn btn-danger" id="reject-submit-btn">Reject</button>
  `);

  document.getElementById('reject-cancel-btn').addEventListener('click', hideModal);
  document.getElementById('reject-submit-btn').addEventListener('click', async () => {
    const notes = document.getElementById('reject-notes').value.trim();
    const errEl = document.getElementById('reject-error');
    errEl.classList.add('hidden');

    if (!notes) {
      errEl.textContent = 'Please provide a reason for rejection.';
      errEl.classList.remove('hidden');
      return;
    }

    const submitBtn = document.getElementById('reject-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Rejecting…';

    try {
      await AdminAPI.financial.updateWithdrawal(withdrawalId, { status: 'rejected', notes });
      hideModal();
      showToast('Withdrawal rejected.', 'info');
      loadWithdrawals();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reject';
    }
  });
}

async function viewWithdrawal(withdrawalId) {
  showModal('Withdrawal Details', '<div class="text-center py-8"><div class="skeleton h-4 w-3/4 mx-auto mb-3"></div></div>');

  try {
    const data = await AdminAPI.financial.withdrawals({ id: withdrawalId });
    const w = (data.withdrawals || [])[0] || data;

    document.getElementById('modal-body').innerHTML = `
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div><dt class="text-gray-500">Host</dt><dd class="mt-0.5 font-medium">${escapeHtml(w.hostName || w.userId || '—')}</dd></div>
        <div><dt class="text-gray-500">Status</dt><dd class="mt-0.5">${statusBadge(w.status || 'pending')}</dd></div>
        <div><dt class="text-gray-500">Diamonds</dt><dd class="mt-0.5 font-medium">💎 ${formatNumber(w.diamondAmount || 0)}</dd></div>
        <div><dt class="text-gray-500">Credit Amount</dt><dd class="mt-0.5 font-medium">$${Number(w.creditAmount || 0).toFixed(2)}</dd></div>
        <div><dt class="text-gray-500">Requested</dt><dd class="mt-0.5 font-medium">${formatDate(w.requestedAt)}</dd></div>
        <div><dt class="text-gray-500">Processed</dt><dd class="mt-0.5 font-medium">${formatDate(w.processedAt)}</dd></div>
      </dl>
      ${w.notes ? `<div class="mt-4"><p class="text-gray-500 text-sm mb-1">Notes</p><p class="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">${escapeHtml(w.notes)}</p></div>` : ''}
    `;

    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-secondary" id="modal-close-action">Close</button>
    `;
    document.getElementById('modal-close-action').addEventListener('click', hideModal);
  } catch (err) {
    document.getElementById('modal-body').innerHTML = `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
  }
}

export { render };
