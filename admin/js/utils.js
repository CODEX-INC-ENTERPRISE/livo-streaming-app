const toastContainer = document.getElementById('toast-container');

const TOAST_ICONS = {
  success: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`,
  error: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`,
  warning: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
  </svg>`,
  info: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`,
};

function showToast(message, type = 'info', title = '', duration = 4000) {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    ${TOAST_ICONS[type] || TOAST_ICONS.info}
    <div class="toast-body">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss notification">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  toastContainer.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
}

function removeToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add('removing');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatNumber(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('en-US');
}

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  const intervals = [
    [31536000, 'year'], [2592000, 'month'], [86400, 'day'],
    [3600, 'hour'], [60, 'minute'],
  ];
  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count} ${label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

function statusBadge(status) {
  const map = {
    active:    ['badge-green',  'Active'],
    inactive:  ['badge-gray',   'Inactive'],
    blocked:   ['badge-red',    'Blocked'],
    pending:   ['badge-yellow', 'Pending'],
    approved:  ['badge-green',  'Approved'],
    rejected:  ['badge-red',    'Rejected'],
    completed: ['badge-blue',   'Completed'],
    resolved:  ['badge-green',  'Resolved'],
    open:      ['badge-yellow', 'Open'],
    live:       ['badge-purple', 'Live'],
    ended:      ['badge-gray',   'Ended'],
    terminated: ['badge-red',    'Terminated'],
  };
  const [cls, label] = map[status] || ['badge-gray', status || '—'];
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function renderPagination(container, { page, totalPages, onPageChange }) {
  if (!container) return;
  container.innerHTML = '';

  const prev = document.createElement('button');
  prev.className = 'pagination-btn';
  prev.disabled = page <= 1;
  prev.setAttribute('aria-label', 'Previous page');
  prev.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
  </svg>`;
  prev.addEventListener('click', () => onPageChange(page - 1));
  container.appendChild(prev);

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.className = `pagination-btn${i === page ? ' active' : ''}`;
    btn.textContent = i;
    btn.setAttribute('aria-label', `Page ${i}`);
    if (i === page) btn.setAttribute('aria-current', 'page');
    btn.addEventListener('click', () => onPageChange(i));
    container.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'pagination-btn';
  next.disabled = page >= totalPages;
  next.setAttribute('aria-label', 'Next page');
  next.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
  </svg>`;
  next.addEventListener('click', () => onPageChange(page + 1));
  container.appendChild(next);
}

function showModal(title, bodyHtml, footerHtml = '') {
  const container = document.getElementById('modal-container');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');
  const closeBtn = document.getElementById('modal-close-btn');
  const backdrop = document.getElementById('modal-backdrop');

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  footerEl.innerHTML = footerHtml;

  container.classList.remove('hidden');
  container.classList.add('visible');

  const close = () => hideModal();
  closeBtn.addEventListener('click', close, { once: true });
  backdrop.addEventListener('click', close, { once: true });

  return container;
}

function hideModal() {
  const container = document.getElementById('modal-container');
  container.classList.add('hidden');
  container.classList.remove('visible');
  // Reset any modal panel size overrides applied by specific views
  const panel = document.getElementById('modal-panel');
  if (panel) panel.classList.remove('stream-viewer-modal');
}

function renderEmptyState(message = 'No data found', subtext = '') {
  return `
    <div class="empty-state">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p>${escapeHtml(message)}</p>
      ${subtext ? `<span>${escapeHtml(subtext)}</span>` : ''}
    </div>
  `;
}

function renderLoadingRows(cols, rows = 5) {
  return Array.from({ length: rows }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      `<td class="px-6 py-4"><div class="skeleton h-4 w-full"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

export {
  showToast, escapeHtml, formatDate, formatDateTime,
  formatNumber, formatCurrency, timeAgo, statusBadge,
  renderPagination, showModal, hideModal,
  renderEmptyState, renderLoadingRows,
};
