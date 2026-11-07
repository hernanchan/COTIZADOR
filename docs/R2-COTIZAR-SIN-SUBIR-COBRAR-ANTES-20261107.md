# R2: cotización local; cobro antes de subir — decisión del propietario 07/11/2026

## Objetivo económico
El propietario habilitó Cloudflare R2 con tarjeta, pero **no autoriza que el simple uso del cotizador cargue archivos al bucket ni genere almacenamiento facturable sin una venta confirmada**. Caso habitual: PDF de 100–150 MB A1 para conocer su precio.

## Recorrido comercial aprobado como requisito (NO desplegado)
1. El cliente selecciona el PDF en el navegador. El archivo **permanece en el teléfono/PC**; leer páginas/medidas por File.slice + PDF.js local. Sólo enviar al servidor metadatos mínimos necesarios para calcular tarifas, no bytes ni fragmentos ni miniaturas.
2. Mostrar **presupuesto preliminar**. Para ploteos grandes, el modo CAD/Póster debe establecerse de modo confiable o preguntarse al cliente como declaración provisional, con revalidación técnica posterior; sin certidumbre no cobrar como precio definitivo.
3. El cliente decide pagar. El servidor crea pago **por el importe presupuestado**; Mercado Pago se verifica a través de webhook y consulta autenticada o transferencia con **acreditación bancaria real confirmada**. Ni el checkout creado ni el redirect del navegador equivalen a pago.
4. **Recién con pago confirmado y conciliado en Central D1**, una autorización de servidor vinculada a orden, importe ARS y pago no revertido habilita la recepción R2. No confiar en flag de JavaScript ni payload `paymentAuthorized` del cliente.
5. Tras la carga, SHA-256 y páginas/medidas se recalculan en servidor. Ante discrepancia entre presupuesto preliminar y datos reales, **no imprimir** ni aplicar cargo adicional sin nueva autorización; definir procedimiento claro de diferencia (preferible corrección y devolución si no se acepta nueva cotización).
6. Pedido pagado y PDF íntegro verificado: activar la Central, preparar copia de preprensa si es pesada y entregar. **Borrado de original y copias después de entregado**, cuota liberada y aborto/limpieza de multipart incompletos.

## Cotizador local para PDF grandes: lectura por fragmentos validada
- `medidas-pdf-file-local-rangos.mjs`: usa `File.slice()` en el navegador, no `file.arrayBuffer()` completo para PDFs >40 MiB; acoplado a `medidas-local-pdf.mjs`.
- `carga-unica-cliente.mjs`: para ploteos >40 MiB evita el clasificador visual que carga/rasteriza el PDF entero. El comprador debe elegir **CAD o Póster** para ver una cotización orientativa sin subir el PDF; se informa expresamente que luego habrá validación técnica. La pantalla de pedido privada continúa bloqueando >40 MiB hasta conectar compra postpago; **no se habilitó recepción incompleta**.
- Ensayo [Actions 42384272965](https://github.com/hernanchan/COTIZADOR/actions/runs/42384272965) **SUCCESS**: PDF sintético A1 **150 MiB**, `File.slice` **dos fragmentos, 131.072 bytes (128 KiB)**, dimensión 59,4 × 84,1 cm, **sin llamada a R2** ni `file.arrayBuffer()` completo.
- Regresión integral Worker/TUS [42384272999](https://github.com/hernanchan/COTIZADOR/actions/runs/42384272999) **SUCCESS**. Cambios en rama GitHub únicamente; no se desplegó a `saber-documentos-pruebas` ni a `libreriasaber.com.ar`.
- El cotizador local **no valida composición CAD/Póster de forma autoritativa**: la selección es una declaración del cliente, y no se habilita una compra real hasta completar reglas de diferencias/reembolso y verificación del backend. Cerrar este punto antes de comercialización.

## Guardia de costo YA implementada en rama de ensayo
- `integraciones/autocotizador/recepcion/r2-recepcion-solo-pagada.mjs` valida exclusivamente comprobante normalizado **emitido por backend Central**: misma orden, pago aprobado, `ARS`, monto positivo, fuente `CENTRAL_D1_RECONCILED`, verificación de MP/Banco, no reversión ni devolución, verificación reciente (≤300 s).
- `r2-pdf-grandes-api-privada.mjs` rechaza `/iniciar` antes de reservar cuota o invocar `createMultipartUpload`, y vuelve a comprobar pago antes de `/parte`, `/completar` y `/verificar`.
- Nuevo flag obligatorio `DOCS_R2_POSTPAY_REQUIRED=PRIVATE_TEST_ONLY` **no habilitado** en Worker desplegado. Sin él no se acepta R2 (HTTP 503). Aunque alguien active el flag manualmente, la API usa `comprobarPagoCentral=async()=>null` por defecto: **falla cerrada, HTTP 402**. El Worker real aún **NO** pasa un verificador de Central D1, por lo que no es posible subir PDFs mediante esta ruta comercial. Es intencional para proteger de gastos hasta terminar la conexión del pago.
- Nuevas pruebas `tests/r2-recepcion-solo-pagada.test.mjs` verifican pago pendiente, redirect, moneda incorrecta, reversión, devolución, falta de verificador, flag apagado, cobro por transferencia acreditada y revocación antes de subir partes. [CI 42383868839](https://github.com/hernanchan/COTIZADOR/actions/runs/42383868839) **SUCCESS**.
- **No se modificó `main`, sitio público, pagos reales, configuración R2, bucket ni variables Cloudflare.** Esta regla está escrita y probada sólo en GitHub, no activa en el entorno desplegado.

## Decisiones técnicas pendientes (bloquean publicar el NUEVO cotizador)
- Usar análisis realmente local por rangos en móvil para PDFs grandes, sin `file.arrayBuffer()` completo ni doble rasterización CAD/Póster.
- Preparar desde cliente un resumen para cotizar, y persistir provisionalmente el pedido/importe sin original.
- Integrar Central/MP: conciliación de pago y comprobante del servidor para desbloquear R2, con TTL de revalidación, pedido vinculado, cuota y límites.
- Subida TUS/R2 por tamaño **sólo después del pago** si se decide extender la regla a TUS; hoy esta compuerta se aplica sólo a R2 (pedido explícito del propietario).
- Definir diferencias de precio y reembolso tras analizar originales.
- Probar cliente que **abandona presupuesto**: debe dejar **cero objetos nuevos y cero reservas R2**; cliente pago: un solo pedido con original íntegro y preprensa segura.
- Garantizar que ningún archivo impago de pruebas anteriores quede permanentemente en el bucket; inspeccionar y ajustar limpieza sin tocar objetos de pedidos activos.

**Importante:** `pagoAprobadoParaR2` valida el **formato** de la constancia server-side y NO consulta por sí solo Mercado Pago. Para habilitar bytes hace falta implementar la consulta firmada de Central de punta a punta; está expresamente pendiente. Los costos de las lecturas de precios/API y el servicio R2 si excede cuotas gratuitas no son necesariamente cero; la regla elimina el almacenamiento R2 causado por usuarios que sólo cotizan.
