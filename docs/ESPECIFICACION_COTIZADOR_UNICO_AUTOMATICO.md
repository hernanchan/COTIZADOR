# Librería Saber — especificación funcional del cotizador único automático

**Versión:** 1.0 · 18/10/2026  
**Estado:** diseño funcional; no implementado ni publicado.  
**Repositorio:** `hernanchan/COTIZADOR`, rama `pagos/mercadopago-checkout-pro-pruebas-20261017`.  
**Regla de lanzamiento:** migración total y coordinada del cotizador público; no coexistirán dos cotizadores. No modificar `main` ni desplegar la web pública sin aprobación expresa del titular. Sin R2 ni nuevos gastos o servicios de pago sin autorización.

## 1. Propósito

Una única experiencia donde el comprador carga archivos (PDF/JPG/PNG). Los archivos de Word (DOC/DOCX) deben convertirse previamente a PDF por el cliente, elige el resultado final de impresión, obtiene el presupuesto conforme a las tarifas de Librería Saber y, si el trabajo puede cotizarse automáticamente y la recepción es íntegra, paga el **100 % a través de Mercado Pago**. En la misma experiencia se preservan las categorías comerciales de impresión, ploteo CAD/planos, ploteo póster, Polaroids y otros servicios que actualmente ofrece el cotizador.

**Regla de UX:** el cliente **no tiene que contar páginas ni identificar qué máquina imprime el pedido**. Sí debe poder especificar tamaño final, material, caras, cantidad, distribución y acabado. La categoría CAD/planos permanece visible para quien busca específicamente ese servicio.

La web pública y el flujo actual de seña por WhatsApp no se interrumpen durante el desarrollo. En el lanzamiento autorizado el nuevo cotizador reemplaza al anterior; no presentar a los clientes dos presupuestadores. Los casos no automatizables siguen un circuito de revisión desde **el mismo cotizador**, sin cobrar un importe no validado.

## 2. Pantalla única de entrada y módulos

**Pantalla principal:** «¿Qué querés imprimir?» con acceso a:
1. **Documentos e impresiones** — PDF verificados. Los clientes que tengan documentos Word deberán exportarlos ellos mismos a PDF, revisar el resultado y luego subirlo. Carga de documentos de varias páginas; impresión A4/A3, B/N o color, papel, simple/doble faz, copias y anillado.
2. **Imágenes y fotografías** — JPG, PNG y, si corresponde, PDF de una página. Hoja A4/A3; tipo de papel, 1, 2, 4 o 9 **imágenes por cara de hoja**, orden de fotos, orientación, ajuste, copias/juegos. Vista previa del armado y calidad de cada imagen según su tamaño final.
3. **Ploteos** — acceso directo a «CAD / Planos» o «Póster / imagen plena», conservando tarifas diferenciadas. Se ingresa tamaño final en centímetros o se sugiere desde el documento, con confirmación; opciones de rollo, papel, cantidad y orientación. Si en otro módulo el cliente elige un tamaño mayor que A3, la interfaz lo conduce a esta modalidad **sin perder el archivo**.
4. **Polaroids** — mantener el editor específico actual de **seis fotos por A4**, sus encuadres, revisión de calidad, recepción privada y marcas de corte para guillotina. Precio de referencia actual **$3.000/hoja**, sujeto a verificación de tarifas; no mezclar la grilla específica de seis con la opción genérica de 1/2/4/9 por hoja. Integrar su pedido al **mismo carrito** y al sistema de pagos acordado antes de publicarlo.
5. **Otros servicios del cotizador existente** — stickers, impresiones fotográficas en otros tamaños, gráfica comercial, ploteo de corte y demás categorías actuales. No suprimirlas; integrar gradualmente sus reglas validadas y recepción de archivos al mismo carrito. Los casos aún no automatizables deben mostrar revisión personalizada **en el mismo sistema**, sin inventar precios ni enviar al «cotizador anterior».

**No es obligatorio hacer pasar todas las imágenes por la categoría de fotos:** el usuario puede empezar en «Subir mis archivos» y, tras analizarlos, seleccionar el producto. La navegación interna puede sugerir servicios, conservando clasificación comercial y tarifas propias.

## 3. Recorrido del comprador

1. **Carga** — uno o varios archivos PDF, JPG/JPEG o PNG. Mostrar nombre, tamaño, páginas o imágenes detectadas, progreso y error específico si es corrupto/protegido. Si el usuario intenta subir DOC/DOCX, explicar cómo exportarlo a PDF en Word y pedir que revise el PDF antes de subirlo; no convertir Word dentro del sitio.
2. **Identificación del servicio** — el usuario elige documento, foto/composición, CAD/planos, póster u otro servicio; sugerir formato desde el archivo pero **no decidir sin consentimiento el tamaño final** ni el tipo CAD vs. póster.
3. **Preguntas de impresión** — pedir solo parámetros aplicables. Para documentos comenzar con tamaño A4/A3, papel, simple/doble faz y copias; después solicitar por separado los PDF íntegros B/N y los PDF íntegros color, y **recién entonces** el anillado juntos/separados/mixto, con orden de montaje explícito. Para imágenes, distribución 1/2/4/9, orientación y ajuste/recorte con vista previa. Cambios de opciones pueden recalcular automáticamente.
4. **Previsualización fiel** — mostrar hojas finales, páginas por cara, orden, recortes, bordes/márgenes, cantidad de hojas y calidad de imágenes. Si el PDF proviene de Word, mostrar las páginas del propio PDF que el cliente exportó y revisó; no crear otra conversión. En documentos vectoriales grandes, mostrar dimensiones finales.
5. **Cotización** — mostrar **precio detallado por producto/trabajo**, escala por cantidad, material, extras, promociones compatibles, subtotal e importe total. El cliente confirma diseño, calidad y precio.
6. **Recepción privada confirmada** — conservar originales, archivo listo para imprimir (PDF original subido por el cliente o PDF compuesto de imágenes cuando corresponda), parámetros, referencia y manifiesto de integridad. Validación en backend; si el dispositivo duerme/se desconecta, no perder lo que ya llegó. No afirmar «recibido» hasta que el servidor termine.
7. **Pago único** — Checkout Pro Mercado Pago, **100 % del carrito**; importe recomputado por servidor desde tarifas vigentes y archivos verificados. Una preferencia por intento, sin duplicar pagos. No cobrar trabajos ambiguos o incompletos.
8. **Centro de Pedidos privado** — solo pedidos con pago total realmente aprobado, comprobaciones antifraude/conciliación y archivos completos. Mostrar detalle, cantidades, material, medidas, instrucciones, referencias y acceso privado al PDF final para producción; nunca facilitar archivos finales ni secretos de recepción públicamente.
9. **Comunicación** — definir y aprobar texto de confirmación, entrega/retiro y mensajes WhatsApp antes de habilitar público. No enviar mensajes automáticos sin revisión comercial.

## 4. Reglas precisas de cálculo y ruteo

### 4.1 Documentos PDF (incluidos los exportados de Word)

- **PDF:** contar páginas de cada documento; mostrar desglose por archivo y permitir diferentes configuraciones por grupo de archivos cuando sea necesario. Si su contenido mezcla formatos, preguntar cómo se adaptan al papel final y advertir sobre escala.
- **Word (.doc/.docx): no se admite directamente en el cotizador.** El cliente debe abrirlo en su programa, seleccionar «Archivo → Guardar como / Exportar → PDF», revisar tipografías, saltos de página, márgenes, tablas y cantidad de páginas en el PDF generado y **subir ese PDF**. Mostrar una ayuda breve en la interfaz. Si no consigue exportarlo, podrá solicitar asistencia desde el mismo cotizador; nunca cobrar automáticamente un Word sin convertir.
- **Copias, caras y hojas:** diferenciar **páginas de archivo**, **caras impresas** y **hojas físicas**. En simple faz, hojas por juego = caras. En doble faz, hojas por juego = techo(caras/2). Los juegos deben conservarse separados si se requiere. La tarifa del cotizador actual debe validarse según la base efectiva usada por cada producto antes de automatizar el cobro.
- **Extras:** anillado según límites por ejemplar y tamaño, y otras opciones únicamente cuando existan tarifas verificadas. Mantener las promociones legítimas sin aplicarlas dos veces.

### 4.1 bis. Subida por tandas B/N y color; anillado conjunto, separado o mixto (decisión del 18/10/2026)

**Regla comercial obligatoria:** se admite una mezcla de trabajos B/N y color en **un mismo pedido**, pero **cada PDF completo se imprime en una sola modalidad**: o B/N o color. Nunca presupuestar «páginas 1 a 5 B/N y 6 a 10 color» dentro de un solo PDF de forma implícita. Si el cliente quiere modalidades diferentes para páginas de un documento, debe preparar y subir **archivos PDF separados** para cada modalidad. No inferir modalidad automáticamente por el contenido ni tratar como color solo las páginas que parezcan coloreadas.

**Recorrido guiado para documentos:**

1. Preguntar tamaño final (A4/A3, o medidas y ruta de ploteo), papel compatible, simple/doble faz y cantidad de copias. Estas son las **opciones iniciales de una tanda**, reutilizables para todos los documentos de la tanda. Permitir abrir una nueva tanda con otras opciones cuando sea necesario, sin salir del cotizador ni crear un carrito paralelo.
2. Preguntar **«¿Qué archivos querés imprimir en blanco y negro?»** y aceptar uno o varios PDF. Mostrar nombre, páginas detectadas y copias. Si no tiene documentos B/N, puede omitir ese paso.
3. Preguntar **«¿Qué archivos querés imprimir a color?»** con otro conjunto de uno o varios PDF; también opcional. Especificar color **para todo ese PDF**, incluso si internamente alguna página resulta sin tinta de color.
4. Mostrar lista única de documentos con etiquetas **B/N** y **Color**, número de páginas, opciones, copias y cantidad física estimada. El cliente puede pasar un archivo completo de B/N a Color (o viceversa), borrarlo, agregar más archivos o ajustar orden; una modificación de modalidad puede obligar a recalcular.
5. Preguntar al final: **«¿Cómo querés que preparemos el anillado?»** Opciones: **Todos juntos**, **Cada documento por separado**, **Personalizado (mixto)** y **Sin anillar**. En personalizado, el cliente arrastra/asigna archivos a **grupos de anillado** de forma explícita (por ejemplo: archivos 1 y 3 juntos, archivo 2 separado). Debe elegir **el orden de montaje dentro de cada anillado**. Permitir también documentos sueltos no anillados dentro del mismo pedido.
6. Revisar composición, hojas físicas por juego, límites del anillado, cantidad de anillados/copias, subtotales B/N, color, materiales, acabados y total del carrito. Recalcular en el servidor antes de Mercado Pago.
7. Al Centro de Pedidos debe llegar un **manifiesto de producción legible, ordenado y sin ambigüedad**, además de originales y PDFs imprimibles por modalidad. No ofrecer un PDF único para imprimir de golpe cuando contiene mezclas de modalidades que requieren pasadas por equipos distintos.

**Invariantes de producción**:

- Cada `documento` incluye identificador estable, PDF recibido y validado, páginas, modo único `bn|color`, tamaño de salida, papel, caras `simple|double`, copias, posición dentro del anillado y referencia al archivo privado.
- Cada `tanda` agrupa documentos por parámetros de impresión compatibles (tamaño, material, caras, copias) y genera subtrabajos reales separados por modo B/N / Color para impresión eficiente; el modo no se mezcla en un mismo trabajo de impresora.
- Cada `grupo de anillado` contiene una **lista ordenada de documentos** que puede combinar tandas B/N y color físicamente después de imprimir. Una agrupación «mixta» significa varios grupos personalizados, incluso con documentos sueltos; **no** significa que dentro de un archivo PDF unas páginas sean B/N y otras color.
- La opción «Todos juntos» exige confirmar el orden de archivos y que las cantidades de copias sean compatibles: por ejemplo, 3 juegos de cada archivo = 3 anillados iguales. Si las cantidades difieren o contienen tamaños/papeles no compatibles, se solicita ajustar la agrupación o revisión asistida antes de cobrar.
- **Doble faz y transiciones:** para un anillado conjunto B/N + Color, **no cruzar automáticamente** un archivo/tanda a la cara posterior de otro. Insertar separaciones/hojas vacías necesarias solo conforme a una imposición confirmada y visible; no perder la alineación ni alterar el orden del documento. Registrar hojas físicas reales por documento, por ejemplar y por anillado, evitando cobrar caras impresas inexistentes.
- **Anillados:** tarifar por tamaño y capacidad del grupo terminado, contabilizando la cantidad total de ejemplares a anillar y hojas físicas efectivas, no una tarifa única por pedido. Revisar capacidades/tapas y casos especiales con fuente comercial vigente; no inventar precio.
- Con varias tandas o módulos en el carrito, la pantalla de pago muestra las líneas de producción y permite una **única operación por el importe total**. Archivos incompletos, agrupaciones indefinidas o cambios de cantidad que invaliden el anillado impiden el cobro hasta que se resuelvan.
- La ficha del Centro de Pedidos debe distinguir **A. imprimir** (archivos en cada tanda B/N/color y sus parámetros) y **B. armar** (grupos de anillado y orden de intercalado), además de las referencias privadas. El negocio no debe tener que adivinar cuáles archivos se intercalan.
- Para imágenes JPG/PNG, composición 1/2/4/9 y ploteos, aplicar el mismo principio de configuración por subtrabajo y agrupaciones solo cuando las reglas materiales/técnicas lo permitan.

**Ejemplo de control:**
Cliente carga `Apunte-A.pdf` B/N 12 págs., `Apunte-B.pdf` B/N 10 págs., `Láminas.pdf` color 4 págs., todo A4 simple faz, una copia.
- **Impresión:** 22 caras B/N + 4 caras color (dos trabajos de impresora). **Armado conjunto:** 26 hojas físicas, **un anillado**, en el orden que elija el cliente.
- **Armado separado:** 3 anillados, con 12, 10 y 4 hojas respectivamente.
- **Personalizado:** puede reunir `Apunte-A` y `Láminas` en un anillado de 16 hojas y entregar `Apunte-B` sin anillar, por ejemplo.
- El total B/N + color se calcula por sus propias escalas; el acabado cambia según cuántos grupos/ejemplares se confeccionen.

### 4.2 JPG/PNG: ejemplo que define el producto

Para **cuatro imágenes distintas**:

| Elección | Composición | Hojas A4/A3 por juego, simple faz |
| --- | --- | ---: |
| 1 por hoja | una imagen por cara | 4 |
| 2 por hoja | dos imágenes por cara | 2 |
| 4 por hoja | cuatro imágenes por cara | 1 |
| 9 por hoja | hasta nueve imágenes por cara | 1, con cinco espacios libres salvo que el cliente elija repetir/completar |

- Para `N` imágenes y `P` imágenes por cara (`P=1,2,4,9`), **caras por juego** = `ceil(N/P)`.
- En simple faz, **hojas físicas por juego** = `ceil(N/P)`. En doble faz, **hojas físicas por juego** = `ceil(ceil(N/P)/2)`. Multiplicar por juegos/cantidad solo al final.
- Las escalas, material y el precio se calculan sobre la unidad comercial correcta (**caras o hojas físicas, según tarifa validada**); no facturar cuatro hojas si se imprimen cuatro imágenes en una. No mezclar el final de dos juegos a doble faz sin elección expresa.
- A4 y A3, vertical/horizontal, papel filtrado por equipo/producto. Para 2 imágenes, distribución 1×2 o 2×1; para 4, 2×2; para 9, 3×3. La vista previa mostrará márgenes, recortes y orientación. Por defecto **ajustar sin deformar ni recortar**; opción de llenar con recorte solo mediante aceptación.
- Si hay varias imágenes de proporciones dispares, evaluar resolución **para el tamaño efectivo de cada casillero**. Posibilitar cambiar orden y repetir imágenes cuando el usuario lo solicite; una foto no equivale necesariamente a una hoja.
- Un PDF multipágina no debe meterse automáticamente en una cuadrícula 2/4/9 como si fueran JPG; si se implementa `N-up` para PDF, debe ser una elección separada y con vista previa.

### 4.3 Calidad / pixelado reutilizando Polaroids

- La herramienta de Polaroids existente clasifica `ppi>=250` como **buena**, `160<=ppi<250` como **atención** y `ppi<160` como **baja / posible pixelado**. Estos umbrales son criterio de UX, no garantía absoluta del resultado.
- **Calcular PPI efectivo**, según píxeles realmente disponibles para la zona de impresión en pulgadas, incorporando zoom/recorte. Actualizar cada vez que el cliente cambia A4/A3, grilla, encuadre, orientación o tamaño del ploteo.
- Ejemplo: una misma imagen puede marcar buena calidad en 4 por A4, pero calidad insuficiente en 1 por A3. Mostrar el resultado por foto y una advertencia resumida del pedido. Permitir decisión explícita informada si comercialmente corresponde, sin afirmar calidad que no existe.
- PDF vectorial CAD **no se juzga por PPI de página**: las líneas vectoriales son escalables; revisar por separado cualquier mapa de bits incrustado y la legibilidad de trazos/textos.

### 4.4 CAD / planos y ploteos mayores a A3

- Conserva servicios diferenciados **«CAD / Planos»** (`kind='cad'`, precio por `cadPerMeter`) y **«Póster / imagen plena»** (`kind='poster'`, `posterPerMeter`).
- Si el **tamaño final solicitado** no cabe en A3 en ninguna orientación (`29,7 × 42 cm`), pasar internamente a ploteo y solicitar medidas finales, tipo de trabajo, material, copias. Los nombres A2, A1 y A0 pueden ofrecerse como opciones con medidas equivalentes; incluir tamaño personalizado.
- **No rutar por resolución en píxeles ni automáticamente por el formato interno del PDF.** Los tamaños sugeridos desde el archivo deben confirmarse.
- Reutilizar `renderPlot()` y `cfg.plotter.supports`: escoger entre rollos 42/60/90 cm y papeles compatibles según mejor orientación, metros lineales, cantidad y redondeos vigentes. Verificar disponibilidad y límites de tamaño real del equipo. Si no cabe en rollo, derivar a revisión asistida, sin inventar importe.
- En CAD, conservar beneficios comerciales existentes, incluido «lunes de planos» cuando corresponda. La imposición múltiple 2/4/9 por hoja **no se aplica a rollos** salvo desarrollo específico posterior.
- Incluir vista previa a proporción, orientación, escala, resolución para imágenes raster y leyenda de tamaño final.

### 4.5 Carrito y Mercado Pago

- El cliente puede comprar varias líneas con productos distintos y configuraciones independientes, pero **un solo carrito y un único cobro del 100 %** para los trabajos automáticamente validados.
- El precio del navegador solo se muestra como simulación; el **servidor recalcula** precios, beneficios, cantidades, formatos, integridad y conteo real de páginas antes de generar preferencia.
- No cobrar por falta de archivos, PDF inválido, inconsistencia entre preview y resultado recibido, opción no disponible o presupuesto desactualizado. Confirmación explícita si el total cambia.
- En Cloudflare Worker ya existe prueba de preferencia Checkout Pro, conciliación manual y activador cron cada 10 minutos. Aún falta verificar la conciliación autónoma y hacer integración real con el cotizador y recepción genérica de archivos.
- Centro privado: mostrar solo pagos íntegros confirmados y documentos realmente recibidos. Webhook seguro + conciliación de respaldo; identificar pagos revocados/reembolsados y poner en revisión, no enviar a producción.

## 4.6 Acceso a archivos desde Centro de Pedidos (regla de producción)

**Objetivo del operador:** después de que el backend valide la recepción completa **y confirme el pago total**, entrar al Centro de Pedidos privado, abrir el pedido y acceder a los archivos sin buscar conversaciones de WhatsApp, interpretar códigos de referencia ni navegar manualmente por Drive.

### Organización del pedido
- Cada pedido tiene un identificador estable idéntico entre carrito, cobro, base de datos y su **carpeta privada en Google Drive**. La carpeta se crea/vincula durante la recepción; nunca depender del nombre del comprador como clave.
- Conservar **Originales** (PDF/JPG/PNG recibidos exactamente), **Listos para imprimir** (PDF compuestos 1/2/4/9, hojas Polaroids, documentos con orientación/escala si aplica), **Tandas B/N** y **Tandas color** claramente separadas, **Ploteos CAD / póster** separados según instrucciones, y una **Ficha de producción** (preferiblemente PDF o HTML imprimible) con todo el detalle técnico y orden de armado/anillado.
- Un documento no debe cambiar de B/N a color sin una confirmación registrada. Para anillado mixto, la ficha contiene los grupos y secuencia de PDF B/N y color; no generar un PDF de impresión combinado que lleve a una sola pasada con modalidad ambigua.
- Referencias a carpetas/archivos en D1 incluyen IDs internos de Drive y un manifiesto validado; no duplicar binarios en D1 ni guardar claves temporales del cliente allí.

### Interfaz privada operativa
- Desde `/admin`, **Pedidos pagados** → `Ver detalle` → mostrar resumen e instrucciones y accesos: **Abrir carpeta privada en Drive**, **Originales**, **Imprimir B/N**, **Imprimir color**, **Ploteos / composiciones**, **Ficha de armado/anillado**; cuando haya varios documentos, cada uno con nombre identificable, páginas, copias, papel, caras y orden.
- La carpeta de Drive solo debe abrir para cuentas de Librería Saber autorizadas; no configurar **«Cualquiera con el enlace»**, ni entregar links de almacenamiento o PDF final al cliente. El panel debe verificar autenticación administrativa y pago real aprobado antes de facilitar referencias o acciones de descarga.
- Si se agregan botones para **descargar dentro del panel** sin pasar por Drive, las descargas requieren un endpoint autorizado y de alcance limitado al pedido; no exponer tokens permanentes, claves de Apps Script ni URLs públicas. Evaluar los límites de transferencia de Cloudflare/Google con archivos grandes antes de comprometer esa modalidad. «Descargar todo» como ZIP es una mejora útil, pero solo si se prueba su generación y tamaño sin contratar servicios.
- El operador puede marcar internamente **pendiente / en impresión / en anillado / listo para retirar / entregado** (estos estados y notificaciones necesitarán desarrollo y aprobación; no confundir pago con finalización).
- Ante discrepancia, archivos incompletos o reversión/reembolso, **no ofrecer «Listo para producir»**; registrar estado `en revisión`, mantener trazabilidad y acceso administrativo controlado.

### Situación verificada vs. trabajo pendiente
- Polaroids ya envía fotos y PDF a **Drive privado** en el piloto, y el Centro de Pedidos mostró la referencia correcta de un pago de ensayo.
- Actualmente `/admin/api/order` y `showOrder()` muestran `file_references_json` en texto; **no existen todavía botones de descarga por archivo ni apertura verificada de la carpeta Drive desde el panel**.
- Falta una recepción genérica para PDF/JPG/PNG con manifiesto y carpeta por pedido; enlace privado del panel a Drive (o descarga autenticada), agrupación B/N/color y ficha imprimible. Probar acceso con cuenta operador autorizada; jamás publicar enlaces privados en el carrito.
- Esta sección es **especificación, no implementación**, y no autoriza tocar producción, habilitar recepción pública ni incurrir en gastos.

### Actualización del Centro de Pedidos y tolerancia operativa a demoras

**Decisión comercial (18/10/2026):** la confirmación en tiempo real es deseable, **pero no condición excluyente para publicar** si el mecanismo más fiable exige demoras. Orden de recuperación:
1. **Webhook Mercado Pago**, autenticado y verificado contra la API de pagos del proveedor, para registrar pronto los cobros aprobados.
2. **Conciliación automática cada 10 minutos** como respaldo cuando la notificación no llega. La programación está configurada en el piloto, pero su ejecución autónoma debe verificarse técnicamente, sin prometer una demora exacta hasta completar la prueba.
3. **Acción administrativa «Verificar pagos pendientes»** para forzar una conciliación cuando el negocio quiera comprobar un pedido antes del siguiente ciclo; esta opción ya se probó manualmente en el piloto.
4. **Actualización de pantalla automática opcional** con consulta del estado cada 20–30 segundos mientras el panel esté abierto. **Refrescar la lista NO equivale a verificar el pago ante Mercado Pago**: se debe distinguir «Actualizar lista» de «Verificar pagos pendientes» y comunicarlo al operador.

Requisitos no negociables: no marcar como pagado un pedido por la pantalla de retorno del cliente, por un simple webhook no validado ni por un comprobante; no enviar a producción hasta **pago confirmado por servidor** Y **archivos completos/verificados**. Mostrar claramente `pendiente de verificación` si el comprador pagó pero todavía no tenemos confirmación. No bloquear la migración solo por no lograr latencia de segundos; validar que cron y verificación manual sean **fiables y operables**.

### Pago por transferencia bancaria (alternativa en evaluación, no implementada)

**Idea a incorporar si el titular la aprueba:** el cotizador —no Mercado Pago— genera y persiste la orden de compra **antes de presentar cualquier forma de pago**. Tanto Mercado Pago como la transferencia bancaria corresponden a **un único pedido y los mismos archivos**. Las instrucciones y archivos se reciben primero, se validan y quedan en almacenamiento privado, nunca dependientes de una notificación de Mercado Pago.

**Flujo de transferencia bancaria a cuenta propia:**
1. Cotizar y guardar orden, manifestaciones de archivos PDF/JPG/PNG y composición, detalles de B/N, color, ploteo, anillados y el precio final validado **en servidor**. Asignar ID de pedido no reutilizable.
2. El cliente elige «Transferencia bancaria» y ve exclusivamente los datos bancarios oficiales confirmados por Librería Saber (alias/CBU/CVU, titular, importe), referencia de pedido e instrucciones. Puede adjuntar un comprobante opcional; un comprobante nunca valida la acreditación.
3. Estado del sistema: **pendiente de transferencia**, con archivos conservados y orden visible en una **sección administrativa de pendientes**. No mezclar con la lista de **pedidos pagados listos para producir**.
4. El operador revisa **la acreditación real** en el banco/billetera receptora: importe, moneda, fecha, identificador de operación/remitente cuando estén disponibles y posible duplicado. Solo entonces usa acción administrativa **«Confirmar transferencia recibida»** protegida por autenticación, dejando auditoría de usuario, fecha, importe e identificador de movimiento. No confiar en imágenes/PDF del comprobante.
5. Tras confirmación administrativa, y solo si los archivos están completos y validados, el pedido cambia a **pagado / listo para producción**; el Centro de Pedidos habilita las descargas PDF, ficha de impresión y anillado como con Mercado Pago.
6. Para transferencias no recibidas, pagos por importe incorrecto, movimientos ambiguos, duplicados, vencimientos, pedidos cancelados o conciliaciones tardías: **revisión administrativa**, sin autorización automática de producción. Definir plazos de reserva/caducidad y de conservación de archivos antes del lanzamiento.
7. No obligar al cliente a reenviar archivos ni a usar WhatsApp para avisar o demostrar el pago. Puede ver «Pedido recibido, aguardando acreditación» y recibir aviso cuando se confirme. No prometer confirmación instantánea en transferencias interbancarias.
8. Evitar dos cobros por el mismo pedido: elección/estado del medio de pago, intentos y transiciones idempotentes. Si el cliente cambia a Mercado Pago tras transferir o paga doble por error, suspender flujo de producción y abrir revisión/reintegro.

**Invariante de datos:** `order_id`, `payment_method=mercadopago|bank_transfer`, `payment_status=pending|confirmed|review|cancelled`, `files_status=receiving|verified|invalid`, `production_status=blocked|ready|printing|completed`. Nunca derivar «pagado» de `receipt_uploaded` o `checkout_return`; no aceptar cambio de estado sin verificación de servidor y, para transferencias, confirmación bancaria del operador. Registrar quién confirma y evitar doble confirmación.

**Opcional futuro:** conciliación bancaria automática **solo si existe integración oficial disponible, segura, fiable y aprobada**; no asumir que un envío directo a un alias bancario genera un webhook de Checkout Pro. No contratar aplicaciones nuevas ni generar cargos sin permiso.

**No ha sido aprobado ni construido este método de pago.** La confirmación de la modalidad exacta, interfaz administrativa y políticas bancarias requiere autorización antes del lanzamiento. No modificar producción.

## 5. Casos límite / reglas de atención

| Caso | Comportamiento esperado |
| --- | --- |
| PDF cifrado/corrupto | No cotizar a ciegas; pedir archivo legible |
| Cliente intenta subir DOC/DOCX | Informar que debe exportarlo a PDF desde Word, revisar el resultado y cargar ese PDF; no aceptar el DOC/DOCX para cobro automático |
| 4 fotos con opción «2 por hoja» | Dos hojas por juego, no cuatro |
| 10 fotos «9 por hoja» | Dos hojas por juego; segunda hoja incompleta |
| Una foto de baja resolución en A3 o A0 | Advertir PPI efectivo y mostrar el tamaño real |
| PDF de planos vectorial con tamaño A1 | Ofrecer CAD/planos y confirmar tamaño final |
| A3 exacto / A2 | A3 permanece impresión; A2 deriva a ploteo |
| Plano fuera del ancho de rollo | Revisar orientación; si ninguna cabe, revisión humana |
| Teléfono entra en reposo durante carga grande | Reintentar por partes, persistir progreso confirmado sin borrar todo |
| Varios archivos con parámetros diferentes | Cotizaciones independientes reunidas en un solo carrito |
| Doble clic / recarga / retorno de Mercado Pago | Mismo intento y preferencia, sin doble cobro ni archivos duplicados |
| Falta stock o tarifa confiable | No cobrar automáticamente; revisión dentro de único cotizador |
| Fotos/PDF de gran tamaño o recepción incompleta | Límite documentado, progreso visible, recepción confirmada en servidor |

## 6. Restricciones y puntos que deben resolverse antes de cobrar

1. **Tarifas:** `precios-web.json` indica `generatedAt=2026-08-21`. Confirmar vigencia y crear **una única fuente de verdad** para los cálculos cliente/servidor, incluidos cupones, promociones por día, papel A4/A3, CAD vs. póster y extras.
2. **Unidad de cobro:** validar comercialmente impresión simple/doble faz; caras impresas ≠ hojas físicas y se mantiene la escala real del cotizador. Confirmar criterio para **9 espacios y solo 4 fotos**: huecos en blanco por defecto o repetir fotos por decisión explícita del cliente.
3. **Word:** no desarrollar ni contratar conversor. Rechazar DOC/DOCX con instrucciones sencillas para que el cliente exporte a PDF y compruebe el resultado. Una vez recibido, contar y validar ese PDF como cualquier documento.
4. **Archivos:** confirmar arquitectura de recepción privada sin R2 usando la infraestructura actual (Google Drive/Apps Script/Cloudflare), cuotas, tamaño máximo, subida fragmentada y recuperación tras reposo. Guardar originales, PDF de imprenta y manifiesto.
5. **Panel privado:** adaptar Centro de Pedidos para documentos y composiciones, acceso real al PDF listo para imprimir, notas técnicas e integridad verificada; conservar el flujo Polaroids de seis fotos/A4.
6. **Polaroids y otros servicios:** integrar al único carrito sin romper el editor ni asumir que automáticamente todos tienen cotización backend terminada.
7. **Comunicación:** aprobar textos de WhatsApp, confirmación de compra, entrega, plazo, cancelación/reembolso y almacenamiento antes de activar.
8. **Seguridad:** validar tamaño/tipo de archivo, firmas reales, límite de recursos, protección antiabuso, autenticación temporal, validación de importe y recepción en servidor, no exponer claves o archivos a clientes.
9. **Migración:** pruebas aisladas y reversión garantizada; publicación coordinada únicamente con autorización expresa del titular, conservando `main` y el dominio público sin cambios hasta entonces.

## 7. Orden de ingeniería recomendado

| Fase | Trabajo | Criterio de finalización |
| --- | --- | --- |
| **A. Motor común** | Extraer los cálculos A4/A3, CAD/póster, promociones y reglas de descuento del cotizador existente a motor probador de cliente/servidor; confirmar tarifas actuales | Misma orden, mismo importe en cotizador de prueba y backend |
| **B. Carga y lectura** | Un solo uploader PDF/JPG/PNG; contar páginas PDF, resolución/medidas de imágenes y validación de tipos; previsualizar | Archivos múltiples y errores controlados, sin exigir páginas manuales |
| **C. Composición y calidad** | Grillas 1/2/4/9, orientación, márgenes, orden, zoom/recorte, PPI reutilizado de Polaroids; PDF final privado listo para imprimir | 4 fotos = 4/2/1 hojas según opción; 9/10/19, A4/A3, advertencias y conteo correctos |
| **D. CAD y gran formato** | Unir impresiones y ploteo según medida final y tipo CAD/póster; leer tamaños de PDF | Planos A2/A1/A0 y personalizados bien presupuestados; límite de rollo respetado |
| **E. Entrada Word** | Ayuda para exportar DOC/DOCX a PDF y manejo amable del formato no admitido | El cliente sube el PDF revisado por él; no hay conversión automática ni diferencias por exportación del servidor |
| **F. Recepción y cobro** | Subida privada robusta y reanudable sin R2, verificación servidor, checkout 100 %, sincronización con Centro privado | PDF terminado, referencia, precio íntegro, pago aprobado; ningún pedido incompleto listo para producir |
| **G. Integración, regresiones y migración** | Un solo carrito, Polaroids y categorías actuales, ensayos móviles de desconexión, políticas/WhatsApp, plan de reversión | Aprobación comercial + ensayos completos + autorización expresa para publicar |

**No hay fecha de publicación garantizada:** esta definición agrega composición 1/2/4/9, validación de los PDF recibidos y recepción de documentos, además del checkout ya ensayado. No confundir documentación con funcionalidades entregadas. La primera entrega será una vista de ensayo del **mismo cotizador migrado**, no una segunda herramienta pública.

## 8. Estado real de los componentes reutilizables (verificado en repositorio)

- `main/cotizador-web-v2.html`: `renderPrint()` y `calcPrint()` actualmente piden número de páginas manual; `renderPlot()` ya tiene `kind='cad'` y `kind='poster'` y evalúa la orientación, rollo y metros lineales. El cotizador calcula seña 50 %, que será reemplazada por pago total solo cuando el nuevo flujo esté aprobado.
- `main/precios-web.json`: tablas B/N y color A4/A3, anillados, ploteo por CAD y póster, soportes de rollo de 42, 60 y 90 cm; precios fechados agosto de 2026 pendientes de confirmación comercial.
- `polaroids/preparacion-produccion-20261016/vidriera/polaroids/editor.html`: advertencia de calidad por resolución efectiva `>=250` / `>=160` / `<160` PPI. Editor dedicado a Polaroids.
- Rama de pruebas `pagos/mercadopago-checkout-pro-pruebas-20261017`: `integraciones/autocotizador/pruebas/plan-impresion-imagenes.mjs` ya calcula 1/2/4/9, copias y clasificación preliminar A4/A3/plotter. **No genera todavía PDFs ni cobra**. Los ensayos de Mercado Pago y Centro de Pedidos fueron de Polaroids, no de este cotizador nuevo.
