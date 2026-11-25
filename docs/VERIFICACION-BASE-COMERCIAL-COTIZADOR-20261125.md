# Verificación de la base comercial del cotizador

**Fecha:** 25/11/2026. **Fuente:** registros y logs de GitHub Actions. Lectura únicamente; no se ingresó al panel de Cloudflare ni se lanzó una acción.

## Publicación confirmada

Ejecución [#45523772642](https://github.com/hernanchan/COTIZADOR/actions/runs/45523772642), commit `be6791e9cf3833b7e6d3e2ebf08a4e44f1138399`, job `publicar`: **SUCCESS**.

La salida registra:

- Worker `saber-documentos-produccion`, versión `3c064905-74b9-4613-9908-4c5f4a8357f6`.
- Rollback registrado: `02503412-563f-48a3-a5bd-6d25107f8256`.
- `31_BINDINGS_V10_CONSERVADOS; MODULO_ORIGINAL_EXACTO`.
- `PC_PDF_COMPACTO_DEPLOY_OK ... PAGOS_INTACTO`.
- Smoke checks: `/cotizar` 200; `/cotizar/archivos` 503 esperado; `/pedido/continuar` 200; `/pedido/estado` 200; inspección privada 401.

El workflow comparó los tres recursos de interfaz con las fuentes del commit `e688f42c5b09dc1e3efaaf079c703d531071ede6` antes de activar. El módulo principal y los bindings se preservaron desde la versión previa. Esto confirma la base V10 PC; el rediseño por trabajos del PR #34 no forma parte de esa publicación.

La nota previa en `docs/INTEGRACION_PC_V10_COMERCIAL_20261124.md` que listaba `07b17b59-0749-46ff-864c-c41a1b739f8d` era una referencia anterior de integración, no la última publicación confirmada. El job citado arriba confirma la versión posterior indicada por el usuario.

## Implicación para el rediseño

La base de PR #34 (`be6791e9...`) sí es el commit de la publicación V10 verificada. Se puede continuar el desarrollo en rama aislada sin reemplazar el motor. Sin embargo, el código del rediseño sigue siendo una propuesta: antes de integrarlo hay que conciliar las funciones compartidas por trabajo, compatibilidad de tamaños por archivo y el límite de carga. La estructura de trabajos y los subtotales no prueban por sí solos que presupuesto, orden y ZIP coincidan operativamente.

El workflow de publicación mostró que el Worker original se heredó directamente de la versión previamente activa; no adjuntó un artefacto descargable. Para cambios futuros del motor de negocio, no reconstruir el módulo original por aproximación. Limitar la integración visual a los recursos de interfaz y contratos existentes, y documentar cualquier símbolo o ruta cuya fuente no esté versionada.

## Estado

- Publicado y confirmado por registro de GitHub Actions: V10 PC, versión arriba indicada.
- Desarrollado: prototipo privado e implementación parcial por trabajos en PR #34.
- Aún no integrado, no publicado, no validado visualmente en navegador en este entorno: rediseño por trabajos.
