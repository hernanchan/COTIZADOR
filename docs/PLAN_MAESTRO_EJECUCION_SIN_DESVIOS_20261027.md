# Plan maestro de ejecución — Proyecto Integral Nueva Web
**Librería Saber · 27/10/2026 · rama de trabajo: `polaroids/express-pdf-unico-20261023`**

## Regla principal
Objetivo: entregar el sistema original + V2 completamente integrado y verificable para uso comercial, **sin prometer ausencia absoluta de defectos**. No confundir commits o pruebas unitarias con aceptación funcional real.

**Orden de prioridades congelado** (solo cambiar por fallo bloqueante de seguridad/integridad, dependencia técnica demostrada o decisión explícita del titular). Una observación sobre UX, estética o algún módulo no cambia el frente activo: se anota con severidad y se trata en su fase. No abrir nuevos módulos o prototipos paralelos.

## Etapas secuenciales y criterios de salida
### Etapa 1 — Cotización inteligente completa
- Una única selección múltiple/arrastrar y soltar; hasta 30 PDF en el piloto; vista compacta.
- Analizar PDF localmente: cantidad real de páginas, tamaño por página y modalidad final A4/A3 o ploteo.
- Ploteos: clasificación CAD/póster por página con revisión para ambiguos, rollo automático no editable, material póster obra/recubierto cuando corresponda.
- Configuración por archivo: B/N/color, caras, copias, materiales reales, páginas seleccionadas; anillado ninguno/individual/grupos con orden claro.
- Precio preliminar rápido sin subir originales, siempre visible; descuentos y catálogo original sin cambios no autorizados.
- Conjunto unificado y coherente; sin repetir las mismas preguntas al avanzar.
**Salida:** pruebas automatizadas y ensayo navegador PC/Android con 1, 2, 10 y 30 PDF, errores y PDF mixtos; paridad comprobada contra cotizador original y casos comerciales.

### Etapa 2 — Recepción protegida y pedido completo
- Una sola acción para enviar todo el lote; progreso, reanudación, recuperación tras reposo móvil, sin subir duplicados.
- Validar en backend originales/fragmentos/hash/páginas/medidas/selección y precio contra catálogo autorizado.
- Conservar anillado/orden y separar instrucciones para imprimir de instrucciones para armar, respetando B/N/color y doble faz; asociar archivos a líneas del pedido.
- Registrar pedido y manifiesto persistentes e idempotentes en Central D1; descarga privada y estado consistente.
- PDF final solo cuando tiene sentido operacional; evitar almacenamiento innecesario.
**Salida:** pedido sintético no cobrado de punta a punta y recuperable después de reinicio; evidencia real de Cloudflare ↔ GAS/Drive ↔ D1 y central de operador, con limpieza segura de pruebas.

### Etapa 3 — Polaroids Express + carrito unificado
- Reutilizar Express PDF único privado, 6 fotos por A4, límite 24, recortes guillotinables, recuperación de interrupciones.
- Integrarlo con el carrito existente y la Central, sin originales duplicados y sin recepción pública prematura.
**Salida:** prueba real con lotes 6/12/24 y pedido combinado impresiones/ploteos/Polaroids que preserve importes e instrucciones.

### Etapa 4 — Pago controlado y lanzamiento
- Sandbox Mercado Pago: importe server-side, callbacks, idempotencia, cancelación, reintentos; alternativa transferencia.
- Solo pedidos pagados confirmados para producción; control de autorización/descargas.
- Auditoría completa de promociones, catálogo, UX, seguridad, límites, velocidad, accesibilidad móvil, recuperación y rollback.
- Publicación únicamente con aprobación explícita del titular, tras pruebas reales y plan de reversión.
**Salida:** checklist de aceptación firmado por evidencia, no impresiones subjetivas.

## Forma de trabajo obligatoria
1. Antes de cada cambio: indicar **etapa activa, problema bloqueante y prueba de aceptación**.
2. Trabajar verticalmente sobre un flujo completo en lugar de arreglos cosméticos aislados. Conservar y reutilizar los componentes existentes; no rehacer el cotizador.
3. No declarar "terminado" sin código guardado, pruebas automáticas aprobadas, validación funcional y prueba real cuando aplique. Reportar diferencias: implementado / CI verificada / desplegado privado / ensayado real.
4. Si el titular señala un defecto no bloqueante, anotarlo en `docs/REGISTRO_IDEAS_Y_DECISIONES.md`, no abandonar la etapa. Corregir inmediatamente solo si impide el flujo, falsea precio, pierde datos o compromete seguridad.
5. No exigir pasos manuales triviales al titular. Agrupar intervenciones de credenciales/Cloudflare, solo cuando sean indispensables y autorizadas.
6. Mantener `main`, `libreriasaber.com.ar`, recepción pública, cobros reales y gastos sin cambios hasta autorización expresa. No usar datos de clientes en pruebas.
7. Antes de agotarse la conversación, redactar un prompt de relevo completo y registrar estado con rama/commit, etapa, cambios comprobados y bloqueo siguiente.
8. Evitar reportar porcentajes inventados, promesas de 100 % sin errores o éxitos de CI no verificados.

## Avance de imposición documental — 27/10/2026

- Etapa 1: implementado presupuesto preliminar con 1/2/4/9 páginas originales **por cara impresa** en cada PDF documental, incorporando redondeo de caras, hojas físicas y tarifas según escala de caras efectivamente impresas. Anillados individuales y conjuntos usan hojas físicas; cada archivo redondea independientemente antes de formar un grupo.
- Nuevas pruebas de precios con catálogo original: páginas impares, doble faz, grupos de anillado, descuentos compartidos, rechazo de valores arbitrarios y ploteo no compatible. CI exitosa: https://github.com/hernanchan/COTIZADOR/actions/runs/40495662043
- Interfaz de carga: selector por PDF y resumen. Borrador preliminar conserva páginas por cara, caras y hojas por juego; no autoriza pagos ni producción.
- **Pendiente para funcionalidad real:** generar en backend el PDF físicamente impuesto, comprobar visualmente orden y orientación (A4/A3, márgenes, 2/4/9 y doble faz), verificar con PDF real y conservar el resultado bajo acceso privado. Hasta entonces la recepción protegida bloquea 2/4/9 para no registrar un original que no coincida con la instrucción. No marcar imposición como funcional de extremo a extremo.
- Sin publicación de la web, sin cobros ni cambios en Central D1. Las pruebas de integración restantes deberán verificarse contra la ejecución más reciente de Actions.

## Brecha bloqueante de paridad detectada — 27/10/2026

**Composición 2/4/9 páginas por hoja (N-up):** la pantalla `carga-unica-cliente.mjs` y el contrato de `cotizar-carga-unica.mjs` aún no incluyen el parámetro de imposición; las tarifas actuales se calculan a partir de páginas seleccionadas, no de hojas impuestas. **No simular esa opción reduciendo páginas o precios sin definir la hoja física, caras impresas, descuentos y anillado real.** Resolver en esta misma Etapa 1 con contrato común navegador/servidor, pruebas comerciales de 1/2/4/9 por hoja, páginas impares y doble faz, y validación contra el cotizador original. No pasar a Etapa 2 hasta que quede cubierta.

**Paridad de materiales y modalidades:** pruebas con tarifa real A4/A3, mezcla B/N-color, anillado y ploteos ya existen en CI; la cobertura de promociones y cupones, validación móvil con PDF reales y tiempos p50/p95 sigue pendiente. No marcar Etapa 1 como concluida con solo casos de unidad.

## Avance del compositor vectorial privado — 27/10/2026

- El compositor `componer-pdf-documentos-privado.mjs` ya existía con salida PDF vectorial 1/2/4/9 por cara, selección de páginas y hojas dúplex por juego. Se reutilizó, sin rehacer ni rasterizar.
- Corregida la ficha central: `paginasPorCaraPresupuestadas`, `carasPorJuegoPresupuestadas` y `hojasPorJuegoPresupuestadas` proceden ahora del cálculo verificado, en vez de estar fijadas a 1 por cara.
- Corregido `componer-desde-recibo-verificado.mjs`: acepta 1/2/4/9 solo con coherencia estricta entre páginas seleccionadas, caras presupuestadas y hojas presupuestadas. Conserva consultas HMAC, hash SHA-256, lectura de Drive y estado de pago/producción desactivados.
- Ensayo unitario nuevo: generación N-up 4 desde recepción privada simulada, comprobar número de caras y hojas; alterar posteriormente N-up de 4 a 9 debe bloquearse antes de leer Drive.
- CI aprobada: https://github.com/hernanchan/COTIZADOR/actions/runs/40496085795
- **No significa recepción comercial habilitada**: el puente del portal privado sigue rechazando N-up distinto de 1, ya que resta conducir el contrato hasta el pedido real, ensayo PC/Android y revisión visual de orden, orientación y doble faz de archivos PDF originales. Mantener esa barrera hasta prueba extremo a extremo; no publicar web ni cobros.

## Cierre del contrato N-up entre carga y recepción V2 — 27/10/2026

**Código unido en rama privada, CI aprobada, sin despliegue remoto:**

- La carga inteligente transfiere `paginasPorHoja` 1/2/4/9 al portal junto con el archivo real y sus opciones de impresión.
- El portal V2 conserva el valor y lo envía al vínculo del recibo; el cliente V2 exige igualdad exacta de la respuesta de cotización del servidor.
- Para N-up 2/4/9, el Worker no confía en un subtotal del navegador: recupera el original por el receptor firmado, verifica SHA-256, lee dimensiones reales y calcula el importe desde `precios-web.json`. Un PDF superior a A3 se rechaza.
- En el paso de registro de lote, `paginasPorHoja` se conserva para recotización servidor → ficha de la Central. El compositor privado previamente probado recibe el número real de páginas por cara y rechaza diferencias con presupuesto.
- Pruebas nuevas con catálogo real: 9 páginas 4-up doble faz con dos juegos; A3 color 2-up; rechazo de recibos inválidos y de PDF que exceden A3.
- **CI de integración y seguridad aprobada:** https://github.com/hernanchan/COTIZADOR/actions/runs/40497119851
- **Pendiente verificable para cerrar etapa:** desplegar exclusivamente en el entorno de ensayo autorizado, efectuar carga de un PDF original, comprobar recibo GAS, cotización y registro en D1, generar y revisar el PDF final privado y comparar visualmente composición de caras y orientación. Ninguna de estas pruebas remotas se declara realizada.
- Producción `libreriasaber.com.ar`, pagos, recepción comercial y gastos siguen sin modificación.

## Hito de integridad del pedido V2 — 27/10/2026

**Prueba integral de código aprobada:** https://github.com/hernanchan/COTIZADOR/actions/runs/40497648507

- Se corrigió la pérdida de metadatos en `prepararBorradorPedido(...)`: la carga real ahora aporta `caras`, `anillado`, `grupoAnillado` y `paginasPorHoja` en cada archivo.
- El cliente de recepción privada transporta N-up 1/2/4/9, verifica que coincida con la cotización del servidor y rechaza modificaciones incongruentes.
- Se añadieron pruebas de integración del cliente para 2, 4 y 9 páginas por cara y un caso adverso de respuesta de cotización alterada.
- Se añadieron comprobaciones CI para confirmar que el **Worker compilado** incluye la ruta de carga inteligente y campos de composición, en vez de verificar únicamente los archivos fuente.
- Sigue estrictamente pendiente: ensayo remoto con PDF real en ambiente privado (Cloudflare, GAS/Drive y D1), comprobación de la vista final y la orientación de impresión, sin activar pagos.
- No hay despliegue automático desde este flujo de pruebas. No se alteró la web pública.

## Auditoría real de Cloudflare de los Workers privados — 27/10/2026

**Evidencia:** https://github.com/hernanchan/COTIZADOR/actions/runs/40497879357 — lectura GET de metadatos de los dos Workers, sin modificar configuraciones.

- `saber-pagos-pruebas`: acceso OK, `CENTRAL_BRIDGE_KEY` y binding D1 presentes. Service Binding no presente en este Worker, coherente con el enlace desde Documentos hacia Central.
- `saber-documentos-pruebas`: acceso OK; `SABER_CENTRAL`, `DOCS_SCRIPT_URL`, `DOCS_RELAY_KEY`, `DOCS_ALLOWED_ORIGIN`, Turnstile, `DOCS_EXTENDED_RECEIVER_ENABLED`, `DOCS_V2_RECEIPT_LINK_ENABLED`, compuerta UI privada, `DOCS_CENTRAL_ADMIN_KEY`, `CENTRAL_TEST_URL`, `DOCS_CENTRAL_SYNC_ENABLED`, `DOCS_ORDER_PREPARE_ENABLED` están **presentes como nombres de binding**.
- **Faltan** `DOCS_PRINT_DRAFT_ENABLED` y `DOCS_PRINT_DRAFT_CENTRAL_ENABLED` en el Worker documental. Son guardias necesarios para preparar/registrar el PDF compuesto del ensayo. Su ausencia actualmente es un bloqueo seguro, no un error que autorice encenderlas automáticamente.
- La lectura de metadatos **no prueba los valores activos** de ninguna bandera, ni qué commit se encuentra desplegado, ni la recepción real en GAS/Drive o D1.
- El control de solo lectura ahora informa la ausencia/indeterminación de ambas configuraciones de composición de PDF y nunca afirma que estén habilitadas. Corregir configuración sólo en el entorno de ensayo, bajo autorización, después de verificar artefacto a desplegar; no modificar la web pública, no activar pagos, no generar costos.

**Siguiente condición de salida:** validar versión realmente desplegada del Worker documental privado y control de acceso; efectuar un pedido ficticio de PDF con 2/4/9 páginas por cara, recibo Drive, ficha D1 y PDF compuesto revisado, con pagos desactivados. No declarar Etapa 1 finalizada por CI o presencia de bindings.

## Estado de corte al 27/10/2026
**Etapa activa: 1, cierre funcional y paridad comercial.** Existen componentes de cotización rápida, CAD/Póster y carga única, pero aún no se confirmó una UX integrada aceptada con todas las opciones del cotizador vigente. Etapa 2 tiene piezas y pruebas locales, pero el recorrido remoto completo con D1 aún no fue aceptado. Cambios recientes sobre borrador de anillados y suite CI son parciales; comprobar ejecución y resultado antes de tratarlos como validados.

**Próximo trabajo obligatorio:** obtener y validar estado CI más reciente, construir pruebas de paridad por caso sobre el conjunto inteligente, corregir fallas bloqueantes, y recién luego unir definitivamente con recepción y D1. No desviar el esfuerzo a estética ni Mercado Pago.
