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
