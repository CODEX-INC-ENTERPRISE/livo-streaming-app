const BASE_URL = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.apiBaseUrl)
  ? window.ADMIN_CONFIG.apiBaseUrl
  : 'http://localhost:3000/api';

const TOKEN_KEY = 'livo_admin_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body = null, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, config);

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError('Session expired. Please sign in again.', 401);
  }

  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message = (data && data.error) || (data && data.message) || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const AdminAPI = {
  getToken,
  setToken,
  clearToken,

  auth: {
    login: (email, password) =>
      request('POST', '/admin/auth/login', { email, password }),
    logout: () =>
      request('POST', '/admin/auth/logout'),
  },

  users: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/users${qs ? '?' + qs : ''}`);
    },
    get: (userId) => request('GET', `/admin/users/${userId}`),
    update: (userId, data) => request('PUT', `/admin/users/${userId}`, data),
    block: (userId) => request('PUT', `/admin/users/${userId}`, { isBlocked: true }),
    unblock: (userId) => request('PUT', `/admin/users/${userId}`, { isBlocked: false }),
    activity: (userId) => request('GET', `/admin/users/${userId}/activity`),
  },

  streams: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/streams${qs ? '?' + qs : ''}`);
    },
    get: (streamId) => request('GET', `/admin/streams/${streamId}`),
    terminate: (streamId) => request('POST', `/admin/streams/${streamId}/terminate`),
    flag: (streamId, reason, notes = '') => request('POST', `/admin/streams/${streamId}/flag`, { reason, notes }),
    chat: (streamId, params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/streams/${streamId}/chat${qs ? '?' + qs : ''}`);
    },
  },

  reports: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/reports${qs ? '?' + qs : ''}`);
    },
    get: (reportId) => request('GET', `/admin/reports/${reportId}`),
    resolve: (reportId, data) => request('PUT', `/admin/reports/${reportId}`, data),
  },

  financial: {
    revenue: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/analytics/revenue${qs ? '?' + qs : ''}`);
    },
    diamonds: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/analytics/diamonds${qs ? '?' + qs : ''}`);
    },
    withdrawals: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/withdrawals${qs ? '?' + qs : ''}`);
    },
    updateWithdrawal: (withdrawalId, data) =>
      request('PUT', `/admin/withdrawals/${withdrawalId}`, data),
    transactions: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/transactions${qs ? '?' + qs : ''}`);
    },
  },

  analytics: {
    users: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/analytics/users${qs ? '?' + qs : ''}`);
    },
    streams: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/analytics/streams${qs ? '?' + qs : ''}`);
    },
    engagement: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/analytics/engagement${qs ? '?' + qs : ''}`);
    },
    export: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/analytics/export${qs ? '?' + qs : ''}`);
    },
  },

  moderation: {
    getKeywords: () => request('GET', '/admin/moderation/keywords'),
    addKeyword: (keyword) => request('POST', '/admin/moderation/keywords', { keyword }),
    deleteKeyword: (keywordId) => request('DELETE', `/admin/moderation/keywords/${keywordId}`),
    getLogs: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/moderation/logs${qs ? '?' + qs : ''}`);
    },
  },

  hosts: {
    pending: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/hosts/pending${qs ? '?' + qs : ''}`);
    },
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/hosts${qs ? '?' + qs : ''}`);
    },
    approve: (hostId) => request('PUT', `/admin/hosts/${hostId}/approve`),
    reject: (hostId, reason) => request('PUT', `/admin/hosts/${hostId}/reject`, { reason }),
    assignAgent: (hostId, agentId) =>
      request('PUT', `/admin/hosts/${hostId}/assign-agent`, { agentId }),
  },

  agents: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/agents${qs ? '?' + qs : ''}`);
    },
    create: (data) => request('POST', '/admin/agents/register', data),
    commissions: (agentId, params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/agents/${agentId}/commissions${qs ? '?' + qs : ''}`);
    },
  },

  gifts: {
    list: () => request('GET', '/gifts'),
    create: (data) => request('POST', '/admin/gifts', data),
    update: (giftId, data) => request('PUT', `/admin/gifts/${giftId}`, data),
  },
};

export { AdminAPI, ApiError };
