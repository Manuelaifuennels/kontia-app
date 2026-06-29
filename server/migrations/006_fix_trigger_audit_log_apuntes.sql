-- Fix: trigger_audit_log() fallaba en tabla apuntes porque no tiene columna empresa_id.
-- Ahora deriva empresa_id desde asientos.empresa_id via asiento_id cuando TG_TABLE_NAME = 'apuntes'.
-- Idempotente (CREATE OR REPLACE), seguro ejecutar aunque la DB en vivo ya lo tenga.

CREATE OR REPLACE FUNCTION trigger_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_empresa_id INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'apuntes' THEN
      SELECT empresa_id INTO v_empresa_id FROM asientos WHERE id = OLD.asiento_id;
    ELSE
      v_empresa_id := OLD.empresa_id;
    END IF;
    INSERT INTO audit_log(tabla, operacion, registro_id, empresa_id, datos)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, v_empresa_id, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    IF TG_TABLE_NAME = 'apuntes' THEN
      SELECT empresa_id INTO v_empresa_id FROM asientos WHERE id = NEW.asiento_id;
    ELSE
      v_empresa_id := NEW.empresa_id;
    END IF;
    INSERT INTO audit_log(tabla, operacion, registro_id, empresa_id, datos)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, v_empresa_id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
