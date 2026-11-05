# Carrito de artículos V3 — ensayo sin pedidos — 05/11/2026

Se implementó un carrito **interactivo y aislado** en el preview sin contraseña `/prueba-v2/diseno-sin-clave` y `.../ofertas.html`.
- Botón **Agregar al carrito** en cada producto de la maqueta del catálogo Google Sheets MODELO.
- Encabezado y acceso flotante «Carrito» con contador y cajón lateral.
- Aumentar/disminuir cantidad, eliminar, subtotal por renglón y total.
- Persistencia entre ambas páginas mediante `sessionStorage`, exclusivamente códigos y cantidades, sin datos personales.
- Sin solicitudes de red nuevas (`connect-src 'none'`), sin WhatsApp, sin Mercado Pago, sin crear pedidos. El botón «Enviar pedido» está desactivado y dice «próximamente».
- Los precios de los cuatro artículos son una instantánea de la hoja MODELO al **05/11/2026**. **No son precios de venta verificables de forma dinámica** en este preview; el catálogo comercial aún lee Google Sheets en directo.
- Se conserva la sanitización que elimina por completo scripts originales, carrito anterior, WhatsApp, datos sensibles, y atributos `onclick`.
- Al lanzar: confirmar inventario/precios, definir checkout por WhatsApp de artículos con revalidación, y activar ruta de venta solo con aprobación. **No publicar este demo como tienda productiva**.

El cotizador TUS, Central, pagos, D1, `main` y la web pública no se tocan.
