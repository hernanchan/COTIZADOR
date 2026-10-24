# Express: configuración interna de ensayo — 24/10/2026

## Alcance autorizado

Completar exclusivamente saber-pagos-pruebas y saber-polaroids-express-pruebas. Sin cambios en main ni libreriasaber.com.ar, sin cobros, publicación de recepción, servicios pagos o cambios de credenciales. CENTRAL_BRIDGE_KEY en ambos proyectos y D1 se consideran declarados por el propietario; no fueron inspeccionados ni validados remotamente en esta revisión.

## Cambios internos preparados, pendientes de aplicar en Cloudflare

| Proyecto | Variable | Valor |
| --- | --- | --- |
| saber-pagos-pruebas | CENTRAL_BRIDGE_ENABLED | PRIVATE_TEST_ONLY |
| saber-pagos-pruebas | CENTRAL_EXPRESS_ENABLED | PRIVATE_TEST_ONLY |
| saber-pagos-pruebas | CENTRAL_EXPRESS_PREPARE_ENABLED | PRIVATE_TEST_ONLY |
| saber-polaroids-express-pruebas | EXPRESS_CENTRAL_SYNC_ENABLED | PRIVATE_TEST_ONLY |

EXPRESS también necesita CENTRAL_EXPRESS_URL: URL exacta del Worker saber-pagos-pruebas de esta cuenta, terminada en /internal/central/polaroid-stage. Obtener el host real del panel; no adivinar el subdominio. Ambos proyectos deben usar la misma CENTRAL_BRIDGE_KEY existente (mínimo 32 caracteres), independiente de las claves de administración, pagos y PDF. No copiar claves al repositorio o chat.

Estos valores preparan registro y creación de pedidos sin pago; no demuestran conectividad. La recepción permanece cerrada mediante su configuración y sus restantes bloqueos.

## Bloqueos que deben conservarse

- No activar CHECKOUT_ENABLED ni cambiar la configuración de Mercado Pago.
- No habilitar EXPRESS_RECEPTION_ENABLED, EXPRESS_PDF_ENABLED ni modificar recepcion-config.json para aceptar fotos.
- Conservar enabled:false, showInShop:false y rollout:PENDIENTE_DE_APROBACION en la configuración Express.
- Dejar CENTRAL_EXPRESS_DOWNLOAD_ENABLED sin activar en este paso. La descarga requiere confirmar EXPRESS_DOWNLOAD_SCRIPT_URL y su clave existente contra GAS; además, el código exige una compra con pago total verificado. No falsificar pagos para desbloquearla.
- No desplegar ni cambiar accesos, Turnstile, dominios o versiones desde este documento.

## Verificación realizada en una copia local de la rama

47 pruebas aprobadas, cero fallos. Incluyen generación de PDF A4 real para 6, 12, 19 y 24 fotos, un único PDF por pedido, reintentos idempotentes, firma HMAC, registro SQLite compatible con D1, orden mixta sin checkout, bloqueo de descarga impaga, rechazo de PDF alterado y recuperación local tras recarga. Google, Cloudflare, Turnstile y pagos externos se simulan; esto no es prueba integral remota.

Compilación esbuild del Worker Express correcta (838.7 KiB). No se desplegó el resultado. El bundle compilado no acredita por sí solo compatibilidad de CPU/memoria con el plan real de Cloudflare.

Comando de verificación reproducible, después de instalar las dependencias de los dos subproyectos como indica el workflow:

```bash
node --experimental-vm-modules --experimental-sqlite --test tests/polaroids-express-motor.test.mjs tests/polaroids-express-guardado.test.mjs tests/polaroids-express-tandas.test.mjs tests/polaroids-express-worker.test.mjs tests/polaroids-express-cliente.test.mjs tests/polaroids-express-recuperacion.test.mjs tests/central-polaroids-express.test.mjs tests/central-polaroids-descarga.test.mjs tests/central-bridge-d1.test.mjs tests/mercadopago-carrito.test.mjs tests/polaroids-preparacion.test.mjs tests/polaroids-carrito.test.mjs
```

## Pendiente remoto real

El navegador integrado no completó la sesión Cloudflare. No se cambió ninguna variable remota. Falta inspeccionar los valores no secretos y versiones instaladas, aplicar los interruptores internos preparados y verificar comunicación HMAC contra la D1 real usando únicamente datos sintéticos. Si el runtime instalado difiere de esta rama, revisar esa diferencia antes de actuar. No marcar la configuración ni la comunicación remotas como completadas hasta obtener evidencia del servicio.

## Host identificado en panel Cloudflare (24/10/2026)

La captura aportada por el propietario muestra el proyecto `saber-pagos-pruebas` en **Dominios**, con Worker URL `saber-pagos-pruebas.libreriasaber.workers.dev` habilitada. El destino exacto preparado para la variable no secreta `CENTRAL_EXPRESS_URL` en `saber-polaroids-express-pruebas` es:

```text
https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/polaroid-stage
```

**Alcance de esta evidencia:** identifica el host y la ruta prevista en el código; no prueba versión desplegada, firma HMAC, conexión con D1 ni estado de interruptores. Las comprobaciones externas del asistente no pudieron acceder al host desde su entorno. No se desplegó ni configuró ninguna variable de Cloudflare, no se enviaron pedidos o fotografías y no se alteraron secretos. Antes de aplicar variables, inspeccionar sus valores no secretos y confirmar qué versión hay instalada. Conservar todos los bloqueos del apartado anterior.

## Evidencia de implementación de Central — captura Cloudflare 24/10/2026, 15:00 (Argentina)

El propietario compartió captura de `saber-pagos-pruebas` > Implementaciones. Se ve como **versión activa** `4c40a1d0`, y tres implementaciones sucesivas marcadas `Listo`: `CENTRAL_BRIDGE_ENABLED`, `CENTRAL_EXPRESS_ENABLED` y `CENTRAL_EXPRESS_PREPARE_ENABLED`. En captura anterior de Variables y secretos aparecen los tres valores `PRIVATE_TEST_ONLY`, el secreto `CENTRAL_BRIDGE_KEY` enmascarado y la vinculación D1 `DB` a `saber-pagos-pruebas`. Evidencia **visual**, no lectura autorizada del runtime ni validación criptográfica.

El asistente intentó un GET no mutante a `/health` del dominio de pruebas, pero las herramientas externas no pudieron resolver/acceder al host; **no prueba caída del Worker**. No se enviaron manifiestos, pedidos ni fotos ni se validó HMAC real. Siguiente: inspeccionar `saber-polaroids-express-pruebas`, verificar código remoto respecto a la rama, y su configuración `EXPRESS_CENTRAL_SYNC_ENABLED` y `CENTRAL_EXPRESS_URL`, manteniendo apagadas recepción, PDF y checkout. No repetir las 47 pruebas locales.

## Comparación de despliegue Pages Express — 24/10/2026, 15:05 AR

Captura de `saber-polaroids-express-pruebas` > Implementaciones: sitio de pruebas en **Producción de este proyecto aislado**, implementación correcta con commit GitHub `d1167d8` (SHA `d1167d8441e859d1a36f49f1950bf69e93adb82f`), aproximadamente tres horas antes. `Implementaciones automáticas en pausa`. Las revisiones posteriores se muestran `No deployment available` y **no deben confundirse con despliegues realizados**.

Comparación exacta GitHub `d1167d8...` → rama `polaroids/express-pdf-unico-20261023`: **4 commits posteriores**, y solo dos rutas modificadas/agregadas: `docs/EXPRESS_CONFIGURACION_INTERNA_VERIFICADA_20261024.md` (documentación) y `integraciones/mercadopago/pruebas/migraciones/20261024-central-polaroids-express.sql` (migración aditiva D1). **No hay cambios de Worker o cliente Express en GitHub después del commit desplegado**. Esto no sustituye comparar el artefacto remoto compilado ni comprobar si las variables Pages guardadas son efectivas en la implementación vigente.

Configuración Pages vista en otra captura: `CENTRAL_BRIDGE_KEY` y `EXPRESS_PDF_HMAC_KEY` enmascaradas; `EXPRESS_ALLOWED_HOST=saber-polaroids-express-pruebas.pages.dev`; `EXPRESS_PDF_SCRIPT_URL` ya establecida; `EXPRESS_CENTRAL_SYNC_ENABLED=PRIVATE_TEST_ONLY`; `CENTRAL_EXPRESS_URL` con host `saber-pagos-pruebas.libreriasaber.workers.dev` (el campo no deja ver el sufijo en captura). Ninguna evidencia de que estén activadas `EXPRESS_RECEPTION_ENABLED`, `EXPRESS_PDF_ENABLED` o checkout. Archivo de `recepcion-config.json` en commit activo conserva `enabled:false`, `showInShop:false`, `rollout:PENDIENTE_DE_APROBACION`. Ninguna foto ni pedido real recibido o sincronizado en esta revisión. Comprobaciones GET de ambos hosts no resultaron accesibles desde herramientas externas del asistente; quedan pendientes verificaciones remotas.

## Prueba HTTP real de lectura de Pages Express — 24/10/2026

El propietario abrió en su Chrome el endpoint real `GET https://saber-polaroids-express-pruebas.pages.dev/api/polaroids-express` y reportó exactamente:

```json
{"ok":true,"service":"polaroids-express","enabled":false,"photosPerSheet":6,"maxPhotos":24,"pdfForClient":false}
```

**Acredita:** respuesta HTTPS del endpoint desde su navegador y recepción Express deshabilitada en la versión consultada. **No acredita:** sincronización Cloudflare↔Cloudflare firmada con HMAC, claves coincidentes, registro en D1 ni creación de pedido. No se transmitieron fotos, PDF, datos de pago ni información secreta. El asistente intentó consultar los hosts desde una herramienta web externa, pero esta no pudo acceder a ninguno de los dos: esto no implica caída del servicio. Próxima prueba pasiva sugerida: `GET /internal/central/polaroid-stage` del Worker Central, que con las claves/flags correctos debe rechazar peticiones GET sin firma con HTTP 403 y `Solicitud entre servidores requerida`. Esa comprobación sigue sin demostrar comunicación firmada.

## Prueba remota GET de Central — 24/10/2026

El propietario abrió en Chrome `GET https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/polaroid-stage` y obtuvo exactamente:

```json
{"error":"Sincronización privada no configurada"}
```

El código versionado de `integraciones/mercadopago/pruebas/worker.js` comprueba primero `CENTRAL_EXPRESS_ENABLED=PRIVATE_TEST_ONLY` (otro error si falla) y después en `centralReadSigned` comprueba `CENTRAL_BRIDGE_ENABLED=PRIVATE_TEST_ONLY`, que `CENTRAL_BRIDGE_KEY` sea string con 32+ caracteres y que no coincida con `DEMO_ADMIN_KEY` ni `MP_WEBHOOK_SECRET`. La respuesta recibida es **coherente con un rechazo de la guarda de configuración HMAC**, antes de comprobar método HTTP o firma. Capturas anteriores muestran ambos flags en `PRIVATE_TEST_ONLY`, secretos presentes pero cifrados y despliegues `Listo`; por ello **no se puede deducir la causa exacta ni validar longitud/igualdad de secretos**. Tampoco se ha confirmado que el código manualmente desplegado coincida al byte con la rama de GitHub. **No tratar el resultado como prueba HMAC o de D1.**

La siguiente inspección debe ser de solo lectura, sin reiniciar ni cambiar secrets: contrastar `centralReadSigned` del editor de Worker desplegado con la rama GitHub y, si coincide, evaluar un diagnóstico autenticado que solo exponga condiciones booleanas (sin contenido de secretos) en una versión de pruebas *si se autoriza expresamente su despliegue*. Evitar repeticiones de GET sin cambios, ya que producirían el mismo resultado.

## Inspección visual de código activo de Central — 24/10/2026

Captura del editor de Cloudflare para `saber-pagos-pruebas`, versión activa `4c40a1d0`: líneas 160–165 de `centralReadSigned(req,env)` muestran las mismas cuatro clases de comprobación que el código de la rama GitHub: `CENTRAL_BRIDGE_ENABLED===PRIVATE_TEST_ONLY`, clave existente con 32+ caracteres, diferente de `DEMO_ADMIN_KEY` y de `MP_WEBHOOK_SECRET`. La inspección visual cubre **solo el fragmento mostrado**, no el Worker completo. Como el GET real devuelve `Sincronización privada no configurada`, falla al menos una de estas condiciones en tiempo de ejecución, pero la captura no identifica cuál. No volver a pedir capturas del mismo código ni cambiar/revelar claves. El camino seguro para aislar causa es una función de diagnóstico de solo lectura y restringida al administrador, que informe exclusivamente booleanos de las condiciones. **No introducir ese endpoint ni desplegar sin autorización expresa**; permanecer en la rama de pruebas, nunca en `main` ni la web pública.

## Excepción autorizada: diagnóstico privado de configuración HMAC

El propietario **autorizó expresamente** una implementación de diagnóstico limitada al Worker `saber-pagos-pruebas` (sin modificar `main`, libreriasaber.com.ar, cobros, recepción de fotos, valores de secretos, Turnstile o D1). La autorización **no** permite habilitar otros servicios ni recibir fotografías.

Cambio preparado en la rama de pruebas, archivo `integraciones/mercadopago/pruebas/worker.js`: el endpoint de solo lectura `GET /demo/diagnostic`, **ya protegido por `DEMO_ADMIN_KEY` (cabecera Bearer)**, añade el objeto booleano `centralBridge` con `bridgeEnabled`, `expressEnabled`, `keyPresent`, `keyMinimumLength`, `keyDifferentFromAdmin` y `keyDifferentFromWebhook`. No devuelve claves ni longitudes. El botón existente `Diagnosticar configuración` de `/demo` consume ese endpoint. Se incorporaron pruebas de autorización y ausencia de secretos en `tests/central-bridge-d1.test.mjs`.

**Estado:** solo preparado en GitHub. El conector GitHub no tiene acceso para implementar Workers de Cloudflare. La implementación en Cloudflare requiere acción manual del propietario en su Chrome; comprobar que el código desplegado coincide con el cambio preparado. **No afirmar que se desplegó** sin evidencia de versión de Cloudflare y resultado auténtico. Después del diagnóstico, valorar retirar el bloque de diagnóstico adicional de la versión activa, con autorización, para reducir superficie de exposición. No solicitar secretos por chat.

## Diagnóstico remoto autenticado: causa identificada — 24/10/2026

El operador desplegó el cambio de diagnóstico **solo en `saber-pagos-pruebas`** y compartió una captura del botón *Diagnosticar configuración* de `/demo` con la respuesta real:

```json
{
  "ok": true,
  "missing": [],
  "ordersTableReady": true,
  "centralBridge": {
    "bridgeEnabled": true,
    "expressEnabled": true,
    "keyPresent": true,
    "keyMinimumLength": false,
    "keyDifferentFromAdmin": true,
    "keyDifferentFromWebhook": true
  }
}
```

**Diagnóstico concluyente:** el secreto `CENTRAL_BRIDGE_KEY` **existe pero tiene menos de 32 caracteres en `saber-pagos-pruebas`**. Los dos flags y los controles de independencia con administrador/webhook son correctos; la tabla de pedidos en D1 es accesible. Por diseño, `centralReadSigned` rechaza la sincronización antes de validar HMAC. No se han revelado claves, ni comprobado todavía si la clave en `saber-polaroids-express-pruebas` cumple longitud o coincide con la de Central. **No reducir la longitud mínima en el código.**

**Bloqueo de autorización:** la instrucción vigente prohíbe cambiar claves existentes. La autorización para desplegar el diagnóstico no constituye autorización para rotar `CENTRAL_BRIDGE_KEY`. Para resolverlo, obtener permiso explícito de rotación coordinada: generar fuera del chat una clave aleatoria de >=32 caracteres y usar exactamente la misma en Central y Express; además inventariar el vínculo opcional del Worker `saber-documentos-pruebas` (`DOCS_CENTRAL_SYNC_ENABLED` y `CENTRAL_BRIDGE_KEY`) para no romper la interoperabilidad documental si se encontraba activada. Mantener inalteradas todas las claves de administración, pagos y PDF, y los bloqueos de cobros y recepción de fotos. Después de corregir, repetir el GET sin firma del endpoint interno y esperar rechazo `Solicitud entre servidores requerida` (no acredita por sí solo HMAC). El diagnóstico privado debe retirarse tras validación bajo autorización específica. No se crearon registros de pedidos ni fotografías con esta prueba.

## Diagnóstico de dependencia Documentos en rotación HMAC — 24/10/2026

Captura de Cloudflare del proyecto `saber-documentos-pruebas`, pestaña Configuración → Variables y secretos de runtime (Producción): figuran `DOCS_ALLOWED_ORIGIN`, `DOCS_PING_ENABLED`, `DOCS_RELAY_KEY`, `DOCS_SCRIPT_URL`, `DOCS_TURNSTILE_SECRET`, `DOCS_TURNSTILE_SITE_KEY` y `DOCS_UPLOAD_ENABLED=false`. **No aparecen** `CENTRAL_BRIDGE_KEY`, `DOCS_CENTRAL_SYNC_ENABLED` ni `CENTRAL_TEST_URL`. Por la configuración visible, no participa ahora del puente privado HMAC hacia la Central y **no requiere rotación de `CENTRAL_BRIDGE_KEY` en esta etapa**. No se alteró ese Worker ni se habilitó carga de documentos. La rotación coordinada autorizada queda limitada a `saber-pagos-pruebas` y `saber-polaroids-express-pruebas`, reutilizando únicamente la nueva clave generada localmente y guardada por el propietario en su gestor de contraseñas; nunca transcribir secretos a GitHub/chat. La presencia del secreto nuevo en Cloudflare y la conexión HMAC real siguen pendientes de confirmación.

## Puente Central: guarda superada con clave rotada — 24/10/2026

Tras actualizar `CENTRAL_BRIDGE_KEY` en la Central y promocionar al **100%** la versión Cloudflare `29dab411` (secreta, sin publicar valor), el propietario confirmó desde Chrome que `GET https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/polaroid-stage` devolvió **exactamente**:

```json
{"error":"Solicitud entre servidores requerida"}
```

Con el orden de validación del `worker.js`, esto demuestra que `CENTRAL_EXPRESS_ENABLED` y la guarda de configuración del puente HMAC en **ese Worker** están superadas, y que una solicitud GET no firmada se rechaza antes de escrituras. No demuestra que Express tenga la misma clave activa, ni comunicación servidor↔servidor, ni persistencia de datos en D1. El propietario indicó haber actualizado también el secreto en Pages Express, pero aún no se ha comprobado despliegue posterior al cambio. Los secretos en Cloudflare Pages deben estar configurados antes del despliegue que vaya a usarlos (Cloudflare Pages Functions bindings); la implementación Express conocida `d1167d8` precede al cambio. Mantener `enabled:false`, `EXPRESS_RECEPTION_ENABLED` y `EXPRESS_PDF_ENABLED` apagados y checkout deshabilitado. Pendiente: confirmar despliegue del proyecto Pages aislado con nuevas variables y luego preparar, bajo autorización, una comprobación HMAC de servidor a servidor sin datos reales y sin habilitar recepción.

## Reimplementación aislada de Pages Express — 24/10/2026, 21:32 UTC

El propietario compartió el log real de Cloudflare Pages al seleccionar **Reintentar implementación** sobre `d1167d8` en `saber-polaroids-express-pruebas`. Git clonó el SHA exacto `d1167d8441e859d1a36f49f1950bf69e93adb82f`, se instalaron dependencias, se encontró `/functions`, Wrangler `3.114.17` compiló correctamente y finalizó con `Success: Your site was deployed!`. Por tanto, **la reimplementación aislada terminó sin errores reportados**, después de la actualización de variables/secreto. El log no prueba por sí solo que los bindings estén presentes en runtime, ni comunicación HMAC real ni D1. El asistente no pudo consultar los dominios de Workers/Pages desde su herramienta externa, por lo cual deberá confirmarse desde el navegador del propietario que `GET /api/polaroids-express` conserva `enabled:false` y `pdfForClient:false`. Mantener recepción, pagos y descarga cerrados; no desplegar nada en `main` ni `libreriasaber.com.ar`.

## Confirmación GET tras reintentar Pages y preparación de prueba HMAC real — 24/10/2026

Después de reintentar manualmente en Cloudflare Pages el despliegue original `d1167d8`, se obtuvo `Success: Your site was deployed!`. El propietario confirmó desde Chrome la respuesta real de `GET https://saber-polaroids-express-pruebas.pages.dev/api/polaroids-express`:

```json
{"ok":true,"service":"polaroids-express","enabled":false,"photosPerSheet":6,"maxPhotos":24,"pdfForClient":false}
```

La recepción sigue **desactivada** y el cliente no recibe PDF. El GET no verifica HMAC ni D1.

Para cubrir esa laguna sin tocar recepción ni pagos, se preparó en esta **rama GitHub, NO DESPLEGADO** un diagnóstico temporal: `integraciones/polaroids/express/probar-puente-hmac.mjs`, expuesto por `functions/api/express-bridge-check.js` solo después de un futuro despliegue específico. Exige POST desde el mismo origen HTTPS de Pages y que el operador pegue `CENTRAL_BRIDGE_KEY` solo en la página de prueba, como autenticación; no se guarda ni devuelve el secreto. Envía desde el Worker Express a la Central un JSON firmado con el esquema **deliberadamente inválido** `saber-polaroids-express-bridge-check-v1`. Una respuesta exacta HTTP **422** con `Recibo Express no válido` indica que la firma HMAC pasó y la Central rechazó el manifiesto **antes de cualquier acceso a D1**; 401/403/503 u otros 422 no confirman conexión. El formulario de ensayo, sin librerías externas, está en `integraciones/polaroids/express/public/pruebas/puente-hmac.html`; ruta Pages `/pruebas/puente-hmac.html`. Hay pruebas dedicadas en `tests/polaroids-express-bridge-check.test.mjs`, **aún no ejecutadas**. El actual despliegue `d1167d8` no contiene este diagnóstico; reintentarlo otra vez no lo agregará.

**No afirmar prueba HMAC real completada.** La ruta temporal debe verificarse primero con pruebas específicas y autorizarse separadamente para su despliegue **solo en Pages Express aislado**, sin tocar main, checkout, recibos ni claves. Después del ensayo firmado, retirar la ruta de prueba y el diagnóstico extra de Central mediante versiones controladas para no mantener una superficie de diagnóstico abierta. En ningún caso insertar la clave HMAC en URL, chat, repositorio, capturas ni salida de consola.

### Validación local específica del nuevo diagnóstico (sin repetir las 47 pruebas)

Se comprobó que el blob GitHub del módulo de prueba coincide exactamente con el módulo ejecutado localmente (`git hash-object`: `f34735a0746e20a5e87425279ccf7a09d2b79b9a`). En Node 22 se ejecutaron **6 comprobaciones puntuales** sin red externa ni secretos: firma HMAC y respuesta 422 reconocida, clave incorrecta rechazada antes de llamar a la Central, origen distinto rechazado, interruptor apagado bloqueando salida, respuesta 401 remota rechazada y GET sin acción. Las seis fueron correctas. Son pruebas simuladas de la ruta nueva, no HMAC real. La ruta y su página **siguen sin desplegarse**. Cloudflare Pages tiene implementaciones automáticas en pausa; reintentar nuevamente `d1167d8` no incorporaría estos cambios. No activar ramas automáticas sin plan de reversión y control de alcance.
