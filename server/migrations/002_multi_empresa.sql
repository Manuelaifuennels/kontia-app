-- Migration 002: Multi-empresa support + config table
-- Executed 2026-06-28 against kontia database

BEGIN;

-- 1. Config table (per-empresa accounting settings, used by n8n workflow)
CREATE TABLE IF NOT EXISTS config (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cif_empresa VARCHAR(20),
  nombre_empresa VARCHAR(255),
  tipo_conector VARCHAR(100) DEFAULT 'CSV Facturas',
  codigo_empresa_csv VARCHAR(50),
  tipo_impuestos VARCHAR(20) DEFAULT 'IVA',
  digitos_plan VARCHAR(10) DEFAULT '10',
  separador_decimal VARCHAR(50) DEFAULT 'Funcionamiento por defecto',
  tolerancia_bases VARCHAR(10) DEFAULT '0.03',
  tolerancia_total VARCHAR(10) DEFAULT '0.05',
  iva_agrario BOOLEAN DEFAULT false,
  iva_tabaco BOOLEAN DEFAULT false,
  iva_no_deducible BOOLEAN DEFAULT false,
  id_cartera_proveedores VARCHAR(50),
  id_cartera_clientes VARCHAR(50),
  pago_automatico VARCHAR(10) DEFAULT 'No',
  cobro_automatico VARCHAR(10) DEFAULT 'No',
  autorrellenar_vencimiento BOOLEAN DEFAULT false,
  forzar_mayusculas BOOLEAN DEFAULT false,
  busqueda_aproximada BOOLEAN DEFAULT true,
  validar_cif BOOLEAN DEFAULT true,
  ignorar_duplicadas BOOLEAN DEFAULT false,
  total_factura_min VARCHAR(20),
  total_factura_max VARCHAR(20),
  orden_descripcion VARCHAR(100) DEFAULT 'No. Factura / Tercero',
  chars_excluir_proveedor VARCHAR(100),
  chars_excluir_cliente VARCHAR(100),
  recortar_num_proveedor VARCHAR(50) DEFAULT 'Mantener todos',
  recortar_num_cliente VARCHAR(50) DEFAULT 'Mantener todos',
  cuenta_suplidos VARCHAR(20),
  prefijo_proveedor VARCHAR(20) DEFAULT 'Fra.',
  prefijo_cliente VARCHAR(20) DEFAULT 'Fra.',
  cuenta_gastos_defecto VARCHAR(20),
  cuenta_ingresos_defecto VARCHAR(20),
  cambio_signo_rectificativas BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Junction table for users <-> empresas (many-to-many)
CREATE TABLE IF NOT EXISTS usuarios_empresas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  rol VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(usuario_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_ue_usuario ON usuarios_empresas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ue_empresa ON usuarios_empresas(empresa_id);

-- 3. Backfill existing user->empresa relationships
INSERT INTO usuarios_empresas (usuario_id, empresa_id, rol)
SELECT id, empresa_id, COALESCE(rol, 'admin')
FROM usuarios
WHERE empresa_id IS NOT NULL
ON CONFLICT (usuario_id, empresa_id) DO NOTHING;

-- 4. Sync CIF from config to empresas.nif
UPDATE empresas e SET nif = c.cif_empresa
FROM config c
WHERE c.empresa_id = e.id AND c.cif_empresa IS NOT NULL AND c.cif_empresa != '';

COMMIT;
