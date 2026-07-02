-- 007: Tabla conectores (puntos de carga de documentos: email, carpeta, API, FTP)
-- El tab "Puntos de carga" del frontend la usa via /api/data/conectores.
-- IF NOT EXISTS: segura aunque la tabla ya exista desde la migración NocoDB.

CREATE TABLE IF NOT EXISTS conectores (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL DEFAULT 'email',
  punto VARCHAR(255),
  email_asociado VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conectores_empresa ON conectores(empresa_id);
