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

router.post('/:endpoint', async (req, res) => {
  try {
    const { endpoint } = req.params;

    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return res.status(400).json({ error: `Endpoint no permitido: ${endpoint}` });
    }

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
    const isSafe = SAFE_CONTENT_TYPES.some((t) => contentType.includes(t));

    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else if (isSafe) {
      const buffer = await response.arrayBuffer();
      res.status(response.status)
        .set('Content-Type', contentType)
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
