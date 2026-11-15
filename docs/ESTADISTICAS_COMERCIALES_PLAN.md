# Estadísticas comerciales — diseño de implementación (15/11/2026)

Estado: preparación en rama aislada. NO desplegado.

## Objetivo
Mostrar en la Central de Pedidos un panel privado con visitas, inicio y finalización de cotizaciones, pedidos iniciados, pagos verificados y abandono por etapa.

## Principios
- No tocar lógica de precios, archivos, pago ni estados de producción.
- No contar como venta una declaración del cliente: solo pago confirmado por backend.
- Distinguir visitantes, sesiones y eventos; no sumar eventos como si fueran personas.
- No almacenar nombres, teléfonos, direcciones, nombres de archivo, contenido PDF ni datos bancarios en telemetría.
- No incluir identificadores sensibles en URLs de analítica.
- Respetar consentimiento y política de privacidad aplicables; definir retención antes de activar.
- Los eventos del navegador son orientativos (bloqueadores, cierres y pérdidas de red); las ventas verificadas salen de registros del servidor.

## Eventos propuestos
| Evento | Fuente | Significado |
|---|---|---|
| page_view | navegador | Página visible |
| quote_started | navegador | Primer paso de cotización |
| upload_started | navegador | Inicio de carga |
| upload_completed | navegador | Carga verificada |
| quote_viewed | navegador | Precio presentado |
| checkout_started | navegador | Inicio de confirmación |
| payment_method_selected | navegador | Medio seleccionado |
| order_created | servidor | Pedido creado |
| payment_confirmed | servidor | Cobro validado |
| order_delivered | servidor | Pedido entregado |

Abandono: sesión con quote_viewed o checkout_started sin payment_confirmed dentro de una ventana configurable; mostrar por separado pendientes y pagos fallidos.

## Arquitectura pendiente de comprobar
1. Localizar el código real del Worker de pedidos y el panel de Central.
2. Identificar D1 y rutas existentes; evitar una segunda base de pedidos.
3. Crear migración aditiva de eventos y agregados diarios, con índices y política de retención.
4. Crear endpoint de ingesta limitado y endpoint agregado protegido por la autenticación actual de la Central.
5. Añadir pestaña Estadísticas con filtros Hoy / 7 días / 30 días y embudo.
6. Pruebas: deduplicación, no PII, autenticación, mobile, regresión de pagos, carga y pedidos.
7. PR con Motivo, Alcance, Pruebas y Retroceso. Autorización del titular según contrato antes de fusionar.

## Estado verificado
- Repositorio: hernanchan/COTIZADOR.
- Rama base: main.
- En producción se redirige desde vidriera/cotizar.html hacia https://pedidos.libreriasaber.com.ar/cotizar mediante portal-comercial.json.
- Código backend y panel privado todavía no identificados. No implementar endpoints inventados.
