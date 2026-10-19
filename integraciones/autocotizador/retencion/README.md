# Retención automática de archivos — Librería Saber

**Estado al 19/10/2026: DISEÑO IMPLEMENTADO EN RAMA, SIMULACIÓN COMPROBADA, NINGÚN BORRADO ACTIVADO.**

El usuario planteó que el espacio disponible de la cuenta de Drive es limitado y pidió programar una depuración automática de los archivos de Polaroids, PDF, JPG/PNG y otras categorías. La limpieza aplica exclusivamente a los **archivos generados/recibidos por el cotizador web**, nunca a la unidad Drive completa.

## Política propuesta para aprobación

| Caso | Qué hacer |
|---|---|
| Pedido cobrado, completamente producido y **marcado entregado** | Guardar durante **30 días desde la entrega**. |
| 30 días posteriores a la entrega, sin reclamos ni reimpresiones | Mover **solo** los archivos de ese pedido a la papelera. Registrar auditoría. |
| 7 días completos en la papelera, sin reclamos ni cambios | Borrar definitivamente **únicamente** los mismos archivos verificados. |
| Pedido esperando transferencia o confirmación Mercado Pago | **No borrar**. |
| Pedido recibido pero no producido / en preparación | **No borrar**. |
| Entrega con reclamo, reimpresión pendiente, cancelación en revisión o retención manual | **No borrar**. |
| Pedidos incompletos, impagos o abandonados | Política separada a definir: hoy **no se borran automáticamente**. |
| Polaroids históricos, previos a esta migración | **No borrar** hasta inventario validado, estado y fecha de entrega comprobados. |

Los plazos **30 + 7 días son una propuesta**, no una autorización definitiva del titular. Configurables mediante `diasTrasEntrega` y `diasRecuperacion`. Modo efectivo `simulacion` y ejecutor apagado, incluso si el código se carga o se registra accidentalmente un disparador.

**Atención a la cuota de Google:** mandar archivos a la papelera no libera espacio inmediatamente. Solo después del borrado definitivo disminuye el consumo; Google puede tardar en reflejar el cambio. Nunca vaciar automáticamente **toda la papelera del usuario**, porque contiene otros datos no vinculados al cotizador. Borrar definitivamente solamente IDs específicos de los archivos web incluidos en inventario, aprobados por la política y previamente enviados a papelera.

## Componentes preparados

- `plan-retencion.mjs`: motor **puro** (sin red ni borrado) que evalúa pedidos y genera vista de qué conservar, qué mandar a papelera y qué purgar.
- `ejecutor-seguro.mjs`: preparado para conectar Drive y pedidos, pero por defecto retorna `LIMPIEZA_APAGADA`. Para operar necesitaría, **en servidor**, `enabled:true`, `mode:'execute'`, y para borrado definitivo otro flag `allowPermanentDelete:true`. No exponer esos flags al navegador ni confiar en opciones de URL.
- `tests/autocotizador-retencion.test.mjs`: regresiones por plazo, tipo, carpetas, cobro, reclamo, manual hold y grupos de un carrito mixto.
- `tests/autocotizador-ejecutor-retencion.test.mjs`: simula apagado, envío a papelera, período de recuperación y purga; evita borrar si el archivo real está fuera de la carpeta registrada.

## Controles obligatorios antes de automatizar

1. La base de pedidos debe guardar y exponer **cuándo fue entregado** cada pedido, no inferirlo del pago ni de la carga. Centro de Pedidos necesitará acción «Marcar entregado» para el operador, registrando usuario y fecha. Una compra pagada no es automáticamente una entrega.
2. Para cada PDF, Polaroid o JPG/PNG, guardar `driveFileId`, `orderId`, servicio, carpeta privada por pedido, origen y versión, `logicalFileId`, SHA y estado `active|trashed|purged`. Antes de cualquier acción volver a consultar **la base actual** y la **API de Drive**; verificar ID, carpeta padre, origen, orden y estado.
3. No crear una limpieza general que busque por fecha de creación o por extensión `.pdf/.jpg` en todo Drive. No tocar la carpeta antigua de Polaroids sin registrar correctamente sus archivos ni inventar su ruta.
4. Implementar auditoría durable (pedido, id de archivo, motivo, hora, operador/sistema y resultado). Conservar la **ficha comercial de pedido y pagos** aunque sus binarios hayan sido eliminados. El panel debe mostrar «Archivos eliminados por política» y no un vínculo roto.
5. Antes del primer borrado real, correr varios días en **simulación**, revisar lista de candidatos y aprobar plazos. Respetar reversión durante período de papelera y bloqueo si existe reclamo/cambio de estado.
6. Programar ejecución periódica **diaria** en infraestructura ya utilizada (trigger Apps Script o Cron Worker), con bloqueo frente a ejecuciones simultáneas y límites de operación para cuotas. No instalar todavía el trigger.
7. Para pedidos impagos o abandonados, definir vencimiento, verificación de movimientos bancarios y plazo de reclamaciones antes de autorizar limpieza. Nunca borrar una transferencia pendiente de identificación por mera antigüedad.
8. Google Apps Script de Polaroids existente **no fue modificado**. El futuro registro de Polaroids deberá aceptar solamente pedidos con verificación real de entrega y metadata de Drive adecuada. No introducir código de eliminación en el receptor antiguo.

## Carrito abandonado y recuperación de la venta — alcance acordado

**Decisión del titular (19/10/2026):** aceptar plazo de **48 horas desde la última actividad** para pedidos que realmente quedaron abandonados sin pago, con **7 días de recuperación en papelera**. Distinguirlos de carritos únicamente exploratorios donde todavía no se subió nada, pedidos pendientes de Mercado Pago, pagos por transferencia informados o sin identificar, y situaciones que requieran revisión: **estos no se pueden borrar automáticamente por esta regla**. Antes de activar, definir el estado explícito `abandoned` y verificar que nunca se pagó ni quedó una transacción o transferencia por verificar. La regla de 48 h está aprobada conceptualmente pero **todavía no está implementada** en el planificador (que hoy sólo contempla pedidos entregados).

**Recuperación del carrito:** se desea un recordatorio automático para retomar una compra abandonada. **NO ES REQUISITO BLOQUEANTE DE LA MIGRACIÓN PRINCIPAL.**

- **Preparar en la fase actual** los campos de contacto consentido y recuperación: `contactPhone` o `contactEmail`, `whatsappReminderOptIn` (casilla sin marcar inicialmente, texto claro nombrando Librería Saber), `optInRecordedAt`, `consentSource`, `lastActivityAt`, `cartExpiresAt`, `orderStatus`, `reminderStatus`, `reminderSentAt` y un identificador aleatorio, revocable y con vencimiento para el enlace de recuperación. Guardar estado de cotización y archivos ya verificados en servidor. **No enviar adjuntos, tokens de subida privados ni URLs de Drive por WhatsApp.**
- **Activación posterior y opcional:** un solo aviso, sugerido a las 3 horas de inactividad, únicamente si el cliente habilitó recibir recordatorios, sigue sin pagar, no tiene transferencia declarada/pendiente y el carrito aún es recuperable. Verificar otra vez el estado justo antes de enviar, limitar duplicados y respetar baja/oposición. No enviar recordatorios sobre carritos sin contacto válido o consentimiento.
- Un enlace privado abre el mismo carrito hasta su vencimiento; no crear un nuevo pedido al retomarlo, no perder las fotografías/encuadres, PDF, anillados, promociones aplicables (revalidar precios/fechas) ni generar cobros duplicados. Proteger contra acceso ajeno y ataques por adivinación.
- Mensajes iniciados por el negocio en WhatsApp requieren **WhatsApp Business Platform oficial**, permiso previo explícito y plantilla aprobada, con posibles cargos de Meta/proveedor. Un recordatorio comercial de compra abandonada probablemente se evalúe como **marketing**, sujeto a clasificación oficial de Meta; no prometer costos nulos. Evitar automatizaciones no oficiales de WhatsApp Web o extensiones. Como alternativa futura, evaluar correo electrónico autorizado.
- **No contratar servicios ni activar envío** sin aprobación de costos y configuración. Esta fase es diseño de estados y reanudación; el envío automático queda para después de recepción, carrito, Centro de Pedidos y pagos reales.

## Pendiente para producción

Actualmente todavía no hay integración operativa entre estado «entregado», inventario verificado y este motor, y el Centro de Pedidos no puede marcar entregas. **No existe tarea programada ni mecanismo activo de eliminación.** No se ha llamado a APIs de borrado de la cuenta conectada. El borrado definitivo es irreversible; requiere aprobación separada de plazos y validación end-to-end antes de habilitarse.

Referencia: [Ayuda oficial de Google Drive — eliminar archivos](https://support.google.com/drive/answer/2375102).
