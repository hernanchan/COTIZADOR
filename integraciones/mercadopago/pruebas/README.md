# Mercado Pago Checkout Pro — ensayo aislado (NO PUBLICADO)

Rama: `pagos/mercadopago-checkout-pro-pruebas-20261017`.

## Alcance
- Pago de una seña ficticia de ARS 5.000 sobre un pedido ficticio de ARS 10.000.
- La preferencia de pago se crea desde el servidor, nunca usando un importe enviado por el navegador.
- Al llegar un aviso `payment`, se consulta directamente a la API de Mercado Pago y solo se confirma cuando el pago es `approved`, es ARS, coincide el importe, la preferencia y el vendedor de pruebas.
- `/demo/paid-orders` devuelve solo pedidos pagos, con acceso restringido.
- No modifica el carrito, el panel existente, los Workers ni Polaroids.
- Esta carpeta **no despliega nada automáticamente**.

## Antes de ejecutar
1. Auditar el backend existente y elegir un entorno Cloudflare de ensayo completamente separado. No asociarlo al dominio público.
2. Crear una base D1 **de pruebas** y ejecutar `schema.sql`.
3. Configurar los secretos del Worker **solo en Cloudflare**, no en GitHub: `MP_TEST_ACCESS_TOKEN`, `DEMO_ADMIN_KEY` (cadena aleatoria larga) y `MP_TEST_SELLER_ID` (ID de la cuenta vendedora de pruebas).
4. Configurar `TEST_WEBHOOK_URL` con una URL HTTPS pública **del Worker de ensayo**, terminada en `/webhooks/mercadopago`, y vincular D1 como `DB`.
5. Registrar el webhook en el entorno de prueba de Mercado Pago, evento `payment`.
6. Crear pedido vía `POST /demo/order` con encabezado `Authorization: Bearer <DEMO_ADMIN_KEY>`. Después llamar `POST /demo/checkout` con `{"order_id":"..."}` y la misma autorización. Abrir `checkout_url` en sesión de comprador de prueba.
7. Consultar `GET /demo/paid-orders` con autorización y confirmar que el pedido figura **solo** luego de un pago aprobado.

## No está listo para producción
- Todavía no hay automatización de despliegue, UI de panel ni conexión con el carrito.
- Falta inspeccionar el Worker activo de Polaroids y cualquier backend adicional.
- Falta manejo de pagos devueltos, cancelaciones y conciliación, firma de webhook, monitoreo, control antiabuso/rate limiting, trazabilidad y pruebas integrales.
- El demo usa un importe fijo y no acepta nuevos montos desde el cliente.
- Se requiere verificar políticas de Mercado Pago y modalidad de pruebas antes de publicar.
- El secreto de Mercado Pago **jamás** se agrega a código, capturas ni chats.

## Regla de negocio final
No mostrar pedidos en producción hasta que tanto los archivos estén recibidos íntegramente como el pago (seña o total) esté aprobado y verificado. El registro de pedido debe persistir aunque el webhook se repita o el usuario cierre la página.

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
