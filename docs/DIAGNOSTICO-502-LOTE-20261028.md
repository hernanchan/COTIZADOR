# Diagnóstico real de inicio de lote — 28/10/2026

En DevTools Network, después de un solo reintento con los dos PDF cargados, solicitud `ensayo-pdf-iniciar-lote`: **HTTP 502, duración 2,60 s**. UI: total preliminar $6.980 (12p $3.290; 17p $3.690), Turnstile muestra éxito, ninguno de los recibos ni D1 confirmado. No repetir reintentos indiscriminados; preservar pestaña y sesiones.

**Corrección importante de diagnóstico:** en `worker-fase4-cotizador-unificado.mjs`, `postToScript(env,payload,fetch,12000)` usa el **cuarto argumento como `maxResponseChars`**, NO como timeout de 12 segundos. Los timeouts reales son `AbortSignal.timeout(55000)` para POST y 15000 para GET redirigido. Por tanto la explicación previa de 12 segundos era incorrecta; el dato 2,60 s tampoco revela si falló validación de respuesta, HMAC, cuota, Google u otra condición. El `catch` de `fase4BatchStart` enmascara distintos fallos como el mismo 502. Revisión de código fuente: GAS `docsMultiStartBatch` existe y despacha la operación, con respuesta `sessions`, `receiptOnly` y `paymentAuthorized:false`.

**Siguiente paso técnico:** agregar diagnóstico seguro y acotado de *categoría/etapa* en `fase4BatchStart` (sin exponer tokens, claves, URL ni datos privados); registrar de forma diferenciada rechazo `ok:false` y `errorCode`, redirección inválida, HTTP upstream, JSON inválido y validación de estructura/sesiones. Probar con mocks antes de nueva versión privada. Alternativa: logs de ejecución de Apps Script v8 y registros observabilidad Worker para el incidente, si disponibles, sin reenviar PDF. Mantener `b7f58caf` como recuperación; no tocar `main`, web comercial, cobros o Polaroids.


## Corrección diagnóstica en código privado, aún sin desplegar

- Commit `d90caec2`: `worker-fase4-cotizador-unificado.mjs` ahora devuelve `reasonCode` seguro en el HTTP 502 y registra `saber_batch_start_failure` con una categoría, sin nombres, SHA, tokens ni URLs.
- Commit `b1f03ce1`: categorías de rechazo alineadas con los códigos reales de `docsReceptionReasonCode` de GAS: `GLOBAL_CAP`, `ORDER_CAP`, `INDEX_INVALID`, `FILE_ID_CONFLICT`, `BAD_META`, `BUSY`, `RECEPTOR_ERROR` y `UNAUTHORIZED`. También distingue etapas de POST/redirección/parseo/estructura.
- Commit `859a30ca`: prueba estática `tests/fase1-lote-diagnostico-502.test.mjs` añadida. **No consta ejecución CI de estos nuevos cambios**: no afirmar pruebas aprobadas.
- No se cambió GAS, Central, pagos, Polaroids ni `main`. **Código modificado en rama ≠ Worker desplegado**. La versión privada promovida por confirmación de usuario sigue siendo `5fcfcf56` hasta verificar su estado con Cloudflare. El ensayo 502 de 2,60 s sigue sin causa definitiva.
- **Próximo paso concreto:** ejecutar pruebas automáticas y compilar; preparar nueva versión privada sin activar mediante el workflow manual existente en `main`, recoger UUID real, promover sólo Worker `saber-documentos-pruebas` conservando `b7f58caf` como rollback. Después, reintentar la misma tanda de dos PDF sólo una vez, preservando la sesión si aún está abierta. El resultado `reasonCode` permitirá intervenir sobre la causa exacta. No repetir pruebas ni cambiar configuraciones a ciegas.


## 28-10-2026 — versión de diagnóstico preparada, sin activar

- El usuario lanzó el workflow manual `.github/workflows/saber-preparar-version-privada.yml` (#7) desde `main`, que toma código de la rama privada.
- GitHub Actions run **40783328342**, job **123150222755**, **completed / success**. Logs de pruebas: `# fail 0`, `PRUEBAS_PRIVADAS_OK`; compilación y subida de versión aprobadas.
- UUID real de Cloudflare **`625a9f5a-cb9f-43a7-bcb3-94d2c4c545ba`**, extraído del log `VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR=...`.
- Log final `SIN_DESPLIEGUE_SIN_PAGOS_SIN_CAMBIOS_EN_WEB_COMERCIAL`: **NO activada**, NO prueba real. La última versión concurrente promovida por confirmación del usuario es `5fcfcf56-52b8-471e-ac59-5ac9a50182ac` (sin readback independiente) y el rollback funcional documentado es `b7f58caf-7ca4-4abf-8e05-9694fa9593fd`.
- **Próximo paso ejecutable**: en Cloudflare Worker `saber-documentos-pruebas`, promover exclusivamente `625a9f5a` al 100 %, verificar que `DOCS_SCRIPT_URL` sigue apuntando a GAS v8 `AKfycbyIQA...`. Conservar `b7f58caf` como recuperación. Repetir **un solo ensayo** de los dos PDF que fallaron (12 y 17 páginas; total preliminar $6.980) y leer el nuevo `reasonCode` de respuesta 502 si vuelve a fallar; no exponer tokens ni credenciales. Confirmar SHA/Drive, cotización oficial y un único pedido D1 antes de declarar éxito; pagos apagados. No tocar `main`, web comercial o Polaroids.


## 29-10-2026 — Promoción de diagnóstico confirmada por usuario

- El usuario respondió **«implementado»** tras recibir instrucciones para promover al 100 % la versión `625a9f5a-cb9f-43a7-bcb3-94d2c4c545ba` exclusivamente en Cloudflare Worker `saber-documentos-pruebas`.
- **Estado:** promoción confirmada por usuario, aún sin lectura independiente de Cloudflare ni ensayo real con el código diagnóstico. No dar por resuelto el HTTP 502 ni por confirmado D1.
- La versión incorpora `reasonCode` seguro para distinguir causas en `/api/ensayo-pdf-iniciar-lote` (rechazo GAS, sesión, respuesta inválida, comunicación, etc.). Se conserva `b7f58caf-7ca4-4abf-8e05-9694fa9593fd` como recuperación anterior funcional.
- **Siguiente paso:** una sola prueba privada de dos PDF. Si la pestaña anterior todavía conserva los archivos en memoria, reintentar una vez con DevTools Network abierto y consultar Response de `ensayo-pdf-iniciar-lote`, mostrando únicamente `reasonCode`, HTTP y duración (sin tokens ni payload). Si la pestaña se cerró o expiró por la noche, iniciar nueva sesión y cargar dos archivos de prueba, sin asumir recuperación. Si se confirma recepción, verificar recibos individuales, precio servidor y registro único en D1; pagos apagados.
- No modificar `main`, web comercial, Polaroids ni generar nuevos despliegues hasta identificar resultado de este ensayo.
