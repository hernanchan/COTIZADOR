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
> **Prioridad vigente 31-10-2026 — OPTIMIZACIÓN DEL ÍNDICE GAS PROBADA EN CI 94/94, TODAVÍA NO DESPLEGADA EN GOOGLE:** ensayo E2E del Worker privado activo `67bcda58` con 2 PDF tardó 93,5s, **24 llamadas part 62,9s acumulados**, 2 finish 16,2s y 2 vinculo 33,0s. PDF A3 94p verificado, A4 16p `preview_acau_bajaresolución.pdf` falló en vinculación 422 genérico, Central D1 pendiente, sin cobro. Worker de diagnóstico detallado con ahorro de una consulta redundante a Google preparado previamente como `9e8dd46e` (NO ACTIVO), 90 tests. **Hallazgo nuevo:** GAS `docsMultiAuth` escaneaba hasta 120 sesiones por cada fragmento, lectura y commit (`docsMultiIds`→`getProperties`). Cambios SOLO en rama GitHub GAS `DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs`: commit `4d9ab34d` **marca índice comprobado por sesión** después de publicarlo; `docsAuth` sigue verificando token/TTL en CADA llamada, sesiones viejas comprueban índice una vez y se marcan, no indexadas se rechazan. Commit `2fb121d3` **reutiliza la instantánea del índice en `docsMultiStartBatch`** bajo lock, evitando relectura por PDF. Tests VM receptor real commits `65c70b7e`, `cbe58499`, `e3732451`: sesiones nuevas 0 lecturas de índice por partes y commit, antiguas 1, batch de tres PDFs 1 por ejecución, hash Drive/reintento/TTL/token quedan. GitHub Actions run `41051946623` intento 6, job `124562109384`, **94/94 tests aprobados, 0 fallas**, compilación Worker; Cloudflare version `0dbcf176-905d-4425-b108-27a42c5ae98b` PREPARADA **SIN ACTIVAR**. **CRÍTICO: flujo GitHub prepara SOLO Worker, NO despliega GAS**. Por lo tanto ahorro del índice todavía NO opera en Google y promover un Worker aislado no lo activaría. Para probar la mejora hay que coordinar UNA actualización controlada del receptor Google Apps Script (respetar script existente, v9, nueva versión, URL/secrets), más promoción opcional del Worker preparado con códigos de fallo seguros; jamás tocar script Polaroids, web comercial, `main` ni pagos. No publicar nada ni pedir repetición de PDF a ciegas; sólo un ensayo E2E posterior al cambio real para medir ahorro. PDF original 16p ausente en Drive conectado y chat, causa concreta 422 sigue sin demostrarse. Registro íntegro `docs/DIAGNOSTICO-502-LOTE-20261028.md` última sección commit `a2376989`.


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
