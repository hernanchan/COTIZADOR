# Librería Saber — continuidad posterior a orden 009 (1/11/2026, ART)

## Resultado validado por operador
- El usuario confirmó que un pedido nuevo devolvió **orden N.º 009**, sin inconvenientes visibles.
- Prueba privada anterior: orden N.º 008, 3 PDF recibidos y ZIP confirmado por operador.
- No equiparar esa validación con cobro, autorización de impresión ni despliegue comercial. Las pruebas siguen aisladas.

## Decisión explícita de secuencia
- **No interrumpir el frente funcional para rediseño visual ahora.**
- Anotar y abordar después la experiencia/visual de PC y celular, especialmente resumen compacto, legibilidad de opciones comunes e individuales, ploteos, grupos de anillado, y pantallas de progreso/confirmación.
- El circuito de pedido ya usa un CTA único, número de orden y botón para iniciar otro pedido.
- Conservar el cotizador actual y sus precios: ninguna publicación en `libreriasaber.com.ar` sin autorización específica.

## Nuevo avance funcional posterior a la orden 009
- Documentos A4/A3: selección parcial de páginas (ejemplo `1-3,5`) propagada de carga inteligente -> portal privado -> cliente TUS -> recálculo de servidor -> ficha D1.
- Se guarda y verifica **el PDF original completo**, preservando SHA y número de páginas; solo las páginas elegidas determinan cotización e instrucciones.
- Rangos inválidos y presupuesto desactualizado se bloquean; ploteos con páginas seleccionadas parcialmente permanecen fuera de esta ruta.
- Prueba automatizada con PDF real de ocho páginas, cotización de cuatro, validación de ficha, comprobante y manifiesto.
- CI aprobada: https://github.com/hernanchan/COTIZADOR/actions/runs/41375331090
- Despliegue privado aprobado: https://github.com/hernanchan/COTIZADOR/actions/runs/41375331078
- Worker privado activo versión `96f4fcf4-730c-4343-aa34-c0a2beaa4451`, acceso Basic cerrado (HTTP 401), cobros desactivados, web comercial intacta.
- **Aún falta comprobar selección parcial con interacción real Chrome/Android**. Las pruebas de CI no sustituyen esa aceptación.

## P0 restantes antes de publicar
- Aceptación real de un pedido con páginas seleccionadas, comprobar D1 y ficha/ZIP con páginas correctas.
- Paridad con el cotizador comercial, papeles/materiales/servicios y condiciones de precios, sin cambiar tarifas sin autorización.
- Pago TOTAL de documentos integrado a Mercado Pago de ensayo, importe final servidor, cancelación/reintento, webhook y conciliación, sin habilitar pagos públicos.
- Protección antiabuso de recepción y límites, recuperación tras cierre de navegador, monitorización y gestión de abandonados.
- Central operador con estados de pago, acceso a PDF e instrucciones y bloqueo estricto de pedidos sin pago.
- Prueba real de dispositivos PC/móvil y revisión UX antes del GO/NO-GO comercial.

Prohibiciones vigentes: no despliegue de `main`, no web pública, no cobros reales, no gastos no autorizados.
