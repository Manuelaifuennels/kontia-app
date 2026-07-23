# Workflows n8n de Kontia (versionados)

Copia de referencia de los workflows que corren en la instancia n8n de producción.
**La fuente de verdad en ejecución es n8n** — tras cambiar un JSON aquí, hay que
reimportarlo en n8n (Workflows → Import from File) y reasignar la credencial
PostgreSQL ("Kontia PostgreSQL") en los nodos que la piden.

## Estado tras la auditoría de 2026-06-30

| Workflow | Cambios aplicados |
|---|---|
| Contabilizador IA v11 | Coerción numérica en campos de la IA (anti-inyección), fecha/tipo_retencion saneados, parseInt en empresa_id (7a-7d), fallback empresa_carpeta en duplicados, prompts con `rectificativa` + importes en positivo, el override por CIF ya no pisa rectificativas. **REIMPORTAR** |
| Exportar CSV v2 | parseInt en empresa_id (cerraba fuga multi-tenant vía inyección). **REIMPORTAR** |
| Exportar A3 / Contaplus / ContaSol / Conciliación | Filtraban por estado `completada` (inexistente) → `contabilizada`. **REIMPORTAR** |
| Exportar Sage 50 / Sage Despachos / Aplifisa / Glasof / Goldennet / Diezsoftware | Nuevos: exportan desde asientos+apuntes reales. **IMPORTAR** |
| Separar PDF | El nodo `Procesar Cada Página` llama internamente al webhook `procesar-factura`. Al activar Header Auth en ese webhook, esa llamada empezaba a devolver 403 y rompía la separación de PDFs. Ahora el nodo envía la credencial `webhook`. **Ya aplicado en n8n** (versión "Header Auth en llamada interna"). |
| Kontia Auth v3 DESACTIVADO | **No incluido**: código muerto (NocoDB, password en claro, token falsificable). Borrarlo de n8n. |

## Seguridad pendiente en n8n (hacer en la UI, 2 min por workflow)

1. ~~**Autenticación de webhooks**~~ **HECHO** (2026-07-24). Credencial Header Auth
   `webhook` (id `QaJ2hAeH0Ylc43hB`) con Name `x-kontia-secret`, asignada a los
   nodos Webhook. El backend Express envía esa cabecera con el valor de la env
   `WEBHOOK_SECRET`.
   **OJO al añadir workflows nuevos:** cualquier nodo HTTP Request que llame a un
   webhook propio de Kontia debe usar también esa credencial (Authentication →
   Generic Credential Type → Header Auth → `webhook`), o recibirá 403.
2. **Error Workflow global** — crear un workflow con Error Trigger que haga
   `UPDATE facturas SET estado='error' WHERE id = ...` y asignarlo en Settings de
   cada workflow. (Mientras tanto, la app barre las facturas en 'procesando' > 20 min.)
3. **MinIO** — el bucket `facturas` admite PUT sin autenticación. Restringir la
   política del bucket y pasar a URLs firmadas.
