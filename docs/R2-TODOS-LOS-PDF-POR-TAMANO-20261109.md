# R2 para cualquier PDF que supere 40 MiB — decisión 09/11/2026

**Regla obligatoria del titular:** elegir TUS o R2 únicamente según los bytes del archivo, no por el tamaño del papel ni servicio. A4, A3, apuntes, CAD y pósters tienen el mismo criterio.

- **Hasta 40 MiB (inclusive):** recepción TUS.
- **Más de 40 MiB y hasta 200 MiB:** transporte R2, con **presupuesto validado, pago acreditado y recién después subida**, sin originales almacenados si no hay pago.
- **Más de 200 MiB:** límite de la interfaz de prueba pendiente de ampliar/verificar. R2 no tiene un techo intrínseco de 200 MiB; el multipart subyacente declara 256 MiB, pero falta ampliar el flujo de cotización, cuotas y pago para cambiar el límite comercial.

**Estado preciso:** el transporte se decide ahora por bytes en `seleccionar-transporte-pdf.mjs` y la UI consulta esa decisión. **La ruta operativa de cobro/recepción R2 sigue aceptando solo UN ploteo completo por orden**: `r2-prepago-documentos.mjs` verifica `destino==='ploteos'`, Central registra `R2_PREPAID_PLOT`. Por tanto, **A4/A3 grandes, mezcla de tamaños y múltiples R2 todavía NO están habilitados**. No convertir documentos en ploteos para sortear esta barrera.

**P0 antes de publicación integral:** cotización y pago de documentos grandes en su clase correcta; Central capaz de registrar varios PDF grandes por pedido según cupos; reusar el uploader R2 ya validado; verificar archivo/SHA/preprensa, ZIP e instrucciones correctos; seguimiento, purga al Entregado y reanudación sin segundo cobro. Mantener costo R2 cero cuando el cliente abandona antes de pagar.

La nota de la interfaz «Un único ploteo PDF de 40–200 MiB ...» fue reemplazada por instrucciones simples al cliente. Cuando la capacidad no está disponible, se informa recepción especial/consulta, sin crear pedido o pago. No se tocó `main`, producción, ni se hicieron ensayos pagos.
