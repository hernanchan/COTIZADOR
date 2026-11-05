# V3 retail fotográfica — 05/11/2026

Estado: **implementación en rama de pruebas, NO publicada**.

Objetivo acordado: presentación comercial tipo retail con productos visuales y **el mismo protagonismo para impresiones**; priorizar proceso de impresión ya probado y dar nueva fuerza al catálogo de librería.

## Fuentes y alcance
- `vidriera/index.html`: reemplazado hero ilustrado por dos paneles fotográficos de similar prominencia: productos y cotización. CTA `#categorias` y CTA `cotizar.html`; en vista protegida CTA cotizador se dirige a `/prueba-v2/`.
- Fotografías Unsplash bajo licencia gratuita, usadas como AMBIENTACIÓN ILUSTRATIVA (no como fotos del negocio ni stock a la venta). Fuentes: Unsplash / Volodymyr Hryshchenko `7_bz84zOU7g`; Thingsneverchange `k1WVgtr2zDA`; Jess Bailey `jnzbRcYUdd0`, `qTTj5u_ZoAo`; Mediamodifier `vJ-zmwPZQ0o`; aceofnet `SAjMYUuCFm4`; American Jael `OEvLi8LM7cc`. Se deberían sustituir por fotos propias de productos y trabajos de Saber antes de promocionar la web ampliamente.
- Cuatro tarjetas de categorías con fotos, promoción dinámica conservada, sección de catálogo CSV y carrito histórico intactos.
- Enlace sin contraseña muestra fotos + ejemplos de sección sin precios, sin carrito, sin consulta CSV ni pedidos. Sanitización del helper se mantiene: elimina todo JS comercial y formularios, neutraliza enlaces de compra y WhatsApp.
- CSP del único preview sin clave actualizado únicamente para autorizar imágenes `images.unsplash.com`. Sigue `connect-src 'none'`.
- Test V3 agregado al contrato histórico. La Central, TUS, D1, pasarelas, precios y main no se modifican.

## Antes de salida pública
1. Validar fotografía y distribución real móvil/desktop.
2. Revisar y conectar de forma coherente catálogo/precios, promociones, carrito, checkout integral sin seña antigua; no publicar promesas de un carrito unificado que todavía no está implementado.
3. Confirmar identidad de fotos de productos reales y disponibilidad, calidad de imágenes.
4. Hacer lista de verificación prepublicación y acordar la puesta en producción. **No habilitar pagos reales por cambios cosméticos.**
