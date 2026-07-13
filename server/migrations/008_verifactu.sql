-- 008: VeriFactu (RD 1007/2023 + Orden HAC/1177/2024)
-- Registros de facturación con encadenamiento de huellas SHA-256.
-- Obligatorio desde 01/01/2026 (sociedades) y 01/07/2026 (resto de obligados).

ALTER TABLE config ADD COLUMN IF NOT EXISTS verifactu_activo BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS verifactu_registros (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  factura_id INTEGER REFERENCES facturas(id) ON DELETE SET NULL,
  tipo VARCHAR(10) NOT NULL DEFAULT 'alta' CHECK (tipo IN ('alta', 'anulacion')),
  nif_emisor VARCHAR(20) NOT NULL,
  num_serie_factura VARCHAR(60) NOT NULL,
  fecha_expedicion DATE NOT NULL,
  tipo_factura VARCHAR(2) NOT NULL DEFAULT 'F1',
  cuota_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  importe_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  huella_anterior VARCHAR(64),
  huella VARCHAR(64) NOT NULL,
  -- TEXT, no TIMESTAMPTZ: se persiste la cadena EXACTA (ISO 8601 con huso) que
  -- entró en el cálculo de la huella, para que siempre sea re-verificable
  fecha_hora_gen TEXT NOT NULL,
  qr_url TEXT,
  estado_envio VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un solo registro de alta (y uno de anulación) por factura
CREATE UNIQUE INDEX IF NOT EXISTS idx_verifactu_factura_tipo
  ON verifactu_registros (empresa_id, factura_id, tipo)
  WHERE factura_id IS NOT NULL;

-- La cadena se recorre por empresa en orden de inserción
CREATE INDEX IF NOT EXISTS idx_verifactu_empresa
  ON verifactu_registros (empresa_id, id DESC);
