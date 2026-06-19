import { Router } from 'express';
import { nc, ncPost, ncPatch, ncDel, TABLE_IDS } from '../nocodb.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const EMPRESA_FIELD = { usuarios: 'empresa_id2' };

function empresaCol(table) {
  return EMPRESA_FIELD[table] || 'empresa_id';
}

function resolveTable(req, res) {
  const name = req.params.table;
  const tableId = TABLE_IDS[name];
  if (!tableId) {
    res.status(400).json({ error: `Tabla desconocida: ${name}` });
    return null;
  }
  return tableId;
}

router.get('/:table', async (req, res) => {
  try {
    const tableId = resolveTable(req, res);
    if (!tableId) return;

    const col = empresaCol(req.params.table);
    const { limit, offset, sort, fields, where: extraWhere, ...rest } = req.query;
    const empresaWhere = `(${col},eq,${req.user.empresa_id})`;
    const where = extraWhere ? `${empresaWhere}~and${extraWhere}` : empresaWhere;

    const params = new URLSearchParams({ where });
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    if (sort) params.set('sort', sort);
    if (fields) params.set('fields', fields);
    for (const [k, v] of Object.entries(rest)) {
      params.set(k, v);
    }

    const data = await nc(`/tables/${tableId}/records?${params}`);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:table', async (req, res) => {
  try {
    const tableId = resolveTable(req, res);
    if (!tableId) return;

    const col = empresaCol(req.params.table);
    const inject = { [col]: req.user.empresa_id };
    const body = Array.isArray(req.body)
      ? req.body.map((r) => ({ ...r, ...inject }))
      : { ...req.body, ...inject };

    const data = await ncPost(`/tables/${tableId}/records`, body);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:table', async (req, res) => {
  try {
    const tableId = resolveTable(req, res);
    if (!tableId) return;

    const recordId = req.body?.Id;
    if (!recordId) return res.status(400).json({ error: 'Id requerido' });

    const col = empresaCol(req.params.table);
    const existing = await nc(`/tables/${tableId}/records/${recordId}`);
    if (String(existing[col]) !== String(req.user.empresa_id)) {
      return res.status(403).json({ error: 'Sin acceso a este registro' });
    }

    const body = { ...req.body, [col]: req.user.empresa_id };
    const data = await ncPatch(`/tables/${tableId}/records`, body);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:table/:id', async (req, res) => {
  try {
    const tableId = resolveTable(req, res);
    if (!tableId) return;

    const col = empresaCol(req.params.table);
    const existing = await nc(`/tables/${tableId}/records/${req.params.id}`);
    if (String(existing[col]) !== String(req.user.empresa_id)) {
      return res.status(403).json({ error: 'Sin acceso a este registro' });
    }

    const data = await ncDel(`/tables/${tableId}/records`, [{ Id: Number(req.params.id) }]);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
