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
