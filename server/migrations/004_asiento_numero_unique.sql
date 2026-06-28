-- 004: Unique asiento number per empresa+ejercicio (normativa registral española)
-- Partial index: only enforces when numero IS NOT NULL (drafts sin numero permitidos)

CREATE UNIQUE INDEX IF NOT EXISTS idx_asientos_numero_unique
  ON asientos (empresa_id, ejercicio_id, numero)
  WHERE numero IS NOT NULL;
