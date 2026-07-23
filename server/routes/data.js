import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware, validateUser } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const ALLOWED_TABLES = new Set([
  'facturas', 'proveedores', 'clientes', 'reglas',
  'usuarios', 'movimientos', 'ejercicios', 'asientos', 'apuntes',
  'config', 'emisor', 'historial', 'actividades', 'maestro', 'conectores',
]);

// asientos/apuntes solo se escriben desde el endpoint contabilizar. OJO: apuntes
// NO tiene columna empresa_id — si algún día se saca de READONLY, el CRUD genérico
// (que antepone empresa_id en INSERT y filtra por él en UPDATE/DELETE) fallará:
// habría que escribir ramas específicas vía JOIN con asientos.
const READONLY_TABLES = new Set(['historial', 'asientos', 'apuntes']);
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
    'estado', 'eliminada',
  ]),
  asientos: new Set([
    'fecha', 'concepto', 'ejercicio_id', 'factura_id', 'numero',
  ]),
  movimientos: new Set([
    'fecha', 'concepto', 'importe', 'referencia',
    'cuenta_bancaria', 'conciliado', 'saldo', 'factura_id',
  ]),
  // anio solo se acepta en POST (creación); en PATCH se elimina del body para
  // impedir mutar el año de un ejercicio con asientos ya numerados (N24-05)
  ejercicios: new Set([
    'anio', 'estado', 'bloqueado', 'fecha_cierre', 'fecha_inicio', 'fecha_fin',
  ]),
  conectores: new Set([
    'tipo', 'punto', 'email_asociado',
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
const VALID_TIPO_DOCUMENTO = new Set(['recibida', 'emitida', 'rectificativa', 'intracomunitaria', 'importacion', 'exportacion', 'compra', 'venta']);
const VALID_ESTADO = new Set(['procesando', 'pendiente', 'error', 'duplicada']);
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
  apuntes: new Set(['id', 'asiento_id', 'cuenta', 'debe', 'haber']),
  conectores: new Set(['id', 'tipo', 'punto', 'created_at']),
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

function recalcFactura(data, { skipDualModeCheck = false } = {}) {
  const hasMultiIva = IVA_BRACKETS.some(b => {
    const v = parseFloat(data[b.base]);
    return Number.isFinite(v) && v !== 0;
  });

  // El guard anti-ambigüedad aplica a INPUT DE CLIENTE. Las filas que vienen de la
  // DB llevan legítimamente ambos modos (el pipeline n8n guarda agregado + tramos):
  // ahí el desglose por tramos manda y el agregado se recalcula.
  if (!skipDualModeCheck && hasMultiIva && Number.isFinite(parseFloat(data.base_imponible)) && parseFloat(data.base_imponible) > 0 && Number.isFinite(parseFloat(data.tipo_iva)) && parseFloat(data.tipo_iva) > 0) {
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
    if (!hasAnyBase && base <= 0) {
      return res.status(400).json({ error: 'Factura sin importe: base_imponible debe ser mayor que 0' });
    }

    recalcFactura(row, { skipDualModeCheck: true });

    const isIntracomunitaria = row.tipo_documento === 'intracomunitaria';
    let isCompra;
    if (row.tipo_documento === 'rectificativa' || isIntracomunitaria) {
      if (row.proveedor_id) {
        isCompra = true;
      } else if (row.cliente_id) {
        isCompra = false;
      } else if (isIntracomunitaria && row.cuenta_gasto && String(row.cuenta_gasto)[0] === '7') {
        isCompra = false;
      } else {
        isCompra = true;
      }
    } else {
      isCompra = row.tipo_documento === 'compra' || row.tipo_documento === 'recibida'
        || row.tipo_documento === 'importacion' || !row.tipo_documento;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const anio = new Date(row.fecha_factura).getFullYear();
      const currentYear = new Date().getFullYear();
      if (!anio || anio < 2000 || anio > currentYear + 1) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: `Año ${anio} fuera de rango válido (2000–${currentYear + 1}). Revisa fecha_factura.` });
      }
      // El lock se toma ANTES de buscar/crear el ejercicio: serializa tanto la
      // numeración de asientos como la auto-creación del ejercicio del año
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [1, req.user.empresa_id]);

      let ejercicioId;
      const ejR = await client.query(
        'SELECT id, estado, bloqueado FROM ejercicios WHERE empresa_id = $1 AND anio = $2 FOR SHARE',
        [req.user.empresa_id, anio]
      );
      if (ejR.rows.length > 0) {
        if (ejR.rows[0].bloqueado || ejR.rows[0].estado === 'cerrado') {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Ejercicio bloqueado' });
        }
        ejercicioId = ejR.rows[0].id;
      } else {
        const newEj = await client.query(
          'INSERT INTO ejercicios (empresa_id, anio, estado) VALUES ($1, $2, $3) RETURNING id',
          [req.user.empresa_id, anio, 'abierto']
        );
        ejercicioId = newEj.rows[0].id;
      }

      const numR = await client.query(
        'SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM asientos WHERE empresa_id = $1 AND ejercicio_id = $2',
        [req.user.empresa_id, ejercicioId]
      );
      const nextNum = numR.rows[0].n;

      let cuentaGasto = row.cuenta_gasto || (isCompra ? '629' : '705');
      let cuentaTercero = isCompra ? '400' : '430';

      if (isCompra && (row.nombre_emisor || row.nif_emisor)) {
        const prov = await client.query(
          `SELECT cuenta_proveedor, cuenta_gasto FROM proveedores
           WHERE empresa_id = $1 AND (nombre_proveedor = $2 OR nif_proveedor = $3) LIMIT 1`,
          [req.user.empresa_id, row.nombre_emisor || '', row.nif_emisor || '']
        );
        if (prov.rows.length > 0) {
          if (prov.rows[0].cuenta_proveedor) cuentaTercero = prov.rows[0].cuenta_proveedor;
          if (!row.cuenta_gasto && prov.rows[0].cuenta_gasto) cuentaGasto = prov.rows[0].cuenta_gasto;
        }
      } else if (!isCompra && (row.nombre_receptor || row.nif_receptor)) {
        const cli = await client.query(
          `SELECT cuenta_cliente, cuenta_ingresos FROM clientes
           WHERE empresa_id = $1 AND (nombre = $2 OR nif = $3) LIMIT 1`,
          [req.user.empresa_id, row.nombre_receptor || '', row.nif_receptor || '']
        );
        if (cli.rows.length > 0) {
          if (cli.rows[0].cuenta_cliente) cuentaTercero = cli.rows[0].cuenta_cliente;
          if (!row.cuenta_gasto && cli.rows[0].cuenta_ingresos) cuentaGasto = cli.rows[0].cuenta_ingresos;
        }
      }

      const emisorNom = isCompra ? (row.nombre_emisor || '') : (row.nombre_receptor || row.nombre_emisor || '');
      const concepto = `${row.numero_factura || 'S/N'} ${emisorNom}`.trim();

      const asientoR = await client.query(
        `INSERT INTO asientos (empresa_id, ejercicio_id, numero, fecha, concepto, factura_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [req.user.empresa_id, ejercicioId, nextNum, row.fecha_factura, concepto, facturaId]
      );
      const asientoId = asientoR.rows[0].id;

      const apuntes = [];

      for (const bracket of IVA_BRACKETS) {
        const bv = parseFloat(row[bracket.base]) || 0;
        const cv = parseFloat(row[bracket.cuota]) || 0;
        if (bv <= 0) continue;
        const pct = bracket.rate > 0 ? ` ${parseFloat((bracket.rate * 100).toFixed(2))}%` : '';
        if (isCompra) {
          apuntes.push({ cuenta: cuentaGasto, debe: bv, haber: 0, concepto: `Gasto${pct}` });
          if (cv > 0) apuntes.push({ cuenta: '472', debe: cv, haber: 0, concepto: `IVA sop.${pct}` });
        } else {
          apuntes.push({ cuenta: cuentaGasto, debe: 0, haber: bv, concepto: `Ingreso${pct}` });
          if (cv > 0) apuntes.push({ cuenta: '477', debe: 0, haber: cv, concepto: `IVA rep.${pct}` });
        }
      }

      if (apuntes.length === 0 && Number.isFinite(base) && base > 0) {
        const cuotaIva = parseFloat(row.cuota_iva) || 0;
        if (isCompra) {
          apuntes.push({ cuenta: cuentaGasto, debe: base, haber: 0, concepto: 'Gasto' });
          if (cuotaIva > 0) apuntes.push({ cuenta: '472', debe: cuotaIva, haber: 0, concepto: `IVA sop. ${tipoIva}%` });
        } else {
          apuntes.push({ cuenta: cuentaGasto, debe: 0, haber: base, concepto: 'Ingreso' });
          if (cuotaIva > 0) apuntes.push({ cuenta: '477', debe: 0, haber: cuotaIva, concepto: `IVA rep. ${tipoIva}%` });
        }
      }

      if (isIntracomunitaria && isCompra) {
        let autorepIva = 0;
        for (const bracket of IVA_BRACKETS) {
          const cv = parseFloat(row[bracket.cuota]) || 0;
          if (cv > 0) autorepIva += cv;
        }
        if (autorepIva === 0) autorepIva = parseFloat(row.cuota_iva) || 0;
        if (autorepIva > 0) {
          apuntes.push({ cuenta: '477', debe: 0, haber: autorepIva, concepto: 'IVA rep. (autorrepercusión intracom.)' });
        }
      }

      const reqCuota = parseFloat(row.cuota_req) || 0;
      if (reqCuota > 0 && isCompra) {
        apuntes.push({ cuenta: '472', debe: reqCuota, haber: 0, concepto: `Rec. equiv. ${row.pct_req || ''}%` });
      }

      const retCuota = parseFloat(row.cuota_retencion) || 0;
      if (retCuota > 0) {
        if (isCompra) {
          apuntes.push({ cuenta: '4751', debe: 0, haber: retCuota, concepto: `IRPF ${row.pct_retencion || ''}%` });
        } else {
          apuntes.push({ cuenta: '473', debe: retCuota, haber: 0, concepto: `IRPF ${row.pct_retencion || ''}%` });
        }
      }

      const sumDebe = apuntes.reduce((s, a) => s + a.debe, 0);
      const sumHaber = apuntes.reduce((s, a) => s + a.haber, 0);
      const terceroImporte = Math.round(Math.abs(sumDebe - sumHaber) * 100) / 100;
      if (terceroImporte > 0) {
        if (isCompra) {
          apuntes.push({ cuenta: cuentaTercero, debe: 0, haber: terceroImporte, concepto });
        } else {
          apuntes.push({ cuenta: cuentaTercero, debe: terceroImporte, haber: 0, concepto });
        }
      }

      const totalDebe = apuntes.reduce((s, a) => s + a.debe, 0);
      const totalHaber = apuntes.reduce((s, a) => s + a.haber, 0);
      if (apuntes.length < 2 ||
          (Math.round(totalDebe * 100) === 0 && Math.round(totalHaber * 100) === 0)) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'Factura sin movimiento contable: no se puede contabilizar (importe 0 o asiento incompleto).' });
      }
      if (Math.round(Math.abs(totalDebe - totalHaber) * 100) !== 0) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'Asiento descuadrado tras el cálculo. Revisa los importes de la factura.' });
      }

      // Rectificativas: asiento inverso (abono). Convención del pipeline: los importes
      // llegan en positivo y aquí se intercambia debe<->haber (el cuadre se preserva).
      // Desactivable por empresa vía config.cambio_signo_rectificativas.
      if (row.tipo_documento === 'rectificativa') {
        const cfgRect = await client.query(
          'SELECT cambio_signo_rectificativas FROM config WHERE empresa_id = $1',
          [req.user.empresa_id]
        );
        if (cfgRect.rows[0]?.cambio_signo_rectificativas !== false) {
          for (const ap of apuntes) {
            const d = ap.debe;
            ap.debe = ap.haber;
            ap.haber = d;
          }
        }
      }

      for (const ap of apuntes) {
        await client.query(
          'INSERT INTO apuntes (asiento_id, cuenta, debe, haber, concepto) VALUES ($1,$2,$3,$4,$5)',
          [asientoId, ap.cuenta, ap.debe, ap.haber, ap.concepto]
        );
      }

      const setCols = [`estado = 'contabilizada'`];
      const setVals = [];
      let p = 1;
      for (const col of COMPUTED_COLS.facturas) {
        if (row[col] !== undefined) { setCols.push(`"${col}" = $${p++}`); setVals.push(row[col]); }
      }
      setCols.push(`"base_imponible" = $${p++}`); setVals.push(row.base_imponible);
      setCols.push(`contabilizada_por = $${p++}`); setVals.push(req.user.id);
      setCols.push(`contabilizada_at = NOW()`);
      setCols.push(`fecha_contabilizacion = NOW()::date`);
      setCols.push(`"numero_asiento" = $${p++}`); setVals.push(nextNum);
      setVals.push(facturaId, req.user.empresa_id);

      const facturaResult = await client.query(
        `UPDATE facturas SET ${setCols.join(', ')}
         WHERE id = $${p} AND empresa_id = $${p + 1} AND estado != 'contabilizada' RETURNING *`,
        setVals
      );
      if (facturaResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Factura ya contabilizada (concurrencia)' });
      }

      await client.query('COMMIT');
      res.json({ ...mapRow(facturaResult.rows[0]), asiento: { id: asientoId, numero: nextNum, apuntes } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23514') {
      return res.status(409).json({ error: 'Ejercicio cerrado o bloqueado: no se puede contabilizar' });
    }
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

    // apuntes no tiene empresa_id: el aislamiento multi-tenant se hereda del asiento padre
    if (table === 'apuntes') {
      let apOrder = 'ap.id DESC';
      if (sort) {
        const desc = sort.startsWith('-');
        const col = desc ? sort.slice(1) : sort;
        if (SORTABLE_COLS.apuntes.has(col)) {
          apOrder = `ap."${col}" ${desc ? 'DESC' : 'ASC'} NULLS LAST`;
        }
      }
      const params = [req.user.empresa_id, limit, offset];
      let filter = '';
      const rawAsientoId = Array.isArray(req.query.asiento_id) ? req.query.asiento_id[0] : req.query.asiento_id;
      if (rawAsientoId && /^\d+$/.test(String(rawAsientoId))) {
        params.push(parseInt(rawAsientoId, 10));
        filter = ` AND ap.asiento_id = $${params.length}`;
      }
      const result = await pool.query(
        `SELECT ap.* FROM apuntes ap
         JOIN asientos s ON s.id = ap.asiento_id
         WHERE s.empresa_id = $1${filter}
         ORDER BY ${apOrder} LIMIT $2 OFFSET $3`,
        params
      );
      return res.json({ list: result.rows.map(mapRow) });
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

    const dateCol = table === 'facturas' ? 'fecha_factura' : 'fecha';
    if (FISCAL_DATE_TABLES.has(table) && body[dateCol]) {
      if (await ejercicioBloqueado(req.user.empresa_id, body[dateCol])) {
        return res.status(409).json({ error: 'Ejercicio bloqueado: no se puede crear registro en periodo cerrado' });
      }
    }

    if (table === 'config' && body.cif_empresa) {
      const cif = String(body.cif_empresa).trim().toUpperCase();
      if (!NIF_CIF_RE.test(cif)) {
        return res.status(400).json({ error: 'Formato de CIF/NIF inválido' });
      }
      body.cif_empresa = cif;
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
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un registro con esos datos (duplicado)' });
    }
    res.status(err.status || 500).json({ error: safeError(err) });
  }
});

router.patch('/:table', async (req, res) => {
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
      if (body.estado) {
        if (!CAN_CONTABILIZAR.has(liveWrite.rol) || body.estado === 'contabilizada' || !VALID_ESTADO.has(body.estado)) {
          delete body.estado;
        }
      } else {
        delete body.estado;
      }
      // eliminada admite true (papelera) y false (restaurar), solo para roles con delete
      if (body.eliminada === true || body.eliminada === 'true'
          || body.eliminada === false || body.eliminada === 'false') {
        if (CAN_DELETE.has(liveWrite.rol)) {
          body.eliminada = body.eliminada === true || body.eliminada === 'true';
        } else {
          delete body.eliminada;
        }
      } else {
        delete body.eliminada;
      }
      delete body.contabilizada_por;
      delete body.contabilizada_at;
      delete body.fecha_contabilizacion;
      if (body.tipo_documento && !VALID_TIPO_DOCUMENTO.has(body.tipo_documento)) {
        return res.status(400).json({ error: 'tipo_documento no válido' });
      }
    }

    if (table === 'config' && body.cif_empresa) {
      const cif = String(body.cif_empresa).trim().toUpperCase();
      if (!NIF_CIF_RE.test(cif)) {
        return res.status(400).json({ error: 'Formato de CIF/NIF inválido' });
      }
      body.cif_empresa = cif;
    }

    if (table === 'ejercicios') {
      delete body.anio;
      if ('bloqueado' in body) {
        body.bloqueado = body.bloqueado === true || body.bloqueado === 'true';
      }
      // abrir/cerrar/bloquear un ejercicio altera el régimen de inmutabilidad fiscal:
      // reservado a admin y contable, no a editores
      if (('estado' in body || 'bloqueado' in body) && !CAN_CONTABILIZAR.has(liveWrite.rol)) {
        return res.status(403).json({ error: 'Solo admin o contable pueden cambiar el estado de un ejercicio' });
      }
    }

    if (table === 'ejercicios' && (body.estado === 'cerrado' || body.bloqueado === true)) {
      if (body.estado === 'cerrado') delete body.fecha_cierre;
      const cierreKeys = editableKeys(body, table);
      if (cierreKeys.length === 0) return res.status(400).json({ error: 'No hay campos que actualizar' });
      const cierreValues = cierreKeys.map(k => body[k]);
      let cierreSet = cierreKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
      if (body.estado === 'cerrado') cierreSet += ', "fecha_cierre" = NOW()';
      cierreValues.push(recordId, req.user.empresa_id);
      const cierreQuery = `UPDATE ejercicios SET ${cierreSet} WHERE id = $${cierreKeys.length + 1} AND empresa_id = $${cierreKeys.length + 2} RETURNING *`;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1, $2)', [2, recordId]);

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
      // El guard de modos mixtos se evalúa SOLO sobre lo que envía el cliente;
      // la fila de DB lleva legítimamente agregado + tramos (pipeline n8n)
      const bodyHasBrackets = IVA_BRACKETS.some(b => parseFloat(body[b.base]) > 0);
      const bodyHasSingle = parseFloat(body.base_imponible) > 0 && parseFloat(body.tipo_iva) > 0;
      if (bodyHasBrackets && bodyHasSingle) {
        return res.status(400).json({ error: 'No envíes base_imponible+tipo_iva junto a bases por tramo (base_iva_X). Usa un modo u otro.' });
      }
      const merged = { ...fcurrent, ...body };
      recalcFactura(merged, { skipDualModeCheck: true });
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

    if (table === 'ejercicios') {
      const ejCheck = await pool.query(
        'SELECT estado, bloqueado FROM ejercicios WHERE id = $1 AND empresa_id = $2',
        [deleteId, req.user.empresa_id]
      );
      if (ejCheck.rows[0] && (ejCheck.rows[0].estado === 'cerrado' || ejCheck.rows[0].bloqueado)) {
        return res.status(409).json({ error: 'Ejercicio cerrado o bloqueado: no se puede eliminar. Reábrelo primero.' });
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
    if (err.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: el registro tiene datos asociados (asientos, facturas u otros).' });
    }
    res.status(err.status || 500).json({ error: safeError(err) });
  }
});

export default router;
