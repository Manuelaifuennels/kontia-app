-- 005: Garantiza una sola fila de config por empresa
-- Requisito: ON CONFLICT (empresa_id) en auth.js register necesita esta constraint

CREATE UNIQUE INDEX IF NOT EXISTS idx_config_empresa_unique
  ON config (empresa_id);
