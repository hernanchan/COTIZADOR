# Librería Saber — especificación funcional del cotizador único automático

**Versión:** 1.0 · 18/10/2026  
**Estado:** diseño funcional; no implementado ni publicado.  
**Repositorio:** `hernanchan/COTIZADOR`, rama `pagos/mercadopago-checkout-pro-pruebas-20261017`.  
**Regla de lanzamiento:** migración total y coordinada del cotizador público; no coexistirán dos cotizadores. No modificar `main` ni desplegar la web pública sin aprobación expresa del titular. Sin R2 ni nuevos gastos o servicios de pago sin autorización.

## 1. Propósito

Una única experiencia donde el comprador carga archivos (PDF/JPG/PNG/Word), elige el resultado final de impresión, obtiene el presupuesto conforme a las tarifas de Librería Saber y, si el trabajo puede cotizarse automáticamente y la recepción es íntegra, paga el **100 % a través de Mercado Pago**. En la misma experiencia se preservan las categorías comerciales de impresión, ploteo CAD/planos, ploteo póster, Polaroids y otros servicios que actualmente ofrece el cotizador.

**Regla de UX:** el cliente **no tiene que contar páginas ni identificar qué máquina imprime el pedido**. Sí debe poder especificar tamaño final, material, caras, cantidad, distribución y acabado. La categoría CAD/planos permanece visible para quien busca específicamente ese servicio.

La web pública y el flujo actual de seña por WhatsApp no se interrumpen durante el desarrollo. En el lanzamiento autorizado el nuevo cotizador reemplaza al anterior; no presentar a los clientes dos presupuestadores. Los casos no automatizables siguen un circuito de revisión desde **el mismo cotizador**, sin cobrar un importe no validado.

## 2. Pantalla única de entrada y módulos

**Pantalla principal:** «¿Qué querés imprimir?» con acceso a:
1. **Documentos e impresiones** — PDF y Word convertidos y verificados. Carga de documentos de varias páginas; impresión A4/A3, B/N o color, papel, simple/doble faz, copias y anillado.
2. **Imágenes y fotografías** — JPG, PNG y, si corresponde, PDF de una página. Hoja A4/A3; tipo de papel, 1, 2, 4 o 9 **imágenes por cara de hoja**, orden de fotos, orientación, ajuste, copias/juegos. Vista previa del armado y calidad de cada imagen según su tamaño final.
3. **Ploteos** — acceso directo a «CAD / Planos» o «Póster / imagen plena», conservando tarifas diferenciadas. Se ingresa tamaño final en centímetros o se sugiere desde el documento, con confirmación; opciones de rollo, papel, cantidad y orientación. Si en otro módulo el cliente elige un tamaño mayor que A3, la interfaz lo conduce a esta modalidad **sin perder el archivo**.
4. **Polaroids** — mantener el editor específico actual de **seis fotos por A4**, sus encuadres, revisión de calidad, recepción privada y marcas de corte para guillotina. Precio de referencia actual **$3.000/hoja**, sujeto a verificación de tarifas; no mezclar la grilla específica de seis con la opción genérica de 1/2/4/9 por hoja. Integrar su pedido al **mismo carrito** y al sistema de pagos acordado antes de publicarlo.
5. **Otros servicios del cotizador existente** — stickers, impresiones fotográficas en otros tamaños, gráfica comercial, ploteo de corte y demás categorías actuales. No suprimirlas; integrar gradualmente sus reglas validadas y recepción de archivos al mismo carrito. Los casos aún no automatizables deben mostrar revisión personalizada **en el mismo sistema**, sin inventar precios ni enviar al «cotizador anterior».

**No es obligatorio hacer pasar todas las imágenes por la categoría de fotos:** el usuario puede empezar en «Subir mis archivos» y, tras analizarlos, seleccionar el producto. La navegación interna puede sugerir servicios, conservando clasificación comercial y tarifas propias.

## 3. Recorrido del comprador

1. **Carga** — uno o varios archivos PDF, JPG/JPEG, PNG, Word DOCX (DOC antiguo solamente cuando haya conversión fiel). Mostrar nombre, tamaño, páginas o imágenes detectadas, progreso y error específico si es corrupto/protegido.
2. **Identificación del servicio** — el usuario elige documento, foto/composición, CAD/planos, póster u otro servicio; sugerir formato desde el archivo pero **no decidir sin consentimiento el tamaño final** ni el tipo CAD vs. póster.
3. **Preguntas de impresión** — pedir solo parámetros aplicables. A4/A3 y ploteo; B/N/color; papel compatible; simple/doble faz; distribución de imágenes 1/2/4/9; orientación; ajuste sin recortar o rellenar/recortar, con vista previa; cantidad de copias/juegos; extras como anillado.
4. **Previsualización fiel** — mostrar hojas finales, páginas por cara, orden, recortes, bordes/márgenes, cantidad de hojas y calidad de imágenes. En Word mostrar PDF resultante de la conversión para aprobación. En documentos vectoriales grandes, mostrar dimensiones finales.
5. **Cotización** — mostrar **precio detallado por producto/trabajo**, escala por cantidad, material, extras, promociones compatibles, subtotal e importe total. El cliente confirma diseño, calidad y precio.
6. **Recepción privada confirmada** — conservar originales, archivo listo para imprimir (PDF compuesto/convertido cuando corresponda), parámetros, referencia y manifiesto de integridad. Validación en backend; si el dispositivo duerme/se desconecta, no perder lo que ya llegó. No afirmar «recibido» hasta que el servidor termine.
7. **Pago único** — Checkout Pro Mercado Pago, **100 % del carrito**; importe recomputado por servidor desde tarifas vigentes y archivos verificados. Una preferencia por intento, sin duplicar pagos. No cobrar trabajos ambiguos o incompletos.
8. **Centro de Pedidos privado** — solo pedidos con pago total realmente aprobado, comprobaciones antifraude/conciliación y archivos completos. Mostrar detalle, cantidades, material, medidas, instrucciones, referencias y acceso privado al PDF final para producción; nunca facilitar archivos finales ni secretos de recepción públicamente.
9. **Comunicación** — definir y aprobar texto de confirmación, entrega/retiro y mensajes WhatsApp antes de habilitar público. No enviar mensajes automáticos sin revisión comercial.

## 4. Reglas precisas de cálculo y ruteo

### 4.1 Documentos PDF y Word

- **PDF:** contar páginas de cada documento; mostrar desglose por archivo y permitir diferentes configuraciones por grupo de archivos cuando sea necesario. Si su contenido mezcla formatos, preguntar cómo se adaptan al papel final y advertir sobre escala.
- **Word:** convertir DOCX a PDF con herramientas bajo control y permisos del negocio, comprobar fidelidad de fuente, saltos y márgenes; contar las páginas **del PDF convertido**, nunca de una estimación de Word; aprobación del cliente de esa versión. DOC antiguo sujeto a prueba. Si no hay conversión confiable, revisión asistida o solicitud de PDF.
- **Copias, caras y hojas:** diferenciar **páginas de archivo**, **caras impresas** y **hojas físicas**. En simple faz, hojas por juego = caras. En doble faz, hojas por juego = techo(caras/2). Los juegos deben conservarse separados si se requiere. La tarifa del cotizador actual debe validarse según la base efectiva usada por cada producto antes de automatizar el cobro.
- **Extras:** anillado según límites por ejemplar y tamaño, y otras opciones únicamente cuando existan tarifas verificadas. Mantener las promociones legítimas sin aplicarlas dos veces.

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
- No cobrar por falta de archivos, conversión fallida, inconsistencia entre preview y resultado recibido, opción no disponible o presupuesto desactualizado. Confirmación explícita si el total cambia.
- En Cloudflare Worker ya existe prueba de preferencia Checkout Pro, conciliación manual y activador cron cada 10 minutos. Aún falta verificar la conciliación autónoma y hacer integración real con el cotizador y recepción genérica de archivos.
- Centro privado: mostrar solo pagos íntegros confirmados y documentos realmente recibidos. Webhook seguro + conciliación de respaldo; identificar pagos revocados/reembolsados y poner en revisión, no enviar a producción.

## 5. Casos límite / reglas de atención

| Caso | Comportamiento esperado |
| --- | --- |
| PDF cifrado/corrupto | No cotizar a ciegas; pedir archivo legible |
| DOCX con tipografías ausentes o formato distinto | Mostrar PDF convertido y exigir conformidad |
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
3. **Word:** viabilidad real de conversión DOCX a PDF bajo control privado, sin terceros públicos o infraestructura paga nueva sin aprobación. Solo ofrecer el formato cuando sea confiable.
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
| **E. Word** | Conversor privado DOCX → PDF, vista previa y revisión de páginas/formatos | El cliente aprueba la versión exactamente imprimible; incompatibles no se cobran |
| **F. Recepción y cobro** | Subida privada robusta y reanudable sin R2, verificación servidor, checkout 100 %, sincronización con Centro privado | PDF terminado, referencia, precio íntegro, pago aprobado; ningún pedido incompleto listo para producir |
| **G. Integración, regresiones y migración** | Un solo carrito, Polaroids y categorías actuales, ensayos móviles de desconexión, políticas/WhatsApp, plan de reversión | Aprobación comercial + ensayos completos + autorización expresa para publicar |

**No hay fecha de publicación garantizada:** esta definición agrega composición 1/2/4/9, conversión de Word y recepción de documentos, además del checkout ya ensayado. No confundir documentación con funcionalidades entregadas. La primera entrega será una vista de ensayo del **mismo cotizador migrado**, no una segunda herramienta pública.

## 8. Estado real de los componentes reutilizables (verificado en repositorio)

- `main/cotizador-web-v2.html`: `renderPrint()` y `calcPrint()` actualmente piden número de páginas manual; `renderPlot()` ya tiene `kind='cad'` y `kind='poster'` y evalúa la orientación, rollo y metros lineales. El cotizador calcula seña 50 %, que será reemplazada por pago total solo cuando el nuevo flujo esté aprobado.
- `main/precios-web.json`: tablas B/N y color A4/A3, anillados, ploteo por CAD y póster, soportes de rollo de 42, 60 y 90 cm; precios fechados agosto de 2026 pendientes de confirmación comercial.
- `polaroids/preparacion-produccion-20261016/vidriera/polaroids/editor.html`: advertencia de calidad por resolución efectiva `>=250` / `>=160` / `<160` PPI. Editor dedicado a Polaroids.
- Rama de pruebas `pagos/mercadopago-checkout-pro-pruebas-20261017`: `integraciones/autocotizador/pruebas/plan-impresion-imagenes.mjs` ya calcula 1/2/4/9, copias y clasificación preliminar A4/A3/plotter. **No genera todavía PDFs ni cobra**. Los ensayos de Mercado Pago y Centro de Pedidos fueron de Polaroids, no de este cotizador nuevo.
