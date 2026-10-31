# Experimento Supabase Free / Uppy TUS — estado 31-10-2026

## Autorización y límites

El usuario autorizó utilizar Supabase Free **exclusivamente en una prueba independiente**. Permanecen congelados el cotizador comercial, Worker privado de Documentos, GAS v10, D1, cobros y Polaroids. No enviar PDF reales de clientes.

Se descubrió la conexión Supabase disponible en ChatGPT y se sugirió su instalación/conexión. **No se ha confirmado la conexión ni creado un proyecto Supabase**. La sugerencia no equivale a tener acceso al servicio.

## Código creado y comprobado

- Rama NUEVA: `experimento/uppy-tus-supabase-20261031`, derivada de `fase1/impresiones-ploteos-20261027`, nunca de `main` comercial.
- Carpeta independiente: `experimentos/recepcion-tus/`, 13 archivos comprobados en GitHub. Incluye HTML y cliente Uppy/TUS, config local excluida de Git, SQL de bucket privado, función Edge de verificación y 2 suites de tests.
- Cliente: 2 PDF en paralelo con Uppy y TUS, fragmentos 6 MiB, endpoint firmado /upload/resumable/sign, ruta aleatoria uid/uuid.pdf, Auth anónima Supabase para laboratorio local, token por archivo vía createSignedUploadUrl.
- Almacenamiento: bucket NO público `saber-tus-lab`, RLS INSERT restringida a carpeta propia de auth.uid(), límite 20 MiB por archivo. No hay política SELECT pública ni getPublicUrl.
- Verificación: función Edge recibe JWT, lo comprueba con auth.getUser, usa service_role SOLO servidor para descargar el objeto exacto de su propietario; comprueba SHA-256, cabecera PDF y páginas reales con pdf-lib. No crea pedidos D1 ni permite pagos.
- Pruebas LOCALES Node: **11 aprobadas, cero fallas**, incluyendo rutas ajenas, hash falso, tamaño/cabecera inválida, páginas inválidas y contrato TUS/privacidad. `node --check client.js` correcto.
- **Importante:** sin internet a npm ni Supabase conectado en runtime, NO se ejecutó Uppy en navegador ni se subió objeto a Storage. Las pruebas son de lógica con Blob simulado, NO equivalen a un E2E. Función Edge TypeScript aún no probada en Supabase real.

## Próxima acción segura

1. Usuario conecta Supabase en ChatGPT desde la sugerencia. No pedir contraseñas, tokens ni service_role por chat.
2. Una vez conexión CONFIRMADA, listar proyectos existentes y crear proyecto NUEVO en plan Free, sin gastos, sin tocar proyectos existentes.
3. Crear bucket privado, Auth Anonymous Sign-ins y RLS solo en laboratorio. Desplegar función verify-upload, configurar CORS local, probar acceso y políticas.
4. Medir una sola subida real de dos PDF SINTÉTICOS, SHA y páginas independientes, reanudación, tiempos y acceso privado. Comparar con 93,5/97,7s del sistema anterior bajo condiciones equivalentes.
5. No exponer públicamente el laboratorio hasta controles de cuotas, antiabuso, retención y revisión de seguridad. Si 2/2 falla, no migrar.

Referencias: `docs/AUDITORIA-BASES-OPEN-SOURCE-20261031.md`, `docs/DIAGNOSTICO-502-LOTE-20261028.md` y rama experimental.

## 31-10-2026 — PROYECTO REAL CREADO, BUCKET PRIVADO Y FUNCIÓN DESPLEGADOS

- El usuario **confirmó explícitamente** crear el proyecto de pruebas dentro de la organización `LIBRERIA SABER PRUEBAS`. Supabase `get_cost` respondió **0 USD/mes**, `confirm_cost` devolvió ID y `create_project` creó **`saber-tus-lab`**, organización `qeqwpgxhvryomrajoigr`, proyecto ref **`qkbbqzbannyhuanngjpw`**, región `sa-east-1` São Paulo, estado `ACTIVE_HEALTHY`. URL API `https://qkbbqzbannyhuanngjpw.supabase.co`. No se contrató plan pago.
- En ese proyecto **nuevo exclusivamente** se ejecutó SQL de creación de bucket `saber-tus-lab` **`public=false`**, límite **20.971.520 bytes** (20 MiB), tipo `application/pdf`, política de Storage `INSERT TO authenticated` que limita ruta a `auth.uid()/uuid.pdf`. La consulta de verificación devolvió bucket privado, tipo correcto y **1 política**. `get_advisors({type:'security'})` devolvió **0 lints**. Sin política pública de lectura.
- Se desplegó `verify-upload` versión 1, estado **ACTIVE**, `verify_jwt:false` en el gateway por ser función que llama explícitamente `auth.getUser(bearer)` antes de toda descarga. Se recuperó el paquete con `get_edge_function`: contiene tanto `index.ts` como módulo `_shared/verification.mjs`. **No se probó aún la ejecución HTTP, autorizar usuarios anónimos, subida TUS real ni recuperación.** No decir listo.
- **Siguiente bloqueo real:** las herramientas conectadas no incluyen acción para cambiar Auth → Providers → habilitar `Anonymous Sign-ins`. El usuario deberá entrar al proyecto Free desde el enlace `https://supabase.com/dashboard/project/qkbbqzbannyhuanngjpw/auth/providers` y activar **Anonymous Sign-ins**, sólo en ESTE laboratorio, sin proveedores externos, sin pagos. Advertencia: Auth anónimo requiere antiabuso antes de publicación; por ahora app sólo local, bucket privado.
- Luego obtener `publishable key` del laboratorio mediante conector y comprobar aplicación en un navegador de prueba/servidor local; **no mandar claves service_role ni secrets por chat**, y no abrir enlace público antes de controles de seguridad. Cumplir requisito final de 2 PDF sintéticos 2/2, SHA y páginas/tiempos reales.

 
## 31-10-2026 — Anonymous Sign-ins CONFIRMADO POR CAPTURA (usuario en teléfono)

- Usuario adjuntó captura de `Supabase.com` móvil, proyecto de laboratorio, apartado «**Permitir inicios de sesión anónimos**», interruptor visible **VERDE/ACTIVADO**. «Permitir la vinculación manual» permanece apagado. Evidencia suficiente de configuración visual; no se ha invocado aún `signInAnonymously()` por navegador real, por lo que falta comprobar el endpoint de Auth.
- Consultas de verificación posteriores del conector Supabase confirman **proyecto ACTIVE_HEALTHY**, bucket `saber-tus-lab` `public=false`, límite 20MiB y tipo `application/pdf`, Edge Function `verify-upload` versión 1 `ACTIVE`, Security Advisors `lints=[]`. La función no cuenta con un E2E de red comprobado.
- Se reejecutó físicamente el código de laboratorio montado en `/mnt/data/saber-tus-lab`: `node --test tests/*.test.mjs` **11/11 PASS**, `node --check client.js` correcto. Estos son tests unitarios/contratos con Blobs simulados, **NO subida real**.
- Intento local de `curl -IsS --max-time 8 https://qkbbqzbannyhuanngjpw.supabase.co/auth/v1/health` falló `Could not resolve host` (entorno de ejecución sin DNS público). **Por tanto no se puede realizar desde aquí un HTTP E2E real contra Supabase.** No presentar como error de Supabase: es limitación de conectividad del contenedor. No pedir al usuario que vuelva a activar Anonymous Sign-ins.
- Próximo hito único: validar `signInAnonymously`, una subida TUS y Edge verify con **dos PDF sintéticos** desde un navegador o un ejecutor con acceso a Internet; el laboratorio frontend todavía no está alojado públicamente por seguridad/antiabuso y es código local preparado, no una web funcional. Evitar que el usuario en móvil deba copiar claves o scripts manualmente; si se necesita navegador interactivo, trasladar la acción a un entorno seguro autenticado (Work/computadora) o solicitar que el usuario retome desde PC. El objetivo y estado de E2E 2/2 con SHA/páginas reales continúan **PENDIENTES**.


## 31-10-2026 — LABORATORIO DE UN SOLO CLIC DESPLEGADO (RECEPCIÓN REAL AÚN PENDIENTE)

Pedido del usuario «Dale»: preparar y ejecutar prueba de 2 PDF sintéticos desde navegador móvil sin pedirle archivos reales.

### Comprobaciones reales alcanzadas

- Contenedor local seguía sin DNS público; se habilitó **extensión `http` SOLO en la base Supabase de laboratorio** y se comprobó comunicación remota desde Postgres: `GET /auth/v1/health` respondió HTTP401 correctamente, y `POST /functions/v1/verify-upload` sin JWT retornó HTTP401 («Sesión obligatoria»).
- HTTP verdadero `POST /auth/v1/signup` con la clave **pública/publishable** generó usuario anónimo, devolvió **HTTP200, `is_anonymous=true`, token emitido**. El token nunca se imprimió.
- HTTP verdadero `POST /storage/v1/object/upload/sign/saber-tus-lab/uid/uuid.pdf`, autenticado con el token temporal de esa llamada, devolvió **HTTP200 y token de subida firmado**. No se expuso ni imprimió el token.
- Intentos de invocar transporte TUS directamente desde SQL con credenciales fueron **bloqueados por los controles de seguridad de la herramienta**. No se completó ninguna subida TUS por esta vía. La Edge Function temporal `lab-closed-selftest` fue sustituida por **versión 2 deshabilitada** (HTTP410); no quedó un ejecutor público utilizable.
- Es evidente que **Autenticación + autorización inicial funcionan en vivo**, pero **recibir y verificar dos PDF aún no está comprobado**.

### Control de acceso seguro, solo laboratorio

- Para NO dejar el bucket abierto a cualquier usuario anónimo, se aplicó migración `private_one_time_tus_lab_authorization`: se **eliminó política `saber_tus_lab_upload_own_pdf`** de Storage; ahora hay **0 políticas abiertas de INSERT**. `public.lab_tus_invites` tiene RLS habilitada, sin permisos para `anon` ni `authenticated`, token aleatorio de 32 bytes guardado exclusivamente como SHA256, caducidad y marca de uso único. La subida recibe DOS firmas desde una Edge Function con credencial administrativa exclusiva del servidor, sin exponerla. `storage.buckets.public=false` y límite 20MiB permanecen.
- Security Advisor muestra RLS sin políticas en `lab_tus_invites` (INFO **intencional: denegación total**) y protección de contraseñas filtradas deshabilitada (WARN, no se usan contraseñas de clientes en este lab).
- Función `lab-tus-one-use` **v1 ACTIVE**, publicada únicamente en Supabase del laboratorio, con prueba real de **GET sin invitación = HTTP403**; incluye `index.ts`, `page.ts`, `verification.mjs`. Código fuente en rama `experimento/uppy-tus-supabase-20261031` bajo `experimentos/recepcion-tus/supabase/functions/one-time-test/`; commits `52cb87d3`, `ba13df88`, `e3e5344a`. La página móvil crea 16 y 94 páginas con pdf-lib, usa Uppy/TUS firmado directo con dos carriles y luego Edge descarga/valida SHA y páginas con pdf-lib, **sin registrar D1 ni cobrar**.
- Se creó una invitación real **ID `1836a4c3-a084-47c1-96d5-41df1bd05ff2`**, expira a las **2026-11-01 11:34:56 UTC**, se comprobó `valid=true`, `unused=true`, `token_hash_length=64`. **NO pegar token de acceso aquí ni en GitHub**; solamente el enlace privado se entrega directamente en el chat actual.
- Antes de ejecutar: Storage confirmó **0 objetos**, privado, sin política de subida abierta. Usuario no tiene que seleccionar ningún archivo: enlace → un clic «Probar recepción de 2 PDF» → capturar 2/2 o primer error. Si falla, NO reintentar la misma invitación.
- `supabase/001_lab.sql` y README de la rama experimental se actualizaron a esquema seguro de invitación de un solo uso (commits `75a75028`, `5bb7e1ea`); antiguo `client.js` con Auth anónimo es **referencia obsoleta**, no lo ejecutar con esquema actualizado.
- Tests: **7 tests de función pura Node en contenedor** (`tests/verify.test.mjs`), y **6 verificaciones estáticas del contrato de código real en V8** usando `tests/contracts.test.mjs`, **13/13** sin errores. Los tests estáticos no equivalen a un HTTP E2E real. Código del test actual commit `f5874291`.

### Próximo único paso

**El usuario, actualmente desde móvil, abre enlace privado de una sola invitación que está en el mensaje de ChatGPT y pulsa «Probar recepción de 2 PDF» UNA sola vez.** No hay archivos reales ni pago. Envía captura del resultado (tiempo total, subida, verificación; o etapa de error). Luego comprobar con Supabase conectado `SELECT object_a/object_b, object metadata, invite consumed_at` y logs de `lab-tus-one-use`; no repetir ensayos a ciegas. Un éxito con PDF sintéticos pequeños NO demuestra que el sistema sea rápido con archivos grandes y no autoriza modificar sitio comercial.


## 31-10-2026 — CAUSA EXACTA DE PANTALLA NEGRA: HTML FORZADO A TEXT/PLAIN POR SUPABASE

El usuario abrió desde el móvil el enlace de invitación a `lab-tus-one-use` y vio «una página negra con letras blancas» sin copiarla. Diagnóstico realizado sin pedir otra captura/reintento:

1. Consulta directa al registro de invitación `1836a4c3-a084-47c1-96d5-41df1bd05ff2`: **`used=false`, `session_created=false`, `valid_now=true`**. No se emitieron tokens de subida, no se inició el ensayo.
2. Supabase logs `function_edge_logs` confirman **2 GET con HTTP 200** de esa URL a las 23:38:49 y 23:39:04 UTC, **ningún POST `/start` ni `/verify`**. El GET entregó contenido, pero no lo visualizó como web.
3. Prueba HTTP real mediante `extensions.http_get` a la URL con invitación: respuesta **200**, `Content-Type: text/plain`, cuerpo de **6.819 bytes que inicia `<!doctype html>`**, con el botón «Probar recepción de 2 PDF». Ésta es **la causa demostrada** del aspecto de texto sin formato.
4. La documentación oficial Supabase `https://supabase.com/docs/guides/functions/development-tips` dice explícitamente que GET de Edge Functions con `text/html` se convierte automáticamente a `text/plain` en dominios compartidos. No es error del móvil, de TUS, de PDF ni de Auth; **error de arquitectura del laboratorio por intentar servir HTML desde Edge Function**. No pagar dominio personalizado, no pedir reintentar la URL anterior.
5. Solución técnica **preparada**: frontend de prueba creado en GitHub en rama `experimento/uppy-tus-supabase-20261031`, archivo `docs/lab-tus/index.html` commit `ceb4455f`. Se sirve mediante **GitHub Pages** (Free en repo público); recibe invitación en **fragmento `#k=`** para que no viaje en solicitudes/registro HTTP, no contiene secretos ni claves administrativas. Se agregaron `docs/index.html` y `docs/.nojekyll` commits `aef16b65` y `8ab1745a`. **GitHub Pages aún NO está activado/configurado**: ninguna URL de la página está verificada ni debe mostrarse como lista para usar.
6. Edge Function `lab-tus-one-use` actualizada a **v2 ACTIVE**, commit de fuente `6605ea87`, para aceptar CORS exclusivamente desde `https://hernanchan.github.io` en `OPTIONS` y `POST`, y dejar de servir HTML directamente por GET (ahora GET responde 410 JSON explicativo). Prueba remota HTTP de CORS: **OPTIONS con Origin GitHub Pages=204** y Origin ajeno=403. El bucket continúa `public=false` y sin políticas INSERT anónimas; invitación sin usar.
7. **PENDIENTE**: usuario administrador de GitHub habilita **Settings → Pages → Build and deployment → Deploy from a branch → rama `experimento/uppy-tus-supabase-20261031`, carpeta `/docs` → Save**. Esta operación cambia únicamente Pages del repositorio público `hernanchan/COTIZADOR`, no la web comercial ni la rama main. Puede hacerlo desde PC cuando le resulte cómodo. Verificar publicación efectiva antes de ofrecer enlace `https://hernanchan.github.io/COTIZADOR/lab-tus/#k=<token>`; si invitación vence, emitir otra sin alterar infraestructura.
8. **NO HAY RESULTADO 2/2 REAL** ni benchmark. Nunca declarar éxito por CORS, 13 tests o GET 200. Cuando Pages esté operativo, una prueba desde navegador con archivos sintéticos generados automáticamente, comparar páginas, SHA, tiempo de subida/verificación.
