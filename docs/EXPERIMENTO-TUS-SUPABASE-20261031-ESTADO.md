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
