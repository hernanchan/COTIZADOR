# Central de Pedidos — vinculación privada con documentos (FASE 4)

**Estado:** implementado y probado **sólo en GitHub**, rama `cotizador/migracion-carga-archivos-20261018`. Sin despliegue, cambios públicos, pagos ni gastos.

## Recorrido implementado

1. Un PDF es recibido por Google Apps Script independiente del receptor de Polaroids, con sesión limitada del piloto FASE 4.
2. El Worker comprueba por HMAC las operaciones `multiInfo` y `multiVerifiedStatus`. Ambas requieren `uploadId` y `token` válidos del mismo archivo.
3. La función `leerPdfFase4Privado` recupera el PDF de Drive por fragmentos de 256 KiB, verifica el SHA-256 de cada fragmento y comprueba el SHA-256 íntegro.
4. `verificarPdfAlmacenado` abre el PDF efectivamente almacenado y verifica páginas. `medidasPdfServidor` extrae CropBox/MediaBox, /UserUnit y rotaciones de las páginas. La clasificación visual CAD/póster queda **sin confirmar**, no se inventa.
5. `conectarRecepcionConCentral` recalcula el precio con tarifas del servidor y construye `ficha-produccion-central`, vinculando archivo, recibo, páginas seleccionadas, tamaño/material y variantes. Se rechaza cualquier alteración o recibo duplicado.
6. La nueva ruta **`POST /api/ensayo-ficha-central`** es sólo para operador autorizado en el Worker privado. Exige mismo origen y cabecera `Authorization: Bearer <clave administrativa>`. Escribe **cero** datos en D1, no accede a Mercado Pago y devuelve `paymentAuthorized:false` / `listoParaProducir:false`.

## Bloqueos de seguridad

- Si no está configurada **`DOCS_CENTRAL_ADMIN_KEY`** como secreto nuevo de **32+ caracteres**, diferente de `DOCS_RELAY_KEY`, el endpoint devuelve 503. No habilitarlo para compradores.
- La ruta del cliente `/api/ensayo-carga-unica` sigue siendo sólo cotización preliminar. No da acceso a fichas de Drive ni a claves.
- El nombre, cantidad de páginas, modalidad y tamaño reales se extraen del backend, ignorando los campos que intente falsificar el navegador.
- El límite del piloto GAS es **cinco PDF de demostración y hasta 1 MiB cada uno**; la ruta privada prepara una ficha por sesión. No constituye aún recepción comercial masiva ni carga reanudable del sitio nuevo.
- Todos los originales permanecen en Drive privado. No hay enlaces compartidos ni descargas desde la Central. Tampoco se marca automáticamente **listo para producir** por tener únicamente un recibo y precio.
- Nunca escribir el secreto de administración, `uploadId+token` o credenciales de Google en el código fuente, localStorage, capturas o mensajes.

## Verificación realizada

- `tests/autocotizador-puente-central.test.mjs`: PDF real, integridad SHA, medidas, tarifas, archivo ausente, duplicado y documento A0 con clasificación pendiente.
- `tests/autocotizador-lectura-fase4.test.mjs`: reconstrucción por fragmentos, bytes corruptos, posiciones incorrectas y accesos no coincidentes.
- `integraciones/autocotizador/recepcion/fase4-e2e.test.mjs`: Worker compilado, Google/Turnstile **simulados**, HMAC verificado, PDF de seis páginas, bloqueo sin clave, acceso con clave privada y cobro cerrado.
- Última ejecución aprobada: https://github.com/hernanchan/COTIZADOR/actions/runs/40016461939

## Pendiente para operar

1. Probar el receptor **real** y la ruta protegida tras una autorización de ensayo, sin alterar producción; configurar el secreto únicamente en Cloudflare.
2. Sustituir las restricciones de demostración por recepción recuperable y privada para varios PDF por pedido, **sin R2 y sin nuevas contrataciones**.
3. Vincular el `WEB-orderId` y cada recibo a un **order_id** comercial de D1. Actualizar el panel privado sólo con comprobantes auténticos provenientes del backend y un pago aprobado íntegramente.
4. Proporcionar descarga privada del PDF **listo para imprimir**, no simplemente del original; controlar stock para productos físicos y orden de anillados.
5. Hacer prueba completa en PC y celular con interrupciones, archivos grandes, carrito mixto y pago de prueba. Sólo solicitar publicación productiva después de esa prueba.

> Importante: la Central de Pagos de prueba y el Worker de documentos son servicios aislados. Esta nueva ruta implementa el lado **documentos → ficha privada**, pero la persistencia automática en la Central D1 todavía NO está conectada.
