# Rediseño del cotizador por trabajos — continuidad

**Fecha:** 25/11/2026 · **Estado:** desarrollo en rama; no publicado ni validado en operación real.

## Alcance trabajado

- PR de desarrollo: [#34](https://github.com/hernanchan/COTIZADOR/pull/34), rama `interfaz/cotizador-trabajos-propuesta-20261125`, base `interfaz/pc-pdf-compacto-20261124`.
- Se conservó el motor de cotización y se agregó el sidecar de trabajos para vincular archivos y trabajos sin incorporar campos de presentación al cálculo de precios.
- PC: crear trabajos, duplicar configuración sin archivos, cambiar nombre, seleccionar servicio comercial disponible, mover archivos entre trabajos del mismo servicio y editar por trabajo.
- Móvil: administración de trabajos, selección del servicio antes de cargar, resumen agrupado por trabajo y modo compartido para configurar una vez los documentos del grupo, manteniendo el tamaño por archivo.
- Los servicios adicionales visibles se obtienen del catálogo LIVE: fotografía, corte y gráfica quedan deshabilitados si su catálogo no está disponible. Documentos/ploteos y stickers conservan las opciones ya existentes.
- La selección de páginas no se copia al duplicar un trabajo. Los grupos de anillado se aíslan por trabajo antes de pasar al único motor de cotización.
- El sidecar viaja en el flujo existente y conserva los grupos hasta el resumen de pedido, la Central y el manifiesto. El ZIP de R2 sigue disponible con preprensa pendiente según la decisión del titular; no se exige una aprobación física nueva antes de inspeccionar.

## Verificación

- `npm run build:unificado`: **SUCCESS**; incluye 127 pruebas de handoff, 4 pruebas E2E del Worker y 3 de sesión/cotización D1.
- Suite complementaria de interfaz/modelo y reglas comerciales: **50 pruebas, 50 aprobadas** antes de los últimos ajustes; luego, suite focal de UI actualizada: **23 pruebas, 23 aprobadas**.
- `node --check` para carga y validación; syntax check para JS de PC/móvil; `git diff --check`: aprobados.
- Las pruebas Playwright de navegador **no se pudieron ejecutar**. El entorno no tenía Chromium; descarga oficial de Playwright respondió HTTP 403. No concluir que la interfaz fue validada visualmente en escritorio o móvil.
- No se publicaron recursos ni se desplegó Worker. No se hicieron pagos ni se usaron archivos de clientes.

## Límites y riesgos pendientes

- El flujo conserva la estructura previa de interfaz; aún falta completar la propuesta integral de tarjetas progresivas para todos los servicios, vista previa de archivo, resumen visual de precio/plazo por trabajo y navegación final de datos/pago.
- El asistente móvil permite configuración compartida para documentos, pero las excepciones por archivo y compatibilidad completa entre servicios requieren prueba de navegador.
- No se verificó el código del Worker activo ni se cambió infraestructura. La integración final contra la versión comercial debe cotejarse con el release vigente al comenzar la etapa normal.
- La modificación de archivos protegidos requiere autorización personal del titular para el SHA final del PR conforme al contrato; no fusionar ni desplegar en Work.

## Próximo paso

Instalar/abrir un Chromium verificable en entorno de prueba autorizado, recorrer PC y móvil con archivos ficticios, corregir errores observados, revisar los cambios con el titular en el PR y solo luego preparar la integración técnica. La publicación en Cloudflare queda para el chat normal siguiendo el procedimiento de control de cambios y rollback.


## Prototipo navegable independiente

- Archivo: [prototipos/cotizador-trabajos.html](../prototipos/cotizador-trabajos.html). Es una maqueta autónoma HTML/CSS/JS, adaptable a PC y celular, con inicio, selección de servicio, configuración, carga local de archivos, creación/duplicación/edición/eliminación de trabajos, resumen de pedido y pantalla final simulada.
- Los precios, catálogo, promociones, plazos, páginas detectadas y advertencias son ficticios. La selección de archivos solo lee nombres y tamaños en el navegador: no se sube ni guarda información; no crea órdenes ni habilita pagos.
- Validación disponible: script JavaScript embebido supera `node --check`; `git diff --check` no informa errores. No se verificó en navegador: el navegador aislado no alcanza el servidor local del entorno (conexión rechazada). No presentarlo como revisión visual de PC/celular.
- El archivo queda en la rama del PR #34 para descarga y revisión. No se desplegó en el negocio ni en Cloudflare.
