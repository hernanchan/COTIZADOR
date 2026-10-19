# Ensayo de migración del cotizador — carga PDF

**Rama:** `cotizador/migracion-carga-archivos-20261018` (aislada; **no producción**).
**Página:** `pruebas/cotizador-archivos-v1.html`
**Motor preliminar:** `integraciones/autocotizador/pruebas/cotizar-documentos.mjs`
**Regresiones:** `tests/autocotizador-documentos.test.mjs`

## Alcance implementado en esta primera iteración

- Conserva la estructura, opciones y tarifas del cotizador web v2 y demás categorías existentes.
- En «Imprimir documentos» reemplaza el campo de páginas manual por dos entradas PDF de múltiples archivos: **B/N** y **color**.
- Lee `pdf.numPages` usando PDF.js (cdnjs `3.11.174`) **en el navegador**, presenta cada documento, cuenta páginas por modalidad y muestra tamaño de página inicial aproximado.
- Permite A4/A3, simple/doble faz, material para color, copias y anillado **ninguno/juntos/separados/mixto**; en mixto asigna grupos (0 = suelto) y permite ordenar archivos.
- Cotiza B/N y color con sus escalas vigentes en `precios-web.json`, y anillado por grupo y copia, separando hojas físicas de caras.
- **Al volver desde el resumen a «Cambiar datos» conserva archivos, orden, grupos, tamaño, caras, papel, copias y selección de anillado.**
- Deshabilita confirmación por WhatsApp y pagos. Etiqueta el resultado como **simulación**, sin recepción efectiva.
- No se ha modificado `main`, el worker público, Google Drive ni Mercado Pago; no se han autorizado gastos.

## Ensayo local técnico

Desde la raíz del repo servir archivos sobre HTTP con un servidor estático local, por ejemplo `python -m http.server 8000`. Abrir `http://localhost:8000/pruebas/cotizador-archivos-v1.html`. Requiere internet únicamente para obtener PDF.js desde cdnjs y, si se consulta, la planilla de promociones; los PDF no se envían a esos servidores.

Para verificar precios con Node moderno:
`node tests/autocotizador-documentos.test.mjs`

**No abrir con `file://`**: la lectura de `../precios-web.json` y el `import()` del módulo de tarifas necesitan HTTP.

## Verificaciones internas de lógica realizadas

El cálculo puro se ejecutó con las tablas del repositorio: (a) 12 + 10 páginas B/N y 4 a color, juntas, (b) las mismas separadas y con dos juegos, (c) combinación mixta con doble faz, (d) solo B/N en A3, (e) rechazos por archivos duplicados, modalidad B/N/color inválida, páginas nulas y anillado mayor que la capacidad. Pasaron 8 escenarios, además de comprobarse que los scripts de la página son sintácticamente válidos. **No equivale a prueba de navegador ni de subida real de PDF.**

## Tercera iteración: receptor independiente preparado, SIN ACTIVAR

El 19/10/2026 se añadieron componentes para un receptor **nuevo**, independiente del Apps Script y del proxy de Polaroids:

- `integraciones/autocotizador/recepcion/DocumentosReceiver.gs`: Google Apps Script con mensajes firmados HMAC, carpeta privada por pedido, sesión Drive resumable de 512 KiB, relectura del PDF recibido y comparación de bytes/SHA-256. **No instalado**.
- `integraciones/autocotizador/recepcion/worker-documentos.mjs`: relay Cloudflare **sin ruta activa**, que por defecto responde «Recepción desactivada» y exige origen piloto, Turnstile e integridad HMAC. **No desplegado**.
- `integraciones/autocotizador/pruebas/gateway-documentos-http.mjs`: adaptador HTTP para llamadas de inicio, estado, partes y cierre. **No conectado al editor todavía**.
- `tests/autocotizador-documentos-receptor.test.mjs`: regresión Node con Drive y Apps Script simulados. Se realizó **separadamente** una prueba equivalente en memoria que pasó inicio idempotente, una parte, consulta de estado, SHA de los bytes recibidos y rechazo de sesión incorrecta; este archivo Node debe ejecutarse en el repo antes de instalación.
- Piloto limitado a **20 MiB por PDF**, durante pruebas; no son todavía las condiciones comerciales finales. Configuración y advertencia en la página de ensayo alineadas con este límite.

**Corte de seguridad importante:** el cierre solo devuelve `received:true, verified:false, pdfPages:null` hasta que se incorpore un lector de PDF fiable **en servidor**. Por tanto esta fase **no permite cobrar ni liberar pedidos**. Es una medida intencional, no un fallo de la conexión. No atribuir pruebas de Google reales a simulaciones.

Antes del ensayo autorizado se necesita un proyecto Apps Script NUEVO, carpeta privada de documentos y secretos nuevos que no se compartan con Polaroids, junto con una ruta Worker piloto. No se requiere R2 ni ninguna contratación. Ver `integraciones/autocotizador/recepcion/README.md` para el procedimiento completo.

## Segunda iteración: transporte recuperable y ficha de recepción (19/10/2026)

Código preparado en esta misma rama, sin conexión externa y sin ningún despliegue:

- \`integraciones/autocotizador/pruebas/subida-reanudable.mjs\`: contrato de cliente para subir un PDF en partes de **512 KiB**, con SHA-256 del archivo completo y de cada fragmento. Antes de enviar consulta \`status\` al servidor; si se pierde la respuesta de un envío, consulta de nuevo antes de reintentar. Sólo termina con recibo \`verified:true\`, tamaño y SHA iguales y cantidad de páginas **validada por backend**. No permite usar una respuesta \`202 Dispatched\` como comprobante de recepción.
- \`integraciones/autocotizador/pruebas/manifiesto-documentos.mjs\`: arma el manifiesto lógico por \`orderId\` vinculando cada PDF con su recibo confirmado, grupo B/N o color, copias, hojas físicas, orden de montaje y grupos de anillado conjuntos, separados o mixtos. Un mismo pedido puede traer 12+10 páginas B/N y 4 color, con las láminas intercaladas en el armado. Rechaza discrepancias de páginas, recibos duplicados/no verificados o pertenecientes a otro pedido.
- \`tests/autocotizador-subida.test.mjs\`: cliente frente a un **servidor simulado en memoria**, incluyendo respuestas perdidas, reintentos, fragmentos íntegros, prohibición de completar sin verificación y formatos falsos.
- \`tests/autocotizador-manifiesto.test.mjs\`: tandas separadas y estructura de anillados y recibos.

**Comprobación del protocolo hecha en esta fase:** mediante simulación aislada, un PDF de 512 KiB + resto se transmitió sin reenviar el fragmento cuya respuesta se perdió, y se bloqueó la confirmación cuando el servidor respondió \`verified:false\`. También se comprobó el manifiesto con dos tandas y mezcla de anillados.

**Limitaciones:** todavía no existe \`gateway\` real asociado a Google; estas funciones **no envían archivos** y no se conectaron a la pantalla para no simular una recepción real. Tampoco existe aún una verificación autoritativa de páginas en Apps Script / Worker ni descarga desde Centro de Pedidos. El ensayo de transporte demuestra el protocolo, **no** el funcionamiento en red, cuotas de Google ni navegador móvil.

### Integración pendiente con Google, sin R2

1. Reutilizar el patrón del relay de Polaroids, pero **crear receptor de documentos independiente**, con sus propias operaciones \`start/status/part/finish\`, tamaño máximo, control antiabuso y autenticación de sesión/orden. El receptor anterior acepta fotos y está apagado en producción; no ampliar sus permisos ni sustituir sus claves a ciegas.
2. En Google Drive privado, crear carpeta o referencias por pedido y usar **carga reanudable de Google Drive** para evitar juntar en memoria un PDF de decenas de megabytes dentro de Apps Script. Comprobar sus cuotas, límites y compatibilidad con la versión efectiva del Script antes de instalarlo. Confirmar realmente la integridad y la lectura del PDF del lado servidor.
3. Exigir recibo de todos los archivos y manifiesto verificado para habilitar cualquier medio de pago. La aplicación **no puede cobrar** un documento si sólo conocemos la página calculada en el navegador.
4. Integrar la ficha de B/N, color y anillados y descargas PDF en Centro de Pedidos, con autenticación de operador y vínculo a archivos privados. Confirmar pago total Mercado Pago o transferencia validada manualmente, como ya se acordó.

## No implementado todavía — exigencias antes de cobrar

1. Leer y validar la misma cantidad de páginas **en backend** del PDF recibido, no confiar en el navegador.
2. Recepción privada y recuperable sin R2, con confirmación de integridad, carpeta por pedido en Drive y descargas autorizadas desde Centro de Pedidos.
3. Resolver dimensiones mixtas, importes y anillados con tarifas vigentes y aprobadas; no cobrar desde el cálculo preliminar. El archivo `precios-web.json` todavía indica generación el **21/08/2026**.
4. JPG/PNG con distribución 1/2/4/9, generación PDF y advertencia PPI como Polaroids; luego CAD/planos, ploteo y carrito mixto.
5. Conectar cobro íntegro Mercado Pago (webhook + reconciliación) y transferencia verificada manualmente; respetar estados `recibido`, `pago pendiente`, `pagado`, `listo para producir`.
6. Validar con navegación real móvil, lectores PDF, dispositivos que entran en reposo, archivos grandes, promociones y reversión.

**La pantalla de ensayo no constituye un segundo cotizador público.** Es un paso transitorio de desarrollo de la migración del único cotizador.
