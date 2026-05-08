import * as Auth from './auth.js';
import * as Analytics from './analytics.js';
import * as Users from './users.js';
import * as Streams from './streams.js';
import * as Reports from './reports.js';
import * as Withdrawals from './withdrawals.js';
import { showToast } from './utils.js';

const PAGE_TITLES = {
  analytics:     'Analytics',
  users:         'Users',
  streams:       'Streams',
  reports:       'Reports',
  financial:     'Financial',
  moderation:    'Content Moderation',
  hosts:         'Hosts & Agents',
  configuration: 'Configuration',
};

let currentPage = null;
let socket = null;
let pageCleanup = null;

function navigateTo(page) {
  if (currentPage === page) return;

  if (typeof pageCleanup === 'function') {
    pageCleanup();
    pageCleanup = null;
  }

  currentPage = page;

  document.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = link.dataset.page === page;
    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;

  switch (page) {
    case 'analytics':
      Analytics.render();
      pageCleanup = Analytics.cleanup;
      break;
    case 'users':
      Users.render();
      break;
    case 'streams':
      Streams.render();
      pageCleanup = Streams.cleanup;
      break;
    case 'reports':
      Reports.render();
      break;
    case 'financial':
      Withdrawals.render();
      break;
    case 'moderation':
      renderPlaceholder('Content Moderation', 'Keyword filtering and moderation logs coming soon.');
      break;
    case 'hosts':
      renderPlaceholder('Hosts & Agents', 'Host approval and agent management coming soon.');
      break;
    case 'configuration':
      renderPlaceholder('System Configuration', 'Business rule configuration coming soon.');
      break;
    default:
      Analytics.render();
      pageCleanup = Analytics.cleanup;
  }
}

function renderPlaceholder(title, message) {
  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="flex flex-col items-center justify-center h-64 text-center">
      <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
      </svg>
      <h2 class="text-lg font-semibold text-gray-700 mb-1">${title}</h2>
      <p class="text-sm text-gray-400">${message}</p>
    </div>
  `;
}

function initNavigation() {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) {
        navigateTo(page);
        closeSidebar();
      }
    });
  });
}

function initSidebar() {
  const openBtn = document.getElementById('sidebar-open-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');
  const overlay = document.getElementById('sidebar-overlay');
  const sidebar = document.getElementById('sidebar');

  openBtn?.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.remove('hidden');
  });

  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.remove('open');
  overlay?.classList.add('hidden');
}

function initSocket() {
  const serverUrl = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.socketUrl)
    ? window.ADMIN_CONFIG.socketUrl
    : 'http://localhost:3000';

  const token = window.AdminAPI ? window.AdminAPI.getToken() : localStorage.getItem('livo_admin_token');

  try {
    socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setRealtimeStatus(true);
    });

    socket.on('disconnect', () => {
      setRealtimeStatus(false);
    });

    socket.on('connect_error', () => {
      setRealtimeStatus(false);
    });

    socket.on('stream:started', (data) => {
      Streams.onStreamStarted(data);
    });

    socket.on('stream:ended', (data) => {
      Streams.onStreamEnded(data?.streamId);
    });

    socket.on('report:new', () => {
      Reports.onNewReport();
      showToast('A new report has been submitted.', 'warning', 'New Report');
    });

  } catch (err) {
    setRealtimeStatus(false);
  }
}

function setRealtimeStatus(connected) {
  const dot = document.getElementById('realtime-dot');
  const label = document.getElementById('realtime-label');
  if (dot) dot.classList.toggle('connected', connected);
  if (label) label.textContent = connected ? 'Live' : 'Disconnected';
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

window.addEventListener('auth:login', () => {
  initSocket();
  navigateTo('analytics');
});

window.addEventListener('auth:logout', () => {
  disconnectSocket();
  setRealtimeStatus(false);
  currentPage = null;
});

function init() {
  Auth.init();
  initNavigation();
  initSidebar();

  if (Auth.isAuthenticated()) {
    initSocket();
    navigateTo('analytics');
  }
}

document.addEventListener('DOMContentLoaded', init);
