-- 007: Tabla conectores (puntos de carga de documentos: email, carpeta, API, FTP)
-- El tab "Puntos de carga" del frontend la usa via /api/data/conectores.
-- Robusta ante una tabla legacy de la migración NocoDB: crea si no existe y
-- reconcilia las columnas que el CRUD necesita (ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS conectores (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  tipo VARCHAR(20) DEFAULT 'email',
  punto VARCHAR(255),
  email_asociado VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Si la tabla ya existía con otro esquema, garantizar las columnas del CRUD
ALTER TABLE conectores ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE;
ALTER TABLE conectores ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'email';
ALTER TABLE conectores ADD COLUMN IF NOT EXISTS punto VARCHAR(255);
ALTER TABLE conectores ADD COLUMN IF NOT EXISTS email_asociado VARCHAR(255);
ALTER TABLE conectores ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE conectores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_conectores_empresa ON conectores(empresa_id);
