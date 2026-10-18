# Mercado Pago Checkout Pro — ensayo aislado (NO PUBLICADO)

Rama: `pagos/mercadopago-checkout-pro-pruebas-20261017`.

## Alcance
- Pago **total** ficticio de ARS 10.000 sobre un pedido de ARS 10.000; las pruebas de señas anteriores permanecen como histórico.
- La preferencia de pago se crea desde el servidor, nunca usando un importe enviado por el navegador.
- Al llegar un aviso `payment`, se consulta directamente a la API de Mercado Pago y solo se confirma cuando el pago es `approved`, es ARS, coincide el importe, la preferencia y el vendedor de pruebas.
- `/demo/paid-orders` devuelve solo pedidos pagos, con acceso restringido.
- No modifica el carrito, el panel existente, los Workers ni Polaroids.
- El Worker de pruebas está vinculado a esta rama por Cloudflare Builds; los cambios del Worker de pruebas pueden desplegarse automáticamente **solo en el subdominio workers.dev**, no en la web pública.

## Antes de ejecutar
1. Auditar el backend existente y elegir un entorno Cloudflare de ensayo completamente separado. No asociarlo al dominio público.
2. Crear una base D1 **de pruebas** y ejecutar `schema.sql`.
3. Configurar los secretos del Worker **solo en Cloudflare**, no en GitHub: `MP_TEST_ACCESS_TOKEN`, `DEMO_ADMIN_KEY` (cadena aleatoria larga) y `MP_TEST_SELLER_ID` (ID de la cuenta vendedora de pruebas).
4. Configurar `TEST_WEBHOOK_URL` con una URL HTTPS pública **del Worker de ensayo**, terminada en `/webhooks/mercadopago`, y vincular D1 como `DB`.
5. Registrar el webhook en el entorno de prueba de Mercado Pago, evento `payment`.
6. Crear pedido vía `POST /demo/order` con encabezado `Authorization: Bearer <DEMO_ADMIN_KEY>`. Después llamar `POST /demo/checkout` con `{"order_id":"..."}` y la misma autorización. Abrir `checkout_url` en sesión de comprador de prueba.
7. Consultar `GET /demo/paid-orders` con autorización y confirmar que el pedido figura **solo** luego de un pago aprobado.

## No está listo para producción
- Existe un panel privado inicial en `/admin`, con datos de pagos íntegros aprobados; está pendiente su comprobación desplegada y la conexión real con el carrito.
- Falta inspeccionar el Worker activo de Polaroids y cualquier backend adicional.
- Falta manejo de pagos devueltos, cancelaciones y conciliación, firma de webhook, monitoreo, control antiabuso/rate limiting, trazabilidad y pruebas integrales.
- El demo usa un importe fijo y no acepta nuevos montos desde el cliente.
- Se requiere verificar políticas de Mercado Pago y modalidad de pruebas antes de publicar.
- El secreto de Mercado Pago **jamás** se agrega a código, capturas ni chats.

## Regla de negocio final
No mostrar pedidos en producción hasta que los archivos necesarios estén recibidos íntegramente y el pago **total** esté aprobado y verificado. El registro de pedido debe persistir aunque el webhook se repita o el usuario cierre la página.

## Estado de conexión a Cloudflare
- Worker de pruebas: `saber-pagos-pruebas`.
- Conectado a esta rama para comprobar que los cambios en GitHub ejecuten el comando de despliegue aislado.
- El despliegue exitoso y las pruebas de API aún requieren verificación independiente.


## Regla de publicación acordada — 2026-10-18

**No publicar la integración en producción sin autorización expresa del propietario.** Preparar y probar el checkout del **100 % del pedido**, validación de precios en el servidor, catálogo y promociones, carrito mixto de librería/gráfica, referencias Polaroids, archivos asociados y Centro de Pedidos privado exclusivamente con pagos aprobados. Mantener la web pública, las rutas del cotizador y los accesos públicos de Polaroids inalterados durante el desarrollo.

### Criterios de salida (prepublicación)

- Pago íntegro por Mercado Pago y reconciliación idempotente probados con un pedido realista; conservar la validación HMAC y la conciliación alternativa.
- Importe recalculado en backend usando datos confiables; nunca cobrar basándose exclusivamente en los precios recibidos del navegador.
- Detalle completo y referencias de archivos visibles solo con autenticación administrativa; no almacenar información sensible de tarjetas.
- Errores, cancelaciones, vencimientos, doble clic y recargas tratados sin duplicar pedidos ni cobros.
- Mensajes, textos legales y flujo de WhatsApp revisados y aprobados antes de habilitar al público.
- Preparar plan de publicación coordinada y de reversión; última acción únicamente con aprobación expresa.

**Estado:** desarrollo aislado en rama de pruebas; no equivale a integración terminada. El botón del carrito público sigue sin conectarse a este checkout.

### Avance 2026-10-18 · Centro de Pedidos privado (rama de pruebas)

- Nueva ruta `/admin`: requiere clave del panel para mostrar datos; consulta únicamente pedidos con `status='paid'` y `deposit_ars=amount_ars`, excluyendo señas históricas.
- `/admin/api/orders` y `/admin/api/order?id=...`: exigen autenticación. Detalles de líneas y referencias se almacenarán en `order_items` (esquema añadido; su escritura desde el carrito aún no está implementada).
- El listado de pedidos del demo no se convierte automáticamente en una venta real.
- **Pendiente de comprobar el despliegue** del panel nuevo, la validación de precios del lado servidor, recepción y asociación completa de archivos y el flujo de pago definitivo. El cambio no autoriza a publicar.


### Avance · carrito con precios validados (solo pruebas)

- Se incorporó `POST /demo/cart-order`, protegido por `DEMO_ADMIN_KEY`; recibe `client_order_id` y líneas del carrito en formato `saber-cart-v1`, **sin aceptar importes como fuente de verdad**.
- Los artículos activos se verifican nuevamente en el servidor contra el CSV publicado de la planilla de productos; el Worker calcula el **100 % del precio vigente** (incluidas ofertas activas de la planilla), lo persiste en `orders` y guarda las líneas en `order_items`.
- Se agregó `cart_requests` para rechazar reutilizaciones indebidas de la misma clave con un contenido cambiado; repetir el mismo carrito devuelve el mismo pedido. El adaptador conserva el identificador de intento al recargar.
- `GET /demo/catalog` lista una muestra de artículos únicamente al operador autenticado. El demo dispone de una prueba de pedido de catálogo que **no cobra hasta abrir y completar Checkout Pro**.
- Las líneas de tipo gráfica/impresión permanecen **bloqueadas**: se requiere una fuente confiable de cotizaciones calculadas en el backend y vinculación/validación de archivos antes de habilitar el checkout de esos trabajos.
- La reserva o existencia de stock no está confirmada por el CSV; contemplar revisión de disponibilidad.
- **Pendiente**: probar desplegado el nuevo endpoint y su conectividad con la planilla, cotizaciones de gráfica, conexión real de la tienda y Polaroids, validación integral y aprobación de mensajes de WhatsApp. No publicar.


### Reintentos y comprobaciones de código (2026-10-18)

- Se reutiliza el pedido original cuando el comprador repite exactamente el mismo intento (`client_order_id` y SKU/cantidades), aunque hayan cambiado los precios de la planilla; se conserva el importe fijado al crear el pedido. Si cambia el contenido, se exige otro identificador de intento.
- Si un pedido ya tiene una preferencia en Mercado Pago, el Worker recupera ese enlace en vez de crear otro. En concurrencia devuelve exclusivamente la preferencia que quedó guardada en D1.
- La ruta de prueba sigue protegida por `DEMO_ADMIN_KEY`, **no habilitada para clientes públicos**.
- Pruebas de regresión incorporadas en `tests/mercadopago-carrito.test.mjs`. Ejecutar con Node 20+: `node tests/mercadopago-carrito.test.mjs`. Se hizo una comprobación lógica equivalente con D1 y Mercado Pago simulados; no supone una prueba de extremo a extremo en Cloudflare.
- **Pendiente para salir al público:** validación de cotizaciones de impresión/gráfica en el backend, habilitación segura del endpoint para clientes (sin exponer `DEMO_ADMIN_KEY`), políticas de precios y vencimiento, control de abuso, asociación de documentos y Polaroids, pruebas reales de la ejecución automática, aprobación comercial de mensajes y credenciales productivas.


### Integración de Polaroids · verificación previa al cobro (2026-10-18)

- El Worker de **pruebas** admite ahora `POST /demo/polaroid-proof`, protegido por la clave administrativa del demo. Recibe `reference`, `uploadKey` y `client_order_id`; consulta la API de recepción protegida de `libreriasaber.com.ar` para verificar, desde el servidor, que Google confirme `status=received`, `received=photos` y cantidad de hojas consistente. **No guarda ni devuelve `uploadKey`.**
- D1 guarda una constancia aleatoria `proof_token`, la referencia de Drive, número de fotos y hojas. El precio confiable se fija en el backend: **ARS 3.000 por hoja A4**.
- `POST /demo/cart-order` ahora puede preparar carritos mixtos de artículos de catálogo y trabajos `POLAROID_A4` con esa constancia, rechazando precios enviados desde el navegador, pruebas vencidas o asociadas a otro intento y duplicaciones de una misma constancia.
- El panel privado muestra las líneas y referencias de los pedidos **después** de verificar el pago total. El token de subida no debe incluirse en el pedido ni en los mensajes de WhatsApp.
- Se ejecutó una simulación lógica del Worker con D1, recepción Google y Mercado Pago reemplazados por respuestas de prueba: 12 fotos/2 hojas → ARS 6.000; dos artículos de ARS 3.500 → ARS 7.000; total de carrito → **ARS 13.000**. Reintentos idénticos devolvieron la misma orden/preferencia; una recepción incompleta y una constancia de otro carrito fueron rechazadas.
- **No habilitar públicamente** todavía: la ruta para crear la constancia requiere una clave privada de administrador y por diseño el editor del cliente no puede utilizarla. Se necesita un flujo público controlado (Turnstile/rate-limit/origen) que entregue la constancia desde la sesión de subida *antes de borrar* el `uploadKey` temporal, sin guardarlo ni transmitirlo al carrito.
- Pendiente verificar la comunicación real entre Workers y la recepción protegida de Google, cotizaciones de otros servicios gráficos, automatización por calendario y pruebas integrales antes de autorizar una publicación.

### Revisión local posterior · 18/10/2026

Se prepararon una pasarela de clientes apagada, cliente y vista de ensayo, correcciones de preferencias/conciliación y pruebas con SQLite real. **No se hizo push ni despliegue**: Cloudflare Builds está asociado a esta rama. El detalle vigente, las pruebas reproducibles y los impedimentos de salida están en `docs/PAGOS_PREPUBLICACION_20261018.md`. No interpretar los avances como integración productiva terminada ni como autorización para publicar.
