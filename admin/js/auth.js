import { AdminAPI, ApiError } from './api.js';
import { showToast } from './utils.js';

// ── DOM references (only available on index.html / app-shell pages) ──────────
const loginScreen   = document.getElementById('login-screen');
const appShell      = document.getElementById('app-shell');
const loginForm     = document.getElementById('login-form');
const loginError    = document.getElementById('login-error');
const loginBtn      = document.getElementById('login-btn');
const logoutBtn     = document.getElementById('logout-btn');
const adminNameEl   = document.getElementById('admin-name');
const adminEmailEl  = document.getElementById('admin-email');
const adminAvatarEl = document.getElementById('admin-avatar');

let currentAdmin = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function showLoginError(message) {
  if (!loginError) return;
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function hideLoginError() {
  if (!loginError) return;
  loginError.classList.add('hidden');
}

function setAdminUI(admin) {
  if (!admin) return;
  currentAdmin = admin;
  if (adminNameEl)   adminNameEl.textContent   = admin.name  || 'Admin';
  if (adminEmailEl)  adminEmailEl.textContent  = admin.email || '';
  if (adminAvatarEl) {
    adminAvatarEl.textContent = (admin.name || 'A').charAt(0).toUpperCase();
  }
}

function showApp() {
  if (!loginScreen || !appShell) return;
  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
  appShell.classList.add('flex');
}

function showLogin() {
  if (!appShell || !loginScreen) return;
  appShell.classList.add('hidden');
  appShell.classList.remove('flex');
  loginScreen.classList.remove('hidden');
}

// ── Core auth actions ─────────────────────────────────────────────────────────

/**
 * Perform admin login.
 * Used both by the embedded login form (index.html) and the standalone login.html.
 * Returns the response data on success; throws on failure.
 */
async function login(email, password) {
  const data = await AdminAPI.auth.login(email, password);
  AdminAPI.setToken(data.token);
  setAdminUI(data.admin || { email });
  return data;
}

async function handleLogin(e) {
  e.preventDefault();
  hideLoginError();

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return;
  }

  if (loginBtn) {
    loginBtn.disabled    = true;
    loginBtn.textContent = 'Signing in…';
  }

  try {
    await login(email, password);
    showApp();
    window.dispatchEvent(new CustomEvent('auth:login', { detail: { admin: currentAdmin } }));
  } catch (err) {
    const message = err instanceof ApiError
      ? err.message
      : 'Unable to connect. Please try again.';
    showLoginError(message);
  } finally {
    if (loginBtn) {
      loginBtn.disabled    = false;
      loginBtn.textContent = 'Sign in';
    }
  }
}

async function handleLogout() {
  try {
    await AdminAPI.auth.logout();
  } catch (_) {
    // Ignore logout API errors — clear token regardless
  }
  AdminAPI.clearToken();
  currentAdmin = null;

  // If we're on the dashboard, redirect to the dedicated login page
  if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/admin/')) {
    window.location.replace('login.html');
    return;
  }

  showLogin();
  window.dispatchEvent(new CustomEvent('auth:logout'));
  showToast('Signed out successfully.', 'info');
}

function isAuthenticated() {
  return Boolean(AdminAPI.getToken());
}

function getCurrentAdmin() {
  return currentAdmin;
}

// ── Initialisation (called from main.js on index.html) ───────────────────────

function init() {
  // Redirect to login page if not authenticated
  if (!isAuthenticated()) {
    window.location.replace('login.html');
    return;
  }

  // Wire up the embedded login form (present in index.html as a fallback)
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  window.addEventListener('auth:expired', () => {
    AdminAPI.clearToken();
    currentAdmin = null;
    window.location.replace('login.html');
  });

  // Already authenticated — show the app shell
  showApp();
}

export { init, isAuthenticated, getCurrentAdmin, showApp, showLogin, login };
