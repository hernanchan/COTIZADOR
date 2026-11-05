# Ensayo de mensaje de pedido de productos — 05/11/2026

El usuario confirmó el funcionamiento de botones de agregar, modificar cantidades y carrito V3.
Se implementa el siguiente paso **únicamente en la vista de diseño sin contraseña**:

- Desde el carrito con artículos, botón «Preparar pedido para WhatsApp (prueba)» genera un resumen en texto: nombre y código del producto, cantidad, subtotal, total orientativo y solicitud de verificación de disponibilidad y precio.
- El texto se presenta dentro del carrito, sin envío y sin enlaces externos.
- El envío real de pedido se mantiene explícitamente desactivado.
- Se prepara desde el catálogo estático MODELO al 05/11/2026 (no stock/precios finales ni actualización en vivo).
- Los cambios de cantidad invalidan el texto anterior y exigen reconstruir el resumen.
- Quedan sin modificar precios reales, Google Sheets, cotizador TUS, Central, D1, pagos y web pública.

**Para habilitar compras:** validar el catálogo productivo y el circuito de WhatsApp con precios actuales, sin presentar esta simulación como venta.

## Verificación final
- Confirmado por el usuario: «sí, sí, todo ok» en prueba previa del carrito (agregar, cantidades, quitar y total).
- Nuevo resumen de compra ensayado con JS compilado y sintaxis de scripts emitidos verificada en CI `42107414732` (SUCCESS).
- Deployment del Worker exclusivo de pruebas `42107487850` (SUCCESS), versión `fa88182c-beb3-4858-8e90-5a58c30e4dea`; portada/ofertas 200 anon y cotizador privado 401 anon. Foto catálogo 200.
- Botón de enviar sigue deshabilitado, sin transacciones, WhatsApp ni cambios a `main`.
