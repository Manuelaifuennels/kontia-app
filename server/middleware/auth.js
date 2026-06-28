import jwt from 'jsonwebtoken';
import pool from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;

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

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const check = await pool.query(
      'SELECT activo FROM usuarios WHERE id = $1',
      [decoded.id]
    );
    if (check.rows.length === 0 || !check.rows[0].activo) {
      return res.status(401).json({ error: 'Cuenta desactivada o eliminada' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}
