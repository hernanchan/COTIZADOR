# Continuidad ejecutiva — Librería Saber · 11/11/2026

## Estado real comprobado en este chat
Repositorio: `hernanchan/COTIZADOR`. Rama única de integración: `integracion/tus-pedido-privado-20261101`. **No tocar `main` ni web pública hasta validación final.**

1. **R2 LIVE:** subclave de inspección privada instalada sin revelar su valor, Action `43112412131` SUCCESS. Central `CENTRAL_LIVE_R2_INSPECTION_GATE=GO_COMERCIAL_CONFIRMADO`. Compuertas de cobro R2 grande siguen **NO_GO**, incluso después del deploy.
2. **Personal:** puente de acceso e inspección original R2 desplegado en Cloudflare. Deploy inicial `43115165918` SUCCESS. Nueva publicación con rollback automático `43119086294` SUCCESS; HTTP 401 sin autenticación en board, inspection-source y inspection-original. **Esto verifica protección, NO una descarga real autenticada.**
3. **Corrección LIVE móvil/PC:** `pagina-cotizar-live.mjs` muestra precio, fecha y promoción → selector PDF/JPG/PNG → datos del cliente/confirmación. Commit `919a9c7`, con prueba de regresión `9276676`. El selector antes quedaba por debajo del formulario.
4. **Textos comprador:** `worker-fase4-cotizador-unificado.mjs` limpia aviso obsoleto «prueba privada / sin cobros» en ruta LIVE y distingue hasta 10 PDF o hasta 30 JPG/PNG. Commit `789298c`. `carga-unica-cliente.mjs` diferencia el aviso LIVE del de prueba. Commit `75f94eb`.
5. **Pruebas:** la integración privada y QA LIVE aislada pasaron para `9276676`. Workflow `43118845467` actualizó Documentos de PRUEBAS con imágenes/promociones, SUCCESS. En `2d152740` se desplegaron a los Workers de producción los cambios anteriores con backup, control de bindings y restauración automática ante fallos.
6. **No se hicieron nuevos pagos ni pedidos de clientes en este chat.** Sin E2E autenticado de un PDF >40 MiB descargado por el personal en producción. No proclamar terminada la recepción comercial R2.

## Próximo paso concreto, SIN repetir ensayos aprobados
- Abrir en navegador real `https://pedidos.libreriasaber.com.ar/cotizar` con sesión del comprador; comprobar visualmente en móvil y PC que aparece primero la carga de PDF/JPG/PNG, precio/promo/fecha y confirmación. Sin pago nuevo innecesario.
- Probar **la inspección/descarga firmada R2 con credencial del personal y un archivo sintético controlado**, comprobando Central, PDF íntegro y manejo seguro; si falla, mantener cobro R2 NO_GO.
- Solo con esa comprobación, decidir con autorización previa cuándo abrir las compuertas R2 de cobro y validar un pedido completo PDF >40 MiB; conservar los pagos TUS/transferencia ya aprobados. Publicación `main`/dominio principal solo tras validación del circuito comercial.
- El error de capturas de pantalla era **carga oculta debajo del formulario** en el HTML LIVE; no interpretar éxito de CI como prueba visual real.

## Referencias
- Run deploy final: https://github.com/hernanchan/COTIZADOR/actions/runs/43119086294
- Run instalación subclave: https://github.com/hernanchan/COTIZADOR/actions/runs/43112412131
- Rama: https://github.com/hernanchan/COTIZADOR/tree/integracion/tus-pedido-privado-20261101

Mantener los archivos PDF privados. Política: borrar el original de cada pedido al marcarlo «Entregado» una vez confirmada la integración de retención. Nunca publicar secretos ni pedir al usuario repetir pruebas ya aprobadas.

## Hotfix 11/11/2026: enlace /cotizar desde ChatGPT
- Confirmado con HTTP real vía Actions: `/cotizar` daba 200 pero `/cotizar?utm_source=chatgpt.com` devolvía 404, texto «No disponible», porque `pagina-cotizar-live.mjs` rechazaba cualquier `u.search`.
- Corrección en `integraciones/autocotizador/recepcion/pagina-cotizar-live.mjs` commit `04da5e6`: mantiene HTTPS, host, path, seguridad y gates, pero ignora parámetros no utilizados en presentación. Prueba de regresión `pagina-cotizar-live.test.mjs` commit `705be02`, QA LIVE SUCCESS.
- Despliegue productivo reversible commit `7a43983`, Actions `43121245814` SUCCESS. No modificó `main`, no generó pedidos y mantuvo bloqueados cobros R2 grandes.
- **Validación posterior definitiva:** Actions `43121365599` SUCCESS, ambas rutas `/cotizar` y `/cotizar?utm_source=chatgpt.com` **HTTP 200**, `/pedido/estado` 200; gates UI, MP y sesión en GO. El mensaje «No disponible» por parámetro queda corregido.

## Corrección interfaz móvil y JavaScript comercial (11/11)
- **Falla denunciada por usuario**: en teléfono la interfaz se superpone y resulta inutilizable; no dar por aprobada la experiencia móvil por el solo éxito del deploy.
- **Causa visual comprobada en código**: iframe de archivo de altura fija 960/1100 px sin redimensión; presupuesto sticky duplicado dentro del iframe; columnas internas comprimidas. Se adaptó HTML LIVE y se implementó sincronización segura de altura por `postMessage` (mismo origen + fuente y límites), `ResizeObserver`, petición de altura al cargar y eliminación de scroll doble. Módulo puro `integraciones/autocotizador/recepcion/pagina-archivos-live.mjs`; pantalla `pagina-cotizar-live.mjs`.
- **Segunda causa real descubierta por Chrome**: expresión regular de teléfono mal escapada en template literal generaba `SyntaxError Invalid regular expression /^+?...` e impedía ejecutar TODO el script de la pantalla. Corregido con escapes dobles, test que compila el JS generado.
- **QA real automatizada Chrome**: workflow `43123076822` SUCCESS con tamaños 360, 390, 768 y 1366 px; sin error JS, sin desborde horizontal, el iframe crece con 6 tarjetas sintéticas, el formulario permanece por debajo, precio interno duplicado oculto. **No equivale a prueba visual con archivos de cliente** ni prueba de pedido/cobro.
- **Despliegue LIVE reversible**: Actions `43123222751` SUCCESS. Compilación aprobada, Cloudflare preserva bindings. Inspector original R2 mantiene autenticación HTTP 401 sin credencial y cobro grande R2 cerrado.
- **Pendiente**: inspección visual real en móvil con 1 PDF A4 y luego JPG/PNG; si todavía es confuso, suspender acceso móvil antes de habilitar publicidad/publicación en web principal. No repetir pruebas previas MP, transferencia ni Supabase por errores de CSS.

## Decisión comercial vigente — UX congelada y cierre de circuito

El titular confirmó que la versión móvil mejoró; reconoce que el formulario sigue largo por la cantidad de opciones. **Posponer** el trabajo de reducir bloques/opciones hasta después de terminar el circuito comercial. No introducir nuevas modificaciones de UX durante el cierre.

**Chequeo read-only del 11/11/2026**: GitHub Actions `43127210044` SUCCESS. Entorno producción en los tres Workers. Documentos: recepción, UI, sesión, pricing, pedido, TUS, R2, R2 staging, R2 upload, paquete y acceso staff habilitados (GO). Central/pagos: MP, pedido, postpago, TUS, paquete y bridge habilitados (GO); **CENTRAL_LIVE_R2_GATE, CENTRAL_LIVE_R2_QUOTA_GATE y CENTRAL_LIVE_R2_STAGING_GATE = NO_GO**. Inspección R2 personal en Central GO, clave presente, tablas D1 de reserva/pendientes/inspecciones presentes. Página de seguimiento HTTP 200. Auditoría sin escrituras ni cargos.

**Bloqueo específico para cierre comercial universal:** para PDF >40 MiB falta comprobar un acceso autenticado de personal a ficha y original R2 de un pedido acreditado, y que su circuito posterior de producción/paquete sea apto. Un HTTP 401 sin sesión solo valida protección. **No activar** gates de cobro R2 ni afirmar E2E completo hasta tener evidencia, autorización y control de cuotas. No repetir MP/TUS/transferencias ni volver a tocar el diseño para intentar resolver esto.

## Corrección real del puente de inspección R2 — cierre de esta ejecución

**Causa raíz comprobada**: la Central tenía `CENTRAL_LIVE_R2_GATE=NO_GO` y `CENTRAL_LIVE_R2_STAGING_GATE=NO_GO` por seguridad, pero `r2-live-personal-inspection-bridge.mjs`, `r2-live-inspection-finalize.mjs` y el manifiesto exigían erróneamente esas mismas compuertas para **consultar o inspeccionar originales ya pagados**. Además, `CENTRAL_LIVE_BOARD_GATE` estaba ausente y la lista firmada del personal nunca podría consultarse. Se separó el permiso de lectura de operador del permiso de nuevos cobros, sin modificar checkout.

**Otro bloqueo comprobado**: `staff-r2-personal-ui.txt` tenía una línea de JavaScript cortada y 53 líneas duplicadas, invalidando el script de la página privada `/personal/paquete`. Se reparó (commit `9487296`) y se agregó `tests/r2-panel-staff-live-browser.test.mjs` para compilar el script HTML resultante, incluso con el bundle universal generado en el paso de build.

**Pruebas y producción**:
- GitHub Actions `43128052797`: 23/23 tests R2 PASS; consulta D1 en producción **sin escrituras**: 0 archivos `central_r2_large_pending`, 0 pendientes de inspección.
- GitHub Actions `43128770503`: QA panel privado con script reparado, SUCCESS.
- GitHub Actions `43128832129`: construcción completa y despliegue reversible **SUCCESS**, con 23/23 pruebas R2, 124/124 tests de build, 2/2 tests del panel completo; endpoints personal sin autenticación devuelven HTTP 401. Los nuevos cobros R2 y cuota/staging de Central permanecen **NO_GO**.
- Archivos relevantes: `integraciones/mercadopago/pruebas/r2-live-personal-inspection-bridge.mjs`, `r2-live-inspection-finalize.mjs`, `central-recepcion-live.mjs`, `worker.js`; `integraciones/autocotizador/recepcion/staff-r2-personal-ui.txt` y su pantalla privada.

**Límite de verificación**: no se pudo realizar una descarga autenticada de un R2 **real** en producción, porque la tabla D1 tiene cero originales staged. El deploy y las pruebas de código NO sustituyen esa descarga. Mantener la nueva recepción/pago R2 **NO_GO** hasta un pedido >40 MiB controlado, acreditado y recibido, con verificación de la descarga y preprensa. No inventar un pedido pago, no insertar registros falsos en D1 ni habilitar cobros globales para generar evidencia. La web principal `main` permanece intacta.
