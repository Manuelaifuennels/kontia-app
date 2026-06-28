-- 003: Add UNIQUE partial index on empresas.nif
-- The code catches error 23505 on NIF duplicates but no UNIQUE constraint existed.
-- Partial index (WHERE nif IS NOT NULL) allows multiple NULL nifs.

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_nif_unique
  ON empresas (nif)
  WHERE nif IS NOT NULL;
