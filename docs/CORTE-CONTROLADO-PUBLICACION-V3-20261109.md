# Corte controlado de publicación V3 · Librería Saber
**Preparado:** 09/11/2026 · **Estado: NO EJECUTAR sin GO explícito del titular**.

## Alcance que se va a publicar
- Portada comercial V3 fotográfica, impresión protagonista.
- Catálogo de productos desde Google Sheets, consulta por WhatsApp con precios revalidados y sin reserva ni cobro automático.
- Circuito separado de impresiones: cotización → pago/acreditación verificada → recepción de PDF → seguimiento → Central. Nunca afirmar carrito mixto.
- PDFs grandes R2: cotización local y cobro conciliado antes de recibir originales; preprensa antes de producción; borrar originales del pedido entregado.
- Conservación del seguimiento y estimación de entrega ya desarrollados. No reabrir estos módulos sin incidencia real.

## Puntos de referencia constatados
- Rama candidata: `integracion/tus-pedido-privado-20261101`.
- `main` pre-corte: `864eb12272f6b8dfb2ca7eaee1be5326632e7bf3` (lectura GitHub a las 19:55 UTC del 09/11).
- Web pública: `https://libreriasaber.com.ar` y `/cotizar` responden HTTP 200 y **todavía muestran carrito antiguo y cotizador iframe previo**, sin reemplazo.
- V3 privada probada en `/prueba-v2/diseno-sin-clave` sobre `saber-documentos-pruebas`: deploy `ac404da2-da0c-49ec-9fe5-d7570b306cc6`, GitHub Actions [42686265287](https://github.com/hernanchan/COTIZADOR/actions/runs/42686265287), SUCCESS.
- Fix preventivo de WhatsApp post-consulta asíncrona: commit `cd7e10d`, suite integral [42687402820](https://github.com/hernanchan/COTIZADOR/actions/runs/42687402820) SUCCESS. **El fix está en la rama, NO debe describirse como instalado en producción.**
- Auditoría focalizada del origen de producción, **solo GET**: [42687898858](https://github.com/hernanchan/COTIZADOR/actions/runs/42687898858) y [42688105876](https://github.com/hernanchan/COTIZADOR/actions/runs/42688105876), SUCCESS de ejecución sin escrituras. Lectura de proyectos Cloudflare Pages denegada: token deploy HTTP 403 y token auditor HTTP 401. **Por tanto NO se confirmó el nombre del proyecto, rama de Pages ni ID del último deployment productivo.** No inventarlos.

## Bloqueos reales para dar GO de web completa
1. **Destino exacto y rollback**: proyecto Pages `libreriasaber` y rama productiva `main` identificados por capturas del titular el 09/11/2026. El SHA de la última producción visible es `864eb12`; el nombre/ID del deployment y botón de rollback deben verificarse en el dashboard antes del GO. Los tokens API actuales no tienen acceso a listado Pages (403/401), por lo que el cambio posterior deberá vigilarse por status GitHub y capturas del panel, sin inventar un ID de rollback.
2. **Producto comercial**: la única hoja confirmada se llama `Productos web (MODELO)`; 4 activos verificados. No anunciar inventario completo, disponibilidad o precios autorizados sin confirmación del titular. Mantener WhatsApp separado.
3. **Archivo entregado**: eliminación física de original R2 **NO probada**. Módulo y flags privados/cron aprobados [42680626804](https://github.com/hernanchan/COTIZADOR/actions/runs/42680626804); esperar una entrega legítima del ensayo V2 para confirmar `cleanupR2.state=deleted`, auditoría y ausencia en bucket. No mover a Entregado para fabricar el test ni borrar históricos.
4. **Cobros productivos**: Mercado Pago real sigue OFF. Portal comprador de prueba usa Turnstile, pedidos TUS y Sandbox; los ensayos previos aprobaron pagos sandbox, no dinero real. Antes de activar cobros productivos, configurar identidad de vendedor, callbacks/webhook y conciliar sin aceptar redirección del navegador como pago; autorización explícita separada. Asegurar descarga privada, límites, continuidad, pagos o transferencias confirmadas.
5. **Entrada de PDFs grandes desde internet**: el ensayo V2 de 62.915.011 bytes cargó por R2 multipart, verificó SHA y descarga; no equivale a aprobar todos los tamaños/móviles/archivos mixtos. No hacer más pedidos ni cobros sintéticos innecesarios; mantener reglas de preprensa.

## Procedimiento de corte — únicamente después de resolver bloqueos y recibir autorización expresa
1. Confirmar que `main` sigue en SHA esperado, detectar cambios concurrentes y guardar versión de la web pública, deployment Pages y deployment del Worker receptor/Central. Fijar identificadores de rollback **reales** antes de cualquier escritura. No dar por hecho que `main` es la rama efectiva de Pages.
2. Preparar el paquete mínimo de publicación: portada V3 + ofertas + navegación hacia el **endpoint comprador de producción verificado**; conservar Polaroids, activos existentes, dominio y servicios no involucrados. No enlazar compradores reales a `prueba-v2`/Sandbox. No publicar el viejo iframe como si fuese el nuevo cotizador.
3. Verificar en preproducción real accesos anónimos/comprador y prohibición de acceso de personal: Turnstile, presupuesto autorizado, cotización/grupo de archivos, pedido, pago/transferencia reconciliados, seguimiento, Central y descarga privada. Usar evidencia ya aprobada; probar solo diferencia concreta de URL/entorno.
4. Publicar por mecanismo **confirmado** de Pages/Workers; no cambiar DNS si no hace falta. Verificar en `libreriasaber.com.ar` portada, ofertas, imágenes, móvil, contacto, `/cotizar` real, acceso a Central cerrado y estado de pago.
5. Si falla la navegación, pagos o protección de archivos: **rollback inmediato a los deployment IDs previamente registrados**. Si la web se publica desde Git, volver al estado previo con una nueva reversión auditable, sin reescritura forzada de la historia y sin pisar cambios concurrentes. Mantener registros D1/pagos/archivos; rollback de front-end NO debe borrar ni revertir pedidos pagados.
6. Registrar SHA de publicación, versión Pages y Workers, comprobaciones de la URL pública y decisión final en issue #3. La tarea no termina por un CI verde o un HTML 200.

## Reglas de ejecución
- Hasta GO: solo rama privada, lectura de sistemas y ensayos CI. No crear pedidos nuevos ni cobrar sandbox. No tocar `main`, dominio, pagos reales, Central, R2 histórico ni fases ya aprobadas.
- El siguiente paso operativo NO es una auditoría general: obtener el mapeo real Pages de producción mediante credencial con permiso read (actuales 403/401), cerrar entrega legítima del R2 V2 cuando corresponda y confirmar qué artículos de la hoja MODELO se autorizan.

## 09/11 — Resolución específica de error de build de Pages (capturas del titular)
- Se confirmó que la rama de producción Pages es `main`, con versión funcional `864eb12` y dominio `libreriasaber.com.ar` más `www`.
- El proyecto Pages se denomina **`libreriasaber`**, directorio de salida `vidriera`, raíz vacía (repo root). En la rama `integracion/tus-pedido-privado-20261101`, Cloudflare clonaba bien el repo pero fallaba al compilar Pages Functions: `Could not resolve "pdf-lib"` en `integraciones/polaroids/express/worker-express.mjs:8`.
- GitHub Actions de diagnóstico [42690578057](https://github.com/hernanchan/COTIZADOR/actions/runs/42690578057) reprodujo exactamente error sin npm y compiló OK con `npm install --ignore-scripts --no-audit --no-fund --package-lock=false`.
- El titular mostró una captura donde está guardado **Comando de compilación** `npm install --ignore-scripts --no-audit --no-fund --package-lock=false`, salida `vidriera`, raíz sin cambio, rama producción `main`. NO se ha comprobado aún que Cloudflare desplegara una preview posterior a esa modificación; ese es el siguiente control. No volver a pedir modificación ni credenciales.
- Este commit de documentación en la rama de integración sirve para iniciar un nuevo build de preview automático en Pages. **No escribir `main` ni promover el deployment**.
