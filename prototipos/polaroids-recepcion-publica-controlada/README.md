# Polaroids Saber · Receptor controlado (piloto aislado)

**Estado al 16/10/2026:** receptor de Google desplegado; prueba real de seis fotos completada. La recepción desde el editor se encuentra **pausada en la rama de pruebas** y aún no hay lanzamiento comercial.
La web `libreriasaber.com.ar`, la rama `main` y la aplicación privada que ya generó 14 archivos permanecen intactas. No se utiliza Cloudflare R2.

## Primera recepción real completada — 16/10/2026

**Prueba aprobada por el dueño:** desde el editor público de pruebas se enviaron **6 fotografías** y Google confirmó la referencia `POL-664B0B45776E023B08D43F46`. Se verificó manualmente en el Drive privado que la carpeta del pedido contiene **14 archivos** (6 originales, 6 recortes JPEG, `encuadres.json`, PDF de impresión A4) y que **el PDF se ve correctamente**. Se probó el camino real navegador → Cloudflare Pages Function → Apps Script → Drive, no únicamente simulaciones.

**Estado tras la prueba:** `recepcion-config.json.enabled=false`. La API Cloudflare `functions/api/polaroids-receiver.js` se actualizó para consultar también el mismo interruptor del servidor mediante `env.ASSETS.fetch` y **rechazar envíos si está desactivado**. Se comprobó con simulaciones que devuelve 503 cuando el interruptor está apagado o falta el servicio de assets. Falta validar la publicación de esa modificación en Cloudflare; **Google Apps Script sigue con `PUBLIC_ENABLED=yes` hasta que su propietario lo desactive**, por lo tanto no tratar el corte del front-end como una desactivación total del endpoint de Google.

Próxima etapa: validar un pedido real de última hoja incompleta (por ejemplo 17 fotos) y después integrar/validar el carrito, la seña y el acceso privado del dueño a PDFs. **No publicar en la web productiva** sin completar esas comprobaciones y resolver la política de conservación y borrado de fotos.

## Componentes

- `Code.gs`: nuevo proyecto de Google Apps Script, **separado** del piloto privado de Librería Saber.
- `Bridge.html`: canal de mensajes desde el editor en Cloudflare Pages. Solo acepta el origen explícito y un nonce aleatorio de sesión.
- `../../vidriera/pruebas/polaroids/editor.html`: prepara las fotos, solicita Turnstile, envía las imágenes y espera confirmación del PDF.
- `../../vidriera/pruebas/polaroids/recepcion-config.json`: configuración pública, actualmente `enabled: false`, con URL del receptor y clave pública Turnstile configuradas.

**Nunca publicar el Code.gs del proyecto privado como «Cualquiera»**: contiene funciones de gestión de pedidos. El receptor público nuevo incluye únicamente funciones de recepción y cada una valida permisos, cuotas y claves.

## Comportamiento previsto

1. El cliente selecciona **de 1 a 60 fotografías** distribuidas automáticamente en una a diez hojas A4 (hasta seis por hoja), las encuadra y acepta su envío.
2. Cloudflare Turnstile verifica la sesión; Apps Script comprueba el token en el servidor, el hostname exacto y la acción `polaroids`.
3. Apps Script crea una referencia `POL-<24 hex>` apta para carrito y WhatsApp y devuelve una clave privada de carga `<64 hex>`, independiente de la referencia. El servidor conserva solo el hash de la clave; el editor nunca la comunica al carrito.
4. Se suben secuencialmente fotos originales JPG o PNG de hasta 5 MB y recortes de imprenta JPEG 886×886. Cada hoja genera su PDF privado A4 con guías de guillotina. Si la última está incompleta, se genera el PDF con las fotos recibidas y los demás espacios quedan sin imagen. Una hoja: `POLAROIDS_A4_N_FOTOS_IMPRIMIR.pdf` (N = 1 a 6); varias: `POLAROIDS_A4_HOJA_01_DE_10.pdf`, etc.
5. La carpeta `PEDIDO_POL-...` contiene originales, recortes, `encuadres.json` y los PDFs. La referencia se considera **recibida** y se transfiere al carrito únicamente cuando finalizó toda la recepción.
6. El panel privado, al actualizar su código, mostrará las hojas, PDFs, precio total y seña del 50 %. La impresión queda condicionada a confirmar la seña manualmente.

Las operaciones `uploadPublicPhoto` y `finishPublicOrder` admiten reintentos tras perderse una respuesta, sin duplicar intencionalmente fotografías ni PDFs. La clave de carga solo existe en memoria: **no se recupera si se cierra o recarga el navegador**.

## Límites iniciales de seguridad

- Hasta 10 hojas por pedido, máximo 8 inicios de pedido al día y 240 fotografías subidas diariamente, siempre sujeto a 250 MB combinados (originales + recortes) por día.
- Cada original y recorte: máximo 5 MB. Caducidad de la sesión de carga: 24 horas.
- El servidor rechaza peticiones si `PUBLIC_ENABLED` no es `yes`, faltan secretos, Turnstile no verifica, las firmas o dimensiones son inválidas, o Drive no es privado.
- No se entregan identificadores ni enlaces públicos de Drive.
- El estado técnico de órdenes de más de 14 días puede limpiarse de Script Properties, **pero las fotografías NO se borran automáticamente**. Se requiere definir con el usuario una política de retención antes de atender a clientes reales.
- Estas cuotas son defensivas y de prueba; no equivalen a una garantía de capacidad comercial. Google Apps Script y Drive tienen límites propios.

## Acciones para retomar la prueba real (16/10/2026)

**Se identificó un bloqueo en el iframe de Apps Script que coincide con incidentes conocidos de Google durante 2026.** El enlace /exec sí muestra «Recepción protegida de fotografías» en incógnito. Se abandona el iframe y se usa un endpoint `doPost` con JSON de origen autenticado (sin CORS) más una consulta JSONP estrictamente **de solo lectura** y autenticada con la clave de pedido; no se expone información de Drive ni secretos en la respuesta.

1. El propietario actualiza el archivo **Code.gs** del proyecto **POLAROIDS SABER - RECEPCIÓN CLIENTES** con la versión completa en esta rama. **Bridge.html** puede permanecer sin cambios: ya no se usa.
2. En Apps Script el propietario debe elegir **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar** para actualizar el mismo /exec.
3. En la rama de pruebas `recepcion-config.json` permanece **`enabled:false`** hasta que se confirme que la nueva versión se implementó; luego activar exclusivamente esta rama.
4. El editor realiza automáticamente una consulta JSONP `api=ping` antes de solicitar fotos; si el servidor sigue usando la versión vieja o hay un bloqueo no deja continuar con los envíos. Respuesta esperada: `{ok:true,apiVersion:"v2-noframe"}`.
5. Con Turnstile y consentimiento, subir solo **seis fotos ficticias**; verificar cada original, recorte y PDF en Drive privado y la referencia de pedido. Repetir un caso de 17 fotos solo después de que funcione el de seis.
6. Confirmar la gestión en el panel privado, la política de retención de fotos y el flujo de depósito antes de abrir ventas reales. No tocar `main` ni la web pública.

**Seguridad:** la operación de inicio exige Cloudflare Turnstile validado en servidor; las operaciones posteriores exigen referencia aleatoria y clave de carga secreta de 256 bits; JSONP solo consulta conteos/estado y no modifica pedidos ni retorna ninguna clave. No se creó infraestructura paga. La clave secreta de Turnstile permanece únicamente en Script Properties.

## Estado de validación

- Verificada la sintaxis del receptor y del editor; comprobado con simulaciones que el receptor puede recibir **60 fotografías** y crear **10 PDFs** y un `encuadres.json`. Comprobado el reintento idempotente y la ausencia de URL pública en las respuestas.
- El panel privado reconoce pedidos de una y diez hojas y calcula $3.000 por hoja y 50 % de seña; los enlaces al PDF solo aparecen cuando se confirma la seña en el panel.
- El editor pasó pruebas simuladas de envío de seis y de sesenta fotos y recuperación tras una interrupción.
- **SUPERADO:** prueba real con seis fotos, Turnstile, transmisión desde Cloudflare al servidor Google y PDF recibido en Drive privado.
- **PENDIENTE:** comprobación real de 17 fotos/última hoja incompleta, integración de carrito y panel privado, retiro/retención de fotos, publicación de la nueva protección de bloqueo del proxy en Pages y eventual puesta en producción.

## Precios y pagos

Precio regular: **ARS 3.000 por hoja**, sin promociones. El carrito admite artículos de librería y trabajos de gráfica. El pedido de WhatsApp puede iniciarse antes de pagar; se imprime solamente tras confirmación de **seña del 50 %**. La versión de pruebas sigue sin enviar WhatsApp real.

## Carga múltiple y última hoja incompleta (16/10/2026)

- En la rama de pruebas se pueden elegir **hasta 60 fotos juntas**. El editor las reparte de seis en seis en hojas A4.
- Con **17 fotos**, aparecen tres hojas y un aviso explícito: **agregar una foto** para llegar a 18 o **continuar con 17**. Si continúa con 17, se factura **3 × ARS 3.000 = ARS 9.000**, se transmite el número real (17), y el último PDF contiene cinco fotos (sin imagen inventada en el sexto lugar).
- Los ejemplos 1, 5, 6, 7, 12, 17, 18, 59 y 60 pasaron pruebas de reglas de conteo, confirmación y facturación en el código. PDF de 1, 5 y 6 fotos: estructura y referencias internas comprobadas con JPEG simulado. La prueba real anónima sigue pendiente.
- Se actualizaron **editor**, **cotizador**, **Code.gs del receptor** y **panel privado de gestión (solo código de GitHub)**. Ninguna versión instalada en Apps Script se actualiza automáticamente desde GitHub.
- Próximo paso para prueba real: actualizar manualmente el proyecto Apps Script **POLAROIDS SABER - RECEPCIÓN CLIENTES** con el Code.gs de esta rama y crear una nueva versión de la implementación, manteniendo inicialmente `PUBLIC_ENABLED=no`. El proyecto de panel privado sigue separado.
