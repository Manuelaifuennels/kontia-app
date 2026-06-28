import jwt from 'jsonwebtoken';
import pool from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;

const activoCache = new Map();
const CACHE_TTL = 30000;

async function isUserActive(userId) {
  const cached = activoCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.activo;
  }
  const result = await pool.query(
    'SELECT activo FROM usuarios WHERE id = $1',
    [userId]
  );
  const activo = result.rows.length > 0 && result.rows[0].activo === true;
  activoCache.set(userId, { activo, ts: Date.now() });
  return activo;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of activoCache) {
    if (now - entry.ts > CACHE_TTL * 2) activoCache.delete(id);
  }
}, 60000).unref();

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id || user.Id,
      email: user.email,
      empresa_id: user.empresa_id,
      nombre: user.nombre,
      empresa_nombre: user.empresa_nombre,
      rol: user.rol || "admin",
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    const activo = await isUserActive(decoded.id);
    if (!activo) {
      return res.status(401).json({ error: 'Cuenta desactivada o eliminada' });
    }
  } catch {
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  req.user = decoded;
  next();
}
