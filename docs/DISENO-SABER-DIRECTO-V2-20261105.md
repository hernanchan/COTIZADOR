# Saber Directo V2 — Revisión estética editorial (05/11/2026)

El titular evaluó la primera versión como «más o menos», precisando que el problema es **la estética general**, no el orden del recorrido ni los pagos.

## Cambio propuesto
- Portada rediseñada como **identidad editorial de librería y gráfica**. Titular grande Manrope en marfil, contraste azul/naranja y rejilla de proporciones.
- Estampa gráfica de papeles, cuaderno, hoja cuadriculada, colores y lápiz construida con HTML/CSS (no simula fotos del comercio ni usa fotografías de stock genéricas). Elemento visual para dar materialidad al servicio.
- Promoción dinámica conservada en origen, pero ahora se ve en franja horizontal azul, cerca del comienzo. IDs únicos `promoDay`, `promoTitle` y `promoText` preservados.
- Cuatro servicios dispuestos como listado editorial, sin cuatro tarjetas redondeadas repetidas.
- Categorías simplificadas a pestañas rectangulares con jerarquía tipográfica; contenido y selección del catálogo intactos.
- La vista **sin contraseña** agrega dos tarjetas ilustrativas de muestra por categoría, sin precios, sin conexión al catálogo ni funciones comerciales. No afirma que exista stock ni promociones específicas.
- Se conservan logo, horarios, texto de contacto, productos CSV existentes en versión funcional, carrito histórico, WhatsApp y Polaroids **en el código de rama**; estas funciones siguen retiradas de la demostración sin clave.
- Se conservan tests de integridad y privacidad del Worker; no cambiar `main`, precios, D1, TUS, Central ni pagos reales.

## Estado
Código V2 en rama `integracion/tus-pedido-privado-20261101`. **Pendiente CI y despliegue en la misma ruta pública de solo diseño**. El titular debe aprobar por criterio visual luego de revisarla.

## Activación privada verificada
- CI específico de rama `42074377032` SUCCESS tras corregir selector de cabecera para preservar el contrato `class="hero hero-direct"`.
- Despliegue en Worker documental de pruebas: ejecución `42074482001` SUCCESS, versión activa `2e8d1085-d277-4797-b549-c17cc94927ef`.
- Nueva portada estética accesible sin contraseña en `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/diseno-sin-clave`. La página de ofertas del prototipo sigue en `.../diseno-sin-clave/ofertas.html`.
- HTTP real de ambos prototipos devuelve 200 sin credenciales; `/prueba-v2/` continúa 401 anónimo; HTML saneado sin funciones de compra ni datos privados.
- Para la revisión del titular: mirar especialmente el titular, composición de papeles, barra de ofertas, accesos de servicio y tarjetas ilustrativas. Una vez recibido feedback, ajustar estética sin cambios operativos.
