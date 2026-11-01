# Librería Saber — Integración TUS privada sobre el cotizador V2
**Estado: código integrado y probado en CI; versión Cloudflare PREPARADA INACTIVA, NO operativa en tráfico privado. 01-11-2026**

## 1. Motivo y evidencia del laboratorio

- El circuito antiguo navegador → Cloudflare Worker → Google Apps Script → Drive tardó 93,5/97,7 s con dos PDF y entregó solo 1/2 archivos confirmados, falla `LECTURA_DRIVE`, D1 pendiente. No usarlo como solución comercial.
- Ensayo TUS real independiente, 01/11/2026 00:22 ART: dos PDF reales (17,02 MiB y 9,66 MiB; 16 páginas cada uno) subidos **2/2** a Supabase Storage privado, SHA/páginas correctos y eliminados de almacenamiento al completar prueba, 9,95 s de reloj, 3,99 s transferencia, 3,09 s verificación; autenticación de invitación y confirmación server-side probadas. Ver `docs/EXPERIMENTO-TUS-SUPABASE-20261031-ESTADO.md`. No comparar directamente con Worker/GAS porque los flujos y documentos no fueron iguales.

## 2. Nueva rama y archivos reales desarrollados

- **Fuente de código exclusivamente experimental** `integracion/tus-pedido-privado-20261101`, creada desde `fase1/impresiones-ploteos-20261027`; NO tocar `main` ni la web comercial.
- `integraciones/autocotizador/recepcion/tus-pedido-contrato.mjs`: firmar HMAC comprobantes que ligan orderId, fileId, recibo DOC-UUID, SHA-256, bytes, páginas declaradas, modo y ruta privada `v2/<webOrderId>/<uuid>.pdf`; vence en 30 minutos, rechaza alteración, reutilizaciones dentro de lote y otros pedidos. 10 PDF / 20 MiB por archivo / 60 MiB por lote (límite inicial de ensayo, no promesa comercial).
- `tus-pedido-worker.mjs`: tres endpoints de ensayo `/api/ensayo-tus-iniciar`, `/api/ensayo-tus-registrar`, `/api/ensayo-tus-descargar`. Comparten compuertas privadas y opción `DOCS_TUS_PRIVATE_ENABLED=PRIVATE_TEST_ONLY`, **apagada si faltan variables**. La descarga requiere credenciales de operador y sólo usa rutas privadas de objetos, sin `getPublicUrl`. Se necesita auditar consulta D1, retención y trazabilidad de descargas antes de producción.
- `tus-pedido-puente.mjs`: descarga y verifica bytes reales de Storage **en servidor**, ejecuta el EXISTENTE `conectarRecepcionConCentral`, `verificarPdfAlmacenado`, `medidasPdfServidor`, `consolidarPedidoVerificado`, `cotizarCargaUnica` con precios de servidor, `prepararFichaCentral`; **no confía en monto ni páginas del navegador**. Luego `registrarManifiestoV2EnCentral` y `prepararDocumentosCentralFirmado` a través del Service Binding `SABER_CENTRAL`; solo registra si TODOS los PDF están confirmados y el monto es consistente. No activa Mercado Pago.
- `tus-directo-cliente.mjs` + `.txt`: módulo Uppy/TUS con selección ya hecha en cotizador, firmas por archivo, dos carriles, 6MiB por bloque, progreso porcentual, un único POST posterior para revalidar y registrar.
- Cambios a `worker-fase4-cotizador-unificado.mjs`: nuevas rutas añadidas sin tocar las legadas; `/prueba-v2/tus-directo.mjs` servido SOLO con flag; páginas bajo Basic; emisión de cookie HttpOnly adicional y acotada a `/api/ensayo-tus-` para que los POST del navegador se autentiquen sin confiar en que reenvíe HTTP Basic; cookie del flujo legado conservada.
- Cambios a `pantalla-cotizador-v2-prueba-privada.mjs`: conserva detección/cotización original del PDF, CAD/Póster, rollos, precio visible y 1 CTA. Sólo con flag cambia el transporte a Uppy/TUS y el estado de Central; sin flag usa el flujo existente. Sin cobros.
- Cambios a `integraciones/autocotizador/recepcion/package.json`: genera `tus-directo-cliente.txt` antes de la compilación unificada.
- `tests/tus-pedido-privado.test.mjs`, `tests/tus-ui-presupuesto-smoke.test.mjs`; nuevo CI `.github/workflows/tus-integracion-privada-ci.yml` (**no desplegar**).

## 3. Pruebas y compilación verificadas

- **GitHub Actions run `41270696049` completed/success**, **16 tests PASS, 0 FAIL**, compilación completa del Worker con todos los tests existentes en `npm run build:unificado`, y prueba del bundle construido con env vacío: endpoint TUS devuelve **403** y `paymentAuthorized=false`.
- Los tests nuevos incluyen contrato firmado Unicode, manipulación, vencimiento, pertenencia a pedido, límites, no enviar sin operador, PDF reales generados con pdf-lib pasando por motor del servidor, A4/A3, A0 CAD y rollo automático, opciones HTML del portal de prueba, y D1 simulado llamado solo después de que ambos archivos se verifican.
- **NO son todavía una prueba TUS+Worker+Supabase+D1 real con tráfico HTTP**: el test que hace llegar a D1 usa función simulada, y Supabase era real solo en el laboratorio aislado anterior. No presentar el pedido como listo.

## 4. Cloudflare versión preparada, NO activada

- GitHub Actions `41270875051`: **completed/success**, pipeline de pruebas y compilación aprobado, `POST /versions?bindings_inherit=strict` al Worker privado `saber-documentos-pruebas`.
- **UUID real `293564e5-00d2-4379-9ac5-a4373f49f08a`**, texto `TUS_VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR`. **No se invocó `/deployments`, no se promovió la versión, no hubo cambios en tráfico, rutas comerciales ni pagos.** Workflow de preparación es `.github/workflows/tus-version-inactiva-unica.yml`, se disparó por archivo `docs/RELEASE-TUS-INACTIVA-20261101.trigger`; no generar versiones nuevas en cada cambio pequeño.
- El primer intento de preparar versión (run `41270810115`) falló **sólo** por npm instalado dentro de carpeta hija en vez de raíz; corregido en `42015811` y reintentado 1 vez, success `41270875051`. No repetir diagnóstico.

## 5. Bloqueos exactos para OPERATIVIDAD DEL WORKER PRIVADO

**No es todavía operativo en Cloudflare; no pedir pruebas de usuarios ni promover la versión inactiva.**

1. Configurar de manera segura en Cloudflare **sólo** Worker privado `saber-documentos-pruebas` las nuevas variables (sin escribirlas en chat/GitHub):
   - `DOCS_TUS_PRIVATE_ENABLED=PRIVATE_TEST_ONLY` **únicamente cuando esté todo verificado**;
   - `DOCS_TUS_RECEIPT_KEY` = secreto HMAC NUEVO >=32 caracteres, distinto de otros secrets;
   - `DOCS_TUS_SUPABASE_SERVICE_KEY` = credencial de servicio para **proyecto Supabase de laboratorio** `qkbbqzbannyhuanngjpw`, únicamente Worker server-side; jamás navegador, GitHub ni registros;
   - `DOCS_TUS_PUBLISHABLE_KEY` = clave **pública** de ese mismo proyecto.
   La conexión Supabase de ChatGPT da lectura/escritura de DB/Storage y despliegue de Edge Functions, **no** permite establecer secrets en el Cloudflare Worker ni leer claves privadas automáticamente para reinyectarlas. Evitar generar copias de claves o pedir enviarlas por chat.
2. Revisar comportamiento del módulo privado en Worker con servicio Storage real y firma por archivo (2/2, hasta 20 MiB), control de Turnstile/abuso para el inicio, rollback, concurrencia, obj. abandonados; no activar hasta prueba real del flujo privado.
3. **Descarga para producción:** el laboratorio exitoso elimina objetos tras verificarlos, pero el modo V2 conserva PDF en Storage privado para que el personal descargue después. Falta integrar visiblemente el enlace/estado de descarga desde **Central D1** y exigir que el recibo pertenezca al pedido registrado; no dejar al operador adivinar IDs. Configurar retención y limpieza programada de abandonados/entregados.
4. Contrastar catálogo de precios, decisiones de tamaño 20×20 cm, anillado mixto, ploteos reales y recuperación si se corta red; límites pilotos 10 archivos / 60MiB deberán decidirse con usuario antes de publicar.
5. Recién entonces **una prueba E2E privada con 2 PDF** en Worker nuevo y registro D1 único, descargar ambos protegidos; comprobar monto/orden/archivos y CERO cobros. Sólo con evidencia autorizar tráfico real y promoción controlada. No publicar web ni pagos sin autorización explícita.

## 6. Restricciones y próximos pasos

- Nada en `COTIZADOR/main` o `libreriasaber.com.ar`, no se tocaron pagos ni Polaroids ni Worker activo, no se creó ninguna suscripción paga.
- No reportar «operativo», «terminado» ni «listo para clientes» basándose en CI o una versión preparada/inactiva.
- **Próximo trabajo sin usuario:** revisar protección de una URL de descarga desde Central con consulta de D1 y diseñar test de corte/reanudación e idempotencia; conector Cloudflare no está instalado, para configurar secretos e iniciar despliegue de prueba privado será necesaria intervención segura del operador.
