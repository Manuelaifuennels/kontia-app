const { Router } = require('express');
const { nc, ncPost, ncPatch, ncDel, TABLE_IDS } = require('../nocodb');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

function resolveTable(req, res) {
  const name = req.params.table;
  const tableId = TABLE_IDS[name];
  if (!tableId) {
    res.status(400).json({ error: `Tabla desconocida: ${name}` });
    return null;
  }
  return tableId;
}

// List records
router.get('/:table', async (req, res) => {
  try {
    const tableId = resolveTable(req, res);
    if (!tableId) return;

    const { limit, offset, sort, fields, where: extraWhere, ...rest } = req.query;
    const empresaWhere = `(empresa_id,eq,${req.user.empresa_id})`;
    const where = extraWhere ? `${empresaWhere}~and${extraWhere}` : empresaWhere;

    const params = new URLSearchParams({ where });
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    if (sort) params.set('sort', sort);
    if (fields) params.set('fields', fields);
    // Forward any other query params
    for (const [k, v] of Object.entries(rest)) {
      params.set(k, v);
    }

    const data = await nc(`/tables/${tableId}/records?${params}`);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Create record
router.post('/:table', async (req, res) => {
  try {
    const tableId = resolveTable(req, res);
    if (!tableId) return;

    const body = Array.isArray(req.body)
      ? req.body.map((r) => ({ ...r, empresa_id: req.user.empresa_id }))
      : { ...req.body, empresa_id: req.user.empresa_id };

    const data = await ncPost(`/tables/${tableId}/records`, body);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Update records
router.patch('/:table', async (req, res) => {
  try {
    const tableId = resolveTable(req, res);
    if (!tableId) return;

    const data = await ncPatch(`/tables/${tableId}/records`, req.body);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Delete record
router.delete('/:table/:id', async (req, res) => {
  try {
    const tableId = resolveTable(req, res);
    if (!tableId) return;

    const data = await ncDel(`/tables/${tableId}/records`, [{ Id: Number(req.params.id) }]);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
