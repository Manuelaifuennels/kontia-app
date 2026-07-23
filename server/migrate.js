import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LOCK_KEY = 987654321;

/**
 * Aplica al arrancar las migraciones .sql que aún no estén registradas.
 *
 * - Orden alfabético (002_, 003_, ... 008_), que es el cronológico.
 * - Cada una en su propia transacción; si falla, ROLLBACK y NO se marca como
 *   aplicada (se reintenta en el siguiente arranque).
 * - Un fallo detiene las siguientes (para no aplicar migraciones fuera de orden)
 *   pero NUNCA tumba el servidor: la app arranca igual y el error queda en el log.
 *   Preferimos un esquema a medias y servicio en pie, a una web caída.
 * - Advisory lock global: si Easypanel levanta dos instancias a la vez, solo una migra.
 *
 * Todas las migraciones del repo son idempotentes (IF NOT EXISTS / CREATE OR
 * REPLACE), así que es seguro para bases de datos donde ya se aplicaron a mano.
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre TEXT PRIMARY KEY,
        aplicada_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    try {
      const aplicadas = new Set(
        (await client.query('SELECT nombre FROM schema_migrations')).rows.map((r) => r.nombre)
      );

      let archivos = [];
      try {
        archivos = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
      } catch {
        console.warn('Migraciones: carpeta no encontrada, se omite');
        return;
      }

      let aplicadasAhora = 0;
      for (const archivo of archivos) {
        if (aplicadas.has(archivo)) continue;

        // El runner ya envuelve cada archivo en una transacción: quitamos los
        // BEGIN;/COMMIT; propios del .sql para no anidar control transaccional.
        // El \r final contempla los ficheros con saltos de línea de Windows.
        const sql = fs
          .readFileSync(path.join(MIGRATIONS_DIR, archivo), 'utf8')
          .replace(/^[ \t]*(BEGIN|COMMIT)[ \t]*;[ \t\r]*$/gim, '');

        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo]);
          await client.query('COMMIT');
          aplicadasAhora++;
          console.log(`Migración aplicada: ${archivo}`);
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          console.error(`MIGRACIÓN FALLIDA (${archivo}): ${err.message}`);
          console.error('Se detienen las migraciones posteriores. La app arranca igual.');
          break;
        }
      }

      if (aplicadasAhora === 0) {
        console.log('Migraciones: base de datos al día');
      } else {
        console.log(`Migraciones: ${aplicadasAhora} aplicada(s)`);
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    }
  } finally {
    client.release();
  }
}
