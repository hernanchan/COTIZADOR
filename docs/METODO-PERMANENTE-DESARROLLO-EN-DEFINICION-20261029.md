# Método de desarrollo — acuerdos en definición (29-10-2026)

**Estado: borrador de decisiones consensuadas, NO implica modificar la hoja de ruta técnica ni activar deploy.** Se completará luego de discutir los criterios restantes con el usuario y se vinculará desde el índice de continuidad.

## Objetivo comercial

Librería Saber ya cuenta con procesos físicos de impresión consolidados. La nueva web debe **cerrar ventas**, no ser una demostración técnica: minimizar abandono, cotizar claramente, cobrar mediante Mercado Pago cuando corresponda y entregar al negocio pedidos pagados, completos y listos para producir. Una prueba de código exitosa no demuestra conversión ni experiencia satisfactoria.

## Acuerdos de método (en conversación)

1. **Desarrollo vertical por servicio, con arquitectura y circuito integral comunes.** Cada servicio se considera terminado sólo cuando cotización, recepción, registro y experiencia están verificados. Reutilizar lo existente; no empezar de cero ni cambiar el método por cada incidente.
2. **Diagnóstico antes de cambios:** investigar causa, revisar implicaciones, agrupar correcciones, ejecutar pruebas automatizadas, preparar y desplegar versión privada controlada, y hacer un ensayo real. No usar al usuario como depurador en ciclos de micro-deploy. No atribuir un error a una causa sin evidencia.
3. **Roles:** el usuario dirige prioridades, experiencia y producto, interviene para validación comercial y accesos indispensables; el asistente asume análisis técnico, implementación, pruebas y documentación mediante herramientas disponibles. El desacuerdo es legítimo: las observaciones se evalúan, no se aceptan automáticamente.
4. **Rendimiento y seguridad:** controles necesarios para integridad de PDF, páginas, precio, pedido, acceso y cobro; evitar repeticiones redundantes. No confiar sólo en la pasarela de pagos para integridad de pedidos. Medir tiempos por etapa y comportamiento multiarchivo; no prometer una latencia universal antes de medición. Prioridad al tiempo de carga y al avance de varios archivos.
5. **Pedidos reales heterogéneos:** universitarios con PDF extensos; hogares de primaria que combinan PDF pequeños, JPG/PNG, color y B/N. Un carrito único debe admitir mezcla, impresión individual o imágenes agrupadas (por ejemplo 2/4/9 por hoja) con total visible. No fijar límite universal de 10 archivos sin distinguir cantidad, tipo, peso y complejidad; evaluar límite inicial 10 PDF y 30 imágenes como hipótesis, no decisión definitiva.
6. **UX y funcionamiento juntos:** para cada servicio definir experiencia y circuito técnico y desarrollarlos integrados. Interfaz minimalista, clara, concisa, accesible para no expertos; precio visible, un botón, progreso comprensible, opciones relevantes, detección automática corregible. Advertencias como PDF de 20×20 cm deben provocar una elección visible o sugerencia A4, no bloquear silenciosamente. Evitar paneles extensos y decisiones técnicas expuestas al cliente.
7. **Criterio de éxito:** capacidad de completar compra y entregar pedido pagado a producción; medir éxito real de compra, velocidad y errores, no sólo tests. El usuario reafirma que desea vender por experiencia del cliente y rapidez.

## Decisiones pendientes

- Orden concreto de pago, recepción definitiva de archivos y confirmación del pedido; definir cuándo una venta se considera cerrada y cómo recuperar fallos sin cobrar dos veces.
- Límites operativos medidos para pedidos mixtos y umbrales de aceptación de rendimiento y experiencia.
- Formalización final del protocolo de releases, pruebas y cierre y enlace desde `docs/PROMPT_BASE_CONTINUIDAD.md` una vez aprobado.

## Estado técnico separado del método

Incidencia actual: recepción de dos PDF informada por interfaz, pero POST `/api/ensayo-preparar-documentos-v2-lote` devuelve HTTP 422 con mensaje genérico. La instrumentación de fase 422 está en código privado pero **no está desplegada**, según `docs/DIAGNOSTICO-502-LOTE-20261028.md`. No confundir acuerdo metodológico con resolución de este incidente.
