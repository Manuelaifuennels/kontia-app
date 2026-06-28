import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { authMiddleware, signToken } from '../middleware/auth.js';

const router = Router();

const loginAttempts = new Map();

setInterval(() => {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  for (const [ip, attempts] of loginAttempts) {
    const recent = attempts.filter((t) => now - t < window);
    if (recent.length === 0) loginAttempts.delete(ip);
    else loginAttempts.set(ip, recent);
  }
}, 5 * 60 * 1000).unref();

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const maxAttempts = 10;
  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter((t) => now - t < window);
  if (recent.length >= maxAttempts) {
    return res.status(429).json({ message: 'Demasiados intentos. Espera 15 minutos.' });
  }
  recent.push(now);
  loginAttempts.set(ip, recent);
  next();
}

async function getEmpresasForUser(userId) {
  try {
    const result = await pool.query(
      `SELECT e.id AS empresa_id, e.nombre AS empresa_nombre, e.nif, ue.rol
       FROM usuarios_empresas ue
       JOIN empresas e ON e.id = ue.empresa_id
       WHERE ue.usuario_id = $1
       ORDER BY ue.created_at ASC`,
      [userId]
    );
    return result.rows;
  } catch {
    return [];
  }
}

router.post('/login', rateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña requeridos' });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.nombre, u.password, u.rol, u.activo,
              u.empresa_id, e.nombre AS empresa_nombre
       FROM usuarios u
       JOIN empresas e ON e.id = u.empresa_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const user = result.rows[0];

    if (!user.activo) {
      return res.status(401).json({ message: 'Cuenta desactivada' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    await pool.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [user.id]);

    let empresas = await getEmpresasForUser(user.id);
    if (empresas.length === 0) {
      empresas = [{ empresa_id: user.empresa_id, empresa_nombre: user.empresa_nombre, nif: null, rol: user.rol || 'admin' }];
    }

    const activeEmpresa = empresas[0];

    const payload = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      empresa_id: activeEmpresa.empresa_id,
      empresa_nombre: activeEmpresa.empresa_nombre,
      rol: activeEmpresa.rol,
    };

    const token = signToken(payload);
    res.json({ token, user: payload, empresas });
  } catch (err) {
    res.status(500).json({ message: 'Error en login' });
  }
});

router.post('/register', rateLimit, async (req, res) => {
  try {
    const { email, password, nombre, empresa_nombre, nif_empresa } = req.body;
    if (!email || !password || !nombre || !empresa_nombre) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
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

      const empresa = await client.query(
        'INSERT INTO empresas (nombre, nif) VALUES ($1, $2) RETURNING id',
        [empresa_nombre, (nif_empresa || '').trim().toUpperCase() || null]
      );
      const empresaId = empresa.rows[0].id;

      const hash = await bcrypt.hash(password, 12);

      const usuario = await client.query(
        `INSERT INTO usuarios (empresa_id, nombre, email, password, rol, activo)
         VALUES ($1, $2, $3, $4, 'admin', true) RETURNING id`,
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
         ON CONFLICT DO NOTHING`,
        [empresaId, (nif_empresa || '').trim().toUpperCase() || null, empresa_nombre]
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

      const empresas = [{ empresa_id: empresaId, empresa_nombre, nif: (nif_empresa || '').trim().toUpperCase() || null, rol: 'admin' }];

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
    const { empresa_id } = req.body;
    if (!empresa_id) {
      return res.status(400).json({ message: 'empresa_id requerido' });
    }

    const access = await pool.query(
      `SELECT ue.rol, e.nombre AS empresa_nombre
       FROM usuarios_empresas ue
       JOIN empresas e ON e.id = ue.empresa_id
       WHERE ue.usuario_id = $1 AND ue.empresa_id = $2`,
      [req.user.id, empresa_id]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ message: 'Sin acceso a esta empresa' });
    }

    const { rol, empresa_nombre } = access.rows[0];

    const payload = {
      id: req.user.id,
      email: req.user.email,
      nombre: req.user.nombre,
      empresa_id: parseInt(empresa_id),
      empresa_nombre,
      rol,
    };

    const token = signToken(payload);
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ message: 'Error al cambiar empresa' });
  }
});

router.post('/create-empresa', authMiddleware, async (req, res) => {
  try {
    const { nombre, nif } = req.body;
    if (!nombre) {
      return res.status(400).json({ message: 'Nombre de empresa obligatorio' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const empresa = await client.query(
        'INSERT INTO empresas (nombre, nif) VALUES ($1, $2) RETURNING id, nombre, nif',
        [nombre.trim(), (nif || '').trim().toUpperCase() || null]
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
  } catch (err) {
    res.json({ user: req.user, empresas: [] });
  }
});

export default router;
