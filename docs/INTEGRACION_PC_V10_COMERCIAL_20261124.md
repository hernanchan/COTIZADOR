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

## Auditoría de producción por lectura (24/11/2026)

- [GitHub Actions #45376600509](https://github.com/hernanchan/COTIZADOR/actions/runs/45376600509), job `auditar-worker-publicado-solo-lectura`: GET de Cloudflare. Worker documental `saber-documentos-produccion`, versión única al 100% `52585d3a-6d3d-42bb-9f1f-a809811383b7`.
- SHA256 del módulo JavaScript activo: `c8f04928d6e0ad8885a174e34ac1ccebf461a47d3775cb83bf2bccd1ffc802f6`.
- SHA256 de `dist/saber-documentos-cotizador-fase4.mjs` guardado en la rama base: `9b1b35adf84eb7414211d1ccf540296f136304a7b375a49626bcc0a0682e51e9`. **Distintos.**
- Hay un mapa de fuentes remoto, pero las tres fuentes de interés (página comercial, adaptador iframe y Worker unificado) no aparecen bajo nombres comparables; por lo tanto **no es posible declarar paridad byte a byte ni disparidad funcional** solo con esa evidencia.
- No se cambió ninguna versión de Cloudflare, gate, binding, clave, tarifa, ruta comercial ni cobro. La verificación de vigencia exacta de fuentes sigue pendiente. No publicar ni interpretar esta diferencia como fallo del sistema.

## Próximas comprobaciones imprescindibles

1. Confirmar el estado/vigencia de las versiones de ambos Workers comerciales, **solo lectura**, y cotejar con fuente GitHub.
2. Ensayar visualmente PC con el motor comercial actual en un entorno controlado con tarifas vigentes, pero **sin habilitar recepción ni cobros**.
3. Validación del titular y autorización manual exigida por el contrato de control de cambios para el commit final, previo a cualquier publicación.

Este documento no autoriza un cambio de producción ni el encendido del nuevo gate.

## Segunda auditoría de seguridad — 24/11/2026

- Workflow aislado `.github/workflows/saber-pc-v10-paridad-produccion-readonly.yml`, commit `b5b11d1c57d81140892b410b2bbbc8690f7908aa`, [ejecución 45378875683](https://github.com/hernanchan/COTIZADOR/actions/runs/45378875683). Lectura GET de Cloudflare; sin despliegue, cambios de compuertas, cobros, D1, R2 ni TUS. Las fuentes remotas se procesaron en el runner y no se publicaron como artefactos ni en logs.
- Documentos: versión activa única al 100% `52585d3a-6d3d-42bb-9f1f-a809811383b7`; binding a Central de producción confirmado. Pagos: versión activa única al 100% `d2f09188-3ab4-4bf7-802b-8fb87f727530`; binding D1 confirmado.
- Ninguno de los dos artefactos históricos de referencia coincide exactamente con los módulos o candidatos de sourcemap recuperados. No se encontraron las tres fuentes individuales de Documentos bajo nombres comparables. La comparación estructural AST dio escasa coincidencia, pero **no permite medir diferencias funcionales** debido a compilación, minificación y reempaquetado. Tampoco se encontraron los recursos JS exactos en el dist histórico ni en el remoto con el método de búsqueda usado; resultado inconcluso, no ausencia de funcionalidad.
- **Decisión de seguridad: no reinstalar el paquete histórico de GitHub ni modificar el Worker de Pagos.** Identificar/reconstruir una base verificable del Worker Documentos activo antes de portar únicamente V10; no perder cambios operativos posteriores a la rama comercial. Mantener la prueba con tarifas en entorno controlado sin pedidos ni cobros y la autorización manual de PR/SHA final.

## Ensayo sobre copia exacta del Worker activo — 24/11/2026

- Workflow `.github/workflows/saber-pc-v10-ensayo-base-activa.yml`, commit `b70494845d59300cba2a043b031afcc8859361d8`, [ejecución 45379916190](https://github.com/hernanchan/COTIZADOR/actions/runs/45379916190). Sin deploy ni cambios en producción.
- Método: recuperar por GET exclusivamente la versión activa previamente identificada y exigir la coincidencia SHA-256 del módulo real; ejecutar localmente sin credenciales de Cloudflare ni bindings de producción, con sesión ficticia, recepción de pedidos desactivada y fetch del Worker bloqueado.
- Objetivo: comprobar las respuestas HTML/JS originales y los puntos de anclaje V10, añadir únicamente una capa visual reversible de CSS/JS al iframe en memoria, probar uno y cinco PDF sintéticos en Chrome y comprobar que el móvil no incorpora la capa. El navegador intercepta las peticiones al dominio comercial, bloquea operaciones y simula indisponibilidad de precio; no valida tarifas reales. No se publica ni persiste el código remoto; se elimina la copia temporal.
- Estado al iniciar: ejecución en curso; no equivale a una integración desplegable ni aprobada. La autorización de publicación permanece pendiente.

### Resultado del ensayo 45379916190

APROBADO en el runner: versión y SHA-256 del módulo activo exactos; cinco rutas originales del Worker respondieron HTTP 200 bajo sesión ficticia local. El iframe original se recuperó byte por byte al retirar CSS/JS añadidos. Chrome: un PDF, controles a 24 px; cinco PDF, disponibilidad de configuración común; vista de 390 px sin capa PC. 16 solicitudes de cotización simuladas con 503 intencional, 3 peticiones bloqueadas. Sin operaciones reales, sin despliegue y sin copia remota publicada. Pendiente: probar cotización con datos tarifarios reales en un circuito aislado y preparar un parche desplegable con rollback verificable, sin reemplazar el código activo por el histórico.

## Ensayo de paridad tarifaria — 24/11/2026

- Workflow `.github/workflows/saber-pc-v10-paridad-precios-activos.yml`, commit `1e44f74215c3d6923bf11543f9e4743d69483bb0`, [ejecución 45382643778](https://github.com/hernanchan/COTIZADOR/actions/runs/45382643778).
- Se recupera la versión exacta activa de Documentos y se consulta exclusivamente la revisión aprobada del tarifario comercial de D1 (SELECT sobre cabecera e historial de tarifas; no se leen pedidos ni datos de clientes). La instantánea se usa como respuesta local del binding de precios ficticio; sin tokens ni bindings reales durante el ensayo.
- Objetivo: comparar opciones y precio visible entre la interfaz original y V10 con cinco PDF sintéticos, blanco y negro doble faz, dos copias, y color simple faz, una copia. Las cotizaciones las calcula el Worker activo ejecutado localmente; la red comercial, pago y recepción quedan bloqueados. Sin alterar tarifas, sin publicar instantáneas, sin desplegar.
- La aprobación de esta prueba no sustituye la validación de un parche desplegable y el rollback. Mantener intacto el Worker Pagos. El PR #27 sigue en borrador, no autoriza publicación.

### Resultado de paridad con tarifas reales

- La primera ejecución 45382643778 recuperó revisión 2 pero el recorrido de prueba no encontraba los controles comunes. No hubo prueba de precio fallida: se corrigió la secuencia de resolución de tamaños.
- [Ejecución 45382926373](https://github.com/hernanchan/COTIZADOR/actions/runs/45382926373), commit `bbbb50adae32048468ba5461a9ae864227e513a8`: **paridad aprobada en navegador** con la copia exacta de Documentos y revisión D1 aprobada 2. Cinco PDF, B/N doble faz 2 copias y color simple faz 1 copia: mismo precio visible y mismo payload comercial normalizado en original y V10. 44 cotizaciones locales, 48 lecturas de la instantánea, 4 peticiones bloqueadas. No se enviaron archivos a producción ni se cobraron pedidos.
- Preparada capa reversible `integraciones/autocotizador/recepcion/pc-v10-capa-reversible.mjs` (commit `df52e667fd1b61f64370a9179f8651d5df5d8aa3`), gate independiente `DOCS_LIVE_PC_V10_GATE` apagado por omisión. Delega al Worker original, decora solo respuesta HTML autorizada de /cotizar/archivos si coincide contrato, conserva CSP, no toca rutas ni lógica de pedidos. Tests unitarios `tests/pc-v10-capa-reversible.test.mjs`; nueva comprobación sobre copia activa y navegador en commit `7b249516603c54baa6bb8f6f276c2fff2606466c`. Estado: pendiente de evidencia de esa ejecución, sin deploy.
- Retroceso previsto: desactivar la capa y restaurar versión anterior de Documentos (versión identificada 52585d3a-6d3d-42bb-9f1f-a809811383b7, comprobar vigencia antes de cualquier publicación); no tocar Pagos ni D1. No activar hasta validar el mecanismo, definir empaquetado/despliegue con bindings conservados y obtener aprobación manual del SHA final en PR #27.

### Validación final del paquete modular — 24/11/2026

[Ejecución 45384044307](https://github.com/hernanchan/COTIZADOR/actions/runs/45384044307), código de ensayo `42a25cf90223c7af9b3f9fded87c17155de19af9`: APROBADA. Se empaquetó localmente el Worker exacto con un módulo de entrada y capa V10 adicionales, conservando el módulo original sin recompilar ni alterar su SHA256. 7/7 tests de seguridad; gate OFF devuelve HTML idéntico; sesión y CSP conservadas; cinco PDF con todos los tamaños resueltos y guardado común confirmado; igualdad de precio y opciones en B/N y color con D1 revisión 2; móvil sin capa; 44 consultas locales, 49 lecturas de instantánea, 5 peticiones bloqueadas. El fallo 45383134252 se debió a que el ensayo cargaba archivos antes de que se inicializara el analizador; se esperó su catálogo y se verificó nuevamente. Sin despliegue ni cambios en producción. Pendiente: mecanismo de publicación modular controlado, comprobación de configuración/bindings heredados y autorización manual antes de publicar.

## Mejoras de usabilidad posteriores a V10 (decisión del titular, 24/11/2026)

- Situación comercial informada: clientes tienen dificultades para configurar trabajos; caso concreto de una imagen que se quería imprimir en A2. El operador logró configurarla pero el recorrido no resulta intuitivo para un comprador primerizo.
- Se acuerda continuar con V10 como base modificable, sin mezclar en este release una revisión del motor de ploteos/ampliaciones.
- Pendiente prioritario de UX posterior: evaluar por separado documentos comunes, planos CAD a tamaño original/escala, e imágenes/pósteres. No imponer formato personalizado deformando imágenes ni cambiar escala CAD. Cuando no coincidan proporciones, evaluar previsualización de encaje con márgenes frente a recorte explícito; no autorizar recorte automático. Las dimensiones y el formato deben confirmarse sin modificar tarifas ni reglas comerciales por omisión.
- Estado: propuesta para análisis, no cambio implementado. No dar por decidido el diseño exacto hasta revisar el circuito vigente y casos reales. No retrasar V10 por esta propuesta.

## Publicación comercial V10 — 24/11/2026

**Estado: DESPLEGADA EN PRODUCCIÓN.** Autorización personal del titular en PR #27 para SHA `b4d90b9206fd1bad270eb973894967989e800ae8`, control `saber/contrato` aprobado en ejecución 45389550088. [Despliegue 45389514837](https://github.com/hernanchan/COTIZADOR/actions/runs/45389514837), intento 2, job 138430939068: SUCCESS. A las 09:04:49 ART se confirmó la versión activa de Documentos `07b17b59-0749-46ff-864c-c41a1b739f8d`; versión anterior para rollback `52585d3a-6d3d-42bb-9f1f-a809811383b7`. Se verificaron los 30 bindings originales más el gate V10 y la identidad del módulo original; Pagos permaneció intacto. Comprobaciones HTTP comerciales y de acceso completadas. No se efectuó un pedido ni un cobro nuevo durante la publicación. Pendiente: validación de experiencia por el titular y compradores reales; revisar dificultad A2 y ampliaciones como siguiente mejora independiente. El SHA de publicación es el autorizado arriba, no el commit documental posterior. No fusionar el paquete histórico como reemplazo de producción.
