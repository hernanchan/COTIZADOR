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


## 24/10/2026 · Documentos → Central mediante Service Binding

Se descubrió que el backend del cotizador documental seguía enviando la ficha HMAC a `saber-pagos-pruebas.*.workers.dev` mediante `fetch()` público, una ruta que ya había provocado fallo de Worker-to-Worker en el ensayo Express. La rama de integración `polaroids/express-pdf-unico-20261023` es **descendiente directo de** `cotizador/migracion-carga-archivos-20261018` y de `pagos/mercadopago-checkout-pro-pruebas-20261017`; los cambios de esos componentes en la rama más avanzada siguen sin copiarse a `main`.

**Corrección incorporada en la rama avanzada, no desplegada:** `enviar-central-firmada.mjs` utiliza un Service Binding `SABER_CENTRAL.fetch(new Request(destino,opciones))` manteniendo el host validado y HMAC. Si no hay binding real se rechaza el envío antes de hacer una llamada por Internet; el `fetcher` inyectado queda solo para pruebas unitarias. `worker-fase4-cotizador-unificado.mjs` suministra `env.SABER_CENTRAL`. El receptor D1 conserva bloqueo independiente `CENTRAL_BRIDGE_ENABLED`; documentos exige `DOCS_CENTRAL_SYNC_ENABLED` y autenticación administrativa antes de generar el manifiesto. **No se modificaron variables ni vinculaciones existentes de Cloudflare.**

Se añadió `tests/autocotizador-central-binding.test.mjs` que comprueba firma HMAC en el binding, ausencia de tráfico público, rechazo por falta de vinculación, documentos inválidos, host no autorizado y rechazo de respuestas de Central que intentan permitir cobros. En el workflow `polaroids-express-ensayo.yml` de la rama avanzada se incorporó la **compilación del Worker documental** además de su test. GitHub Actions completó con `success` en el commit `94cd1594f115fdc35a022997b547b3ea31c09bd9`, corrida https://github.com/hernanchan/COTIZADOR/actions/runs/40141674435; pasos de compilación documental y pruebas de enlace interno ambos exitosos.

También se añadió una prueba de integración sobre el Worker Central real cargado en SQLite D1 local, usando la función de envío real con un Service Binding simulado. Confirma alta de manifiesto sin pedido pagado ni producción y reenvío idempotente; **su CI aún no estaba confirmado al momento de escribir esta nota** y se debe revisar el estado de la ejecución asociada al commit `5adab8889b8501374057d763e65b28646dc2cbf9`.

**Pendiente de infraestructura real:** en el Worker aislado `saber-documentos-pruebas` añadir un Service Binding de nombre `SABER_CENTRAL` que apunte al Worker `saber-pagos-pruebas`, al desplegar la rama autorizada. No reutilizar el secreto HMAC de acceso del operador ni publicar rutas públicas. La vinculación **ya existe en Pages Express** pero no consta configurada en el Worker de documentos. Agrupar esta operación con el ensayo final de recepción, no hacer intervenir al propietario ahora.

La prueba integral remota sigue condicionada a Apps Script y carga privada reales y **no está demostrada**. Sin R2, sin nuevos gastos, sin cobros activos y sin modificaciones a `main` ni al dominio público.


## 24/10/2026 · Compra verdaderamente mixta en una sola orden D1

**Problema resuelto en la rama integral de pruebas:** los endpoints previos podían preparar separadamente un pedido de documentos y otro de Polaroids, pero no una única compra de ambas familias junto con artículos del catálogo. Se incorporó el nuevo endpoint HMAC `POST /internal/central/prepare-mixed-order` al Worker privado de la Central (`integraciones/mercadopago/pruebas/worker.js`), sin acceso público ni activación de cobros.

- Exige **tres permisos apagados por defecto**: `CENTRAL_MIXED_PREPARE_ENABLED=PRIVATE_TEST_ONLY`, `CENTRAL_PREPARE_ENABLED=PRIVATE_TEST_ONLY` y `CENTRAL_EXPRESS_PREPARE_ENABLED=PRIVATE_TEST_ONLY`, más la guarda HMAC `CENTRAL_BRIDGE_ENABLED`.
- Recibe solamente `clientOrderId`, `webOrderId` documental verificado, `polaroidReference` verificada y artículos `{code,qty}`. Comprueba que ambos manifiestos existen, están libres y mantienen importes y referencias íntegros.
- Recalcula los SKU de tienda contra catálogo servidor; prepara una orden D1 con tres clases de renglones: `DOCS_VERIFIED`, `POLAROID_EXPRESS_A4` y `product`. Con pago total pendiente: `checkoutEnabled:false`, `paymentAuthorized:false`, sin crear preferencias de Mercado Pago ni habilitar descarga.
- Vincula ambas referencias dentro de `DB.batch`; una condición SQL de integridad al insertar `cart_requests` hace fallar el lote entero si una vinculación fue tomada por otro proceso. Reintentos con mismo identificador son idempotentes y carritos alterados se rechazan.
- Se detectó por **CI real una omisión crítica**: el checkout de pruebas bloqueaba trabajos nuevos en función de `order.description`, lo que no cubría la descripción del pedido mixto. Se corrigió el guard para buscar los SKU `DOCS_VERIFIED` o `POLAROID_EXPRESS_A4` en `order_items` y rechazar el cobro antes de consultar Mercado Pago, independientemente del título. Se añadió una regresión que cambia el texto del pedido y exige rechazo del checkout.

**Evidencia de ejecución GitHub Actions:** el commit `c6dd262305e0231f865ce9e5f9a855f99eb78107` terminó con estado `polaroids-express/ci: success`, corrida `40142180078`; se verificó que **todas las etapas del job terminaron correctamente**, incluyendo pruebas Central+D1 y regresión de checkout, construcción del Worker documental y vínculo Documentos→Central. URL: https://github.com/hernanchan/COTIZADOR/actions/runs/40142180078

**Importante: no publicar todavía.** El endpoint mixto se ensayó contra el Worker original corriendo en SQLite local, **no en Cloudflare D1 remoto**. Todavía no existe interfaz de cliente conectada a este endpoint, recepción integral en Google Drive para todas las familias, cobro y descarga de PDF final verificados ni validación real PC/móvil. `CENTRAL_MIXED_PREPARE_ENABLED` **no fue creado ni activado** en Cloudflare. `main`, el dominio público y cobros activos permanecen intactos.

El siguiente desarrollo prioritario es conectar el flujo de recepción documental comprobada y el manifiesto Express con el endpoint mixto desde el backend de ensayos (sin exponer credenciales); luego ejecutar el primer pedido completo privado Cloudflare↔GAS↔D1.


## 24/10/2026 · Backend documental integrado con el alta comercial mixta

Se agregó `integraciones/autocotizador/recepcion/preparar-mixto-central.mjs`, que desde el **backend** documental llama firmando HMAC al endpoint interno `/internal/central/prepare-mixed-order` mediante `env.SABER_CENTRAL.fetch()`. Valida exclusivamente referencia documental `WEB-...`, referencia privada Express `POL-...`, `clientOrderId` UUID y SKU/cantidades de catálogo (sin precios declarados por comprador). Rechaza cualquier respuesta que pretenda habilitar checkout.

En la versión no desplegada de `worker-fase4-cotizador-unificado.mjs` se añadió `POST /api/ensayo-preparar-mixto`, reutilizando la **autenticación administrativa del operador** `DOCS_CENTRAL_ADMIN_KEY`, la validación exacta de origen y las funciones privadas GAS. Verifica el PDF documental en Drive, crea/recupera el manifiesto autenticado en la Central y **después** solicita la compra conjunta con una referencia Express ya registrada previamente por el receptor privado. No permite pedidos sin ambos manifiestos. Exige `DOCS_MIXED_PREPARE_ENABLED=PRIVATE_TEST_ONLY`, `DOCS_CENTRAL_SYNC_ENABLED=PRIVATE_TEST_ONLY`, vinculación interna y los permisos de Central, todos cerrados por defecto.

Se añadió `tests/autocotizador-mixto-central.test.mjs` con los casos de HMAC interno, ausencia de binding o permisos, datos y destino incorrectos, y rechazo de respuestas con cobros; el workflow CI también recompila el Worker documental sin desplegar. Se corrigió una expresión regular incompleta de UUID detectada por la **primera corrida fallida** de GitHub, commit `ab21b75bf57c141c45e05d9ab1b00edeebe4eb45`. **Pendiente confirmar resultado de CI posterior a esa corrección; no declarar aprobación antes de consultar GitHub.**

Este endpoint es **administrativo de ensayo**, no está incluido aún en el carrito web visible al comprador. Por tanto hay avance verificable de integración de backend, pero el carrito único público, recepción de múltiples PDF/JPG/PNG, pago integral y salida de producción no están terminados. No cambiar `main`, web pública, recepciones GAS productivas, secretos ni cobros para ejecutar estos cambios.
