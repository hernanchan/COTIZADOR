# Referencia VIGENTE — continuidad y documentación desde 14/11/2026

**Antes de modificar este proyecto**, leer [Manual maestro](docs/MANUAL_MAESTRO_SABER/00-INDICE-Y-ESTADO.md), [Arquitectura y operación](docs/MANUAL_MAESTRO_SABER/01-ARQUITECTURA-Y-OPERACION.md) y [Protección y comercialización](docs/MANUAL_MAESTRO_SABER/02-PROTECCION-Y-COMERCIALIZACION.md).

- Las secciones anteriores de este archivo sobre GitHub Pages, `main`, fases y estados de ensayo se conservan **como historial** y pueden estar desactualizadas. No deben prevalecer frente al release comprobado, el código en uso o un mandato específico del propietario.
- Diferenciar **vidriera estática**, **cotizador comercial Documentos**, **Central/Pagos** y **Polaroids**. El motor comercial consolidado está desarrollado en `integracion/tus-pedido-privado-20261101`; no asumir que el código de `main` es igual al Worker comercial.
- No usar chats como fuente primaria de recuperación: registrar cambios relevantes, sus pruebas, commit y despliegue.
- No trasladar contraseñas, tokens ni datos privados a GitHub. El repositorio es público y no tiene licencia abierta declarada.
- No cambiar la visibilidad del repositorio ni tocar DNS, Pages o los Workers sin analizar dependencias y establecer rollback.
- Documentación y auditoría de protección NO autorizan publicación, cambios de tarifas o alteraciones de cuentas/bases.

---

# Instrucciones de trabajo — Librería Saber

## Repositorio y publicación

- Este repositorio (`hernanchan/COTIZADOR`) es la fuente oficial del cotizador publicado.
- El cotizador que carga `libreriasaber.com.ar/cotizar` proviene de `cotizador-web-v2.html` mediante GitHub Pages.
- Para leer o publicar cambios, usar primero la conexión instalada de GitHub/Codex para `hernanchan/COTIZADOR`.
- No intentar iniciar sesión en GitHub mediante usuario y contraseña, ni pedirle a Hernán que suba archivos manualmente, mientras la conexión de GitHub esté disponible.
- Antes de reemplazar un archivo, obtener su contenido y SHA actuales con la conexión de GitHub. Luego actualizar únicamente el archivo necesario en `main`, con un mensaje de commit descriptivo.
- No sobrescribir otros cambios recientes del repositorio. Comparar siempre con la versión actual antes de publicar.

## Verificación obligatoria

Después de publicar una modificación del cotizador:

1. Confirmar que GitHub devolvió el SHA del nuevo commit.
2. Abrir la versión publicada en `https://hernanchan.github.io/COTIZADOR/` con un parámetro de caché.
3. Verificar también el recorrido real en `https://libreriasaber.com.ar/cotizar`, incluido el contenido del iframe.
4. Informar como publicado solo cuando la versión real muestre el cambio.

## Promociones diarias

- Las promociones se determinan automáticamente mediante `scheduledPromo()`.
- El beneficio del día debe mostrarse desde la pantalla inicial del cotizador, aunque el visitante llegue directamente desde WhatsApp.
- Cuando la promoción se aplique, el presupuesto debe mostrar el beneficio, el precio anterior, el descuento y el total correspondiente.


## PROYECTO INTEGRAL NUEVA WEB — continuidad obligatoria en cada chat

Esta sección se aplica a la rama privada de desarrollo `fase1/impresiones-ploteos-20261027` y sus futuras ramas de ensayo. **No autoriza publicar en `main`**; la sección original de publicación describe otro flujo y no anula las restricciones del proyecto privado.

- Al iniciar cualquier chat del proyecto, **leer primero** `docs/PROMPT_BASE_CONTINUIDAD.md` y el registro actual `docs/ETAPA1-IMPRESIONES-PLOTEOS-CIERRE.md`. No partir de memoria o del resumen de un chat anterior como única fuente.
- **Durante cada chat**, registrar en GitHub nuevos problemas identificados, decisiones, pruebas, causas y correcciones relevantes, incluso si todavía no fueron reparados. Anotar estado exacto: diagnóstico / código / deploy / prueba real.
- Antes de cerrar o cambiar de chat, **actualizar el registro vigente** con los resultados y el siguiente paso ejecutable. Si no hubo novedad sustantiva, no crear commits vacíos.
- Crear un registro de etapa sucesora cuando corresponda y actualizar el índice en `docs/PROMPT_BASE_CONTINUIDAD.md`. Mantener el historial.
- La confirmación de continuidad requiere **commit SHA y ruta**. Si no se pudo persistir el cambio, informar el impedimento y entregar un texto de traspaso utilizable.
- No insistir al usuario en pruebas ya descartadas; no repetir diagnósticos, ni afirmar que un cambio realizado solamente en GitHub ya está instalado en GAS o Cloudflare.
- Prioridad actual: **incompatibilidad Apps Script receptor Fase 4 / Worker ampliado**, documentada con evidencia en la sección «ESTADO VIGENTE PARA RETOMAR EN OTRO CHAT». No tocar `main`, web comercial, pagos o Polaroids sin autorización explícita.
