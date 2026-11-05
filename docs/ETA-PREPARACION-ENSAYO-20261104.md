# Plazo estimado de preparación — piloto privado 04/11/2026

## Alcance fase 1

La Central ya tiene cola de producción y estados `pendiente`, `en_preparacion`, `en_espera`, `listo`, `entregado`. Esta primera implementación **no inventa la duración de un trabajo** ni promete fechas basadas solo en páginas/precio.

- El operador abre **Detalle** de una orden documental con pago D1 confirmado y validado en `payment_reviews`, indica responsable, fecha y hora **de Córdoba (UTC-03)**, y confirma. Rango de 5 minutos a 45 días. La fecha se muestra como **provisional**.
- Se guarda en tablas D1 aisladas `central_preparation_estimates` (fecha, versión, responsable, motivo, actualización) y `central_preparation_estimate_events` (historial inmutable de ajustes por versión).
- Al **postergar o quitar** una estimación previamente comunicada se exige un motivo de al menos cinco caracteres. La escritura compara la versión D1 (control de concurrencia) y exige que el pago siga verificado.
- La Central refleja la estimación en el tablero y en el detalle; no permite asignar nuevas fechas a órdenes `listo` o `entregado`.
- El recibo del cliente consulta el mismo estado HMAC vinculado a tres identificadores, a través del Worker documental, y solo recibe `preparacionEstimada.readyAt` cuando el **pago está acreditado y el pedido sigue pendiente/en preparación/en espera**. Lo presenta como provisional, hora local de Córdoba. Nunca anuncia una fecha en transferencias sin acreditar, pagos revocados o impagos.
- Ninguna fecha habilita cobros, impresión, distribución, delivery ni cambia el importe; el acceso sigue restringido al panel privado.

## Pendiente para la fase 2 automática

Diseñar y calibrar tiempos por servicio y capacidad real: A4/A3 B/N/color, impresoras disponibles, páginas/caras/copias, anillado (incluido conjunto), CAD vs póster, stickers/fotos, revisión especial. Agregar agenda operativa configurable desde la Central: horario y feriados/cierres, turnos y pausas, carga de órdenes **pagadas verificadas** y capacidad; no contar carritos sin pago o transferencias pendientes. Recalcular ETA cuando cambie la cola, detectar incumplimientos, notificar cambios; separar tiempo de preparación de tiempos de reparto. Solo publicar valores calibrados con tiempos reales, nunca una promesa inventada.

## Estado de aceptación

Código de fase 1 limitado a rama `integracion/tus-pedido-privado-20261101`, `main` y web comercial intactos. No hacer pagos ni repetir pedidos históricos. **Las pruebas humanas desde Android quedaron aplazadas**; el sitio documental privado utiliza HTTP Basic `operador` y una contraseña independiente que el titular no recuerda. No almacenar secretos, no desactivar la protección ni pedir nuevos ensayos hasta que desee retomarlos.

Referencias: `tests/tus-plazos-preparacion-privada.test.mjs`; `integraciones/mercadopago/pruebas/worker.js`; `integraciones/autocotizador/recepcion/tus-pago-sandbox-cliente.mjs`; `integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs`.
