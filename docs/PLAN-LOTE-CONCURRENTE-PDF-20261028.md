# LIBRERÍA SABER — Recepción de PDF en tandas, hasta dos transferencias simultáneas
**28 de octubre de 2026 · propuesta terminada EN CÓDIGO, no desplegada**

## Razón del cambio

Ensayo real del Worker privado **b7f58caf**: un PDF de 12 páginas, B/N A4 doble faz con anillado individual, $3.290 y pedido confirmado en **28.639 ms**. Antes de esta fase, el botón «Enviar mi pedido» envía cada PDF de forma estrictamente secuencial. El tiempo no es matemáticamente proporcional al número de archivos porque varían bytes, páginas, red y tiempos fijos, pero la espera crece al sumar sesiones completas.

**Objetivo:** conservar el envío único, clasificación/pricing previo y comprobación individual, mientras se reduce la repetición de operaciones para un pedido con 2–30 PDFs.

## Diseño implementado en rama de pruebas

1. Cliente V2, `pantalla-cotizador-v2-prueba-privada.mjs`: un solo clic sigue preparando trabajos; **si hay más de un PDF pendiente**, toma opciones reales y referencias de cada trabajo. Agrupa las nuevas sesiones de recepción de hasta 10 archivos por tanda, luego ejecuta envíos a lo sumo de dos en dos. Los PDF ya confirmados no se reenvían.
2. Worker `fase4BatchStart`: ruta exclusiva `/api/ensayo-pdf-iniciar-lote`. Requiere POST, origen permitido, flags privados `DOCS_EXTENDED_RECEIVER_ENABLED` + `DOCS_V2_PRIVATE_UI_ENABLED` y un Turnstile válido por tanda (`action:'documentos'`, hostname permitido). Valida 1–10 metadatos estrictos, unicidad de identificadores, orderId único, tamaño de cada documento <=20 MiB y hasta 60 MiB por tanda. Ejecuta **un solo POST HMAC a GAS por tanda**. Devuelve sólo sesiones y tokens privados bajo `Cache-Control:no-store`. No acepta contenido PDF, no guarda pedidos, no abre cobros.
3. Apps Script `docsMultiStartBatch`: operación HMAC nueva. Bajo **LockService de índice/cupo**, revisa de forma preventiva todas las nuevas sesiones contra 30 archivos/60 MiB por pedido y límite global. No abre archivos Drive si la tanda entera no entra. Si Google se interrumpe luego de crear algunos recibos, reintentar con el mismo orderId/fileId/SHA reutiliza los existentes, sin duplicación.
4. Apps Script `doPost` **libera el bloqueo global** para operaciones de archivos independientes `multiPart`, `multiStatus`, `multiFinish`, `multiCommitPages`, además de lecturas. Conserva el lock para creación y cupos globales. Cada sesión Drive mantiene su secuencia de fragmentos bajo responsabilidad del cliente, con SHA por parte y SHA completo real de Drive en `docsFinish`. `docsMultiIds` sólo limpia el índice bajo lock de creación, evitando sobrescrituras por operaciones paralelas.
5. Cliente `subir-vincular-pdf-v2-privado.mjs`: el marcador efímero `batchFresh` omite `multiStatus` sólo **en el primer envío** de una sesión creada por lote. Se elimina antes de iniciar la primera parte; cualquier fallo/reanudación sigue consultando los bloques reales de Drive. `ejecutarRecepcionParalela` aplica máximo **dos carriles**: ante fallo detiene nuevos archivos, deja terminar los ya iniciados y no registra Central si falta alguno.
6. ID de archivo nuevo `pdf-<16 caracteres SHA>-<UUID local sin guiones>`: permite varias referencias que apuntan a PDFs con contenido SHA idéntico; enlace del servidor exige coincidencia SHA+UUID, recibo, nombre, bytes, páginas y orden. El verificador sigue admitiendo IDs anteriores basados sólo en SHA para recuperar trabajos legados.
7. **Registro D1 se mantiene único e independiente del número de PDF**. El manifiesto y las fichas de servidor se generan después de todas las confirmaciones reales. La Central no recibe tokens de Google ni reabre PDFs al registrar. Los pagos permanecen deshabilitados.

### Límites, observaciones y riesgos

- **No hay aún benchmarks reales** de 2, 5 o 10 PDF. No atribuir mejoras porcentuales, tiempos por 10 PDFs, p95 ni promesas sobre Google sin ensayos.
- Dos transferencias en paralelo es un límite conservador (hasta 40 MiB de archivos locales activos antes de que termine el envío); Google Drive, Apps Script y la conexión siguen siendo dependencias con latencia variable.
- Un pedido con 11–30 PDF se divide en tandas de hasta 10 sesiones iniciales; cada una necesita un Turnstile nuevo, que puede resolverse automáticamente o pedir intervención. Ningún usuario debe completar pantallas repetitivas de precios para enviar.
- Este mecanismo no sustituye la verificación SHA de cada PDF, la cuenta de páginas en el Worker ni la confirmación de Central.
- Puede quedar una sesión en Google si se aborta el navegador antes de recibir su identificador: el inicio del mismo orderId/fileId se recupera idempotentemente. No borrar archivos ni cuotas sin plan de retención.
- La verificación del paralelismo no incluye una medición real de la contención y límites de ejecuciones simultáneas de Apps Script: **solo tests automatizados con mocks**.
- La UI comercial, Mercado Pago, Polaroids, Cloudflare R2 y la rama `main` no se modifican.

## Pruebas ejecutadas (NO PAYMENTS, NO DEPLOY)

**GitHub Actions `40771752816`, job `123110476152`: SUCCESS**, 55 tests de contrato, 42 pruebas de entrega/recepción, 3 E2E compilados del Worker y 13 regresiones antiguas: **113 pruebas aprobadas, 0 fallos**.

Cobertura: 10 archivos escalonados en máximo dos carriles; error de un archivo sin iniciar otros ni marcar pedido completo; reintento tras ACK perdido; sesión fresca sólo omite estado una vez; cuota previa por pedido, colisión SHA+fileId, 3 recibos GAS idempotentes; corte durante segundo archivo y recuperación de las sesiones anteriores; SHA del fragmento y archivo completo; dos archivos con SHA idéntico pero referencias diferentes no comparten recibo; compatibilidad con ID legado; inicio Worker de 3 recibos con **un** Turnstile y **un** POST GAS; **dos PDF reales de 12 páginas** con SHA/lectura de Drive simulada, **un único pedido D1 simulado por $6.580**, cero nuevas descargas de Drive al registrar y cobros apagados.

## Orden seguro de activación (pendiente de autorización del usuario)

1. El receptor real en Google «SABER — RECEPCIÓN DOCUMENTOS» todavía contiene la versión optimizada **anterior** al procesamiento por lotes. Hay que reemplazar `Código.gs` con el `.gs` de la rama privada y actualizar únicamente la implementación activa **«Receptor ampliado 30 PDF - pruebas privadas»**, edición → Nueva versión. No editar Polaroids, DiagnosticoCupo.gs, appsscript.json ni ninguna propiedad, y no crear nueva URL. Google conserva versión anterior para revertir. **No dar por realizado hasta confirmación expresa del usuario.**
2. Después ejecutar workflow manual `.github/workflows/saber-preparar-version-privada.yml` desde `main`, que compila **sólo** `fase1/impresiones-ploteos-20261027` y prepara nueva versión sin activar de Worker `saber-documentos-pruebas`. Registrar UUID `VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR` auténtico. **No inventar UUID.**
3. Promocionar al 100% únicamente el Worker privado nuevo, conservar como rollback **b7f58caf-7ca4-4abf-8e05-9694fa9593fd**, la versión de 28.639 ms.
4. Hacer una sola prueba controlada de **dos PDF** distintos desde el mismo botón, comprobar dos recibos SHA y **un** pedido en D1 sin cobro. Luego medir 5–10 PDF reales y contrastar contra la suma de tiempos individuales, si el usuario desea medir. Registrar consola `lote_sesiones`, `pdf_inicio`, `pdf_confirmado`, `central_fin`, `fin`.
5. Si la prueba falla, retroceder Worker a `b7f58caf` inmediatamente. Si el receptor de Google presenta errores, retroceder en la implementación GAS al código anterior. No borrar sesiones ni pedidos de prueba prematuramente.

**Estado final al redactar:** código y tests listos EN RAMA PRIVADA; NO se activaron cambios del receptor GAS ni Cloudflare Worker correspondientes a esta fase. Web comercial y pagos intactos.


## Corrección de continuidad — 29/10/2026

**ATENCIÓN: el orden de activación histórico arriba es obsoleto y NO debe ejecutarse tal como está escrito.** Capturas reales de Apps Script confirmaron que «Receptor ampliado 30 PDF - pruebas privadas» v6 está **ARCHIVADO**, mientras que la aplicación web ACTIVA es «Recepción concurrente de PDF - multiStartBatch - pruebas privadas» v8 (28/10 18:40), URL prefijo AKfycbyIQA. Se guardó código en el editor pero NO se desplegó nueva versión. El Worker privado se informó promovido y el fallo observado en ensayo de dos PDF es `saber_batch_start_failure UNAUTHORIZED` durante inicio, anterior a registro D1. Consultar `docs/DIAGNOSTICO-502-LOTE-20261028.md` y `docs/PROMPT_BASE_CONTINUIDAD.md` para detalle vigente.

**Plan de recuperación:** congelar nuevas funciones; conservar cotizador, precios, clasificación, UX y Central; auditar dependencia Worker→GAS y validar comunicación firmada sin PDFs ni cambios de configuración a ciegas; corregir sólo causa probada; una prueba E2E con dos PDF, registro en Drive/D1, cobros deshabilitados. Después validar minimalismo y circuito comercial. No sustituir toda la arquitectura sin evaluación comparativa ni autorización expresa. Ninguna modificación de `main`, dominio comercial, pagos ni Polaroids.
