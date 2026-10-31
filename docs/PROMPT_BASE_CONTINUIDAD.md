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
> **PRIORIDAD VIGENTE 31-10-2026 — BLOQUEO CRÍTICO: SUSPENDER DESPLIEGUES/REENVÍOS.** El usuario, legítimamente molesto, aportó dos capturas tras promover Worker privado `4d194510` y GAS v10. **Repetición del fallo**: 1 de 2 PDF verificados, `Registro de trabajos.pdf` A3 94p correcto $40.420, `preview_acau_bajaresolución.pdf` A4 16p falla en vínculo **`[etapa LECTURA_DRIVE]`**, Central D1 pendiente, sin pagos; total preliminar $41.764. E2E anterior 93,5s, último **97,7s** (peor), 24 `part` antes 62,9s acumulados y ahora 69,9s, inicio lote antes 5,8s ahora 7,2s, dos `finish` ahora 15,1s y dos `vinculo` 29,3s (duraciones solapadas, NO sumar). **`Análisis previo 444,2s`** mide intervalo UI desde estado `calculando` a `listo`, no atribuir automáticamente a CPU ni servidor. Hallazgo **definitivo en código, causa real todavía DESCONOCIDA**: en GAS `docsMultiReadPart` llama Google Drive con encabezado `Range`, `followRedirects:false`, rechaza cualquier respuesta distinta de HTTP206 y exige encabezado `Content-Range` exacto. HTTP permite 200 si rango ignorado; NO hay prueba de que esto haya ocurrido con ese PDF. GAS oculta razones concretas bajo `RECEPTOR_ERROR`; Worker sólo informa `LECTURA_DRIVE`. La suite E2E de 96 pruebas **SIMULA** `multiReadPart` devolviendo bytes perfectos, **no reproduce** HTTP Google Drive real (206/200/302/429), por lo que CI verde no es evidencia de confiabilidad. Flujo actual es arquitectónicamente lento: ~24 subidas 512KiB navegador→Worker→GAS→Drive, descarga PDF completa para SHA, y relectura en 256KiB vía GAS al Worker para calcular páginas, con muchas idas y vueltas. Cambios GAS de índice/estado no demostraron aceleración. No existe PDF original en archivos/Drive conectado disponible para inspección. **No más promociones Cloudflare ni nuevas versiones GAS ni nuevos ensayos repetitivos. No tocar `main`, web comercial, pagos, Polaroids ni secretos.** Próximo trabajo técnico sin usuario: test REAL de código GAS `docsMultiReadPart` con Drive simulado 206/200/302/429/5xx y telemetría segura por HTTP sin datos sensibles; investigar posibilidad de refactor de arquitectura antes de otra implementación. Es válida una auditoría humana independiente. Registro de postmortem detallado en `docs/DIAGNOSTICO-502-LOTE-20261028.md`, commit `4730577b`. **Nunca volver a describir como cerrado o listo** hasta ver dos PDF recibidos, un D1, tiempo aceptable en prueba externa y medición reproducible.


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
