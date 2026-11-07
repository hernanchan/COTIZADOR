# R2 PDF grandes — desarrollo previo a la habilitación
Fecha: 06/11/2026. Rama: `integracion/tus-pedido-privado-20261101`.

## Trabajo realizado (sin habilitar R2, sin despliegues)
- `integraciones/autocotizador/recepcion/r2-pdf-grandes-privado.mjs`: contrato de archivo grande entre **40 MiB y 256 MiB**, 8 MiB por parte, HMAC por sesión R2 de 2 horas, referencia de orden y fichero; creación, subida por stream, cierre, validación de tamaño en R2. El recibo **no autoriza pagos ni acredita PDF**.
- `integraciones/autocotizador/recepcion/r2-pdf-grandes-cliente.mjs`: cargador de partes mediante `File.slice` (sin conversión del PDF completo a ArrayBuffer), 3 cargas paralelas, reintentos acotados y recuperación de partes confirmadas desde `sessionStorage` si sigue vigente el recibo.
- `tests/r2-pdf-grandes-privado.test.mjs`: plan de 200 MiB/25 partes, HMAC inválido y vencido, tamaños, CORS/Origin, finalización no autorizante.
- `tests/r2-pdf-grandes-cliente.test.mjs`: 200 MiB **simulados** en 25 partes, recuperación tras interrupción, no duplicar partes, límites.
- Integración de tests en `.github/workflows/tus-integracion-privada-ci.yml`, ejecución **SUCCESS**: https://github.com/hernanchan/COTIZADOR/actions/runs/42260766149 .

**Muy importante**: la simulación usa un R2 falso y un `File` ficticio. No se transfirieron 200 MiB reales, no se midió velocidad y no hay validación servidor de hash ni parseo de páginas para PDF grande. No hay rutas expuestas al cliente ni Worker desplegado con R2.

## Qué falta, por orden
1. Habilitar R2 a nombre del titular (medio de pago en Cloudflare) y crear bucket privado en clase Standard; **NO** habilitar acceso público.
2. Token con permisos R2, mantener separado de tokens Workers, y binding R2 de Worker privado. Falló intento con tokens actuales: https://github.com/hernanchan/COTIZADOR/actions/runs/42247706791 (403) y https://github.com/hernanchan/COTIZADOR/actions/runs/42247890803 (401). Workflow de alta listo `.github/workflows/r2-habilitar-bucket-ensayo.yml`.
3. Implementar endpoints autenticados de iniciar, parte y completar, unidos a la sesión de pedido existente; limitar cargas simultáneas, tamaño acumulado y abuso. No aceptar el proof como reemplazo de autenticación. La ruta HTTP del Worker debe preservar `Content-Length` para subir `Request.body` a R2 sin buffering.
4. Integrar el mecanismo alternativo de PDF grande en **el mismo cotizador V3**, sin modificar el transporte TUS normal.
5. Diseñar verificación **incremental** del SHA-256 y validación de páginas, clasificación y precio desde el PDF real de 200 MB, sin superar memoria de Worker. Probar integridad, no confiar en SHA calculado por navegador.
6. Central D1, ZIP/descarga original de los archivos R2 y hoja de producción, estados, recuperaciones y eliminación solo después de Entregado, con controles de referencia.
7. Probar transmisión real 20/45/80/200 MiB y varios PDF mezclados; medir tiempo frente al TUS rápido actual, interrupción y reanudación. No declarar listo el pedido si falla verificación.

## Garantías de alcance
No modificar main ni web pública; pagos reales deshabilitados; sin borrar los 40 PDFs anteriores de Supabase; sin generar gastos ni simular creación de bucket. El código nuevo no se importa todavía desde la app publicada.

## Documentación técnica
https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
https://developers.cloudflare.com/r2/objects/upload-objects/

## Avance de integración del 06/11 — API, hash y módulo comprador compilado

- `r2-pdf-grandes-api-privada.mjs`: iniciar, PUT parte, completar y verificar; exige flag `DOCS_R2_BIG_ENABLED=PRIVATE_TEST_ONLY`, binding `SABER_R2_GRANDES`, HMAC independiente `DOCS_R2_RECEIPT_KEY`; si falta cualquiera, responde 503. La ruta exige **misma sesión de comprador** vinculada al identificador de pedido mediante las cookies ya existentes, o Basic de personal. Un proof R2 no da acceso por sí solo; ninguna ruta escribe D1 ni habilita cobros.
- `worker-fase4-cotizador-unificado.mjs`: rutas `/prueba-v2/api/ensayo-r2/{iniciar,parte,completar,verificar}` montadas únicamente en rama privada; no hay despliegue nuevo. Se conserva TUS anterior.
- `r2-pdf-integridad-stream.mjs`: usa `crypto.DigestStream('SHA-256')` de Cloudflare, lee R2 como flujo y confirma tamaño, cabecera `%PDF-` e identidad SHA-256 contra el recibo firmado **sin cargar en RAM el archivo completo**. Fuente oficial: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ . **Todavía no analiza/cotiza páginas**, por lo que siempre devuelve `contenidoPdfVerificado:false`, `registeredInD1:false`, `paymentAuthorized:false`.
- `r2-pdf-grandes-cliente.mjs`: al completar R2 llama a la etapa adicional `verificar`. Si se interrumpe la respuesta, reintenta verificación **sin volver a cerrar** el multipart.
- Se genera el activo `r2-pdf-grandes-cliente.txt` con esbuild (`build:v2-r2`) y se reserva `/prueba-v2/r2-grandes.mjs` para el comprador autorizado **solo si hay binding+flag**. El cotizador aún **no llama al módulo**; no hay pantalla nueva ni cargo nuevo.
- Pruebas sin bucket real: `tests/r2-pdf-grandes-api-privada.test.mjs`, `tests/r2-pdf-integridad-stream.test.mjs` y las pruebas anteriores. Incluyen flujo de 200 MiB sintéticos, corrupción, truncamiento, verificación tras interrupción, origen cruzado y sesión ajena.
- **CI exitoso**: https://github.com/hernanchan/COTIZADOR/actions/runs/42282983405 (compilación completa, contrato R2 y regresión TUS/portal). **No equivale a probar rendimiento real en R2.**

### Bloqueos técnicos reales antes de habilitar subida del comprador
1. Configurar R2 por el titular (plan y permisos) y vincular bucket privado; mantener flag R2 OFF hasta culminar pruebas reales.
2. Limitar cuota mensual y cantidad de cargas simultáneas, bloquear abusos (el acceso comprador por sí solo no es control económico suficiente) y abortar sesiones multipart incompletas por regla de ciclo de vida.
3. Integrar ficha de PDF R2 con la **verificación de páginas y medidas y presupuesto del servidor**, sin que el Worker intente cargar todo el PDF de 200 MiB en RAM; después registrar D1/seguimiento y habilitar pago Sandbox bajo el contrato de pedido.
4. Descarga del PDF grande para el operador/ZIP con acceso solo de personal; borrado específico al marcar Entregado.
5. Cargar 80 y 200 MiB **reales** desde escritorio/celular; medir red y recálculo y contrastar tiempos con Supabase/TUS.

## Avance posterior — descarga segura de originales R2 para personal (06/11)

Implementado **API privada**, todavía sin interfaz Central ni despliegue, en:
- `integraciones/autocotizador/recepcion/r2-pdf-grandes-descarga-personal.mjs`
- `/prueba-v2/api/ensayo-r2-descargar-personal` del Worker, accesible **solo con Basic real de operador** (no con cookie de comprador, ni con proof aislado).
- Requiere flag R2, bucket privado y clave HMAC específica. Solicita comprobante firmado por POST con Origin del mismo Worker y valida su caducidad.
- Comprueba **SHA-256 íntegro** por streaming antes de entregar los bytes. En una segunda lectura `R2.get`, fija `onlyIf: {etagMatches: ...}` contra el ETag verificado: si el objeto cambia entre SHA y descarga, la respuesta no entrega el archivo. No se publica el bucket ni se carga el PDF entero en memoria.
- Devuelve `application/pdf`, adjunto con nombre derivado de UUID, `Content-Length` y `private, no-store`. Se creó prueba de descarga sintética de **45 MiB**, rechazo de corrupción, archivo truncado, Origin ajeno, comprobante falso y ETag cambiado.
- **CI final SUCCESS:** https://github.com/hernanchan/COTIZADOR/actions/runs/42293394411
- Docs oficiales contrastados: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ y https://developers.cloudflare.com/r2/api/workers/workers-api-reference/

**Limitación importante:** el proof R2 dura 2 horas. Esta API sirve para un ensayo inmediato, pero NO reemplaza la descarga permanente basada en pedido D1 ni el ZIP. Para explotación comercial habrá que guardar en D1 un registro R2 verificado, con autorización duradera por pedido, y resolver recálculo de páginas y tamaños desde el PDF grande antes de habilitar pagos. La lectura doble incrementa tráfico interno de R2 en esta etapa de seguridad y no tiene aún benchmark de rendimiento. **Ningún PDF grande se ha recibido ni descargado de una cuenta R2 real.**

## Avance siguiente — pre-registro R2 en Central (06/11)

- La Central de Pedidos actual `centralSafeManifest` restringe recibos individuales a **40 MiB** y exige cotización de páginas, medidas y precio realizada por el servidor. **No** se amplió el límite de TUS ni se relajó esta verificación.
- Se añadió `integraciones/mercadopago/pruebas/r2-grandes-central-pendientes.mjs`: tabla D1 independiente `central_r2_large_pending`, registro de archivo R2 de >40 hasta 256 MiB con `receiptId` derivado de la clave, SHA, ETag, pedido y estado `awaiting_pdf_analysis`; idempotencia y rechazo de cambios de recibo.
- Nueva ruta firmada `/internal/central/r2-pending-stage` en Worker de pagos, habilitada **solo** con `CENTRAL_R2_STAGING_ENABLED=PRIVATE_TEST_ONLY`. La ruta pre-registra **un archivo** y jamás crea orden comercial, cotización o pago. El archivo sigue pendiente de análisis de páginas.
- `r2-grandes-enviar-central.mjs` firma el envío de SHA-256 y ETag ya verificados en R2 por HMAC al Service Binding existente (`SABER_CENTRAL`) contra la ruta fija de pruebas. Está apagado mientras `DOCS_R2_STAGING_ENABLED` no se active. No hay secretos en GitHub.
- El endpoint `/prueba-v2/api/ensayo-r2/verificar` llama a la etapa de registro provisional solo tras SHA del original, devolviendo `stagedForCentral`; **no** devuelve `registeredInD1:true` ni habilita pago.
- Pruebas de verificación: URL central restringida, firma HMAC, orden ajena, ETag, SHA falso, recibo duplicado, reintento idempotente y límites. CI verde [42299145756](https://github.com/hernanchan/COTIZADOR/actions/runs/42299145756). Todo en rama privada, sin despliegue.

**Pendiente:** parser de páginas y tamaños de 200 MiB sin exceder memoria del Worker; unificación de presupuesto y pedidos mixtos TUS/R2; promoción desde tabla preliminar R2 a manifiesto de orden real; descarga desde D1 después de 2h; ZIP por orden; limpieza segura y pruebas reales de velocidad. No activar banderas ni pagos hasta completar estos puntos.

## Consulta persistente del PDF R2 tras vencer el proof — 06/11/2026

- La Central tiene ahora `/internal/central/r2-pending-lookup`, con **firma HMAC Worker-Worker**, `CENTRAL_R2_STAGING_ENABLED=PRIVATE_TEST_ONLY`, validación completa de `webOrderId` + `receiptId`, lectura exclusivamente de `central_r2_large_pending` sin crear pedidos ni escribir D1.
- Documentos consulta esa referencia mediante `r2-grandes-lookup-central.mjs` y el `SABER_CENTRAL` existente. No utiliza ni renueva el proof temporal de dos horas; no recibe rutas ni SHA suministrados por el comprador.
- Ruta experimental de descarga `/prueba-v2/api/ensayo-r2-descargar-d1-personal`, **solamente Basic de personal**. Descarga tras verificar SHA-256 de R2 por streaming y comparar ETag contra D1; segunda lectura condicional `onlyIf.etagMatches`. No hay URL pública ni archivo completo en RAM.
- Pruebas: lookup D1 con y sin registro, firma falsa, referencia ajena, orden cruzada, SHA/ETag incorrectos, descarga sintética de 45 MiB después de caducar la autorización de carga. CI completa en https://github.com/hernanchan/COTIZADOR/actions/runs/42301899955 **SUCCESS**.

**Precisión:** la tabla es de archivos pendientes `awaiting_pdf_analysis`; este camino permite revisión privada del original pero NO es todavía un pedido pagable ni descarga del ZIP de órdenes comerciales. Faltan análisis servidor de páginas/medidas de PDF grandes, unificación TUS+R2 en un único pedido, cuota de subida con límites antia-buso, borrado post-entrega y pruebas reales del bucket. Ningún flag se activó ni hubo despliegue.

## Lectura en rangos y cupo preventivo antes de habilitar R2 (06/11)

- Se creó `r2-lectura-parcial-segura.mjs`: `R2.get` por rango con ETag condicional contra D1, longitud exacta de respuesta, consulta previa `R2.head`, máximo **2 MiB por lectura, 64 MiB acumulados por sesión y 128 solicitudes**. Permite leer cabecera/cola sin alojar 200 MiB de una vez. Esto es una base de I/O **no** un parser de PDF; aún no confirma páginas ni precios.
- Se añadió `r2-grandes-cuotas-central.mjs` y ruta HMAC `/internal/central/r2-reserve` en Central. `INSERT ... SELECT ... WHERE` transaccional en D1 impone **2 GiB globales reservados**, **1 GiB y 10 archivos por pedido**; identidad estricta `WEB-ENSAYO-...` y reintentos idempotentes. Flag central `CENTRAL_R2_QUOTA_ENABLED=PRIVATE_TEST_ONLY` (apagado por defecto).
- `r2-grandes-reserva-central.mjs` solicita el cupo por Service Binding/HMAC. El endpoint de comprador `ensayo-r2/iniciar` **no crea multipart sin** `DOCS_R2_QUOTA_ENABLED=PRIVATE_TEST_ONLY`, reserva afirmativa de Central, orden válida y metadatos PDF correctos. Si no hay cupo devuelve 429; si faltan flags devuelve 503. No se habilitan pagos.
- Se agregaron tests de un PDF sintético de **200 MiB**, ETag cambiado, rangos manipulados, presupuesto de memoria, cuota global 2 GiB, cuota de pedido, identidad de archivo, firma HMAC, orden ajena, ausencia de flags y contenido no válido antes de reservar. Toda la regresión y compilación aprobadas en https://github.com/hernanchan/COTIZADOR/actions/runs/42304994129 .

**Limitación deliberada:** las reservas quedan contabilizadas hasta que el borrado post-entrega esté probado y pueda liberar cupos. Es una política conservadora, no una promesa de ausencia de cargos: Cloudflare puede cobrar por consumo fuera de su franquicia. Tampoco está resuelto el análisis autoritativo de páginas y medidas para PDF de 200 MiB: `pdf-lib` actual necesita el archivo completo y el Worker tiene memoria limitada. No habilitar flags de R2 ni cobros reales.

Referencias: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ (range y ETag condicional), https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html (PDF.js con transporte parcial; no se ha validado aptitud en Worker para 200 MiB).

## R2 ACTIVADO POR EL TITULAR — 06/11/2026

Captura del Dashboard Cloudflare recibida: bucket `saber-documentos-grandes-ensayo-20261106` creado en **Standard**, **Acceso público deshabilitado**, tamaño **0 B**. La activación R2 en la cuenta fue confirmada visualmente; ningún PDF de clientes está allí.

Se relanzó verificación idempotente desde GitHub Actions: https://github.com/hernanchan/COTIZADOR/actions/runs/42307358868. Bloqueo **R2_BLOCKED: falta secreto `SABER_CF_R2_ADMIN_TOKEN`**. No se intentó alterar ni recrear un bucket por falta de credenciales. No volver a pedir creación del bucket.

**Próximo paso mínimo:** vincular directamente el bucket al Worker **de pruebas** `saber-documentos-pruebas` con nombre de binding **`SABER_R2_GRANDES`** en Cloudflare Dashboard (sin generar token S3 ni hacer bucket público). No habilitar banderas, no desplegar Workers ni hacer uploads hasta completar parser autoritativo y verificar el enlace. En paralelo decidir método seguro de actualización Worker para no interferir con TUS vigente.

## VINCULACIÓN R2 CONFIRMADA POR EL TITULAR — 06/11/2026
El titular confirmó que en **Workers → saber-documentos-pruebas → Configuración → Vinculaciones** aparece el enlace:
- Variable: `SABER_R2_GRANDES`
- Bucket privado: `saber-documentos-grandes-ensayo-20261106`
- Asociación hecha desde Dashboard de Cloudflare. No se habilitaron flags de subida, no se desplegó código ni se cobró nada en esta etapa.

Comprobación independiente de solo lectura preparada en `.github/workflows/r2-verificar-binding-privado.yml`, utilizando el permiso de despliegue existente de GitHub para **GET** de ajustes sin mostrar secretos. La existencia de la vinculación no acredita todavía transferencia real ni presupuesto de PDFs grandes. Nunca publicar la web ni activar pagos reales en la verificación.

**Vinculación verificada de forma independiente:** GitHub Actions [42309493154](https://github.com/hernanchan/COTIZADOR/actions/runs/42309493154), SUCCESS, mediante GET de settings Cloudflare. Salida `R2_BINDING_VERIFIED_PRIVATE=saber-documentos-grandes-ensayo-20261106`. No se desplegó código, no se crearon objetos R2 ni se activaron pagos.


## STAGE SEGURO CONFIRMADO — 06/11/2026

- Workflow dedicado: `.github/workflows/r2-grandes-stage-seguro-privado.yml`; [ejecución 42311768698](https://github.com/hernanchan/COTIZADOR/actions/runs/42311768698), **SUCCESS**.
- Commit que validó la etapa: `2dd57edb71e5e3d29544b2073546112c0e218723`.
- Se recompiló el Worker completo y se aprobaron pruebas R2 y regresión TUS/portal/ZIP/pagos Sandbox.
- Preflight Cloudflare con lectura de `settings` y `deployments`: binding `SABER_R2_GRANDES` apunta al bucket correcto; servicio `SABER_CENTRAL` sigue apuntando a `saber-pagos-pruebas`; las compuertas R2 siguen apagadas.
- **Versión R2 preparada, INACTIVA:** `67f61c11-fe13-4193-aa30-e76450ed8597`.
- **Versión activa anterior y posterior, sin cambios:** `82ded703-0b3b-4e4b-ac7f-b312a78f78ea`.
- Alta de versión con `bindings_inherit=strict`: no se sustituyeron ni imprimieron secretos; antes y después se validó que la lista de nombres/tipos de bindings activos coincidiera.
- Portal sin credenciales: **HTTP 401 antes y después**.
- **Ninguna promoción/despliegue de versión, carga R2, activación de cobros reales, cambio de `main` o de web comercial**.
- El punto de reversión conocido es la versión activa `82ded703-0b3b-4e4b-ac7f-b312a78f78ea`; no se necesita rollback ahora porque no se reemplazó.
- **Siguiente decisión técnica:** preparar ensayo sintético de R2 (80 y 200 MiB en partes de 8 MiB) con autenticación, aislamiento y borrado de prueba; no activar las rutas comerciales R2 antes del parser autoritativo de páginas/medidas, integración D1/ZIP y purga post-entrega.

**Estado exacto:** infraestructura y versión inactiva confirmadas en Cloudflare; todavía **NO** hay 80/200 MiB transferidos realmente, benchmark de R2, cotización de PDFs grandes ni integración comercial.


### Auditoría adicional del objeto de versión R2 — aprobada
- Cloudflare GET `/versions/67f61c11-fe13-4193-aa30-e76450ed8597` y GET `/settings` devolvieron HTTP 200.
- [Actions 42312009205](https://github.com/hernanchan/COTIZADOR/actions/runs/42312009205) **SUCCESS**: lista de **nombres y tipos** de bindings de versión INACTIVA idéntica a los activos; R2 enlazado al bucket correcto y Central vinculada a pagos de pruebas; `DOCS_R2_BIG_ENABLED`, `DOCS_R2_QUOTA_ENABLED` y `DOCS_R2_STAGING_ENABLED` apagadas si existen.
- La versión activa seguía `82ded703-0b3b-4e4b-ac7f-b312a78f78ea`. Auditoría solo GET, sin secretos expuestos.
- Motivo de esta auditoría: el `bindings_inherit=strict` de la API hereda desde la **última versión subida**, no necesariamente desde la desplegada. Verificamos el resultado final, no solo la solicitud de herencia.


## PROMOCIÓN CONTROLADA DE CÓDIGO R2 APAGADO — 06/11/2026

**Worker de PRUEBAS actualizado realmente**, pero los endpoints R2 permanecen apagados.
- [Workflow de despliegue 42312455278](https://github.com/hernanchan/COTIZADOR/actions/runs/42312455278) **SUCCESS**; commit originador `5f410fc7acb66212b6d7d518f0219594debf2cf2`.
- Código actual del Worker `saber-documentos-pruebas`: versión `67f61c11-fe13-4193-aa30-e76450ed8597` (antes `82ded703-0b3b-4e4b-ac7f-b312a78f78ea`).
- Comprobación adicional previa [42312292318](https://github.com/hernanchan/COTIZADOR/actions/runs/42312292318) **SUCCESS**: coincidencia de los bindings **completos no secretos** y del runtime versionado con la versión anterior. Los secretos se heredaron por tipo/nombre, sin imprimirse.
- Pre/postdeploy: portal privado respondió **401** sin autenticación, GET de precios conservó su estado HTTP, y POST de inicio R2 respondió **503**, con `paymentAuthorized=false` y `checkoutEnabled=false`. Compilación y pruebas R2/TUS ya exitosas.
- El procedimiento está limitado al Worker de documentos de pruebas, utiliza solo POST `/deployments` para promover una versión auditada, y revierte a la versión anterior ante fallo de comprobaciones. No modificó `main`, la web comercial, ni el Worker de pagos.
- **Aún no se verificó un envío TUS real después del despliegue**; la regresión automatizada y smoke de acceso/precios sí están aprobados. No declarar que existe transferencia R2 real: todavía **0 B de prueba transmitidos** por este procedimiento.
- Próximo objetivo: ensayo autorizado con PDF sintético y tráfico realmente aislado; medir 80/200 MiB y reanudación sin activar el cotizador comercial R2. La URL de versión inactiva no estuvo disponible para GET (**404** [42312185758](https://github.com/hernanchan/COTIZADOR/actions/runs/42312185758)); no se modificó la opción de preview ni se abrió acceso público.

**Rollback manual si hiciera falta:** volver a promover `82ded703-0b3b-4e4b-ac7f-b312a78f78ea` en `saber-documentos-pruebas`; con comprobaciones y permisos, nunca editar `main`.


### Smoke autenticado post-despliegue — aprobado
- [GitHub Actions 42312640247](https://github.com/hernanchan/COTIZADOR/actions/runs/42312640247), **SUCCESS** después de promover `67f61c11`. Se usó el secreto existente de operador en GitHub Actions, sin imprimirlo.
- **Sin autenticación:** Documentos y Central rechazaron todas las rutas privadas muestreadas con HTTP 401.
- **Con Basic autorizado:** `/prueba-v2/`, `/prueba-v2/carga-inteligente`, `/prueba-v2/carga-inteligente.js` devolvieron HTTP 200; marcadores UI de configuración común e individual presentes.
- **Central** `/health` confirmó `ok=true`, `databaseReady=true`, `paymentsEnabled=false`.
- Solo solicitudes GET; sin crear pedidos, subir archivos o efectuar pagos.
- **No confundir el smoke GET y las simulaciones del CI con una subida real TUS o R2 posterior al despliegue.** Primer ensayo de 80/200 MiB R2 continúa pendiente.


## PRIMERAS TRANSFERENCIAS REALES 80/200 MiB — 07/11/2026 UTC

**Pruebas con R2 real, no simulaciones.**
- Canario aislado `saber-r2-canario-<run-id>`, creado únicamente por GitHub Actions, con token efímero y binding al mismo bucket privado. Nunca utilizó rutas, precios, D1, pagos ni los archivos de clientes; Worker comercial y `main` intactos.
- Se generaron dos archivos **PDF sintéticos con estructura PDF y tamaño exacto** 80 MiB / 200 MiB. Multipart 8 MiB por parte, 3 partes iniciales y pausa deliberada del proceso; segundo proceso reanudó desde los ETags persistidos, sin repetir esas 3 partes.
- **Fallo REAL descubierto y corregido:** Cloudflare R2 generó un `uploadId` de **343 caracteres**. El contrato previo sólo aceptaba 256. Commit [1f2aed4](https://github.com/hernanchan/COTIZADOR/commit/1f2aed4dd19eb0df8c1b26c8bfff218daabc90b2): máximo 1024 y abortar multipart si la validación/firma inicial falla. Agregados tests de 343 y 1025 caracteres.
- **Segundo fallo REAL:** verificación original con stream completo retornó HTTP 503 para 80 MiB; la lectura directa sin `TransformStream` funcionó a 80 MiB, pero también retornó 503 con 200 MiB. Se evitó leer el objeto completo usando **25 GET por rango de 8 MiB** para 200 MiB, siempre comparando ETag de `head`, y **una única cadena SHA-256** con `crypto.DigestStream`, sin hashes de trozos independientes. Nueva implementación en `r2-pdf-integridad-stream.mjs` con tests de rango alterado, ETag cambiante, tamaño y cabecera. Commit [18084d0](https://github.com/hernanchan/COTIZADOR/commit/18084d04cf9407e25f59216a472a43d1eae396d5).
- **Prueba definitiva del MÓDULO CENTRAL R2 real**: [Actions 42332131513](https://github.com/hernanchan/COTIZADOR/actions/runs/42332131513) **SUCCESS**:
  - 80 MiB: **10 partes**, 7 recuperadas tras pausa; transferencia activa **3.354 ms**, velocidad efectiva **23,85 MiB/s**, SHA completo servidor por rangos **5.086 ms**; PDF borrado, ausencia confirmada.
  - 200 MiB: **25 partes**, 22 recuperadas tras pausa; transferencia activa **6.817 ms**, velocidad efectiva **29,34 MiB/s**, SHA completo servidor por rangos **12.917 ms**; PDF borrado, ausencia confirmada.
  - `R2_CANARY_BUCKET_PREFIX_EMPTY_CONFIRMED`, Worker canario **eliminado HTTP 200**, Worker Documentos entonces activo sin cambiar.
- Las mediciones son **desde GitHub Actions**, no la conectividad del comprador de Córdoba; transferencia activa excluye la pausa deliberada, generación del PDF y hash final. Son pruebas de transporte y bytes, **NO** verificación de páginas/medidas ni presupuesto.
- El primer intento fallido, anterior al arreglo de `uploadId`, creó posiblemente una sesión multipart sin ninguna parte transferida. Su abortado no pudo acreditarse por falta del identificador firmado, aunque el Worker temporal sí se eliminó y la lista de objetos finalizados quedó vacía. Cloudflare documenta auto-aborto de multipart incompletos tras 7 días por defecto. Los arranques posteriores ya abortan en error y el canario final pasó sin residuos de objetos.

### Integración del módulo corregido al Worker de pruebas

- Regresión completa en [42332093811](https://github.com/hernanchan/COTIZADOR/actions/runs/42332093811) **SUCCESS**.
- Nueva versión subida sin activar, con paridad de bindings no secretos y runtime confirmada: `b7405698-8b7c-48ea-8642-3552916a2adf`; [workflow 42332186229](https://github.com/hernanchan/COTIZADOR/actions/runs/42332186229) **SUCCESS**.
- Se promovió **solo código, flags R2 OFF** en `saber-documentos-pruebas`: [workflow 42332244497](https://github.com/hernanchan/COTIZADOR/actions/runs/42332244497) **SUCCESS**. Versión activa desde esa ejecución: `b7405698-8b7c-48ea-8642-3552916a2adf`; rollback: `67f61c11-fe13-4193-aa30-e76450ed8597`. Portal anónimo **401**, rutas R2 **503 sin autorizar cobro**, GET precios con mismo estado HTTP.
- No se modificó Worker de pagos, ni `main`, ni web comercial. No se habilitaron banderas R2 ni cobros reales.

**Pendiente esencial antes de clientes:** análisis confiable de páginas/medidas de PDFs grandes usando rangos, tarificación autoritativa, pedidos mixtos TUS+R2, D1/ZIP, expiración y purga segura post-entrega; pruebas móviles de red y subida TUS real posterior al despliegue. No confundir prueba de integridad real con pedido listo para cobrar.


### Smoke del Worker activo después del despliegue
- [42332273427](https://github.com/hernanchan/COTIZADOR/actions/runs/42332273427) **SUCCESS**: rutas privadas anónimas HTTP 401; las pantallas de Documentos `/prueba-v2/`, `/prueba-v2/carga-inteligente` y recurso JS responden HTTP 200 autenticado con marcadores esperados. Central `/health`: `ok=true`, `databaseReady=true`, `paymentsEnabled=false`.
- [42332273395](https://github.com/hernanchan/COTIZADOR/actions/runs/42332273395) **SUCCESS**: CI TUS y R2 sin despliegue. No se ejecutó pedido real TUS ni transacción en esta comprobación.
