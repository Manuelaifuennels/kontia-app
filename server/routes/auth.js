import { Router } from 'express';
import { authMiddleware, signToken } from '../middleware/auth.js';

const router = Router();
const WEBHOOK_URL = process.env.WEBHOOK_URL;

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

async function forwardToWebhook(endpoint, body) {
  const res = await fetch(`${WEBHOOK_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

router.post('/login', rateLimit, async (req, res) => {
  try {
    const result = await forwardToWebhook('kontia-login', req.body);

    if (!result?.success) {
      return res.status(401).json({ message: result?.message || 'Credenciales incorrectas' });
    }

    const user = result.user || {
      email: req.body.email,
      empresa_id: result.empresa_id,
      empresa_nombre: result.empresa_nombre,
      nombre: result.nombre,
      rol: result.rol || "admin",
    };
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(err.status || 500).json({ message: 'Error en login' });
  }
});

router.post('/register', rateLimit, async (req, res) => {
  try {
    const result = await forwardToWebhook('kontia-registro', {
      ...req.body,
      empresa_id: Date.now(),
    });

    if (!result?.success) {
      return res.status(400).json({ message: result?.message || 'Error en registro' });
    }

    const user = result.user || {
      email: req.body.email,
      empresa_id: result.empresa_id,
      empresa_nombre: req.body.empresa_nombre,
      nombre: req.body.nombre,
      rol: "admin",
    };
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(err.status || 500).json({ message: 'Error en registro' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;
