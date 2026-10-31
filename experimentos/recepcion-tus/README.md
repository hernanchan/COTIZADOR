# Librería Saber — LABORATORIO Uppy + Supabase TUS (NO PRODUCCIÓN)

Prueba independiente para **dos PDF**, que conserva el cotizador actual sin modificaciones. Subida directa del navegador a **Supabase Storage privado** mediante protocolo TUS, con progreso y recuperación. Validación del objeto guardado en una función separada: SHA-256 y conteo de páginas con pdf-lib, descargando el PDF **una sola vez** desde Supabase. **No se registra D1 ni se hacen pagos**. Ningún Worker comercial ni Google Apps Script participan del experimento.

## Estado real

- [x] Rama experimental separada, cliente Uppy, política RLS, función de verificación y pruebas locales.
- [x] \`node --test\`: comprueba pertenencia de ruta, SHA, cabecera, tamaño, páginas y manipulación de metadatos con objetos simulados.
- [ ] Proyecto Supabase **Free** separado conectado en ChatGPT o creado con autorización del dueño.
- [ ] Crear bucket privado y ejecutar SQL **solo en el proyecto nuevo**.
- [ ] Habilitar Auth Anonymous Sign-ins solo en el proyecto de laboratorio. El modo anónimo no protege de abuso por sí mismo.
- [ ] Desplegar función \`verify-upload\` y comprobar lectura real de Storage.
- [ ] Medir TUS con dos PDF sintéticos (16 y 94 páginas), persistencia, SHA, páginas y tiempos.
- [ ] Revisar cuotas/abuso/retención antes de cualquier enlace público.

**Pasar tests de Node NO demuestra que se haya subido ningún archivo.** No usar PDF de clientes.

## Ejecución cuando esté conectado el proyecto Free

1. Confirmar que el proyecto Supabase sea **exclusivo del laboratorio**, sin claves del cotizador comercial y plan **Free**. Nunca habilitar pagos.
2. Habilitar Auth → Anonymous Sign-ins. Ejecutar \`supabase/001_lab.sql\` en su SQL Editor. Comprobar bucket \`saber-tus-lab\` con \`public=false\` y límite 20 MiB.
3. Desplegar \`verify-upload\` desde \`supabase/functions/verify-upload/index.ts\`, con \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\` en el entorno **servidor**, además de \`LAB_ALLOWED_ORIGIN=http://localhost:4173\`. JWT se verifica en el código con \`auth.getUser()\`. Mantener service_role fuera de frontend.
4. Copiar \`config.local.example.js\` a \`config.local.js\` y completar solamente project URL, project ID y **publishable** key. Este archivo se excluye de Git.
5. Ejecutar \`npm test\` y \`npm run serve\`, abrir \`http://localhost:4173\`, «Iniciar laboratorio» y elegir exactamente dos PDF **de prueba**, no de clientes. Pulsar «Subir y verificar».
6. Medir subida y verificación con dos archivos del tamaño indicado; comparar con 93,5s y 97,7s del circuito anterior **bajo las mismas condiciones de equipo y red**. Fallo 1/2 = rechazo del candidato hasta diagnosticar.

## Privacidad y límites

- Proyecto, bucket y credenciales **NUEVOS**; no tocar \`saber-documentos-pruebas\`, GAS Documentos v10, Central D1, Mercado Pago ni Polaroids.
- Bucket privado, rutas aleatorias \`uid/uuid.pdf\`, sin \`getPublicUrl\`. RLS exige carpeta de cada usuario, y la función verifica identidad antes de descargar usando service_role servidor.
- El cliente usa Supabase Auth Anonymous Sign-ins (rol autenticado) y \`createSignedUploadUrl\` sobre la ruta propia. Uppy envía \`x-signature\` con TUS directo a \`<project>.storage.supabase.co/storage/v1/upload/resumable/sign\`.
- Solo archivos PDF máximo 20 MiB; 6 MiB por fragmento TUS; dos carriles.
- No hay limpieza de objetos automática ni mitigación suficiente de spam: **no publicar públicamente**. Una prueba con Auth anónima requiere controles de abuso antes de usarla en producción.
- CDN oficial Uppy 3.6.1 y supabase-js 2 por ESM; deben comprobarse en navegador conectado, no se probaron aquí con internet.
- No hay tarifas, ploteos, anillados, D1, cobro ni web comercial en este experimento: evalúa **solo recepción**.

## Recursos originales

- https://github.com/supabase/supabase/tree/master/examples/storage/resumable-upload-signed-uppy
- https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- https://supabase.com/docs/guides/auth/auth-anonymous
- https://github.com/transloadit/uppy

## Condición para migrar

**Dos PDF reales de prueba 2/2, SHA verificado y páginas reales, latencia medida, bucket privado, costos aceptables.** Recién entonces evaluar cómo integrar exclusivamente el transporte con nuestro cotizador existente, nunca reemplazar todo a ciegas.