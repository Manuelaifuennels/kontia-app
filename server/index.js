import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import webhookRoutes from './routes/webhooks.js';

const REQUIRED_ENV = ['NOCO_URL', 'NOCO_TOKEN', 'JWT_SECRET', 'WEBHOOK_URL'];
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

app.get('/api/status', (req, res) => {
  res.json({
    noco: (process.env.NOCO_URL || '').replace('https://', ''),
    webhooks: (process.env.WEBHOOK_URL || '').replace('https://', ''),
    minio: (process.env.MINIO_URL || '').replace('https://', ''),
  });
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

app.listen(PORT, () => {
  console.log(`Kontia server running on port ${PORT}`);
});
