import { AdminAPI } from './api.js';
import {
  showToast, escapeHtml, formatDateTime, statusBadge,
  renderPagination, showModal, hideModal,
  renderEmptyState, renderLoadingRows,
} from './utils.js';

let currentPage = 1;
let currentStatus = 'active';
let currentSearch = '';
let currentStartDate = '';
let currentEndDate = '';
const PAGE_SIZE = 20;
let autoRefreshTimer = null;
let durationTickTimer = null;
let searchDebounceTimer = null;

// Track active stream start times for live duration ticking
// Map of streamId -> startedAt (ISO string)
const activeStreamStartTimes = new Map();

// ── Duration helpers ───────────────────────────────────────────────────────

/**
 * Format a duration in seconds into a human-readable string.
 * e.g. 3661 -> "1h 1m 1s"
 */
function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Compute elapsed seconds from a start time ISO string to now.
 */
function elapsedSeconds(startedAt) {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt)) / 1000));
}

// ── Render ─────────────────────────────────────────────────────────────────

function render() {
  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="space-y-6">
      <!-- Active streams summary bar -->
      <div id="streams-summary" class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <span id="active-streams-dot"
            class="inline-block w-2.5 h-2.5 rounded-full bg-purple-500"
            style="animation: pulse-dot 2s infinite;"
            aria-hidden="true"></span>
          <span id="active-streams-count" class="font-semibold text-gray-700">—</span>
          <span>active stream(s)</span>
        </div>
        <span class="text-xs text-gray-400" id="streams-refresh-label">Auto-refreshes every 10s</span>
      </div>

      <div class="data-table-wrapper">
        <div class="data-table-header">
          <h2>Streams</h2>
          <div class="flex items-center gap-3 flex-wrap">
            <!-- Status filter -->
            <select id="stream-status-filter" class="form-select w-36" aria-label="Filter by status">
              <option value="active"      ${currentStatus === 'active'      ? 'selected' : ''}>Active</option>
              <option value="ended"       ${currentStatus === 'ended'       ? 'selected' : ''}>Ended</option>
              <option value="terminated"  ${currentStatus === 'terminated'  ? 'selected' : ''}>Terminated</option>
              <option value=""            ${currentStatus === ''            ? 'selected' : ''}>All</option>
            </select>

            <!-- Search input -->
            <div class="search-wrapper">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input id="stream-search" class="form-input pl-9 w-48"
                type="search" placeholder="Search host or title…"
                value="${escapeHtml(currentSearch)}"
                aria-label="Search streams by host or title" />
            </div>

            <!-- Date range filters (shown for history views) -->
            <div class="flex items-center gap-2 flex-wrap" id="stream-date-filters">
              <label class="text-xs text-gray-500 whitespace-nowrap" for="stream-start-date">From</label>
              <input id="stream-start-date" class="form-input w-36 text-sm" type="date"
                value="${escapeHtml(currentStartDate)}"
                aria-label="Filter streams from date" />
              <label class="text-xs text-gray-500 whitespace-nowrap" for="stream-end-date">To</label>
              <input id="stream-end-date" class="form-input w-36 text-sm" type="date"
                value="${escapeHtml(currentEndDate)}"
                aria-label="Filter streams to date" />
              <button id="stream-clear-dates" class="btn btn-sm btn-secondary" aria-label="Clear date filters"
                title="Clear date filters">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="data-table" aria-label="Streams table">
            <thead>
              <tr>
                <th>Host</th>
                <th>Title</th>
                <th>Status</th>
                <th>Viewers</th>
                <th>Peak</th>
                <th>Gifts</th>
                <th>Duration</th>
                <th>Started</th>
                <th>Ended</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="streams-tbody">
              ${renderLoadingRows(10)}
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <span id="streams-count" class="text-sm text-gray-500"></span>
          <div id="streams-pagination" class="pagination-controls"></div>
        </div>
      </div>
    </div>
  `;

  // Status filter
  document.getElementById('stream-status-filter').addEventListener('change', (e) => {
    currentStatus = e.target.value;
    currentPage = 1;
    loadStreams();
  });

  // Search input with debounce
  document.getElementById('stream-search').addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadStreams();
    }, 350);
  });

  // Date range filters
  document.getElementById('stream-start-date').addEventListener('change', (e) => {
    currentStartDate = e.target.value;
    currentPage = 1;
    loadStreams();
  });

  document.getElementById('stream-end-date').addEventListener('change', (e) => {
    currentEndDate = e.target.value;
    currentPage = 1;
    loadStreams();
  });

  // Clear date filters button
  document.getElementById('stream-clear-dates').addEventListener('click', () => {
    currentStartDate = '';
    currentEndDate = '';
    document.getElementById('stream-start-date').value = '';
    document.getElementById('stream-end-date').value = '';
    currentPage = 1;
    loadStreams();
  });

  loadStreams();
  startAutoRefresh();
}

// ── Auto-refresh ───────────────────────────────────────────────────────────

function startAutoRefresh() {
  stopAutoRefresh();
  // Refresh active streams data every 10 seconds (viewer counts, new streams)
  autoRefreshTimer = setInterval(() => {
    if (currentStatus === 'active' || currentStatus === '') {
      loadStreams(true);
    }
  }, 10000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

// ── Live duration ticker ───────────────────────────────────────────────────

/**
 * Start a 1-second interval that updates duration cells for active streams
 * without re-rendering the whole table.
 */
function startDurationTick() {
  stopDurationTick();
  durationTickTimer = setInterval(() => {
    activeStreamStartTimes.forEach((startedAt, streamId) => {
      const cell = document.querySelector(`tr[data-stream-id="${streamId}"] .stream-duration`);
      if (cell) {
        cell.textContent = formatDuration(elapsedSeconds(startedAt));
      }
    });
  }, 1000);
}

function stopDurationTick() {
  if (durationTickTimer) {
    clearInterval(durationTickTimer);
    durationTickTimer = null;
  }
}

// ── Load & Render Table ────────────────────────────────────────────────────

async function loadStreams(silent = false) {
  const tbody = document.getElementById('streams-tbody');
  if (!tbody) { stopAutoRefresh(); stopDurationTick(); return; }

  if (!silent) tbody.innerHTML = renderLoadingRows(10);

  try {
    const params = { page: currentPage, limit: PAGE_SIZE };
    if (currentStatus) params.status = currentStatus;
    if (currentSearch) params.search = currentSearch;
    if (currentStartDate) params.startDate = currentStartDate;
    if (currentEndDate) params.endDate = currentEndDate;

    const data = await AdminAPI.streams.list(params);
    const streams = data.streams || [];

    // Backend returns pagination object: { page, limit, total, totalPages }
    const total = data.pagination?.total ?? data.total ?? 0;
    const totalPages = data.pagination?.totalPages ?? Math.ceil(total / PAGE_SIZE);

    // Update active stream count badge
    updateActiveCount(streams);

    const countEl = document.getElementById('streams-count');
    if (countEl) countEl.textContent = `${total.toLocaleString()} stream${total !== 1 ? 's' : ''}`;

    // Reset tracked start times and rebuild from current result set
    activeStreamStartTimes.clear();

    if (streams.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10">${renderEmptyState('No streams found')}</td></tr>`;
      stopDurationTick();
    } else {
      tbody.innerHTML = streams.map(renderStreamRow).join('');
      attachRowListeners(tbody);

      // Track active streams for live duration ticking
      streams.forEach((stream) => {
        if (stream.status === 'active' && stream.startedAt) {
          activeStreamStartTimes.set(
            escapeHtml(stream.id || stream._id),
            stream.startedAt,
          );
        }
      });

      if (activeStreamStartTimes.size > 0) {
        startDurationTick();
      } else {
        stopDurationTick();
      }
    }

    const paginationEl = document.getElementById('streams-pagination');
    renderPagination(paginationEl, {
      page: currentPage,
      totalPages,
      onPageChange: (p) => { currentPage = p; loadStreams(); },
    });
  } catch (err) {
    if (!silent) {
      tbody.innerHTML = `<tr><td colspan="10">${renderEmptyState('Failed to load streams', err.message)}</td></tr>`;
      showToast('Failed to load streams: ' + err.message, 'error');
    }
  }
}

/**
 * Update the active streams count indicator in the summary bar.
 * When viewing all streams, count only active ones from the current page.
 * When viewing active streams, use the total from pagination.
 */
function updateActiveCount(streams) {
  const countEl = document.getElementById('active-streams-count');
  const dot = document.getElementById('active-streams-dot');
  if (!countEl) return;

  const activeCount = streams.filter((s) => s.status === 'active').length;
  countEl.textContent = activeCount.toLocaleString();

  // Pulse the dot only when there are active streams
  if (dot) {
    dot.style.backgroundColor = activeCount > 0 ? '' : '#d1d5db';
  }
}

// ── Row rendering ──────────────────────────────────────────────────────────

function renderStreamRow(stream) {
  const streamId = escapeHtml(String(stream.id || stream._id || ''));
  const hostName = escapeHtml(stream.hostName || '—');
  const title = escapeHtml(stream.title || 'Untitled');
  const status = stream.status || 'ended';

  // Use currentViewerCount from API response (populated by backend)
  const viewers = stream.currentViewerCount ?? (stream.currentViewerIds || []).length;
  const peakViewers = stream.peakViewerCount ?? 0;
  const totalGifts = stream.totalGiftsReceived ?? 0;

  // Duration: for active streams show live ticker; for ended/terminated show fixed value
  const durationSecs = stream.duration ?? 0;
  const durationDisplay = status === 'active'
    ? formatDuration(elapsedSeconds(stream.startedAt))
    : formatDuration(durationSecs);

  // Viewer count cell: highlight with color for active streams
  const viewerCell = status === 'active'
    ? `<span class="font-semibold text-purple-700">${viewers.toLocaleString()}</span>`
    : `<span class="td-muted">${viewers.toLocaleString()}</span>`;

  // Ended date cell — only meaningful for ended/terminated streams
  const endedCell = (status === 'ended' || status === 'terminated')
    ? `<span class="td-muted">${formatDateTime(stream.endedAt)}</span>`
    : `<span class="td-muted">—</span>`;

  return `
    <tr data-stream-id="${streamId}">
      <td>
        <div class="flex items-center gap-2">
          ${stream.hostProfilePicture
            ? `<img src="${escapeHtml(stream.hostProfilePicture)}" alt=""
                class="w-7 h-7 rounded-full object-cover flex-shrink-0" aria-hidden="true" />`
            : `<div class="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center
                text-primary-700 font-semibold text-xs flex-shrink-0" aria-hidden="true">
                ${hostName.charAt(0).toUpperCase()}
               </div>`
          }
          <span class="font-medium text-gray-900">${hostName}</span>
        </div>
      </td>
      <td class="max-w-xs truncate" title="${title}">${title}</td>
      <td>${statusBadge(status === 'active' ? 'live' : status)}</td>
      <td>${viewerCell}</td>
      <td class="td-muted">${peakViewers.toLocaleString()}</td>
      <td class="td-muted">${totalGifts.toLocaleString()}</td>
      <td>
        <span class="stream-duration td-muted font-mono text-xs">${durationDisplay}</span>
      </td>
      <td class="td-muted">${formatDateTime(stream.startedAt)}</td>
      <td>${endedCell}</td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1">
          <button class="btn btn-sm btn-secondary btn-view-stream"
            aria-label="View stream details for ${hostName}">View</button>
          ${status === 'active' ? `
            <button class="btn btn-sm btn-danger btn-terminate-stream"
              aria-label="Terminate stream by ${hostName}">Terminate</button>
          ` : `
            <button class="btn btn-sm btn-secondary btn-flag-stream"
              aria-label="Flag stream by ${hostName} for review">Flag</button>
          `}
        </div>
      </td>
    </tr>
  `;
}

function attachRowListeners(tbody) {
  tbody.querySelectorAll('.btn-view-stream').forEach((btn) => {
    btn.addEventListener('click', () => {
      const streamId = btn.closest('tr').dataset.streamId;
      viewStream(streamId);
    });
  });

  tbody.querySelectorAll('.btn-terminate-stream').forEach((btn) => {
    btn.addEventListener('click', () => {
      const streamId = btn.closest('tr').dataset.streamId;
      terminateStream(streamId);
    });
  });

  tbody.querySelectorAll('.btn-flag-stream').forEach((btn) => {
    btn.addEventListener('click', () => {
      const streamId = btn.closest('tr').dataset.streamId;
      flagStream(streamId);
    });
  });
}

// ── View Stream Detail ─────────────────────────────────────────────────────

async function viewStream(streamId) {
  // Widen the modal panel for the two-panel layout
  const modalPanel = document.getElementById('modal-panel');
  if (modalPanel) {
    modalPanel.classList.add('stream-viewer-modal');
  }

  showModal('Stream Viewer', `
    <div class="space-y-3">
      <div class="skeleton h-16 w-full rounded-xl"></div>
      <div class="grid grid-cols-2 gap-3">
        ${Array.from({ length: 6 }, () => '<div class="skeleton h-10 rounded-lg"></div>').join('')}
      </div>
    </div>
  `);

  try {
    // Fetch stream details and chat messages in parallel
    const [detailData, chatData] = await Promise.all([
      AdminAPI.streams.get(streamId),
      AdminAPI.streams.chat(streamId, { limit: 100 }).catch(() => ({ messages: [] })),
    ]);

    const stream = detailData.stream || detailData;
    const chatMessages = chatData.messages || [];

    const host = stream.host || {};
    const hostName = escapeHtml(host.displayName || stream.hostName || '—');
    const stats = stream.statistics || {};
    const status = stream.status || 'ended';
    const durationSecs = stream.duration ?? 0;
    const agoraChannelId = stream.agoraChannelId || '';
    const isLive = status === 'active';

    document.getElementById('modal-body').innerHTML = `
      <div class="stream-viewer-layout">

        <!-- Left panel: video player -->
        <div class="stream-viewer-video-panel">

          <!-- Stream header -->
          <div class="flex items-start gap-3 mb-3">
            <div class="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center
              text-primary-700 font-bold text-base flex-shrink-0" aria-hidden="true">
              ${hostName.charAt(0).toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(stream.title || 'Untitled')}</h3>
              <p class="text-xs text-gray-500">by ${hostName}</p>
            </div>
            <div>${statusBadge(isLive ? 'live' : status)}</div>
          </div>

          <!-- Video player area -->
          <div class="stream-video-container" aria-label="Stream video player">
            ${isLive ? `
              <div class="stream-video-placeholder" id="agora-player-container">
                <div class="stream-video-placeholder-inner">
                  <svg class="w-12 h-12 text-white/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                  </svg>
                  <p class="text-white/70 text-sm font-medium">Live Stream</p>
                  <p class="text-white/40 text-xs mt-1">Agora Channel: <span class="font-mono">${escapeHtml(agoraChannelId || '—')}</span></p>
                  <p class="text-white/30 text-xs mt-2">Agora Web SDK viewer integration required</p>
                </div>
              </div>
            ` : `
              <div class="stream-video-placeholder stream-video-ended">
                <div class="stream-video-placeholder-inner">
                  <svg class="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                  </svg>
                  <p class="text-gray-500 text-sm font-medium">Stream ${escapeHtml(status)}</p>
                  <p class="text-gray-400 text-xs mt-1">No live video available</p>
                </div>
              </div>
            `}
          </div>

          <!-- Stream metadata grid -->
          <dl class="grid grid-cols-2 gap-2 text-xs mt-3">
            <div class="bg-gray-50 rounded-lg p-2">
              <dt class="text-gray-400">Started</dt>
              <dd class="font-medium text-gray-700 mt-0.5">${formatDateTime(stream.startedAt)}</dd>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <dt class="text-gray-400">Duration</dt>
              <dd class="font-medium text-gray-700 font-mono mt-0.5">${formatDuration(durationSecs)}</dd>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <dt class="text-gray-400">Peak Viewers</dt>
              <dd class="font-medium text-gray-700 mt-0.5">${(stream.peakViewerCount || 0).toLocaleString()}</dd>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <dt class="text-gray-400">Current Viewers</dt>
              <dd class="font-medium text-gray-700 mt-0.5">${(stats.currentViewerCount ?? 0).toLocaleString()}</dd>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <dt class="text-gray-400">Total Gifts</dt>
              <dd class="font-medium text-gray-700 mt-0.5">${(stream.totalGiftsReceived || 0).toLocaleString()}</dd>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <dt class="text-gray-400">Chat Messages</dt>
              <dd class="font-medium text-gray-700 mt-0.5">${(stats.chatMessageCount ?? 0).toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        <!-- Right panel: chat messages -->
        <div class="stream-viewer-chat-panel">
          <div class="stream-chat-header">
            <svg class="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <span class="text-sm font-semibold text-gray-700">Chat</span>
            <span class="ml-auto text-xs text-gray-400">${chatMessages.length} message${chatMessages.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="stream-chat-messages" id="stream-chat-messages" role="log" aria-label="Stream chat messages" aria-live="off">
            ${chatMessages.length === 0
              ? `<div class="stream-chat-empty">
                  <svg class="w-8 h-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                  </svg>
                  <p class="text-xs text-gray-400">No chat messages</p>
                </div>`
              : chatMessages.map(renderChatMessage).join('')
            }
          </div>
          ${isLive ? `
            <div class="stream-chat-live-indicator">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" aria-hidden="true"></span>
              <span class="text-xs text-gray-500">Read-only view</span>
            </div>
          ` : ''}
        </div>

      </div>
    `;

    // Scroll chat to bottom
    const chatEl = document.getElementById('stream-chat-messages');
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;

    const footerBtns = isLive
      ? `<button class="btn btn-danger" id="modal-terminate-btn">Terminate Stream</button>`
      : `<button class="btn btn-secondary" id="modal-flag-btn">Flag for Review</button>`;

    document.getElementById('modal-footer').innerHTML = `
      ${footerBtns}
      <button class="btn btn-secondary" id="modal-close-action">Close</button>
    `;

    document.getElementById('modal-close-action').addEventListener('click', () => {
      _resetModalWidth();
      hideModal();
    });

    const terminateBtn = document.getElementById('modal-terminate-btn');
    if (terminateBtn) {
      terminateBtn.addEventListener('click', () => {
        _resetModalWidth();
        hideModal();
        terminateStream(streamId);
      });
    }

    const flagBtn = document.getElementById('modal-flag-btn');
    if (flagBtn) {
      flagBtn.addEventListener('click', () => {
        _resetModalWidth();
        hideModal();
        flagStream(streamId);
      });
    }

  } catch (err) {
    document.getElementById('modal-body').innerHTML =
      `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
  }
}

/**
 * Render a single chat message bubble.
 */
function renderChatMessage(msg) {
  const senderName = escapeHtml(msg.senderName || 'Unknown');
  const message = escapeHtml(msg.message || '');
  const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  const initials = senderName.charAt(0).toUpperCase();

  return `
    <div class="stream-chat-message${msg.isPinned ? ' stream-chat-message--pinned' : ''}">
      <div class="stream-chat-avatar" aria-hidden="true">${initials}</div>
      <div class="stream-chat-content">
        <div class="stream-chat-meta">
          <span class="stream-chat-sender">${senderName}</span>
          ${msg.isPinned ? '<span class="stream-chat-pinned-badge">Pinned</span>' : ''}
          <span class="stream-chat-time">${time}</span>
        </div>
        <p class="stream-chat-text">${message}</p>
      </div>
    </div>
  `;
}

/**
 * Reset the modal panel width after closing the stream viewer.
 */
function _resetModalWidth() {
  const modalPanel = document.getElementById('modal-panel');
  if (modalPanel) {
    modalPanel.classList.remove('stream-viewer-modal');
  }
}

// ── Terminate Stream ───────────────────────────────────────────────────────

async function terminateStream(streamId) {
  showModal(
    'Terminate Stream',
    `<div class="flex items-start gap-4">
      <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
        <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
        </svg>
      </div>
      <div>
        <p class="text-sm font-medium text-gray-900">Are you sure you want to terminate this stream?</p>
        <p class="text-sm text-gray-500 mt-1">The stream will end immediately and the host will be notified.</p>
      </div>
    </div>`,
    `<button class="btn btn-secondary" id="terminate-cancel-btn">Cancel</button>
     <button class="btn btn-danger" id="terminate-confirm-btn">Terminate Stream</button>`,
  );

  document.getElementById('terminate-cancel-btn').addEventListener('click', hideModal);
  document.getElementById('terminate-confirm-btn').addEventListener('click', () =>
    executeTerminate(streamId),
  );
}

async function executeTerminate(streamId) {
  const confirmBtn = document.getElementById('terminate-confirm-btn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Terminating…';
  }

  try {
    await AdminAPI.streams.terminate(streamId);
    hideModal();
    showToast('Stream terminated successfully.', 'success');
    loadStreams();
  } catch (err) {
    hideModal();
    showToast('Failed to terminate stream: ' + err.message, 'error');
  }
}

// ── Flag Stream ────────────────────────────────────────────────────────────

async function flagStream(streamId) {
  showModal(
    'Flag Stream for Review',
    `<form id="flag-stream-form" class="space-y-4" novalidate>
      <div>
        <label class="form-label" for="flag-reason">Reason <span class="text-red-500">*</span></label>
        <input id="flag-reason" class="form-input" type="text"
          placeholder="Enter reason for flagging…" maxlength="500" />
      </div>
      <div>
        <label class="form-label" for="flag-notes">Additional Notes</label>
        <textarea id="flag-notes" class="form-textarea" rows="3"
          placeholder="Optional additional context…" maxlength="1000"></textarea>
      </div>
      <div id="flag-error" class="hidden text-sm text-red-600 bg-red-50 rounded-lg p-3"></div>
    </form>`,
    `<button class="btn btn-secondary" id="flag-cancel-btn">Cancel</button>
     <button class="btn btn-primary" id="flag-submit-btn">Flag Stream</button>`,
  );

  document.getElementById('flag-cancel-btn').addEventListener('click', hideModal);
  document.getElementById('flag-submit-btn').addEventListener('click', () =>
    submitFlag(streamId),
  );
  document.getElementById('flag-stream-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitFlag(streamId);
  });
}

async function submitFlag(streamId) {
  const reason = document.getElementById('flag-reason').value.trim();
  const notes = document.getElementById('flag-notes').value.trim();
  const errEl = document.getElementById('flag-error');

  errEl.classList.add('hidden');

  if (!reason) {
    errEl.textContent = 'Please enter a reason for flagging this stream.';
    errEl.classList.remove('hidden');
    document.getElementById('flag-reason').focus();
    return;
  }

  const submitBtn = document.getElementById('flag-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Flagging…';

  try {
    await AdminAPI.streams.flag(streamId, reason, notes);
    hideModal();
    showToast('Stream flagged for review.', 'info');
    loadStreams();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Flag Stream';
  }
}

// ── Real-time event handlers (called from main.js socket events) ───────────

function onStreamStarted(stream) {
  // Update badge count in sidebar
  const badge = document.getElementById('badge-streams');
  if (badge) {
    const count = parseInt(badge.textContent || '0', 10) + 1;
    badge.textContent = count;
    badge.classList.remove('hidden');
  }
  // Silently refresh if we're viewing active or all streams
  if (currentStatus === 'active' || currentStatus === '') {
    loadStreams(true);
  }
}

function onStreamEnded(streamId) {
  // Remove from duration tracking immediately
  if (streamId) activeStreamStartTimes.delete(String(streamId));
  // Silently refresh if we're viewing active or all streams
  if (currentStatus === 'active' || currentStatus === '') {
    loadStreams(true);
  }
}

// ── Cleanup ────────────────────────────────────────────────────────────────

function cleanup() {
  stopAutoRefresh();
  stopDurationTick();
  activeStreamStartTimes.clear();
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
}

export { render, onStreamStarted, onStreamEnded, cleanup };
