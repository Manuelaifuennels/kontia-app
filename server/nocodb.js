const NOCO_URL = process.env.NOCO_URL;
const NOCO_TOKEN = process.env.NOCO_TOKEN;

const TABLE_IDS = {
  facturas: 'mztxvchnw7jq49d',
  proveedores: 'mpomtfoa06welx3',
  clientes: 'ms302pf6e8v6q4x',
  reglas: 'mpy1n43sdq83a2w',
  usuarios: 'm79dn02ezzd3hzr',
  config: 'my7h32sj1rt789c',
  ejercicios: 'mvtgv15wb2dz6nl',
  maestro: 'mjwyx04mcr0f5v8',
  actividades: 'mu3z49odknl3asr',
  emisor: 'mpxbjled5ivyru9',
  historial: 'm05sypvi3oh3t9t',
  conectores: 'mwg48dwt0nt962b',
  movimientos: 'mei89o3qe3zlmw6',
};

async function nc(path, opts = {}) {
  const url = `${NOCO_URL}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'xc-token': NOCO_TOKEN,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`NocoDB ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function ncPost(path, body) {
  return nc(path, { method: 'POST', body: JSON.stringify(body) });
}

function ncPatch(path, body) {
  return nc(path, { method: 'PATCH', body: JSON.stringify(body) });
}

function ncDel(path, body) {
  return nc(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined });
}

module.exports = { nc, ncPost, ncPatch, ncDel, TABLE_IDS };
