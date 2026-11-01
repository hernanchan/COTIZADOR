# Librería Saber — Plan de integración privada del transporte TUS comprobado
**1 de noviembre de 2026 · estado: propuesta documentada, NO IMPLEMENTADA**

## Evidencia de partida

- La web del laboratorio aislado, `hernanchan/saber-laboratorio-pdf`, ruta `/reales/`, **subió y verificó dos PDFs reales con SHA-256/páginas correctos** el 01/11/2026 a las 00:22 ART. Captura del usuario: **17,02 MiB + 9,66 MiB, 16 páginas en cada PDF**, **9,95 s de reloj total**; lectura local **0,51 s**, autorización **2,35 s**, subida TUS **3,99 s**, verificación server-side **3,09 s**. Sin D1 ni pedidos ni cobros.
- Corroboración independiente SQL de Supabase: invitación de uso único marcada `consumed=true`; 2 claves asignadas; **0 objetos remanentes correspondientes a la sesión** tras eliminación; bucket `saber-tus-lab` privado. Hay **4 objetos sintéticos históricos** en el bucket (2 ensayos anteriores), no son los PDFs reales recién enviados.
- Logs remotos: `/start` POST 200, dos firmas de subida 200, TUS PATCH 204 (fragmentado), `/verify` POST 200 (03:22:30 a 03:22:39 UTC). Resultado observado, no simulación.
- Frente al viejo Worker→Apps Script→Google Drive, las pruebas antiguas con otros archivos tardaron **93,5 y 97,7 s, y finalizaron 1/2 verificado** (etapa `LECTURA_DRIVE`). No atribuir a esta comparación una aceleración causal exacta: el nuevo ensayo **no incluyó cotizador, D1, estado de pedido, descarga de taller ni pagos**, y documentos distintos.
- **Conclusión demostrada:** TUS directo navegador → Supabase Storage con autorizaciones por objeto, relectura privada, SHA-256 y conteo de páginas es viable para 2 PDF de ~26,68 MiB en este entorno. **No demuestra que el cotizador comercial esté terminado.**

## Regla de alcance

Continuar en **rama privada**, sin tocar `COTIZADOR/main`, sitio `libreriasaber.com.ar`, Workers y Apps Script activos, Polaroids, ni activar Mercado Pago. **No hacer nuevos despliegues ni cambiar infraestructura de producción sin autorización explícita del dueño.** El código del laboratorio público NO debe usarse como autenticación comercial: el esquema de invitación actual sirve solo para pruebas y borra el archivo después de verificar.

## Arquitectura incremental propuesta

1. **Conservar interfaz de cotización y reglas actuales** de A4/A3, B/N-color, simple/doble faz, anillado junto/separado/mixto, ploteos CAD/Póster, tamaños, rotación, clasificación, precios y resumen arriba. Cambiar **únicamente la recepción de bytes** y sus estados, detrás de un flag privado `RECEPCION_TUS_LAB`. Mantener un botón único de envío.
2. El Worker privado autentica cada intento, fija `orderId` idempotente, límites por archivo/tanda y emite a navegador autorizaciones temporales de subida al bucket privado **por archivo de ese pedido**. Las claves de servicio nunca salen del servidor; Turnstile no debe pedirse varias veces por cada fragmento.
3. Browser usa **TUS directo en 2 carriles con progreso real**. Envía metadatos mínimos y SHA calculado localmente; nunca publica URLs `getPublicUrl` ni envía contenido por Google Apps Script.
4. Servidor verifica independientemente la existencia, SHA-256, bytes, tipo PDF y número de páginas, compara opciones/tamaño esperado y devuelve estado verificable por archivo. PDFs con contraseñas o páginas imposibles generan error claro. No contar sólo con el análisis del navegador.
5. **Registrar un único pedido en D1 solamente tras recibir todos los archivos**. Definir estado transitorio de carga / verificación / registro y mecanismo idempotente de reconciliación ante cortes de red o fallo parcial entre Storage y D1. No marcar pagado ni producir si falta un objeto.
6. La Central privada conserva referencia a objetos y habilita **descarga autenticada, temporal y auditable por el personal**. Eliminar archivos únicamente después de la entrega o según plazo comercial acordado (NO aplicar la eliminación inmediata del ensayo a pedidos reales).
7. Programar limpieza de cargas abandonadas y archivos vencidos, límites de cuota/costo/egreso y control de abuso. Medir latencia real por etapa e informar errores sin datos sensibles.

## Condiciones de aceptación antes de utilizarlo con clientes

- **Integridad:** 2/2 y luego 5-10 PDFs reales de ensayo autorizados, páginas/SHA iguales en navegador y servidor; impedir pedido D1 con un documento no verificado.
- **Confiabilidad:** corte de red, repetición, doble clic, bloqueo de sesión y recarga; sin pérdidas, sin duplicados, reanudación correcta con TUS y conciliación D1.
- **Seguridad:** bucket siempre privado, políticas de roles, URLs temporales sólo para personal y tokens por objeto; no exponer `service_role`; privacidad y retención demostradas.
- **Desempeño:** medir tamaño real, tiempos de carga, confirmación y cotización completa, p50/p95 en escenarios de 1/2/5/10 documentos; no asumir que el resultado de 9,95 s se repetirá para clientes.
- **Capacidad y costos:** comprobar plan Free, límites de almacenamiento/egreso/tamaño, volumen diario probable, expiración de proyecto inactivo, mecanismos de borrado y alternativa antes de depender del servicio como producción.
- **Negocio:** Central D1 usable, posibilidad de descargar documentos para imprimir, total de presupuesto correcto y trazabilidad del pedido; pagos permanecen desactivados hasta autorización separada.
- **Rollback:** bandera que permite volver al circuito anterior sin migraciones destructivas, pero **el anterior está fallando** y no debe usarse comercialmente hasta reparar o sustituir.

## Próxima acción técnica sin intervención del comerciante

En la rama experimental, comparar interfaces reales del Worker privado y `lab-tus-one-use`, construir contrato interno para **inicio firmado → subida → verificación → manifiesto → alta D1**, con tests que ejecuten lógica de almacenamiento y no sólo simulen `multiReadPart`. **No desplegar ni pedirle más archivos al usuario hasta que el diseño y su tratamiento de fallos estén listos.**

### Relación con registros anteriores
- `docs/EXPERIMENTO-TUS-SUPABASE-20261031-ESTADO.md` (evidencia E2E de 9,95 s)
- `docs/AUDITORIA-BASES-OPEN-SOURCE-20261031.md`
- `docs/DIAGNOSTICO-502-LOTE-20261028.md`
- `docs/UX-CIRCUITO-UNICO-CLIENTE-V1.md`


## 01/11/2026 — Primer ensayo integrado bloqueado: se usó DRIVE, no TUS

- Captura del usuario del portal `/prueba-v2/`: error `[etapa LECTURA_DRIVE]`, 0 de 2 PDF verificados y control Turnstile visible. Es evidencia DIRECTA de que `TUS_ENABLED` se evaluó falso al generar la pantalla; el envío cayó en el transporte viejo Google Drive. No afirmar que Supabase falló: no recibió esa tanda.
- Comprobación independiente Supabase Storage: 0 objetos nuevos en los 20 minutos anteriores a las 13:18 UTC; cuatro objetos anteriores, sin nuevas transferencias confirmadas.
- El código condicionaba `TUS_ENABLED` a `tusPrivadoConfigurado(env)`; el pipeline legada seguía disponible silenciosamente si faltaba cualquier requisito. Faltan identificar las condiciones EXACTAS que no se cumplieron en el Worker desplegado. NO concluir que una clave particular es incorrecta sin comprobarlo.
- Corrección en rama `integracion/tus-pedido-privado-20261101`: `diagnosticarTUSPrivado(env)` ofrece exclusivamente los nombres de requisitos fallidos bajo portal Basic privado, sin valores de secretos; la nueva pantalla V2 impide el envío si TUS no está listo, en vez de caer en Drive. Incluye prueba de regresión sintáctica. Commits `46288b2d`, `f77336d8`, `852d7cef`, `2f161b09`, `312df392`, `3829f524`.
- Se solicitó preparar una nueva versión PRIVADA INACTIVA por GitHub Actions, trigger commit `61fe82cb`. No está validada como compilada/desplegada/promovida en el instante de este registro.
- PRÓXIMO PASO: comprobar que `Verificar integración TUS privada` y `Preparar TUS privado INACTIVO` de `61fe82cb` están verdes; localizar la versión nueva creada; promoverla únicamente al Worker `saber-documentos-pruebas`. Abrir `/prueba-v2/` SIN subir PDFs. Si muestra mensaje bloqueado, copiar SOLAMENTE nombres de requisitos fallidos y corregirlos en Cloudflare, sin revelar secretos ni más pruebas de archivos. Si la página confirma TUS habilitado y oculta Turnstile, entonces hacer una prueba E2E controlada. Nunca repetir un envío por Drive.


## 01/11/2026 10:42 ART — activación automática confirmada

- El workflow de GitHub desplegó en el Worker **de pruebas** `saber-documentos-pruebas` una versión de la rama TUS.
- La comprobación autónoma contra Cloudflare `GET /deployments` quedó guardada en `docs/ESTADO-TUS-ACTIVACION-20261101.json`: `estado=ACTIVA_PRIVADA`, `version_activa=6e6ff6aa-b85c-4d67-a922-ebb31c74b37d`, `deployment_id=5dc27553-0f5f-4d8e-8093-07a2cd789574`, consulta `2026-11-01T13:42:26Z`.
- El código de la rama ahora impide fallback al circuito Drive y muestra condiciones TUS incumplidas solo tras acceso Basic. El workflow de activación comprueba que /prueba-v2/ devuelve HTTP 401 sin acceso autenticado.
- **Esto prueba despliegue activo protegido, NO prueba E2E TUS**: falta abrir /prueba-v2/ autenticado, comprobar que NO muestre bloqueo de TUS ni Turnstile y entonces realizar una única prueba controlada con dos PDF no confidenciales; observar transferencia Storage, registros D1, cotización y descarga desde Central.
- No repetir pruebas por Drive ni promover versiones anteriores. No activar cobros ni modificar sitio comercial.


## 01/11/2026 10:53 ART — fallo rápido de autorización TUS y protección previa

- Primera prueba funcional de 2 PDF A4 (16 páginas cada uno, total preliminar ARS 2.432) mostró mensaje «Pedido pendiente: No se pudo autorizar la tanda de PDF», sin etapa específica. Evidencia de que TUS fue seleccionado, pero el pedido NO se registró. No repetir carga sin diagnóstico.
- Se revisó `tus-pedido-worker.mjs`: el endpoint `/api/ensayo-tus-iniciar` devolvía el mismo error 403 para autenticación, metadatos o rechazo Storage; por eso la captura sola NO identifica causa definitiva.
- Se implementó preflight autenticado `POST /api/ensayo-tus-comprobar` que solicita únicamente un token de firma a Storage con una ruta aleatoria, sin transmitir ni guardar PDF, sin exponer token ni secretos; respuesta restringida a códigos seguros `STORAGE_FIRMA_OK`, `STORAGE_HTTP_NNN`, `AUTORIZACION_PORTAL` o `STORAGE_FIRMA_ERROR`. El botón del cliente queda bloqueado hasta la respuesta positiva. En `/api/ensayo-tus-iniciar`, ahora se expone solo etapa segura (sin detalles ni valores sensibles).
- Cambios de rama: `b8d67e71`, `6f13ef9c`, `749aa845`, `04a45a1a`, `c134a908`, `bf04446e`, `2b53da19`; auto-promoción privada disparada en commit `e26ac04c`.
- **Activación nueva confirmada** por registro GitHub automático `docs/ESTADO-TUS-ACTIVACION-20261101.json`: versión `baed6a9f-9f1e-4f18-afa3-420bfc3d2669`, deployment `2fd51b70-4dc6-46a2-a474-2b1345d86387`, consulta Cloudflare 2026-11-01 13:53:02 UTC.
- **PRÓXIMO PASO EXACTO:** abrir de nuevo el portal privado `/prueba-v2/` SIN subir archivos; observar mensaje de preflight en la barra superior. Si muestra `STORAGE_FIRMA_OK` indirectamente («Supabase/TUS verificado»), seguir a una sola prueba controlada de 2 PDF; si muestra `AUTORIZACION_PORTAL` o `STORAGE_HTTP_NNN`, corregir la causa específica, no solicitar otra carga. Después confirmar Storage, D1, precio y descarga desde Central.
- No activar pagos, no modificar web comercial, no reintroducir Google Drive.


## 01/11/2026 ~11:05 ART — preflight falló AUTORIZACION_PORTAL, corrección de alcance Basic

- El usuario refrescó `/prueba-v2/` sin archivos; el mensaje confirmó `AUTORIZACION_PORTAL`. Se origina en `ensureRequest` y agrupa autenticación privada, compuerta TUS y comprobación de Origin; la pantalla tenía `TUS_ENABLED=true`, de modo que el requisito está pasando. **No hay evidencia de fallo Storage; no afirmar que las claves sean incorrectas.**
- Riesgo detectado: el acceso Basic del navegador se solicita en `/prueba-v2/`, pero las llamadas de preflight/inicio/registro estaban en `/api/ensayo-tus-*`; la autorización HTTP Basic puede ser de alcance de directorio. El sistema incluía cookie HttpOnly de ese segundo prefijo, pero su disponibilidad real todavía no estaba confirmada.
- Cambios en la rama: trasladar únicamente las llamadas de navegador (preflight, inicio y registro) a `/prueba-v2/api/ensayo-tus-*`, manteniendo rutas anteriores compatibles; emitir cookie HttpOnly SameSite=Strict/ Secure con Path=/prueba-v2/api/, usando la misma firma HMAC de 30 minutos y conservando la verificación Basic o cookie en el servidor. La descarga del personal NO se trasladó ni se relajó su exigencia Basic. Se agregaron pruebas de coincidencia de rutas, cookies y estado seguro. El preflight ahora diferencia errores seguros `SESION_PRIVADA`, `ORIGEN_SOLICITUD`, `CONFIGURACION_PRIVADA` (sin filtrar credenciales).
- Commits principales: `8106e38b`, `22479550`, `4d7bf9b4`, `9c205071`, `80023ef6`. Activación privada solicitada con trigger commit `c882ef4b`. Comprobación de nueva versión iniciada con trigger `713959f8`. **No afirmar despliegue hasta leer JSON actualizado y comprobar versión distinta de `baed6a9f-9f1e-4f18-afa3-420bfc3d2669`.**
- Próximo paso: confirmar ejecución verde del despliegue privado y reporte GitHub `docs/ESTADO-TUS-ACTIVACION-20261101.json`. Abrir `/prueba-v2/` sin PDF y leer preflight. Solo si dice «Supabase/TUS verificado» realizar un ensayo de dos PDF. No más intervención Cloudflare ni cambios de claves sin evidencia.


## 01/11/2026 — despliegue de autenticación corregida confirmado y protegido

- Diagnóstico GitHub Actions automatizado en `docs/DIAGNOSTICO-ACTIVACION-TUS-20261101.json` y logs run 41314740662: fallaban pruebas por expectativa obsoleta `AUTORIZACION_PORTAL` cuando código responde `SESION_PRIVADA`; test corregido commit `d362dfdc`.
- Segundo run 41320546587: pruebas completas y compilación APROBADAS, POST Cloudflare /deployments `success:true`; workflow marcado failure por asumir incorrectamente `.result.versions` en respuesta POST. Corregido para verificar por GET, commit `67a84bb8`.
- Comprobación independiente Cloudflare GET confirmó versión privada `c172461f-5986-4ca6-86e7-633b72bacbc2` (deployment `b68dcb3a-dde1-4285-a2b0-d3fab823e513`). Reporte autónomo `docs/ESTADO-TUS-ACTIVACION-20261101.json` actualizado a 2026-11-01 15:20:58 UTC.
- **Seguridad verificada**: solicitud ANÓNIMA a `/prueba-v2/` respondió HTTP 401, `portal_protegido:true`, sin exponer contraseñas ni modificar la web comercial.
- **Única prueba pendiente**: abrir el portal privado ya autenticado y SIN archivos, hacer Ctrl+F5 y leer el mensaje de preflight: debe mostrar `Supabase/TUS verificado`; solo después ensayar el envío de dos PDF, cotejar Storage/D1/precio/descarga. Si surge `SESION_PRIVADA`, `ORIGEN_SOLICITUD`, o `STORAGE_HTTP_NNN`, resolver sin volver a cargar archivos.
- No confundir despliegue seguro con E2E de archivos. No activar cobros ni publicar.


## 01/11/2026 12:25 ART — autorización privada superada, diagnóstico Storage granular activo

- Captura cliente en /prueba-v2/: preflight devuelve `STORAGE_FIRMA_ERROR` (no es fallo de cookie: la petición llega al paso de solicitar firma Storage). No subir más PDFs ni cambiar claves sin código preciso.
- Firma Storage en `tus-pedido-worker.mjs` tenía un error genérico que mezclaba errores de red/lectura, JSON ilegible y ausencia de token; ahora retorna códigos seguros `STORAGE_FETCH_FAILURE`, `STORAGE_BODY_FAILURE`, `STORAGE_HTTP_NNN`, `STORAGE_RESPONSE_JSON`, `STORAGE_TOKEN_MISSING`, `STORAGE_RESPONSE_SIZE`, sin registrar respuesta/token/credenciales. Tests cubren casos. Commits `ddd5f523` y `221cd7c0`.
- CI y despliegue privado `bb144f3a` run `41321078333` SUCCESS, 23/23 pruebas iniciales, 67/67 en compilación, compilación satisfactoria. Versión `76b3bd4f-4bc6-425b-b231-6866ce8249a8` confirmada por Cloudflare GET a 2026-11-01 15:25:32Z. Protección sin autenticación HTTP 401 confirmada. Sin cobros ni cambios al sitio comercial.
- **Próximo paso:** únicamente refrescar portal con Ctrl+F5, SIN PDF, y leer nuevo código específico de preflight. Según código, investigar el fallo exacto del Worker->Supabase antes de otra prueba E2E. No afirmar que el envío funciona todavía.


## 01/11/2026 12:29 ART — STORAGE_FETCH_FAILURE y corrección host directo

- Última captura usuario de /prueba-v2/ (sin PDF) devolvió `STORAGE_FETCH_FAILURE` al intentar la firma; autenticación privada ya superada. NO implica que servicio Supabase haya rechazado autorización, sino excepción de `fetch()` antes de respuesta HTTP.
- Revisión del código mostró firma y lectura en `https://qkbbqzbannyhuanngjpw.supabase.co/storage/v1/...` con `redirect:'error'`, mientras la transferencia TUS usaba `https://qkbbqzbannyhuanngjpw.storage.supabase.co`. La documentación Supabase recomienda host directo de Storage para carga de gran tamaño; redirección del dominio general es una HIPÓTESIS, no comprobación. Se alinearon firma y lectura con host directo; se conserva `redirect:'error'` y claves server-only. Commits `d66122a4` y `6bf2e97d`.
- Deployment automático en Worker SOLO privado `saber-documentos-pruebas`: run GitHub Actions `41321459659` finalizó SUCCESS: 23/23, 67/67, 4/4 pruebas, compilación y control HTTP401. Nueva versión confirmada por el workflow vía Cloudflare GET: `7dcde728-f855-49f2-8b98-756e3f2ba48a`, 100% tráfico del worker de prueba; NO afecta web comercial ni pagos.
- **Pendiente de verificar** preflight firmado REAL: abrir portal privado, Ctrl+F5 SIN subir PDFs. Éxito esperado `Supabase/TUS verificado`. Si sigue `STORAGE_FETCH_FAILURE`, NO repetir reemplazo de claves ni pruebas por PDFs; investigar Cloudflare outbound fetch y redirección con medición segura (sin tokens ni datos clientes).
- Todavía NO existe prueba extremo a extremo confirmada del pedido bajo esta versión.


## 01/11/2026 12:33 ART — CAUSA RAÍZ DOCUMENTADA: redirect:error no compatible con Cloudflare Workers

- Última prueba del usuario persistía en `STORAGE_FETCH_FAILURE` aun usando `*.storage.supabase.co`. Se investigó documentación oficial `https://developers.cloudflare.com/workers/runtime-apis/request/`: Workers **no implementa** `RequestInit.redirect="error"`; lo rechaza con TypeError en `fetch()` **antes de enviar la solicitud**. Esta es causa determinista del error observado, no un problema de Supabase, sus claves ni conexión DNS.
- `tus-pedido-worker.mjs` usaba `redirect:'error'` en `firmarSubidaSupabase` y `leerObjetoTUSPrivado`. Se reemplazó por `redirect:'manual'` (válido en Workers) con rechazo explícito de HTTP 3xx, sin seguir Location ni exponer Authorization o apikey a otro destino. Se añadió código seguro `STORAGE_REDIRECT_BLOCKED`. Commits `29339936`, tests `49a304a3`.
- CI/activación sólo entorno privado: run GitHub Actions `41321763599` SUCCESS, suite 23/23 + 67/67 + 4/4, Worker pruebas versión `8cf6c9cb-f52d-4508-bf2e-61b2dc483df6` activa según logs del workflow; control de acceso sin credenciales HTTP 401, web comercial y cobros no modificados. Trigger `e3b642ec`.
- **Próximo paso**: abrir /prueba-v2/ con sesión privada y Ctrl+F5 **sin archivos**. Debe mostrar `Supabase/TUS verificado`; si no, usar el código granular sin cambiar credenciales ni reinstalar integraciones. Sólo tras preflight OK intentar un pedido de ensayo de 2 PDF; después comprobar Storage, D1 y descarga del comercio. No afirmar E2E hasta ese ensayo.

## 01/11/2026 12:34 ART — PRE-FLIGHT REAL EXITOSO, E2E aún pendiente

- Captura de la pantalla privada, ya con versión `8cf6c9cb-f52d-4508-bf2e-61b2dc483df6`, muestra literalmente: «Supabase/TUS verificado. Los PDF se enviarán directamente a almacenamiento privado.» La solicitud de firma sin subir PDF superó autenticación Worker y Storage.
- Supabase SQL `storage.objects` (bucket `saber-tus-lab`) ANTES del primer nuevo ensayo: **4 objetos**, `max(created_at)=2026-11-01 03:05:05.775481+00`. Permite comparar llegada de 2 PDF nuevos sin identificar usuarios ni abrir documentos.
- Siguiente paso exacto: UNA prueba de pedido con 2 PDF A4 de ensayo, B/N SF, una copia, sin anillado, un solo clic; luego consultar Storage nuevos, registro D1 y acceso privado. No declarar E2E hasta validar los tres. No activar cobros ni Google Drive.


## 01/11/2026 ~12:36 ART — primer pedido integrado REAL exitoso, falta descarga desde la Central

- Captura del usuario, `/prueba-v2/`: **«Pedido recibido correctamente», «Pedido verificado y registrado correctamente», «2 PDF verificados y registrados», «Total verificado $2.432», «Pago desactivado»**. Número comercial de ensayo `e2d76c8b-ce1c-4daf-9030-4bd402295a68`.
- Comprobación DIRECTA en Postgres `storage.objects` del proyecto `qkbbqzbannyhuanngjpw`, bucket privado `saber-tus-lab`: dos objetos recién creados con prefijo `v2/WEB-ENSAYO-01937C3514FB89DC23D78AE7BCBCDDDD/`:
  - 15:36:09.9342 UTC, 10.131.027 bytes
  - 15:36:10.801454 UTC, 17.849.230 bytes
  - La cantidad total de objetos pasó de 4 a 6, sin otra recepción registrada para el pedido de ensayo. PDF reales enviados y almacenados.
- Se revisó el backend `tus-pedido-worker.mjs`: antes de responder OK, exige `registrado.registeredInD1===true` con recuento de recibos y `prepararDocumentosCentralFirmado` devuelve el número de pedido comercial/importe sin autorización de cobro. Por tanto, la UI atestigua confirmación recibida del backend del registro D1; **no constituye consulta SQL directa**.
- Se intentó verificación independiente mediante Github Actions con consultas de solo lectura a Cloudflare D1 API `GET /d1/database` + `SELECT/PRAGMA`, sin exponer PII ni modificar registros. Resultado en `docs/RESULTADO-D1-TUS-20261101.json`: `HTTP_401` por falta de acceso API con el token de despliegue; **NO** significa que el pedido no exista. No solicitar credenciales al usuario ni ampliar permisos sin autorización.
- **Pendiente para cierre verdadero:** desde el Centro de Pedidos privado confirmar que el pedido aparezca con sus DOS archivos, que el importe coincida y que un operador pueda descargar ambos PDF mediante endpoint protegido (incluida integridad SHA). La pantalla de éxito no demuestra todavía que la UX del Centro esté integrada ni la descarga verificada. No activar cobros ni web pública, no repetir subida de PDFs.
- Los detalles y continuidad están guardados en la rama privada `integracion/tus-pedido-privado-20261101`. No volver a Google Drive.


## 01/11/2026 12:54 ART — Central de Pedidos: acceso a originales TUS implementado y desplegado

- El pedido de ensayo `e2d76c8b-ce1c-4daf-9030-4bd402295a68` tiene 2 PDF reales de 17.849.230 y 10.131.027 bytes guardados en Supabase Storage privado, `v2/WEB-ENSAYO-01937C3514FB89DC23D78AE7BCBCDDDD/`. Total verificado ARS 2.432; `awaiting_payment`, ningún cobro autorizado.
- Hallazgo: la Central `saber-pagos-pruebas` incluía lista de `/admin/api/central/unpaid` pero sin acceso a detalle/descargas; `/admin/api/order` solamente muestra pedidos pagados. El Worker documental ya disponía de `descargarPdfTUSPersonal` con verificación de pertenencia en D1 y SHA antes de devolver bytes.
- Implementación nueva, SOLO rama privada: página del operador `/prueba-v2/personal-descargar` autenticada por HTTP Basic; descarga por `POST /prueba-v2/api/ensayo-tus-descargar-personal` con Basic obligatorio, origen coincidente, cuerpo JSON, lectura privada y contraste D1 + SHA-256. La URL incluye solo orderId y receiptId, sin tokens de Storage. Código `pantalla-descarga-tus-personal.mjs` y `worker-fase4-cotizador-unificado.mjs`. La Central suma `/admin/api/central/unpaid-detail?id=<commercial UUID>`, protegido por DEMO_ADMIN_KEY, lista dos recibos y ofrece link a descarga personal por cada PDF sólo para IDs WEB-ENSAYO-<32 hex>. No abre pagos ni habilita producción/impresión.
- CI documental `41323377931`: pruebas 28/28, 67/67 y 4/4; nuevo Worker documental `677fed48-ee8d-43dc-bb1d-1773d1b8f4ba`, protección anónima 401. CI Centro `41323518240`: 4/4 tests y HTTP 401 en API sin token, `/health` devuelve databaseReady=true, paymentsEnabled=false; Worker privado `saber-pagos-pruebas` versión `ed95d696-ed57-47ad-aa22-2668de854970` en 100% del tráfico de pruebas, rollback configurado. Nada en main o web comercial.
- El test heredado `tests/central-bridge-d1.test.mjs` tiene una fixture antigua de anillado que no pasa la validación vigente; no se alteró lógica comercial. La nueva prueba aislada `tests/tus-central-staff-download.test.mjs` valida autorización DEMO_ADMIN_KEY, lookup D1, 2 recibos, cero autorización de pago, y rechazo de pedidos ajenos.
- **PENDIENTE PARA CERRAR**: el operador entra en `https://saber-pagos-pruebas.libreriasaber.workers.dev/admin`, usa su clave privada, sección «Pedidos con PDF y pago pendiente» → «Consultar pedidos sin pago confirmado», busca el pedido `e2d76c8b-ce1c-4daf-9030-4bd402295a68`, pulsa «Ver PDF privados», y «Descargar PDF original» para cada uno. Se abre ventana del Worker documental protegida con Basic, desde donde descarga tras validar D1 y SHA. Hasta que se pruebe con estos dos objetos NO afirmar descarga extremo a extremo. Se descargan PDFs originales; el PDF compuesto/imponible y otros módulos (anillado, ploteos) NO están terminados por esta mejora.


## 01/11/2026 13:04 ART — botón «Ver PDF privados» parecía inactivo; corregida posición del resultado

- Captura del usuario de `saber-pagos-pruebas.../admin`: la sección «Pedidos con PDF y pago pendiente» lista correctamente el pedido `e2d76c8b-ce1c-4daf-9030-4bd402295a68` (2 PDF, ARS 2.432) y muestra el botón «Ver PDF privados». El usuario indica «está el botón pero no funciona».
- **Causa visible en código**: `showUnpaidDetails(id)` escribía resultado en `#details`, ubicado bajo la sección «Pedidos pagados» después de la larga lista de pagos pendientes; tanto el éxito como los errores aparecían fuera del viewport, sin feedback junto al botón. No hay evidencia de fallo en el endpoint para ese clic previo porque no se dispone de su respuesta.
- Corrección en `integraciones/mercadopago/pruebas/worker.js`: el botón crea y muestra un `.unpaid-result` justo debajo del pedido elegido. Incluye estado «Consultando…», muestra datos de archivos / botones de descarga y errores en el mismo bloque, scroll local y deshabilitación del botón mientras consulta. Mantiene `/admin/api/central/unpaid-detail` con validación `DEMO_ADMIN_KEY`, archivo privado Basic y protección SHA+D1 sin cambios.
- Prueba regresión de HTML script y posicionamiento de detalles: `tests/tus-central-staff-download.test.mjs` (5/5 aprobadas). Commit código `fecce27e`, test `25fb1ea3`, activación `3e0c882a`. GitHub Actions run `41324375953` SUCCESS. Nueva versión `saber-pagos-pruebas` **`06f72f3e-608a-4bc1-8acc-bd29e49aa48b`** confirmada en logs del rollout. Salud y acceso admin 401 sin clave verificados; cobros desactivados. Web pública intacta.
- **Acción inmediata para operador:** Ctrl+F5 en `https://saber-pagos-pruebas.libreriasaber.workers.dev/admin`, introducir clave panel si se perdió al recargar, pulsar «Consultar pedidos sin pago confirmado», luego «Ver PDF privados» del pedido de ARS 2.432. Ahora los dos archivos deben aparecer bajo ESE MISMO pedido. Pulsar «Descargar PDF original» y verificar que ambos abren completos. **La descarga real aún NO está comprobada**, no declarar cierre E2E hasta confirmación del operador.


## 01/11/2026 ~13:16 ART — FICHA DE INSTRUCCIONES DE IMPRESIÓN EN CENTRAL PRIVADA

- Usuario confirmó que pudo descargar ambos PDF originales desde el Centro de Pedidos, pero observó que **no veía las instrucciones para imprimir**. A partir de su informe, la descarga E2E de originales queda confirmada por el operador, aunque aún no hay PDF compuesto/imponible.
- Auditoría del código: la ficha verificada fuente `ficha-produccion-central.mjs` contiene formato, caras, modo, páginas seleccionadas, copias, páginas por cara, material y `tipoAnillado`; el normalizador `centralSafeManifest` en `integraciones/mercadopago/pruebas/worker.js` almacenaba varios de esos campos en `manifest_json` D1 **pero omitía tipoAnillado**. La vista previa únicamente mostraba nombre, total páginas y bytes.
- Corrección SOLO en rama `integracion/tus-pedido-privado-20261101`: `showUnpaidDetails` presenta debajo de cada archivo una ficha de instrucciones con servicio, páginas del PDF, páginas seleccionadas, A4/A3, B/N o Color cuando consta, simple/doble faz, páginas por cara, copias, material, anillado y descripción técnica (si existe). Botón «Copiar instrucciones». **No presumir valores ausentes**: todo campo sin respaldo de D1 aparece `NO CONSTA — verificar`. Para pedidos NUEVOS, `centralSafeManifest` conserva `tipoAnillado` de la ficha firmada; en pedidos históricos no se completa retrospectivamente: NULL y aviso. Los ploteos advierten que el desglose por página todavía no consta en esta vista.
- Código: `integraciones/mercadopago/pruebas/worker.js`, commits `78dfd9df`, `f09be3cb`. Tests `tests/tus-central-staff-download.test.mjs`, commit `d36f770f`.
- CI privado `41325433585` SUCCESS, 7 pruebas aprobadas y 0 fallidas; `saber-pagos-pruebas` versión `a0a6e34a-4687-4f8e-88d7-b4709cbb706b` activa según logs de despliegue (commit trigger `306afcad`). Protección de admin sin token HTTP 401 y `/health` paymentsEnabled=false, DB ready. No se modificaron la web comercial, `main`, ni precios/cobros.
- **Prueba de aceptación pendiente**: Ctrl+F5 en `https://saber-pagos-pruebas.libreriasaber.workers.dev/admin`; buscar pedido ARS 2.432 y pulsar «Ver PDF privados». Verificar que las dos fichas debajo de los PDF muestran los valores esperados y que el botón «Copiar instrucciones» funciona. Revisar la cantidad de campos `NO CONSTA` (especialmente anillado en pedido histórico); NO usar ficha incompleta para impresión sin confirmar. No repetir envío de PDF.
- **Etapa futura no cerrada**: persistir sin pérdida las opciones de ploteos página por página, armados por grupo y eventualmente generar PDF final/compuesto y ficha lista para producción. Mantener las barreras de pago/protección.

## 01/11/2026 ~13:21 ART — aceptación visual de instrucciones de impresión

- Usuario respondió **«ahora sí»** después de abrir la Central de Pedidos privada con la ficha de impresión incorporada. Se considera **confirmada por el operador la aparición de instrucciones de impresión** en el pedido de ensayo; la recepción/descarga de los dos PDF originales había sido confirmada anteriormente.
- **No se comprobó específicamente** el botón «Copiar instrucciones» ni la recuperación de datos ausentes del pedido histórico; no afirmar que esas pruebas estén cerradas. Los campos no persistidos, como el anillado del pedido previo, deben seguir señalándose «NO CONSTA — verificar».
- Implementación vigente del Centro privado: `saber-pagos-pruebas` versión `a0a6e34a`; documentos recibidos por Supabase/TUS; pedido comercial de prueba `e2d76c8b-ce1c-4daf-9030-4bd402295a68`, total ARS 2.432, pago desactivado.
- Próximos trabajos de Etapa 1 (no cerrados): PDF final/compuesto verificable; integración completa de ploteos CAD/Póster con detalle por página; anillados juntos/separados/mixtos conservando instrucciones; eventual validación integrada de esas funciones. No tocar `main`, web comercial, precios ni cobros sin autorización.


## 01/11/2026 ~13:40 ART — órdenes cortas 001 y ZIP completo privado

- Usuario pidió números simples `001, 002, 003…` y descargar **un solo ZIP** por pedido con los PDF originales (`PDF_01.pdf`, `PDF_02.pdf`, etc.) e instrucciones que sean una orden de trabajo numerada.
- Implementado en rama privada `integracion/tus-pedido-privado-20261101`, sin tocar main, comercio, precios ni pagos. Central `saber-pagos-pruebas` agregó tabla D1 `central_work_order_numbers(number INTEGER PRIMARY KEY AUTOINCREMENT,commercial_order_id TEXT UNIQUE...)`: número atómico, persistente, sin duplicación por concurrencia. Los pedidos nuevos se numeran en la misma transacción D1; los pedidos históricos SOLO cuando el operador abre su ficha mediante `POST /admin/api/central/asignar-numero` autenticado e idempotente. No se renumera ni modifica ID técnico UUID de los pedidos.
- El Centro muestra «Orden N.º 001» y botón «Descargar orden 001 + ZIP de PDF». Se sigue viendo pago pendiente; la acción no concede permiso de producción.
- Central implementó `POST /internal/central/tus-package`, HMAC firmado entre Workers, que valida pertenencia D1, devuelve número, nombres, recibos y opciones de impresión sin bytes, credenciales ni URLs de Storage. Worker documental agregó pantalla Basic `/prueba-v2/orden-paquete?webOrderId=...`, endpoint `POST /prueba-v2/api/ensayo-tus-paquete-manifiesto` Basic + Origin/HMAC y generador ZIP en navegador; cada PDF se obtiene por la ruta de descarga de personal ya verificada en D1 y SHA, luego se archiva sin modificar sus bytes.
- Contenido ZIP esperado: `PDF_01.pdf`, `PDF_02.pdf`, ... `ORDEN_001_INSTRUCCIONES.html` (formato para imprimir) y `ORDEN_001_INSTRUCCIONES.txt` (texto). El ZIP STORE se implementó sin dependencias externas, con CRC32 incremental, nombres seguros y límite de 160 MiB para no agotar memoria del navegador; para lotes más grandes mostrar mensaje y permitir originales individuales, sin fingir éxito. La ficha histórica marca `NO CONSTA — verificar` donde falten datos como anillado; no inventar opciones de impresión.
- CI Central: GitHub Actions `41327349314` **SUCCESS**, 11/11, versión privada `ed7eae87-6431-4a30-b0d5-afdda840f80d`, admin sin token devuelve HTTP 401 y health paymentsEnabled=false. CI documental: `41327443039` **SUCCESS**, 38/38 + 67/67 + 4/4, versión `13f8ffc0-3ce1-4c89-bd7d-c8c7d4fb6ece`, portal anónimo HTTP 401. Tests incluyen ZIP binario, CRC, rutas protegidas, D1 y numeración idempotente.
- **Pendiente E2E real de ZIP**: operador debe refrescar Centro privado, abrir pedido de ARS 2.432, comprobar que aparezca un número corto persistente; pulsar «Descargar orden N.º + ZIP», entrar al portal documental Basic y pulsar «Descargar ZIP completo». Abrir ZIP y verificar 2 PDF originales íntegros e instrucciones HTML/TXT correctas. No declarar descarga ZIP real comprobada antes de esa prueba. Para pedido viejo, asignar número al abrir la ficha es una escritura administrativa deliberada; no repetirla innecesariamente.
- Etapas no abordadas: PDF compuesto listo para imprimir, ploteos/anillados mixtos y activación real de cobros. La web pública sigue sin modificaciones.


## 01/11/2026 ~13:45 ART — número corto también en confirmación del cliente

- Se detectó que la pantalla TUS todavía mostraba «Número de pedido: <UUID>» pese a que la Central ya numeraba 001, 002… Corregido: `centralPrepareDraft` devuelve `numeroOrden` de D1 tanto en pedido nuevo como en reintento idempotente de pedido histórico. `prepararDocumentosCentralFirmado` lo valida/propaga, `finalizarPedidoTUSPrivado` lo exige en la respuesta OK; la UI privada TUS ahora muestra «Orden de trabajo N.º 001» y conserva UUID solo internamente.
- En el Centro, la lista ya no exhibe el UUID técnico; la ficha conserva el acceso a los PDF y el botón «Descargar orden N.º ... + ZIP».
- Últimos commits: `ec80fbb9` central, `ba2236ce` puente, `22f55779` endpoint TUS, `a132962b` interfaz, `2b06e656` test, `0af1aad9` regresión, `fa434995` reintento. Se desplegaron **solo entornos privados**:
  - Central `saber-pagos-pruebas` versión `b194bbee-2e39-4466-bceb-b34af0e10e76`; CI `41327861888` SUCCESS, 11 pruebas, admin no autorizado HTTP401, pagos inactivos.
  - Worker documental `saber-documentos-pruebas` versión `03b63b29-0a7d-4af7-b96f-af1ca0e722e5`; CI `41327868426` SUCCESS (38+67+4 pruebas), portal Basic anónimo HTTP401.
- **Pendiente de prueba real por el operador:** entrar al Centro, Ctrl+F5, «Consultar pedidos sin pago confirmado», primer pedido ARS 2.432 → «Ver PDF privados»: asignará número persistente y ofrecerá ZIP; al entrar al portal de documentos se podrá descargar `ORDEN_001.zip` con PDF_01/02 e instrucciones HTML/TXT. Verificar contenido e integridad. No afirmar E2E ZIP antes de aceptación. Nueva confirmación corta del cliente se comprobará en un pedido posterior, sin repetir ahora la subida de PDF innecesariamente.
