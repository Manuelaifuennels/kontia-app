import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import pool from './db.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import webhookRoutes from './routes/webhooks.js';

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'WEBHOOK_URL'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

if (!isProd) {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/webhook', webhookRoutes);

app.get('/api/status', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW() AS now');
    res.json({
      db: 'connected',
      db_time: dbResult.rows[0].now,
      webhooks: (process.env.WEBHOOK_URL || '').replace('https://', ''),
      minio: (process.env.MINIO_URL || '').replace('https://', ''),
    });
  } catch (err) {
    res.json({ db: 'error', db_error: err.message });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

pool.query('SELECT 1').then(() => {
  console.log('PostgreSQL connected');
  app.listen(PORT, () => {
    console.log(`Kontia server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('PostgreSQL connection failed:', err.message);
  process.exit(1);
});
