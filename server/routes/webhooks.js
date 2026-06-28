import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const ALLOWED_ENDPOINTS = [
  'procesar-factura',
  'exportar-csv',
  'exportar-a3',
  'exportar-contaplus',
  'exportar-contasol',
  'conciliacion-bancaria',
  'separar-pdf',
];

const SAFE_CONTENT_TYPES = [
  'application/json',
  'text/csv',
  'application/octet-stream',
  'application/zip',
  'text/plain',
];

const MAX_RESPONSE_SIZE = 50 * 1024 * 1024;

const webhookCalls = new Map();
const WEBHOOK_LIMIT = 20;
const WEBHOOK_WINDOW = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [uid, calls] of webhookCalls) {
    const recent = calls.filter(t => now - t < WEBHOOK_WINDOW);
    if (recent.length === 0) webhookCalls.delete(uid);
    else webhookCalls.set(uid, recent);
  }
}, 5 * 60 * 1000).unref();

router.post('/:endpoint', async (req, res) => {
  try {
    const { endpoint } = req.params;

    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return res.status(400).json({ error: `Endpoint no permitido: ${endpoint}` });
    }

    const uid = req.user.id;
    const now = Date.now();
    const calls = (webhookCalls.get(uid) || []).filter(t => now - t < WEBHOOK_WINDOW);
    if (calls.length >= WEBHOOK_LIMIT) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos minutos.' });
    }
    calls.push(now);
    webhookCalls.set(uid, calls);

    const body = { ...req.body, empresa_id: req.user.empresa_id };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    let response;
    try {
      response = await fetch(`${process.env.WEBHOOK_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = response.headers.get('content-type') || '';
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    if (contentLength > MAX_RESPONSE_SIZE) {
      return res.status(502).json({ error: 'Respuesta del webhook demasiado grande' });
    }

    const isSafe = SAFE_CONTENT_TYPES.some((t) => contentType.includes(t));

    if (contentType.includes('application/json')) {
      const text = await response.text();
      if (text.length > MAX_RESPONSE_SIZE) {
        return res.status(502).json({ error: 'Respuesta del webhook demasiado grande' });
      }
      const data = JSON.parse(text);
      res.status(response.status).json(data);
    } else if (isSafe) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_RESPONSE_SIZE) {
        return res.status(502).json({ error: 'Respuesta del webhook demasiado grande' });
      }
      res.status(response.status)
        .set('Content-Type', contentType)
        .set('Content-Disposition', 'attachment')
        .send(Buffer.from(buffer));
    } else {
      res.status(502).json({ error: 'Respuesta del webhook con tipo no permitido' });
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout: el webhook no respondió a tiempo' });
    }
    res.status(500).json({ error: 'Error al conectar con el servicio de procesamiento' });
  }
});

export default router;
