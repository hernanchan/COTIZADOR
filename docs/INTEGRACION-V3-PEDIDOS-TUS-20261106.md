# Integración V3 → pedidos TUS existentes — 06/11/2026

## Estado comprobado
- Rama: `integracion/tus-pedido-privado-20261101`. `main` y `libreriasaber.com.ar` intactos.
- Portada de ensayo: https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/diseno-sin-clave
- Acceso comprador: https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/pedido-cliente
- El enlace **Cotizar impresiones** de V3 dirige a `/prueba-v2/pedido-cliente` sólo con `DOCS_PUBLIC_ORDER_GATE_ENABLED=PRIVATE_TEST_ONLY`.
- **No hay nuevo cotizador**: se usa la pantalla `paginaCotizadorV2PruebaPrivada` mediante adaptador `paginaCotizadorTUSClientePruebas`, los mismos activos, rutas TUS, tarifario D1, registro comercial, Sandbox, Central y seguimiento.
- Sesión Turnstile comprador `saber_pedido_client_v1` con acción `saber_pedido`; cookie Secure/HttpOnly/SameSite=Strict y vencimiento 1 h, distinta de quote-only y staff.
- El inicio TUS emite cookie de orden vinculada `saber_pedido_orden_v1` sólo tras autorizar el lote. Registrar, recuperar y pagar exigen que la orden corresponda a la sesión de comprador. No hay descargas administrativas desde la sesión pública.
- El comprador obtiene tarifario D1 aprobado para cotizar y registrar. No se activa pago ante error de D1.
- Productos, promociones y carrito de V3 siguen separados vía consulta por WhatsApp, sin construir carrito mixto.

## Pruebas y despliegue
- CI integral, sin despliegue, **SUCCESS**: https://github.com/hernanchan/COTIZADOR/actions/runs/42233959180
- Activación solo Worker `saber-documentos-pruebas`, **SUCCESS**: https://github.com/hernanchan/COTIZADOR/actions/runs/42233959364
- Versión de Cloudflare verificada: `ce530d6a-4428-4a54-a116-6247a5065350`.
- Smoke de tráfico real: entrada comprador **HTTP 200** con Turnstile `saber_pedido`; portada V3 **HTTP 200** enlaza la ruta; portal staff, ZIP y activos TUS sin sesión **HTTP 401**; inicio TUS sin cookie **HTTP 403**; pago Sandbox sin cookie **HTTP 401**; token Turnstile inválido **HTTP 422**; borrado apagado **HTTP 503**.
- Se inspeccionaron y conservaron bindings existentes con `bindings_inherit=strict`. Activación separada mediante `docs/ACTIVAR-PORTAL-TUS-COMPRADOR-PRUEBAS.trigger`. Rollback si smoke falla.
- `DOCS_PUBLIC_ORDER_GATE_ENABLED=PRIVATE_TEST_ONLY`; `DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY`; MP real no habilitado.
- `DOCS_TUS_PURGE_ENABLED=OFF`; `CENTRAL_TUS_PURGE_QUEUE_ENABLED=OFF`; `CENTRAL_TUS_PURGE_EXECUTE_ENABLED=OFF`. No se borraron los 40 archivos históricos.

## Todavía NO validado
1. Navegador comprador real: resolver Turnstile, cargar PDF sintético, configurar y registrar TUS, comprobar D1 + Central desde el nuevo enlace V3.
2. Pago con usuario comprador de **Sandbox**, verificar webhook, estado en Central y enlace de seguimiento cliente, desde esa sesión pública.
3. Comprobación real de UX de navegador móvil y recuperación al expirar la sesión.
4. Borrado automático por `Entregado` no probado con pago auténticamente conciliado; seguir apagado hasta validación controlada.

La CI y el smoke verifican código, accesos públicos/privados y despliegue, **no** sustituyen un pedido y pago reales de ensayo desde navegador. No cambiar `main` ni cobros reales para esta prueba.

## Puntos de código
- `integraciones/autocotizador/recepcion/cotizador-cliente-publico.mjs`: sesión y vínculo comprador-orden.
- `integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs`: adaptador visual, no nuevo motor.
- `integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs`: rutas, permisos y precios.
- `integraciones/autocotizador/recepcion/saber-directo-vista-previa.mjs`: navegación V3.
- `tests/tus-portal-comprador.test.mjs`, `tests/saber-directo-publica-solo-lectura.test.mjs`: pruebas.
- `.github/workflows/tus-activar-portal-comprador-v3-privado.yml`: activación fail-closed y smoke.
