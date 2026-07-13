import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware, validateUser } from '../middleware/auth.js';
import { huellaAlta, huellaAnulacion, qrUrl, fechaHoraHuso } from '../services/verifactu.js';

const router = Router();
router.use(authMiddleware);

const CAN_GENERAR = new Set(['admin', 'contable']);
const TIPOS_EMITIDA = new Set(['venta', 'emitida', 'exportacion']);

const isProd = process.env.NODE_ENV === 'production';
function safeError(err) {
  return isProd ? 'Error interno del servidor' : err.message;
}

async function nifEmpresa(empresaId) {
  const r = await pool.query(
    `SELECT COALESCE(NULLIF(e.nif, ''), NULLIF(c.cif_empresa, '')) AS nif
     FROM empresas e
     LEFT JOIN config c ON c.empresa_id = e.id
     WHERE e.id = $1`,
    [empresaId]
  );
  return r.rows[0]?.nif || null;
}

router.get('/estado', async (req, res) => {
  try {
    const [cfg, stats] = await Promise.all([
      pool.query('SELECT verifactu_activo FROM config WHERE empresa_id = $1', [req.user.empresa_id]),
      pool.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE estado_envio = 'pendiente')::int AS pendientes_envio,
                max(id) AS ultimo_id
         FROM verifactu_registros WHERE empresa_id = $1`,
        [req.user.empresa_id]
      ),
    ]);
    let ultimaHuella = null;
    if (stats.rows[0].ultimo_id) {
      const u = await pool.query('SELECT huella FROM verifactu_registros WHERE id = $1', [stats.rows[0].ultimo_id]);
      ultimaHuella = u.rows[0]?.huella || null;
    }
    res.json({
      activo: cfg.rows[0]?.verifactu_activo === true,
      totalRegistros: stats.rows[0].total,
      pendientesEnvio: stats.rows[0].pendientes_envio,
      ultimaHuella,
      nifEmisor: await nifEmpresa(req.user.empresa_id),
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/config', async (req, res) => {
  try {
    const live = await validateUser(req.user.id, req.user.empresa_id, { live: true });
    if (!live.activo || live.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo un administrador puede activar VeriFactu' });
    }
    const activo = req.body.activo === true || req.body.activo === 'true';
    if (activo && !(await nifEmpresa(req.user.empresa_id))) {
      return res.status(400).json({ error: 'Configura el NIF de la empresa antes de activar VeriFactu (Ajustes → Datos)' });
    }
    await pool.query(
      `INSERT INTO config (empresa_id, verifactu_activo) VALUES ($1, $2)
       ON CONFLICT (empresa_id) DO UPDATE SET verifactu_activo = EXCLUDED.verifactu_activo`,
      [req.user.empresa_id, activo]
    );
    res.json({ activo });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/registros', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const result = await pool.query(
      `SELECT * FROM verifactu_registros WHERE empresa_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3`,
      [req.user.empresa_id, limit, offset]
    );
    res.json({ list: result.rows });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// Facturas emitidas contabilizadas que aún no tienen registro de alta
router.get('/pendientes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.numero_factura, f.fecha_factura, f.nombre_receptor,
              f.total_factura, f.cuota_iva, f.tipo_documento
       FROM facturas f
       WHERE f.empresa_id = $1
         AND f.tipo_documento = ANY($2)
         AND f.eliminada IS NOT TRUE
         AND f.estado = 'contabilizada'
         AND NOT EXISTS (
           SELECT 1 FROM verifactu_registros v
           WHERE v.empresa_id = f.empresa_id AND v.factura_id = f.id AND v.tipo = 'alta'
         )
       ORDER BY f.fecha_factura ASC
       LIMIT 200`,
      [req.user.empresa_id, [...TIPOS_EMITIDA]]
    );
    res.json({ list: result.rows });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/facturas/:id/alta', async (req, res) => {
  try {
    const live = await validateUser(req.user.id, req.user.empresa_id, { live: true });
    if (!live.activo || !CAN_GENERAR.has(live.rol)) {
      return res.status(403).json({ error: 'Solo admin o contable pueden generar registros VeriFactu' });
    }
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Id inválido' });
    }
    const facturaId = parseInt(req.params.id, 10);

    const nif = await nifEmpresa(req.user.empresa_id);
    if (!nif) {
      return res.status(400).json({ error: 'La empresa no tiene NIF configurado' });
    }

    const fr = await pool.query(
      'SELECT * FROM facturas WHERE id = $1 AND empresa_id = $2',
      [facturaId, req.user.empresa_id]
    );
    const f = fr.rows[0];
    if (!f) return res.status(403).json({ error: 'Sin acceso a este registro' });
    if (!TIPOS_EMITIDA.has(f.tipo_documento)) {
      return res.status(422).json({ error: 'VeriFactu solo aplica a facturas emitidas (venta/emitida/exportación)' });
    }
    // Solo facturas contabilizadas: así la factura ya es inmutable (PATCH/DELETE
    // devuelven 409) y el registro encadenado nunca diverge de sus datos
    if (f.estado !== 'contabilizada') {
      return res.status(422).json({ error: 'La factura debe estar contabilizada antes de generar su registro VeriFactu' });
    }
    if (f.eliminada === true) {
      return res.status(422).json({ error: 'La factura está en la papelera' });
    }
    if (!f.numero_factura || !f.fecha_factura) {
      return res.status(422).json({ error: 'La factura necesita número y fecha para generar el registro' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serializa la cadena de huellas por empresa (namespace 4)
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [4, req.user.empresa_id]);

      const dup = await client.query(
        `SELECT id FROM verifactu_registros WHERE empresa_id = $1 AND factura_id = $2 AND tipo = 'alta'`,
        [req.user.empresa_id, facturaId]
      );
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Esta factura ya tiene registro de alta' });
      }

      const prev = await client.query(
        'SELECT huella FROM verifactu_registros WHERE empresa_id = $1 ORDER BY id DESC LIMIT 1',
        [req.user.empresa_id]
      );
      const huellaAnterior = prev.rows[0]?.huella || null;

      const fechaHoraGen = fechaHoraHuso();
      const datos = {
        nifEmisor: nif,
        numSerie: String(f.numero_factura).substring(0, 60),
        fechaExpedicion: f.fecha_factura,
        tipoFactura: 'F1',
        cuotaTotal: f.cuota_iva || 0,
        importeTotal: f.total_factura || 0,
        huellaAnterior,
        fechaHoraGen,
      };
      const huella = huellaAlta(datos);
      const qr = qrUrl(datos);

      const ins = await client.query(
        `INSERT INTO verifactu_registros
           (empresa_id, factura_id, tipo, nif_emisor, num_serie_factura, fecha_expedicion,
            tipo_factura, cuota_total, importe_total, huella_anterior, huella, fecha_hora_gen, qr_url)
         VALUES ($1, $2, 'alta', $3, $4, $5, 'F1', $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [req.user.empresa_id, facturaId, nif, datos.numSerie, f.fecha_factura,
         datos.cuotaTotal, datos.importeTotal, huellaAnterior, huella, fechaHoraGen, qr]
      );
      await client.query('COMMIT');
      res.json({ registro: ins.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Esta factura ya tiene registro de alta' });
    }
    res.status(err.status || 500).json({ error: safeError(err) });
  }
});

router.post('/facturas/:id/anulacion', async (req, res) => {
  try {
    const live = await validateUser(req.user.id, req.user.empresa_id, { live: true });
    if (!live.activo || !CAN_GENERAR.has(live.rol)) {
      return res.status(403).json({ error: 'Solo admin o contable pueden generar registros VeriFactu' });
    }
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Id inválido' });
    }
    const facturaId = parseInt(req.params.id, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [4, req.user.empresa_id]);

      const altaR = await client.query(
        `SELECT * FROM verifactu_registros
         WHERE empresa_id = $1 AND factura_id = $2 AND tipo = 'alta'`,
        [req.user.empresa_id, facturaId]
      );
      const alta = altaR.rows[0];
      if (!alta) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No existe registro de alta para esta factura' });
      }

      const dup = await client.query(
        `SELECT id FROM verifactu_registros WHERE empresa_id = $1 AND factura_id = $2 AND tipo = 'anulacion'`,
        [req.user.empresa_id, facturaId]
      );
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Esta factura ya tiene registro de anulación' });
      }

      const prev = await client.query(
        'SELECT huella FROM verifactu_registros WHERE empresa_id = $1 ORDER BY id DESC LIMIT 1',
        [req.user.empresa_id]
      );
      const huellaAnterior = prev.rows[0]?.huella || null;

      const fechaHoraGen = fechaHoraHuso();
      const huella = huellaAnulacion({
        nifEmisor: alta.nif_emisor,
        numSerie: alta.num_serie_factura,
        fechaExpedicion: alta.fecha_expedicion,
        huellaAnterior,
        fechaHoraGen,
      });

      const ins = await client.query(
        `INSERT INTO verifactu_registros
           (empresa_id, factura_id, tipo, nif_emisor, num_serie_factura, fecha_expedicion,
            tipo_factura, cuota_total, importe_total, huella_anterior, huella, fecha_hora_gen)
         VALUES ($1, $2, 'anulacion', $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [req.user.empresa_id, facturaId, alta.nif_emisor, alta.num_serie_factura,
         alta.fecha_expedicion, alta.tipo_factura, alta.cuota_total, alta.importe_total,
         huellaAnterior, huella, fechaHoraGen]
      );
      await client.query('COMMIT');
      res.json({ registro: ins.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Esta factura ya tiene registro de anulación' });
    }
    res.status(err.status || 500).json({ error: safeError(err) });
  }
});

export default router;
