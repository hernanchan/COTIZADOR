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

## 04/11/2026 — Fase 1 instalada en Workers privados; aceptación humana aplazada
- **CI completo** `41941608715` y CI de despliegue `41941744034`: ambas **SUCCESS**. CI incluyó `tests/tus-plazos-preparacion-privada.test.mjs`, 191/191 pruebas en primer grupo, 0 errores; además 96+4+3 grupos adicionales sin errores.
- **Central** `saber-pagos-pruebas` activada por GitHub Actions `41941744134` **SUCCESS**, nueva versión `28f0fceb-b897-4fc3-ae0a-a440dcb34f89` (anterior `309d2794-f642-4594-a524-6c7cac93de76`), HTTP 401 administrativo y health OK, `paymentsEnabled=false`.
- **Documentos** `saber-documentos-pruebas` activado por GitHub Actions `41941744037` **SUCCESS**, nueva versión `9f6e5c70-596d-449c-a485-0ca5e8ef5930` (anterior `a0b920e1-002e-4082-a318-a76e79da4c63`), HTTP 401 sin autenticación, tarifa A4 B/N $100 y póster recubierto 60 cm $18.700 D1 comprobados, cobros reales OFF.
- El nuevo plazo **es manual/provisional**, no un pronóstico automático por cola. No se pidió al usuario repetir las pruebas de transferencia/MP ni se probó desde Android por la contraseña de acceso privada; esa aceptación queda pendiente. No usar esto como evidencia de experiencia de cliente real.
- Commit de activación: `efde4258a019c3069974048e359adfc6cbaa1b0e`. `main`, web pública, pagos comerciales, precios y TUS existentes intactos.
