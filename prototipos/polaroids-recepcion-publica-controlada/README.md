# Polaroids Saber · Receptor controlado (no publicado)

**Estado al 15/10/2026:** código preparado y verificado mediante simulaciones; **NO hay recepción pública activa**.
La web `libreriasaber.com.ar`, la rama `main` y la aplicación privada que ya generó 14 archivos permanecen intactas. No se utiliza Cloudflare R2.

## Componentes

- `Code.gs`: nuevo proyecto de Google Apps Script, **separado** del piloto privado de Librería Saber.
- `Bridge.html`: canal de mensajes desde el editor en Cloudflare Pages. Solo acepta el origen explícito y un nonce aleatorio de sesión.
- `../../vidriera/pruebas/polaroids/editor.html`: prepara las fotos, solicita Turnstile, envía las imágenes y espera confirmación del PDF.
- `../../vidriera/pruebas/polaroids/recepcion-config.json`: configuración pública, actualmente `enabled: false` y sin URL ni clave de sitio.

**Nunca publicar el Code.gs del proyecto privado como «Cualquiera»**: contiene funciones de gestión de pedidos. El receptor público nuevo incluye únicamente funciones de recepción y cada una valida permisos, cuotas y claves.

## Comportamiento previsto

1. El cliente selecciona **de 1 a 10 hojas** A4, con seis Polaroids por hoja (6 a 60 fotos), las encuadra y acepta su envío.
2. Cloudflare Turnstile verifica la sesión; Apps Script comprueba el token en el servidor, el hostname exacto y la acción `polaroids`.
3. Apps Script crea una referencia `POL-<24 hex>` apta para carrito y WhatsApp y devuelve una clave privada de carga `<64 hex>`, independiente de la referencia. El servidor conserva solo el hash de la clave; el editor nunca la comunica al carrito.
4. Se suben secuencialmente fotos originales JPG o PNG de hasta 5 MB y recortes de imprenta JPEG 886×886. Cada hoja genera su PDF privado A4 con guías de guillotina. Una hoja: `POLAROIDS_A4_6_FOTOS_IMPRIMIR.pdf`; varias: `POLAROIDS_A4_HOJA_01_DE_10.pdf`, etc.
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

## Acciones necesarias ANTES de la prueba real

**Requieren autorización e inicio de sesión del dueño, no realizadas todavía.**

1. Desde el perfil de Chrome **Polaroids Saber**, crear un proyecto Apps Script **nuevo**, bajo la cuenta dedicada, con los archivos `Code.gs` y `Bridge.html`. No modificar el Apps Script privado existente.
2. En el panel de Cloudflare, crear un widget gratuito Turnstile restringido exactamente al dominio de **pruebas** y conservar la sitekey pública y la secret key privada. No activar servicios pagos.
3. En las propiedades del nuevo Script cargar `PUBLIC_ENABLED=no`, `RECEIPT_FOLDER_ID` (la misma carpeta privada configurada en el piloto), `TURNSTILE_SECRET` (nunca en GitHub) y `TURNSTILE_HOSTNAME` (hostname del dominio de pruebas). Autorizar los permisos de Google solicitados.
4. Crear implementación web separada ejecutada **como propietario**, acceso «Cualquiera» únicamente cuando sea posible dejar el servidor apagado con `PUBLIC_ENABLED=no`; comprobar primero que su URL muestra «Recepción de clientes deshabilitada».
5. Registrar la URL de implementación en `recepcion-config.json`, la sitekey en ese mismo archivo; mantener `enabled:false` hasta que se autorice explícitamente la prueba controlada.
6. Verificar la rama de pruebas en Cloudflare Pages; validar el iframe intermedio de Google, Turnstile, una carga de seis fotos ficticias, una de varias hojas, PDF privado y carrito; recién después decidir apertura al público. **No publicar cambios en main ni en libreriasaber.com.ar**.

## Estado de validación

- Verificada la sintaxis del receptor y del editor; comprobado con simulaciones que el receptor puede recibir **60 fotografías** y crear **10 PDFs** y un `encuadres.json`. Comprobado el reintento idempotente y la ausencia de URL pública en las respuestas.
- El panel privado reconoce pedidos de una y diez hojas y calcula $3.000 por hoja y 50 % de seña; los enlaces al PDF solo aparecen cuando se confirma la seña en el panel.
- El editor pasó pruebas simuladas de envío de seis y de sesenta fotos y recuperación tras una interrupción.
- **PENDIENTE:** prueba real del nuevo Apps Script expuesto de forma controlada, autenticación en Cloudflare Turnstile, comunicación cross-origin y permisos efectivos. No confundir pruebas simuladas con operación en producción.

## Precios y pagos

Precio regular: **ARS 3.000 por hoja**, sin promociones. El carrito admite artículos de librería y trabajos de gráfica. El pedido de WhatsApp puede iniciarse antes de pagar; se imprime solamente tras confirmación de **seña del 50 %**. La versión de pruebas sigue sin enviar WhatsApp real.
