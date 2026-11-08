# R2: cotización local; cobro antes de subir — decisión del propietario 07/11/2026

## Objetivo económico
El propietario habilitó Cloudflare R2 con tarjeta, pero **no autoriza que el simple uso del cotizador cargue archivos al bucket ni genere almacenamiento facturable sin una venta confirmada**. Caso habitual: PDF de 100–150 MB A1 para conocer su precio.

## Recorrido comercial aprobado como requisito (NO desplegado)
1. El cliente selecciona el PDF en el navegador. El archivo **permanece en el teléfono/PC**; leer páginas/medidas por File.slice + PDF.js local. Sólo enviar al servidor metadatos mínimos necesarios para calcular tarifas, no bytes ni fragmentos ni miniaturas.
2. Mostrar **presupuesto preliminar**. Para ploteos grandes, el modo CAD/Póster debe establecerse de modo confiable o preguntarse al cliente como declaración provisional, con revalidación técnica posterior; sin certidumbre no cobrar como precio definitivo.
3. El cliente decide pagar. El servidor crea pago **por el importe presupuestado**; Mercado Pago se verifica a través de webhook y consulta autenticada o transferencia con **acreditación bancaria real confirmada**. Ni el checkout creado ni el redirect del navegador equivalen a pago.
4. **Recién con pago confirmado y conciliado en Central D1**, una autorización de servidor vinculada a orden, importe ARS y pago no revertido habilita la recepción R2. No confiar en flag de JavaScript ni payload `paymentAuthorized` del cliente.
5. Tras la carga, SHA-256 y páginas/medidas se recalculan en servidor. Ante discrepancia entre presupuesto preliminar y datos reales, **no imprimir** ni aplicar cargo adicional sin nueva autorización; definir procedimiento claro de diferencia (preferible corrección y devolución si no se acepta nueva cotización).
6. Pedido pagado y PDF íntegro verificado: activar la Central, preparar copia de preprensa si es pesada y entregar. **Borrado de original y copias después de entregado**, cuota liberada y aborto/limpieza de multipart incompletos.

## Cotizador local para PDF grandes: lectura por fragmentos validada
- `medidas-pdf-file-local-rangos.mjs`: usa `File.slice()` en el navegador, no `file.arrayBuffer()` completo para PDFs >40 MiB; acoplado a `medidas-local-pdf.mjs`.
- `carga-unica-cliente.mjs`: para ploteos >40 MiB evita el clasificador visual que carga/rasteriza el PDF entero. El comprador debe elegir **CAD o Póster** para ver una cotización orientativa sin subir el PDF; se informa expresamente que luego habrá validación técnica. La pantalla de pedido privada continúa bloqueando >40 MiB hasta conectar compra postpago; **no se habilitó recepción incompleta**.
- Ensayo [Actions 42384272965](https://github.com/hernanchan/COTIZADOR/actions/runs/42384272965) **SUCCESS**: PDF sintético A1 **150 MiB**, `File.slice` **dos fragmentos, 131.072 bytes (128 KiB)**, dimensión 59,4 × 84,1 cm, **sin llamada a R2** ni `file.arrayBuffer()` completo.
- Regresión integral Worker/TUS [42384272999](https://github.com/hernanchan/COTIZADOR/actions/runs/42384272999) **SUCCESS**. Cambios en rama GitHub únicamente; no se desplegó a `saber-documentos-pruebas` ni a `libreriasaber.com.ar`.
- El cotizador local **no valida composición CAD/Póster de forma autoritativa**: la selección es una declaración del cliente, y no se habilita una compra real hasta completar reglas de diferencias/reembolso y verificación del backend. Cerrar este punto antes de comercialización.

## Guardia de costo YA implementada en rama de ensayo
- `integraciones/autocotizador/recepcion/r2-recepcion-solo-pagada.mjs` valida exclusivamente comprobante normalizado **emitido por backend Central**: misma orden, pago aprobado, `ARS`, monto positivo, fuente `CENTRAL_D1_RECONCILED`, verificación de MP/Banco, no reversión ni devolución, verificación reciente (≤300 s).
- `r2-pdf-grandes-api-privada.mjs` rechaza `/iniciar` antes de reservar cuota o invocar `createMultipartUpload`, y vuelve a comprobar pago antes de `/parte`, `/completar` y `/verificar`.
- Nuevo flag obligatorio `DOCS_R2_POSTPAY_REQUIRED=PRIVATE_TEST_ONLY` **no habilitado** en Worker desplegado. Sin él no se acepta R2 (HTTP 503). Aunque alguien active el flag manualmente, la API usa `comprobarPagoCentral=async()=>null` por defecto: **falla cerrada, HTTP 402**. El Worker real aún **NO** pasa un verificador de Central D1, por lo que no es posible subir PDFs mediante esta ruta comercial. Es intencional para proteger de gastos hasta terminar la conexión del pago.
- Nuevas pruebas `tests/r2-recepcion-solo-pagada.test.mjs` verifican pago pendiente, redirect, moneda incorrecta, reversión, devolución, falta de verificador, flag apagado, cobro por transferencia acreditada y revocación antes de subir partes. [CI 42383868839](https://github.com/hernanchan/COTIZADOR/actions/runs/42383868839) **SUCCESS**.
- **No se modificó `main`, sitio público, pagos reales, configuración R2, bucket ni variables Cloudflare.** Esta regla está escrita y probada sólo en GitHub, no activa en el entorno desplegado.

## Decisiones técnicas pendientes (bloquean publicar el NUEVO cotizador)
- Usar análisis realmente local por rangos en móvil para PDFs grandes, sin `file.arrayBuffer()` completo ni doble rasterización CAD/Póster.
- Preparar desde cliente un resumen para cotizar, y persistir provisionalmente el pedido/importe sin original.
- Integrar Central/MP: conciliación de pago y comprobante del servidor para desbloquear R2, con TTL de revalidación, pedido vinculado, cuota y límites.
- Subida TUS/R2 por tamaño **sólo después del pago** si se decide extender la regla a TUS; hoy esta compuerta se aplica sólo a R2 (pedido explícito del propietario).
- Definir diferencias de precio y reembolso tras analizar originales.
- Probar cliente que **abandona presupuesto**: debe dejar **cero objetos nuevos y cero reservas R2**; cliente pago: un solo pedido con original íntegro y preprensa segura.
- Garantizar que ningún archivo impago de pruebas anteriores quede permanentemente en el bucket; inspeccionar y ajustar limpieza sin tocar objetos de pedidos activos.

**Importante:** `pagoAprobadoParaR2` valida el **formato** de la constancia server-side y NO consulta por sí solo Mercado Pago. Para habilitar bytes hace falta implementar la consulta firmada de Central de punta a punta; está expresamente pendiente. Los costos de las lecturas de precios/API y el servicio R2 si excede cuotas gratuitas no son necesariamente cero; la regla elimina el almacenamiento R2 causado por usuarios que sólo cotizan.


## 07/11/2026 — Verificación real por servidor Central D1 ANTES de crear un objeto R2

**Nuevos módulos en la rama de ensayo:**
- `integraciones/mercadopago/pruebas/r2-pago-verificado-central.mjs`: ruta interna `POST /internal/central/r2-payment-lookup`, verificada con `centralReadSigned` (HMAC ya existente entre Workers), **sólo lectura D1**.
- El permiso exige una intención de compra previa `central_r2_prepaid_intents` vinculada por **webOrderId + fileId + SHA-256 + bytes + commercialOrderId + importe**. Luego comprueba pedido `paid`, cobro total, `payment_reviews.state='verified'`, datos de Mercado Pago o acreditación bancaria válida. Ningún pago de otro pedido autoriza subir un PDF distinto.
- `integraciones/autocotizador/recepcion/r2-confirmar-pago-central.mjs`: puente de Documentos a Central por Service Binding y HMAC, valida respuesta, orden, archivo, importe, firma, caducidad.
- `r2-pdf-grandes-api-privada.mjs` consulta la Central antes de reservar cupo R2 y en **cada parte** y cierre. La ruta de Documentos recibe este comprobador desde `worker-fase4-cotizador-unificado.mjs`; autenticación Basic del operador tampoco saltea la barrera.
- Nuevo control Central `CENTRAL_R2_POSTPAY_ENABLED=PRIVATE_TEST_ONLY`, y control Documentos `DOCS_R2_POSTPAY_REQUIRED=PRIVATE_TEST_ONLY`; **ambos apagados**. La tabla `central_r2_prepaid_intents` no fue creada ni poblada: lectura falla cerrada. **No se ha habilitado R2 comercial ni hay orden pagable prearchivo todavía**.
- [GitHub Actions 42402034253](https://github.com/hernanchan/COTIZADOR/actions/runs/42402034253) **SUCCESS**: pruebas negativas sin orden, pago pendiente/revocado, intención inexistente, cambio de hash/tamaño, firma inválida/host ajeno, transferencia sin acreditación; positivas MP y transferencia sintéticas. No es prueba de dinero real ni de D1 real de producción.

**Siguiente P0 sin vueltas:** crear el estado de *pedido presupuestado sin archivo* en D1, generar preferencia Mercado Pago sandbox por ese importe, enlazar el comprobante a `central_r2_prepaid_intents` sólo desde servidor y probar *cliente cotiza 150 MB local → paga sandbox → recibe permiso → carga R2 → verifica original → Central*. Diseñar cancelación/devolución si las páginas/tipo no coinciden luego. Sin este circuito no publicar ni activar los flags. **El cotizador gratis sigue sin tocar R2**.


## 07/11/2026 — FASE PREPAGO SIN ARCHIVO: backend implementado, pruebas aprobadas

**Paso 1: intención sin original**
- `r2-prepago-documentos.mjs`: nueva ruta privada `/prueba-v2/api/ensayo-r2-prepago`, requiere sesión de comprador/operador, Same-Origin y `DOCS_R2_PREPAY_DRAFT_ENABLED`, D1 aprobado y puente privado habilitados. Recalcula el importe **en el servidor** mediante `cotizarCargaUnica` y `obtenerTarifarioD1Privado`; **no acepta importe del cliente**. Inicialmente **un único PDF grande (>40 MiB y ≤200 MiB), únicamente ploteo**, precio preliminar y clasificación CAD/Póster declarada por cliente.
- `r2-prepago-intencion-central.mjs`: Central recibe **intención HMAC** y guarda en D1 `central_r2_prepaid_intents` y `orders` / `order_items` con SKU restringido `R2_PREPAID_PLOT`, **transacción DB.batch**, idempotencia por orden+archivo; **sin guardar bytes, sin crear bucket, sin Checkout MP en etapa de consulta**. No cobra ni imprime.
- El servidor asigna cookie vinculada a `webOrderId` para el comprador cuando la intención se registra, evitando que otra sesión reutilice la orden.
- Nuevo flag Central `CENTRAL_R2_PREPAY_DRAFT_ENABLED=PRIVATE_TEST_ONLY`, **OFF** por defecto.

**Paso 2: pago sandbox únicamente después de la decisión del comprador**
- `r2-prepago-checkout-sandbox-central.mjs` y `r2-prepago-checkout-documentos.mjs`: ruta `/prueba-v2/api/ensayo-r2-prepago-checkout`, sesión y orden vinculadas, HMAC entre Workers, orden y SKU exactos, importe íntegro registrado, 24 h de vigencia, sin transferencia pendiente. Reutiliza `/demo/checkout` existente que valida vendedor **test_user**; no habilita vendedor real.
- Nuevo flag Central `CENTRAL_R2_PREPAY_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY` y Documentos `DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY`, ambos **OFF**.
- Al pedir `status`, D1 distingue `pendiente`, `pagado_esperando_archivo`, `revocado`. **Aún no se ha ejecutado un pago real de sandbox con esta nueva orden**, sólo simulación de respuesta de la pasarela.

**Paso 3: no usar R2 antes de pago**
- Permanece la ruta R2 con **`DOCS_R2_POSTPAY_REQUIRED`** y validación HMAC a `CENTRAL_R2_POSTPAY_ENABLED`; contra D1 exige misma orden, archivo, bytes, SHA-256, importe y pago verificado.
- Prueba de contrato en [GitHub Actions 42413800991](https://github.com/hernanchan/COTIZADOR/actions/runs/42413800991): **SUCCESS**. Crea la intención simulada; dos intentos **sin pago** devuelven HTTP 402 y verifican **0 reservas, 0 objetos R2**; al simular pago conciliado en D1, inicia **1 multipart** R2 falso con cuota confirmada. No se enviaron PDFs ni se consumió almacenamiento R2 en esta prueba.
- Pruebas de checkout sandbox / precio D1 / integridad, regresión general TUS, R2 y Workers aprobadas en la misma ejecución. No se modificaron Workers desplegados, web comercial, `main` ni valores reales de Cloudflare.

**PENDIENTE P0 — NO PUBLICAR ESTO AÚN:**
1. Conectar **interfaz** del comprador para generar hash del PDF grande **por fragmentos** (sin cargar 150 MiB a RAM), conservar archivo en dispositivo durante MP y reanudar después de confirmar pago; integración de botones con el carrito.
2. Prueba de **pago sandbox real** creada desde intención sin archivo, conciliación webhook, luego carga **R2 real** desde móvil y verificación SHA de 100/150/200 MiB con orden en Central; actualmente se ensayó pago/R2 con mocks.
3. Validación de páginas, medidas y CAD/Póster *después de la carga* para conciliar **precio preliminar vs archivo real**. Sin coincidencia: poner en revisión y gestionar diferencia/devolución; **no imprimir** ni pagar un saldo automático.
4. Pedidos mixtos TUS+R2 y ZIP, hoja de trabajo, descarga, preprensa, borrado después de entrega y cuotas/aborto de multipart. Actualizar manifiesto Central hoy limitado a 40 MiB. No subir R2 para consultas ni adelantar cobros sin circuito de devolución.
5. Probar protección de peticiones, costo R2 real y presupuesto de operaciones con límite. La cuenta R2 ya existe pero ninguna de estas banderas se activó.

**Precisión económica:** no hubo despliegue ni uso de R2 en estos ensayos de lógica. GitHub Actions sí ejecuta minutos de CI sujetos al plan de GitHub; su eventual costo no fue verificado. Evitar ejecuciones redundantes.


## 07/11/2026 — Interfaz del comprador para ploteo 40–200 MiB, sin R2 antes del pago

**Implementación:** nuevos módulos \`sha256-pdf-local-fragmentos.mjs\` y \`r2-prepago-flujo-cliente.mjs\`; integrados al iframe de \`carga-unica-cliente.mjs\`, portal \`pantalla-cotizador-v2-prueba-privada.mjs\` y rutas del \`worker-fase4-cotizador-unificado.mjs\`. La build privada \`build:unificado\` ya compila el nuevo módulo \`r2-prepago-flujo-cliente.txt\` mediante \`build:v2-r2-prepago\`.

**Recorrido funcional implementado para ensayo (NO desplegado):**
1. Con la nueva bandera de UI compuesta habilitada, un **único PDF de ploteo** entre 40 y 200 MiB puede obtener presupuesto local sin pasar por el rechazo TUS. Los PDFs pequeños conservan el flujo TUS existente. No se admite mezclar ese ploteo grande con otros PDF todavía.
2. El botón actual «Enviar mi pedido» para ese caso **sólo calcula SHA-256 incremental de \`File.slice()\` (1 MiB por vez), cotiza desde el tarifario D1 aprobado en el servidor y crea la intención en D1**. Aún no abre Mercado Pago ni transmite PDF.
3. El cliente ve el **importe devuelto por el servidor**, puede aceptar y abrir un enlace de Mercado Pago **sandbox**. El precio preliminar jamás se envía como importe confiable ni se carga el archivo para consultar.
4. La pantalla consulta Central cada 25 segundos mientras espera, y al detectar \`pagado_esperando_archivo\` ejecuta \`enviarArchivoR2Grande\`. El Worker valida una y otra vez pago D1, sesión vinculada al pedido, archivo, SHA, bytes y cuota, **antes de crear multipart y antes de cada parte**. Se reforzó \`autorizadoIniciar\`: el login genérico del comprador no sustituye su cookie de orden vinculada.
5. El resultado sólo es \`sha256Verificado\`: todavía **no declara contenido clasificado, precio revalidado ni producción autorizada**. El mensaje indica que queda bajo revisión. Si falla la red, puede reintentarse el envío sin pagar otra vez mientras siga en la misma pestaña.

**CI:** [GitHub Actions 42415460295](https://github.com/hernanchan/COTIZADOR/actions/runs/42415460295) **SUCCESS** tras verificar contrato comprador (cero upload en consulta, cero R2 ante pago pendiente/revocado, un upload tras pago simulado), SHA incremental 150 MiB equivalente a Node crypto, regresiones TUS, build de Worker y rutas cerradas al faltar flags.

**PENDIENTES BLOQUEANTES PARA PUBLICAR:**
- Ejecutar prueba **en Cloudflare Workers sandbox desplegado** de intención sin original, preferencia **Mercado Pago test_user real**, webhook/consulta de acreditación, subida **R2 real** de 100–150 MB y validación SHA contra objeto realmente almacenado. El CI usa almacenamiento y pagos simulados.
- El comprador móvil que cierre/reinicie la pestaña **pierde el objeto File**. Hace falta reelección local segura del mismo PDF (comparar SHA, tamaño y orden) tras volver del pago, sin obligarlo a comprar otra vez.
- Revisar clasificación CAD/Póster y medidas **del PDF recibido** para conciliar con el presupuesto preliminar; gestionar diferencia o devolución si cambia el precio.
- Incorporar el R2 grande pagado a la **Central de Pedidos real**, con hoja de preprensa y ZIP de trabajo y limpieza del objeto al entregar; el staging actual aún no es orden imprimible.
- Falta validar navegador móvil con un PDF problemático real de 150 MB y cargas interrumpidas; el ensayo de SHA y transporte no equivale a esa experiencia.
- Control de consumo/cuotas/TTL, alarmas y cancelación automática de multipart huérfanos, antes de activar público.
- Las banderas de UI y cobro siguen **apagadas en Cloudflare**. Ninguna actualización en \`main\`, web pública, facturación real, bucket ni Worker comercial. No se generaron objetos R2 ni pagos reales para estas pruebas de código.


## 08/11/2026 — Corrección de recuperación al cerrar pestaña (código sin desplegar)

**Auditoría de la rama:** el commit de referencia `d1763e3427` coincidía exactamente con la punta de `integracion/tus-pedido-privado-20261101` antes de esta intervención. La rama siguió siendo la única destinataria de las modificaciones. No hubo operaciones sobre `main`, web pública, Workers, R2 real ni cobros.

**Cambios implementados:**
- `integraciones/autocotizador/recepcion/r2-prepago-flujo-cliente.mjs`: restauración de un prepago ya existente sin reiniciar el checkout; primero exige reelección del PDF y comprobación SHA-256 por fragmentos, luego consulta estado de Central, y sólo sube si el backend acredita pago y orden vinculada. Rechaza PDF distinto y datos de recuperación alterados.
- `integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs`: selector de recuperación visible tras recarga; almacenamiento local sólo de identificadores, importe, nombre, tamaño, cantidad de páginas, modo, SHA y fecha (sin contenido PDF, credenciales, cookie ni confirmación de pago). Caducidad local 24 h; elimina registro tras verificación íntegra o revocación.
- `tests/r2-prepago-flujo-cliente.test.mjs`: tres regresiones adicionales: recuperación del mismo archivo sin segundo checkout, rechazo de SHA diferente y rechazo de recuperación inválida.

**Commits:** `a57f6fc`, `19c7de4`, `98fdb17`, `8bb3100`.

**Evidencia local de lectura de código:** se cargaron los contenidos actuales de GitHub, se comprobaron sintácticamente el controlador y la página, y se ejecutaron las 7 pruebas del archivo mencionado con dobles simulados de fetch/MP/R2 y un ejecutor JavaScript aislado: **7/7 aprobadas**. Esto **no es** ejecución de GitHub Actions, ni prueba funcional de navegador, ni operación real de R2/MP.

**Límite de seguridad todavía P0:** `cotizador-cliente-publico.mjs` fija `ORDER_AGE=3600` (cookie de comprador, 60 minutos); la intención de pago se acepta durante hasta 24 horas. Aunque el navegador conserve metadatos 24 h, cuando la cookie expira el comprador no puede consultar/retomar la orden mediante las rutas protegidas. Requiere mecanismo de reautenticación **vinculado a la misma orden y al pago confirmado**, sin prolongar indiscriminadamente el acceso a otras órdenes. No considerar cerrada la recuperación móvil hasta pasar un ensayo real también después de ese vencimiento.

**Bloqueos posteriores para lanzamiento:** despliegue aislado y conciliación auténtica de Mercado Pago **sandbox** con webhook; carga a bucket R2 **real** y verificación SHA de 60, 100, 150 MiB y límite 200 MiB; revalidar medidas/páginas/CAD-Póster y diferencias de precio; salida operable en Central con ZIP e instrucciones/preprensa; cuotas, limpieza multipart y borrado seguro luego de Entregado. Banderas comerciales de R2 permanecen apagadas en el despliegue según última documentación; no se verificaron en vivo en esta intervención.


## 08/11/2026 — Recuperación con nueva sesión y protección contra reenvíos R2

**Hallazgo y corrección de seguridad:** la cookie de comprador normal dura 3.600 segundos y está vinculada a la orden de esa sesión. La intención prepaga puede ser válida 24 h. Extender el permiso genérico del comprador a 24 h permitiría ampliar innecesariamente todas las rutas: **no se hizo**.

- `cotizador-cliente-publico.mjs`: se agregó `saber_r2_continuar_v1`, vínculo por **una sola orden + ID comercial**, firmado en servidor, HttpOnly/Secure/SameSite=Strict, alcance de ruta `/prueba-v2/api/ensayo-r2` y caducidad máxima 24 h. **Exige una nueva sesión de comprador con Turnstile** antes de usarse; nunca concede acceso general a TUS, descargas privadas ni a otras órdenes.
- `worker-fase4-cotizador-unificado.mjs`: tras registrar una intención válida, genera las dos cookies de orden. Si falla el vínculo de recuperación, no habilita checkout al comprador. La recuperación sólo autoriza `action=status` del **mismo pedido** y los pasos de R2 de esa orden. `action=start` del checkout requiere vínculo vigente; **no se puede crear otro checkout por recuperación**. Cada parte R2 sigue requiriendo conciliación de pago firmada en Central D1.
- **Hallazgo funcional:** `paginaCotizadorTUSClientePruebas` no recibía el flag R2 (siempre apagado en vista comprador). Se corrigió el quinto argumento opcional, con `false` predeterminado, y se pasa `r2PrepagoUiConfigurado(env)` desde el Worker. La vista comprador sólo muestra R2 si las condiciones privadas se satisfacen.
- **Nueva barrera:** el flag de comprador R2 requiere `DOCS_R2_STAGING_ENABLED=PRIVATE_TEST_ONLY`; de otro modo no ofrece checkout de PDF grande sin recepción en Central.
- **Evitar costo por reenvío:** `r2-pdf-grandes-cliente.mjs` acepta `requireCentralStaging=true` para el circuito pago. Si SHA coincide pero no se confirmó `stagedForCentral`, conserva `sessionStorage` con multipart `completed=true` y da error `R2_CENTRAL_PENDIENTE`. Reintentar dentro de la vigencia del proof repite **sólo `/verificar`**, sin segunda `/iniciar`, partes ni `/completar`. Sólo borra el estado al confirmar Central. El transporte experimental previo mantiene su configuración anterior de manera explícita. `r2-prepago-flujo-cliente.mjs` exige confirmación Central antes de anunciar la carga recibida.

**Evidencia ejecutada en esta intervención (sin despliegue):**
- Autenticación de orden: 11 comprobaciones de lógica con HMAC simulado en ejecutor JavaScript, todas aprobadas (no es cripto de producción). Se agregó prueba real para Node con `node:crypto` en `tests/r2-recuperacion-comprador-orden.test.mjs`; el archivo NO se ejecutó en Node ni en Actions en esta intervención.
- Vista comprador: 3/3 pruebas simuladas aprobaron. `tests/r2-prepago-pantalla-comprador.test.mjs` registra regresiones de default OFF y flag ON.
- Transporte R2: 2/2 pruebas con fetch/storage simulados aprobaron, incluida confirmación posterior sin retransmitir partes; `tests/r2-cliente-no-duplicar-central.test.mjs`.
- Controlador de prepago: 8/8 pruebas con backend simulado aprobaron, incluida la negativa ante SHA válido pero falta de staging Central; `tests/r2-prepago-flujo-cliente.test.mjs`.
- Sintaxis del Worker unificado y módulos modificados evaluada sin errores en ejecutor aislado; NO equivale a build/CI ni prueba HTTP real.

**Limitación P0 aún abierta:** la persistencia de multipart se realiza en `sessionStorage` y el proof dura ~2 horas. Si se cierra completamente la pestaña después de completar R2, o vence el proof mientras falta la confirmación Central, este reintento corto deja de funcionar. La cuota D1 usa `UNIQUE(web_order_id,file_id)`, lo que debería impedir nuevas reservas con otra clave bajo la misma orden, pero **no se ha probado con D1 real** y tampoco resuelve recuperar el original ya subido. Falta recuperación desde servidor por referencia de orden, idempotente y sin nueva carga, además de limpieza de multipart incompletos.

**Otras condiciones de publicación sin cambios:** prueba real de web/cookie en Android, pago MP sandbox conciliado y R2 real (60, 100, 150 MiB; máximo anunciado a verificar 200 MiB), revalidación de tipo/medidas/páginas, diferencias/reembolsos, Central con paquete imprimible y preprensa, borrado al Entregado, cuotas/observabilidad y reversión. Los objetos que sólo tengan SHA válido deben permanecer como `awaiting_pdf_analysis`, nunca liberarse a producción sin inspección.

**Cambios sólo en rama de prueba de GitHub.** Sin cambios en `main`, desplegados, facturación, variables Cloudflare, bucket ni pagos reales.
