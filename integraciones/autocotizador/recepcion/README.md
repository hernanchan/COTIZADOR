# Receptor privado de PDF — Librería Saber (ensayo SIN ACTIVAR)

Este receptor **no** forma parte del Apps Script de Polaroids. El titular instaló un Apps Script independiente para documentos, con acceso web **«Solo yo»**, y un Worker independiente `saber-documentos-pruebas` que devuelve **HTTP 503 con recepción desactivada**. El código de desarrollo permanece en `cotizador/migracion-carga-archivos-20261018`. **No se habilitaron cargas externas ni se modificó la web pública o Polaroids.**

## Archivos preparados
- `DocumentosReceiver.gs`: servidor Apps Script independiente, firmado con HMAC-SHA256. Guarda PDF en carpeta privada por pedido mediante **Drive API v3 resumable upload** y confirma los bytes recibidos comparando SHA-256 contra el archivo **ya almacenado en Drive**.
- `worker-documentos.mjs`: módulo para Cloudflare Workers/Pages Functions, **sin ruta desplegada**. Se mantiene apagado salvo que DOCS_UPLOAD_ENABLED sea exactamente "true". Comprueba origen, tamaño y Turnstile con acción `documentos`, firma cada operación y retransmite a Apps Script.
- `../pruebas/gateway-documentos-http.mjs`: adaptador de cliente HTTP; sólo ruta relativa protegida `/api/documentos-receiver`.
- `../pruebas/subida-reanudable.mjs`: envía fragmentos de 512KiB con SHA-256 y reanuda mediante `status`.

## Estado del entorno privado — 19/10/2026

- El titular autorizó preparar el entorno privado de pruebas para **documentos**, sin publicar y sin gastos.
- Se confirmó que el conector Drive de ChatGPT está asociado a `libreriasaber@gmail.com`, **pero el entorno operativo de Polaroids y el nuevo Apps Script de documentos se ejecutan en `dragonesdepoeta@gmail.com`**. No confundir ambas cuentas.
- Se creó inicialmente una carpeta de documentos en el Drive conectado de `libreriasaber@gmail.com`; **no se utiliza** porque el Apps Script ejecutado por la cuenta operativa no tenía acceso. El titular creó manualmente otra carpeta `LIBRERÍA SABER - DOCUMENTOS WEB - PRUEBAS` en el Drive operativo de `dragonesdepoeta@gmail.com`. Actualizó la propiedad privada `DOCS_ROOT_FOLDER_ID` con el ID correcto. No guardar el identificador operativo ni el secreto en código público.
- No se ha verificado cuál es el ID/carpeta exacta que utiliza el receptor piloto de Polaroids. **No mover ni reorganizar fotografías existentes.** La estructura propuesta de carpeta general compartida es lógica, no un cambio físico ya efectuado.
- **Comprobación real del titular (19/10, 09:49):** proyecto Apps Script independiente `SABER — RECEPCIÓN DOCUMENTOS — PRUEBAS` creado y `DocumentosReceiver.gs` pegado; manifiesto OAuth preparado; propiedades privadas `DOCS_ROOT_FOLDER_ID` y `DOCS_RELAY_KEY` guardadas. Función local `probarCarpetaDocumentos` terminó correctamente y registró «Carpeta accesible: LIBRERÍA SABER - DOCUMENTOS WEB - PRUEBAS» y «Clave de seguridad configurada correctamente». Esto demuestra **lectura de carpeta y presencia de secreto**, NO escritura, firma validada, subida de archivos ni servicio web desplegado.


### Avance confirmado por el titular — prueba de PDF real en Apps Script (19/10/2026)

- El propietario confirmó **escritura real** de un archivo de prueba en la carpeta operativa de Drive y respuesta `HTTP 200` de la API de Google Drive mediante `UrlFetchApp`.
- Confirmó que creó una implementación web de Apps Script con acceso **«Solo yo»** y que al visitar su URL obtuvo el JSON esperado de bloqueo de solicitudes no autenticadas; eso **no equivale** a conectividad desde Cloudflare.
- Ejecutó manualmente `probarRecepcionPDFReal`, que genera un PDF A4 mínimo, invoca `docsStart`, `docsPart` y `docsFinish` dentro del mismo proyecto y compara la huella SHA-256 de los bytes descargados desde Drive. El usuario informó «todo perfecto»; **no se recibió el registro completo ni se inspeccionó directamente el PDF creado en la cuenta operativa**, por lo que consignamos «prueba real reportada exitosa», no auditoría independiente.
- La llamada directa del editor **no comprueba** la validación HMAC del `doPost` con una solicitud externa ni los límites de Chrome/Cloudflare/Turnstile; con «Solo yo» el relay aún no puede usar el endpoint anónimamente.
- Sigue deshabilitado el cobro de documentos: el receptor responde `verified:false` hasta contar páginas y validar el PDF del lado servidor, aunque los bytes estén íntegros.
- **Inspección visual adicional confirmada por el titular:** abrió el PDF dentro de la subcarpeta `WEB-PRUEBA-...` en el Drive de `dragonesdepoeta@gmail.com` y confirmó que se ve correctamente. No se inspeccionó directamente desde este conector: la cuenta de Drive conectada a ChatGPT es distinta.
- **Siguiente paso**: configurar relay piloto separado en Cloudflare, inicialmente apagado. No cambiar todavía acceso «Solo yo» de Apps Script ni tocar el receptor de Polaroids. Antes de probar una llamada externa habrá que revisar autorización, aislamiento, límites y protección del endpoint.

### Cloudflare: entorno aislado creado y bloqueado — 19/10/2026

- El titular creó un Worker independiente llamado `saber-documentos-pruebas`, sin conexión a la web pública ni a los Workers de Polaroids o pagos.
- Inicialmente fue implementado con el ejemplo `Hello World`; luego, siguiendo instrucciones, sustituyó el código por un receptor **cerrado** que devuelve siempre HTTP 503 con JSON `{"ok":false,"service":"saber-documentos-pruebas","receptionEnabled":false,"message":"Recepcion de documentos desactivada"}`.
- El titular abrió la URL de Worker y **confirmó exactamente esa respuesta**. Eso verifica bloqueo de recepción en el Worker de prueba, **no** conectividad Worker–Apps Script ni subida a través del navegador.
- Siguiente paso: instalar `DOCS_RELAY_KEY` como **secreto privado de Cloudflare** usando la misma clave ya guardada en las propiedades del Apps Script de `dragonesdepoeta@gmail.com`, **sin enviarla al chat ni a GitHub**. Mantener el código del Worker desactivado y el Apps Script con acceso `Solo yo` por ahora.
- No cambiar el acceso de Apps Script a público antes de revisar el puente firmado de extremo a extremo y la configuración de seguridad; no introducir pagos ni publicación del cotizador en esta etapa.

- El titular confirmó que guardó `DOCS_RELAY_KEY` como secreto de Cloudflare en `saber-documentos-pruebas`. El contenido del secreto no fue suministrado ni verificado por ChatGPT; el Worker sigue respondiendo recepción desactivada. **No publicar ni registrar el valor del secreto.**

### Worker Cloudflare: configuración reportada y reemplazo seguro preparado (19/10)

- El titular confirmó que agregó las variables del Worker `saber-documentos-pruebas`: `DOCS_RELAY_KEY` como secreto, `DOCS_SCRIPT_URL` como secreto, `DOCS_UPLOAD_ENABLED=false` y `DOCS_ALLOWED_ORIGIN` para el dominio aislado del Worker. **Estas configuraciones fueron reportadas por el titular y no verificadas desde la cuenta Cloudflare**; no copiar sus valores a GitHub.
- Se creó en la rama de pruebas el archivo autónomo `worker-cloudflare-ensayo-bloqueado.mjs`, listo para copiar en el editor del Worker. Contiene la lógica futura del relay, pero con **doble bloqueo**: `const INTERNAL_ALLOW_UPLOADS=false` fijo y `DOCS_UPLOAD_ENABLED` de entorno. Es intencional: no conecta ni sube archivos por ahora.
- La lógica de exportación fue comprobada sintácticamente y con seis peticiones simuladas (GET/POST/DELETE con variable de entorno tanto `true` como `false`): **todas respondieron HTTP 503, `receptionEnabled:false`**. No equivale a prueba de despliegue; el titular deberá reemplazar `Hello World`/bloqueo provisional en Cloudflare, implementar y verificar la misma respuesta.
- **No cambiar el Apps Script «Solo yo» ni habilitar cargas todavía.** Antes de permitir cargas vía Cloudflare faltan: aceptación segura de llamadas firmadas por Apps Script, autorización real de los pedidos, antia-buso/cupo, Turnstile de documentos y comprobación de precio/páginas del lado servidor. La implantación del archivo bloqueado no completa esos trabajos.

### Confirmación del Worker con doble bloqueo (19/10/2026)

- El titular reemplazó el código del Worker `saber-documentos-pruebas` por `worker-cloudflare-ensayo-bloqueado.mjs` y confirmó en su URL la respuesta exacta: `{"ok":false,"service":"saber-documentos-pruebas","receptionEnabled":false,"message":"Recepcion de documentos desactivada"}`. **Es una verificación del bloqueo publicada en el Worker, no una conexión comprobada a Google.**
- Próxima prueba segura: autocontrol de firma HMAC positiva, alterada y vencida ejecutado manualmente en Apps Script con `docsVerifyEnvelope`, sin subir archivos ni exponer secreto. Luego se evaluará el acceso externo con HMAC, autorización de pedidos y límites antes de modificar `Solo yo`.
 
### Verificación de firmas en Apps Script — confirmación del titular (19/10/2026)

- El titular informó que terminó de ejecutar `probarFirmasDocumentos`, que comprueba en Google Apps Script: firma HMAC-SHA256 correcta aceptada, firma falsificada rechazada y firma con marca de tiempo vencida rechazada. El resultado se conoce por su confirmación «listo»; **no se dispone de los registros de ejecución para auditoría independiente**.
- Esta prueba usa la propiedad privada `DOCS_RELAY_KEY` en Apps Script, no revela la clave ni prueba aún que el secreto guardado en Cloudflare coincida efectivamente con ella. También **no** demuestra conectividad Worker → Apps Script.
- Estado operativo conservado: `worker-cloudflare-ensayo-bloqueado.mjs` instalado y devolviendo `receptionEnabled:false`; Apps Script continúa restringido a «Solo yo»; sin cargas externas ni pagos.
- Próximo componente: widget Turnstile **exclusivo** de documentos (no reutilizar el de Polaroids) en el hostname exacto del ensayo. Instalar su secreto como variable privada `DOCS_TURNSTILE_SECRET` del Worker; la clave pública se incorporará al cliente del ensayo cuando exista esa interfaz. Mantener bloqueos.

### Turnstile confirmado y prueba web aislada preparada — 19/10/2026

- El titular informó «sí sí todo ok» tras crear el widget de Turnstile separado para documentos y configurar `DOCS_TURNSTILE_SECRET` como secreto en Cloudflare. **La cuenta Cloudflare y las claves privadas no fueron leídas ni verificadas directamente desde ChatGPT**.
- Se creó `worker-cloudflare-prueba-turnstile-bloqueado.mjs` como **archivo completo alternativo para el Worker de ensayo**. Mantiene `INTERNAL_ALLOW_UPLOADS=false` en todo momento y sólo habilita una página sin cargas en `GET /prueba-turnstile` y validación de token en `POST /prueba-turnstile`. No contacta Apps Script ni Drive.
- El nuevo archivo exige adicionalmente `DOCS_TURNSTILE_SITE_KEY` (clave **pública** del mismo widget) como variable de tipo Texto en el Worker. El navegador solicita un desafío con `data-action="documentos"`; el Worker comprueba en Cloudflare Siteverify `success`, `hostname` y `action`. No se devuelven credenciales en las respuestas.
- Pruebas en simulación con API externa falsificada: rutas de documentos GET/POST/DELETE **503**; GET `/prueba-turnstile` **200** con página HTML; POST con token verificado simulado **200** `{ok:true,receptionEnabled:false}`; POST con origen indebido **403**. Falta implementar en la cuenta del titular y comprobar un token Turnstile real en el navegador.
- Se mantiene sin cambios `DOCS_UPLOAD_ENABLED=false`, Apps Script «Solo yo», `DOCS_RELAY_KEY`, Polaroids, pagos y web pública. No habilitar recepción externa ni cobro por esta prueba.

### Resultado real de primer intento Turnstile y diagnóstico pendiente — 19/10/2026

- El titular instaló `worker-cloudflare-prueba-turnstile-bloqueado.mjs`, comprobó que la página `/prueba-turnstile` carga y mostró captura donde el **widget Turnstile indica «¡Operación exitosa!»**, pero tras pulsar `Comprobar verificación` el Worker respondió **«La prueba no se pudo validar»**. La comprobación del navegador no equivale a verificación Siteverify; **no se puede afirmar que Turnstile funcione de extremo a extremo**.
- Se revisó el Worker y se actualizó el mismo archivo de la rama de pruebas para agregar diagnósticos seguros sin exponer secretos, tokens, payloads de Turnstile ni URLs de Google: códigos `origin_or_content_type`, `turnstile_secret_missing`, `token_body_invalid`, `cloudflare_http_error`, `cloudflare_rejected` (con error-codes públicos acotados), `hostname_mismatch`, `action_mismatch`, `cloudflare_unavailable`.
- La actualización fue validada **por simulación**, con respuestas Siteverify falsas: bloqueo HTTP 503 de GET/POST/DELETE en la raíz, prueba HTML 200, rechazo 403 a origen ajeno, rechazo por secreto inválido, hostname incorrecto y acción incorrecta, aceptación 200 sólo cuando los tres controles coinciden. **Falta que el titular reinstale este archivo actualizado y confirme el diagnóstico real**.
- La variable `DOCS_UPLOAD_ENABLED` sigue `false`, el bloqueo fijo `INTERNAL_ALLOW_UPLOADS=false` sigue inalterado, Apps Script aún tiene «Solo yo» y no hay subidas externas a Drive.

### Diagnóstico real Turnstile `cloudflare_unavailable` y reparación del ensayo (19/10/2026)

- El titular aportó primero captura con el widget verde, pero mensaje «Completá primero la verificación» (sin token disponible en esa interacción), y luego otra con el mismo widget verde y `NO VALIDADO — diagnóstico: cloudflare_unavailable`. La segunda evidencia demuestra que llegó una solicitud con token a nuestro Worker, pero un error interno fue atrapado por un `catch` demasiado amplio. **No atribuir el fallo a una caída de Cloudflare, al secreto, ni al token sin comprobación.**
- Se modificó solamente el archivo de ensayo `worker-cloudflare-prueba-turnstile-bloqueado.mjs` para usar la llamada Siteverify recomendada por Cloudflare Workers: `fetch` `POST` con `FormData`. Ya no depende de `AbortSignal.timeout()` ni de `redirect:'error'` en esa ruta.
- Diagnósticos desglosados sin publicar información sensible: `siteverify_fetch_failed` (clase de error restringida), `siteverify_http_error` (código HTTP), `siteverify_invalid_json`, `siteverify_unexpected_json`, `cloudflare_rejected` (error codes permitidos), `allowed_origin_invalid`, `hostname_mismatch` y `action_mismatch`. El ensayo sigue cerrado con `INTERNAL_ALLOW_UPLOADS=false` y `DOCS_UPLOAD_ENABLED=false`.
- Validación simulada del archivo actualizado: bloqueos GET/POST/DELETE en / → 503; página /prueba-turnstile → 200; Siteverify simulado válido → 200 con `receptionEnabled:false`; respuesta denegada, HTTP erróneo, JSON inválido, error de red y origen no autorizado → denegados. **Falta reinstalar en Cloudflare y comprobar con un token real; no hay un resultado positivo de extremo a extremo todavía**.
- Documentación oficial utilizada: https://developers.cloudflare.com/workers/examples/turnstile-html-rewriter/

## Preparación requerida para un ensayo real autorizado

1. **Crear un proyecto nuevo de Google Apps Script**, sin copiar encima del existente de Polaroids. Pegar `DocumentosReceiver.gs` y revisar `appsscript.json`. Se deberá ejecutar como titular de Librería Saber y permitir las llamadas HTTP de UrlFetchApp y acceso a Drive. El Web App usa acceso anónimo pero **rechaza todas las llamadas sin firma HMAC del Worker**. Evaluar las restricciones de la cuenta Google antes de instalar.
2. Crear una **carpeta privada separada de documentos** en Drive; configurar `DOCS_ROOT_FOLDER_ID` como propiedad del Script. No publicar la carpeta ni habilitar «Cualquiera con el enlace».
3. Generar un secreto largo aleatorio (mínimo 32 caracteres) y asignar `DOCS_RELAY_KEY` **a ambas plataformas sólo como secreto privado**: propiedades de Apps Script y secret de Cloudflare Worker. No subir ni copiar el valor a GitHub, HTML, enlaces, capturas ni mensajes públicos.
4. Configurar en Cloudflare un relay aislado (Workers o Pages Functions, con ruta exclusiva), indicando `DOCS_SCRIPT_URL` del despliegue del Script, `DOCS_ALLOWED_ORIGIN` del **piloto** y el secreto de Turnstile `DOCS_TURNSTILE_SECRET`. Dejar `DOCS_UPLOAD_ENABLED` **apagado** hasta autorizar el ensayo. Configurar el widget de Turnstile para el hostname piloto y acción `documentos`. Un token se consume por `start`; si se suben varios PDF, se requerirán tokens válidos nuevos o evolucionar a sesión de pedido para una única validación inicial.
5. Probar **un PDF pequeño**, estado de partes, corte/reinicio de transmisión y cotejo de SHA con Drive. Ensayar archivos duplicados, URL incorrecta, firma errónea, páginas incorrectas y acceso público denegado.
6. La siguiente fase deberá incorporar **recuento real de páginas del lado servidor**, cotejar cotización y manifiesto, e integrar Centro de Pedidos. Hoy `finish` devuelve `received:true`, `verified:false`, `reason:pending_server_page_validation`; por diseño **NO habilita pedidos pagables**. No activar checkout hasta resolverlo.

## Límites y aspectos pendientes

- Piloto limitado a **20 MiB por PDF** y **512 KiB por fragmento** (múltiplo de 256 KiB que exige Drive para subidas parciales). El diseño posterior debe manejar archivos mayores sin sobrecargar Apps Script y definir cuotas de Google, concurrencia y tasa de llamadas. La descarga completa para SHA en Apps Script puede ser costosa; evaluar alternativa de verificación por streaming para escala.
- El almacenamiento técnico de sesiones en `PropertiesService` es **provisional para pocas pruebas**, no la base final de alto volumen: requiere limpiar sesiones vencidas, evitar superar cuotas y almacenar estado durable del pedido en servidor (por ejemplo D1, si se aprueba su uso).
- Las sesiones de subida de Drive expiran aproximadamente en **una semana**; este piloto limita sesiones a **seis días**, luego necesitan reinicio seguro.
- No hay todavía una ruta oficial `/api/documentos-receiver` ni claves instaladas; el cliente HTTP está **sin conectar**. La implementación de Turnstile también requiere un paso de integración UI.
- La vinculación a `orderId` se valida por metadatos y token de sesión, pero antes de publicar es obligatorio implementar **autorización de pedido y límites de abuso por usuario/sesión** (no basta con un ID inventado por el navegador). También hay que proteger datos, expiración, privacidad y evitar reservas ficticias.
- Las fotos de Polaroids permanecen en su receptor y flujo separado, sin cambios.
- Los precios vigentes aún requieren confirmación (JSON marcado el 21/08/2026). Las transferencias requieren confirmación bancaria manual, separadas de Mercado Pago.

## Evidencia disponible y límites de la evidencia
- Se comprobó por simulación del servidor (Google Drive y Apps Script **falsos en memoria**) un inicio repetido que conserva ID/token, una parte aceptada, consulta de estado, lectura íntegra del archivo de Drive y bloqueo de verificación de páginas.
- Las pruebas no verifican conectividad real de Google, cuotas, la pantalla móvil, el PDF real, el webhook, la firma HMAC con credenciales de producción, el estado de Cloudflare ni ninguna subida desde el sitio.
- Referencia oficial: Google Drive API v3, [resumable upload](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

**No instalar ni publicar** sin autorización expresa; antes de tocar las cuentas corresponde crear el entorno de pruebas separado y confirmar propiedades, accesos y plan de reversión.
