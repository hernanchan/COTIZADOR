# UX definitiva V1: circuito único del cliente — Librería Saber

**Estado:** diseño acordado y primera implementación en la rama privada (28-10-2026); **NO DESPLEGADA NI COMPROBADA EN NAVEGADOR**. No se reescribió el motor probado.
**Referencia técnica:** `docs/ETAPA1-IMPRESIONES-PLOTEOS-CIERRE.md`. Este documento define **qué debe ver y hacer el cliente**. No es autorización para cambiar `main`, `libreriasaber.com.ar`, activar Mercado Pago ni publicar.

## Decisión de producto

**El cliente no debe identificar el tipo de PDF antes de subirlo.** El navegador analiza todos los PDF arrastrados juntos, los clasifica y organiza automáticamente por trabajo (A4, A3, planos CAD, póster). Puede seguir agregando PDF a un pedido existente sin borrar archivos ni elecciones. Solamente pregunta cuando no hay clasificación fiable o falta una decisión comercial.

**Un único botón principal por estado**: antes del envío, `Continuar` / `Enviar mi pedido` según ambiente; durante el trabajo, mismo lugar `Procesando…`, deshabilitado; al concluir, `Pedido recibido` o `Pagar pedido` cuando pagos estén autorizados. Nunca pedir «agregar al envío», «enviar todos» y «registrar en D1» al cliente.

**La etapa de cobro no debe inventarse todavía**: Mercado Pago Checkout Pro se integrará después de pruebas de monto final y recepción completa; hasta entonces ensayo privado **sin cobro ni órdenes de producción**.

## Interfaz compacta: máximo tres áreas visibles

1. **Encabezado fijo / barra de pedido:** total preliminar / final según estado; **un único CTA**, indicador de estado de una línea. No muestra API, Drive, D1, Turnstile, entorno de ensayos ni identificadores técnicos. En el ensayo privado, una etiqueta discreta `Prueba sin cobro` puede permanecer para evitar confusión; no abrir paneles técnicos automáticamente.
2. **Carga única:** área para arrastrar o seleccionar **todos los PDF de una vez**, mezclados, con control `Agregar más archivos`. Se muestra cantidad de archivos, páginas detectadas y un progreso de análisis acotado. El archivo original se conserva en memoria hasta enviarlo, con recuperación/reintentos sin duplicados cuando sea posible.
3. **Tu pedido, agrupado automáticamente:** tarjetas/filas compactas por **Documentos A4**, **Documentos A3**, **Planos CAD**, **Póster/Pleno**. Cada una ofrece opciones **comunes** y una acción discreta `Cambiar este archivo` para excepciones. Filas muestran nombre, páginas seleccionadas, escala/medidas, color/B/N, doble faz, copias y subtotal. Para planos, rollo y rotación son automáticos. No mostrar editores completos de cada PDF por defecto.

Una vez enviada la operación, reemplazar en el **mismo espacio** el formulario por progreso y recibo; no expandir accordions ni presentar nuevas secciones. El pago futuro **sustituye** el CTA de continuación con el checkout correspondiente, no añade otro panel gigantesco.

## Clasificación y decisiones

- A4/A3: usar formato detectado y sugerencia A4 cuando el PDF sea cercano a ese tamaño; si se escala, avisar `Ajustaremos proporcionalmente sin recortar`. La elección A4/A3/original debe estar disponible en la fila sin abrir configuraciones extensas.
- CAD/Póster: conservar clasificación página a página que ya funciona, rollo automático (42/60/90), rotación y precio. **Ante duda CAD** según regla acordada; mostrar revisión solo si es necesaria. En póster, ofrecer papel Obra 80 g o Recubierto 130 g. Un PDF mixto no obliga a forzar el mismo material a las páginas CAD.
- Copias y caras: valor común por grupo editable; permitir excepción individual. No revertir decisiones al agregar otro archivo ni convertir silenciosamente PDF de varias páginas a otro formato.
- **Anillado:** `Sin anillado` o `Individual` por documento y agrupación `Juntos/Separados/Mixto` para varios archivos una vez cerrada la validación real de grupos. Mostrar costo y hojas físicas calculadas por el servidor; preservar agrupación y orden en instrucciones de producción. **No habilitar grupos** hasta terminar recepción + conciliación + D1 para todos sus miembros. Nunca descartar una opción para poder enviar.
- PDF con páginas seleccionadas: el costo y el envío deben responder a páginas seleccionadas, con original verificado y representación explícita de la selección. No pedir que el cliente fabrique un PDF nuevo manualmente.
- Word y formatos no PDF: no aceptarlos silenciosamente como PDF; indicar de manera corta los formatos soportados.

## Estados del único CTA

| Estado | Interfaz | Acción |
| --- | --- | --- |
| Sin archivos | `Cargá tus PDF` | CTA deshabilitado |
| Analizando | `Analizando X de Y` | No duplicar clics |
| Incompleto/dudoso | Explicar **qué archivo** requiere intervención | CTA deshabilitado hasta resolver |
| Presupuesto listo (ensayo) | `Enviar mi pedido` + total preliminar | Un clic inicia recepción, verificación y D1 |
| Enviando | Barra/progreso compacto `Recibiendo X de Y` | No desplegar secciones, no nuevos botones |
| PDF verificados | `Registrando pedido` | Registro D1 automático, sin otro clic |
| Pedido confirmado | `Pedido registrado` + ID legible + total servidor | Estado final compacto |
| Falló un archivo | Mensaje concreto + `Reintentar envío` **en mismo lugar** | No volver a cargar PDF confirmados |
| Futuro pago habilitado | `Pagar pedido` y total final verificado | Solo luego de controles reales y habilitación explícita |

Seguridad y pagos: antes de mostrar importe definitivo confirmar precios, SHA, páginas, dimensiones, copias y servicios; el cliente nunca tiene autoridad sobre el monto verificado. Si la cotización difiere, exhibir diferencia y pedir aceptación **antes de iniciar pago**. No registrar pedidos incompletos como listos para producir. Un solo pedido por intento, con idempotencia y protección de reintentos.

## Rendimiento: medir antes de optimizar

Instrumentación por archivo y pedido, sin datos sensibles: tiempos de lectura local, análisis de páginas, clasificación visual, estimación preliminar, preparación, transferencia a Google, confirmación de bytes y páginas, cotización servidor, registro D1 y —cuando exista— checkout. Medir tiempo total percibido con 1 PDF A4 12 páginas, lote 3 PDF (A4+A4+A0), lote de 10 PDF y conexión móvil. Establecer línea base real antes de fijar límites numéricos. No afirmar mejoras por tests unitarios si la interfaz real sigue tardando.

Las operaciones independientes por PDF podrán ejecutarse en concurrencia **acotada**, siempre respetando límites de GAS/Worker y semántica de reintento. Actualizar avance en lugar fijo con estimación de archivos, no con un porcentaje inventado. Si el móvil se duerme, evitar pérdida de archivos/opciones cuando técnicamente sea posible; informar los límites reales de recuperación.

## Reglas de diseño y aceptación

- **No scroll doble:** un documento largo puede desplazarse normalmente, pero no dos paneles independientes; un CTA fijo accesible en desktop/móvil.
- **No «Paso 2» visible como otra pantalla**, ni referencias a APIs en el flujo normal. Los detalles de diagnóstico quedan ocultos y accesibles solo a administración/ensayo, sin abrirse al enviar.
- No pedir tres confirmaciones para completar el envío. La selección, el análisis, la recepción y el registro son **un único recorrido**.
- Una cotización preliminar **no equivale** a precio final autorizado ni a PDF recibido; estados distinguibles y precisos.
- Accesibilidad: mensajes breves, opciones legibles, teclado, botones identificados, estados accesibles para lectores de pantalla, contraste suficiente.
- Capacidad: hasta 30 PDF en el ensayo actual, con tamaños máximos validados por recepción; no prometer cargas que el receptor no puede aceptar.
- Prohibido ocultar o retirar archivos, páginas u opciones elegidas para hacer que el registro pase.
- **No se acepta como terminado** hasta comprobar en navegador real: 1 PDF A4, 12 páginas con anillado individual y monto correcto; 3 PDF combinados A4+A4+A0 en un pedido; prueba de falla y reintento sin duplicación; tiempo medido y ausencia de expansión durante envío.
- **Futuro checkout:** escenario aprobado de pago total por Mercado Pago (sin señas), con fallo/cancelación de pago recuperable sin volver a subir PDF, webhooks y estado confirmado desde servidor, administración separada y nada de «pagado» antes del evento certificado.

## Orden de ejecución para evitar parches

1. Congelar requisitos de esta UX en el registro, y **medir el flujo desplegado** como línea base, sin tocar lógica de recepción.
2. Simplificar únicamente la capa cliente, reutilizando clasificación y cotizadores existentes. Implementar agrupación automática y opciones comunes/excepciones; mantener los servicios no soportados claramente bloqueados.
3. Reutilizar la misma orquestación privada de un solo clic con progreso fijo; no agregar una segunda vía de carga ni otra orden en D1. Adaptar pruebas automáticas de estados y casos mixtos.
4. Probar un PDF y lotes reales; revisar precios, decisiones, facturas de tiempo y duplicados. Corregir solo fallas concretas con regresiones.
5. Separadamente, terminar anillado conjunto y conectar el checkout total, solo tras las autorizaciones necesarias.

## Estado y próximo paso (actualizado 28-10-2026)

**Diseño integral acordado, todavía NO implementado.** La versión del Worker privado ensayada en navegador es `2c1db455-4ac5-4f02-9ebd-c4e581f7283d`; tiene botón único sticky y el panel técnico ya no se abre automáticamente, pero la configuración de archivos continúa larga. El cliente final aún no tiene el diseño de agrupación compacta A4/A3/CAD/Póster.

**Línea base medible:** archivo `poliza_1145046.pdf`, 12 páginas, A4, B/N doble faz, anillado individual, $3.290 preliminar: total **62.081 ms** desde un único clic hasta «Pedido registrado». Fracciones principales: preparación 104ms, recepción+verificación 42.605ms, revalidación Central 19.474ms. Evidencia exacta y etapas en `docs/ETAPA1-IMPRESIONES-PLOTEOS-CIERRE.md`.

**Optimización en código, no desplegada ni medida en vivo:** lecturas independientes de PDF en GAS/Drive concurrentes con máximo 3, SHA-256 de bloque y archivo final intactos, validaciones firmadas en paralelo; GitHub CI aprobado `40721208008`. Esto puede reducir esperas, pero no constituye todavía una mejora comprobada. No es prueba de que los planes gratuitos sean el problema.

**Siguiente tarea:** preparar/desplegar nueva versión solo en `saber-documentos-pruebas`, con rollback, repetir medición idéntica y contrastar contra 62.081 ms. Luego avanzar sobre la interfaz compacta y agrupada aprobada; no activar pagos ni tocar producción pública.


## Avance de implementación UX (28-10-2026): agrupación y estados compactos

- Archivo carga-unica-cliente.mjs: agrupación visual A4, A3, planos CAD, póster, mixtos CAD/póster, pendientes y servicios especiales. Se conserva el orden físico original del arreglo entries y los índices del manifiesto, no se cambió el cálculo.
- Opciones compartidas para 2 o más archivos del mismo grupo: copias; en A4/A3, B/N-color, caras y anillado ninguno/individual; en póster/mixtos, papel. Cada archivo mantiene edición individual. El anillado conjunto todavía no está habilitado.
- Archivo carga-unica-pagina.mjs: estilos compactos responsive.
- Archivo worker-fase4-cotizador-unificado.mjs: exclusivamente en pantalla privada integrada, se oculta el presupuesto duplicado del iframe y permanece total fijo arriba. Se mantiene el cálculo y validaciones.
- Archivo pantalla-cotizador-v2-prueba-privada.mjs: panel técnico y cotizador original ocultos al cliente normal, consultables con ?diagnostico=1. Al enviar, el espacio de edición se sustituye por estado de recepción; después por recibo compacto y total servidor. Si falla, regresa la vista para reintento sin duplicar PDFs.
- Pruebas tests/fase1-envio-unico-interfaz.test.mjs: control de estados y que se conserven índices de entrada, tamaño y tipos. GitHub Actions 40728153179 SUCCESS, test suite y compilación Worker.
- Estado estricto: código en rama fase1/impresiones-ploteos-20261027, **NO PREPARADO NI DESPLEGADO** en Cloudflare; sin prueba visual ni envío real. Línea base anterior de tiempo real 44.877 ms con 12 páginas; esta UX no promete mejorar el tiempo de red.
- Siguiente paso: workflow manual de GitHub en main que prepara rama privada, promocionar SOLO Worker saber-documentos-pruebas y verificar visualmente y funcionalmente A4+A4+A0, PDF A4 de 12 páginas con anillado y reintento. Conserva rollback previo 8ea21564. Sin activar pagos, Polaroids ni modificar web comercial.
