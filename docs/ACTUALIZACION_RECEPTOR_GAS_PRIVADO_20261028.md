# SABER | Actualización controlada del receptor privado de documentos — 28/10/2026

## Qué cambia (sin tocar la web comercial)

Sólo **SABER — RECEPCIÓN DOCUMENTOS** (Google Apps Script, recepción PDF). No modifica Polaroids, cobros, producción ni `libreriasaber.com.ar`.

Archivo completo en el repositorio de pruebas:
`integraciones/autocotizador/recepcion/DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs`

Cambios compatibles con el protocolo existente:

1. `docsFinish`: sigue descargando el PDF completo **una vez**, verificando tamaño y SHA-256 REAL contra Drive. Registra `storageSha256Checked` y `storageSha256CheckedAt` en la sesión guardada.
2. `docsMultiCommitPages`: exige recibo `bytes_checked/pages_verified`, Drive ID, offset completo, SHA, bytes, sesión HMAC y número de páginas; reutiliza el checkpoint de `docsFinish` y **no repite** la descarga completa en una sesión nueva. Sesiones anteriores sin checkpoint hacen una descarga de compatibilidad y registran la marca. La verificación de páginas por el Worker se mantiene.
3. `docsPart`: en envío consecutivo usa el offset que Drive acaba de confirmar y que GAS persistió. En reintentos, desorden o respuesta inesperada consulta el estado real de Drive antes de aceptar o repetir el bloque.
4. `docsMultiStart`: devuelve `newSession:true` sólo cuando acaba de crear la sesión. Si encuentra un recibo del mismo pedido devuelve `newSession:false`.
5. Cliente `subir-vincular-pdf-v2-privado.mjs`: omite `multiStatus` sólo tras `newSession:true`, pero conserva la consulta para versiones viejas del receptor, sesiones previas, bloques aceptados, interrupciones y respuestas perdidas. **Este cliente sólo se activa después de preparar/promocionar una NUEVA versión del Worker privado mediante el workflow manual de GitHub.** Con la versión anterior sigue funcionando el receptor nuevo (retornos extra son inocuos).

## Qué está probado

- GitHub CI `40764055539` **success**; contrato, ensamblado del Worker y regresiones sin fallos.
- Nueva suite GAS ejecuta las funciones REALES del archivo `.gs` con Drive/PropertiesService simulados: fragmentos consecutivos, desorden, pérdida de ACK, estado remoto, SHA de fragmento, SHA completo, reenvío, idempotencia, sesiones viejas y marca `newSession`.
- Suite del cliente: `newSession:true` sin status; receptor viejo, reanudación, sesión reutilizada y ACK perdido CON status.
- 31 tests de entrega/recepción/verificación aprobados. Nada de red real ni archivos de clientes en estos tests.

## Despliegue MANUAL, sólo cuando el operador esté listo

**Antes de editar:** abrir el proyecto correcto de Google Apps Script llamado «SABER — RECEPCIÓN DOCUMENTOS» (no Polaroids), revisar que la fuente real coincida en estructura con la de GitHub y preservar la versión desplegada anterior. Si hubo cambios no sincronizados en el proyecto real, NO reemplazar el código completo a ciegas: primero comparar e integrar el diff. No cambiar propiedades `DOCS_RELAY_KEY`, `DOCS_ROOT_FOLDER_ID` ni permisos.

1. En el repositorio, abrir el archivo `.gs` optimizado de la rama privada, pulsar «Raw», copiar el contenido completo. En el proyecto Apps Script privado, **guardar copia/versión anterior** antes de sustituir el código correspondiente. No tocar otros archivos o proyectos.
2. Implementar → Administrar implementaciones → editar **la implementación de prueba existente** → Versión: Nueva versión → Implementar. Confirmar que la URL `/exec` se conserva (la URL actualmente guardada en `DOCS_SCRIPT_URL` del Worker), y que sólo actualiza el receptor privado. NO crear una nueva URL ni activar pagos.
3. Si surge un problema, volver en Apps Script a la versión anterior de esa implementación; conservar las versiones `4218e07f` (Worker privado, actual conocida) y la versión GAS previa para rollback. Nunca alterar `main` ni el sitio comercial.
4. Después actualizar el cliente privado de Cloudflare con el workflow manual `.github/workflows/saber-preparar-version-privada.yml` (ejecutarlo desde `main`, incorpora código de rama privada); promocionar SOLO `saber-documentos-pruebas`. En este orden, el receptor nuevo es compatible con el Worker antiguo.
5. Una prueba final con `poliza_1145046.pdf`, 12 páginas, A4, B/N, doble faz, una copia y anillado individual, `/prueba-v2/?diagnostico=1`: comparar contra 32.296 ms, confirmar precio $3.290, PDF real en Drive, pedido en Central y pagos desactivados. Una medición no determina garantía de rendimiento.

## Límites y precauciones

- Los cambios de GAS aún **NO están instalados ni probados en Google real**; la mejora de latencia es una hipótesis fundamentada, no un resultado medido.
- Si el receptor actual no coincide con la fuente del repositorio, pedir el código actualizado/backup antes de reemplazar. Evitar borrar índices de sesiones o Drive.
- Se mantienen cuotas, máximo 30 PDFs por pedido y autenticación HMAC. El registro comercial permanece sujeto a la comprobación de servidor existente y a la Central.
