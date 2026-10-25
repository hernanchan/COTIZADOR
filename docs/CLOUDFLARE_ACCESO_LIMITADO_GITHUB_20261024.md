# Librería Saber — acceso mínimo de Cloudflare desde GitHub (ensayo privado)

**24/10/2026.** Implementado únicamente en la rama `polaroids/express-pdf-unico-20261023`. **NO DESPLEGAR**, no tocar `main`, `libreriasaber.com.ar`, rutas, DNS, D1, GAS, R2 ni pagos.

## Qué se preparó

- `integraciones/cloudflare-ensayo/verificar-acceso-lectura.mjs`: solamente hace **dos GET de metadatos** de Cloudflare; nombres fijos `saber-pagos-pruebas` y `saber-documentos-pruebas`. Consulta existencia, nombre del binding `CENTRAL_BRIDGE_KEY`, y presencia de binding D1/Service Binding. No descarga el código de Workers, no obtiene valores de secretos, no consulta filas D1 y no ejecuta Worker ni solicita un deploy.
- `.github/workflows/cloudflare-lectura-privada.yml`: flujo de GitHub Actions en la rama de ensayos, activado por `push` de su propio código; comprueba primero restricciones con datos falsos. Solo hace las consultas remotas **si la variable protegida** `SABER_CF_PREFLIGHT_ENABLED` vale `true`; en ausencia de ella, no se comunica con Cloudflare.
- Entorno de GitHub Actions: **`saber-cloudflare-pruebas`**. Los secretos se denominan **`SABER_CF_ACCOUNT_ID`** y **`SABER_CF_READONLY_TOKEN`**. No introducir sus valores en el repositorio, comentarios de GitHub, esta conversación ni capturas.
- `tests/cloudflare-preflight-solo-lectura.test.mjs`: prueba rutas exactas GET, alcance fijo, sanitización de errores, bloqueo de tokens inválidos, y ausencia de permisos de escritura.
- CI de integración aprobado: https://github.com/hernanchan/COTIZADOR/actions/runs/40151230381. Esta prueba **no utilizó ninguna credencial real**.

## Única configuración humana requerida (sin entrar en el navegador integrado)

1. En **Chrome con sesión abierta**, Cloudflare → seleccionar cuenta de Librería Saber → **Manage account → Account API tokens → Create Token**. Crear token **propiedad de la cuenta** con un nombre reconocible, por ejemplo `Saber lectura ensayo GitHub`.
2. **Rol: Individual Workers → Metadata Read-Only**, aplicado **solo** a los Workers existentes `saber-pagos-pruebas` y `saber-documentos-pruebas`. No asignar rol `Editor`, `Admin`, `Workers Scripts Edit`, acceso a R2, D1, DNS, Pages, otros Workers, ni permisos generales de cuenta. Si la interfaz no permite elegir individualmente ambos Workers y este rol, **detener el proceso**, no sustituir por permisos globales. La documentación Cloudflare de septiembre de 2026 admite roles por Worker.
3. En GitHub, repositorio `hernanchan/COTIZADOR` → **Settings → Environments** → crear o abrir **`saber-cloudflare-pruebas`**. Si es posible, limitar sus deployment branches a la rama `polaroids/express-pdf-unico-20261023`. Crear en **Environment secrets**:
   - `SABER_CF_ACCOUNT_ID`: identificador de 32 caracteres de la cuenta Cloudflare.
   - `SABER_CF_READONLY_TOKEN`: token de solo lectura recién creado. Pegar directamente en GitHub; GitHub no vuelve a mostrar el valor.
4. En **Environment variables** crear `SABER_CF_PREFLIGHT_ENABLED` con el valor `true`. El chequeo remoto no se ejecutará mientras esa variable falte.
5. Confirmar en esta conversación **solamente**: «credenciales guardadas en GitHub». No pegar los valores secretos ni enlaces que los contengan. Puede volver a ejecutarse el trabajo de preflight tras la autorización; la rama activa un flujo de comprobación con el siguiente cambio limitado de configuración. El GitHub Actions de solo lectura no necesita ni permite instalar versiones.

## Límites de esta etapa

El token **Metadata Read-Only** solo sirve para verificar que los Workers de ensayo se pueden consultar. **NO permite configurarlos ni desplegar código, editar variables, probar D1 o autorizar pagos**. Hacer una prueba funcional real Cloudflare ↔ GAS ↔ Drive requerirá, por separado, aprobación explícita y permisos de **Editor únicamente para los Workers de ensayo** (si fueran necesarios); no ampliar este token silenciosamente. No se proponen permisos para producción.

**La integración del acceso no está terminada hasta que el usuario coloque el secreto en GitHub y el chequeo de metadatos remotos se ejecute correctamente.** Antes de ese momento solo están demostradas las pruebas automatizadas con datos ficticios.

Documentación externa: https://developers.cloudflare.com/workers/authorization/workers/ y https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/ .


## Auditoría real de Cloudflare — 25/10/2026

La cuenta Cloudflare real fue leída mediante GitHub Environment `saber-cloudflare-pruebas`, sin obtener valores de secretos, sin desplegar y sin alterar D1 o DNS.

**Prueba confirmada de los dos secretos de GitHub:** https://github.com/hernanchan/COTIZADOR/actions/runs/40195956280

**Auditoría adicional de bindings exclusivamente por presencia de nombre:** https://github.com/hernanchan/COTIZADOR/actions/runs/40196191532

- `saber-pagos-pruebas`: `CENTRAL_BRIDGE_KEY` presente y vínculo D1 presente. Sin Service Binding (no es requerido como caller para este flujo).
- `saber-documentos-pruebas`: presentes `DOCS_SCRIPT_URL`, `DOCS_RELAY_KEY`, `DOCS_ALLOWED_ORIGIN`, `DOCS_TURNSTILE_SITE_KEY` y `DOCS_TURNSTILE_SECRET`. **No** aparece `SABER_CENTRAL` como Service Binding, por lo que no puede invocar la Central D1 mediante ese vínculo.
- No aparecen configurados los nombres `DOCS_EXTENDED_RECEIVER_ENABLED`, `DOCS_V2_RECEIPT_LINK_ENABLED`, `DOCS_V2_PRIVATE_UI_ENABLED` ni `DOCS_V2_PRIVATE_UI_SECRET` en el Worker documental. Estas variables solo deben crearse y activarse dentro del entorno de prueba después de comprobar el código desplegado y de revisar sus barreras; nunca activar funciones sin confirmación de seguridad y autorización.

**Límite:** metadata-read-only no habilita escritura ni confirma que el código de prueba de GitHub esté desplegado en Workers. Los resultados anteriores prueban existencia de *bindings* por nombre, **no** el contenido o vigencia de los secretos, el estado de Google Apps Script, el acceso real a Drive o la funcionalidad del PDF. Sigue pendiente revisar en Chrome `saber-documentos-pruebas → Settings → Bindings` para añadir de forma controlada la conexión `SABER_CENTRAL` hacia `saber-pagos-pruebas` y planificar un piloto privado sin cambiar producción.
