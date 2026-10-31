# Librería Saber — laboratorio privado de recepción TUS

**Entorno totalmente separado de la web comercial.** Rama `experimento/uppy-tus-supabase-20261031`. Proyecto Supabase Free `saber-tus-lab` (`qkbbqzbannyhuanngjpw`, São Paulo).

## Estado vigente — 31/10/2026

- [x] Supabase Free creado y confirmado a **USD 0/mes**.
- [x] Bucket `saber-tus-lab` privado, 20 MiB, solo PDF.
- [x] Eliminada política abierta de INSERT para usuarios anónimos. **Nadie puede cargar un archivo solo por crear un usuario anónimo.**
- [x] `public.lab_tus_invites` con RLS sin políticas de acceso público; invitaciones aleatorias de 32 bytes, solo SHA-256 almacenado y vigencia limitada.
- [x] Función `lab-tus-one-use` desplegada, versión 1, protegida por enlace secreto y consumo único. **No habilita pagos ni registra pedidos.**
- [x] GET sin invitación probado en vivo: **HTTP 403**; verificada ausencia de objetos y de permisos públicos de subida.
- [x] Interfaz en navegador móvil que **genera automáticamente 2 PDF sintéticos de 16 y 94 páginas**, usa Uppy/TUS con dos tokens firmados de Supabase Storage y solicita verificación independiente de SHA-256, cantidad de páginas y bytes.
- [x] Sintaxis del JavaScript de la página comprobada localmente. Tests anteriores de funciones puras con `Blob` sintético: **11/11 aprobados**.
- [ ] **Recepción real de 2/2 PDF: PENDIENTE.** La primera ejecución deberá hacerse desde un navegador usando la invitación privada; no hay resultados de tiempos todavía.
- [ ] Si 2/2 y SHA funcionan, repetir una prueba de rendimiento con tamaños comparables a los 24 fragmentos del cotizador viejo; no extrapolar los tiempos de dos PDFs pequeños.

### Flujo nuevo

1. Usuario abre enlace único privado **sin copiar claves**, desde celular o PC; el token no se guarda en GitHub.
2. Un clic en «Probar recepción de 2 PDF»; servidor marca la invitación usada y crea **dos rutas aleatorias** en el bucket privado, y emite dos tokens de subida con `service_role` **exclusivamente en Edge Function**, nunca en navegador.
3. Browser genera PDF válidos con pdf-lib, los carga con Uppy/TUS por conexión directa a `<project>.storage.supabase.co` (sin Google Apps Script).
4. Servidor descarga desde Storage una sola vez cada PDF, verifica bytes/SHA y páginas con pdf-lib y devuelve tiempos/resultado.
5. Si falla cualquier etapa, no genera pedido ni intenta cobrar. **No reintentar** usando la misma invitación.

### Archivos

- `supabase/functions/one-time-test/index.ts`: emisión privada de dos firmas, control de invitación y verificación.
- `supabase/functions/one-time-test/page.ts`: pantalla de un clic, sin archivos del usuario.
- `supabase/functions/_shared/verification.mjs`: validación estricta, reutilizada por la función.
- `supabase/001_lab.sql`: SQL actualizado para invitaciones, RLS y bucket privado.
- `tests/verify.test.mjs`: pruebas de SHA/propiedad/páginas, con datos simulados.
- `client.js` e `index.html`: **prototipo inicial basado en Auth anónimo, solo referencia histórica; no corresponde a la configuración segura vigente**. No ejecutarlo ni abrirlo públicamente con la política actual.

### Seguridad y restricciones

- La función requiere un código no adivinable de 64 caracteres hexadecimales; el hash se almacena en base. El enlace vence y solo puede iniciar una tanda.
- El bucket `public=false`, sin políticas de lectura pública ni de INSERT para usuarios anónimos. El servicio firma objetos con acceso limitado. No se expone `service_role`.
- La cuenta tiene **Anonymous Sign-ins activado**, pero el ensayo privado de un clic **no depende de ese acceso** y no abre permisos de Storage.
- Security Advisor: aviso informativo de RLS sin políticas de `lab_tus_invites` (es **denegación total deliberada**) y advertencia de protección de contraseñas filtradas desactivada (configuración de Auth general; ensayo no usa contraseñas). No se habilitan usuarios comerciales.
- No conectar a D1, Mercado Pago, dominio comercial, Cloudflare Workers existentes, Google Apps Script ni Polaroids.
- **No es una solución comercial probada.** Faltan ensayo real, manejo de errores, limpieza programada/retención, cuotas, seguridad externa, carga concurrente y evaluación de gastos antes de integrar.

Fuentes originales: <https://supabase.com/docs/guides/storage/uploads/resumable-uploads> · <https://github.com/transloadit/uppy> · <https://supabase.com/docs/guides/storage/buckets/fundamentals>.
