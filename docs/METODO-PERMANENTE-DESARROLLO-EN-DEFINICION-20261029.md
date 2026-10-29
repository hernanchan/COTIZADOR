# Método de desarrollo y experiencia del cliente — acuerdos vigentes (29-10-2026)

**Estado:** los acuerdos explícitamente confirmados por el usuario son criterios vigentes del proyecto. Los límites numéricos, los umbrales de tiempo y los detalles todavía pendientes siguen sujetos a validación. Este documento no autoriza despliegues ni publicación comercial.

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

- Está definida la **venta cerrada** (pago confirmado + archivos recibidos y verificados + Central consistente). Pendiente: implementar y ensayar el orden transaccional de estas operaciones y recuperación sin doble cobro.
- Límites operativos medidos para pedidos mixtos y umbrales de aceptación de rendimiento y experiencia.
- Formalización de criterios numéricos de rendimiento, protocolo operativo de releases y pruebas de aceptación para cada servicio.

## Estado técnico separado del método

Incidencia actual: recepción de dos PDF informada por interfaz, pero POST `/api/ensayo-preparar-documentos-v2-lote` devuelve HTTP 422 con mensaje genérico. La instrumentación de fase 422 está en código privado pero **no está desplegada**, según `docs/DIAGNOSTICO-502-LOTE-20261028.md`. No confundir acuerdo metodológico con resolución de este incidente.


## 29-10-2026 — Confirmación de venta y seguimiento futuro

- **Definición de venta cerrada, aprobada por usuario:** Mercado Pago confirma el pago, el sistema tiene los archivos efectivamente recibidos y un pedido consistente registrado en Central, listo para producción. Evitar cobrar sin archivos o permitir duplicaciones al recuperarse de fallos. La confirmación visible al cliente debe corresponder a ese estado real.
- **Funcionalidad futura solicitada para conservar, NO implementar ahora:** pantalla de seguimiento de pedido, inspirada en experiencia de compra de comida. Estados propuestos para evaluar: recibido/pagado, en preparación/producción, listo para retirar, entregado. No prometer plazos breves ficticios; fecha prometida sólo si confirmada. Se podría aprovechar el Centro de Pedidos como fuente única de estados, sin duplicar operaciones. Priorizar primero cierre de compra y recepción estable.
- Se confirma prioridad permanente de UX minimalista, velocidad y conversión. No introducir tracking en esta etapa ni usarlo como excusa para ampliar alcance actual. Pendiente de futura especificación: mecanismo seguro de consulta por cliente y actualización de estados.


## 29-10-2026 — Regla 9: facilidad y rapidez como puerta de aprobación UX

El usuario prioriza que los clientes **no abandonen por confusión, exceso de botones o demora**. La experiencia prevalece sobre la exposición de funciones. Acuerdo propuesto: tres acciones claras (cargar, revisar precio/opciones, pagar), una pantalla compacta de trabajo, configuración automática editable, avanzadas ocultas, precio y progreso siempre visibles, ninguna advertencia pequeña como bloqueo, no exigir reingreso de información ni repetir cargas. PDF grandes universitarios y pedidos escolares de PDF/imágenes mixtas deben usar el mismo carrito. 

**Criterio de validación UX:** ensayo con alguien ajeno al desarrollo que complete el pedido sin explicaciones, más medición de tiempo de carga, tiempo hasta precio, confirmación y abandonos. No dar por terminada una fase sólo con CI verde. Esta regla se incorpora al método en discusión; no autoriza rediseño/despliegue ahora ni sustituye integridad de pedido/pago.


## 29-10-2026 — Interfaz de decisiones contextuales, confirmada

El usuario ratifica que el producto debe ser **minimalista, interactivo y fácil de comprender**, con preguntas claras como el ejemplo «¿Cómo querés imprimir este archivo?» mostrado para el caso de dimensiones 20×20 cm. Principio aprobado: mostrar por defecto únicamente opciones comunes; proponer automáticamente una configuración razonable y permitir corregirla con preguntas visuales simples **solo cuando haga falta**. Mostrar configuraciones avanzadas bajo demanda, sin ocultar advertencias que impidan enviar. Si existen formatos mixtos, solicitar una decisión evidente en la misma fila/tarjeta, sin popups repetitivos, y conservarla para el pedido. Precio total, archivos y progreso accesibles en todo momento. Objetivo: bajar abandono por confusión, no multiplicar confirmaciones.

**Importante:** este acuerdo de producto no autoriza implementaciones ni modifica el error técnico 422 aún abierto. Pendiente: completar protocolo definitivo y acordar pruebas observables de facilidad de uso con clientes nuevos.


## 29-10-2026 — Tamaño real no implica A3: papel mínimo compatible

Nueva regla comercial/UX aportada por el usuario: ante un PDF que no es A4, formular una única pregunta visible: «Detectamos que tu archivo no es A4. ¿Querés que lo ajustemos o preferís imprimirlo en tamaño real?». **La elección de tamaño real conserva la dimensión física del contenido, no fuerza automáticamente el cobro A3.** El motor determina orientación y hoja mínima compatible: A4, Legal (misma tarifa que A4) o A3, considerando el área realmente imprimible y sin recortar contenido. Ejemplo: 20×20 cm se puede ubicar en una hoja A4 si la impresora/márgenes permiten esa anchura; no corresponde A3 por el mero hecho de no ser A4. Una hoja A3 solo se propone cuando el contenido no entra en A4 ni Legal sin escala no autorizada. Para PDF mixtos, examinar dimensiones por página, sin subir todo a A3 por una excepción; informar claramente al cliente la distribución y precio, y mantener la elección en el pedido para no volver a preguntar. Validar físicamente los márgenes de los equipos antes de codificar el umbral. Este acuerdo es **diseño**, aún no implementado ni ensayado. No altera precio de ploteos ni condiciones de pago.


## Acuerdo final de continuidad entre chats — 29-10-2026

- **Fuente de verdad:** este método de producto y trabajo, `AGENTS.md`, `docs/PROMPT_BASE_CONTINUIDAD.md`, el registro de etapa `docs/ETAPA1-IMPRESIONES-PLOTEOS-CIERRE.md`, el plan de concurrencia `docs/PLAN-LOTE-CONCURRENTE-PDF-20261028.md` y la incidencia vigente `docs/DIAGNOSTICO-502-LOTE-20261028.md`. Consultar primero la documentación, no reiniciar investigación desde memoria.
- **Prioridad comercial invariable:** cerrar ventas con la menor fricción posible. No sumar botones, pantallas, popups, verificaciones o pasos salvo justificación concreta. La interfaz muestra una lista compacta de archivos configurable por fila, con opciones avanzadas a demanda; se aprueba el principio UX, mientras sus detalles operativos deberán probarse.
- **Disciplina de ingeniería:** no alterar el método ante observaciones puntuales ni complacer automáticamente; evaluar su efecto. Diagnosticar antes de editar, probar sin desplegar, agrupar correcciones, separar preparación/despliegue/ensayo real y usar pocas intervenciones humanas. Una mejora solo se da por validada cuando supera un ensayo completo, funcional y de UX.
- **Estado técnico verdadero al registrar:** Worker privado `625a9f5a-cb9f-43a7-bcb3-94d2c4c545ba` promovido según confirmación del usuario, GAS receptor versión 8 informada por capturas; dos PDF aparecen recibidos en la interfaz, total preliminar $6.980, pero `POST /api/ensayo-preparar-documentos-v2-lote` devolvió **HTTP 422**. Pedido D1 **NO confirmado**, cobros apagados. Instrumentación de `reasonCode` por fase del 422: código `9210cb76`, test añadido `f229abaf`, **no compilado en CI ni desplegado aún**. Referencia de reversión conocida `b7f58caf-7ca4-4abf-8e05-9694fa9593fd`.
- **Próxima tarea técnica:** revisar integralmente la ruta de preparación/validación/manifiesto/Central antes de otro despliegue; corregir causas sustentadas en código y tests, ejecutar pruebas automatizadas y compilar. Preparar versión privada identificada sin activar; promocionar solo tras verificación y ensayar una única vez los dos PDF, buscando un único pedido D1 y precio confirmado. No pedir al usuario que vuelva a seleccionar A4, reenvíe repetidamente o haga capturas sin necesidad concreta. No tocar `main`, `libreriasaber.com.ar`, Polaroids ni cobros.
- **Mejora diferida:** seguimiento de estado de pedido accesible al cliente, basado en Central, sin promesas artificiales de entrega. No implementar ahora.
