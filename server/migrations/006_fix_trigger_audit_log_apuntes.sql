-- server/migrations/006_fix_trigger_audit_log_apuntes.sql
--
-- Fix N21-DB-01: trigger_audit_log() fallaba en la tabla `apuntes` porque
-- no tiene columna empresa_id. Ahora deriva empresa_id desde asientos vía
-- asiento_id (leído del jsonb de la fila) cuando TG_TABLE_NAME = 'apuntes'.
--
-- IMPORTANTE: columnas reales de audit_log → accion, datos_antes, datos_despues
-- (NO 'operacion'/'datos'). Idempotente (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.trigger_audit_log()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_empresa_id integer;
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END;
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END;
  v_row jsonb := COALESCE(v_new, v_old);
BEGIN
  IF TG_TABLE_NAME = 'apuntes' THEN
    SELECT s.empresa_id INTO v_empresa_id
      FROM asientos s WHERE s.id = (v_row->>'asiento_id')::integer;
  ELSE
    v_empresa_id := (v_row->>'empresa_id')::integer;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(empresa_id, tabla, registro_id, accion, datos_despues)
    VALUES (v_empresa_id, TG_TABLE_NAME, (v_row->>'id')::integer, 'INSERT', v_new);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(empresa_id, tabla, registro_id, accion, datos_antes, datos_despues)
    VALUES (v_empresa_id, TG_TABLE_NAME, (v_row->>'id')::integer, 'UPDATE', v_old, v_new);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(empresa_id, tabla, registro_id, accion, datos_antes)
    VALUES (v_empresa_id, TG_TABLE_NAME, (v_row->>'id')::integer, 'DELETE', v_old);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
