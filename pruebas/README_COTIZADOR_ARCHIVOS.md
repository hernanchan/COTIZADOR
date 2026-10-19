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

## No implementado todavía — exigencias antes de cobrar

1. Leer y validar la misma cantidad de páginas **en backend** del PDF recibido, no confiar en el navegador.
2. Recepción privada y recuperable sin R2, con confirmación de integridad, carpeta por pedido en Drive y descargas autorizadas desde Centro de Pedidos.
3. Resolver dimensiones mixtas, importes y anillados con tarifas vigentes y aprobadas; no cobrar desde el cálculo preliminar. El archivo `precios-web.json` todavía indica generación el **21/08/2026**.
4. JPG/PNG con distribución 1/2/4/9, generación PDF y advertencia PPI como Polaroids; luego CAD/planos, ploteo y carrito mixto.
5. Conectar cobro íntegro Mercado Pago (webhook + reconciliación) y transferencia verificada manualmente; respetar estados `recibido`, `pago pendiente`, `pagado`, `listo para producir`.
6. Validar con navegación real móvil, lectores PDF, dispositivos que entran en reposo, archivos grandes, promociones y reversión.

**La pantalla de ensayo no constituye un segundo cotizador público.** Es un paso transitorio de desarrollo de la migración del único cotizador.
