# V11 — simplificación de configuración PC, 24/11/2026

Base comercial: V10 activa, versión Documentos 07b17b59-0749-46ff-864c-c41a1b739f8d. Rama aislada V11 y PR #28. No se modifica producción ni se integra todavía.

Requisitos: tamaño y cantidad visibles sin guardado individual, configuración masiva de imágenes con excepciones, detección vigente de medidas PDF y CAD/Póster > A3, conservación de escala original CAD y proporciones, papel y precio automático, miniaturas y advertencias agrupadas con consentimiento explícito. El titular descartó recuperar pedidos interrumpidos. Mantener experiencia móvil, tarifas, pagos, recepción y Central.

Evidencia: sondeo 45396208377 y 45396361833, exitosos sobre módulo original recuperado de versión V10 activa y tarifario aprobado de D1 (lectura exclusiva); dos JPG sintéticos. La transformación real de imagen a A2 genera PDF de 59,4 × 42 cm, modo poster, selección original; la cantidad 3 aparece correctamente en solicitud al motor. La advertencia de 51 PPP requiere consentimiento; la UI nativa cambia el nombre del PDF y conserva el papel. Sin pedidos, cobros ni cargas de originales a servicios.

Código inicial: pc-v11-configuracion-directa.js.txt y .css.txt. Usa controles nativos, no un motor de precios alternativo. La nueva interfaz es un candidato, no un producto probado. Se inició ensayo 45396785250 de cinco JPG, 3 copias, cinco A2 y después dos excepciones A1, validando los 15 ejemplares por payload. Aún no hay confirmación de éxito. Pendientes: corregir hallazgos de dicho ensayo, completar paridad PDF/CAD, formatos, modo común, opciones comerciales especiales, tamaños modificados y advertencias, móvil y puente de preparación; verificar miniaturas; preparar capa de despliegue reversible y autorización exacta. No activar ni anunciar como publicado antes de estos controles.

La V10 queda activa; no solicitar nuevas pruebas manuales repetidas al titular durante el desarrollo.

## Avance de validación

- Ejecución 45398780094: APROBADA, cinco imágenes A2 con tres copias cada una, posteriormente dos A1, 15 impresiones; consentimiento explícito de cinco advertencias y payload de cotización con dimensiones y modo poster correctos. Sin pago ni pedido.
- Ejecuciones posteriores 45398913797 y 45398989318: FALLIDAS tras ajuste adicional; quinta advertencia no alcanzó el estado esperado. No extrapolar el éxito del ensayo anterior a ese código. Se recuperó la secuencia aprobada en 5285c0c4f69becc1586037914474d75915eb212c, conservando visibilidad de advertencia individual. Revalidación 45401019642 e independiente PDF 45401052537 iniciadas, resultado todavía pendiente. PR #28 retarget a rama V10 para mostrar solamente cambios V11; no fusionar ni publicar sin aprobación final.
