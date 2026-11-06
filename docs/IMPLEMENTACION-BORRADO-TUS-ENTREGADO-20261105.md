# 05/11/2026 — Implementación gradual de borrado TUS tras entrega

## Decisión del titular
> «No quiero guardar pedidos, si quieren reimprimir que lo hagan de nuevo.»

**Política definitiva:** al registrar *Entregado*, eliminar los PDF privados de ese pedido sin guardar copia operativa ni habilitar reimpresión. Nuevos trabajos exigen archivos, cotización y pago nuevos. Los registros mínimos de cobro/fiscales se conservan por separado, sin originales.

## Trabajo realizado directamente en GitHub
Rama `integracion/tus-pedido-privado-20261101`; **no main, no producción, ningún borrado real**.

1. `integraciones/mercadopago/pruebas/worker.js`
   - Nueva ruta **interna HMAC, solo lectura** `POST /internal/central/tus-purge-plan`.
   - D1 autoriza el plan SOLO si la orden es `paid`, `paid_at` existe, pago total y `payment_reviews=verified`, estado `entregado`, y los recibos registrados coinciden con el manifiesto TUS.
   - No acepta IDs de archivos enviados por un cliente, solamente extrae recibos originales de D1.
   - Cola durable `central_tus_purge_queue`: se prepara al marcar `Entregado` **solo si** `CENTRAL_TUS_PURGE_QUEUE_ENABLED=PRIVATE_TEST_ONLY`. Interruptor APAGADO por defecto. La cola es *pendiente*, no es prueba de archivos eliminados.
2. `integraciones/autocotizador/recepcion/borrado-tus-entregado.mjs`
   - Valida ruta exacta `v2/<WEB-ENSAYO-...>/<UUID del recibo>.pdf`, orden, importe/cantidades y ausencia de rutas ajenas o duplicadas.
   - Simula limpieza, sin modificar Storage.
   - Función de eliminación real aislada `borrarPDFTUSEntregados`: requiere simultáneamente `DOCS_TUS_PURGE_ENABLED=PRIVATE_TEST_ONLY`, `mode='execute'`, `approved=true`, `confirmed=true`, credenciales privadas y un callback de auditoría antes/después. Usa API Storage `DELETE /storage/v1/object/saber-tus-lab` con `{prefixes:[rutas exactas]}`, NO SQL, NO limpieza global. **No está conectada a ninguna ruta de ejecución.**
3. `integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs`
   - Nueva ruta operador Basic autenticado `POST /prueba-v2/api/ensayo-tus-retencion` en modo **SIMULACIÓN exclusivamente**. Consulta a la Central mediante HMAC ya existente, informa cuántos archivos y bytes serían eliminados, sin devolver sus rutas ni acceder a DELETE.
4. Pruebas añadidas:
   - `tests/tus-borrado-plan-central-firmado.test.mjs`
   - `tests/tus-borrado-entregado-seguro.test.mjs`
   - `tests/tus-cola-borrado-entregado.test.mjs`
   - Incluidas en `.github/workflows/tus-integracion-privada-ci.yml`.
   - GitHub Actions `42133401561`: **SUCCESS**, incluidas pruebas anteriores de cotizador y Central.

## Pendientes concretos, no afirmar que el borrado funciona todavía
1. **Conectar disparador de la cola al Worker documental**, después de marcar entregado, mediante servicio privado; implementar un reintento seguro para cuando falle la red, sin repetir eliminaciones.
2. **Auditoría durable en D1** (previa/posterior, idempotente y con aviso ante borrados parciales); limpiar o anonimizar metadatos técnicos del manifiesto sin borrar datos fiscales ni de cobros.
3. Probar un pedido TUS creado ex profeso y en estado entregado dentro de un escenario completamente aislado; verificar que desaparecen EXACTAMENTE sus PDF, que otro pedido no se altera y que el ZIP/descarga no lo ofrecen; mantener historial comercial mínimo.
4. Con la verificación y decisión de activación, configurar las dos compuertas privadas y programar el proceso de limpieza; **nunca ejecutar los 40 archivos históricos o purgar el bucket entero**.
5. Fuera de esta regla, definir limpieza de impagos/abandonados, cuidando pagos/transferencias pendientes.

## Comprobación del depósito
Supabase project `saber-tus-lab`, bucket privado `saber-tus-lab`. Consulta SQL de solo lectura: **40 objetos, 211851276 bytes**. No se modificó ni eliminó ninguno.

Fuentes oficiales: https://supabase.com/docs/guides/storage/management/delete-objects y https://supabase.github.io/storage/ (API Storage DELETE por rutas).
