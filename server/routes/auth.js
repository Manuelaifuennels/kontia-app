import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { authMiddleware, signToken, invalidateUserCache, validateUser } from '../middleware/auth.js';

const router = Router();

const DUMMY_HASH = bcrypt.hashSync('kontia-dummy-never-matches-x7k9', 12);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NIF_CIF_RE = /^[A-Z]\d{7}[A-Z0-9]$|^\d{8}[A-Z]$|^[XYZ]\d{7}[A-Z]$/;

// Mono-instancia: rate limiters en memoria son válidos solo con un proceso Node. Si se escala horizontalmente, migrar a Redis o pg_advisory_lock.
const RATE_WINDOW = 15 * 60 * 1000;
const loginRateMap = new Map();
const registerRateMap = new Map();
const accountLockMap = new Map();
const accountLockGlobalMap = new Map();

setInterval(() => {
  const now = Date.now();
  for (const store of [loginRateMap, registerRateMap, accountLockMap, accountLockGlobalMap]) {
    for (const [key, attempts] of store) {
      const recent = attempts.filter(t => now - t < RATE_WINDOW);
      if (recent.length === 0) store.delete(key);
      else store.set(key, recent);
    }
  }
}, 5 * 60 * 1000).unref();

function makeRateLimit(store, max) {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const attempts = store.get(ip) || [];
    const recent = attempts.filter(t => now - t < RATE_WINDOW);
    if (recent.length >= max) {
      return res.status(429).json({ message: 'Demasiados intentos. Espera 15 minutos.' });
    }
    recent.push(now);
    store.set(ip, recent);
    next();
  };
}

const loginRateLimit = makeRateLimit(loginRateMap, 10);
const registerRateLimit = makeRateLimit(registerRateMap, 5);

async function getEmpresasForUser(userId) {
  const result = await pool.query(
    `SELECT e.id AS empresa_id, e.nombre AS empresa_nombre, e.nif, ue.rol
     FROM usuarios_empresas ue
     JOIN empresas e ON e.id = ue.empresa_id
     WHERE ue.usuario_id = $1
     ORDER BY ue.created_at ASC`,
    [userId]
  );
  return result.rows;
}

router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña requeridos' });
    }

    const emailNorm = email.toLowerCase().trim();
    const lockKey = `${emailNorm}:${req.ip}`;

    const acctFails = (accountLockMap.get(lockKey) || []).filter(t => Date.now() - t < RATE_WINDOW);
    if (acctFails.length >= 5) {
      return res.status(429).json({ message: 'Cuenta bloqueada temporalmente. Espera 15 minutos.' });
    }

    const acctGlobal = (accountLockGlobalMap.get(emailNorm) || []).filter(t => Date.now() - t < RATE_WINDOW);
    if (acctGlobal.length >= 30) {
      return res.status(429).json({ message: 'Demasiados intentos en esta cuenta. Verificación adicional requerida.' });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.nombre, u.password, u.rol, u.activo,
              u.empresa_id, e.nombre AS empresa_nombre
       FROM usuarios u
       JOIN empresas e ON e.id = u.empresa_id
       WHERE u.email = $1`,
      [emailNorm]
    );

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user?.password || DUMMY_HASH);
    if (!user || !valid || !user.activo) {
      if (acctFails.length < 50) acctFails.push(Date.now());
      accountLockMap.set(lockKey, acctFails);
      if (acctGlobal.length < 200) acctGlobal.push(Date.now());
      accountLockGlobalMap.set(emailNorm, acctGlobal);
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    accountLockMap.delete(lockKey);
    accountLockGlobalMap.delete(emailNorm);

    await pool.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [user.id]);

    const empresas = await getEmpresasForUser(user.id);

    const activeEmpresa = empresas.length > 0
      ? empresas[0]
      : { empresa_id: user.empresa_id, empresa_nombre: user.empresa_nombre, nif: null, rol: user.rol || 'usuario' };

    const payload = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      empresa_id: activeEmpresa.empresa_id,
      empresa_nombre: activeEmpresa.empresa_nombre,
      rol: activeEmpresa.rol,
    };

    const token = signToken(payload);
    res.json({ token, user: payload, empresas: empresas.length > 0 ? empresas : [activeEmpresa] });
  } catch (err) {
    res.status(500).json({ message: 'Error en login' });
  }
});

router.post('/register', registerRateLimit, async (req, res) => {
  try {
    const { email, password, nombre, empresa_nombre, nif_empresa } = req.body;
    if (!email || !password || !nombre || !empresa_nombre) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ message: 'Formato de email inválido' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const nifNorm = (nif_empresa || '').trim().toUpperCase();
    if (nifNorm && !NIF_CIF_RE.test(nifNorm)) {
      return res.status(400).json({ message: 'Formato de NIF/CIF inválido' });
    }

    const exists = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Este email ya está registrado' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (nifNorm) {
        const nifCheck = await client.query('SELECT id FROM empresas WHERE nif = $1', [nifNorm]);
        if (nifCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Ya existe una empresa con este NIF/CIF' });
        }
      }

      const empresa = await client.query(
        'INSERT INTO empresas (nombre, nif) VALUES ($1, $2) RETURNING id',
        [empresa_nombre, nifNorm || null]
      );
      const empresaId = empresa.rows[0].id;

      const hash = await bcrypt.hash(password, 12);

      const usuario = await client.query(
        `INSERT INTO usuarios (empresa_id, nombre, email, password, rol, activo)
         VALUES ($1, $2, $3, $4, 'usuario', true) RETURNING id`,
        [empresaId, nombre, email.toLowerCase().trim(), hash]
      );
      const userId = usuario.rows[0].id;

      await client.query(
        `INSERT INTO usuarios_empresas (usuario_id, empresa_id, rol)
         VALUES ($1, $2, 'admin')
         ON CONFLICT (usuario_id, empresa_id) DO NOTHING`,
        [userId, empresaId]
      );

      await client.query(
        `INSERT INTO config (empresa_id, cif_empresa, nombre_empresa)
         VALUES ($1, $2, $3)
         ON CONFLICT (empresa_id) DO NOTHING`,
        [empresaId, nifNorm || null, empresa_nombre]
      );

      await client.query('COMMIT');

      const payload = {
        id: userId,
        email: email.toLowerCase().trim(),
        nombre,
        empresa_id: empresaId,
        empresa_nombre,
        rol: 'admin',
      };

      const empresas = [{ empresa_id: empresaId, empresa_nombre, nif: nifNorm || null, rol: 'admin' }];

      const token = signToken(payload);
      res.json({ token, user: payload, empresas });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Este email ya está registrado' });
    }
    res.status(500).json({ message: 'Error en registro' });
  }
});

router.post('/switch-empresa', authMiddleware, async (req, res) => {
  try {
    const rawEid = String(req.body.empresa_id || '');
    if (!/^\d+$/.test(rawEid)) {
      return res.status(400).json({ message: 'empresa_id inválido' });
    }
    const eid = parseInt(rawEid, 10);
    if (eid <= 0) {
      return res.status(400).json({ message: 'empresa_id inválido' });
    }

    const access = await pool.query(
      `SELECT ue.rol, e.nombre AS empresa_nombre
       FROM usuarios_empresas ue
       JOIN empresas e ON e.id = ue.empresa_id
       WHERE ue.usuario_id = $1 AND ue.empresa_id = $2`,
      [req.user.id, eid]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ message: 'Sin acceso a esta empresa' });
    }

    const { rol, empresa_nombre } = access.rows[0];

    invalidateUserCache(req.user.id, eid);

    const payload = {
      id: req.user.id,
      email: req.user.email,
      nombre: req.user.nombre,
      empresa_id: eid,
      empresa_nombre,
      rol,
    };

    const token = signToken(payload);
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ message: 'Error al cambiar empresa' });
  }
});

const MAX_EMPRESAS_PER_USER = 50;

router.post('/create-empresa', authMiddleware, async (req, res) => {
  try {
    const { nombre, nif } = req.body;
    if (!nombre) {
      return res.status(400).json({ message: 'Nombre de empresa obligatorio' });
    }

    const nifNorm = (nif || '').trim().toUpperCase();
    if (nifNorm && !NIF_CIF_RE.test(nifNorm)) {
      return res.status(400).json({ message: 'Formato de NIF/CIF inválido' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [3, req.user.id]);

      const countResult = await client.query(
        'SELECT count(*)::int AS total FROM usuarios_empresas WHERE usuario_id = $1',
        [req.user.id]
      );
      if (countResult.rows[0].total >= MAX_EMPRESAS_PER_USER) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Máximo ${MAX_EMPRESAS_PER_USER} empresas por usuario` });
      }

      if (nifNorm) {
        const nifCheck = await client.query('SELECT id FROM empresas WHERE nif = $1', [nifNorm]);
        if (nifCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Ya existe una empresa con este NIF/CIF' });
        }
      }

      const empresa = await client.query(
        'INSERT INTO empresas (nombre, nif) VALUES ($1, $2) RETURNING id, nombre, nif',
        [nombre.trim(), nifNorm || null]
      );

      await client.query(
        `INSERT INTO usuarios_empresas (usuario_id, empresa_id, rol)
         VALUES ($1, $2, 'admin')`,
        [req.user.id, empresa.rows[0].id]
      );

      await client.query(
        `INSERT INTO config (empresa_id, cif_empresa, nombre_empresa)
         VALUES ($1, $2, $3)`,
        [empresa.rows[0].id, empresa.rows[0].nif, nombre.trim()]
      );

      await client.query('COMMIT');

      invalidateUserCache(req.user.id);

      const empresas = await getEmpresasForUser(req.user.id);
      res.json({ empresa: empresa.rows[0], empresas });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: 'Error al crear empresa' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const empresas = await getEmpresasForUser(req.user.id);
    res.json({ user: req.user, empresas });
  } catch {
    res.json({ user: req.user, empresas: [] });
  }
});

// ── Gestión de usuarios de la empresa (solo admin) ──────────────────────────

const VALID_ROLES = new Set(['admin', 'editor', 'contable', 'usuario']);

async function requireAdmin(req, res) {
  const live = await validateUser(req.user.id, req.user.empresa_id, { live: true });
  if (!live.activo || live.rol !== 'admin') {
    res.status(403).json({ message: 'Solo un administrador puede gestionar usuarios' });
    return false;
  }
  return true;
}

router.post('/users', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios' });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ message: 'Formato de email inválido' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const rolNorm = VALID_ROLES.has(rol) ? rol : 'usuario';
    const emailNorm = email.toLowerCase().trim();

    const exists = await pool.query('SELECT id FROM usuarios WHERE email = $1', [emailNorm]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Este email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const nuevo = await client.query(
        `INSERT INTO usuarios (empresa_id, nombre, email, password, rol, activo)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, empresa_id, nombre, email, rol, activo, ultimo_login, created_at, updated_at`,
        [req.user.empresa_id, nombre.trim(), emailNorm, hash, rolNorm]
      );
      await client.query(
        `INSERT INTO usuarios_empresas (usuario_id, empresa_id, rol)
         VALUES ($1, $2, $3)
         ON CONFLICT (usuario_id, empresa_id) DO NOTHING`,
        [nuevo.rows[0].id, req.user.empresa_id, rolNorm]
      );
      await client.query('COMMIT');
      res.json({ user: nuevo.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Este email ya está registrado' });
    }
    res.status(500).json({ message: 'Error al crear usuario' });
  }
});

router.patch('/users/:id/rol', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ message: 'Id inválido' });
    }
    const targetId = parseInt(req.params.id, 10);
    const { rol } = req.body;
    if (!VALID_ROLES.has(rol)) {
      return res.status(400).json({ message: 'Rol no válido' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serializa los cambios de rol por empresa: evita que dos admins se degraden
      // mutuamente a la vez y dejen la empresa sin ningún administrador (namespace 5)
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [5, req.user.empresa_id]);

      const member = await client.query(
        'SELECT rol FROM usuarios_empresas WHERE usuario_id = $1 AND empresa_id = $2',
        [targetId, req.user.empresa_id]
      );
      if (member.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Usuario no encontrado en esta empresa' });
      }

      // Si se degrada a un admin actual (sea quien sea), debe quedar al menos
      // otro admin ACTIVO en la empresa
      if (member.rows[0].rol === 'admin' && rol !== 'admin') {
        const otherAdmins = await client.query(
          `SELECT count(*)::int AS n
           FROM usuarios_empresas ue
           JOIN usuarios u ON u.id = ue.usuario_id AND u.activo = true
           WHERE ue.empresa_id = $1 AND ue.rol = 'admin' AND ue.usuario_id != $2`,
          [req.user.empresa_id, targetId]
        );
        if (otherAdmins.rows[0].n === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'No se puede degradar: es el único administrador activo de la empresa' });
        }
      }

      await client.query(
        'UPDATE usuarios_empresas SET rol = $1 WHERE usuario_id = $2 AND empresa_id = $3',
        [rol, targetId, req.user.empresa_id]
      );
      await client.query('COMMIT');
      invalidateUserCache(targetId, req.user.empresa_id);
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: 'Error al actualizar rol' });
  }
});

router.patch('/users/:id/activo', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ message: 'Id inválido' });
    }
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) {
      return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
    }
    const activo = req.body.activo === true || req.body.activo === 'true';

    const member = await pool.query(
      'SELECT id FROM usuarios_empresas WHERE usuario_id = $1 AND empresa_id = $2',
      [targetId, req.user.empresa_id]
    );
    if (member.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado en esta empresa' });
    }

    // usuarios.activo es GLOBAL: solo se permite desactivar a usuarios cuya única
    // empresa sea esta — un admin de A no puede bloquear el acceso de un gestor a B
    if (!activo) {
      const memberships = await pool.query(
        'SELECT count(*)::int AS n FROM usuarios_empresas WHERE usuario_id = $1',
        [targetId]
      );
      if (memberships.rows[0].n > 1) {
        return res.status(409).json({
          message: 'Este usuario pertenece a varias empresas: no se puede desactivar globalmente desde aquí. Quítale el acceso cambiando su rol.',
        });
      }
    }

    await pool.query('UPDATE usuarios SET activo = $1 WHERE id = $2', [activo, targetId]);
    invalidateUserCache(targetId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

export default router;
