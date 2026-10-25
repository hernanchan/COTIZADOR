# Cotizador V2 original en entorno privado del mismo origen

**Librería Saber — rama** `polaroids/express-pdf-unico-20261023`, octubre de 2026. **No desplegado** en Cloudflare; GitHub Pages, `main`, `libreriasaber.com.ar`, Apps Script real y pagos sin cambios.

## Obstáculo que resuelve

El cotizador V2 existente funciona en GitHub Pages, pero el Worker de recepción exige que el navegador lo llame desde su **mismo origen** por razones de seguridad. Abrir CORS público no es una solución aceptable. En vez de reemplazar el cotizador, el Worker privado ahora puede servir **una copia empaquetada exacta del HTML V2** y los recursos necesarios, sin copiar ni modificar su motor comercial.

## Implementación comprobada

- `integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs`: portal privado; muestra el cotizador original V2 en un iframe del mismo origen, recoge únicamente `SABER_ADD_PRINT` procedente de **ese iframe** y de **ese origen**, conserva referencias PDF en memoria y permite seleccionar nuevamente cada archivo. No entrega el pedido a la tienda pública ni modifica `saberCartV1`.
- `integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs`: rutas **GET** `/prueba-v2/`, `/prueba-v2/cotizador`, `/prueba-v2/precios-web.json`, `/prueba-v2/cotizador-v2-ensayo-archivos.mjs` y `/prueba-v2/subir-vincular-pdf.mjs`. HTML, lector PDF, tarifas y cliente de carga se empaquetan con esbuild en el mismo Worker; `precios-web.json` sigue siendo el catálogo original del repositorio. Se excluyen los scripts de Google Analytics solamente de la copia de ensayo.
- El cliente de subida invoca por rutas relativas **same-origin** `POST /api/ensayo-pdf-ampliado` y `POST /api/ensayo-vincular-pdf-v2`; este último consulta Google por HMAC y coteja SHA-256 y páginas con el trabajo elegido. Las credenciales GAS, los bytes y los tokens no se escriben en el carrito. **El archivo pasa únicamente a estado «RECIBO_VERIFICADO_NO_CONCILIADO_CON_PRECIO»**: todavía no hay precio recalculado en servidor, pedido de D1 comercial ni habilitación de cobro.
- `integraciones/autocotizador/recepcion/package.json`: `build:unificado` prepara los módulos de navegador y empaqueta el HTML original mediante `--loader:.html=text`. Estos cambios sólo afectan la compilación privada; no agregan scripts ni rutas al sitio público.

## Seguridad para la futura prueba real

**Dejar apagado por defecto** `DOCS_V2_PRIVATE_UI_ENABLED`. Para habilitarlo en una prueba privada futura, además de la aprobación expresa del usuario, hace falta crear una **contraseña separada** en el secreto `DOCS_V2_PRIVATE_UI_SECRET` (32–128 caracteres ASCII `A-Z a-z 0-9 _ -`), distinta de los secretos HMAC de Central y de GAS. El Worker pide HTTP Basic `operador:<contraseña>` sobre HTTPS, responde HTTP 401 con desafío si falta la clave, y mantiene `Cache-Control: no-store`. No transportar contraseñas en URL ni en un enlace de usuario.

Además se mantienen los controles separados del receptor documental: `DOCS_EXTENDED_RECEIVER_ENABLED=PRIVATE_TEST_ONLY`, `DOCS_V2_RECEIPT_LINK_ENABLED=PRIVATE_TEST_ONLY`, `DOCS_ALLOWED_ORIGIN` exacto, `DOCS_TURNSTILE_SITE_KEY` y secret, HMAC `DOCS_RELAY_KEY` y receptor Google GAS **aislado**. Ninguno de esos controles se habilitó remotamente. Para una prueba en Cloudflare real se debe revisar asimismo la política de Cloudflare Access y el alcance del Worker **antes** de levantar las banderas, y comprobar que no exista ruta a `libreriasaber.com.ar` ni publicación de fotografías.

## Evidencia y alcance de la prueba

`integraciones/autocotizador/recepcion/v2-origen-privado.test.mjs` ejecuta el Worker real **compilado en Node** y confirma que:

- el portal empieza con HTTP 503; sin contraseña o con una incorrecta responde HTTP 401; no admite reuso de claves HMAC;
- las páginas y recursos originales del cotizador están disponibles en ese origen, sin requerir GitHub Pages, sin Analytics y sin perder el catálogo;
- **cada** HTML/JSON/JS está protegido por la misma autenticación, se rechazan métodos ajenos y el endpoint de verificación no puede activarse sin su interruptor;
- la pantalla valida `event.origin` y `event.source` del iframe y nunca envía PDFs al sitio público.

El proceso completo `PDF local → subida y reanudación → comprobación del recibo` también se prueba con un receptor **simulado**; no se hizo ninguna subida a Google real. **Resultado CI aprobado**, https://github.com/hernanchan/COTIZADOR/actions/runs/40150443684, sin fallas. El HTML original no se publica modificado.

## Lo que falta, sin ampliar requisitos

1. Preparar un piloto **privado real** con Cloudflare + GAS + Drive que ya existen, cuando sea posible la autenticación y se autorice la configuración. Realizar una subida pequeña y cotejar recibo, hash, páginas y tiempos desde PC y celular.
2. Vincular el recibo del PDF verificado con el renglón del pedido de D1 y recalcular en servidor su precio con materiales, formato, caras, descuentos y copias: **no reutilizar como importe autorizado el total del navegador**.
3. Integrar ese flujo a la interfaz comercial cuando esté validado. Hoy el piloto usa **carrito propio en memoria**, no la tienda real. La decisión de publicar e incorporar cobros es posterior y requiere autorización explícita.
4. Empaquetar o autoalojar la biblioteca de lectura PDF: el lector V2 opt-in aún carga `pdf-lib@1.17.1` de una CDN externa; esto no crea un origen de subida, pero depende de conectividad exterior.
