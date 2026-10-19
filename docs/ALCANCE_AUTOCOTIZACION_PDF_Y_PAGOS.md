# Librería Saber · Alcance acordado: autovaloración de PDF y pago completo

Estado: definición funcional y técnica, **no implementación publicada**. Registrar esta decisión antes de continuar la integración. Rama aislada `pagos/mercadopago-checkout-pro-pruebas-20261017`.

## Decisión comercial principal

**Preservar el circuito que ya funciona.** El cotizador habitual y el editor Polaroids podrán seguir con presupuesto actual, **seña del 50 %** y envío de comprobante por WhatsApp como hasta ahora. No forzar el checkout de Mercado Pago sobre los servicios tradicionales hasta que exista una alternativa de autoservicio completamente verificada.

**Nueva modalidad específica:** el cliente sube uno o más **archivos PDF**, el sistema **lee y verifica el número de páginas**, hace las preguntas necesarias sobre cómo imprimirlos, calcula una cotización exacta con las reglas comerciales vigentes y, una vez aprobada por el cliente y recibidos de forma segura los archivos, ofrece **pago del 100 % a través de Mercado Pago**. Solo un pago confirmado por el backend habilita la orden para producción en el Centro de Pedidos.

No tratar esta distinción como seña vs. pago completo del mismo botón: son **dos flujos de compra distintos**. No cambiar `main`, el carrito público ni mensajes de WhatsApp sin autorización expresa.

## Código y reglas existentes a reutilizar

- `cotizador-web-v2.html` (main): `renderPrint()`, `calcPrint()`, `finishItem()`. Hoy el campo `pages` se escribe manualmente; opciones de A4/A3, B/N/color, simple/doble faz, material, copias, anillado y promoción.
- `precios-web.json` (main): `bnA4`, `bnA3`, `colorA4`, `colorA3`, `bindings`, escalas por volumen, materiales, descuentos. Archivo marcado `generatedAt: 2026-08-21T13:50:37.427Z`; **confirmar que los valores están vigentes** y preparar una única fuente de precios para mostrador, web y servidor.
- El flujo aislado de Mercado Pago ya prueba pago completo, pedidos idempotentes, recibos Polaroids y Centro privado; reutilizar infraestructura y controles donde sean aplicables. No usar los importes calculados en el navegador como fuente de cobro.

## Secuencia nueva: pedido de PDF con impresión autocalculada

1. El cliente selecciona «Imprimir mis PDF» y carga uno o más documentos. Se muestran nombre, páginas verificadas por archivo, total, progreso y advertencias si un PDF está cifrado, dañado, protegido o presenta dimensiones/páginas mixtas.
2. Preguntar **tamaño de salida (A4/A3)**, **B/N o color**, **papel/material** cuando corresponda, **simple o doble faz**, **cantidad de copias**, **anillado** y cualquier opción que cambie el presupuesto. Considerar opción de selección por archivo cuando se suben varios; no inferir automáticamente color comercial por una imagen que parezca color.
3. Aplicar las escalas, promociones y condiciones vigentes del cotizador. Páginas por archivo y de impresión calculadas; separar páginas de **hojas físicas** cuando es doble faz; anillado por ejemplar y límites por servicio deben verificarse contra reglas vigentes.
4. Mostrar detalle: archivo, páginas, copias, formato, papel, caras, extras, tarifa/escala, descuento, total. Confirmación explícita antes de pasar a pagar el 100 %.
5. Subir PDF y metadatos al almacenamiento privado, con autenticación/constancia por pedido, control de integridad, fragmentos reanudables, límites razonables, reintentos en celular y sin descarga pública. Usar infraestructura actual sin R2 ni servicios pagos nuevos. **No cerrar una recepción como completa hasta verificar bytes y documento final en el servidor**.
6. El servidor vuelve a abrir/verificar el documento y cuenta las páginas de la **versión efectivamente recibida**. Recalcula el presupuesto sobre la versión publicada de precios del servidor; no aceptar el número de páginas, importe, descuento, tipo de trabajo ni hash declarados por el navegador como prueba suficiente. Evitar doble pago e impedir modificar archivos/opciones de un pedido ya generado.
7. Preparar una única preferencia Checkout Pro con total íntegro del pedido. Revisar automáticamente el estado mediante webhook autenticado y conciliación alternativa por Cron. Solo pedidos pagados y con PDF recibido se muestran como listos para producción en el Centro privado, con archivos y parámetros de impresión.
8. El cliente puede ver estados «recibiendo PDF», «recibido», «presupuesto confirmado», «pendiente de pago», «pagado», «en revisión». Pago fallido/rechazado no se registra como confirmado; no hace falta volver a subir si la recepción persiste.

## Alcance inicial razonable

Empezar con **PDF de documentos comunes A4/A3**, B/N o color completo por documento, simple/doble faz, copias, papeles compatibles y anillado. Considerar luego impresiones con mezcla de color por páginas, rangos diferentes, archivo muy grande o tamaño mixto, folletos, ploteos, materiales especiales. Para casos fuera de reglas confiables, derivar al **cotizador/WhatsApp existente**, nunca cobrar una cifra inventada.

## Riesgos/criterios de salida

- Contar páginas en navegador con un visor PDF es útil para UX, pero verificar **nuevamente del lado servidor** con límites de tamaño, CPU, tipos de documento y protección de PDF; rechazar cifrados/corruptos de forma controlada.
- Doble faz afecta cantidad de hojas; precio y anillado no deben depender de suposiciones. Variación de tamaño/orientación interna del PDF debe advertirse. Los PDF pueden tener contenido distinto de dimensiones físicas.
- Verificar que `precios-web.json` refleje **precios actuales** antes de conectar un cobro irreversible. No duplicar reglas que se desincronicen entre el cotizador y la pasarela. Validar promociones/día y cupones si se habilitan.
- Manejar interrupciones de carga y teléfono en reposo; no prometer recepción hasta obtener confirmación de Google/servidor. Proteger archivos privados (sin URL pública para clientes) y definir plazo de conservación.
- Probar múltiples PDF, 1/2/3/60/200+ páginas, archivos corruptos, tamaño mixto, doble faz con páginas impares, anillado, reintentos, pagos repetidos, errores de Google, Mercado Pago y recepción de PDFs, desde celular.
- Configuración/aprobación de créditos y funciones Cloudflare, Turnstile, implementación de prueba y planes sin costos no autorizados. Hacer una prueba completa en piloto antes de permitir flujo público.
- **No publicar** ni cambiar 50 % por 100 % para cotizador actual o Polaroids por el mero hecho de añadir el nuevo módulo. Todos los cambios comerciales y de WhatsApp se coordinarán para el lanzamiento y requerirán aprobación expresa.

## Próxima tarea de ingeniería

Extraer/compartir motor de cotización actual como función pura testeable y configurar catálogo/precios de servidor; desarrollar un prototipo aislado que lea y liste las páginas de PDFs y reciba los parámetros de impresión sin cargar documentos en producción; añadir validación segura y almacenamiento privado, unir a sesión/checkout ya probado. **No desplegar automáticamente, no modificar main**.
