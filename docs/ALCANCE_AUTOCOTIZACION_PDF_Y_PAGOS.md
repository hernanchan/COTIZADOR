# Librería Saber · Alcance acordado: autovaloración de PDF y pago completo

Estado: definición funcional y técnica, **no implementación publicada**. Registrar esta decisión antes de continuar la integración. Rama aislada `pagos/mercadopago-checkout-pro-pruebas-20261017`.

## Decisión comercial definitiva (corrección de alcance)

**MIGRACIÓN TOTAL DEL COTIZADOR EXISTENTE, NO DOS COTIZADORES EN PARALELO.** El cliente podrá cargar PDF, JPG, PNG y, sujeto a conversión/validación, Word; todo desde una sola interfaz.

- Mantener una sola entrada, interfaz y carrito de cotización. En el módulo de **impresión de documentos**, reemplazar obligatoriamente «Páginas del documento» (dato manual que los clientes suelen desconocer) por **«Subí tus archivos PDF»**. El sistema cuenta las páginas de cada archivo y permite elegir las opciones de impresión; no se ofrece a los clientes una versión antigua y otra nueva para esta operación.
- **Reutilizar el motor de precios, servicios, promociones y experiencia existente**; migrar la aplicación que ya funciona, no crear un producto comercial duplicado. Los módulos que no usan PDF (fotos, stickers, ploteo, etc.) no se eliminan por esta decisión; definir su tratamiento e integración caso por caso para mantener un único cotizador.
- Después de contar páginas, el sistema solicita **los requisitos que alteran la cotización** (A4/A3, B/N/color, papel, simple/doble faz, número de copias, anillado y otras condiciones vigentes); calcula y detalla el precio de manera automática y requiere confirmación.
- Para el pedido automático de PDF con archivos recibidos y validados, se prepara **pago del 100 % mediante Mercado Pago**. No se cobra con base en el número de páginas ni importes declarados desde el navegador: validación y cálculo final del lado servidor.
- La operativa anterior de seña/comprobante por WhatsApp solo podrá mantenerse **temporalmente mientras el nuevo cotizador permanezca apagado**, o para servicios/escenarios expresamente acordados; **no debe aparecer como otro cotizador alternativo al publicar la migración**. No imponer una migración de precio o pago a los demás servicios sin acordar sus reglas.
- Para archivos problemáticos o trabajos sin reglas automáticas verificables, se muestra una **salida asistida desde el mismo cotizador** (por ejemplo, revisión humana), sin inventar un monto ni derivar al «cotizador viejo».
- La sustitución en `main` será **atómica y reversible** al final de las pruebas, con autorización expresa. Durante el desarrollo mantener el cotizador público funcionando como hoy; la prohibición de coexistencia aplica al **lanzamiento final**, no a la necesidad de una rama de pruebas.

## Código y reglas existentes a reutilizar

- `cotizador-web-v2.html` (main): `renderPrint()`, `calcPrint()`, `finishItem()`. Hoy el campo `pages` se escribe manualmente; opciones de A4/A3, B/N/color, simple/doble faz, material, copias, anillado y promoción.
- `precios-web.json` (main): `bnA4`, `bnA3`, `colorA4`, `colorA3`, `bindings`, escalas por volumen, materiales, descuentos. Archivo marcado `generatedAt: 2026-08-21T13:50:37.427Z`; **confirmar que los valores están vigentes** y preparar una única fuente de precios para mostrador, web y servidor.
- El flujo aislado de Mercado Pago ya prueba pago completo, pedidos idempotentes, recibos Polaroids y Centro privado; reutilizar infraestructura y controles donde sean aplicables. No usar los importes calculados en el navegador como fuente de cobro.

## Ampliación de formatos propuesta (18/10/2026)

La migración será de **un solo cotizador**, sin alternativa pública paralela. La entrada de impresiones debe presentar «Subí tus archivos para imprimir» y poder procesar una mezcla de:

- **PDF**: leer conteo de páginas y tamaños, validar otra vez la versión efectivamente recibida en el backend.
- **JPG/JPEG y PNG**: el cliente elige formato A4 o A3, papel compatible con ese formato, cantidad de imágenes por hoja **1 (base), 2, 4 o 9**, cantidad de copias y encuadre/ajuste. La aplicación compone y muestra vista previa del PDF de impresión, con alerta de resolución efectiva baja; no cobrar una imagen como si fuera una hoja.
- **Word DOCX**: convertir en entorno controlado a PDF para contar las páginas **renderizadas**. No prometer que un DOCX contiene un número fijo de páginas ni contar párrafos/saltos como páginas. El cliente revisa una vista previa de la versión convertida (fuentes, tablas, saltos, márgenes) y aprueba explícitamente esa versión de impresión ANTES del pago total.
- **DOC antiguo**: compatibilidad deseable, condicionada a prueba de conversión fiel; si no se puede procesar de forma confiable, mostrar un mensaje claro y pedir DOCX/PDF en el mismo cotizador. Rechazar macros/documentos con contenido activo y archivos ilegibles o cifrados.
- **Almacenamiento y privacidad**: originales y versiones imprimibles solo en recepción privada; no utilizar convertidores públicos ajenos sin aprobación. Evaluar viabilidad de conversión con la infraestructura Google ya disponible, límites/cuotas reales y fidelidad; no inventar una conversión DOCX a PDF dentro de Cloudflare Workers si no puede ejecutarse allí.
- **Cotización confiable**: el backend vuelve a verificar dimensiones/páginas de los archivos recibidos y calcula con precios vigentes; guarda el manifiesto de originales, PDF renderizado aprobado y parámetros de impresión. No habilitar pago si falta PDF convertido o hay error de lectura.
- **Pruebas**: PDF de una/muchas páginas, imágenes verticales/horizontales de baja resolución, DOCX con encabezados, fuentes faltantes, tablas y saltos de página, varios archivos heterogéneos, teléfono en reposo, subida interrumpida, edición y reintento sin doble cobro.

Este bloque amplía el alcance funcional **sin desplegar ni autorizar ningún servicio adicional**.

## Integración única: JPG/PNG por hoja y ploteo por tamaño de salida

**Regla principal:** el usuario elige **cómo quiere recibir la impresión**, no el equipo. Se mantienen servicios comerciales separados en el motor tarifario pero unidos en un solo recorrido de carga → opciones → vista previa → precio → pago.

### Imposición de imágenes en A4 / A3

- Formato: A4 (21 × 29,7 cm) o A3 (29,7 × 42 cm), vertical u horizontal.
- Papel: lista filtrada por disponibilidad y combinaciones reales del cotizador actual; precio extraído de una fuente única validada por servidor.
- Cantidad por cara: **1, 2, 4 o 9**; 2 = 1×2 o 2×1 según orientación, 4 = 2×2, 9 = 3×3. Vista previa con límites, márgenes, orientación y orden de las imágenes. Se debe permitir **ajustar sin recortar** inicialmente; variante «llenar y recortar» solo si el cliente la aprueba. No deformar las fotos.
- El cliente elige cantidad de juegos/copias y, si corresponde, doble faz, manteniendo la distinción entre páginas de origen, caras impresas, hojas físicas y juegos. Cuando una impresión incluye 9 imágenes en un A4, el material a cotizar es **una hoja A4**, no nueve.
- Cálculo de imposición: para N imágenes en una cara, P = imágenes por hoja (1/2/4/9), J = juegos, **caras A4/A3 = techo(N/P) × J**. Si se imprime simple faz, hojas = caras; para doble faz, hojas por juego = techo((techo(N/P))/2), sin juntar el final de un juego con el inicio del siguiente salvo elección expresa. Tarifa vigente **según caras/hojas y material**: confirmar unidades que espera el motor de precios antes de cobrar.
- Preservar archivos originales en privado y generar un PDF final de imprenta con la composición exacta confirmada. En fotos con resolución insuficiente, mostrar advertencia clara antes de que el cliente apruebe.
- Definir orden de imágenes, repetición de una imagen en la hoja, rotación y márgenes de corte durante el diseño; nunca asumir que «2/4/9» significa copias idénticas en lugar de imágenes distintas.

### Paso a ploteo: solicitado más grande que A3

- Si las **medidas finales solicitadas** no entran en ninguna orientación de A3 (es decir, no cumplen lado menor ≤ 29,7 cm y mayor ≤ 42 cm), cambiar internamente a **servicio de ploteo**. No decidir por los píxeles del JPG/PNG ni por el tamaño interno del PDF sin consultar al cliente.
- En el mismo flujo solicitar ancho y alto de impresión en cm, número de copias, material compatible y «Plano / líneas» vs «Póster / imagen plena», según la naturaleza declarada del trabajo.
- Reutilizar el cálculo vigente de `renderPlot()` y `cfg.plotter.supports`: rollos disponibles 42/60/90 cm y recubiertos cuando aplique, orientación y largo lineal factible, redondeo y promociones correspondientes. Si excede el rollo disponible, no inventar un precio; ofrecer revisión humana **dentro del cotizador único**.
- Vista previa con proporción y escala, resolución de imagen efectiva a tamaño real y orientación elegida; conservar el archivo recibido para impresión privada.
- **No aplicar automáticamente el modo 2/4/9 imágenes por hoja a ploteos de gran formato:** requiere lógica específica de imposición en rollo y tarifas antes de habilitarse.
- Todas las cotizaciones y conversiones deben validarse de nuevo **en servidor** antes del pago del 100 % por Mercado Pago.

### Criterios de prueba nuevos

- Imágenes: 1, 2, 3, 4, 5, 8, 9, 10, 18 y 19 JPG/PNG; cantidades por hoja 1/2/4/9; A4/A3, orientaciones, bordes, tamaños mixtos, DPI advertido y copias repetidas. Una imagen nunca debe contabilizarse accidentalmente como una hoja entera cuando se eligió imposición.
- Plotter: A3 exacto (todavía A3), apenas mayor que A3, A2/A1/A0, papel obra/recubierto, CAD/póster, cambio de orientación, largo y ancho máximos. Comprobar que el precio de rollo coincide con `renderPlot()` y que los límites físicos se cumplen.
- Archivos mixtos PDF/JPG/PNG/Word: separar unidades y páginas por producto, presentación del presupuesto conjunto y conservación de originales/derivados.


## Secuencia nueva: pedido de PDF con impresión autocalculada

1. Desde el **cotizador único** de Librería Saber, el cliente entra en «Impresiones», encuentra «Subí tus archivos para imprimir» en lugar de «Páginas del documento» y carga uno o más documentos. Se muestran nombre, páginas verificadas por archivo, total, progreso y advertencias si un PDF está cifrado, dañado, protegido o presenta dimensiones/páginas mixtas.
2. Preguntar **tamaño de salida (A4/A3)**, **B/N o color**, **papel/material** cuando corresponda, **simple o doble faz**, **cantidad de copias**, **anillado** y cualquier opción que cambie el presupuesto. Considerar opción de selección por archivo cuando se suben varios; no inferir automáticamente color comercial por una imagen que parezca color.
3. Aplicar las escalas, promociones y condiciones vigentes del cotizador. Páginas por archivo y de impresión calculadas; separar páginas de **hojas físicas** cuando es doble faz; anillado por ejemplar y límites por servicio deben verificarse contra reglas vigentes.
4. Mostrar detalle: archivo, páginas, copias, formato, papel, caras, extras, tarifa/escala, descuento, total. Confirmación explícita antes de pasar a pagar el 100 %.
5. Subir PDF y metadatos al almacenamiento privado, con autenticación/constancia por pedido, control de integridad, fragmentos reanudables, límites razonables, reintentos en celular y sin descarga pública. Usar infraestructura actual sin R2 ni servicios pagos nuevos. **No cerrar una recepción como completa hasta verificar bytes y documento final en el servidor**.
6. El servidor vuelve a abrir/verificar el documento y cuenta las páginas de la **versión efectivamente recibida**. Recalcula el presupuesto sobre la versión publicada de precios del servidor; no aceptar el número de páginas, importe, descuento, tipo de trabajo ni hash declarados por el navegador como prueba suficiente. Evitar doble pago e impedir modificar archivos/opciones de un pedido ya generado.
7. Preparar una única preferencia Checkout Pro con total íntegro del pedido. Revisar automáticamente el estado mediante webhook autenticado y conciliación alternativa por Cron. Solo pedidos pagados y con PDF recibido se muestran como listos para producción en el Centro privado, con archivos y parámetros de impresión.
8. El cliente puede ver estados «recibiendo PDF», «recibido», «presupuesto confirmado», «pendiente de pago», «pagado», «en revisión». Pago fallido/rechazado no se registra como confirmado; no hace falta volver a subir si la recepción persiste.

## Alcance inicial razonable

Migrar primero **impresión de documentos PDF A4/A3** (B/N o color completo por documento, simple/doble faz, copias, papel, anillado) **dentro del mismo cotizador**. Después completar la integración de los otros servicios en la misma interfaz. Para impresiones fuera de reglas confiables, ofrecer **revisión humana dentro del mismo proceso**; nunca pedir páginas manualmente como sustituto silencioso ni derivar a otro cotizador.

## Riesgos/criterios de salida

- Contar páginas en navegador con un visor PDF es útil para UX, pero verificar **nuevamente del lado servidor** con límites de tamaño, CPU, tipos de documento y protección de PDF; rechazar cifrados/corruptos de forma controlada.
- Doble faz afecta cantidad de hojas; precio y anillado no deben depender de suposiciones. Variación de tamaño/orientación interna del PDF debe advertirse. Los PDF pueden tener contenido distinto de dimensiones físicas.
- Verificar que `precios-web.json` refleje **precios actuales** antes de conectar un cobro irreversible. No duplicar reglas que se desincronicen entre el cotizador y la pasarela. Validar promociones/día y cupones si se habilitan.
- Manejar interrupciones de carga y teléfono en reposo; no prometer recepción hasta obtener confirmación de Google/servidor. Proteger archivos privados (sin URL pública para clientes) y definir plazo de conservación.
- Probar múltiples PDF, 1/2/3/60/200+ páginas, archivos corruptos, tamaño mixto, doble faz con páginas impares, anillado, reintentos, pagos repetidos, errores de Google, Mercado Pago y recepción de PDFs, desde celular.
- Configuración/aprobación de créditos y funciones Cloudflare, Turnstile, implementación de prueba y planes sin costos no autorizados. Hacer una prueba completa en piloto antes de permitir flujo público.
- **No publicar** cambios parciales en la web. El lanzamiento reemplaza la experiencia pública del cotizador como una migración única, con reversión preparada. Modalidades de pago de otros servicios y Polaroids deben acordarse antes de activarlas; no imponer 100 % universal por inferencia. Cambios comerciales y de WhatsApp requieren aprobación expresa.

## Próxima tarea de ingeniería

Extraer/compartir motor de cotización actual como función pura testeable y precios validados en servidor; **migrar el mismo módulo `renderPrint()`** desde el campo manual `pages` hacia carga y conteo PDF, manteniendo el resto de la interfaz y carrito. Prototipar aislado, incorporar recepción protegida de PDF y comprobación servidor, unir al checkout ya probado y ejecutar ensayos de extremo a extremo. Antes del despliegue final definir el flujo de todos los módulos y el cambio coordinado. **No desplegar automáticamente ni modificar `main` sin aprobación**.
