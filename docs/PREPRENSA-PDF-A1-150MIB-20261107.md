# Preprensa de PDF A1 pesado — validación técnica (07/11/2026)

## Problema operativo real
El comercio recibe PDFs de alrededor de **150 MB que son una sola página A1**. Intentar imprimir directamente el original puede saturar el procesador RIP/controlador de la impresora y también el equipo de trabajo. **Transferir el PDF a R2 no resuelve por sí solo el problema de impresión.**

## Implementación en la rama de ensayo
- `tools/preprensa-plano-a1-qpdf.mjs` ejecuta **qpdf offline en proceso separado**, con límite de tiempo; no se ejecuta dentro de Cloudflare Worker ni del navegador del comprador. Crea candidata en ruta distinta, jamás reemplaza el original.
- Se limita en esta primera etapa a **PDF de una página**, de hasta 256 MiB, y compara páginas, rotación, MediaBox y CropBox antes/después.
- Usa compresión sin pérdida de streams y objetos. **No rasteriza, no baja DPI, no recomprime fotos en JPEG**; no modifica la escala del A1. Comprueba el PDF de entrada/salida con qpdf y compara una representación de la página a 720 píxeles en Poppler. Igualdad de vista reducida **no prueba calidad de líneas finas a escala de impresión**.
- Marca siempre `plotterPrintAuthorized:false`, `paymentAuthorized:false`, `requiresOperatorReview:true`. Sólo genera una copia candidata si hay reducción >=5% y todas las comprobaciones pasan. Si no reduce, **no entrega candidato** y obliga a otro tratamiento de preprensa. Copia y manifiesto permanecen exclusivamente en el runner del ensayo y se destruyen al terminar.
- Hay una alerta preventiva para ploteos desde 60 MiB en `riesgo-preprensa-ploteo.mjs` y `ficha-produccion-central.mjs`. **Atención: el Worker Central actual descarta propiedades adicionales al normalizar su manifiesto y valida recibos TUS hasta 40 MiB**, por lo cual no corresponde decir que el aviso para 150 MiB ya está visible o activo en Central.

## Resultados reales del ensayo (PDFs sintéticos, no archivos de clientes)

[GitHub Actions 42382841817](https://github.com/hernanchan/COTIZADOR/actions/runs/42382841817): **SUCCESS**. Regresión TUS independiente [42382841776](https://github.com/hernanchan/COTIZADOR/actions/runs/42382841776) **SUCCESS**.

**Caso A: una página A1 150 MiB, con contenido vectorial simple y mucho espacio sin comprimir.**
- Original: 150 MiB; candidata: 0,15 MiB (**99,9 % menos**, sólo en este caso altamente compresible).
- Tiempo de preparación medido: **7.599 ms** en GitHub Actions; medida: **59,4 × 84,1 cm**; rotación/páginas/cajas conservadas.
- Comparación de muestra de 720 píxeles idéntica, SHA del original sin cambios, copia separada y archivo protegido contra sobrescritura. No se envió ninguna impresión.

**Caso B: una página A1 con imagen RGB ya comprimida por Flate (16 MiB).**
- Resultado: `SIN_REDUCCION_SUFICIENTE_REQUIERE_OTRO_TRATAMIENTO`, **0 % de reducción**.
- No se creó copia imprimible falsa, original sin cambios. Demuestra que la compresión sin pérdida no mejora necesariamente un PDF de gran tamaño.

## Qué NO está resuelto todavía
1. **No se probó con un A1 real problemático de 150 MB** (millones de vectores, transparencias, escaneo grande o PDF protegido), ni con el controlador Canon del negocio. No garantizar que la copia evite cuelgues de impresora.
2. La optimización no está integrada al circuito R2 → Central → ZIP. No hay motor de preprensa en producción ni hay infraestructura dedicada para ejecutar qpdf sobre originales de clientes.
3. Faltan lectura segura de páginas/medidas de PDF grande y cotización autoritativa, ejecución de optimización aislada, cupos, reintentos y limpieza de original/copia, y aceptación profesional de escala, colores y detalle.
4. Para PDFs ya comprimidos o complejidad vectorial no reducible hará falta una **segunda estrategia** según contenido: PDF vector optimizado, o una copia rasterizada a resolución y color acordados. Nunca aplicar 150/300 DPI indiscriminadamente a líneas CAD.
5. No se tocó `main`, web comercial, Worker de pagos ni impresoras. R2 para compradores sigue apagado.

## Criterio de publicación del nuevo cotizador
- Aceptar PDF A1 de ~150 MB desde móvil/PC sin abrirlo completo en RAM del navegador.
- Detectar medidas y páginas verificadas por servidor y cobrar únicamente presupuesto real.
- Recibir archivo completo en R2, registro único en Central, permitir preparar una **copia de producción** separada y trazable, con aviso de preprensa visible para operador.
- Verificar el PDF final y bloquear impresión automática de ploteos pesados hasta validar preprensa; borrar originales/candidatas después de entrega según política.
