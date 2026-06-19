const TOKEN_KEY = "kontia_token";

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...opts.headers,
  };

  const res = await fetch(`/api${path}`, { ...opts, headers });

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "/login";
    throw new Error("Sesion expirada");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Error ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function qs(params) {
  if (!params || Object.keys(params).length === 0) return "";
  const s = new URLSearchParams(params).toString();
  return `?${s}`;
}

const api = {
  get: (path, params) => apiFetch(`${path}${qs(params)}`),

  post: (path, data) =>
    apiFetch(path, { method: "POST", body: JSON.stringify(data) }),

  patch: (path, data) =>
    apiFetch(path, { method: "PATCH", body: JSON.stringify(data) }),

  del: (path, id) => apiFetch(`${path}/${id}`, { method: "DELETE" }),

  /* Webhook calls */
  webhook: (endpoint, body) =>
    apiFetch(`/webhook/${endpoint}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* CRUD shortcuts for table records */
  listRecords: (table, params) => api.get(`/data/${table}`, params),
  createRecord: (table, data) => api.post(`/data/${table}`, data),
  updateRecord: (table, data) => api.patch(`/data/${table}`, data),
  deleteRecord: (table, id) => api.del(`/data/${table}`, id),
};

export default api;
export { apiFetch };
