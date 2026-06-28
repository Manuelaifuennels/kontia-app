import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const ALLOWED_TABLES = new Set([
  'facturas', 'proveedores', 'clientes', 'reglas',
  'usuarios', 'movimientos', 'ejercicios', 'asientos',
  'config', 'emisor', 'historial', 'actividades', 'maestro',
]);

const READONLY_TABLES = new Set(['historial']);

const BLOCKED_CRUD = new Set(['usuarios']);

const USUARIOS_SAFE_COLS = 'id, empresa_id, nombre, email, rol, activo, ultimo_login, created_at, updated_at';

const SORTABLE_COLS = {
  facturas: new Set(['id', 'fecha_factura', 'numero_factura', 'total_factura', 'base_imponible', 'nombre_emisor', 'nombre_receptor', 'tipo_documento', 'estado', 'created_at']),
  proveedores: new Set(['id', 'nombre_proveedor', 'nif_proveedor', 'created_at']),
  clientes: new Set(['id', 'nombre', 'nif', 'created_at']),
  asientos: new Set(['id', 'numero', 'fecha', 'created_at']),
  movimientos: new Set(['id', 'fecha', 'importe', 'created_at']),
  maestro: new Set(['id', 'subcuenta', 'descripcion', 'tipo']),
  ejercicios: new Set(['id', 'anio', 'estado']),
  config: new Set(['id']),
  emisor: new Set(['id']),
  reglas: new Set(['id', 'created_at']),
  usuarios: new Set(['id', 'nombre', 'email', 'rol', 'ultimo_login', 'created_at']),
  historial: new Set(['id', 'fecha_envio', 'destinatario', 'estado', 'created_at']),
  actividades: new Set(['id', 'nombre_actividad', 'created_at']),
};

const COL_RE = /^[a-z_][a-z0-9_]*$/i;
function validCol(name) {
  return COL_RE.test(name);
}

function mapRow(row) {
  if (!row) return row;
  const { id, created_at, updated_at, ...rest } = row;
  return { Id: id, CreatedAt: created_at, UpdatedAt: updated_at, ...rest };
}

const isProd = process.env.NODE_ENV === 'production';
function safeError(err) {
  return isProd ? 'Error interno del servidor' : err.message;
}

router.get('/:table', async (req, res) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(400).json({ error: `Tabla desconocida: ${table}` });
    }

    const { limit = 200, offset = 0, sort } = req.query;

    let orderBy = 'id DESC';
    if (sort) {
      const desc = sort.startsWith('-');
      const col = desc ? sort.slice(1) : sort;
      const allowed = SORTABLE_COLS[table];
      if (allowed && allowed.has(col)) {
        orderBy = `"${col}" ${desc ? 'DESC' : 'ASC'} NULLS LAST`;
      }
    }

    const cols = table === 'usuarios' ? USUARIOS_SAFE_COLS : '*';
    const query = `SELECT ${cols} FROM "${table}" WHERE empresa_id = $1 ORDER BY ${orderBy} LIMIT $2 OFFSET $3`;
    const result = await pool.query(query, [req.user.empresa_id, parseInt(limit), parseInt(offset)]);
    res.json({ list: result.rows.map(mapRow) });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/:table', async (req, res) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(400).json({ error: `Tabla desconocida: ${table}` });
    }
    if (BLOCKED_CRUD.has(table)) {
      return res.status(403).json({ error: 'Usa /api/auth para gestionar usuarios' });
    }
    if (READONLY_TABLES.has(table)) {
      return res.status(403).json({ error: 'Tabla de solo lectura' });
    }
    if (req.user.rol === 'viewer') {
      return res.status(403).json({ error: 'Permiso insuficiente' });
    }

    const body = { ...req.body };
    delete body.Id; delete body.id;
    delete body.nc_order; delete body.CreatedAt; delete body.UpdatedAt;
    delete body.created_at; delete body.updated_at;
    body.empresa_id = req.user.empresa_id;

    const keys = Object.keys(body).filter(validCol);
    const values = keys.map((k) => body[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const query = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await pool.query(query, values);
    res.json(mapRow(result.rows[0]));
  } catch (err) {
    res.status(err.status || 500).json({ error: safeError(err) });
  }
});

router.patch('/:table', async (req, res) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(400).json({ error: `Tabla desconocida: ${table}` });
    }
    if (READONLY_TABLES.has(table)) {
      return res.status(403).json({ error: 'Tabla de solo lectura' });
    }
    if (req.user.rol === 'viewer') {
      return res.status(403).json({ error: 'Permiso insuficiente' });
    }

    const recordId = req.body.Id || req.body.id;
    if (!recordId) return res.status(400).json({ error: 'Id requerido' });

    const check = await pool.query(
      `SELECT id FROM "${table}" WHERE id = $1 AND empresa_id = $2`,
      [recordId, req.user.empresa_id]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'Sin acceso a este registro' });
    }

    const body = { ...req.body };
    delete body.Id; delete body.id;
    delete body.nc_order; delete body.CreatedAt; delete body.UpdatedAt;
    delete body.created_at; delete body.updated_at;
    delete body.empresa_id;

    if (table === 'usuarios') {
      delete body.password;
      delete body.rol;
      delete body.activo;
    }

    const keys = Object.keys(body).filter(validCol);
    if (keys.length === 0) return res.status(400).json({ error: 'No hay campos que actualizar' });

    const values = keys.map((k) => body[k]);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    values.push(recordId, req.user.empresa_id);

    const returning = table === 'usuarios' ? USUARIOS_SAFE_COLS : '*';
    const query = `UPDATE "${table}" SET ${setClause} WHERE id = $${keys.length + 1} AND empresa_id = $${keys.length + 2} RETURNING ${returning}`;
    const result = await pool.query(query, values);

    if (table === 'config' && body.cif_empresa) {
      try {
        await pool.query(
          'UPDATE empresas SET nif = $1 WHERE id = $2',
          [body.cif_empresa.trim().toUpperCase(), req.user.empresa_id]
        );
      } catch {}
    }

    res.json(mapRow(result.rows[0]));
  } catch (err) {
    res.status(err.status || 500).json({ error: safeError(err) });
  }
});

router.delete('/:table/:id', async (req, res) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(400).json({ error: `Tabla desconocida: ${table}` });
    }
    if (BLOCKED_CRUD.has(table)) {
      return res.status(403).json({ error: 'Usa /api/auth para gestionar usuarios' });
    }
    if (READONLY_TABLES.has(table)) {
      return res.status(403).json({ error: 'Tabla de solo lectura' });
    }
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden eliminar registros' });
    }

    const result = await pool.query(
      `DELETE FROM "${table}" WHERE id = $1 AND empresa_id = $2 RETURNING id`,
      [req.params.id, req.user.empresa_id]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Sin acceso a este registro' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: safeError(err) });
  }
});

export default router;
