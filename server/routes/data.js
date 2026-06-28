import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware, validateUser } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const ALLOWED_TABLES = new Set([
  'facturas', 'proveedores', 'clientes', 'reglas',
  'usuarios', 'movimientos', 'ejercicios', 'asientos', 'apuntes',
  'config', 'emisor', 'historial', 'actividades', 'maestro',
]);

const READONLY_TABLES = new Set(['historial']);
const BLOCKED_CRUD = new Set(['usuarios']);

const CAN_WRITE = new Set(['admin', 'editor', 'contable']);
const CAN_DELETE = new Set(['admin']);

const USUARIOS_SAFE_COLS = 'id, empresa_id, nombre, email, rol, activo, ultimo_login, created_at, updated_at';

const TABLE_SELECT_COLS = {
  usuarios: USUARIOS_SAFE_COLS,
};

const IVA_BRACKETS = [
  { base: 'base_iva_21', cuota: 'cuota_iva_21', rate: 0.21 },
  { base: 'base_iva_12', cuota: 'cuota_iva_12', rate: 0.12 },
  { base: 'base_iva_10_5', cuota: 'cuota_iva_10_5', rate: 0.105 },
  { base: 'base_iva_10', cuota: 'cuota_iva_10', rate: 0.10 },
  { base: 'base_iva_5', cuota: 'cuota_iva_5', rate: 0.05 },
  { base: 'base_iva_4', cuota: 'cuota_iva_4', rate: 0.04 },
  { base: 'base_iva_0', cuota: 'cuota_iva_0', rate: 0 },
  { base: 'base_iva_0_no_ex', cuota: 'cuota_iva_0_no_ex', rate: 0 },
  { base: 'base_iva_0_no_sujeto', cuota: 'cuota_iva_0_no_sujeto', rate: 0 },
];

const EDITABLE_COLS = {
  facturas: new Set([
    'nombre_emisor', 'nif_emisor', 'nombre_receptor', 'nif_receptor',
    'fecha_factura', 'numero_factura',
    'base_imponible', 'tipo_iva', 'tipo_retencion', 'pct_retencion',
    'base_req', 'pct_req',
    ...IVA_BRACKETS.map(b => b.base),
    'tipo_documento', 'archivo_url', 'archivo_nombre',
    'proveedor_id', 'cliente_id',
    'metodo_pago', 'cuenta_gasto', 'cuenta_tercero',
    'numero_asiento', 'confianza_ia',
  ]),
  asientos: new Set([
    'fecha', 'concepto', 'ejercicio_id', 'factura_id', 'numero',
  ]),
  movimientos: new Set([
    'fecha', 'concepto', 'importe', 'referencia',
    'cuenta_bancaria', 'conciliado', 'saldo', 'factura_id',
  ]),
  apuntes: new Set([
    'cuenta', 'subcuenta', 'debe', 'haber', 'concepto',
  ]),
};

const SYSTEM_COLS = new Set(['id', 'empresa_id', 'created_at', 'updated_at']);

const NIF_CIF_RE = /^[A-Z]\d{7}[A-Z0-9]$|^\d{8}[A-Z]$|^[XYZ]\d{7}[A-Z]$/;

const COMPUTED_COLS = {
  facturas: new Set([
    'cuota_iva', 'total_factura', 'cuota_req', 'cuota_retencion',
    ...IVA_BRACKETS.map(b => b.cuota),
  ]),
};

const PERIOD_TABLES = new Set(['asientos', 'movimientos']);
const FISCAL_DATE_TABLES = new Set(['asientos', 'movimientos', 'facturas']);
const CAN_CONTABILIZAR = new Set(['admin', 'contable']);
const VALID_IVA = new Set([0, 4, 5, 10, 10.5, 12, 21]);
const VALID_TIPO_DOCUMENTO = new Set(['recibida', 'emitida', 'rectificativa', 'intracomunitaria', 'importacion', 'exportacion']);
const MAX_BASE = 1e9;
const MAX_REQ = 10;
const MAX_RETENCION = 60;

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
  apuntes: new Set(['id', 'asiento_id', 'cuenta', 'subcuenta', 'debe', 'haber']),
};

const COL_RE = /^[a-z_][a-z0-9_]*$/i;
function validCol(name) {
  return COL_RE.test(name);
}

function editableKeys(body, table, computedApplied = false) {
  const wl = EDITABLE_COLS[table];
  const computed = COMPUTED_COLS[table];
  if (wl) return Object.keys(body).filter(k => wl.has(k) || (computedApplied && computed && computed.has(k)));
  return Object.keys(body).filter(k => validCol(k) && !SYSTEM_COLS.has(k));
}

function recalcFactura(data) {
  const hasMultiIva = IVA_BRACKETS.some(b => {
    const v = parseFloat(data[b.base]);
    return Number.isFinite(v) && v !== 0;
  });

  if (hasMultiIva && Number.isFinite(parseFloat(data.base_imponible)) && parseFloat(data.base_imponible) > 0 && Number.isFinite(parseFloat(data.tipo_iva)) && parseFloat(data.tipo_iva) > 0) {
    throw Object.assign(new Error('No envíes base_imponible+tipo_iva junto a bases por tramo (base_iva_X). Usa un modo u otro.'), { status: 400 });
  }

  let totalBase = 0;
  let totalCuota = 0;

  if (hasMultiIva) {
    for (const bracket of IVA_BRACKETS) {
      const base = parseFloat(data[bracket.base]) || 0;
      if (base < 0 || base > MAX_BASE)
        throw Object.assign(new Error(`${bracket.base} fuera de rango (0 a ${MAX_BASE})`), { status: 400 });
      const cuota = Math.round(base * bracket.rate * 100) / 100;
      data[bracket.cuota] = cuota;
      totalBase += base;
      totalCuota += cuota;
    }
    if (totalBase > MAX_BASE)
      throw Object.assign(new Error('Suma de bases por tramo fuera de rango (máx 1.000.000.000)'), { status: 400 });
    data.base_imponible = Math.round(totalBase * 100) / 100;
    data.cuota_iva = Math.round(totalCuota * 100) / 100;
  } else {
    const base = parseFloat(data.base_imponible);
    const tipoIva = parseFloat(data.tipo_iva);
    if (!Number.isFinite(base) || !Number.isFinite(tipoIva)) return;
    if (base < 0 || base > MAX_BASE)
      throw Object.assign(new Error('base_imponible fuera de rango (0 a 1.000.000.000)'), { status: 400 });
    if (!VALID_IVA.has(tipoIva))
      throw Object.assign(new Error('tipo_iva no válido (permitidos: 0, 4, 5, 10, 10.5, 12, 21)'), { status: 400 });
    data.cuota_iva = Math.round(base * tipoIva) / 100;
    totalBase = base;
    totalCuota = data.cuota_iva;
  }

  const pctReq = parseFloat(data.pct_req) || 0;
  if (pctReq < 0 || pctReq > MAX_REQ)
    throw Object.assign(new Error('pct_req fuera de rango (0 a 10)'), { status: 400 });
  const pctRet = parseFloat(data.pct_retencion) || 0;
  if (pctRet < 0 || pctRet > MAX_RETENCION)
    throw Object.assign(new Error('pct_retencion fuera de rango (0 a 60)'), { status: 400 });
  data.cuota_req = Math.round(totalBase * pctReq) / 100;
  data.cuota_retencion = Math.round(totalBase * pctRet) / 100;
  data.total_factura = Math.round((totalBase + totalCuota - data.cuota_retencion + data.cuota_req) * 100) / 100;
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

async function ejercicioBloqueado(empresaId, fecha) {
  if (!fecha) return false;
  const d = new Date(fecha);
  const anio = d.getFullYear();
  if (!Number.isFinite(anio)) return false;
  const r = await pool.query(
    'SELECT bloqueado, estado FROM ejercicios WHERE empresa_id = $1 AND anio = $2',
    [empresaId, anio]
  );
  const ej = r.rows[0];
  if (!ej) return false;
  return ej.bloqueado || ej.estado === 'cerrado';
}

async function verificarApunteOwnership(apunteId, empresaId) {
  const r = await pool.query(
    `SELECT a.id, s.fecha FROM apuntes a
     JOIN asientos s ON s.id = a.asiento_id
     WHERE a.id = $1 AND s.empresa_id = $2`,
    [apunteId, empresaId]
  );
  return r.rows[0] || null;
}

router.post('/facturas/:id/contabilizar', async (req, res) => {
  try {
    const liveUser = await validateUser(req.user.id, req.user.empresa_id, { live: true });
    if (!CAN_CONTABILIZAR.has(liveUser.rol)) {
      return res.status(403).json({ error: 'Solo admin o contable pueden contabilizar' });
    }

    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Id inválido' });
    }
    const facturaId = parseInt(req.params.id, 10);

    const fcheck = await pool.query(
      'SELECT * FROM facturas WHERE id = $1 AND empresa_id = $2',
      [facturaId, req.user.empresa_id]
    );
    if (fcheck.rows.length === 0) {
      return res.status(403).json({ error: 'Sin acceso a este registro' });
    }
    if (fcheck.rows[0].estado === 'contabilizada') {
      return res.status(409).json({ error: 'Factura ya contabilizada' });
    }

    const row = fcheck.rows[0];

    if (await ejercicioBloqueado(req.user.empresa_id, row.fecha_factura)) {
      return res.status(409).json({ error: 'Ejercicio bloqueado: no se puede contabilizar' });
    }

    const base = parseFloat(row.base_imponible);
    const tipoIva = parseFloat(row.tipo_iva);
    const hasAnyBase = IVA_BRACKETS.some(b => parseFloat(row[b.base]) > 0);
    if (!hasAnyBase && (!Number.isFinite(base) || !Number.isFinite(tipoIva))) {
      return res.status(400).json({ error: 'Factura incompleta: falta base_imponible o tipo_iva' });
    }

    recalcFactura(row);

    const setCols = [`estado = 'contabilizada'`];
    const setVals = [];
    let p = 1;

    for (const col of COMPUTED_COLS.facturas) {
      if (row[col] !== undefined) {
        setCols.push(`"${col}" = $${p++}`);
        setVals.push(row[col]);
      }
    }
    setCols.push(`"base_imponible" = $${p++}`);
    setVals.push(row.base_imponible);
    setCols.push(`contabilizada_por = $${p++}`);
    setVals.push(req.user.id);
    setCols.push(`contabilizada_at = NOW()`);
    setCols.push(`fecha_contabilizacion = NOW()::date`);

    setVals.push(facturaId, req.user.empresa_id);

    const result = await pool.query(
      `UPDATE facturas SET ${setCols.join(', ')}
       WHERE id = $${p} AND empresa_id = $${p + 1} AND estado != 'contabilizada' RETURNING *`,
      setVals
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'Factura ya contabilizada' });
    }

    res.json(mapRow(result.rows[0]));
  } catch (err) {
    res.status(err.status || 500).json({ error: safeError(err) });
  }
});

router.get('/:table', async (req, res) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(400).json({ error: `Tabla desconocida: ${table}` });
    }

    const sort = Array.isArray(req.query.sort) ? req.query.sort[0] : req.query.sort;
    const limit = Math.min(Math.max(parseInt(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit, 10) || 200, 1), 500);
    const offset = Math.max(parseInt(Array.isArray(req.query.offset) ? req.query.offset[0] : req.query.offset, 10) || 0, 0);

    let orderBy = 'id DESC';
    if (sort) {
      const desc = sort.startsWith('-');
      const col = desc ? sort.slice(1) : sort;
      const allowed = SORTABLE_COLS[table];
      if (allowed && allowed.has(col)) {
        orderBy = `"${col}" ${desc ? 'DESC' : 'ASC'} NULLS LAST`;
      }
    }

    const cols = TABLE_SELECT_COLS[table] || '*';
    const query = `SELECT ${cols} FROM "${table}" WHERE empresa_id = $1 ORDER BY ${orderBy} LIMIT $2 OFFSET $3`;
    const result = await pool.query(query, [req.user.empresa_id, limit, offset]);
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
    const liveWrite = await validateUser(req.user.id, req.user.empresa_id, { live: true });
    if (!CAN_WRITE.has(liveWrite.rol)) {
      return res.status(403).json({ error: 'Permiso insuficiente' });
    }

    const body = { ...req.body };
    delete body.Id; delete body.id;
    delete body.nc_order; delete body.CreatedAt; delete body.UpdatedAt;
    delete body.created_at; delete body.updated_at;
    delete body.empresa_id;

    if (table === 'apuntes') {
      if (!body.asiento_id || !/^\d+$/.test(String(body.asiento_id))) {
        return res.status(400).json({ error: 'asiento_id requerido (entero positivo)' });
      }
      const asientoCheck = await pool.query(
        'SELECT id, fecha FROM asientos WHERE id = $1 AND empresa_id = $2',
        [parseInt(body.asiento_id, 10), req.user.empresa_id]
      );
      if (asientoCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Asiento no encontrado o sin acceso' });
      }
      if (await ejercicioBloqueado(req.user.empresa_id, asientoCheck.rows[0].fecha)) {
        return res.status(409).json({ error: 'Ejercicio bloqueado: no se puede añadir apunte' });
      }
    }

    const dateCol = table === 'facturas' ? 'fecha_factura' : 'fecha';
    if (FISCAL_DATE_TABLES.has(table) && body[dateCol]) {
      if (await ejercicioBloqueado(req.user.empresa_id, body[dateCol])) {
        return res.status(409).json({ error: 'Ejercicio bloqueado: no se puede crear registro en periodo cerrado' });
      }
    }

    let computedApplied = false;
    if (table === 'facturas') {
      delete body.estado;
      delete body.eliminada;
      delete body.contabilizada_por;
      delete body.contabilizada_at;
      delete body.fecha_contabilizacion;
      if (body.tipo_documento && !VALID_TIPO_DOCUMENTO.has(body.tipo_documento)) {
        return res.status(400).json({ error: 'tipo_documento no válido' });
      }
      for (const col of COMPUTED_COLS.facturas) delete body[col];
      recalcFactura(body);
      computedApplied = true;
    }
    const keys = editableKeys(body, table, computedApplied);
    const allKeys = ['empresa_id', ...keys];
    const allValues = [req.user.empresa_id, ...keys.map(k => body[k])];
    const placeholders = allKeys.map((_, i) => `$${i + 1}`);

    const query = `INSERT INTO "${table}" (${allKeys.map((k) => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await pool.query(query, allValues);
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
    const liveWrite = await validateUser(req.user.id, req.user.empresa_id, { live: true });
    if (!CAN_WRITE.has(liveWrite.rol)) {
      return res.status(403).json({ error: 'Permiso insuficiente' });
    }

    const rawId = String(req.body.Id || req.body.id || '');
    if (!/^\d+$/.test(rawId)) {
      return res.status(400).json({ error: 'Id requerido (entero positivo)' });
    }
    const recordId = parseInt(rawId, 10);
    if (recordId <= 0) {
      return res.status(400).json({ error: 'Id requerido (entero positivo)' });
    }

    let fcurrent = null;
    if (table === 'facturas') {
      const fcheck = await pool.query(
        'SELECT * FROM facturas WHERE id = $1 AND empresa_id = $2',
        [recordId, req.user.empresa_id]
      );
      if (fcheck.rows.length === 0) {
        return res.status(403).json({ error: 'Sin acceso a este registro' });
      }
      if (fcheck.rows[0].estado === 'contabilizada') {
        return res.status(409).json({ error: 'Factura contabilizada: no se puede modificar' });
      }
      if (fcheck.rows[0].fecha_factura && await ejercicioBloqueado(req.user.empresa_id, fcheck.rows[0].fecha_factura)) {
        return res.status(409).json({ error: 'Ejercicio bloqueado: factura inmutable' });
      }
      fcurrent = fcheck.rows[0];
    } else if (table === 'apuntes') {
      const apunte = await verificarApunteOwnership(recordId, req.user.empresa_id);
      if (!apunte) {
        return res.status(403).json({ error: 'Sin acceso a este registro' });
      }
      if (await ejercicioBloqueado(req.user.empresa_id, apunte.fecha)) {
        return res.status(409).json({ error: 'Ejercicio bloqueado: apunte inmutable' });
      }
    } else {
      const check = await pool.query(
        `SELECT id FROM "${table}" WHERE id = $1 AND empresa_id = $2`,
        [recordId, req.user.empresa_id]
      );
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Sin acceso a este registro' });
      }
    }

    if (PERIOD_TABLES.has(table)) {
      const fechaCheck = await pool.query(
        `SELECT fecha FROM "${table}" WHERE id = $1 AND empresa_id = $2`,
        [recordId, req.user.empresa_id]
      );
      const currentFecha = fechaCheck.rows[0]?.fecha;
      if (!currentFecha) {
        return res.status(400).json({ error: 'Registro sin fecha válida' });
      }
      if (await ejercicioBloqueado(req.user.empresa_id, currentFecha)) {
        return res.status(409).json({ error: 'Ejercicio bloqueado: registro inmutable' });
      }
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

    if (table === 'facturas') {
      delete body.estado;
      delete body.eliminada;
      delete body.contabilizada_por;
      delete body.contabilizada_at;
      delete body.fecha_contabilizacion;
      if (body.tipo_documento && !VALID_TIPO_DOCUMENTO.has(body.tipo_documento)) {
        return res.status(400).json({ error: 'tipo_documento no válido' });
      }
    }

    if (table === 'config' && body.cif_empresa) {
      const cif = body.cif_empresa.trim().toUpperCase();
      if (!NIF_CIF_RE.test(cif)) {
        return res.status(400).json({ error: 'Formato de CIF/NIF inválido' });
      }
    }

    if (table === 'ejercicios' && (body.estado === 'cerrado' || body.bloqueado === true)) {
      const cierreKeys = editableKeys(body, table);
      if (cierreKeys.length === 0) return res.status(400).json({ error: 'No hay campos que actualizar' });
      const cierreValues = cierreKeys.map(k => body[k]);
      const cierreSet = cierreKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
      cierreValues.push(recordId, req.user.empresa_id);
      const cierreQuery = `UPDATE ejercicios SET ${cierreSet} WHERE id = $${cierreKeys.length + 1} AND empresa_id = $${cierreKeys.length + 2} RETURNING *`;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [recordId]);

        const descuadrados = await client.query(
          `SELECT a.id, a.numero,
                  COALESCE(SUM(ap.debe),0) AS total_debe,
                  COALESCE(SUM(ap.haber),0) AS total_haber,
                  COUNT(ap.id) AS num_apuntes
           FROM asientos a
           LEFT JOIN apuntes ap ON ap.asiento_id = a.id
           WHERE a.ejercicio_id = $1 AND a.empresa_id = $2
           GROUP BY a.id, a.numero
           HAVING COALESCE(SUM(ap.debe),0) <> COALESCE(SUM(ap.haber),0)
               OR COUNT(ap.id) = 0
           LIMIT 5`,
          [recordId, req.user.empresa_id]
        );
        if (descuadrados.rows.length > 0) {
          await client.query('ROLLBACK');
          const ids = descuadrados.rows.map(r => r.numero || `#${r.id}`).join(', ');
          return res.status(409).json({
            error: `No se puede cerrar: asientos descuadrados o vacíos (${ids}). Corrige el cuadre antes de cerrar el ejercicio.`,
          });
        }

        const cierreResult = await client.query(cierreQuery, cierreValues);
        await client.query('COMMIT');
        return res.json(mapRow(cierreResult.rows[0]));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const dateCol = table === 'facturas' ? 'fecha_factura' : 'fecha';
    if (FISCAL_DATE_TABLES.has(table) && body[dateCol]) {
      if (await ejercicioBloqueado(req.user.empresa_id, body[dateCol])) {
        return res.status(409).json({ error: 'Fecha destino en ejercicio bloqueado' });
      }
    }

    let computedApplied = false;
    if (table === 'facturas' && fcurrent) {
      for (const col of COMPUTED_COLS.facturas) delete body[col];
      const merged = { ...fcurrent, ...body };
      recalcFactura(merged);
      for (const col of COMPUTED_COLS.facturas) {
        if (merged[col] !== undefined) body[col] = merged[col];
      }
      body.base_imponible = merged.base_imponible;
      computedApplied = true;
    }
    const keys = editableKeys(body, table, computedApplied);
    if (keys.length === 0) return res.status(400).json({ error: 'No hay campos que actualizar' });

    const values = keys.map((k) => body[k]);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    values.push(recordId, req.user.empresa_id);

    const returning = table === 'usuarios' ? USUARIOS_SAFE_COLS : '*';
    const query = `UPDATE "${table}" SET ${setClause} WHERE id = $${keys.length + 1} AND empresa_id = $${keys.length + 2} RETURNING ${returning}`;

    const cifSync = table === 'config' && body.cif_empresa;
    let result;

    if (cifSync) {
      const cif = body.cif_empresa.trim().toUpperCase();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        result = await client.query(query, values);
        await client.query('UPDATE empresas SET nif = $1 WHERE id = $2', [cif, req.user.empresa_id]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
          return res.status(409).json({ error: 'Ya existe otra empresa con este NIF/CIF' });
        }
        throw err;
      } finally {
        client.release();
      }
    } else {
      result = await pool.query(query, values);
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
    const liveUser = await validateUser(req.user.id, req.user.empresa_id, { live: true });
    if (!CAN_DELETE.has(liveUser.rol)) {
      return res.status(403).json({ error: 'Solo administradores pueden eliminar registros' });
    }

    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Id inválido' });
    }
    const deleteId = parseInt(req.params.id, 10);
    if (deleteId <= 0) {
      return res.status(400).json({ error: 'Id inválido' });
    }

    if (table === 'facturas') {
      const fcheck = await pool.query(
        'SELECT estado, fecha_factura FROM facturas WHERE id = $1 AND empresa_id = $2',
        [deleteId, req.user.empresa_id]
      );
      if (fcheck.rows[0]?.estado === 'contabilizada') {
        return res.status(409).json({ error: 'Factura contabilizada: no se puede eliminar' });
      }
      if (fcheck.rows[0]?.fecha_factura && await ejercicioBloqueado(req.user.empresa_id, fcheck.rows[0].fecha_factura)) {
        return res.status(409).json({ error: 'Ejercicio bloqueado: factura inmutable' });
      }
    }

    if (table === 'apuntes') {
      const apunte = await verificarApunteOwnership(deleteId, req.user.empresa_id);
      if (!apunte) {
        return res.status(403).json({ error: 'Sin acceso a este registro' });
      }
      if (await ejercicioBloqueado(req.user.empresa_id, apunte.fecha)) {
        return res.status(409).json({ error: 'Ejercicio bloqueado: apunte inmutable' });
      }
    }

    if (PERIOD_TABLES.has(table)) {
      const fechaCheck = await pool.query(
        `SELECT fecha FROM "${table}" WHERE id = $1 AND empresa_id = $2`,
        [deleteId, req.user.empresa_id]
      );
      const currentFecha = fechaCheck.rows[0]?.fecha;
      if (!currentFecha) {
        return res.status(400).json({ error: 'Registro sin fecha válida' });
      }
      if (await ejercicioBloqueado(req.user.empresa_id, currentFecha)) {
        return res.status(409).json({ error: 'Ejercicio bloqueado: registro inmutable' });
      }
    }

    const result = await pool.query(
      `DELETE FROM "${table}" WHERE id = $1 AND empresa_id = $2 RETURNING id`,
      [deleteId, req.user.empresa_id]
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
