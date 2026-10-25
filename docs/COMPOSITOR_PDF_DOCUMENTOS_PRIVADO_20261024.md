# Librería Saber — compositor PDF documental privado

**24/10/2026 · Rama de integración** `polaroids/express-pdf-unico-20261023`. Sin despliegue, sin modificaciones a `main` ni a `libreriasaber.com.ar`.

## Funcionalidad incorporada y ensayada

Motor independiente `integraciones/autocotizador/recepcion/componer-pdf-documentos-privado.mjs`, construido con `pdf-lib`. Recibe **bytes de un PDF original ya comprobado en backend** y la selección comercial de impresión; devuelve un nuevo PDF compuesto con páginas vectoriales embebidas, y una ficha de imposición (orden, caras, hojas físicas, márgenes y correspondencia con las páginas originales). **No rasteriza** el documento original.

- Formatos de hoja: A4 y A3; orientación vertical u horizontal; margen técnico configurable 0–20 mm, de prueba 5 mm. Escalado proporcional y centrado, **sin recortar**.
- Distribuciones: 1, 2, 4 y 9 páginas originales por cara. Selección explícita de páginas originales y su orden; se rechazan índices inválidos o repetidos.
- Copias como **juegos completos**, hasta 200. En doble faz, si el número de caras de cada juego es impar, se añade un reverso en blanco antes de iniciar el siguiente juego; de lo contrario se mezclarían hojas de clientes.
- Topes del ensayo: PDF de entrada máximo 20 MiB, hasta 2.000 caras resultantes y hasta 90 MiB de salida; no habilitan por sí solos mayores cuotas de recepción en Google.
- Bloqueo de PDF dañado, protegido, páginas fuera del archivo, opciones imposibles y rotaciones de página diferentes de 0°. La rotación se **deriva a revisión**, en vez de entregar un archivo mal orientado.
- El resultado se etiqueta explícitamente `PDF_COMPUESTO_LOCAL_NO_LIBERADO`; `guardadoEnDrive:false`, `pdfImprimibleVerificado:false`, `listoParaProducir:false` y `paymentAuthorized:false`. **No crea ni confirma un pedido, no contacta Cloudflare, Drive o Mercado Pago**.

**Pruebas reales de construcción de PDF:** `tests/autocotizador-componer-pdf-documentos.test.mjs` usa PDF originales de varias páginas generados por `pdf-lib` y comprueba carga del PDF resultante, tamaño A4/A3, posición dentro de márgenes, orden invertido, imposición 2/4/9, preservación del recurso vectorial XObject, dos juegos dúplex con una cara en blanco intermedia y rechazo de datos inválidos.

Primera ejecución `40145907200`: siete casos correctos; falló únicamente una aserción de prueba por utilizar un identificador de PDF incorrecto para el recurso XObject. Se corrigió usando `PDFName.of('XObject')`. **CI confirmado con éxito**: commit `560bec95a08a9b88990c647cd79c9a7a6137bbb3`, corrida https://github.com/hernanchan/COTIZADOR/actions/runs/40145948849; las ocho pruebas del compositor y todas las pruebas existentes de Central, catálogo y Worker documental completaron exitosamente.

## Obligaciones antes de liberar una orden

1. Invocar el compositor **únicamente desde la operación interna**, después de recuperar los PDF por la recepción HMAC y **verificar hash SHA-256, páginas originales, opciones y precio**. Nunca aceptar únicamente el JSON de ficha del cliente como autoridad.
2. Guardar el PDF de impresión en Drive privado, obtener y cotejar su hash/bytes/páginas, y asociar referencia privada al pedido D1. El actual manifiesto de D1 **no permite inferir que ya existe un archivo final**.
3. Agregar una puerta de acceso que compruebe el pedido realmente pagado, el importe total, cualquier devolución y el operador autenticado **antes de habilitar la descarga del PDF final**. No confundir vista preliminar con autorización de producción.
4. Validar mediante revisión visual e impresión física: archivos vectoriales, PDF con tipografías embebidas, páginas rotadas, transparencias, formato mezclado, doble faz y anillado, además de los materiales comerciales vigentes. Los originales > A3 no deben pasar inadvertidos por el compositor de documentos; se cotizan como planos/póster.
5. Conectar la **experiencia real del comprador** para selección 1/2/4/9, caras, copias y armado. Este motor no reemplaza la interfaz ni el cotizador público, y **no es apto por sí solo para prometer un archivo listo para imprimir en el panel**.

**No se activó ninguna variable remota, cobro, recepción pública ni gasto.**
