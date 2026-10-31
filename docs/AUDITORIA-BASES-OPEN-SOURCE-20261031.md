# Evaluación técnica de bases abiertas para carga múltiple de PDF — 31/10/2026

## Alcance y restricciones

Investigación pedida para sustituir el tramo de recepción inestable del **Proyecto Integral Nueva Web / Librería Saber**. No tocar rama `main`, dominio comercial, Workers activos, GAS v10, Cloudflare D1, Polaroids ni pagos; no abrir cuentas, incurrir gastos ni subir PDFs de clientes. Estado real actual: E2E del circuito privado con 2 PDFs falló 2 veces (93,5 s y 97,7 s, 1/2 PDF verificado, error en la lectura de Drive `[etapa LECTURA_DRIVE]`); no atribuir causa exacta sin diagnóstico HTTP y bytes reales. Ver `docs/DIAGNOSTICO-502-LOTE-20261028.md`.

Esta auditoría es **inspección de código fuente y documentación** de repositorios públicos, NO prueba funcional contra almacenamiento real ni benchmark de velocidad. El entorno de ejecución local de análisis no tenía acceso de red para clonar y ejecutar una aplicación conectada, y no hay cuenta Supabase de ensayo autorizada. No confundir con validación de producto.

## 1. ajaymishraj/PrintQ — DESCARTADO como base integral

- Repositorio: https://github.com/ajaymishraj/PrintQ — licencia MIT, frontend HTML/CSS/JS, Supabase + PayU. 9 commits visibles en GitHub al consultar. Código concreto inspeccionado: `js/app.js`, `js/db.js`, `js/config.js`, `index.html`, `README.md`, `LICENSE`.
- `index.html`, campo `file-inp`: **sin atributo `multiple`**. `js/app.js` `onFile(e)` usa exclusivamente **`e.target.files[0]`**. No tiene envío de múltiples PDF en un pedido.
- `js/app.js` `getEstimate()` calcula `copies * baseRate * sideDiscount + finishFee`; comentario literal en código: **“Pages are not input by user — shopkeeper counts them; we charge per copy”**. No reconoce ni verifica páginas para cotizar y no incorpora nuestras tarifas escalonadas, ploteos, rotación automática, A4/A3 ni anillado mixto.
- `js/db.js` `dbUploadFile` sube directamente un único objeto a Supabase Storage vía `.upload(path,fileObj)`, sin TUS/resumable explícito, y guarda `getPublicUrl(path)` en cada pedido. **La privacidad del PDF no queda resuelta**: el código asume URL pública sin control de acceso temporal. Si bucket privado, esta URL no permite descargarlo de esa forma; si público, se expone el PDF. Requiere rediseño de autenticación y almacenamiento privado.
- `js/app.js` `submitJob` ejecuta **pago antes de completar la subida** (`collectPayment` → `dbUploadFile`), contrario al requisito de no cobrar ante archivo inválido. Sin habilitar pagos aquí.
- `README.md` pide ejecutar `supabase/migrations/001_print_jobs.sql`, pero ese archivo **NO existe en el repositorio público al comprobarlo**. El `js/config.js` publicado contiene URL Supabase y anon key ya rellenados: NO tratar su demo como entorno local neutro sin sustituir configuración.
- Veredicto: material educativo e inspiración parcial de pantallas/tickets, **no copiar arquitectura ni adoptarlo como base del cotizador**. La primera recomendación verbal basada en el README fue demasiado optimista; corregida tras auditar fuente.

## 2. 7meninn/PrintQ — NO ADOPTAR COMPLETO

- Repositorio: https://github.com/7meninn/PrintQ — MIT, ~60 commits visibles. Inspeccionados `frontend/package.json`, `backend/package.json`, `printer_app/package.json`, `README.md`, `LICENSE.txt`.
- Más completo: frontend React + pdfjs-dist/pdf-lib; backend TypeScript/Express/Drizzle + PostgreSQL + Azure Blob; aplicación Electron para estaciones; pagos PhonePe/Razorpay, conciliaciones. La arquitectura podría aprovecharse para un centro de pedidos/estación, pero obligaría a cambiar base de datos, proveedor de archivos, pagos, autenticación y proceso de despliegue.
- No se ha verificado extremo a extremo con PDF auténtico; marketing del README NO garantiza seguridad, latencia ni compatibilidad. **Demasiado cambio para atacar únicamente la subida de PDFs.**

## 3. Mejor candidato para una prueba aislada: Uppy + protocolo TUS + almacenamiento privado

- Librería abierta **Uppy** (MIT, mantenida): https://github.com/transloadit/uppy — `@uppy/core`, `@uppy/dashboard`, `@uppy/tus`. Ofrece selección múltiple real, arrastrar y soltar, progreso y reanudación. Es una **pieza de subida**, no un cotizador completo.
- Cliente más mínimo: https://github.com/tus/tus-js-client (MIT). Para UI minimalista se puede usar directamente en lugar del Dashboard genérico.
- **Ejemplo oficial ya disponible**, precisamente con Uppy y subida TUS firmada: https://github.com/supabase/supabase/tree/master/examples/storage/resumable-upload-signed-uppy . A diferencia de PrintQ, su propósito es resolver bien la transmisión de documentos.
- Supabase Storage admite **TUS**, subida directa al host `<id>.storage.supabase.co`, fragmentos de **6 MiB**, reintentos y recuperación: https://supabase.com/docs/guides/storage/uploads/resumable-uploads . Se pueden crear **tokens firmados por archivo y ruta**, usados por el navegador en el encabezado `x-signature`, sin facilitar una clave administrativa. Para documentos de clientes, usar bucket **privado**, rutas aleatorias por pedido, sin sobrescritura, expiración corta, lectura y descarga autorizadas: https://supabase.com/docs/guides/storage/buckets/fundamentals .
- Un flujo viable a **evaluar, NO implementado**: navegador detecta páginas (para cotización orientativa) → Worker autoriza pedido y devuelve token de subida de alcance limitado por PDF → Uppy/TUS envía **navegador → Storage**, sin Apps Script ni POST de 512 KiB por archivo → servidor confirma objeto/tamaño/hash y páginas en **una lectura controlada**, nunca confiar solo en metadatos del navegador → D1 registra un pedido idempotente con todos sus PDFs verificados → Central de Pedidos privada genera descarga temporal. Mantener cotizador/tabla tarifas existentes, D1, estados, UI mínima y pagos DESACTIVADOS.
- No confundir el ejemplo oficial con implementación segura lista: los ejemplos pueden publicar buckets de muestra y usar una función `verify_jwt=false`; **necesita control de identidad/uso, cuotas, rate limit, firma por objeto, anti-abuso, comprobación de integridad, limpieza/retención y política RLS revisadas**, antes de exponerlo.
- **Infraestructura nueva**: Supabase Storage es un servicio adicional, aunque el cliente Uppy/TUS sea software libre. Límites publicados al investigar: Free **1 GB de almacenamiento, 5 GB de egreso, 50 MB máximo por archivo**; proyectos Free pueden suspenderse por inactividad, por lo que sería un laboratorio, no promesa de operación comercial continua. Fuentes: https://supabase.com/pricing y https://supabase.com/docs/guides/storage/uploads/file-limits . No crear cuenta ni activar plan o cobros sin autorización. Alternativa: `tusd` MIT autoalojado con almacenamiento local/S3/Azure/GCS, pero **exige servidor propio** y añade mantenimiento: https://tus.github.io/tusd/ .

## Veredicto y prueba que justifica seguir

**No usar PrintQ completo.** El problema no es encontrar otra interfaz bonita, sino disponer de recepción fiable, privada y rápida. **Primera opción: prototipo aislado de subida con Uppy/TUS y destino privado**, tomando el ejemplo oficial, manteniendo nuestra lógica de presupuesto, anillado, ploteos y D1. Es una hipótesis técnica sensata pero NO está demostrada ni implementada.

**Puerta de validación antes de migrar:**
1. En un entorno nuevo y separado, sin secretos comerciales ni cobros, subir 2 PDFs de prueba de 16 y 94 páginas con métricas de bytes, integridad, latencia y recuperación tras corte de red. No usar datos privados de clientes ni publicar las descargas.
2. Verificar dos objetos íntegros, SHA-256 y páginas contra una lectura server-side real, no `multiReadPart` simulado; recibir 2/2 y generar un solo pedido idempotente en entorno de pruebas.
3. Registrar **tiempo hasta primera cotización, tiempo de subida, verificación, registro, tiempo total y errores**. Comparar **honestamente** con 93,5s / 97,7s del circuito antiguo en equipo y red equivalentes. Definir umbral comercial con el dueño antes de operar en vivo.
4. Inspección de privacidad/controles de abuso, costo a volumen de Librería Saber y conservación para descarga de imprenta antes de conectar al D1 actual.
5. Sólo si supera esos criterios, planear migración por una **feature flag** sin tocar cotizador comercial. Si falla, descartar sin más despliegues ciegos.

**Estado:** investigación fuente+documentación terminada; ningún servidor arrancado, servicio contratado, prueba real de upload, cambio de rama de código funcional o despliegue ejecutado. Requiere aprobación específica antes de crear un almacenamiento nuevo, aunque sea Free.

## Fuentes originales consultadas

1. https://github.com/ajaymishraj/PrintQ
2. https://github.com/7meninn/PrintQ
3. https://github.com/transloadit/uppy
4. https://github.com/tus/tus-js-client
5. https://github.com/supabase/supabase/tree/master/examples/storage/resumable-upload-signed-uppy
6. https://supabase.com/docs/guides/storage/uploads/resumable-uploads
7. https://supabase.com/docs/guides/storage/buckets/fundamentals
8. https://supabase.com/pricing
