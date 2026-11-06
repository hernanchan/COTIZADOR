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

## 06/11/2026 — Corrección urgente de «Enviar mi pedido» en navegador comprador
- Captura del usuario: dos PDF cotizados por $7.220, con teléfono completo; al pulsar Enviar aparece el error genérico «La recepción privada admite PDF de hasta 20 MB por archivo». **No se obtuvo en la captura el tamaño exacto de cada PDF**. El mensaje provenía del validador de preenvío del iframe, no de un fallo de evento click; la condición podía indicar archivo faltante, nombre no admitido o tamaño >20 MiB.
- Corrección: límite coordinado **40 MiB por PDF** con máximo **60 MiB por pedido y 10 archivos**, en análisis de cliente, handoff, TUS, contrato de recibos, lectura privada, registro D1, comprobación de la Central, manifiesto de ZIP y plan de purga. Se preservan protección de identidad, integridad SHA, HMAC y revalidación de precios; no se alteran tarifas ni pagos.
- Mensaje del cliente ahora diferencia archivo ausente, formato y archivo excedido, mostrando nombre y tamaño en MiB. Antes de la transferencia también valida el total 60 MiB y explica la causa.
- CI completa después del cambio: https://github.com/hernanchan/COTIZADOR/actions/runs/42238502841 **SUCCESS**.
- Central de pruebas desplegada: https://github.com/hernanchan/COTIZADOR/actions/runs/42238400294 **SUCCESS**, versión `2de166a1-34c6-401d-be32-7f8ccbf21477`. Health D1 OK, paymentsEnabled false, admin protegido, cola/ejecución de borrado OFF.
- Documentos de pruebas desplegado: https://github.com/hernanchan/COTIZADOR/actions/runs/42238502719 **SUCCESS**, versión `b441b775-c7f1-4af3-a400-6b78c8dc7597`. V3 y comprador HTTP 200, personal y ZIP HTTP 401, TUS sin sesión HTTP 403, purga HTTP 503, MP exclusivamente Sandbox.
- La prueba automatizada verifica que un PDF de 21 MiB ahora entra en el handoff y uno >40 MiB queda bloqueado con mensaje preciso; contrato TUS admite 30 MiB y rechaza >40 MiB. **No hubo una carga real desde el navegador del cliente ni pago real de ensayo en esta ejecución**. Falta la prueba de los dos archivos de la captura, con sus tamaños.
- Acceso para repetir SOLO la validación corregida: https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/pedido-cliente . Recargar la página y volver a seleccionar los PDF (File no persiste tras recargar), después enviar. En caso de error registrar el mensaje exacto visible.
- `main`, web comercial, dinero real y políticas de borrado sin cambios; no se solicitaron credenciales ni borraron históricos.

## 06/11/2026 — Advertencia roja individual por archivo no admitido
- Pedido de corrección del usuario tras probar envío: el límite de tamaño se informaba arriba, pero la ficha del PDF excedido quedaba visualmente normal.
- Se agregó validación anticipada en `carga-unica-cliente.mjs` para la pantalla del comprador: borde rojo, texto `PDF NO ADMITIDO` y causa con nombre/tamaño del original en la tarjeta correspondiente, visible aun con detalles cerrados. Los archivos admisibles conservan su estado.
- La pantalla superior también indica bloqueo en rojo; `SABER_SMART_PRICE_STATE.sendable` queda `false` mientras haya un PDF incompatible. No se necesitan nuevas cargas para los otros PDF.
- No se alteran límites (10 PDF, 40 MiB/PDF, 60 MiB/pedido), tarifario, lógica TUS ni contratos de Central. Límites comerciales son configuraciones preventivas de ensayo, no una prohibición inherente al sistema.
- CI integral **SUCCESS**: https://github.com/hernanchan/COTIZADOR/actions/runs/42241817416
- Deploy en `saber-documentos-pruebas` **SUCCESS**: https://github.com/hernanchan/COTIZADOR/actions/runs/42241917866 ; versión `5c01c1d2-37eb-4975-b345-271f7939762f`. Smoke HTTP V3/comprador 200, staff/ZIP 401, inicio TUS sin cookie 403, purga 503, Sandbox único.
- Falta la comprobación visual de usuario cargando PDF excedido junto a otro válido desde navegador. No declarar eso validado por CI.

## 06/11/2026 — Límite REAL de Supabase detectado y corregido
- Consulta directa a proyecto `saber-tus-lab` de Supabase: bucket privado `saber-tus-lab` limitaba físicamente cada PDF a **20 MiB** (`file_size_limit=20971520`). Contradecía código y mensajes de V3/TUS (40 MiB). Las pruebas anteriores NO habían contrastado el bucket real: este desfase explica fallos aunque el navegador admitiese archivos.
- Se actualizó **solo el límite del bucket de ensayos** a `41943040` (40 MiB) mediante operación condicionada al valor anterior. Relectura SQL confirma: `public=false`, MIME exclusivamente `application/pdf`, `40` objetos históricos y `211851276` bytes sin cambios. Ningún original fue modificado, descargado ni eliminado.
- Plan de la organización Supabase: **Free**. La documentación vigente establece un máximo global de 50 MB por archivo en proyectos Free. Por eso un PDF superior a 40 MiB aún puede ser rechazado por la app, y aumentar arbitrariamente a 100 MB no sería una solución; se necesita una ruta alternativa para archivos realmente grandes, sin coste no aprobado.
- No se desplegó otro Worker ni se alteraron cotizadores, D1, Mercado Pago, Central o `main`. El cambio fue una configuración de Storage que faltaba sincronizar con el código. Verificación hecha con consulta de estado SQL, **no** con carga de PDF >20 MiB desde navegador.
- Próximo requisito comercial: archivos reales de clientes que superan los límites; determinar su peso y diseñar manejo confiable sin degradar originales ni comprometer lectura/verificación en Worker de 128 MB. Prioridad: no rechazar trabajo del negocio. No prometer compatibilidad con archivos >40 MiB hasta probar camino completo.
