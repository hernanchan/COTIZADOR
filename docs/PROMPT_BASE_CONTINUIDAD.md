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
> **Prioridad vigente 30-10-2026 07:13:22 ART — UNAUTHORIZED CONFIRMADO en intento actual:** screenshot Cloudflare Observabilidad Worker privado `saber-documentos-pruebas` contiene `POST /api/ensayo-pdf-iniciar-lote` + `saber_batch_start_failure UNAUTHORIZED` a las **07:13:22.837 GMT-3 del 30/10**. Esto es DESPUÉS de GAS **v9** (29/10 18:33) y de `PING CONFIRMADO` (29/10 21:03; HMAC correcto solo para `ping`). Código GAS esperado: `doPost` emite `UNAUTHORIZED` si `docsVerifyEnvelope` falla antes de `signed=true`; incluye chequeos sobre/formato, timestamp, firma HMAC, lista `p.op`. Con v9 y ping correcto, priorizar discrepancia de **operación `multiStartBatch` efectivamente desplegada** o, secundariamente, problema de firma/parseo del payload real (metadatos con Unicode), sin asumir causa definitiva. **Próximo paso único, lectura sin despliegue:** Apps Script → Historial del proyecto → versión 9 → `Código.gs` → inspeccionar `docsVerifyEnvelope` para confirmar `multiStartBatch` en allowlist y detectar posible versión desactualizada; no volver a subir PDF, no tocar secretos ni desplegar otra versión. Docs detalle: `docs/DIAGNOSTICO-502-LOTE-20261028.md` última sección, commit `25bbba7f`.


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
