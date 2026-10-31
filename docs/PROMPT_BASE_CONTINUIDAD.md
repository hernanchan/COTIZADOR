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
> **Prioridad vigente 31-10-2026 — GAS DOCUMENTOS V10 PROBADO Y WORKER PRIVADO `4d194510` PROMOVIDO según usuario, E2E PENDIENTE:** Apps Script «SABER — RECEPCIÓN DOCUMENTOS» v10 31/10/2026 12:29 en la implementación existente `AKfycbyIQA0jEooqtnqJmygQuPMyUPXEVMhuFbg9BBLP7QwuaGO3EnEAW_N6Aat6_mxXTWQYDQ` (mismo `DOCS_SCRIPT_URL`) contiene mejoras: índice global marcado una vez por sesión, una instantánea por lote y una única lectura de estado en parte/finish/status, preservando tokens, TTL, SHA y reanudación. Prueba en vivo `/prueba-google-lote` confirmó **`UTF8_OK_LOTE_AUTORIZADO`**, 4273ms totales y 4221ms Google, sin PDF ni sesión. GitHub Actions run `41051946623` intento 8, 96/96 tests aprobados, Worker versión preparada `4d194510-964d-4c70-b08b-663fe3cc11b6`. Usuario recibió instrucciones para promocionar esa versión exclusivamente en `saber-documentos-pruebas` y contestó **«LISTO»**; se interpreta como promoción efectuada **por su palabra**, sin captura independiente del 100 %. Worker anterior `67bcda58` sigue disponible para rollback. **SIGUIENTE PASO YA COMUNICADO:** UNA prueba E2E privada en `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/?diagnostico=1` con dos PDF (ideal los mismos A3 94p y A4 16p), confirmar precio y enviar una sola vez; NO reintentar si falla. Capturar «Tiempos del ensayo» con cantidad/duración HTTP, motivo de error específico `[etapa ...]`, 2 recibos y 1 pedido D1. Comparar contra prueba anterior **93,5s**, 24 partes 62,9s acumulados, 2 finish 16,2s, 2 vínculo 33s, 1/2 verificado, D1 pendiente, total preliminar $41.764. No afirmar ahorro hasta medir. No tocar `main`, web comercial, Polaroids ni cobros. Registrar captura siguiente en `docs/DIAGNOSTICO-502-LOTE-20261028.md` después de commit `5b8143ea`.


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
