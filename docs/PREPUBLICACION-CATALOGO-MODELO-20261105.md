# Catálogo MODELO y preparación de la web comercial — 05/11/2026

**Estado:** Rama privada `integracion/tus-pedido-privado-20261101`, no publicado en web comercial.

## Confirmado en Google Drive
La hoja **Librería Saber · Productos web (MODELO)**, pestaña `Productos`, tiene `gid=419356696`, igual a la URL CSV que usan `vidriera/index.html` y `vidriera/ofertas.html`.
Columnas: `Activo`, `Categoría`, `Producto`, `Descripción`, `Precio`, `Oferta`, `Foto`, `Código`, `Enlace foto (pegá aquí)`.
De las filas verificadas: cuatro activos (tres Escolar, uno Oficina), dos ofertas realmente rebajadas, ninguna Novedad activa. Los cuatro archivos fotográficos tienen permiso público de lectura.

## Trabajo realizado
- La tienda de rama continúa leyendo CSV Google Sheets dinámicamente. Sin cambiar la planilla ni pedir migraciones.
- Se corrigió la regla promocional en `vidriera/index.html` y `vidriera/ofertas.html`: oferta solo cuando `0 < oferta < precio`. Si oferta iguala precio no se tacha ni se usa para filtrar ofertas.
- La vista de diseño SIN contraseña usa una **instantánea fechada** (05/11/2026) del contenido de la hoja MODELO: fotos, nombres y precios SOLO como maqueta sin pedidos ni pagos. No se actualiza en directo, no representa stock validado. Enlace publicitario no se toca.
- Se conserva autenticación privada de cotizador TUS, Central, D1 y pagos.

## Para publicar por etapas
1. Titular confirma que la planilla MODELO refleja artículos y precios que desea vender, o actualiza la misma hoja.
2. Probar en navegador móvil real carga de imágenes/CSV, entradas a categorías y promociones del día; corregir CORS/red si surge.
3. Etapa inicial comercial posible: artículos gestionados por WhatsApp; trabajos gráficos por el cotizador nuevo únicamente cuando sea abierto con controles de seguridad y cobro aprobados.
4. Carrito mixto real es etapa adicional: el legado `saberCartV1` envía WhatsApp y seña, mientras TUS/pagos/Central usa otro modelo; no presentar el carrito único como productivo antes de integrarlo.
5. Nunca modificar `main`, web pública, órdenes, pagos reales ni DNS sin autorización explícita de publicación y validación operativa.

## Verificaciones automáticas reales de hoy
- CI completo sin despliegue `42100108202`: **SUCCESS**. Vista de diseño saneada, pruebas de pedidos y TUS sin regresión.
- Deploy exclusivo del Worker documental de pruebas `42100286530`: **SUCCESS**, versión `3120bd0a-a698-4893-9efa-1883476ad9e1`. Ambas vistas visuales devuelven HTTP 200 anónimo; el cotizador privado sigue HTTP 401 anónimo; bindings preservados.
- Validación de fuente pública Google Sheets en GitHub Actions `42100525880`: **SUCCESS**. HTTP 200 `text/csv`, destino `doc-0o-6s-sheets.googleusercontent.com`, CORS `Access-Control-Allow-Origin: *`, 4 activos, 2 descuentos reales, 5 filas totales. Esto confirma lectura básica desde navegador; **no sustituye una prueba visual en móvil**.
- La preview abierta `/prueba-v2/diseno-sin-clave` y `/prueba-v2/diseno-sin-clave/ofertas.html` ahora muestra artículos y fotografías de la planilla MODELO en una foto fija al 05/11/2026, sin checkout, con aviso de vigencia.
- No se modificó `main`, ni web pública, ni precios de la planilla, ni Central ni pagos reales.
