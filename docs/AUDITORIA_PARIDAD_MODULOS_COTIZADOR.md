# Auditoría de paridad funcional del cotizador — 22/10/2026

**Objetivo obligatorio:** la nueva web no podrá reemplazar el cotizador vigente perdiendo servicios, materiales, escalas, promociones ni funcionalidades de pedido. Mantener los módulos existentes y mejorar el flujo de archivos.

## Fuente de comparación verificada en GitHub
- `main:vidriera/cotizar.html` incrusta `https://hernanchan.github.io/COTIZADOR/cotizador-web-v2.html?integrado=1`.
- `main:cotizador-web-v2.html`: catálogo de seis familias, calculadoras, carrito e integración con tienda.
- `main:precios-web.json`: escalas y materiales de documentos A4/A3, fotos, stickers, anillados, ploteos y ploteo de corte.
- `main:config.json` y `main:app.js`: modelo previo complementario de servicios y promociones; **no confundirlo con la pantalla pública activa**.
- Rama de desarrollo: `cotizador/migracion-carga-archivos-20261018`.

## Matriz de paridad (no implica terminación)

| Familia visible hoy | Capacidades actuales identificadas | Estado en nueva rama |
|---|---|---|
| Impresiones | A4/A3, B/N y color, papeles comerciales, simple/doble, copias, anillado | **Parcial**: motor local y escala/grupos presentes; auditar paridad de opciones y flujo de producción |
| Fotografías | Papel normal y Luster, 10×15, 13×18, A4, A3, Polaroid 6/A4 y carnet según catálogo | **Pendiente**: no integrado al cotizador rápido; Polaroids es proyecto separado y su activación sigue restringida |
| Stickers | Planchas A4/A3 en adhesivo fotográfico con precorte, cantidades y escalas | **Pendiente** |
| Ploteos | CAD/póster, papel obra y recubierto, tamaños, metros, rollos y cantidades | **Parcial avanzado**: clasificación y precios preliminares validados con ejemplos reales; falta tamaño final confirmado y carga/recepción integradas |
| Ploteo de corte | Variantes de vinilo/corte del catálogo, metros, mínimo comercial | **Pendiente** |
| Gráfica comercial | Tarjetas personales, recetarios y folletos; variantes y cantidades | **Pendiente** |

## Funciones comunes obligatorias de paridad
- [ ] Carrito único entre servicios y artículos de la tienda, conservación de ítems, edición/eliminación y total.
- [ ] Promociones por día y cupones manuales con alcance/compatibilidad correcta; auditar respecto de producción antes de reutilizar reglas.
- [ ] Integración comercial WhatsApp y seña/pago conforme flujo autorizado (NO activar en pruebas).
- [ ] Escalas por cantidad, mínimos, redondeos, materiales disponibles e incompatibilidades por servicio.
- [ ] Instrucciones claras para producción por archivo y por página, incluyendo anillados agrupados.
- [ ] Fotos: líneas, tamaños, precios por cantidad, carnet y conexión futura con editor Polaroids, sin modificarlo.
- [ ] Guardar tamaño original del PDF **y** tamaño final elegido por el cliente; jamás forzar ploteo solo por tamaño original, permitir reducción A2→A4 y alerta de escala en planos CAD.
- [ ] Ensayar combinaciones multirrubro y móvil antes de pasar a producción.
- [ ] Validar originales recibidos en servidor antes de cobrar, con centro de pedidos privado.

## Restricciones
No modificar `main`, la web pública, Apps Script, Polaroids ni pagos. No contratar servicios ni habilitar cobros. Solo rama de pruebas y Worker `saber-documentos-pruebas`.

**Criterio de aceptación:** no dar por concluida la nueva web hasta comparar los seis módulos y sus subopciones contra el cotizador público activo y validar importes y carrito con ejemplos representativos. La UI conjunta actual basada en dos superficies embebidas es únicamente un prototipo técnico; no constituye interfaz final.
