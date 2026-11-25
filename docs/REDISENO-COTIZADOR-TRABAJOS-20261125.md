# Rediseño del cotizador por trabajos — continuidad

**Fecha:** 25/11/2026 · **Estado:** desarrollo en rama; no publicado ni validado en operación real.

## Alcance trabajado

- PR de desarrollo: [#34](https://github.com/hernanchan/COTIZADOR/pull/34), rama `interfaz/cotizador-trabajos-propuesta-20261125`, base `interfaz/pc-pdf-compacto-20261124`.
- Se conservó el motor de cotización y se agregó el sidecar de trabajos para vincular archivos y trabajos sin incorporar campos de presentación al cálculo de precios.
- PC: crear trabajos, duplicar configuración sin archivos, cambiar nombre, seleccionar servicio comercial disponible, mover archivos entre trabajos del mismo servicio y editar por trabajo. Selector de trabajo, modo y opciones compartidas aparecen antes de la carga.
- Móvil: administración de trabajos, selección del servicio y modo compartido antes de cargar; resumen agrupado por trabajo y configuración común para documentos, manteniendo el tamaño por archivo.
- La elección de servicio en PC y móvil usa botones con selección destacada, alimentados solo por opciones habilitadas del catálogo LIVE; no se agregan productos o servicios desde la interfaz.
- Los servicios adicionales visibles se obtienen del catálogo LIVE: fotografía, corte y gráfica quedan deshabilitados si su catálogo no está disponible. Documentos/ploteos y stickers conservan las opciones ya existentes.
- La selección de páginas no se copia al duplicar un trabajo. Los grupos de anillado se aíslan por trabajo antes de pasar al único motor de cotización.
- El sidecar viaja en el flujo existente y conserva los grupos hasta el resumen de pedido, la Central y el manifiesto. El ZIP de R2 sigue disponible con preprensa pendiente según la decisión del titular; no se exige una aprobación física nueva antes de inspeccionar.

## Verificación

- `npm run build:unificado`: **SUCCESS**; incluye 127 pruebas de handoff, 4 pruebas E2E del Worker y 3 de sesión/cotización D1.
- Suite complementaria de interfaz/modelo y reglas comerciales: **50/50 aprobadas** antes de los últimos ajustes; 40/40 en una corrida focal anterior y **24/24 después del cambio a botones de servicio**.
- `npm run build:unificado`: **SUCCESS** luego de convertir la selección de servicios en botones; 127 pruebas de handoff, 4 E2E del Worker y 3 de cookies/precios D1 aprobadas, con builds completos.
- `node --check` para carga y validación; syntax check para JS de PC/móvil; `git diff --check`: aprobados.
- La validación visual de navegador sigue pendiente. El wrapper local de Chromium apunta a un ejecutable inexistente y el navegador remoto bloqueó abrir la maqueta local. No concluir que la interfaz fue validada visualmente en escritorio o móvil.
- No se publicaron recursos ni se desplegó Worker. No se hicieron pagos ni se usaron archivos de clientes.
- La vista previa automática de Pages asociada al PR abre la vidriera; desde ahí, el cotizador redirige a la ruta de pruebas del Worker y no carga la interfaz PC V10 del PR. No presentarla como vista de este rediseño.

### Actualización: subtotales por trabajo

- Se agregó un resumen por trabajo que reutiliza exclusivamente los subtotales y detalles devueltos por el cotizador comercial vigente; no calcula tarifas ni reparte descuentos.
- El anillado agrupado se suma al trabajo propietario solo si todos los archivos del grupo pertenecen a ese mismo trabajo. El reparto se oculta si no reconcilia exactamente con los subtotales de categoría del motor.
- El resumen se comunica al portal mediante el mensaje existente de precio orientativo, valida los datos recibidos y escribe nombres/importes con `textContent`. Ante una promoción, los importes por trabajo se identifican como previos al descuento global; el total general sigue siendo el importe final.
- Pruebas locales focales: **55/55** (modelo y resumen por trabajo, PC/móvil, cotización, handoff, grupos, Central/manifiesto y paquete operador). `node --check` de los dos módulos y `git diff --check`: aprobados.
- `npm run build:unificado` fue intentado; se detuvo porque este entorno no tiene instalada la dependencia de desarrollo `esbuild@0.24.2`. La compilación completa queda **pendiente de un entorno con esbuild**.

## Límites y riesgos pendientes

- El flujo conserva parte de la estructura previa; aún falta completar la propuesta integral de tarjetas progresivas para todos los servicios y verificar el resumen visual de precio/plazo por trabajo y la navegación final de datos/pago.
- El asistente móvil permite configurar opciones compartidas antes de la carga. Las excepciones por archivo y compatibilidad completa entre servicios requieren prueba de navegador.
- La vista previa ilustrativa de composición ya está implementada en el prototipo autónomo; todavía no está integrada en el cotizador comercial.
- No se verificó el código del Worker activo ni se cambió infraestructura. La integración final contra la versión comercial debe cotejarse con el release vigente al comenzar la etapa normal.
- La modificación de archivos protegidos requiere autorización personal del titular para el SHA final del PR conforme al contrato; no fusionar ni desplegar en Work.

## Próximo paso

Instalar/abrir un Chromium verificable en entorno de prueba autorizado, recorrer PC y móvil con archivos ficticios, corregir errores observados, revisar los cambios con el titular en el PR y solo luego preparar la integración técnica. La publicación en Cloudflare queda para el chat normal siguiendo el procedimiento de control de cambios y rollback.


## Actualización de continuidad — 25/11/2026

### Prototipo privado

- Se actualizó el Site privado `saber-cotizador-prototipo` (no es el cotizador comercial). Site source commit `13b8351e4fc125511ddfface34f6c5c56375bb71`; publicación reportada como exitosa en `https://saber-cotizador-prototipo.primetoast32.chatgpt.site/`.
- Verificación de navegador con dos archivos ficticios de planos: el panel ahora muestra un croquis de ploteo, salida y proporción orientativa. No analiza ni representa el PDF/PNG. El flujo sigue marcado como simulación; no hubo carga, orden ni pago real.

### Revisión de integración del PR #34 (solo lectura)

- El modelo nuevo aplana los trabajos al formato por archivo que ya consume `cotizarCargaUnica`; el resumen de trabajos agrega subtotales que devuelve esa misma cotización y solo se muestra si reconcilia con el total bruto del motor. La promoción continúa siendo global; no se calcula un segundo precio.
- La asociación trabajo/archivo viaja en un sidecar validado y la ficha de pedido conserva `trabajoPedidoId`/nombre, incluidos en el hash de la cotización. La Central vuelve a reconstruir los grupos por IDs de archivo antes del empaquetado. Esto es evidencia de estructura de código, no de un pedido real ni de la igualdad operativa del ZIP.
- Hallazgo pendiente frente al pedido UX: `aplicarConfiguracionComunAlDocumento` propaga modo, caras, copias, páginas por carilla y anillado, pero mantiene tamaño (`seleccion`) y páginas seleccionadas por PDF. La interfaz aún requiere definir cómo compartir tamaño con detección automática, compatibilidad explícita y excepciones; no cambiarlo silenciosamente.
- El flujo LIVE de la rama limita la recepción a 10 archivos, aunque una función común valida hasta 30. El diseño debe mostrar el límite comercial vigente y no prometer más hasta verificar el endpoint y paquete activos.
- La última nota de auditoría encontrada para el Worker de Documentos en `docs/INTEGRACION_PC_V10_COMERCIAL_20261124.md` registra la versión activa `07b17b59-0749-46ff-864c-c41a1b739f8d` después del despliegue V10 del 24/11. La base de PR #34 es `interfaz/pc-pdf-compacto-20261124` / `be6791e9cf3833b7e6d3e2ebf08a4e44f1138399`. El registro también reporta discrepancia entre hash del módulo activo y el artefacto fuente histórico; no acredita paridad exacta con esta base. No se ingresó a Cloudflare.
- Bloqueo de integración segura: localizar/recuperar en GitHub una fuente verificable del Worker activo más reciente, cotejarla con el código propuesto y preservar el circuito de pagos, manifiesto y ZIP. No sustituir por la rama base histórica por suposición.
- Estado del PR: borrador, sin merge ni publicación comercial. La autorización personal previa no cubre el SHA actual; el control `saber/contrato` debe ejecutarse sobre el commit final según el contrato.

### Próximo paso

Completar en rama aislada la configuración compartida de tamaño y compatibilidad con excepciones por archivo, resolver el límite de archivos desde la fuente LIVE verificable y agregar cobertura específica de pedidos mixtos, escalas/promoción, grupos de anillado por trabajo y correlación presupuesto-orden-ZIP. Luego repetir verificación visual PC/celular sobre la rama comercial correcta. Mantener producción intacta.
