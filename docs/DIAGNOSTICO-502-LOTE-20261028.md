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


## 29-10-2026 — nuevo ensayo tras promoción 625a9f5a: recepción informada, D1 pendiente

- Captura de `/prueba-v2/?diagnostico=1` tras despliegue informado de la versión diagnóstica. Pantalla: **«PDF recibidos; el registro quedó pendiente. Pulsá «Enviar mi pedido» para reintentar sin subir los PDF.»**; Turnstile con indicador verde, dos entradas de documentos A4, total preliminar $6.980 (12 páginas $3.290 + 17 páginas $3.690).
- **No aparece el error anterior «No se pudo confirmar el inicio completo de la tanda»**, pero no se aportó trazado Network ni confirmación independiente de SHA/Drive. No afirmar que la concurrencia completa quedó medida o aprobada.
- El segundo PDF es diferente al anterior y muestra advertencia por **tamaños originales mixtos** (20×20 cm / 40×20 cm); se seleccionó A4. Revisar que esa opción refleje el ensayo buscado; no tratar el precio preliminar como oficial.
- **Estado vigente:** UI indica recepción completada y **registro único D1 PENDIENTE**. No consta pedido confirmado, ni medición `fin`, ni cobro. No duplicar subida, no recargar pestaña que conserva referencias.
- **Siguiente paso exacto:** en misma pantalla, pulsar **una sola vez «Enviar mi pedido»** para reintentar el registro sin subir PDFs, confirmar resultado Central D1 y total oficial; si falla, conservar texto de error y consultar el POST del registro, sin emitir otro pedido ni borrar recibos. Mantener privados Worker/GAS y pagos apagados.


## 29-10-2026 — respuesta HTTP 422 de registro D1, captura de Network

- Se inspeccionó la pestaña **Response** de una solicitud `POST /api/ensayo-preparar-documentos-v2-lote`. Responde `{"ok":false,"error":"Pedido privado pendiente de revisión; no se autorizó pago.","checkoutEnabled":false,"paymentAuthorized":false,"listoParaProducir":false}`, status **422**. En captura anterior hay dos intentos 422. Total mostrado $6.980 es preliminar, sin total oficial ni D1 confirmado.
- El código `worker-fase4-cotizador-unificado.mjs`, función `apiPrepararDocumentosV2Lote`, genera literalmente ese mensaje en un **catch genérico** que cubre tres fases: `verificarPedidoPorComprobantes` / fallback `fase4FichaCentralLotePrivada`, `registrarManifiestoV2EnCentral` y `prepararDocumentosCentralFirmado`. Por ello el 422 **NO identifica cuál fase falló** ni prueba por sí mismo un error propio de D1. Es incorrecto afirmar causa específica sin diagnóstico adicional.
- La UI declara «PDF recibidos; el registro quedó pendiente», compatible con sesiones verificadas del cliente, pero sin evidencia independiente de dos recibos SHA en Drive. Documento segundo de 17 páginas tiene tamaños mixtos y opción A4 elegida; usuario confirma que ya eligió A4 y pulsó dos veces, **NO pedir repetir esos pasos**.
- **Siguiente paso:** instrumentar en rama privada sólo el `catch` del registro con `phase/reasonCode` de categorías seguras (verificación comprobantes / relectura Drive / validación de manifiesto / stage D1 / Central) sin exponer IDs ni secretos; registrar por servidor el detalle interno si se dispone de logs seguros. Probar mocks antes de otro despliegue y UN ensayo de registro idempotente. No pedir más screenshots ni envíos hasta tener señal diagnóstica. Prohibido tocar `main`, pagos y web pública.


### 29-10-2026 — diagnóstico 422 implementado en rama (NO desplegado)

- Commit `9210cb76`: en `apiPrepararDocumentosV2Lote`, el catch conserva HTTP 422 y bloqueo de pagos, pero ahora agrega `reasonCode` según la etapa: `VERIFICACION_RECIBOS`, `RELECTURA_DRIVE`, `CONCILIACION_MANIFIESTO` o `PREPARACION_CENTRAL`. Log de servidor `saber_v2_registro_pendiente` registra solamente esa etapa, sin secretos ni mensajes crudos. Ninguna regla comercial o revalidación se quitó.
- Commit `f229abaf`: prueba de regresión estática `tests/fase1-registro-d1-diagnostico-422.test.mjs`. **NO ejecutada aún en CI; NO desplegada**. No declarar corrección del pedido.
- **Próximo paso**: validar compilación y tests, preparar mediante workflow manual de GitHub nueva versión PRIVADA sin activar, identificar UUID real y promover sólo a `saber-documentos-pruebas`. Tras eso, repetir una sola vez el registro de los dos PDF sin re-subirlos (si la sesión persiste) y consultar `reasonCode` para corregir la causa raíz. Mantener `b7f58caf` de reversión y web comercial/pagos/Polaroids intactos.


## 29-10-2026 — análisis integral y corrección de incompatibilidad en recibos (código NO desplegado)

Revisada la ruta `apiPrepararDocumentosV2Lote` del Worker y los módulos `verificacion-central-comprobante.mjs`, `comprobante-pdf-servidor.mjs`, `consolidar-pedido-verificado.mjs`, `registrar-manifiesto-v2-central.mjs`, `fase4-ficha-central-lote-privada.mjs` y `subir-vincular-pdf-v2-privado.mjs`.

**Hallazgo causal sustentado en código:** `subir-vincular-pdf-v2-privado.mjs` usa desde el lote concurrente el `fileId` **`pdf-<sha16>-<localRefUUID32>`**, mientras `verificarPedidoPorComprobantes` exigía exactamente el formato legado **`pdf-<sha24>`**. Por ello el comprobante HMAC legítimo del flujo nuevo se rechazaba en etapa `VERIFICACION_RECIBOS`, antes de registrar el manifiesto en D1. También existía una restricción de SHA único (`huellas`) que impediría archivos de contenido idéntico aunque tuvieran referencias y recibos distintos, contradiciendo la arquitectura del lote. Esta incompatibilidad es un candidato **muy probable** para el 422 observado, pero la causa concreta del intento de producción privada todavía debe ratificarse con prueba de extremo a extremo.

**Corrección GitHub (solo rama privada):** commit `e1e1d94b` en `integraciones/autocotizador/recepcion/verificacion-central-comprobante.mjs`. Acepta únicamente dos formas de ID vinculadas criptográficamente al SHA firmado (`pdf-<sha24>` o `pdf-<sha16>-<32 hex>`); conserva verificación HMAC, orden, recibo, páginas, modo y archivo único por ID/recibo. Elimina la restricción de SHA único para poder adjuntar PDF iguales con identificadores independientes. **No se relajan** requisitos de recibo ni validaciones de Central, ni se autoriza pago.

**Regresión añadida:** commit `3e50ba3c`, `tests/fase1-comprobantes-ids-lote-regresion.test.mjs`, con cuatro escenarios: dos PDF mismo SHA y distintos ID actuales, ID legado, ID nuevo incongruente con SHA, y archivo ID duplicado. **No se han ejecutado las pruebas ni hay CI asociada todavía.** Compilación, despliegue privado y ensayo real siguen pendientes; no declarar solucionado el 422.

**Próximo paso preciso:** ejecutar `npm test` / compilación en el workflow de la rama antes de preparar otro Worker; validar nuevo test y suite existente. Si fallan, corregir en rama y repetir pruebas, sin intervención del usuario. Tras CI exitoso preparar **una única** versión privada identificada, sin activar, luego promover a `saber-documentos-pruebas` con autorización; un solo ensayo end-to-end con dos PDF y verificación de recibos y un pedido Central D1. Conservar `625a9f5a` como versión anterior del ensayo y `b7f58caf` como recuperación funcional; no asumir que las sesiones antiguas sobreviven indefinidamente. Mantener pagos, Polaroids y web comercial apagados/intactos.


### Regresión conectada al workflow de preparación privada

- Commit `27a47a19`: `integraciones/autocotizador/recepcion/package.json` actualiza `test:handoff` para ejecutar `tests/fase1-comprobantes-ids-lote-regresion.test.mjs`. El workflow existente en `main` ejecuta `npm run build:unificado`, que invoca `test:handoff` **antes** de compilar o crear una versión privada; por tanto una regresión fallida debe detener la preparación.
- El workflow `.github/workflows/saber-preparar-version-privada.yml` se lanza manualmente desde `main` y hace checkout de la rama privada. **Ningún workflow ha sido iniciado por esta intervención**; no hay pruebas ejecutadas todavía y no se creó versión de Cloudflare. No alterar el workflow de `main` ni activar Worker sin ensayo/verificación de CI.


## 29-10-2026 — CI y compilación privados CONFIRMADOS, versión lista SIN activar

- Usuario inició GitHub Actions workflow `.github/workflows/saber-preparar-version-privada.yml` (run **40870680395**, job **123436621534**, run #8) desde `main` con checkout de `fase1/impresiones-ploteos-20261027`.
- Estado real consultado en GitHub: **completed/success**, todos los pasos aprobados. Log: grupos de pruebas `# pass 23, # fail 0`, `# pass 46, # fail 0`, `# pass 3, # fail 0` (72 pruebas, cero fallos), `PRUEBAS_PRIVADAS_OK`, compilación exitosa.
- **UUID genuino preparado SIN activar:** `2db48bcb-7bd8-4eca-bedf-1c5b98c41fcd`. Log: `SIN_DESPLIEGUE_SIN_PAGOS_SIN_CAMBIOS_EN_WEB_COMERCIAL`.
- El arreglo de IDs SHA/UUID en `verificacion-central-comprobante.mjs` (commit `e1e1d94b`) y nueva regresión (commit `3e50ba3c`) quedaron incluidos por `test:handoff`, modificado en `27a47a19`.
- **Estado vigente:** CI correcta, versión Cloudflare creada, NO promovida y NO probada con PDFs reales. No asegurar que 422 esté resuelto.
- **Próximo paso:** promover exclusivamente la versión `2db48bcb-7bd8-4eca-bedf-1c5b98c41fcd` al 100 % del Worker **`saber-documentos-pruebas`**; no otro Worker ni main. Mantener `625a9f5a-cb9f-43a7-bcb3-94d2c4c545ba` como reversión inmediata del ensayo y `b7f58caf-7ca4-4abf-8e05-9694fa9593fd` como recuperación histórica. Luego un ensayo end-to-end controlado sin pagos para ver si Central registra pedido único y precio oficial. Si el usuario conserva sesiones, intentar registro solo una vez sin recargar PDFs; si caducaron, no asumir recuperación. No cambiar GAS, Polaroids ni web comercial.


## 29-10-2026 — Promoción de versión con corrección de IDs confirmada por usuario

- Tras instrucciones de promover UUID `2db48bcb-7bd8-4eca-bedf-1c5b98c41fcd` al 100 % en Cloudflare Worker `saber-documentos-pruebas`, el usuario confirmó **«LISTO»**. Estado: **promoción informada por usuario**, sin lectura independiente de Cloudflare; NO representa validación E2E ni prueba de pedido D1.
- Continúan apagados los cobros; no se modificó `main`, web comercial, Google Apps Script ni Polaroids.
- **Siguiente paso único:** si la sesión existente aún está abierta, utilizar el botón de envío para reintentar **registro sin re-subir**, una sola vez. Si caducó, iniciar ensayo privado controlado con dos PDF distintos y un único clic «Enviar mi pedido», sin nuevas configuraciones ni promociones. Comprobar respuesta de `/api/ensayo-preparar-documentos-v2-lote`: 200 con `ok:true` y precio servidor, o 422 con `reasonCode` seguro. Después confirmar 2 recibos reales y un único pedido D1; sin pago. No repetir intentos sin nueva evidencia.
