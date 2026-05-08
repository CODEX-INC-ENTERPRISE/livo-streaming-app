import { AdminAPI } from './api.js';
import {
  showToast, escapeHtml, formatDate, formatNumber,
  statusBadge, renderPagination, showModal, hideModal,
  renderEmptyState, renderLoadingRows, timeAgo,
} from './utils.js';

let currentPage = 1;
let currentSearch = '';
let currentStatus = '';
const PAGE_SIZE = 20;

// ── Render ─────────────────────────────────────────────────────────────────

function render() {
  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="space-y-6">
      <div class="data-table-wrapper">
        <div class="data-table-header">
          <h2>Users</h2>
          <div class="flex items-center gap-3 flex-wrap">
            <div class="search-wrapper">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input id="user-search" type="search" class="form-input w-56"
                placeholder="Search by name or email…" value="${escapeHtml(currentSearch)}"
                aria-label="Search users" />
            </div>
            <select id="user-status-filter" class="form-select w-36" aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="active"  ${currentStatus === 'active'  ? 'selected' : ''}>Active</option>
              <option value="blocked" ${currentStatus === 'blocked' ? 'selected' : ''}>Blocked</option>
            </select>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="data-table" aria-label="Users table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Followers</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              ${renderLoadingRows(7)}
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <span id="users-count" class="text-sm text-gray-500"></span>
          <div id="users-pagination" class="pagination-controls"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('user-search').addEventListener('input', debounce((e) => {
    currentSearch = e.target.value.trim();
    currentPage = 1;
    loadUsers();
  }, 400));

  document.getElementById('user-status-filter').addEventListener('change', (e) => {
    currentStatus = e.target.value;
    currentPage = 1;
    loadUsers();
  });

  loadUsers();
}

// ── Load & Render Table ────────────────────────────────────────────────────

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  tbody.innerHTML = renderLoadingRows(7);

  try {
    const params = { page: currentPage, limit: PAGE_SIZE };
    if (currentSearch) params.search = currentSearch;
    if (currentStatus) params.status = currentStatus;

    const data = await AdminAPI.users.list(params);
    const users = data.users || [];
    // Support both top-level total and nested pagination object
    const total = data.total ?? data.pagination?.total ?? 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const countEl = document.getElementById('users-count');
    if (countEl) {
      countEl.textContent = `${formatNumber(total)} user${total !== 1 ? 's' : ''}`;
    }

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">${renderEmptyState('No users found')}</td></tr>`;
    } else {
      tbody.innerHTML = users.map(renderUserRow).join('');
      attachRowListeners(tbody);
    }

    const paginationEl = document.getElementById('users-pagination');
    renderPagination(paginationEl, {
      page: currentPage,
      totalPages,
      onPageChange: (p) => { currentPage = p; loadUsers(); },
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">${renderEmptyState('Failed to load users', err.message)}</td></tr>`;
    showToast('Failed to load users: ' + err.message, 'error');
  }
}

function renderUserRow(user) {
  const id = escapeHtml(String(user.id || user._id || '—'));
  const shortId = id.length > 8 ? id.slice(-8) : id;
  const name = escapeHtml(user.displayName || 'Unknown');
  const email = escapeHtml(user.email || '—');
  const status = user.isBlocked ? 'blocked' : 'active';
  const followers = formatNumber(user.followerCount ?? (user.followerIds || []).length);

  return `
    <tr data-user-id="${id}">
      <td>
        <span class="font-mono text-xs text-gray-400" title="${id}">…${shortId}</span>
      </td>
      <td>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0"
            aria-hidden="true">
            ${name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="font-medium text-gray-900">${name}</div>
            ${user.isHost ? '<span class="badge badge-purple text-xs">Host</span>' : ''}
          </div>
        </div>
      </td>
      <td class="td-muted">${email}</td>
      <td>${statusBadge(status)}</td>
      <td class="td-muted">${formatDate(user.registeredAt || user.createdAt)}</td>
      <td class="td-muted">${followers}</td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1">
          <button class="btn btn-sm btn-secondary btn-view-user" title="View user details"
            aria-label="View details for ${name}">View</button>
          <button class="btn btn-sm btn-secondary btn-edit-user" title="Edit user"
            aria-label="Edit ${name}">Edit</button>
          <button class="btn btn-sm ${user.isBlocked ? 'btn-success' : 'btn-danger'} btn-toggle-block"
            title="${user.isBlocked ? 'Unblock' : 'Block'} user"
            aria-label="${user.isBlocked ? 'Unblock' : 'Block'} ${name}">
            ${user.isBlocked ? 'Unblock' : 'Block'}
          </button>
        </div>
      </td>
    </tr>
  `;
}

function attachRowListeners(tbody) {
  tbody.querySelectorAll('.btn-view-user').forEach((btn) => {
    btn.addEventListener('click', () => {
      const userId = btn.closest('tr').dataset.userId;
      viewUser(userId);
    });
  });

  tbody.querySelectorAll('.btn-edit-user').forEach((btn) => {
    btn.addEventListener('click', () => {
      const userId = btn.closest('tr').dataset.userId;
      editUser(userId);
    });
  });

  tbody.querySelectorAll('.btn-toggle-block').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      const userId = row.dataset.userId;
      const isBlocking = btn.textContent.trim() === 'Block';
      confirmToggleBlock(userId, isBlocking);
    });
  });
}

// ── View User Detail ───────────────────────────────────────────────────────

async function viewUser(userId) {
  showModal('User Details', `
    <div class="space-y-4">
      <div class="skeleton h-16 w-full rounded-xl"></div>
      <div class="grid grid-cols-2 gap-3">
        ${Array.from({ length: 6 }, () => '<div class="skeleton h-10 rounded-lg"></div>').join('')}
      </div>
    </div>
  `);

  try {
    // Fetch user details and activity in parallel
    const [detailData, activityData] = await Promise.all([
      AdminAPI.users.get(userId),
      AdminAPI.users.activity(userId).catch(() => null),
    ]);

    const user = detailData.user || detailData;
    const name = escapeHtml(user.displayName || 'Unknown');
    const stats = user.statistics || {};
    const activityLogs = activityData?.activityLogs || [];
    const summary = activityData?.summary || {};

    const body = `
      <div class="space-y-5">

        <!-- Profile header -->
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center
            text-primary-700 font-bold text-xl flex-shrink-0" aria-hidden="true">
            ${name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">${name}</h3>
            <p class="text-sm text-gray-500">${escapeHtml(user.email || user.phoneNumber || '—')}</p>
            <div class="flex items-center gap-2 mt-1">
              ${statusBadge(user.isBlocked ? 'blocked' : 'active')}
              ${user.isHost ? '<span class="badge badge-purple">Host</span>' : ''}
              ${user.isAdmin ? '<span class="badge badge-blue">Admin</span>' : ''}
            </div>
          </div>
        </div>

        <!-- User info grid -->
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-gray-500">User ID</dt>
            <dd class="mt-0.5 font-mono text-xs text-gray-600 break-all">${escapeHtml(String(user.id || user._id || '—'))}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Phone</dt>
            <dd class="mt-0.5 font-medium">${escapeHtml(user.phoneNumber || '—')}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Registered</dt>
            <dd class="mt-0.5 font-medium">${formatDate(user.registeredAt || user.createdAt)}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Last Login</dt>
            <dd class="mt-0.5 font-medium">${formatDate(user.lastLoginAt)}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Auth Provider</dt>
            <dd class="mt-0.5 font-medium capitalize">${escapeHtml(user.socialProvider || 'email')}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Followers</dt>
            <dd class="mt-0.5 font-medium">${formatNumber(stats.followerCount ?? (user.followerIds || []).length)}</dd>
          </div>
        </dl>

        ${user.bio ? `
          <div>
            <p class="text-sm text-gray-500 mb-1">Bio</p>
            <p class="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">${escapeHtml(user.bio)}</p>
          </div>
        ` : ''}

        <!-- Statistics -->
        <div>
          <h4 class="text-sm font-semibold text-gray-700 mb-2">Statistics</h4>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-gray-900">${formatNumber(stats.streamCount ?? 0)}</div>
              <div class="text-xs text-gray-500 mt-0.5">Streams</div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-gray-900">${formatNumber(stats.followerCount ?? (user.followerIds || []).length)}</div>
              <div class="text-xs text-gray-500 mt-0.5">Followers</div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-gray-900">${formatNumber(stats.transactionCount ?? 0)}</div>
              <div class="text-xs text-gray-500 mt-0.5">Transactions</div>
            </div>
          </div>
        </div>

        <!-- Activity Log -->
        <div>
          <h4 class="text-sm font-semibold text-gray-700 mb-2">Recent Activity</h4>
          ${renderActivityLog(activityLogs)}
        </div>

      </div>
    `;

    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-secondary" id="modal-edit-btn">Edit User</button>
      <button class="btn btn-${user.isBlocked ? 'success' : 'danger'}" id="modal-block-btn">
        ${user.isBlocked ? 'Unblock User' : 'Block User'}
      </button>
      <button class="btn btn-secondary" id="modal-close-action">Close</button>
    `;

    document.getElementById('modal-close-action').addEventListener('click', hideModal);
    document.getElementById('modal-edit-btn').addEventListener('click', () => {
      hideModal();
      editUser(userId);
    });
    document.getElementById('modal-block-btn').addEventListener('click', () => {
      hideModal();
      confirmToggleBlock(userId, !user.isBlocked);
    });

  } catch (err) {
    document.getElementById('modal-body').innerHTML =
      `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
  }
}

function renderActivityLog(logs) {
  if (!logs || logs.length === 0) {
    return '<p class="text-sm text-gray-400 text-center py-4">No activity recorded.</p>';
  }

  const ACTIVITY_ICONS = {
    login:        '🔑',
    registration: '🎉',
    transaction:  '💳',
    stream:       '📺',
    report:       '🚩',
  };

  const items = logs.slice(0, 10).map((log) => {
    const icon = ACTIVITY_ICONS[log.type] || '📋';
    const time = log.timestamp ? timeAgo(log.timestamp) : '—';
    return `
      <li class="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
        <span class="text-base flex-shrink-0 mt-0.5" aria-hidden="true">${icon}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-700">${escapeHtml(log.description || log.type)}</p>
          ${log.data && log.data.amount !== undefined
            ? `<p class="text-xs text-gray-400">${escapeHtml(String(log.data.amount))} ${escapeHtml(log.data.currency || '')}</p>`
            : ''}
        </div>
        <span class="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">${time}</span>
      </li>
    `;
  }).join('');

  return `<ul class="divide-y divide-gray-50 max-h-48 overflow-y-auto">${items}</ul>`;
}

// ── Edit User ──────────────────────────────────────────────────────────────

async function editUser(userId) {
  showModal('Edit User', `
    <div class="space-y-3">
      <div class="skeleton h-10 rounded-lg"></div>
      <div class="skeleton h-10 rounded-lg"></div>
      <div class="skeleton h-10 rounded-lg"></div>
    </div>
  `);

  try {
    const data = await AdminAPI.users.get(userId);
    const user = data.user || data;

    document.getElementById('modal-body').innerHTML = `
      <form id="edit-user-form" class="space-y-4" novalidate>
        <div>
          <label class="form-label" for="edit-displayName">Display Name</label>
          <input id="edit-displayName" class="form-input" type="text"
            value="${escapeHtml(user.displayName || '')}"
            minlength="3" maxlength="30"
            placeholder="Enter display name" />
          <p class="text-xs text-gray-400 mt-1">3–30 characters</p>
        </div>
        <div>
          <label class="form-label" for="edit-email">Email</label>
          <input id="edit-email" class="form-input" type="email"
            value="${escapeHtml(user.email || '')}"
            placeholder="Enter email address" />
        </div>
        <div>
          <label class="form-label" for="edit-status">Status</label>
          <select id="edit-status" class="form-select">
            <option value="active"  ${!user.isBlocked ? 'selected' : ''}>Active</option>
            <option value="blocked" ${user.isBlocked  ? 'selected' : ''}>Blocked</option>
          </select>
        </div>
        <div id="edit-user-error" class="hidden text-sm text-red-600 bg-red-50 rounded-lg p-3"></div>
      </form>
    `;

    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-secondary" id="edit-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="edit-save-btn">Save changes</button>
    `;

    document.getElementById('edit-cancel-btn').addEventListener('click', hideModal);
    document.getElementById('edit-save-btn').addEventListener('click', () => submitEditUser(userId));

    // Allow submitting with Enter key
    document.getElementById('edit-user-form').addEventListener('submit', (e) => {
      e.preventDefault();
      submitEditUser(userId);
    });

  } catch (err) {
    document.getElementById('modal-body').innerHTML =
      `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
  }
}

async function submitEditUser(userId) {
  const displayName = document.getElementById('edit-displayName').value.trim();
  const email = document.getElementById('edit-email').value.trim();
  const statusValue = document.getElementById('edit-status').value;
  const errEl = document.getElementById('edit-user-error');

  errEl.classList.add('hidden');
  errEl.textContent = '';

  // Client-side validation
  if (!displayName) {
    showFieldError(errEl, 'Display name is required.');
    document.getElementById('edit-displayName').focus();
    return;
  }
  if (displayName.length < 3 || displayName.length > 30) {
    showFieldError(errEl, 'Display name must be between 3 and 30 characters.');
    document.getElementById('edit-displayName').focus();
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError(errEl, 'Please enter a valid email address.');
    document.getElementById('edit-email').focus();
    return;
  }

  const saveBtn = document.getElementById('edit-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const payload = {
      displayName,
      isBlocked: statusValue === 'blocked',
    };
    if (email) payload.email = email;

    await AdminAPI.users.update(userId, payload);
    hideModal();
    showToast('User updated successfully.', 'success');
    loadUsers();
  } catch (err) {
    showFieldError(errEl, err.message);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save changes';
  }
}

function showFieldError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}

// ── Block / Unblock ────────────────────────────────────────────────────────

function confirmToggleBlock(userId, isBlocking) {
  const action = isBlocking ? 'block' : 'unblock';
  const actionLabel = isBlocking ? 'Block' : 'Unblock';
  const actionClass = isBlocking ? 'btn-danger' : 'btn-success';
  const description = isBlocking
    ? 'This will prevent the user from logging in and using the app.'
    : 'This will restore the user\'s access to the app.';

  showModal(
    `${actionLabel} User`,
    `
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0 w-10 h-10 rounded-full ${isBlocking ? 'bg-red-100' : 'bg-green-100'}
          flex items-center justify-center">
          <svg class="w-5 h-5 ${isBlocking ? 'text-red-600' : 'text-green-600'}"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${isBlocking
              ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>'
              : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900">Are you sure you want to ${action} this user?</p>
          <p class="text-sm text-gray-500 mt-1">${description}</p>
        </div>
      </div>
    `,
    `
      <button class="btn btn-secondary" id="block-cancel-btn">Cancel</button>
      <button class="btn ${actionClass}" id="block-confirm-btn">${actionLabel} User</button>
    `
  );

  document.getElementById('block-cancel-btn').addEventListener('click', hideModal);
  document.getElementById('block-confirm-btn').addEventListener('click', () => executeToggleBlock(userId, isBlocking));
}

async function executeToggleBlock(userId, isBlocking) {
  const action = isBlocking ? 'block' : 'unblock';
  const confirmBtn = document.getElementById('block-confirm-btn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = isBlocking ? 'Blocking…' : 'Unblocking…';
  }

  try {
    if (isBlocking) {
      await AdminAPI.users.block(userId);
    } else {
      await AdminAPI.users.unblock(userId);
    }
    hideModal();
    showToast(`User ${action}ed successfully.`, 'success');
    loadUsers();
  } catch (err) {
    hideModal();
    showToast(`Failed to ${action} user: ${err.message}`, 'error');
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export { render };
