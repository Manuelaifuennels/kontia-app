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
| Separar PDF | Sin cambios. |
| Kontia Auth v3 DESACTIVADO | **No incluido**: código muerto (NocoDB, password en claro, token falsificable). Borrarlo de n8n. |

## Seguridad pendiente en n8n (hacer en la UI, 2 min por workflow)

1. **Autenticación de webhooks** — los webhooks aceptan llamadas directas con
   cualquier `empresa_id`. El backend Express ya envía el header `x-kontia-secret`
   (valor de la env `WEBHOOK_SECRET`). En cada nodo Webhook: Authentication →
   Header Auth → crear credencial con Name `x-kontia-secret` y Value igual a
   `WEBHOOK_SECRET`. Aplicar a: procesar-factura, separar-pdf, conciliacion-bancaria
   y todos los exportar-*.
2. **Error Workflow global** — crear un workflow con Error Trigger que haga
   `UPDATE facturas SET estado='error' WHERE id = ...` y asignarlo en Settings de
   cada workflow. (Mientras tanto, la app barre las facturas en 'procesando' > 20 min.)
3. **MinIO** — el bucket `facturas` admite PUT sin autenticación. Restringir la
   política del bucket y pasar a URLs firmadas.
