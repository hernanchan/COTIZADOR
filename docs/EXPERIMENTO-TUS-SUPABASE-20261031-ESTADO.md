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

 
## 31-10-2026 ~23:46 ART — REPOSITORIO ESTÁTICO NUEVO CREADO; CONECTOR SIN ACCESO DE ESCRITURA

- El usuario aportó captura de GitHub confirmando repositorio **`hernanchan/saber-laboratorio-pdf`**, nuevo, **PUBLIC**, rama `main`, `README.md` inicial, vacío de código web. No es `COTIZADOR`; nunca cambiar el GitHub Pages existente de `COTIZADOR`, que ya publica desde `main /root`.
- `mcp__GitHub__get_repo` confirma existencia del nuevo repositorio con permisos del usuario `admin,push`. **Pero** `mcp__GitHub__list_repositories_by_installation` para instalación `150932522` devuelve exclusivamente `hernanchan/COTIZADOR`. La llamada `create_file` al nuevo repositorio para publicar `index.html` falló realmente con **403 `Resource not accessible by integration`**. No se escribió nada; NO se puede afirmar que la pantalla esté publicada. La GitHub App debe ampliar su autorización al nuevo repositorio.
- Próximo paso ÚNICO para usuario: abrir `https://github.com/settings/installations/150932522`, pulsar configurar acceso a repositorios, añadir `saber-laboratorio-pdf` a «Only select repositories» manteniendo `COTIZADOR`, y guardar. Después usuario dice «listo». Con ese acceso, asistente copia `docs/lab-tus/index.html` (rama experimental de COTIZADOR) a `index.html` **de repo nuevo**. Sólo después habilitar GitHub Pages en nuevo repo → `main /root`, sin tocar Pages antiguo. Backend Supabase Edge v2 ya permite CORS del origin `https://hernanchan.github.io`, común a ambos paths, por lo que no requiere otro despliegue. Invitación privada de ensayo de 12h sigue no usada según último chequeo.
- No se ha ejecutado TUS real ni verificado 2/2 PDF. El resultado de GitHub 403 es de instalación, no de permisos de dueño o del repo.


## 31/10/2026 ~23:50 ART — Código publicado en REPOSITORIO ESTÁTICO SEPARADO (Pages aún pendiente)

- Usuario confirmó por mensaje `listo` ampliación de la instalación GitHub App. `list_repositories_by_installation` de `150932522` listó tanto `hernanchan/COTIZADOR` como `hernanchan/saber-laboratorio-pdf`; ya hay acceso de escritura a este último.
- Se copió pantalla `docs/lab-tus/index.html` desde rama experimental a **`hernanchan/saber-laboratorio-pdf/index.html` en su rama `main` propia** (commit `5bc55e95`). NO se tocó `main` del repositorio `COTIZADOR` y NO se cambió GitHub Pages de COTIZADOR, que ya tiene su sitio servido desde `main/root`.
- En revisión previa al test, se detectó posible error concreto: `x-signature` del token TUS no se estaba aplicando mediante callback soportado de cabeceras de Uppy, sino mediante `setFileState` genérico. Se corrigió **en el repo nuevo** con `headers:file=>({apikey:accessData.apikey,'x-signature':file.meta.labSignature})` y metadato del archivo (excluido de TUS Upload-Metadata); JS sintaxis validada. Commit `3c600c8b`. Documentación oficial Uppy Tus admite la función `headers(file)` para metadatos únicos por PDF.
- README nuevo en repo separado, commit `63861947`, documenta que **NO HAY ensayo TUS completo confirmado** y el paso para activar Pages. Repo público sólo contiene HTML/JS y README, sin secretos administrativos ni token privado.
- El intento de inspeccionar `https://hernanchan.github.io/saber-laboratorio-pdf/` no mostró sitio accesible; **no afirmar que Pages esté activo**.
- **Próximo ÚNICO paso usuario:** abrir `https://github.com/hernanchan/saber-laboratorio-pdf/settings/pages` → `Build and deployment: Deploy from a branch` → `main` → `/(root)` → Save; confirmar captura de Pages activado. SOLO este repositorio nuevo; jamás cambiar Pages de `COTIZADOR`. Después verificar que URL HTML muestra botón de 2 PDF antes de entregar invitación `#k=`; comprobar validez de la invitación o generar otra si venció, SIN exponerla en GitHub ni logs.


## 31/10/2026 23:53 ART — GITHUB PAGES NUEVO PUBLICADO Y COMPROBADO, ESPERANDO UNA PRUEBA TUS REAL

- Usuario envió captura de `https://github.com/hernanchan/saber-laboratorio-pdf/settings/pages`: aviso «**GitHub Pages source saved**», `Deploy from a branch`, `main / (root)` en **repositorio separado**, no en `COTIZADOR`. GitHub Actions `pages build and deployment` run **`41266966058`** finalizó **`completed/success`**.
- Se comprobó desde Postgres del laboratorio con `extensions.http_get('https://hernanchan.github.io/saber-laboratorio-pdf/')`: **HTTP200**, `Content-Type: text/html; charset=utf-8`, **7.363 bytes**, cuerpo `<!doctype html>`, botón «Probar recepción de 2 PDF» presente. Este dato resuelve **con evidencia real** el fallo anterior `text/plain` de Supabase. Sitio estático real `https://hernanchan.github.io/saber-laboratorio-pdf/`, código `index.html` commit **`3c600c8b`** con firmas `x-signature` por PDF de Uppy.
- Además se comprobó remotamente que dependencias CDN `Uppy 3.6.1` CSS+JS y `esm.sh/pdf-lib@1.17.1` responden **HTTP200**; JS Uppy exporta explícitamente `Uppy`, `Dashboard` y `Tus`. No se ha simulado interacción de navegador ni descarga de paquetes secundarios, por tanto NO afirma que E2E ya pasó.
- Invitación privada de laboratorio **ID `1836a4c3-a084-47c1-96d5-41df1bd05ff2`**, `unused=true`, `valid_now=true`, **520 minutos restantes** al verificar. El secreto de enlace no se registra en GitHub; entregarlo como fragmento `#k=` junto a página estática, nunca como query de Supabase GET. A las 23:53 ART equivale expiración ~08:34 ART del 1/11.
- **SIGUIENTE PASO:** usuario abre **únicamente** nueva página HTML de GitHub Pages con token `#k` proporcionado por este chat y pulsa «Probar recepción de 2 PDF» UNA VEZ. La página genera dos PDF sintéticos de 16 y 94 páginas, transmite con Uppy/TUS de manera directa a bucket privado y solicita validación SHA/páginas/bytes a Edge. Pedir captura de final y no reintentar si hay error. Luego comprobar objeto(s) y estado en Supabase. **TODAVÍA NO HAY PRUEBA REAL DE RECEPCIÓN NI AHORRO DE LATENCIA.**


## 31/10/2026 23:56 ART — ¡PRIMER ENSAYO TUS REAL 2/2 APROBADO! (PDF SINTÉTICOS PEQUEÑOS)

**EVIDENCIA VISUAL Y COMPROBACIÓN SERVER-SIDE INDEPENDIENTE.** Usuario compartió captura de `https://hernanchan.github.io/saber-laboratorio-pdf/` mostrando «**ÉXITO: 2 de 2 PDF recibidos y verificados, sin cobros.**»; Dashboard Uppy 2 PDF en `Upload complete`, tilde verde. JSON de medición del navegador:
- `verificados: "2 de 2"`; `paginas: [16,94]`; `integridadSha256: "correcta"`.
- **Total: 6,19 segundos** desde pulsar; preparación `0,03 s`; subida TUS **1,10 s**; verificación en servidor **1,53 s**; resto del intervalo incluye conexiones, autorización y carga de módulos. Los tiempos son de la **captura**, no mediciones que hayamos deducido de logs.
- `pedidosRegistrados: 0`, `cobros: false`. Nunca se conectó el ensayo a D1, Mercado Pago ni recepción del sitio comercial.

**Verificaciones directas de Supabase después de la captura:**
- Invitación `1836a4c3-a084-47c1-96d5-41df1bd05ff2` **consumida**, sesión de ensayo creada, ambas rutas asociadas.
- Consulta de `storage.objects`: **2 de 2 objetos** bajo `saber-tus-lab`, ambos presentes, `application/pdf`; **2.251 bytes en total**, sin objetos adicionales en el bucket. **IMPORTANTE: archivos sintéticos MINÚSCULOS y muy comprimibles aunque tengan 16/94 páginas.**
- Logs de red `function_edge_logs`/ `edge_logs`: `/start` HTTP200 a `2026-11-01 02:56:21.534 UTC`; DOS solicitudes de firma privada HTTP200; DOS operaciones TUS de creación HTTP201; `/verify` HTTP200 a `2026-11-01 02:56:24.196 UTC`. No se publicaron tokens ni rutas de objetos.
- El verificador Edge de la sesión descarga los archivos PRIVADOS desde el bucket y ejecuta `verifyPrivatePdf` que computa digest SHA-256 de los bytes almacenados, comprueba cabecera/tamaño y `PDFDocument.load(...).getPageCount()` server-side; comprueba 16/94. No es simulación de red.
- GitHub Pages nuevo se comprobó previamente HTTP200 `text/html`, `Uppy` JS y CSS y `pdf-lib` HTTP200. El antiguo problema de HTML `text/plain` se resolvió alojando la UI en GitHub Pages aislado.

**Límite de evidencia, NO extrapolar:**
- La comparación con el cotizador Worker→GAS→Drive (93,5s/97,7s y 1/2 PDF en los dos últimos ensayos) es **ilustrativa, NO científicamente equivalente**. Allí se enviaron PDFs reales grandes, acá **2.251 bytes** en conjunto. Los 6,19s incluyen otra red/documentos; no prueban el throughput a 5MB, 20MB, 60MB, ni la cotización CAD/ploteos ni pedido D1 ni pagos ni Central. No afirmar «sistema listo».
- Próximo paso profesional: **otro único ensayo aislado con PDF sintéticos de tamaño representativo**, por ejemplo 2 PDF de 5–15 MiB, midiendo Mbps y verificando 2/2 SHA/páginas, y resiliencia TUS (corte de red), sin volver al circuito comercial. Ajustar el límite actual de 20MiB SOLO si el negocio requiere más y tras revisar Free y costos.
- Invitación anterior consumida (uso único): **NO pedir que vuelvan a pulsar el botón**; debe emitirse invitación nueva para cualquier prueba posterior. No volver a usar PDF de clientes sin consentimiento ni seguridad auditada.
- La arquitectura de subida directa a Storage con TUS y verificación server-side **está validada para PDF sintéticos de prueba**, y merece benchmarking con datos representativos, NO migración inmediata.

 
## 01/11/2026 ~00:03 ART — SEGUNDO ENSAYO TUS PREPARADO: PDF SINTÉTICOS DE 5 Y 9 MiB, SIN ENVÍO REAL AÚN

Usuario respondió `ok` a continuar la fase de rendimiento con tamaño representativo. Se preparó una segunda prueba en **repositorio separado** `hernanchan/saber-laboratorio-pdf`, archivo `index.html` rama propia `main`, commit **`271e6d98dfbfbb82e2c27daeacf9d07e03a47739`**, sin modificar `COTIZADOR/main`, web comercial, GAS, Worker, D1 ni cobros.
- Se generan PDF sintéticos con **16 páginas + 5 MiB** y **94 páginas + 9 MiB** de adjuntos binarios aleatorios (datos `crypto.getRandomValues` en bloques de 65.536 bytes); no simulan planos/imagen/tinta, sino **volumen transferido e integridad**. El PDF más grande supera el fragmento TUS de 6 MiB y debe ejercitar carga reanudable por bloques.
- Seguridad operativa: la generación de ambos PDF ocurre **ANTES de solicitar la firma y consumir la invitación**. Si falla PDF-lib, memoria, generación o SHA, no se gasta el único uso del enlace. Se conserva `x-signature` específico por archivo en `headers(file)`, bucket privado, lectura server-side y SHA256 + conteo de páginas reales.
- Nuevo reporte UI separa tiempos de **generación, autorización, transferencia y verificación**, además del total; muestra MiB reales `bytes/1024^2`.
- Comprobación REAL del método de generación (sin usuario ni subir objetos): se desplegó temporalmente Edge `lab-payload-generation-check` con autorización secreta de un solo uso de diagnóstico. Respondió HTTP **200** desde Supabase: `PDFDocument.attach` + `save` + `PDFDocument.load` correcto, **16 páginas / 5.245.534 bytes** y **94 páginas / 9.442.016 bytes**, ambos por debajo de 20 MiB. La función temporal se sustituyó inmediatamente por **v2 410 Disabled**, no quedó ejecutor activo. Esto valida generación/parseo, **NO** subida real desde navegador.
- GitHub Actions Pages run `41267466287` **completed/success** para commit nuevo. Verificación HTTP de URL viva `https://hernanchan.github.io/saber-laboratorio-pdf/` desde Supabase devolvió **200 `text/html`**, 9.108 bytes, nuevo texto 5 y 9 MiB, código de adjuntos aleatorios y botón presentes. Sintaxis del JS verificada mediante `new Function`.
- Nueva invitación de uso único **ID `2aed3866-576a-457b-bd39-d9f554ca767f`**, vencimiento **2026-11-02 03:03:26 UTC** (00:03 ART del 2/11); el token aleatorio no se guarda en GitHub ni en esta nota, solo SHA256 en tabla privada. URL con `#k=` enviada en el chat actual (no registrar token aquí).
- **PENDIENTE:** usuario abre una sola vez invitación, toca **«Probar recepción de 2 PDF»**, no selecciona archivos, reporta pantalla. Revisar 2 objetos nuevos y logs TUS; al primer error NO pedir reintentar. Los 6,19s del primer ensayo con PDF diminutos NO son una referencia de rendimiento equiparable; medir tamaño 14MiB antes de recomendar migración.
