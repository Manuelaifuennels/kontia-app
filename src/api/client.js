const TOKEN_KEY = "kontia_token";

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...opts.headers,
  };

  const res = await fetch(`/api${path}`, { ...opts, headers });

  if (res.status === 401 && path !== "/auth/login" && path !== "/auth/register") {
    const hadToken = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem("kontia_user");
    localStorage.removeItem("kontia_token");
    localStorage.removeItem("kontia_empresas");
    if (hadToken) window.location.reload();
    throw new Error("Sesión expirada");
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

  /* Webhook que puede responder con un fichero: si es JSON lo devuelve parseado,
     si es un attachment lo descarga en el navegador y devuelve { downloaded, filename }. */
  webhookDownload: async (endpoint, body) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`/api/webhook/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      const hadToken = localStorage.getItem(TOKEN_KEY);
      localStorage.removeItem("kontia_user");
      localStorage.removeItem("kontia_token");
      localStorage.removeItem("kontia_empresas");
      if (hadToken) window.location.reload();
      throw new Error("Sesión expirada");
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || errBody.error || `Error ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return res.json();
    }
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const filename = match ? decodeURIComponent(match[1]) : `${endpoint}.csv`;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { downloaded: true, filename };
  },

  /* CRUD shortcuts for table records */
  listRecords: (table, params) => api.get(`/data/${table}`, params),

  /* Pagina hasta agotar (el backend capa limit a 500). Tope de seguridad: 10000 filas. */
  listAllRecords: async (table, params = {}) => {
    const pageSize = 500;
    const all = [];
    for (let offset = 0; offset < 10000; offset += pageSize) {
      const data = await api.get(`/data/${table}`, { ...params, limit: pageSize, offset });
      const page = data?.list || [];
      all.push(...page);
      if (page.length < pageSize) break;
    }
    return { list: all };
  },
  createRecord: (table, data) => api.post(`/data/${table}`, data),
  updateRecord: (table, data) => api.patch(`/data/${table}`, data),
  deleteRecord: (table, id) => api.del(`/data/${table}`, id),
};

export default api;
export { apiFetch };
