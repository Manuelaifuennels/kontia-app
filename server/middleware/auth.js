import jwt from 'jsonwebtoken';
import pool from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;

const userCache = new Map();
const CACHE_TTL = 30000;

async function validateUser(userId, empresaId) {
  const key = `${userId}:${empresaId}`;
  const cached = userCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached;
  }
  const result = await pool.query(
    `SELECT u.activo, ue.rol
     FROM usuarios u
     LEFT JOIN usuarios_empresas ue ON ue.usuario_id = u.id AND ue.empresa_id = $2
     WHERE u.id = $1`,
    [userId, empresaId]
  );
  const row = result.rows[0];
  const entry = {
    activo: row ? row.activo === true : false,
    rol: row?.rol || null,
    ts: Date.now(),
  };
  userCache.set(key, entry);
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userCache) {
    if (now - entry.ts > CACHE_TTL * 2) userCache.delete(key);
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
      rol: user.rol || 'usuario',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

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
    const { activo, rol } = await validateUser(decoded.id, decoded.empresa_id);
    if (!activo) {
      return res.status(401).json({ error: 'Cuenta desactivada o eliminada' });
    }
    if (!rol) {
      return res.status(403).json({ error: 'Sin acceso a esta empresa' });
    }
    req.user = { ...decoded, rol };
  } catch {
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }

  next();
}
