## Medición real de latencia Google — 21/10/2026

- **Ensayo real comunicado por el usuario**, worker privado `saber-documentos-pruebas`, versión `a087b1f4`, `/prueba-google`: **PING CONFIRMADO** mediante HMAC. Tiempo total navegador **1555 ms**; consulta firmada Google **1455 ms** (93,6 % de esa espera); diferencia **100 ms**. Recepción genérica de documentos permanece desactivada. No se subieron PDF ni se consumieron sesiones.
- **Interpretación limitada:** es una medición puntual de ping de conexión Cloudflare↔Google Apps Script y redirección, no es benchmark completo de subida, verificación SHA-256, Drive ni cotización. Las operaciones de subida sucesivas pueden acumular latencia incluso para archivos pequeños; no extrapolar el 93,6 % a toda la subida.
- **Acción implementada en código, todavía no desplegada:** desglosar los tiempos de `start` con lectura local/hash, `status/part` y `finish` en la pantalla multifichero. No se añade ninguna llamada ni se cambian límites, pagos, permisos, Apps Script ni web pública.
- **Siguiente prioridad:** reducir idas y vueltas secuenciales de Google con medidas de integridad y recuperación preservadas, usando las métricas de operaciones reales antes de abrir la carga comercial.

## Optimización de primera cotización — 21/10/2026

- **Implementado sólo en GitHub, rama de pruebas; no desplegado:** nuevo indicador `primeraCotizacion` booleano opcional del piloto multifichero. En primer presupuesto, el Worker consulta directamente `multiInfo` con sesión y token autenticados y omite la llamada previa redundante a `multiVerifiedStatus`; inmediatamente después sigue el circuito completo de descarga privada, verificación de integridad SHA-256, conteo con pdf-lib y `multiCommitPages`. Si los datos ya constan verificados, mantiene lectura del estado firmado antes de aceptar el recibo.
- **Re-cotización:** cuando el primer presupuesto se completó correctamente, la interfaz envía `primeraCotizacion=false` y el Worker usa como primera operación `multiVerifiedStatus`, por lo general una sola ida y vuelta a Google por archivo. Al sumar/quitar PDF de la lista, se vuelve a marcar primera cotización. Fallas mantienen estado inicial para reintentar de manera segura.
- **Impacto esperado:** una solicitud firmada Google menos por archivo nuevo durante el primer presupuesto. **No hay medición real del ahorro ni autorización para aumentar límites** hasta ensayo en Worker privado. No afecta Google Apps Script, sesión HMAC, almacenamiento, pagos ni sitio público.
- **Verificación técnica:** CI ejecución https://github.com/hernanchan/COTIZADOR/actions/runs/39617749887 debe finalizar exitosamente antes de instalar; el bundle `dist/saber-documentos-cotizador-fase4.mjs` debe verificarse después de compilar.

## Optimización de carga nueva e instrumentación por PDF — 21/10/2026

- **Cambio funcional en rama de desarrollo, todavía NO desplegado:** en la pantalla multifichero, al crear una sesión nueva mediante `multiStart`, se omite la petición `multiStatus` que siempre informaría 0 fragmentos. En sesiones interrumpidas/reintentadas que ya se guardaron localmente, **se conserva `multiStatus`** para comprobar fragmentos aceptados antes de reenviar; el receptor sigue verificando integridad SHA-256, cupos y firma HMAC en cada operación. Esto ahorra una ida/vuelta a Cloudflare→Apps Script→Drive por archivo **sólo en primer intento**. La reducción en segundos aún no fue medida.
- **Instrumentación por archivo:** `POST /api/ensayo-cotizar-lote` expone únicamente tiempos no sensibles de la verificación privada por documento (estado previo, consulta Google cuando aplica, lectura por fragmentos, análisis y confirmación). La pantalla muestra el desglose temporal para medir el cuello de botella real. No expone llaves, rutas de Drive ni bytes.
- **Pruebas añadidas/actualizadas:** comprobar que el estado no se consulta en una sesión recién creada, sí en reintentos; revisar latencias reportadas y sintaxis de interfaz. Ejecuciones de GitHub Actions automáticas; validar resultado final antes de habilitar nueva instalación.
- **Reglas comerciales y producción:** sin cambios; mantener pagos apagados, sitio público intacto y Apps Script activo sin reemplazar.

## Mejoras de interfaz posteriores a la prueba multifichero — 21/10/2026

- **Realizado en rama de pruebas, aún NO desplegado:** selector múltiple de PDF con `multiple`, zona de arrastre, cola de archivos **previa** a la subida, opción B/N o color por cada PDF, quitar archivos pendientes, lista de recibidos y un único presupuesto conjunto. Se mantienen autenticación Turnstile por inicio de archivo y confirmación individual: **todavía NO hay un único token para todo el lote**.
- **Seguridad UX:** durante un envío se bloquean cambios en la cola para evitar incongruencias; no se elimina ni se recupera el cupo de Drive al quitar un PDF de la cotización. No se han cambiado Apps Script, cupos ni pagos.
- **Validación automática:** GitHub Actions ejecución [39601540089](https://github.com/hernanchan/COTIZADOR/actions/runs/39601540089) `success` incluye selector múltiple, sintaxis JS, pruebas de precios y compilación esbuild. Cambio adicional de textos y bloqueo de controles (commit `a090f6a7`) pendiente de la ejecución CI correspondiente al momento de registrar.
- **RENDIMIENTO PENDIENTE:** esta mejora simplifica selección y preparación, **no reduce todavía la latencia de las llamadas a Google**. Falta evaluar tiempos reales de `multiStart`, `status`, `part`, `finish` y verificaciones antes de modificar el protocolo, especialmente para archivos más grandes. La interfaz de pruebas actual en Cloudflare no cambia hasta nuevo despliegue.

## Validación real de FASE 5 — 21/10/2026

- **Resultado comunicado por el titular:** prueba real de **dos PDF de dos páginas cada uno**, con flujo multifichero y cotización, **todo correcto funcionalmente**. La pantalla de FASE 5 fue desplegada en Worker aislado `saber-documentos-pruebas`, versión activa `89300d6a`, con Google Apps Script de documentos ya instalado (versión 5). No se reportaron errores de integridad, páginas o cotización en esta prueba, aunque no se recibieron tiempos medidos ni capturas de resultados finales.
- **Problema crítico de rendimiento:** el usuario reporta **esperas excesivas** incluso con dos PDF de sólo dos páginas. Esto bloquea aprobación de UX comercial. Investigar latencia por operaciones `multiStart`, `multiStatus`, `multiPart`, `multiFinish`, `multiVerifiedStatus`, `multiInfo`, `multiReadPart`, `multiCommitPages`; medir por etapa antes de rediseñar. Revisar ida/vuelta Cloudflare ↔ Apps Script ↔ Drive, secuencialidad y lecturas repetidas. No relajar SHA-256, HMAC, conteo real, idempotencia o bloqueo de pagos. No presentar el mero cambio de límite 1 MiB como solución de rendimiento.
- **Problema crítico UX de carga:** agregar un archivo por vez, elegir modalidad y repetir Turnstile no es intuitivo para clientes. **Nuevo criterio de diseño:** selección múltiple y arrastrar/soltar, lista de archivos antes de enviarlos, asignación B/N/color por archivo en un mismo lote, progreso individual y global, errores claros, posibilidad de modificar/quitar antes de comenzar, interfaz de un solo flujo sin perder progreso. Analizar autenticación única por sesión de lote con validación individual de permisos y cuotas en servidor antes de prometerla.
- **Próxima prioridad:** instrumentación medible en vivo y prototipo de interfaz UX primero en rama de pruebas; no obligar al titular a repetir cargas de prueba innecesarias ni publicar cambios sin validación. Mantener producción, Polaroids, tarifas reales y pagos intactos.

# Librería Saber — Registro maestro de ideas, decisiones y pendientes

**Proyecto:** migración integral del cotizador web, Polaroids, recepción privada y Centro de Pedidos.  
**Última actualización:** 20/10/2026.  
**Propósito:** conservar las ideas que van surgiendo en conversaciones, incluidas las que se implementarán más adelante, sin confundirlas con funciones ya entregadas. Mantener este archivo en la rama de desarrollo y enlazar a especificaciones técnicas detalladas. No incluir secretos, datos personales de clientes, claves, movimientos bancarios o enlaces privados.

## CI finalmente localizado, FASE 5 lista para ensayo aislado (21/10/2026)

**GitHub Actions verificado con evidencia real:** ejecución [39592168255](https://github.com/hernanchan/COTIZADOR/actions/runs/39592168255), commit `0e082570b214e563646c895f42a15454705735e8`, conclusión **success**. Todos los pasos verdes: tests FASE 2/3, pruebas de umbrales/lote/pantalla, compilaciones esbuild, E2E FASE 4+5, revisiones de sintaxis, commit del dist en rama y artefacto. El método de consulta anterior sólo devolvía ejecuciones asociadas a PR; el resultado fiable procede de la colección `/actions/runs` y detalles del job.

**Paquete compilado confirmado:** `integraciones/autocotizador/recepcion/dist/saber-documentos-cotizador-fase4.mjs`, SHA de contenido GitHub `77597add4b070265e540e8aae93bb5aab2933d8e`, 507210 caracteres UTF-8 aprox.; incluye literalmente las rutas de FASE 5 `/prueba-cotizador-lote` y `/api/ensayo-cotizar-lote`. Nombre `fase4` heredado; **es el bundle con FASE 5**. No pegar fuente sin empaquetar.

**Instalación pendiente:** exclusivamente actualizar código de `saber-documentos-pruebas` con dicho bundle, sin cambiar Apps Script instalado (implementación `Sin título` v5), variables, producción, Polaroids o pagos. Solicitar/obtener evidencia de despliegue antes de pedir archivos. El cupo de cinco PDF es global y puede estar parcialmente consumido.

## Validación directa y primera mejora de recotización — 21/10/2026

- Se revisó el estado de la integración, pero la consulta de GitHub Actions devuelve listas vacías en el conector (el método de ejecuciones sólo enumera acciones de pull requests). **No declarar CI aprobado** por ese motivo.
- Se verificó directamente la sintaxis JavaScript del formulario HTML multifichero y del código fuente del Worker (con imports externos apartados para el control sintáctico): **correcta**. Las rutas `/prueba-cotizador-lote` y `/api/ensayo-cotizar-lote` están presentes en el fuente.
- Se ejecutaron directamente en un evaluador JavaScript cinco casos de los módulos puros: suma de tres PDF 20+30+50 (100 impresiones B/N, precio unitario de prueba 76, total 7600), B/N+color por separado, rechazo de páginas sin verificación, rechazo de duplicados y anillados por separado. **Los cinco casos pasaron**. Esto no sustituye las pruebas integrales Node/esbuild/Google reales.
- Optimización segura de recotización: `fase4PrivateVerified` consulta primero `multiVerifiedStatus` con sesión+token. Si el PDF ya tiene recibo completo verificado, retorna inmediatamente con **una única llamada** a Apps Script (antes eran `multiInfo` + `multiVerifiedStatus`, dos llamadas). Si aún no está verificado, continúa el procedimiento original de descarga por fragmentos, SHA-256 y conteo de páginas del PDF guardado. Se agregó aserción e2e para la llamada eliminada, **pendiente de ejecución CI**. No afirmar una reducción de segundos sin medición real.
- Todo está guardado sólo en rama de desarrollo; **NO desplegado**, sin cambios en Apps Script, Cloudflare público, Polaroids ni pagos.

## Instrumentación y validación adicional — 21/10/2026

- Pantalla de lote y endpoint de cotización incorporados a la rama de desarrollo, **todavía no desplegados**.
- Nuevo test `tests/autocotizador-pantalla-lote.test.mjs`: comprueba controles del formulario, punto de entrada del presupuesto y sintaxis JavaScript del HTML.
- GitHub Actions ampliado para ejecutar pruebas del lote, escalas y pantalla y revisar sintaxis de archivos fuente; **resultado de ejecución aún no confirmado** mediante acceso a Actions.
- El formulario en desarrollo muestra duración de carga completa, transmisión/estado de fragmentos y confirmación en Drive. Además, el Worker en desarrollo mide el tiempo de verificación privada del PDF. Queda pendiente un ensayo con la implementación real para poder diagnosticar la lentitud; no se han medido tiempos reales.
- Mantener `main`, Worker desplegado, Google Apps Script, Polaroids y cobros sin modificaciones hasta validar CI y aprobar explícitamente el siguiente ensayo.

## Piloto multifichero — integración en código, pendiente de pruebas (21/10/2026)

**Todavía NO desplegado:** se prepararon la pantalla `GET /prueba-cotizador-lote` y el endpoint `POST /api/ensayo-cotizar-lote`, exclusivamente dentro del Worker de desarrollo. El cliente agrega documentos uno por uno, con Turnstile por inicio, consulta fragmentos confirmados antes de reenvío y conserva las sesiones en esa pestaña. Una lista de hasta cinco PDF forma una cotización conjunta, con modo B/N o color elegido por archivo y parámetros comunes de formato, caras y copias. Se permiten anillados juntos/separados en este piloto; tandas con formato o papel diferente siguen pendientes.

**Seguridad:** el Worker recupera por HMAC el recibo de cada sesión desde Apps Script, verifica bytes/páginas si hace falta y recién después llama al agregador de precios. Nunca acepta páginas, precios ni recibos autodeclarados por el navegador; rechaza sesiones duplicadas y mantiene pagos desactivados. El límite de cinco sesiones es global al piloto (puede haber sesiones consumidas previamente): quitar un PDF de la pantalla NO libera cupo ni elimina su archivo privado.

**Rendimiento:** el nuevo Worker de desarrollo registra fases de lectura privada, análisis PDF y confirmación de Google, pero todavía no hay mediciones reales. No prometer que la carga será más rápida. Tampoco se implementó reanudación tras cerrar la pestaña.

**Pruebas:** añadidas pruebas e2e del nuevo endpoint y de la sintaxis de la pantalla al workflow de GitHub Actions. No marcar la integración como validada hasta confirmar la ejecución y resultados del CI. El paquete compilado desplegado previamente corresponde a la fase 4 de un solo PDF; no copiar manualmente el nuevo código fuente al Worker de Cloudflare.

## Desarrollo posterior al piloto — 21/10/2026 (sin publicar)

- **Motor de descuentos:** `cotizar-documentos.mjs` agrega `siguienteDescuentoBN` y `siguienteDescuentoColor`, calculados desde las escalas existentes y sin sugerir descuentos inexistentes. Se añadieron pruebas de cruces de umbrales, copias y separación B/N/color.
- **Lote multifichero, todavía sin interfaz:** nuevo módulo `integraciones/autocotizador/pruebas/cotizacion-multifichero-piloto.mjs`. Agrega de 1 a 5 PDF de sesiones independientes SOLO si el servidor suministra todos los recibos verificados: páginas, almacenamiento, huella y autorización de pago cerrada. En el piloto, cada PDF conserva su recibo individual; no se crea todavía un pedido conjunto real ni se autoriza checkout. Rechaza recibos duplicados o incompletos.
- **Automatización de pruebas:** se amplió el workflow de GitHub Actions para ejecutar los nuevos tests del motor de umbrales y lote multifichero tras cambios en la rama de desarrollo. **No considerar aprobados los tests nuevos hasta consultar la ejecución de CI**. Estos cambios no alteran el Worker desplegado ni el Apps Script instalado.
- **Próximos trabajos:** medir latencia de cada llamada a Google y conteo de páginas en el Worker de pruebas; implementar identidad de lote, interfaz multifichero y presupuesto agrupado mediante verificación del servidor, manteniendo bloqueados los pagos.

## Hito real y requisitos ratificados — 21/10/2026

**FASE 4: VERIFICADO EN PILOTO REAL, UN PDF NUEVO.** El titular instaló el receptor `DocumentosReceiver_FASE4_CINCO_PDF.gs` en el proyecto Apps Script exclusivo de documentos, actualizando la implementación activa «Sin título» a versión 5 (21/10/2026 07:38), cuya URL coincide con `DOCS_SCRIPT_URL` del Worker aislado `saber-documentos-pruebas`. Instaló el bundle compilado `dist/saber-documentos-cotizador-fase4.mjs` en dicho Worker (despliegue `d8d46fab`). La captura del navegador confirmó, para un PDF nuevo de autorización de viaje, **2 páginas verificadas en servidor, 1 copia B/N A4 simple, total orientativo ARS 200, recibo DOC-e1ee9414-9fc7-4d31-aaf4-37afcee68b45, pagos desactivados**. Evidencia aportada mediante captura del navegador; no se inspeccionó por separado el archivo en Drive. **No habilitar pagos, producción ni actualizar `main`**. La URL enlazada desde Cloudflare es la implementación activa «Sin título», no la implementación «PRUEBA 3» archivada que mencionan instrucciones históricas; corregir esas instrucciones antes de nuevos despliegues.

**Requisitos reafirmados por el titular antes de avanzar:**

- **Rendimiento:** la carga/verificación de un PDF resulta perceptiblemente lenta. Medir tiempos de transmisión por fragmentos, llamadas Apps Script/Drive, relectura/hash y conteo `pdf-lib`; optimizar el cuello de botella sin eliminar la verificación de integridad, páginas ni controles HMAC/Turnstile. No afirmar mejoras de velocidad sin mediciones.
- **Multifichero:** ofrecer subida de varios PDF en una misma operación/cotización, con tandas y modos B/N/color, parámetros por grupo, desglose, orden y opciones de anillado. El piloto actual admite hasta cinco sesiones/PDF individuales de 1 MiB, **no** equivale aún a carga multifichero comercial.
- **DECISIÓN COMERCIAL CONFIRMADA 21/10/2026 — acumulación por tramo:** el titular ratifica la modalidad vigente en Librería Saber: sumar las **impresiones efectivas** de varios PDF compatibles dentro de la misma cotización/tanda para determinar el tramo de descuento por volumen, aunque se trate de archivos diferentes. Ejemplo: tres PDF de 20 páginas cada uno, 1 copia B/N A4 simple por PDF = 60 impresiones para el umbral B/N A4, no tres escalas separadas de 20. Separar escalas de modalidades/tarifas incompatibles (p. ej., B/N y color, A4 y A3, papel o caras si la tarifa los distingue), sin combinar importes o unidades incorrectamente. Incentivar a enviar más impresiones/copias al reducir el precio unitario según umbral aplicable; **no** asumir que el importe total baja al agregar copias. Determinar tramos y reglas exactos comparando con el cotizador comercial vigente; no inventar cifras ni publicar tarifas de pruebas. Incorporar pruebas en los límites de cada tramo y pruebas de varios archivos juntos.
- **Escalas por volumen:** conservar **exactamente** los tramos de descuento por cantidad del cotizador vigente: al crecer la cantidad, aplicar la tarifa correspondiente, distinguiendo formato, modalidad, papel y caras. `cotizar-documentos.mjs` ya selecciona `scales` por `from/to`, pero falta contrastar los valores comerciales actuales con `precios-web.json` (generado 21/08/2026), validar unidad de cómputo y ensayar cruces de umbrales. **No asumir que ARS 200 representa una tarifa aprobada.** Precios definitivos siempre recalculados en servidor.
- **Siguiente trabajo:** rendimiento medido + experiencia multifichero + paridad de escalas con web vigente, todo en rama aislada, sin alterar Polaroids, producción, secretos ni pagos.

## Fase 4 — carga y presupuesto de un PDF NUEVO en la misma pantalla (20/10/2026)

**Estado:** código preparado y probado en la rama de desarrollo; **todavía NO instalado en Apps Script ni Cloudflare**. A diferencia de las fases 2–3, donde sólo se consultaba el PDF original de 6 páginas, esta fase permite que cada ensayo **seleccione un nuevo PDF**. El ensayo está limitado a cinco PDFs nuevos de 1 MiB máximo cada uno, con sesiones separadas y recibos nuevos. Las claves HMAC y Turnstile actuales se reutilizan sin cambios.

- **Google Docs script nuevo:** `integraciones/autocotizador/recepcion/DocumentosReceiver_FASE4_CINCO_PDF.gs`. Conserva fases anteriores; añade operaciones HMAC `multiStart`, `multiStatus`, `multiPart`, `multiFinish`, `multiInfo`, `multiReadPart`, `multiCommitPages` y `multiVerifiedStatus`. Limita a cinco sesiones diferentes mediante ScriptProperties y bloqueo de concurrencia, exige sesión + token también al consultar bytes privados y conserva el sistema original sin modificación. No habilita cobros.
- **Worker fuente:** `integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs`; **bundle listo para copiar**: `integraciones/autocotizador/recepcion/dist/saber-documentos-cotizador-fase4.mjs`. Añade página `GET /prueba-cotizador-pdf` y APIs del mismo origen `POST /api/ensayo-pdf` y `POST /api/ensayo-cotizar`. El cliente elige **PDF nuevo** (no archivo anterior), modo BN/color, A4/A3, simple/doble, copias y anillado. Turnstile protege el inicio, los fragmentos llevan SHA-256, el Worker valida las páginas directamente del archivo ya guardado en Drive mediante `pdf-lib`, y calcula el precio mediante el motor existente y el recibo verificado. Se consulta `status` antes de reenviar partes; en la misma sesión del navegador reutiliza el identificador de ensayo generado aleatoriamente para evitar duplicados. No promete recuperación tras cerrar la pestaña ni archivos mayores de 1 MiB.
- **CI real de GitHub:** ejecución <https://github.com/hernanchan/COTIZADOR/actions/runs/39498812922> **completada con éxito**. `fase4-e2e.test.mjs` generó un PDF auténtico de seis páginas y probó contra el **bundle compilado** las rutas, Turnstile simulado, firma HMAC, subida por fragmentos, verificación de páginas con pdf-lib, recibo, cotización A4 simple BN 1 copia por $600 orientativos y doble faz 2 copias con anillado $5620 orientativos. Rechazó manipulación de páginas, origen ajeno, Turnstile fallido y comprobó que las rutas generales continúan HTTP 503 aunque `DOCS_UPLOAD_ENABLED=true`. Además, se simuló en memoria el receptor Apps Script (idempotencia, cinco sesiones, sexto PDF rechazado, autenticación por token, comprobación de páginas y pagos cerrados).
- **Importante:** esta es aún una integración piloto aislada; ninguna prueba anterior ni este CI prueba el flujo fase 4 contra cuentas reales. Antes de aprobar precios/checkout se requiere actualización de `precios-web.json` (tarifas guardadas en 21/08/2026), reanudación robusta de cargas grandes, identificación del cliente y pedidos reales, protección de cuotas en producción, pago confirmado y Centro de Pedidos.
- **Para primer ensayo real fase 4:** reemplazar `Código.gs` **sólo en Apps Script de DOCUMENTOS** con archivo fase4 y actualizar **la misma implementación PRUEBA 3 con Nueva versión**, conservando permisos y claves; después reemplazar código del Worker aislado `saber-documentos-pruebas` por **el bundle fase 4**. Visitar `/prueba-cotizador-pdf`, seleccionar un PDF NUEVO de menos de 1 MiB y completar el formulario. No cambiar `DOCS_UPLOAD_ENABLED=false`, no tocar Polaroids ni main. Informar resultado literal. **No desplegado automáticamente.**


## Presupuesto piloto vinculado al PDF real de 6 páginas — 20/10/2026

**Estado:** preparado en GitHub y validado en CI, **sin instalar todavía la fase 3 en Cloudflare**. La fase 2 de recepción y conteo de páginas sí fue probada en servicios reales.

- `worker-fase3-presupuesto-pdf.mjs` añade `GET /prueba-presupuesto` y `POST /api/presupuesto-pdf` al Worker existente. El navegador sólo puede escoger formato A4/A3, simple/doble faz, 1–200 copias y con/sin anillado; **jamás recibe control sobre páginas, recibos, estado ni precio**. El Worker consulta `privatePilotInfo` y `privateVerifiedStatus` de Google Apps Script mediante las **mismas claves HMAC** del piloto. Rechaza si no hay seis páginas verificadas, recibo ajeno/no verificado o si Google autoriza pagos; entonces integra `cotizacion-desde-recibos-servidor.mjs`, `cotizar-documentos.mjs` y `manifiesto-documentos.mjs` usando una copia empaquetada de `precios-web.json`.
- El archivo listo para instalar sin dependencias es `integraciones/autocotizador/recepcion/dist/saber-documentos-presupuesto-fase3.mjs` (generado en la rama de pruebas por CI). Conserva las rutas de validación, el piloto limitado y el **bloqueo incondicional de cargas generales**, incluso si accidentalmente `DOCS_UPLOAD_ENABLED=true`; no toca la página pública ni los sistemas Polaroids, Mercado Pago o Google.
- **CI real ejecutado exitosamente en GitHub:** <https://github.com/hernanchan/COTIZADOR/actions/runs/39457576546>. Incluye pruebas Node del presupuesto basado en recibos verificados, lector PDF auténtico y compilación esbuild; se guardó el archivo compilado en la rama. Ensayo adicional del **bundle final** con Google/Turnstile simulados: seis páginas verificadas B/N, A4, simple faz, una copia **$600 orientativos**; dos copias, A4 doble faz, con anillado **$5.620 orientativos**; cliente intenta insertar `pages=999999` → HTTP 400; ruta general de subida → HTTP 503 aun con `DOCS_UPLOAD_ENABLED=true`. Se comprobó sintaxis JS del formulario HTML.
- **IMPORTANTE sobre precios:** `precios-web.json` usado en build fue generado el **21/08/2026**. Este ensayo es de integración técnica, **NO un precio comercial aprobado ni apto para cobrarse a clientes**. Respuesta y pantalla indican `paymentAuthorized:false`.
- **Siguiente ensayo permitido:** sin cambiar Apps Script ni claves, copiar **sólo el bundle fase 3** al Worker aislado `saber-documentos-pruebas` mediante Editar código → Implementar, abrir `/prueba-presupuesto`, completar Turnstile y calcular con el PDF ya recibido. Pedir al titular el resultado literal antes de iniciar carrito/pagos. No reutilizar la tabla de agosto para publicar precios reales.


## Hito real — conteo autoritativo de páginas, 20/10/2026

El titular implementó el Apps Script `DocumentosReceiver_VALIDACION_FASE2.gs` sobre **PRUEBA 3** y el Worker compilado `dist/saber-documentos-validacion-fase2.mjs` en `saber-documentos-pruebas`, sin alterar sitio público ni Polaroids. Tras abrir `/prueba-validacion`, confirmó literalmente:

> PDF VERIFICADO EN SERVIDOR: 6 página(s).  
> Recibo: DOC-da162bf3-5b63-48d5-81fe-0f20bd7d02d9  
> Pagos: desactivados.

**Resultado confirmado en entorno real a partir del mensaje de la interfaz:** el Worker obtuvo por conexión firmada los bytes del mismo PDF previamente recibido de Drive, verificó SHA-256 y empleó el lector PDF empaquetado (`pdf-lib`) para contar **6 páginas**. Apps Script guardó el resultado verificado y lo asoció al recibo. No se modificó la carpeta privada ni hizo segunda carga. **Esta evidencia no confirma precio, carrito, cobro ni pedido del Centro de Pedidos.** Continúan desactivados.

**Siguiente prioridad:** enlazar `privateVerifiedStatus` al presupuesto servidor del cotizador con precios aprobados, primero como simulación B/N A4, sin habilitar cobro.

## Cómo vamos a tomar nota

Cada idea nueva tiene ID estable, fecha, estado, alcance y criterio para retomarla. Etiquetas:

- **DECIDIDO:** el titular aprobó el comportamiento funcional. No implica implementación.
- **EN DESARROLLO:** hay código en rama de pruebas, pero falta conectar/probar o desplegar.
- **PROPUESTO:** idea a evaluar o diseñar; requiere aprobación antes de activar.
- **DIFERIDO:** conservar la idea para una fase posterior sin frenar el desarrollo principal.
- **VERIFICADO EN PILOTO:** ensayo funcional parcial; no presume disponibilidad en producción.
- **PUBLICADO:** solo cuando exista autorización expresa y se compruebe en la web oficial.

Cada vez que surja una propuesta: agregar nueva entrada o actualizar la correspondiente, registrar decisión/fecha y diferenciar claramente «programado», «ensayado» y «activo». En las revisiones del proyecto consultar primero este índice y luego la especificación de cada tema.

## Ideas y decisiones agrupadas

| ID | Idea / decisión | Estado al 20/10 | Etapa y próximo paso |
| --- | --- | --- | --- |
| WEB-01 | **Un solo cotizador migrado** con todas las categorías, precios reales, carrito unificado y sin reemplazos improvisados. Mantener web actual intacta hasta autorización. | DECIDIDO / EN DESARROLLO | Integración progresiva en rama privada; QA antes de publicar. |
| WEB-02 | **PDF por tandas B/N y color**. Leer páginas reales, A4/A3, papel, caras, copias; jamás confiar exclusivamente en recuento del navegador. | DECIDIDO / VERIFICADO EN PILOTO PARCIAL | 20/10: primer PDF almacenado en Drive verificado en backend por SHA y **6 páginas reales** con `pdf-lib` y confirmación Apps Script vinculada al recibo. Sigue pendiente vincular tarifas aprobadas, varias tandas, entrega a producción y pago. |
| WEB-03 | **Anillados conjuntos, separados y mixtos**: el cliente elige orden de los PDF y grupo; incluir trabajo suelto. | DECIDIDO / EN DESARROLLO | Motor de grupos y ficha de armado en código; falta integración end-to-end. |
| WEB-04 | **JPG/PNG**: componer 1, 2, 4 o 9 imágenes por cara A4/A3, encuadre y zoom, advertencia PPI según tamaño final, PDF privado listo para imprimir. | DECIDIDO / PARCIAL | Planificador puro ya preparado; falta interfaz, composición, validación y almacenamiento. |
| WEB-05 | **Ploteos**: planos CAD y pósteres/imágenes grandes por caminos de cálculo separados, tamaño final seleccionado por cliente, rollo/orientación apropiados. | DECIDIDO / PARCIAL | Reutilizar calculadora existente; falta ruteo por archivo/tamaño final. |
| WEB-06 | **Polaroids solo fotografías**: editor específico de seis por A4, calidad, encuadres y marcas de corte; no mezclar su recepción con documentos. | DECIDIDO / VERIFICADO EN PILOTO | Mantener receptor de fotos sin cambios; integrar al carrito y descargas del Centro de Pedidos. |
| WEB-07 | **Drive privado, un Centro de Pedidos**, separados por servicio/pedido. Archivos originales y PDF de impresión accesibles al operador mediante descarga protegida. | DECIDIDO / VERIFICADO EN PILOTO PARCIAL | **20/10: primer PDF real recibido desde Chrome, pasando por Cloudflare y Apps Script firmados, guardado en Drive y cotejado por tamaño y SHA-256 del archivo descargado; recibo `DOC-da162bf3-5b63-48d5-81fe-0f20bd7d02d9`.** Piloto de un único PDF hasta 1 MiB, sin páginas verificadas ni pagos. No se ha inspeccionado visualmente el archivo en el Drive privado desde ChatGPT; aún no existe Centro de Pedidos integrado. Polaroids y web pública intactos. |
| WEB-08 | **Subidas recuperables**, especialmente desde celular si se apaga pantalla; reanudar fragmentos, evitar archivos incompletos y cotejar integridad, sin gastos/R2. | DECIDIDO / PILOTO PARCIAL | Envío real fragmentado de 1 PDF con cotejo SHA-256 al final confirmado el 20/10; falta demostrar reanudación ante interrupción, cargas grandes y distintos dispositivos. El cupo del piloto inicial ya se utilizó. |
| WEB-09 | **Mercado Pago pago total**: verificar pago de servidor, webhook cuando funcione y conciliación periódica aceptable; comprobación manual alternativa. | DECIDIDO / VERIFICADO EN PILOTO | Piloto de pagos existente; no asociar automáticamente archivos incompletos a producción. Comprobar cron sin intervención. |
| WEB-10 | **Transferencia a cuenta propia** como alternativa a MP, con verificación manual simple y botón «Confirmar pago» en Centro de Pedidos. | DECIDIDO / NO IMPLEMENTADO | Vincular movimiento real a pedido, titular/operación/comprobante opcional y evitar confundir transferencias del mostrador del mismo importe. Nunca confirmar por comprobante solamente. |
| WEB-11 | **Control de cuota de Drive**: conservar archivos de trabajos entregados **30 días** y luego enviarlos a papelera **7 días** antes de borrado definitivo. Mantener histórico comercial. | DECIDIDO / CÓDIGO EN SIMULACIÓN | Motor de retención desarrollado apagado; falta estado «Entregado», inventario confiable por pedido, prueba de reversión y autorización para activar borrado. No tocar históricos Polaroids. |
| WEB-12 | **Carritos abandonados**: borrar archivos privados **48 h después de inactividad**, más 7 días de papelera, cuando realmente no haya pago, transferencia pendiente ni reclamos. | DECIDIDO / NO IMPLEMENTADO | Crear estado de carrito abandonado y vencimientos; consulta bancaria/MP antes de borrar. Nunca aplicar automáticamente a transferencias pendientes. |
| WEB-13 | **Recuperación de carritos**: preservar archivos, fotos y encuadres y dar enlace seguro para retomar sin crear pedido duplicado. | DECIDIDO / NO IMPLEMENTADO | Preparar los identificadores y el estado persistente desde la etapa actual de carrito; revalidar precio/promos al regresar. |
| WEB-14 | **Mensaje automático de recordatorio por WhatsApp** si cliente abandona compra; sugerido **uno solo a las 3 h**, consentimiento expreso previo y posibilidad de baja. | DIFERIDO / IDEA APROBADA PARA PREPARAR | No bloquear la primera publicación. Evaluar más adelante WhatsApp Business Platform oficial, plantilla, categoría, costo y consentimiento; no usar WhatsApp Web automatizado ni gastar sin aprobación. |
| WEB-15 | **Ofertas exclusivas del cotizador**: mostrar un producto muy conveniente cuando el usuario calcula precio, válido sólo si compra impresiones. Primera idea: bitácora con foto real. | PROPUESTO / DIFERIDO | Recuperar condiciones y foto aprobadas, revisar márgenes y UX; no desviarse antes de cerrar recepción/pagos. |
| WEB-16 | **Descuentos por día y cupones** deben aplicarse igual entrando por oferta, WhatsApp o directamente al cotizador; coherencia del carrito y promos. | DECIDIDO / VERIFICACIÓN PENDIENTE | Comparar reglas y tarifas actuales de la web antes de migrar a backend autoritativo. |
| WEB-17 | **Control final de producción**: estados recibido, archivos verificados, pago pendiente, pagado, en producción, completado, entregado y pausado por reclamo. | DECIDIDO / NO INTEGRADO | Centro de Pedidos con descarga PDF privada y acción «Marcar entregado»; punto necesario para limpieza programada. |
| WEB-18 | **No modificar producción, no contratar servicios ni generar cargos sin permiso**. | DECIDIDO / RESTRICCIÓN PERMANENTE | Rama privada de pruebas; no fusionar a `main` ni activar receptor, borrado, MP nuevo o WhatsApp sin autorización expresa. |

## Prioridad inmediata (secuencial)

1. **COMPLETADO EN PILOTO (20/10):** comunicación Cloudflare ↔ Google HMAC y primera transferencia de un PDF de Chrome a Drive privado comprobado por SHA-256, con un solo PDF de hasta 1 MiB y sin cobros. No repetir el mismo piloto: el cupo ya se consumió.
2. **SIGUIENTE:** implementar conteo confiable de páginas PDF del lado servidor y reporte de tamaño/formato; mantener bloqueo de pago cuando no exista verificación. Diseñar después pruebas de reanudación con sesiones independientes, sin tocar la web pública.
3. Integrar precio servidor, carrito, recepción de JPG/PNG y ploteos, y Centro de Pedidos con descargas.
4. Conectar Mercado Pago y transferencias manuales al mismo estado seguro del pedido, incluir control de entregas.
5. Incorporar retención de 30+7 días, limpieza de abandonos 48 h + 7 días, y enlace para recuperar el carrito; primero simulaciones.
6. Después de publicación y estabilidad: estudiar recordatorio automático de WhatsApp y otras mejoras comerciales, con presupuesto aprobado.

## Avance de ingeniería del 20/10/2026 (posterior al primer PDF real)

- **Nuevo módulo:** `integraciones/autocotizador/pruebas/cotizacion-desde-recibos-servidor.mjs`. Une cotizador B/N/color + anillados y ficha de armado **sólo** si cada recibo, consultado por el backend, confirma `storageVerified:true`, `pageVerification:'server'`, páginas, SHA-256, pedido y nombre. El navegador NO puede imponer una cantidad de páginas ni un importe. El resultado bloquea explícitamente el pago (`paymentAuthorized:false`). Pruebas aisladas realizadas: cotización de un PDF A4 de tres páginas a ARS 300 según `precios-web.json` vigente en el código, y rechazo de discrepancias de páginas, SHA, pedido, nombre, modalidad, recibo sin verificación o tarifas faltantes. **No constituye aprobación comercial de las tarifas** (planilla generada en agosto de 2026).
- **Nuevo módulo:** `integraciones/autocotizador/recepcion/verificacion-pdf-drive-servidor.mjs`. Para Cloudflare Workers **empaquetado con** `pdf-lib`: vuelve a comparar hash/tamaño de los bytes originales **releídos del Drive privado** y lee el árbol de páginas con un motor PDF. Fail-closed: no verifica PDF corruptos/cifrados o pages fuera de rango. Pruebas unitarias con parser inyectado; **no** se ha empaquetado la librería ni probado con PDF real. No conectar a cobro ni llamar a esto integración terminada.
- **Bloqueante inmediato**: mecanismo firmado y por fragmentos para que el Worker de validación obtenga el PDF **privadamente de Drive**, biblioteca PDF empaquetada, y actualización autoritativa del estado del recibo antes de cotización. Después, una única prueba integral de cotización real. Mantener aislada la web pública y sin volver a pedir cambio de claves.
- **Prioridad de ejecución**: cerrar un flujo integral sencillo (PDF B/N/color A4/A3 → páginas del servidor → precio aprobado → carrito → pago confirmado → Centro de Pedidos), antes de ampliar ploteos y otras categorías. No reducir alcance funcional sin conformidad del titular.

## Validación fase 2 compilada y comprobada — 20/10/2026

- **CI real en GitHub (rama aislada):** ejecución exitosa <https://github.com/hernanchan/COTIZADOR/actions/runs/39453996039>. Ejecutó `npm test` contra `pdf-lib@1.17.1`, compiló el Worker con `esbuild` y lo guardó dentro de la propia rama de pruebas, sin implementar cambios en Cloudflare ni Google. Archivo de instalación: `integraciones/autocotizador/recepcion/dist/saber-documentos-validacion-fase2.mjs`.
- **Ensayo adicional aislado del archivo final:** se importó el Worker empaquetado en Node, se generó un PDF auténtico de **tres páginas** con ReportLab, se simuló la respuesta firmada de Apps Script y un retorno de bytes desde Drive, y el bundle real de `pdf-lib` contó **3 páginas**. La prueba también verificó idempotencia de una validación repetida, rechazo de Turnstile, conservación de `paymentAuthorized:false` y bloqueo de la ruta general de uploads (HTTP 503).
- **Importante:** las llamadas a Google se SIMULARON en este último ensayo. Todavía falta que el titular instale la versión `DocumentosReceiver_VALIDACION_FASE2.gs` en el Apps Script de documentos y el Worker compilado en `saber-documentos-pruebas`, conservando la misma implementación de Google, las variables y las claves. Entonces debe visitar `/prueba-validacion` para verificar páginas del **PDF real que ya se subió a Drive**, sin cargar otro PDF. Los archivos de Polaroids y la web pública no se tocan. No cobrar por este resultado piloto.

## Referencias técnicas

- [Especificación principal](ESPECIFICACION_COTIZADOR_UNICO_AUTOMATICO.md)
- [Bitácora de la prueba del cotizador](../pruebas/README_COTIZADOR_ARCHIVOS.md)
- [Receptor PDF independiente — piloto aislado instalado](../integraciones/autocotizador/recepcion/README.md)
- [Retención y carritos abandonados](../integraciones/autocotizador/retencion/README.md)
- [Pruebas de pagos](../integraciones/mercadopago/pruebas/README.md)

**Alcance de esta bitácora:** es documentación y planificación, no evidencia de despliegue. Mantener el estado exacto de cada idea al actualizarla.
