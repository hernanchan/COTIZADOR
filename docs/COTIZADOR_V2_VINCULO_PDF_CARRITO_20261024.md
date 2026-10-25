# Cotizador V2 existente — PDF pendiente vinculado al trabajo del carrito

**24/10/2026 — Librería Saber — desarrollo privado, sin despliegue.**

## Criterio rector

Se conserva `main:cotizador-web-v2.html` como base comercial. No se reemplazaron los seis servicios, el motor de precios, los descuentos diarios/cupones ni el carrito existente. La rama `polaroids/express-pdf-unico-20261023` incorpora una mejora bajo **`?ensayoArchivos=1`**, desactivada por defecto. La vista pública sigue apuntando al cotizador de producción y no recibió cambios.

## Lo implementado

1. En el módulo existente **Imprimir documentos**, `cotizador-v2-ensayo-archivos.mjs` permite seleccionar un PDF de hasta 20 MiB y detecta su cantidad de páginas en el navegador, sin subirlo. Si no es válido, se puede escribir la cantidad manualmente; los servicios restantes no se modifican.
2. Al calcular, el archivo se vincula **al trabajo de impresión correspondiente**, mediante una referencia local única de UUID, nombre, bytes y páginas; con `estado:'PENDIENTE_DE_ENVIO'`, `recibido:false` y `verificadoServidor:false`. La asociación solo se realiza cuando las páginas cotizadas coinciden con las detectadas. La cotización y promociones continúan con el motor original.
3. Al agregar otro trabajo, cada renglón conserva su propia referencia. La vista de resumen muestra el nombre escapando el texto a través de `textContent`. Si se cambia de formulario, la selección anterior no se reutiliza por accidente.
4. Al enviar al carrito existente desde el iframe, la operación transmite exclusivamente **metadatos por `pdfDrafts` con `itemIndex`**; nunca el objeto `File`, bytes, secretos o identificadores privados de Google. La vista `vidriera/cotizar.html` acepta y almacena esos datos en `saberCartV1` únicamente en modo de ensayo. Rechaza estructuras con referencias repetidas, campos extra o falsos estados de recepción. El mensaje de pedido distingue que el PDF aún está pendiente de envío.
5. Si `ensayoArchivos` no está activado, se mantiene el contrato antiguo del carrito: `name,price,qty,detail,deposit`, sin nuevas referencias en los pedidos reales.

## Límites explícitos

**Esta mejora todavía no sube los PDF.** Al salir del iframe, el navegador conserva la asociación declarativa, pero **no los bytes del archivo** en `localStorage`. Para transmitirlo al backend hará falta reelección por el cliente o un transporte privado temporal expresamente diseñado. El `localRef` y las páginas locales **no son recibos confiables para calcular, pagar ni producir**. El servidor debe recuperar el archivo real, cotejar contenido y SHA-256, confirmar las páginas, rehacer el presupuesto y vincular cada recibo autenticado con el renglón antes de abrir el flujo de pago. No usar un mero nombre de archivo como comprobante de recepción.

El lector de pruebas usa una biblioteca `pdf-lib@1.17.1` cargada desde CDN; para lanzamiento debe empaquetarse/localizarse con fijación de versión y política de recursos. Esta etapa tampoco habilita pago, Drive o Central D1 para este flujo del cotizador V2.

## Evidencia

`tests/cotizador-v2-archivo-optin.test.mjs` comprueba que, al revertir los puntos de extensión, el **hash Git del cotizador original coincide exactamente** con `main` (`4bb9c519f0df5efea6c1e9bd3eff3f96fbed759e`). Prueba lectura de PDF real, corruptos, protección de la entrada manual, cambios rápidos y formulario.

`tests/cotizador-v2-referencias-carrito.test.mjs` verifica asociación de dos PDF a índices diferentes del mismo pedido, unicidad, flujo del carrito, rechazo de estructuras manipuladas y preservación del carrito antiguo sin el indicador de ensayo.

**GitHub Actions aprobadas:** https://github.com/hernanchan/COTIZADOR/actions/runs/40149167495. Todos los demás trabajos de CI (Central D1, GAS simulado, Worker documental, Polaroids Express) concluyeron también sin fallas.

**Próximo criterio de aceptación** (sin cambiar de estrategia): conectar una selección de archivo real al receptor privado mediante sesión autenticada; confirmar bytes/páginas/precio en servidor y únicamente entonces convertir `PENDIENTE_DE_ENVIO` en **recibo verificado** de ese mismo renglón. También se necesita prueba visual en PC y celular antes de habilitarlo al público.


## 24/10/2026 — Huella SHA-256 y recepción privada de referencia

El cotizador V2 opt-in ahora calcula una **huella SHA-256 del archivo original**, en memoria del navegador, durante la lectura del PDF. El carrito conserva por renglón `localRef, nombre, bytes, páginas, sha256` y los estados inequívocos `PENDIENTE_DE_ENVIO, recibido:false, verificadoServidor:false`. La tienda comprueba un esquema exacto y no admite campos extra, identificadores de Drive, secretos ni banderas falsas de recepción. El HTML original continúa idéntico cuando se revierten los puntos de extensión; tarifas y promociones no fueron modificadas.

Se añadió `integraciones/autocotizador/recepcion/subir-vincular-pdf-v2-privado.mjs`: **cliente de prueba, no conectado a la web de producción**. Al reseleccionar un archivo, coteja bytes y SHA-256 con la referencia que ya estaba en el carrito **antes de cualquier subida**. Inicia una sesión de Google Apps Script detrás de `/api/ensayo-pdf-ampliado` (Turnstile), consulta el estado de bloques y transfiere únicamente los faltantes en fragmentos de 512 KiB. Finalizada la carga, exige confirmación del recibo y consulta `/api/ensayo-vincular-pdf-v2`, que vuelve a verificar **en el Worker** el archivo alojado en Drive, cantidad de páginas y SHA-256, y cruza todo con la referencia local. La sesión se limita a una conexión HTTPS **same-origin** del Worker y las claves de sesión no se escriben en `localStorage` ni se devuelven como parte de la referencia confirmada.

`integraciones/autocotizador/recepcion/verificar-vinculo-cotizador-v2.mjs` es la verificación estricta del backend: la coincidencia requiere `localRef` UUID válido, recibo `DOC-` autenticado, pedido `WEB-`, modo B/N o color, tamaño, nombre seguro, `fileId` derivado del hash, páginas, huella y estado de Google `verified/storageVerified/pageVerification:server`. El endpoint **`POST /api/ensayo-vincular-pdf-v2`** requiere **ambos interruptores privados**: `DOCS_V2_RECEIPT_LINK_ENABLED=PRIVATE_TEST_ONLY` y `DOCS_EXTENDED_RECEIVER_ENABLED=PRIVATE_TEST_ONLY`, además de `DOCS_ALLOWED_ORIGIN` (mismo origen) y token de sesión del receptor GAS. Están apagados por defecto y **no se configuraron remotamente**.

El recibo final del ensayo se denomina `RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO`: **no está asociado a un manifiesto comercial de D1, no recalcula el precio y NO habilita cobro, producción ni descarga**. Esto es deliberado: la prueba de lectura local no sustituye los precios y descuentos de la cotización comercial ni autoriza alterar el total del carrito. En la próxima integración el backend deberá recontar páginas y cotizar contra el catálogo vigente, vincular un identificador persistente del renglón con el comprobante seguro y conservar estados mediante un flujo autenticado en el servidor. No se deben considerar válidos recibos recibidos de `localStorage` sin nueva verificación en backend.

**Limitación importante del despliegue:** la vista actual `vidriera/cotizar.html` carga el cotizador desde GitHub Pages en un iframe y el Worker privado exige **mismo origen**. Por seguridad **no se abrió CORS ni se configuraron dominios o claves nuevas**. Por tanto, el módulo de transporte está preparado y probado, pero todavía **no se puede activar desde la interfaz comercial vigente**. Para un ensayo real hay que servir el formulario y la recepción desde un origen privado coherente o introducir un puente autenticado de dominio propio aprobado. No está probado Cloudflare↔Apps Script/Drive remotos en esta etapa.

**Pruebas reproducibles:** `tests/cotizador-v2-archivo-optin.test.mjs`, `tests/cotizador-v2-referencias-carrito.test.mjs`, `tests/cotizador-v2-vinculo-servidor.test.mjs` y `tests/cotizador-v2-subida-vinculo.test.mjs` cubren lectura de PDF real, dos ítems independientes, chequeo de hash, carga y reanudación simuladas de dos bloques, comparación contra recibo del servidor, rechazos de archivo/recibo/precio falsos, aislamiento de origen y desactivación de pagos. Corrida aprobada de GitHub Actions: https://github.com/hernanchan/COTIZADOR/actions/runs/40149850015.

No se modificaron `main`, Cloudflare remoto, GAS instalado, pagos o `libreriasaber.com.ar`. No se generaron gastos.
