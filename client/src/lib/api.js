const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('loadflow_token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

export const api = {
  signupOrg: (payload) => request('/auth/signup-org', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/me'),

  permissionCatalog: () => request('/roles/catalog'),
  listRoles: () => request('/roles'),
  createRole: (payload) => request('/roles', { method: 'POST', body: payload }),
  deleteRole: (id) => request(`/roles/${id}`, { method: 'DELETE' }),

  listStaff: () => request('/staff'),
  createStaff: (payload) => request('/staff', { method: 'POST', body: payload }),

  listOrgs: (type) => request(`/orgs?type=${type}`),

  myCompliance: () => request('/compliance/mine'),
  updateMyCompliance: (payload) => request('/compliance/mine', { method: 'PUT', body: payload }),

  listLoads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/loads${qs ? `?${qs}` : ''}`);
  },
  getLoad: (id) => request(`/loads/${id}`),
  createLoad: (payload) => request('/loads', { method: 'POST', body: payload }),
  assignCarrier: (id, carrierOrgId) => request(`/loads/${id}/assign-carrier`, { method: 'POST', body: { carrierOrgId } }),
  transitionLoad: (id, payload) => request(`/loads/${id}/transition`, { method: 'POST', body: payload }),
  confirmRate: (id, payload) => request(`/loads/${id}/rate-confirmations`, { method: 'POST', body: payload }),
};

export { getToken };
