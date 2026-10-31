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
> **Prioridad vigente 31-10-2026 — 422 de PDF 16p A4 investigado, 90 pruebas CI aprobadas, nueva versión INACTIVA:** el ensayo real en Worker activo `67bcda58-7ed3-45ec-bb56-b43caa7a3437` cargó 2 PDF (93,5 s): `Registro de trabajos.pdf` B/N A3 94 páginas verificado y cotizado $40.420; `preview_acau_bajaresolución.pdf` B/N A4 16 páginas terminó `finish`, pero recibió HTTP422 genérico en `v2VincularPdf`. Total preliminar $41.764, Central D1 pendiente, cero cobros. El usuario recalcó que su tiempo entre órdenes vale y pidió trabajar autónomamente. **No se encontró PDF real en Google Drive conectado**, ni está adjunto: causa exacta todavía NO determinada. Se revisó código y comprobó en funciones puras el precio de A4 B/N 16p $1.344 y compatibilidad de nombre acentuado. Corrección conservadora SOLO EN RAMA: vínculo inicial evita una consulta redundante `multiVerifiedStatus` luego de `finish` pero mantiene lectura Drive/SHA/páginas/sello/precio (Worker commit `866d78ad`); si falla, devuelve código seguro de subetapa (`INFO_GOOGLE`, `LECTURA_DRIVE`, `ANALISIS_PDF`, `GUARDADO_PAGINAS`, `MEDIDAS_PDF`, `CRUCE_RECIBO`, `SELLO_RECEPCION`, `COTIZACION`, etc.), log de fase sin datos sensibles. El cliente permite solo códigos listados (`d7a2fea4`) y muestra error del PDF directamente al lado de «Enviar mi pedido» (`353cefcb`). E2E simulado con PDF NUEVO de 16p con nombre acentuado: fallos inyectados en `multiInfo` y `multiReadPart` diagnosticados con códigos distintos y recuperación exitosa SIN re-subir, cotiza $1.344, SHA y páginas comprobados (tests `03c6a228`, `536914b7`, UI `1553752b`). GitHub Actions workflow `saber-preparar-version-privada.yml` run `41051946623`, **intento 3**, job `124558285762`, **90/90 tests PASS** (25+61+4), bundle compilado. Nueva versión Worker `9e8dd46e-a0f5-42b5-be1a-4d1b21df8684` **PREPARADA EN CLOUDFLARE SIN ACTIVAR**; no modificar Worker activo hasta promoción explícita del usuario, otros Workers, GAS, `main`, web comercial, pagos ni Polaroids. Próximo momento oportuno: usuario promueve exclusivamente `9e8dd46e` en `saber-documentos-pruebas`; en eventual ensayo único con archivos reales los errores aparecerán con código seguro. Si es posible obtener adjunto del PDF original, investigar parser sin requerir otra subida al sitio. **El ahorro de una consulta Google no demuestra resolver 93,5s**: próxima investigación estructural de 24 `part` 512KiB y lectura privada 256KiB, sin arriesgar integridad ni cambiar ambos extremos sin pruebas. Ver `docs/DIAGNOSTICO-502-LOTE-20261028.md`, última sección commit `a5e50fdd`.


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
