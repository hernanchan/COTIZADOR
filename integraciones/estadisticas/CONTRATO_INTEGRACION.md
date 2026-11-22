# Contrato de integración con Workers productivos (sin activar)

## Fuente y límites
Los nombres de los Workers y D1 proceden de `integraciones/publicacion/monitor-postpublicacion-20261112.mjs`. No se dispone aún de una copia verificada del código desplegado ni de su router. Este documento no habilita modificar producción.

## Decisión de arquitectura
1. `saber-documentos-produccion` emite eventos de navegación/cotización **solo** cuando exista base legal y política de privacidad aprobada; nunca recibe permiso para declarar `payment_confirmed`.
2. `saber-pagos-produccion` confirma pedidos y pagos con sus controles actuales. Las métricas de ventas se obtienen de sus registros autorizados.
3. D1 `saber-pagos-produccion` conserva eventos no sensibles en una tabla separada tras migración revisada.
4. El panel `/personal/` consume **solo** agregados desde un endpoint protegido por la sesión del personal y controles actuales del Worker. No exponer una ruta de estadísticas pública.
5. El panel muestra visitas/sesiones estimadas, presupuestos vistos, inicio de checkout, pedidos y pagos confirmados, y pendientes. No confundir abandono con ausencia de pago en una ventana todavía abierta.

## Punto crítico: correlación
El evento de navegador lleva `sessionId` efímero y no identificable. Un pago del servidor **no debe** atribuirse a esa sesión salvo que exista un vínculo explícito, validado y seguro en el flujo de creación de pedidos. Hasta entonces, presentar métricas de pagos agregadas por período separadas del embudo de sesiones. No fabricar tasas de conversión por sesión ni atribuciones de canal.

## Seguridad y calidad
- El cliente nunca puede enviar eventos `order_created`, `payment_confirmed` ni `order_delivered`.
- Verificar autenticación en cada consulta de la Central, no solamente ocultar botones.
- Aplicar control de tasa, tamaño máximo de payload, validación de origen y protección antiabuso en el Worker antes de habilitar ingesta.
- Rechazar cualquier campo extra (teléfono, email, dirección, nombre de archivo, URL con parámetros, etc.).
- Definir consentimiento, retención, eliminación y tratamiento de IP antes de activar.
- Probar en entorno de ensayo y obtener aprobación de PR conforme al contrato de cambios.

## Plan de reversión
Desactivar ingesta y visualización sin afectar la ruta comercial; preservar pedidos y pagos. La migración aditiva no debe borrar datos existentes. Una eliminación posterior de tablas requiere revisión independiente.
