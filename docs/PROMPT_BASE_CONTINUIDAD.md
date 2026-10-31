# PROYECTO INTEGRAL NUEVA WEB — PROMPT BASE PERMANENTE

**Uso:** copiar este texto al comienzo de cualquier nuevo chat relacionado con Librería Saber. No es una lista de tareas nuevas, sino un procedimiento que debe repetirse en **todos** los chats.

## Prompt para pegar en nuevos chats

> Continuemos el PROYECTO INTEGRAL NUEVA WEB de Librería Saber.
>
> Repositorio oficial: `hernanchan/COTIZADOR`. Trabajá en la rama de pruebas activa, actualmente `fase1/impresiones-ploteos-20261027`, sin tocar `main` ni la web pública.
>
> **Antes de intervenir:** consultá `AGENTS.md`, este archivo, `docs/METODO-PERMANENTE-DESARROLLO-EN-DEFINICION-20261029.md` (acuerdos vigentes de producto y método), `docs/ETAPA1-IMPRESIONES-PLOTEOS-CIERRE.md` (historial) y `docs/DIAGNOSTICO-502-LOTE-20261028.md` (incidencia técnica vigente). Para concurrencia PDF, consultar `docs/PLAN-LOTE-CONCURRENTE-PDF-20261028.md`. Si avanza la etapa, seguí el índice actualizado. No reiniciar diagnósticos cerrados.
>
> **Durante el trabajo:** conservá el rumbo acordado; no repitas investigaciones ni pruebas ya concluidas. Distinguí siempre entre «identificado», «corregido en GitHub», «desplegado en entorno privado» y «comprobado con prueba real». Nunca declares solucionado un problema que no superó el ensayo correspondiente.
>
> **Obligación de continuidad en CADA CHAT:** actualizá el registro persistente de GitHub cuando aparezca un hallazgo, una causa técnica, una decisión, una corrección, un ensayo o un bloqueo que afecte el trabajo futuro. Registrá evidencia, archivos/rutas, rama, commit, resultados, estado de despliegue, pendientes y **el siguiente paso concreto**. Si no hubo cambios importantes, no hagas commits vacíos. Antes de cerrar el chat o entregar un prompt de traspaso, asegurate de que el registro esté actualizado. Si falla el guardado en GitHub, avisá explícitamente y entregá un texto listo para incorporarlo.
>
> **Al cambiar de chat:** no generes un resumen desde memoria como única fuente. Leé el registro real y continuá desde el punto siguiente; dejá nuevamente actualizada la continuidad. El prompt base permanece igual; lo que evoluciona es el registro.
>
> **Restricciones:** jamás modificar `libreriasaber.com.ar`, publicar `main`, activar cobros, generar gastos o tocar Polaroids sin autorización explícita. Mantené la recepción y Central privadas. Pedí intervención humana solo cuando sea indispensable; una instrucción a la vez, con enlaces concretos.
>
> **Prioridad vigente 31-10-2026 — TRES OPTIMIZACIONES GAS PREPARADAS, CI 96/96, SIN DESPLIEGUE GOOGLE:** ensayo privado activo `67bcda58` de dos PDF tardó 93,5s: 24 `part` 62,9s acumulados, 2 `finish` 16,2s y 2 `vinculo` 33s; A3 94p verificado $40.420, A4 16p con nombre `preview_acau_bajaresolución.pdf` llegó a `finish` y falló al vincular 422 genérico, Central D1 pendiente sin cobros. Ahorro en Worker de una consulta redundante y errores seguros por fase preparados previamente, NO ACTIVADOS. En GAS se identificó costo estructural: cada llamada `multiPart`, `multiReadPart`, `multiFinish`, etc. escaneaba todas las sesiones del índice global de hasta 120 estados. **Código de la rama** `DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs`: commit `4d9ab34d` guarda `indexedForMulti=true` después de publicar el índice, permite a legado verificar índice una vez y evita sucesivas instantáneas, conservando token y caducidad por solicitud; commit `2fb121d3` reutiliza snapshot global del inicio de tanda para todos los PDFs; commit `63cadc7f` reutiliza sesión ya autenticada en `docsPart`/`docsStatus`/`docsFinish` y elimina una segunda consulta de propiedad por RPC. Tests VM sobre GAS real: nuevo recibo 0 lecturas globales por fragmentos, antiguo 1 en total, tanda 1 snapshot, **1 getProperty por parte/estado/finish**, SHA completo Drive, recuperación de ACK, expiración y token siguen. Tests commits `65c70b7e`, `cbe58499`, `e3732451`, `0bcb990f`, `1e09b7b6`. **CI FINAL GitHub Actions** run `41051946623` intento 8, job `124563289136`, **96/96 pruebas aprobadas** (25+67+4), compilación correcta y nueva versión Worker **`4d194510-964d-4c70-b08b-663fe3cc11b6` PREPARADA SIN ACTIVAR**. **CRÍTICO**: GitHub Actions SOLO construye Worker Cloudflare, **NO actualiza Apps Script**. Las tres mejoras GAS NO están vivas hasta cambiar el deployment GAS con procedimiento seguro de una sola vez (sin tocar script Polaroids); promover Worker aislado NO acelerará la carga Google. No pedir otra prueba PDF antes de actualización real, no tocar secretos, sitio comercial, rama main ni pagos. Una vez actualizado GAS y preparado Worker si procede, realizar una sola prueba E2E para medir ahorro y diagnosticar 422 con código seguro. PDF original de 16p sigue ausente en chat/Drive conectado y su causa exacta no está demostrada. Última documentación `docs/DIAGNOSTICO-502-LOTE-20261028.md`, commit `85dda2d4`.


## Protocolo de documentación por conversación

1. **Inicio:** leer `AGENTS.md` y registro vigente. Identificar última intervención **realmente verificada**.
2. **Ejecución:** seguir tareas pendientes. Usar rama de trabajo; diferenciar cambios en fuente vs cambios desplegados.
3. **Hallazgos:** registrar cualquier error, observación, causa, regla comercial, decisión, límite, prueba fallida o exitosa que deba sobrevivir otro chat.
4. **Cierre o hito:** actualizar la sección «ESTADO VIGENTE» del registro de etapa o crear su sucesor. Debe decir lo que está hecho, lo que falta, lo que no debe repetirse y **cómo reanudar**.
5. **Confirmación:** mencionar la ruta del registro y SHA del commit; si no se pudo guardar, declararlo claramente. No depender solo de la memoria automática.

## Ubicación de los registros

- Método de desarrollo y producto (acuerdos vigentes): `docs/METODO-PERMANENTE-DESARROLLO-EN-DEFINICION-20261029.md`.
- Registro histórico de etapa: `docs/ETAPA1-IMPRESIONES-PLOTEOS-CIERRE.md`.
- Incidencia técnica vigente y próximo paso: `docs/DIAGNOSTICO-502-LOTE-20261028.md`.
- Plan multiarchivo y límites de arquitectura: `docs/PLAN-LOTE-CONCURRENTE-PDF-20261028.md`.
- Contrato UX acordado para el próximo desarrollo: `docs/UX-CIRCUITO-UNICO-CLIENTE-V1.md` (documentación, aún no implementada).
- Índice de continuidad y criterio general: este documento.
- Instrucciones de agentes/colaboradores: `AGENTS.md`.

Al concluir Etapa 1, crear `docs/ETAPA2-...-ESTADO.md`, actualizar aquí cuál es la etapa activa y mantener los archivos anteriores como historial. **No borrar evidencia ni reemplazar el historial con resúmenes ambiguos.**
