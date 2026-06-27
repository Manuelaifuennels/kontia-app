import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { authMiddleware, signToken } from '../middleware/auth.js';

const router = Router();

const loginAttempts = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const maxAttempts = 20;
  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter((t) => now - t < window);
  if (recent.length >= maxAttempts) {
    return res.status(429).json({ message: 'Demasiados intentos. Espera 15 minutos.' });
  }
  recent.push(now);
  loginAttempts.set(ip, recent);
  next();
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

    const payload = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      empresa_id: user.empresa_id,
      empresa_nombre: user.empresa_nombre,
      rol: user.rol,
    };

    const token = signToken(payload);
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ message: 'Error en login' });
  }
});

router.post('/register', rateLimit, async (req, res) => {
  try {
    const { email, password, nombre, empresa_nombre } = req.body;
    if (!email || !password || !nombre || !empresa_nombre) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
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
        'INSERT INTO empresas (nombre) VALUES ($1) RETURNING id',
        [empresa_nombre]
      );
      const empresaId = empresa.rows[0].id;

      const hash = await bcrypt.hash(password, 10);

      const usuario = await client.query(
        `INSERT INTO usuarios (empresa_id, nombre, email, password, rol, activo)
         VALUES ($1, $2, $3, $4, 'admin', true) RETURNING id`,
        [empresaId, nombre, email.toLowerCase().trim(), hash]
      );

      await client.query('COMMIT');

      const payload = {
        id: usuario.rows[0].id,
        email: email.toLowerCase().trim(),
        nombre,
        empresa_id: empresaId,
        empresa_nombre,
        rol: 'admin',
      };

      const token = signToken(payload);
      res.json({ token, user: payload });
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

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;
