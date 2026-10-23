# Polaroids Express · 24 fotos · un único PDF privado

**Ensayo aislado.** Rama `polaroids/express-pdf-unico-20261023`, derivada de `cotizador/migracion-carga-archivos-20261018`. **No desplegada**, no fusionada, sin R2, gastos, cambios productivos o pagos nuevos. El receptor antiguo de Polaroids, el sitio público y los originales de pedidos previos permanecen intactos.

## Decisión de producto

- Límite de lanzamiento: **6, 12, 18 o 24 fotos**, con la posibilidad existente de completar una última hoja parcialmente, a razón de $3.000 por hoja A4 de seis.
- Máximo de **4 hojas A4**. Los pedidos superiores se atienden por WhatsApp hasta validar escalabilidad sin pérdida de fotografías.
- Plantilla aprobada: Polaroid compacta **85 × 90 mm**, ventana **75 × 75 mm**, 6 por A4 en 2 columnas × 3 filas, márgenes simétricos, y marcas externas únicas para guillotina.
- El cliente encuadra y previsualiza con marca de agua. El PDF imprimible **se crea en el servidor**, nunca se descarga al navegador del cliente.

## Por qué se simplifica

**Circuito heredado:** navegador sube cada original + recorte 886px + JSON de encuadre; Apps Script recibe múltiples archivos además del PDF final. Esto multiplica la transferencia, elementos en Drive y tiempo de espera.

**Circuito Express diseñado:**

1. La web procesa localmente las fotos en **tandas de seis**; recorta a 886 × 886 px (aprox. 300 ppp para ventana de 75 mm). Comprime JPEG con calidades progresivas 0,82 / 0,75 / 0,68 / 0,60 hasta un máximo de 750 KB por recorte. El archivo original **no se envía por este protocolo**.
2. El Worker (aún pendiente de su ruta pública protegida) recibe los recortes temporales y `motor-pdf.mjs` arma el **PDF A4 multipágina** con las marcas; no persiste originales, JPG individuales ni JSON.
3. `guardar-pdf-privado.mjs` firma un sobre HMAC-SHA256 y entrega **únicamente el PDF final** al nuevo Apps Script `apps-script-solo-pdf.gs`. Se utiliza un secreto dedicado, URL Google validada y redirección permitida únicamente a `script.googleusercontent.com`.
4. GAS almacena en **carpeta de Drive privada** un único `POL-<referencia>_IMPRIMIR.pdf` por pedido. Antes de confirmar, verifica hash SHA-256 y que el PDF recién guardado sea idéntico al transmitido. El reintento con la misma referencia y PDF es idempotente; uno distinto se rechaza. No genera subcarpetas de 6/24 imágenes ni recortes adicionales.
5. El cliente recibe **solo** confirmación/identificador y sigue al carrito. La futura Central de Pedidos buscará por la referencia y tendrá acceso autorizado al PDF final; no se expone URL ni ID de Drive.

## Qué ya quedó implementado y probado en GitHub

- Interfaz experimental limitada a 24 fotos (máximo 4 hojas), y su `recepcion-config.json` sigue con `enabled:false`, `showInShop:false`, `rollout:PENDIENTE_DE_APROBACION`. **Ojo:** el editor de prueba conserva por ahora el método de envío antiguo, por lo que NO debe habilitarse ni usarse con clientes.
- `motor-pdf.mjs`: genera un PDF real por pedido, con páginas A4, 6 ventanas y marcas de corte, y bloquea la entrega de bytes PDF al usuario.
- `preparar-tandas.mjs`: procesa en el navegador por grupos de seis fotos y permite informar avance/cancelar, sin enviar originales.
- `guardar-pdf-privado.mjs` + `apps-script-solo-pdf.gs`: receptor alternativo con HMAC, hash integral, carpeta privada y un archivo final por pedido. Código **sin despliegue**.
- Pruebas `polaroids-express-motor.test.mjs`, `polaroids-express-guardado.test.mjs` y `polaroids-express-tandas.test.mjs`: PDF real A4, 24 fotos, 19 fotos con hoja incompleta, bytes validables, duplicados idempotentes, HMAC, redirecciones ajenas, JPG inválidos y fallos/cancelación. Google Drive está **simulado**, no se guardó un archivo real en la cuenta.
- Workflow exclusivo `.github/workflows/polaroids-express-ensayo.yml` ejecuta estas pruebas y regresiones existentes; **nunca despliega**.

## Lo que NO está conectado y no puede darse por solucionado aún

1. La ruta del navegador a Worker Express, con Turnstile, cuotas, validación de cantidad, sesión segura, carga/reintento y protección antifraude. El cliente actual **todavía enviaría originales y recortes** si se activara el receptor antiguo.
2. El Worker que invoca conjuntamente `prepararTandasExpress` (cliente), `guardarPedidoPdfExpress` y `guardarPdfPrivadoEnGAS` (servidor), sin exponer el PDF al dispositivo.
3. La Central de Pedidos privada debe leer y descargar el PDF final de esta nueva carpeta, con autorización del operador y comprobación de pago; actualmente no conoce el nuevo receptor.
4. El bloqueo/reposo de teléfonos: la preparación por tandas reduce carga, pero **no significa que el envío sea reanudable después de cerrar o recargar el navegador**. Se necesitarán comprobaciones de estado e idempotencia, y eventualmente respaldo local de recortes/sesiones con vencimiento. No prometer reanudación todavía.
5. Pruebas reales sobre Android/iPhone y Wi‑Fi/datos, fotos complejas y 24 fotos: medir tiempo, consumo de memoria, calidad de impresión, PDF final, fallos y duplicación. Sólo después autorizar un despliegue **privado** sin tocar `main` ni el dominio oficial.
6. Configurar `EXPRESS_PDF_FOLDER_ID` y `EXPRESS_PDF_HMAC_KEY` en Apps Script, y `EXPRESS_PDF_ENABLED=PRIVATE_TEST_ONLY`, `EXPRESS_PDF_SCRIPT_URL` y `EXPRESS_PDF_HMAC_KEY` en el Worker. **Nunca** incrustar secretos en repositorio o pasar el PDF imprimible por el navegador. Verificar que la carpeta sea privada y su política de conservación (no hay eliminación automática de PDFs).

## Criterios de aceptación para lanzamiento

- 6, 12, 18 y 24 fotos imprimen 1, 2, 3 y 4 páginas A4; encuadres fieles y guías adecuadas para guillotina.
- Una compra equivale a **un PDF final y una referencia** en Drive; no quedan JPG/JSON de producción por separado.
- La transferencia resulta más rápida que enviar originales+recortes, sin pérdidas al dormir la pantalla; confirmar con mediciones.
- El cliente no recibe el PDF de impresión ni enlaces de Drive.
- La Central de Pedidos presenta una descarga privada accesible únicamente al operador y nunca incluye pedidos impagos como listos para producir.
- Sin R2 ni costos nuevos y sin cambios a la web pública antes de autorización expresa.

## Integración de navegador y Worker Express — avance 23/10/2026

**Implementado adicionalmente en esta rama:**

- El editor aprobado se conserva: se añadió un selector de transporte por configuración `delivery:"express-pdf-only"`, con URL interna fija `/api/polaroids-express`. El viejo flujo queda separado, sin alteración de producción. Con la configuración actual (`enabled:false`) **no se puede enviar ningún pedido**.
- `vidriera/polaroids/express-cliente.mjs` optimiza fotos localmente por tandas de seis, generando recortes JPEG de 886×886 con calidad adaptativa y **máximo 450 KB por foto**. El cliente no lee el original en Base64 para enviar; entrega únicamente los JPEG recortados, en **una solicitud de hasta 18 MiB**, junto con la referencia y el token Turnstile. La preparación por tandas es local: el POST es uno solo, **no es todavía carga reanudable en servidor**.
- `worker-express.mjs` es la implementación de `POST /api/polaroids-express`, expuesta desde `functions/api/polaroids-express.js` y compilable con esbuild: host y Origin exactos, modo aprobado en ASSETS, dos interruptores privados de entorno, validación Turnstile con acción `polaroids-express`, cantidad 1–24 y hasta cuatro hojas, tamaño total acotado, JPEG real y documento PDF único generado mediante `pdf-lib`. No hay enlaces ni bytes de PDF en las respuestas al cliente.
- El Worker solamente declara recepción exitosa **después** de que el Apps Script independiente confirma integridad y un único PDF privado. El editor añade al carrito un artículo Polaroids con su referencia **después** de esa confirmación.
- Reintentos del mismo pedido conservan el `POL-...` durante la sesión del navegador. Se exige un nuevo Turnstile para reintentar y Google verifica que el PDF ya guardado sea el mismo, sin duplicarlo. Los metadatos PDF se fijaron para que un PDF reconstruido de las mismas imágenes sea reproducible.
- Se añadió `package.json` al root sólo en la rama para permitir resolución de `pdf-lib` en la Cloudflare Pages Function de vista previa. La compilación del Worker se ha probado **sin despliegue**, junto con pruebas HTTP simuladas del Worker y simulación de editor móvil.

**Suite actual:** [GitHub Actions](https://github.com/hernanchan/COTIZADOR/actions/runs/40028783523) — completada con resultado **success**. Incluye pruebas con 6/12/19/24 fotos, PDF A4, control de acceso, Turnstile, HMAC, Drive simulado, cartera/reintento tras una caída de red, y comprobación de que ningún original de imagen ni PDF imprimible aparece en el JSON para clientes.

### Pendientes actualizados: no activarlo aún

1. Configurar y desplegar exclusivamente el receptor Apps Script en una carpeta **privada de prueba**, sin tocar el receptor antiguo ni la web pública. Necesita una prueba de almacenamiento *real* con una fotografía.
2. Configurar secretos del Worker Express en el entorno privado y habilitar una configuración de ensayo sólo tras aprobación. La opción `delivery` sigue AUSENTE y `enabled:false`; ningún trabajo se puede enviar a través del nuevo flujo en la web pública.
3. Medir el tiempo y la fidelidad de **24 fotos reales** de diferentes celulares, en Wi-Fi y datos móviles. Verificar encuadres, marcas de guillotina y salida impresa en chorro de tinta; un test automatizado no prueba colores ni papel.
4. Probar interrupción por bloqueo o **recarga** del teléfono. Reintentar con la misma referencia funciona en la misma pestaña, pero **no** hay recuperación garantizada después de recargar, cerrar la pestaña o reiniciar el navegador.
5. Conectar la descarga de ese único PDF privado a la **Central de Pedidos**, con control administrativo y estado de pago; hoy sólo está listo el contrato de almacenamiento, no la descarga desde la Central.
6. Aplicar cuotas de recepción, reglas de caducidad/purga de pedidos abandonados y verificación final de pago. Ninguna de ellas debe autorizar el checkout sólo con la declaración del navegador.

**Nota de diseño:** no se suben tandas de seis por separado porque eso exigiría almacenar fotografías temporales entre peticiones, justamente lo que queremos evitar. Se comprimen en grupos de seis en el teléfono y se envían los recortes de todo el pedido en un único POST; el servidor produce y guarda directamente un solo PDF. Sin R2, KV ni servicios de pago adicionales.

## Central de Pedidos y recuperación del celular — bloque completado en GitHub

**La integración ya tiene código funcional y pruebas automatizadas, pero permanece SIN DESPLEGAR.**

1. **Polaroids Express → Central.** Al verificar en GAS un solo PDF privado, el Worker Express firma una constancia `saber-polaroids-express-central-v1` que contiene únicamente referencia `POL-...`, número de fotos, hojas A4, precio servidor (`$3.000 × hojas`), bytes y SHA-256. Envía esta constancia al nuevo `POST /internal/central/polaroid-stage` con firma HMAC Cloudflare↔Cloudflare, sin transmitir fotos o PDF a la base de pedidos. Los intentos iguales son idempotentes; si se reutiliza la referencia con un PDF distinto, devuelve conflicto.
2. **Persistencia privada D1.** La tabla `central_polaroids_express` guarda el manifiesto único y su eventual `commercial_order_id`. `GET /admin/api/central/polaroids` muestra las recepciones en la Central sólo a operadores autenticados, sin mostrar hash, claves, fotos ni PDF. Un PDF recibido **no** es un pedido cobrado.
3. **Pedido mixto sin pago.** `POST /internal/central/polaroid-prepare-order` crea en la D1 de pruebas una orden comercial que vincula exactamente una referencia de PDF Express y, opcionalmente, artículos de tienda que se recalculan en servidor. Protegido por HMAC y `CENTRAL_EXPRESS_PREPARE_ENABLED=PRIVATE_TEST_ONLY`. `cart_requests` y referencia única impiden duplicar compras o asignar el PDF a otra orden. **Nunca habilita el checkout.** El endpoint `/demo/checkout` rechaza de forma explícita cualquier orden Express, aun cuando la orden ya exista.
4. **Descarga del PDF único, privada y condicionada.** GAS implementa ahora la operación HMAC `leerPdfExpress`, que busca exactamente un archivo `POL-..._IMPRIMIR.pdf` en la carpeta privada y devuelve sus bytes codificados **solamente al backend que conoce la clave HMAC**. La Central expone `GET /admin/api/central/polaroid-pdf?reference=...`, autenticado por `DEMO_ADMIN_KEY`, bloqueado por defecto y permitido únicamente si D1 verifica: compra ligada, pago total aprobado, `payment_id`, `preference_id`, sin devolución, renglón Polaroids concordante y hash SHA-256 de los bytes que llegan desde GAS. El botón del panel solicita el PDF autenticado y descarga una copia local para el operador. No hay enlaces públicos a Drive ni entrega del PDF imprimible al comprador.
5. **Recuperación en el teléfono.** El editor guarda una copia temporal de **sólo los recortes JPEG optimizados** en IndexedDB del navegador, no las fotos originales. Puede recuperar durante **dos horas** un envío Express cuyo POST se interrumpió o cuya pestaña se recargó **después de preparar los recortes**. Muestra un botón para reintentar sin volver a seleccionar fotos, y otro para descartar. Para reintentar exige de nuevo consentimiento y Turnstile. Conserva la misma referencia, que GAS y D1 procesan de modo idempotente. El navegador elimina la copia cuando el servidor confirma el pedido o cuando el cliente la descarta. Una copia vencida se purga en el siguiente acceso; no hay eliminación instantánea si el navegador permanece cerrado.
6. **Seguridad del editor.** Se corrigió un error de presentación que podía borrar el casillero de consentimiento y el espacio de Turnstile al mostrar la descripción de Express. Además, como el carrito anterior aún no conoce los recibos Express de D1, ahora se **impide agregar estos pedidos al carrito heredado** hasta integrar el checkout definitivo. Ningún precio ni recibo declarado por el navegador autorizan pagos.

### Variables adicionales apagadas por defecto

- Worker de fotos Express: `EXPRESS_CENTRAL_SYNC_ENABLED=PRIVATE_TEST_ONLY`, `CENTRAL_BRIDGE_KEY`, `CENTRAL_EXPRESS_URL` apuntando exclusivamente a `/internal/central/polaroid-stage` en `saber-pagos-pruebas.*.workers.dev`.
- Worker de Central: `CENTRAL_EXPRESS_ENABLED=PRIVATE_TEST_ONLY`, `CENTRAL_EXPRESS_PREPARE_ENABLED=PRIVATE_TEST_ONLY`, `CENTRAL_EXPRESS_DOWNLOAD_ENABLED=PRIVATE_TEST_ONLY`, `EXPRESS_DOWNLOAD_SCRIPT_URL`, `EXPRESS_DOWNLOAD_HMAC_KEY`. Su clave HMAC de descarga tiene que coincidir con `EXPRESS_PDF_HMAC_KEY` del receptor GAS, y ser distinta de las claves de Central/pagos.
- Todos los valores son **interruptores de un entorno privado de ensayo**, no autorizaciones para publicar. La configuración actual de `recepcion-config.json` sigue con `enabled:false`, `showInShop:false`, `rollout:PENDIENTE_DE_APROBACION`, sin `delivery` activo. No se escribieron secretos en GitHub.

### Pruebas automáticas

- `tests/polaroids-express-worker.test.mjs`: generación de PDF por pedido, confirmación GAS simulada, HMAC hacia Central, duplicados y rechazo de host/Turnstile.
- `tests/central-polaroids-express.test.mjs`: SQL local D1 real (SQLite), recepción única, privacidad, orden mixta, precios, idempotencia y bloqueo de checkout.
- `tests/central-polaroids-descarga.test.mjs`: PDF real generado con pdf-lib, acceso operador, rechazo de compra impaga, devolución, desvío de Google y hash modificado.
- `tests/polaroids-express-guardado.test.mjs`: Apps Script simulado, lectura privada firmada y comprobación integral del PDF.
- `tests/polaroids-express-recuperacion.test.mjs`: IndexedDB simulado, recuperación tras recarga, caducidad a dos horas, bloqueo de otro pedido no confirmado, limpieza y privacidad.
- `tests/polaroids-express-cliente.test.mjs`: navegador simulado, reintentos, captura de recortes solamente y bloqueo de carrito anterior.
- El workflow `polaroids-express-ensayo.yml` compila el Worker, ejecuta esta suite y también regresiones del carrito y de documentos. No efectúa despliegues, llamadas reales a Google ni pagos.

### Límites pendientes antes de presentar esto a clientes

- **No se conectó a Google Drive real**, no se habilitaron claves de Cloudflare ni se imprimió un PDF Express de un pedido real.
- La recepción sigue siendo **un POST único de recortes optimizados**, no reanudación parcial del envío en el servidor. El respaldo local permite repetir el POST tras una recarga, pero no retomar el byte exacto en el que se cortó. Si se cierra antes de terminar la optimización inicial, no hay recortes completos que recuperar.
- La operación de descarga privada GAS entrega el PDF completo en una respuesta Base64 de hasta 12 MiB de PDF; su rendimiento y compatibilidad con límites reales de Apps Script/Cloudflare **aún no están comprobados**.
- La creación de pedidos Express todavía no está conectada a un **carrito unificado de cliente ni al cobro sandbox**. El botón para continuar al carrito heredado permanece bloqueado para no generar un pedido que se cobraría con datos inconsistentes.
- Los límites de CPU/memoria del plan Worker y la velocidad en teléfonos con 24 fotos reales deben medirse antes de autorizar un despliegue privado.
