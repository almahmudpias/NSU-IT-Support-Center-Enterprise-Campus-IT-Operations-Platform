export async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.replace('/login');
    }
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (data && data.message) || (data && data.error) || res.statusText;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const authApi = {
  me: () => api('/auth/me'),
  login: (username, password) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => api('/auth/logout', { method: 'POST' }),
};

export const ticketsApi = {
  all: () => api('/tickets/all'),
  get: (id) => api(`/tickets/${id}`),
  lab: () => api('/tickets/lab'),
  history: (id, opts = {}) => {
    const qs = new URLSearchParams();
    if (opts.limit != null) qs.set('limit', String(opts.limit));
    const s = qs.toString();
    return api(`/tickets/${id}/history${s ? `?${s}` : ''}`);
  },
  create: (payload) => api('/tickets', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, updates, auditDetails) =>
    api(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify({ updates, auditDetails }) }),
  remove: (id) => api(`/tickets/${id}`, { method: 'DELETE' }),
  /** Atomic self-claim — pool: 'campus' | 'workstation' */
  claim: (id, pool = 'campus') =>
    api(`/tickets/${id}/claim`, { method: 'POST', body: JSON.stringify({ pool }) }),
  /** Engineer: release own claim back to the pool */
  returnClaim: (id) => api(`/tickets/${id}/return`, { method: 'POST', body: JSON.stringify({}) }),
  /** Admin: approve engineer-submitted ticket */
  approve: (id, note) =>
    api(`/tickets/${id}/approve`, { method: 'POST', body: JSON.stringify({ note: note || '' }) }),
  /** Admin: reject engineer-submitted ticket */
  reject: (id, reason) =>
    api(`/tickets/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason || '' }) }),
};

/** Engineer-scoped dashboard data (server filters ownership) */
export const engineerApi = {
  workspace: () => api('/engineer/workspace'),
  myWork: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    const s = qs.toString();
    return api(`/engineer/my-work${s ? `?${s}` : ''}`);
  },
  /** Personal report — server binds identity; engineer name/id params are stripped */
  report: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '' && k !== 'engineer' && k !== 'engineerId' && k !== 'userId') {
        qs.set(k, String(v));
      }
    });
    const s = qs.toString();
    return api(`/engineer/report${s ? `?${s}` : ''}`);
  },
};

export const usersApi = {
  search: (q) => api(`/users/search?q=${encodeURIComponent(q)}`),
};

export const staffApi = {
  engineers: () => api('/staff/engineers'),
};

export const staffManageApi = {
  list: () => api('/staff/users'),
  get: (id) => api(`/staff/users/${id}`),
  create: (body) => api('/staff/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/staff/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  permissions: () => api('/staff/me/permissions'),
};

export const eventsApi = {
  list: () => api('/events'),
  all: () => api('/events'),
  get: (id) => api(`/events/${id}`),
  create: (body) => api('/events', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  approve: (id) => api(`/events/${id}/approve`, { method: 'POST', body: JSON.stringify({}) }),
  remove: (id) => api(`/events/${id}`, { method: 'DELETE' }),
};


export const equipmentApi = {
  list: () => api('/equipment'),
  create: (label) => api('/equipment', { method: 'POST', body: JSON.stringify({ label }) }),
};


export const venuesApi = {
  list: () => api('/venues'),
};


export const requestersApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const s = qs.toString();
    return api(`/requesters${s ? `?${s}` : ''}`);
  },
  get: (id) => api(`/requesters/${id}`),
  tickets: (id, params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const s = qs.toString();
    return api(`/requesters/${id}/tickets${s ? `?${s}` : ''}`);
  },
  create: (body) => api('/requesters', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/requesters/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};

export const reportsApi = {
  engineers: (period = 'all', engineer = '') => {
    const params = new URLSearchParams({ period });
    if (engineer) params.set('engineer', engineer);
    return api(`/reports/engineers?${params}`);
  },
};

/** System catalogs managed from Settings (buildings, categories, priorities, roles) */
export const settingsApi = {
  list: (kind, activeOnly = false) =>
    api(`/settings/${kind}${activeOnly ? '?active=1' : ''}`),
  create: (kind, body) =>
    api(`/settings/${kind}`, { method: 'POST', body: JSON.stringify(body) }),
  update: (kind, id, body) =>
    api(`/settings/${kind}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (kind, id) =>
    api(`/settings/${kind}/${id}`, { method: 'DELETE' }),
};

/** Admin Campus Support activity notifications */
export const adminNotificationsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set('limit', String(params.limit));
    const s = qs.toString();
    return api(`/admin/campus-notifications${s ? `?${s}` : ''}`);
  },
  dismiss: (eventKeys) =>
    api('/admin/campus-notifications/dismiss', {
      method: 'POST',
      body: JSON.stringify({
        eventKeys: Array.isArray(eventKeys) ? eventKeys : [eventKeys],
      }),
    }),
};
