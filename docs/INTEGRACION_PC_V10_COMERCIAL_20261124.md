# Integración aislada PC V10 sobre código comercial — 24/11/2026

## Objetivo y alcance

Mantener intacto el motor comercial de documentos y sustituir **solo la presentación de escritorio** mediante la interfaz V10 validada en el ensayo anterior. No reimplementar cotización, D1, Mercado Pago, transferencias, TUS, R2, Central ni seguimiento. No modificar el asistente móvil de seis pasos.

- Repositorio: `hernanchan/COTIZADOR`
- Rama base comercial leída: `integracion/tus-pedido-privado-20261101` (commit inicial `367938a241529e0cf70e7c124d8d5599b6ca4250`).
- Rama aislada: `integracion/pc-v10-comercial-aislada-20261124`.
- V10 original: `interfaz/pc-compacta-lote-20261120`, PR #26.
- **Producción: sin modificación, sin desplegar, sin cobros ni cargas en esta integración.**

## Arquitectura verificada en código

El portal comprador actual usa `pagina-cotizar-live.mjs` como contenedor de precio, plazo, datos y pago. Dentro del iframe `/cotizar/archivos`, `pagina-archivos-live.mjs` monta `paginaCargaUnica()` con `/cotizar/archivos.js` como analizador de documentos. El móvil añade `/cotizar/movil.js` y el contenedor recibe `SABER_SMART_PRICE_STATE`, `SABER_SMART_RESIZE` y `SABER_SMART_UNIVERSAL_PDF`.

La V10 de ensayo estaba sobre un motor más antiguo y tenía un panel de presupuesto propio. En el portal comercial el presupuesto y el CTA ya pertenecen al contenedor externo, por lo que ese panel se oculta **solo para la variante PC opt-in**. Las cotizaciones siguen siendo responsabilidad del motor existente y la página madre; no se agrega una segunda tarifa.

## Cambios implementados

1. `pc-v10-comercial.js.txt` y `pc-v10-comercial.css.txt`: archivos de interfaz PC añadidos como recursos, importados como texto por la compilación habitual del Worker. Solo activan pantalla grande con apuntador preciso, para no interferir con el asistente móvil.
2. `pagina-archivos-live.mjs`: con `previewPcV10:false` devuelve exactamente el HTML anterior; con `true` agrega stylesheet y script de PC, sin quitar analizador ni asistente móvil.
3. `pagina-cotizar-live.mjs`: propagación explícita de `?pc=v10` al iframe **solo** si `DOCS_LIVE_PC_V10_PREVIEW_GATE=PRIVATE_TEST_ONLY`. En esa vista `enabled=false` para confirmar pedido o habilitar pago; precio/lectura siguen conectados al motor comercial existente.
4. `worker-fase4-cotizador-unificado.mjs`: rutas `/cotizar/pc-v10.js?pc=v10` y `/cotizar/pc-v10.css?pc=v10` bajo los gates LIVE, sesión de comprador y el nuevo gate de preview; con el gate apagado retornan 404. La CSP anterior se conserva con el gate apagado.
5. `tests/pc-v10-comercial-integracion.test.mjs` y `.github/workflows/saber-pc-v10-comercial-integracion.yml`: regresión de la ruta normal, móvil, compuerta, ausencia de checkout en preview y compilación completa sin despliegue.
6. `tests/pc-v10-comercial-chrome-local.mjs`: prueba en Chrome con HTML/JS del analizador comercial de esta rama y PDF sintéticos. **Toda petición a `pedidos.libreriasaber.com.ar` se intercepta localmente.** El endpoint de precio se simula como indisponible a propósito, por lo que no valida tarifas comerciales ni habilita pedidos.

## Evidencia y límites

- GitHub Actions #45375038270: 8/8 pruebas propias de integración, 14/14 de la página LIVE, 11/11 de móvil, 127/127 tests de handoff existentes, compilación completa del Worker y pruebas E2E de fuente, todo sin despliegue.
- **Prueba de Chrome con motor comercial de la rama aprobada**: [GitHub Actions #45376066258](https://github.com/hernanchan/COTIZADOR/actions/runs/45376066258) SUCCESS. Un PDF no estándar deja los controles de tamaño a 24 px de la zona de carga; cinco PDF permiten tamaño único y configuración compartida. CTA de confirmar pedido deshabilitado. Se interceptaron localmente 35 solicitudes al dominio comercial; no se enviaron archivos, pedidos ni cobros. **El cálculo de precios no se prueba**: se devuelve HTTP 503 simulado de manera intencional.
- **No se ha comprobado todavía que el Worker actualmente desplegado sea byte a byte idéntico al código de esta rama histórica de integración.** Esa diferencia debe medirse antes de una eventual promoción.
- Las pruebas con documentos sintéticos y rutas simuladas **no** equivalen a una operación comercial auténtica.

## Próximas comprobaciones imprescindibles

1. Confirmar el estado/vigencia de las versiones de ambos Workers comerciales, **solo lectura**, y cotejar con fuente GitHub.
2. Ensayar visualmente PC con el motor comercial actual en un entorno controlado con tarifas vigentes, pero **sin habilitar recepción ni cobros**.
3. Validación del titular y autorización manual exigida por el contrato de control de cambios para el commit final, previo a cualquier publicación.

Este documento no autoriza un cambio de producción ni el encendido del nuevo gate.
