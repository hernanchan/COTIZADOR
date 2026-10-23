# Central de Pedidos · Documentos verificados y tienda en D1

**Fecha:** 23 de octubre de 2026. **Rama:** `cotizador/migracion-carga-archivos-20261018`.
**Estado:** código y regresiones locales aprobadas, **no desplegado**, sin cambios a la web pública, sin pagos habilitados y sin nuevos servicios contratados.

## Circuito de pruebas implementado

1. El Worker privado de documentos confirma un PDF desde Google Apps Script usando HMAC, recupera sus bytes, verifica SHA-256 y medidas, recalcula el presupuesto y produce `saber-central-recepcion-verificada-v1`.
2. **`POST /api/ensayo-sincronizar-central`**, accesible solamente al operador mediante `DOCS_CENTRAL_ADMIN_KEY` y mismo origen, empaqueta los datos comprobados del backend y los envía firmados al Worker de la Central. Requiere `DOCS_CENTRAL_SYNC_ENABLED=PRIVATE_TEST_ONLY`, `CENTRAL_BRIDGE_KEY` y `CENTRAL_TEST_URL`. Todos ausentes/apagados por defecto.
3. **`POST /internal/central/stage`** en el Worker de pagos verifica HMAC-SHA256 y marcas de tiempo (ventana de 5 minutos), exige origen servidor sin cabecera `Origin` y guarda únicamente la ficha técnica saneada en D1, sin enlaces de descarga, `uploadKey` ni contraseñas. Exige `CENTRAL_BRIDGE_ENABLED=PRIVATE_TEST_ONLY`, clave independiente de 32+ caracteres y recepciones completas. Los hashes y referencias individuales son únicos entre pedidos. Repetir una recepción idéntica devuelve el mismo registro, no duplica cobros.
4. **`POST /internal/central/prepare-order`**, también HMAC, exige la activación adicional `CENTRAL_PREPARE_ENABLED=PRIVATE_TEST_ONLY`. Crea **pedido comercial sin pago** usando el total documental que ya está verificado y, si hay artículos, recalcula sus precios contra el catálogo vigente del servidor. Guarda renglones separados `DOCS_VERIFIED` y `product`, referencias de recibo y `cart_requests` para reintentos idempotentes; relaciona la recepción con el pedido D1 en la misma transacción. Devuelve `checkoutEnabled:false` y `paymentAuthorized:false`. **Nunca crea preferencia de Mercado Pago.**
5. **`POST /internal/central/link`** permite vincular a una compra D1 previamente creada, pero solamente cuando coinciden exactamente las referencias documentales `DOCS_VERIFIED`, el importe de esos renglones y el importe de la ficha; nunca acepta un pedido con referencias omitidas o duplicadas. Sólo backend firmado.
6. La **Central administrativa privada** contiene tres estados diferenciados:
   - `GET /admin/api/central/pending`: PDF verificados todavía sin compra.
   - `GET /admin/api/central/unpaid`: documentos ya vinculados a pedidos que siguen impagos o presentan devolución/revocación.
   - `GET /admin/api/orders` + `/admin/api/order?id=...`: únicamente pagos completos confirmados, excluyendo pagos revocados; la ficha de PDF original comprobado aparece en los detalles del pedido.
7. Ni un PDF original confirmado ni un pago aprobado significan que el **PDF final listo para la impresora** esté preparado. Toda ficha conserva `listoParaProducir:false` y `pdfFinalVerificado:false`. **El endpoint de checkout de prueba rechaza expresamente los nuevos pedidos `DOCS_VERIFIED`** hasta completar ensayos integrales y contar con autorización.

## Base D1 de pruebas

- `central_document_manifests`: referencia WEB, posible `commercial_order_id`, importe documental, cantidad de archivos, digest y ficha técnica depurada. `web_order_id` único, `commercial_order_id` único.
- `central_document_receipts`: **un `receipt_id` único global** con correspondencia a documento y pedido web. Previene vender/copiar un mismo recibo en dos pedidos.
- `central_bridge_requests`: identificadores de solicitud firmados para detectar reintentos/conflictos.
- Las tablas están declaradas en `integraciones/mercadopago/pruebas/schema.sql` y se pueden crear perezosamente desde el Worker en el entorno autorizado. **No se ejecutaron migraciones en Cloudflare**.

## Seguridad y casos ensayados

- Credenciales administrativas, HMAC, marca temporal e intentos con origen navegador inválidos se rechazan.
- Recepciones cambiadas, recibos duplicados/reutilizados, pedidos cruzados y referencias de documentos que no coinciden nunca se vinculan a otra compra.
- El comprador no puede fijar el precio de artículos desde su navegador: cada SKU se recalcula contra el CSV de servidor.
- Repetir el mismo pedido crea como máximo una orden comercial. Usar un mismo identificador de compra con otras cantidades devuelve conflicto.
- Las recepciones sin pago y los pedidos esperando pago se muestran fuera de la lista de producción. Una devolución retira el pedido del listado de pagados.
- Los trabajos documentales generados siguen sin checkout; los pedidos de tienda/Polaroids ya existentes conservan sus flujos de pruebas.
- CI: **https://github.com/hernanchan/COTIZADOR/actions/runs/40019929359**. Ejecuta `central-bridge-d1.test.mjs`, `mercadopago-carrito.test.mjs`, `pagos-integral.test.mjs` con SQL local y test PDF end-to-end con Google/Turnstile simulados. No se comunica con Mercado Pago real ni Google Drive durante estas regresiones.

## Pendientes obligatorios antes de habilitar al público

1. Ensayo autorizado con cuentas reales en **entornos privados**, configurando secretos separados exclusivamente en Cloudflare. No suplantar por claves incrustadas en repositorios.
2. El GAS actual de documentos es de cupo muy restringido (FASE4, cinco PDFs y 1 MiB cada uno). Implementar recepción de múltiples PDF/JPG/PNG recuperable, validada por servidor y sin R2.
3. Conciliar de forma integral carrito de la tienda, Polaroids y documentos en una única orden, sin pérdida de datos cuando el cliente cambia de pantalla o se duerme el teléfono.
4. Verificar y descargar de manera privada el **PDF definitivo de impresión** (no solamente el original), controlar instrucciones de producción, opciones de anillado y stock. Sólo un operador autorizado puede modificar el estado de preparado/entregado.
5. Repetir pruebas completas PC/móvil, interrupciones, pagos sandbox y devolución antes de considerar activación.
