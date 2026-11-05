# Corte de prepublicación V3 — 05/11/2026

**Aprobación del titular (navegador):** carrito con agregar/quitar/cambiar cantidades y total; fotos de productos corregidas; lectura en vivo de Google Sheets; resumen y consulta de WhatsApp. Última confirmación: «todo ok».

**Sitio en producción:** `libreriasaber.com.ar` muestra todavía la tienda anterior. `vidriera/index.html` mantiene `saberCartV1`, seña para impresiones y envío conjunto por WhatsApp. `vidriera/cotizar.html` incrusta cotizador anterior por `iframe`, no el TUS nuevo.

**Sitio aprobado en ensayo:** `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/diseno-sin-clave`.
- V3 fotográfica con producto e impresión protagonistas.
- `GET /prueba-v2/diseno-sin-clave/catalogo.json`: lectura pública, solo CSV de Google Sheets, sin datos privados ni escritura.
- Carrito V3 con precios revalidados antes de generar consulta WhatsApp. No se envía mensaje automáticamente; no se reserva ni cobra.
- Cotizador TUS nuevo: permanece protegido en `/prueba-v2/`, no expuesto a clientes.
- Despliegue verificado en rama `integracion/tus-pedido-privado-20261101`: GitHub Actions `42110521555`, Worker `fe03703f-7757-4b33-a84c-f1a7cac2c3b2`.

## Confirmación del catálogo
Se buscó en el Google Drive conectado por «productos», «precios», «inventario», «catalogo». Solo se encontró como catálogo web pertinente la hoja **«Librería Saber · Productos web (MODELO)»**, identificador `1KowCxlQ0mZC1L1xYD7hvhKiJ9PDRnZnxRtIDVzK6JuM`. Tiene cuatro activos en el rango verificado y dos ofertas reales. **No tratar el contenido MODELO como inventario comercial completo autorizado.**

## Orden técnico de salida
1. **Catálogo comercial:** confirmar/ajustar en la planilla los artículos que realmente se ofrecen, precios y fotos. Mantener el origen Sheets sin duplicar datos ni construir otro administrador.
2. **Publicación del cotizador nuevo:** diseñar liberación controlada de TUS para clientes, protección antiabuso, límites y recuperación, pago/transferencia realmente conciliados, acceso de operador e integridad de archivos. Sin exponer `/prueba-v2/` por simple vínculo.
3. **Integración de página:** cambiar las entradas «Cotizar impresiones» a la ruta realmente aprobada; retirar promesas de carrito mixto y referencias a seña del 50% en la V3. Los productos pueden continuar por consulta WhatsApp inicialmente.
4. **Verificaciones:** móvil y escritorio, Sheets/CSV y miniaturas, navegación/CTA, pruebas de impresión, pedido pagado y Central, horarios, privacidad, SEO y rollback.
5. **Activación comercial:** únicamente después de los puntos anteriores y decisión explícita del titular. No realizar despliegue `main`, DNS, Pages ni cobros productivos automáticamente por este documento.

## NO-GO actual
- Catálogo conectado está etiquetado **MODELO** y no validado como final por el usuario.
- Cotizador nuevo aún exige autenticación privada.
- Página pública antigua sigue con el mecanismo de seña y cotizador anterior.
- No existe un carrito mixto V3 real que genere pago y orden única en D1; prohibido venderlo como integrado.

**Conclusión:** diseño y carrito de productos V3 aprobados en pruebas. **No está autorizado/terminado el lanzamiento comercial.** Evitar rehacer o volver a probar funciones superadas; concentrarse en cerrar estos bloqueos para publicar.
