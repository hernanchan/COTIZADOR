# Receptor privado de PDF — Librería Saber (ensayo SIN ACTIVAR)

Este receptor **no** forma parte del Apps Script de Polaroids. No se instaló, no se desplegó, no se creó un Worker ni se activó la recepción. Todo permanece en `cotizador/migracion-carga-archivos-20261018`. No modificar la web pública ni el servicio de fotografías.

## Archivos preparados
- `DocumentosReceiver.gs`: servidor Apps Script independiente, firmado con HMAC-SHA256. Guarda PDF en carpeta privada por pedido mediante **Drive API v3 resumable upload** y confirma los bytes recibidos comparando SHA-256 contra el archivo **ya almacenado en Drive**.
- `worker-documentos.mjs`: módulo para Cloudflare Workers/Pages Functions, **sin ruta desplegada**. Se mantiene apagado salvo que DOCS_UPLOAD_ENABLED sea exactamente "true". Comprueba origen, tamaño y Turnstile con acción `documentos`, firma cada operación y retransmite a Apps Script.
- `../pruebas/gateway-documentos-http.mjs`: adaptador de cliente HTTP; sólo ruta relativa protegida `/api/documentos-receiver`.
- `../pruebas/subida-reanudable.mjs`: envía fragmentos de 512KiB con SHA-256 y reanuda mediante `status`.

## Estado del entorno privado — 19/10/2026

- El titular autorizó preparar el entorno privado de pruebas para **documentos**, sin publicar y sin gastos.
- Se confirmó que la cuenta de Google Drive conectada es la cuenta comercial de Librería Saber.
- **Carpeta creada y verificada:** `Librería Saber - Documentos WEB - PRUEBAS`, dentro de Mi unidad, sin compartir con terceros (solo propietario). El ID y enlace de carpeta se mantienen fuera del repositorio y deberán asignarse a la propiedad privada `DOCS_ROOT_FOLDER_ID` una vez creado el proyecto de Apps Script.
- No se ha verificado cuál es el ID/carpeta exacta que utiliza el receptor piloto de Polaroids. **No mover ni reorganizar fotografías existentes.** La estructura propuesta de carpeta general compartida es lógica, no un cambio físico ya efectuado.
- **Pendiente:** crear proyecto independiente de Google Apps Script, configurar credenciales privadas y relay piloto, probar una transmisión real y luego validador de páginas en servidor. El conector Drive disponible crea carpetas, pero no expone creación/despliegue de Apps Script; no declarar instalados scripts ni rutas.

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
