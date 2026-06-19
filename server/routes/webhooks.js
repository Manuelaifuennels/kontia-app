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

router.post('/:endpoint', async (req, res) => {
  try {
    const { endpoint } = req.params;

    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return res.status(400).json({ error: `Endpoint no permitido: ${endpoint}` });
    }

    const body = { ...req.body, empresa_id: req.user.empresa_id };

    const response = await fetch(`${process.env.WEBHOOK_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const buffer = await response.arrayBuffer();
      res.status(response.status)
        .set('Content-Type', contentType)
        .send(Buffer.from(buffer));
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
