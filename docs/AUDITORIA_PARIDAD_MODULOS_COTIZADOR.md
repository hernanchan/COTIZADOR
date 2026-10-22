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

## Avance técnico posterior — ingreso único y tamaño final (rama privada)

- Nueva ruta de ensayo `/prueba-carga-unica`: un solo selector para hasta 30 PDF, detecta tamaño físico por página localmente (CropBox, rotación, UserUnit), presenta medidas originales y exige elección explícita del tamaño de salida por archivo: original, A3, A4 o A5.
- `destino-impresion.mjs` diferencia original de destino comercial: un A2 elegido A4 se deriva a documentos, no a ploteo; si conserva A2 se deriva a ploteos. Cuando hay reducción, informa ajuste proporcional sin recortes y advierte verificar legibilidad/escala de CAD. PDF con tamaños mixtos queda señalado.
- **Alcance limitado:** esta pantalla **no calcula ni suma precios**, no transfiere archivos, no clasifica CAD/Póster, no arma carrito ni habilita pedidos/pagos. Es el primer componente aislado del flujo único, no reemplaza el cotizador conjunto existente ni equivale a la integración final.
- Pruebas de decisión A2→A4, tamaño original, tamaños mixtos y ausencia de checkout incluidas en CI. Último resultado: https://github.com/hernanchan/COTIZADOR/actions/runs/39864235650
- Pendiente siguiente: integrar selección final al motor de precios correspondiente (documentos/ploteos), después unir la carga de archivos con todas las familias comerciales, revalidación segura en servidor y confirmación de escala/recortes antes de producción.
- Únicamente la rama privada fue modificada; falta despliegue manual del bundle en `saber-documentos-pruebas` y validación de navegador. Producción, Apps Script, Polaroids y pagos sin cambios.

## Conexión preliminar de motores con la carga única — 22/10/2026

- `/prueba-carga-unica` ahora posee controles básicos por PDF (tamaño final, copias, B/N o color y caras para documentos; papel póster en ploteos) y presenta presupuesto conjunto provisional.
- Endpoint privado `/api/ensayo-carga-unica` llama sin duplicar tarifas a `cotizarDocumentosIndividuales` y `cotizarPloteosRapido`. Las páginas PDF se leen localmente; CAD/Póster se clasifica localmente con PDF.js. Los importes aún no tienen revalidación de originales.
- A2→A4 se deriva a impresiones A4; A2 tamaño original se deriva a ploteo con rollo automático. El total solo aparece completo cuando todos los archivos son cotizables.
- Fallan cerrados: A5 (sin tarifa diferenciada confirmada), originales que no son homogéneamente A4/A3 y no exceden A3, páginas CAD/Póster no clasificadas; figuran como pendientes, sin total definitivo.
- **Limitación expresa:** primera integración usa obra estándar para documentos, sin selector completo de materiales ni anillados en esta nueva interfaz. Copias UI iniciales disponibles 1/2/3/5/10. Falta igualar íntegramente el módulo actual y optimizar el diseño final. La calculadora original de impresiones sigue intacta.
- La API exige JSON desde mismo origen; `paymentAuthorized:false`. No recibe ni guarda archivos, no confirma producción, no activa pagos, pedidos ni carrito.
- Pruebas de A2→A4, tamaño original de ploteos, casos pendientes y suma conjunta: https://github.com/hernanchan/COTIZADOR/actions/runs/39865061133 (CI aprobado).
- **Despliegue pendiente:** nuevo bundle en GitHub, todavía no copiado al Worker privado. No tocar web pública, `main`, GAS ni Polaroids.

## Integración de materiales y anillados — 22/10/2026

- En `/prueba-carga-unica` las impresiones color permiten seleccionar materiales desde el endpoint del catálogo comercial `/api/ensayo-materiales-rapido`, separados por A4/A3. No se codifican precios en el navegador ni se ofrece un material que no exista en el catálogo del formato.
- Se agregaron **sin anillado**, **anillado individual por archivo** y **anillado en grupo** (grupos 1 a 5, requiere varios documentos compatibles); los subtotales utilizan el motor existente `cotizarDocumentosIndividuales` y las tablas `bindings`.
- La API valida material, tamaño, modo y grupo antes de calcular. Material color incompatible queda **pendiente, sin total global**. Precio y reglas existentes sin modificaciones.
- La vista previa distingue subtotal de impresiones/ploteos y subtotal de anillados incluido en el total de documentos, sin duplicarlo.
- **Limitaciones todavía abiertas:** selección de copias en cinco valores predefinidos; falta campo numérico completo. B/N sigue vinculado a su soporte estándar. A5 sin tarifa propia. Revisión de combinación de grupos de anillado frente a archivos que quedaron pendientes. No recibe originales ni permite pagos.
- Pruebas automáticas aprobadas para color A4/A3, rechazo de materiales incorrectos y anillados separados/juntos: https://github.com/hernanchan/COTIZADOR/actions/runs/39866053141
- El bundle actualizado permanece en GitHub (rama de pruebas); **NO está desplegado en Cloudflare**. Producción sin cambios.
