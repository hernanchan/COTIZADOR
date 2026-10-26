# Cierre de lanzamiento — Librería Saber (25/10/2026)

**Rama de trabajo:** `polaroids/express-pdf-unico-20261023`. **No es aprobación de salida.**
**Regla:** no reemplazar el cotizador comercial vigente hasta completar todas las pruebas bloqueantes. No publicar ni habilitar cobros por inferencia de CI.

## Evidencia existente, sin exagerarla
- GitHub Actions `polaroids-express/ci`: valida módulos en Node y simulaciones. Última ejecución previa al presente control aprobada: https://github.com/hernanchan/COTIZADOR/actions/runs/40200681200
- V2: lectura de PDF, recepción fragmentada simulada, cotejo SHA/páginas y presupuesto de servidor con catálogo original. **No** hay pedido D1 para cada renglón V2; el portal usa carrito temporal en memoria.
- Central: rutas `/internal/central/stage`, `prepare-order`, `prepare-mixed-order`, PDF privado y firmas HMAC implementadas; pruebas con D1 SQLite local y servicios simulados.
- Express: motor de PDF único real probado; la recepción pública sigue apagada.
- Mercado Pago: hubo ensayo sandbox histórico de catálogo; no es certificación de cobros integrados de documentos + Express.

## Bloqueos de salida (todos deben resolverse y quedar evidenciados)
- [x] **P0 Auditoría real Cloudflare de solo lectura (25/10):** ejecución aprobada https://github.com/hernanchan/COTIZADOR/actions/runs/40202805405. `saber-pagos-pruebas` tiene D1 y CENTRAL_BRIDGE_KEY; `saber-documentos-pruebas` dispone de DOCS_SCRIPT_URL, DOCS_RELAY_KEY, origen y Turnstile, y ahora **sí tiene `SABER_CENTRAL` y `CENTRAL_BRIDGE_KEY`** (auditoría posterior 40206421019), pero siguen ausentes las banderas/contraseña del portal V2. La presencia de secretos no demuestra coincidencia de sus valores. El CI exitoso certifica la auditoría GET, NO que la integración esté habilitada.
- [ ] **P0 Conectividad Documentos → Central:** se configuró `SABER_CENTRAL` y se agregó `CENTRAL_BRIDGE_KEY` en el Worker documental (auditoría 40206421019). Los valores no son legibles: **no se confirmó que coincidan**. El código de prueba HMAC sin D1 pasó CI, pero NO se desplegó ni se probó extremo a extremo. Faltan `CENTRAL_BRIDGE_PROBE_ENABLED`, `DOCS_CENTRAL_PROBE_ENABLED`, `DOCS_CENTRAL_ADMIN_KEY` y `CENTRAL_TEST_URL` (auditoría 40207113838).
- [ ] **P0 Despliegue privado autorizado:** ambos Workers empaquetados y testeados en Actions 40207300153 (artefacto `saber-diagnostico-hmac-2-workers-sin-despliegue`). **No instalados remotamente**. El token API actual solo permite GET de metadata: no permite descargar/restaurar código desplegado ni actualizar scripts. Antes de sustituir un Worker de pruebas es indispensable una copia de su script/configuración efectiva o evidencia equivalente y plan de rollback; no asumir que el repositorio equivale al despliegue actual. Sin autorización explícita de escritura, mantener bloqueado.
- [ ] **P0 Recepción real:** PDF A4 y A3 desde PC y móvil a GAS/Drive aislado; validar fragmentos, reanudación, SHA, páginas, tiempos y cupo sin R2.
- [ ] **P0 Paridad comercial:** seis familias existentes, precios, variantes, mínimos, promociones diarias, cupones, materiales, anillado, selección de páginas, CAD/póster; comparar cotizador original y nuevo en casos representativos. Igualdad aritmética de dos importes no equivale a paridad.
- [ ] **P0 Pedido persistente unificado:** conectar cada renglón V2 verificado al manifiesto y pedido D1, con recálculo de servidor; restaurar carrito en móvil tras suspensión/cambio de pantalla y evitar duplicados.
- [ ] **P0 Polaroids real:** subir lotes de 6 a 24 fotos distintas, confirmar PDF A4 privado único por pedido, cotización, reintento y referencia D1; ningún PDF descargable por comprador.
- [ ] **P0 Checkout:** ensayo completo en sandbox de carrito mixto; verificar vendedor, importe total, notificación, reintento, devolución y bloqueo hasta constancia de pago.
- [ ] **P0 Central operador:** solo pedidos pagados sin devolución; PDF final imprimible vinculado al recibo, descarga privada autorizada, instrucciones de anillado/plotter; no liberar solo por recibir original.
- [ ] **P0 Seguridad:** acceso privado, Turnstile, HMAC, origen, límites, cuotas, prohibición de compartir claves, separación de entornos, no exponer Drive ni PDFs.
- [ ] **P0 Operación y salida:** ensayo Chrome/Android con múltiples archivos, cancelación y reposo; comprobar texto de precios, política de seña/pago total, rollback probado; aprobación explícita del titular antes de producción.
- [ ] **P1 Mantenimiento:** purga segura de pruebas/abandonados, monitoreo de errores y cupos, dependencia de librerías PDF externas y pruebas de impresión física.

## Decisión actual
**NO-GO para lanzamiento 100 % integrado.** No porque fallen las pruebas locales: faltan pruebas reales en servicios remotos y el carrito comercial del V2 no está conectado todavía a D1/checkout. Mantener `main`, `libreriasaber.com.ar` y cobros públicos inalterados.

## Criterio de trabajo
Prioridad: cerrar los P0 existentes con pruebas trazables; no crear módulos paralelos. Registrar el resultado de cada prueba remota (fecha, entorno, pedido sintético, recibo, estado, bloqueo) sin escribir secretos ni fotografías reales en GitHub.

## Actualización operacional verificada — 25/10/2026
- **GitHub CI**: tests del diagnóstico HMAC de ambos Workers completados correctamente en https://github.com/hernanchan/COTIZADOR/actions/runs/40207113837.
- **Cloudflare metadatos (GET)**: https://github.com/hernanchan/COTIZADOR/actions/runs/40207113838. Central con D1, clave y bandera CENTRAL_BRIDGE_ENABLED presentes; Documentos con Service Binding y clave. **No se pueden inferir los valores de las banderas, secretos o el script desplegado**.
- **Paquete sin despliegue**: https://github.com/hernanchan/COTIZADOR/actions/runs/40207300153. Artefactos de Workers no constituyen copia de seguridad de código efectivamente desplegado.
- **Próximo paso bloqueante**: contrastar scripts y bindings remotos con el paquete antes de reemplazar Workers; obtener acceso autorizado que permita respaldo/restauración y publicación solo en los dos Workers aislados. Luego probar el diagnóstico HMAC con bandera temporal, sin pagos ni D1 y apagarlo.
- **No solicitar reinicios sucesivos de banderas al usuario**: agrupar en una operación controlada, reversible y verificable.


## Actualización verificable — 26/10/2026 (después del cierre HMAC)
- [x] **P0 Conectividad Documentos → Central:** ambos Workers de pruebas instalados al 100 % con sus Service Bindings, D1 y secretos conservados: [auditoría remota](https://github.com/hernanchan/COTIZADOR/actions/runs/40314872451).
- [x] **Firma HMAC real:** una petición administrativa `verify-only` fue aceptada por Documentos y firmada hacia la Central; la respuesta certificó `signed:true`, `dbTouched:false`, `orderCreated:false`, `paymentAuthorized:false` y `checkoutEnabled:false`. [Ensayo real](https://github.com/hernanchan/COTIZADOR/actions/runs/40317987541).
- [x] **Diagnósticos cerrados:** `CENTRAL_BRIDGE_PROBE_ENABLED=OFF` y `DOCS_CENTRAL_PROBE_ENABLED=OFF`, comprobados por GET en ambos Workers: [auditoría](https://github.com/hernanchan/COTIZADOR/actions/runs/40318616219).
- [ ] **Siguiente P0 prioritario — compra documental completa:** vincular explícitamente el carrito V2 con el backend privado de recepción, exigir PDF verificado por GAS/Drive, recalcular en servidor, persistir manifiesto y pedido en Central D1 y comprobar idempotencia/reintentos. El archivo `preparar-documentos-central.mjs` aporta un adaptador privado de preparación comercial, pero su existencia y pruebas unitarias **no** demuestran que cada renglón V2 quede persistido en D1.
- [ ] **Ensayo real de pedido sintético, no cobrado:** pendiente; requiere compuertas comerciales privadas distintas de las de HMAC. **No** habilitar `DOCS_CENTRAL_SYNC_ENABLED` ni `DOCS_ORDER_PREPARE_ENABLED` por defecto, ni escribir D1 antes de validar condiciones y mecanismo de limpieza de ensayos.
- **Estado de lanzamiento: NO-GO.** Proteger `main`, sitio público, recepción de fotografías y cobros. La conexión HMAC queda cerrada; no pedir al usuario repetir los mismos pasos.


## 26/10/2026 — Integración V2, persistencia y limitación de acceso D1 remoto
- [x] **Nuevo manifiesto V2 multifichero:** `preparar-manifiesto-v2-documental.mjs`, hasta 30 PDF con referencias únicas, importes orientativos inertes.
- [x] **Conciliación independiente del navegador:** `registrar-manifiesto-v2-central.mjs` confronta SHA/páginas/recibos contra la ficha verificada por servidor y utiliza su total, no el local. La escritura firmada al endpoint `stage` permanece bajo `DOCS_CENTRAL_SYNC_ENABLED=PRIVATE_TEST_ONLY`.
- [x] **Ruta privada V2 lote:** `/api/ensayo-preparar-documentos-v2-lote` en `worker-fase4-cotizador-unificado.mjs`, compuertas administrativas y comerciales cerradas por defecto; reconstrucción desde GAS/Drive verificado antes de escritura a Central y creación de compra.
- [x] **Persistencia contra Central real ejecutada localmente:** suite `tests/central-bridge-d1.test.mjs` ampliada para enviar dos PDF del V2 por HMAC al Worker Central con SQLite D1 local, comprobar importe servidor, líneas y recibos asociados, pedido pendiente de pago y reintento idempotente. [CI aprobada](https://github.com/hernanchan/COTIZADOR/actions/runs/40323104103).
- [x] **Persistencia luego de reinicio:** prueba con base SQLite en archivo independiente, cierre y reapertura de conexión, recuperación de pedido y bloqueo de duplicados. [CI](https://github.com/hernanchan/COTIZADOR/actions/runs/40322723232).
- [x] **Preflight remoto sin escrituras:** Worker Central mantiene `CENTRAL_PREPARE_ENABLED` no habilitada, diagnósticos HMAC en OFF. [Auditoría](https://github.com/hernanchan/COTIZADOR/actions/runs/40323240400).
- [ ] **Ensayo sobre D1 remota real:** la API Cloudflare `GET /accounts/{account_id}/d1/database/{id}` respondió **HTTP 401** con el token GitHub `SABER_CF_EDITOR_TOKEN`; no atribuir permiso D1 ni realizar pruebas SQL remotas con este token. **No se ejecutaron consultas ni escrituras SQL en D1 remota.** Requiere autorización/permiso específico y un plan de datos de prueba + eliminación segura. No alterar la clave actual ni pedir configuraciones repetidas.
- [ ] **Checkout y web comercial:** el endpoint multifichero no está publicado para clientes, sus compuertas están OFF y todavía no hay recorrido real desde navegador a D1 ni PDF privado descargable para el operador.
- **Salida pública: NO-GO** hasta pruebas remotas, experiencia móvil, autorización explícita y validación de cobros.
