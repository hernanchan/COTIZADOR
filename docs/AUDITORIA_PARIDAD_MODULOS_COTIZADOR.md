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

## Validaciones por archivo y cierre técnico previo al reensayo — 22/10/2026

- En la carga única, el selector limitado 1/2/3/5/10 copias fue sustituido por **campo numérico libre entre 1 y 500** por PDF, con validación de entero y rango.
- Se corrigió un fallo de grupos de anillado: cuando un grupo tiene sólo un PDF cotizable, uno de sus integrantes sigue sin confirmar tamaño o mezcla tamaños finales/cantidades de copias incompatibles, **todos los participantes del grupo quedan marcados como pendientes**, sin generar subtotal de grupo parcial ni mostrar total general definitivo.
- Se conservan las tarifas vigentes, escalas, materiales y precios de anillados del catálogo; no se cambia producción ni el servicio Polaroids.
- Nuevas pruebas automatizadas: copias 500/501, grupo de un archivo, grupo con un integrante pendiente y grupo con formatos/copias diferentes.
- **CI aprobado:** https://github.com/hernanchan/COTIZADOR/actions/runs/39868014746.
- **PENDIENTE:** despliegue manual del nuevo bundle al Worker privado `saber-documentos-pruebas` y ensayos de navegador con archivos reales. No marcar UX final aprobada; aún falta resolver A5, hojas seleccionadas, fotografías, stickers, corte, gráfica comercial, carrito y validación segura de originales.

## Legibilidad en prueba de navegador — 22/10/2026

- El usuario mostró la nueva carga única con 2 archivos y total preliminar $9.200 ($1.500 A3 de tres páginas + $7.700 ploteo), confirmó el cálculo pero calificó la interfaz de «inentendible» por la escala pequeña, campos amontonados y textos técnicos.
- Corregido en rama privada: área principal ampliada (hasta 1160 px), tipografía y controles más grandes, resumen general destacado, encabezados separando ingreso/presupuesto/configuración, opciones de cada archivo en grilla adaptable a móvil, identificación visible de tamaño original vs salida solicitada y advertencias más claras.
- Importante: **esto es una mejora de legibilidad de ensayo y no aprobación del diseño final**. La UX comercial completa sigue pendiente; evitar volver a dos formularios independientes.
- Pruebas y compilación aprobadas: https://github.com/hernanchan/COTIZADOR/actions/runs/39870272678. No desplegado automáticamente; hace falta actualizar manualmente sólo el Worker privado y ensayar Chrome con zoom 100%.

## Interfaz compacta por archivo — 22/10/2026

- Corrección de diagnóstico del usuario: la captura se tomó con el zoom **reducido intencionalmente** para mostrar todo. El problema real era la **longitud y densidad de formularios**, no el tamaño de fuente.
- La carga única se rediseñó en rama privada como **lista de filas resumidas** (nombre PDF, páginas, tamaño final, B/N/color o papel póster, copias y precio orientativo si es atribuible). Cada fila contiene botón **Editar/Cerrar** y solo **una edición abierta a la vez**; se mantienen decisiones y montos existentes.
- Primera apertura asistida de un archivo nuevo; los documentos A4/A3 homogéneos se preseleccionan en su tamaño original, pero los tamaños mayores o mezclados exigen confirmación expresa. Un anillado agrupado no muestra un precio individual engañoso: se informa como incluido en el grupo.
- Se ajustaron CSS responsive, densidad por fila y resumen general compacto, sin volver al esquema de dos formularios independientes. El catálogo color se completa aunque la fila permanezca colapsada.
- **CI aprobado:** https://github.com/hernanchan/COTIZADOR/actions/runs/39870572985
- Aún **sin desplegar** en el Worker privado y **sin validar la interfaz final en navegador**. No modificar web pública, Apps Script, Polaroids ni pagos. Validación visual y comportamiento con 10 archivos pendiente.

## Caso real 23/10/2026: compilado de 24 planos técnicos A2

- Archivo original del cliente **analizado de forma local, NO subido a GitHub**. Contiene 24 páginas, tamaño aproximado 59,41 × 42,02 cm cada una. Planos de electricidad, montantes, fuerza motriz, iluminación, cortinas y señal débil con trazos magenta/naranja/azul y algunas fotografías/zonas sombreadas.
- Diagnóstico local reproduciendo los umbrales de cobertura en miniatura de 360 px (motor de renderizado equivalente, no resultado PDF.js en navegador): **20 CAD, 3 revisión (3, 5 y 21), 1 falso póster (1)**. Se explica por fotografías y rellenos; no son 24 pósteres. Todas las páginas contienen rótulo técnico con referencia DWG y escala/proyecto.
- Implementado en `refinar-tipo-plano.mjs`: refinar a CAD solo con al menos 4 páginas, mayoría visual CAD >=70%, referencia de rótulos técnicos >=70%, rótulo por página y cobertura menor a 45% para las ambiguas/falsos pósteres. Conserva modo visual previo para diagnóstico y NO cambia casos aislados ni mezclas CAD/Póster de 2 páginas.
- `clasificar-paginas-ploteo.mjs` extrae texto mediante PDF.js **localmente en el navegador**, sin transmitir PDF, y aplica refinamiento después del análisis visual. No cambia precios.
- Tests de rótulo DWG, 24 páginas, mezcla CAD/Póster y póster muy pleno aprobados: https://github.com/hernanchan/COTIZADOR/actions/runs/39955953809
- **No confirmado aún en Chrome con el archivo original**, falta copiar el bundle manualmente al Worker privado y reensayar. Diagnóstico local no es garantía de resultado de PDF.js. El PDF privado no forma parte del repositorio.

## Rectificación de clasificación CAD/Póster — 23/10/2026

- El usuario señaló que el PDF real de 24 páginas incluye páginas que **no deben cobrarse como CAD**. El objetivo correcto es cotización **mixta por página**, no convertir el conjunto entero a CAD mediante votación.
- Se **desactivó del clasificador activo** el refinamiento automático por mayoría CAD+rótulo DWG: una referencia de plano o una mayoría CAD no justifican reclasificar imágenes/plenos. La función experimental permanece aislada sin importarse; su test se retiró del CI principal.
- Mantener el bloqueo de precio para páginas de clasificación incierta hasta tener una heurística discriminativa validada con el usuario. No desplegar el bundle compilado previamente con la regla de consenso. El archivo privado no fue incorporado a GitHub.
- Próxima validación: acordar qué páginas reales son Póster bajo la política de cobro de Librería Saber, y ajustar cobertura de imágenes o áreas plenas **por página**; preservar mezcla CAD/Póster y rollo 42 cuando el ancho físico lo permite.

## Criterio comercial provisional por página — 23/10/2026

- Acuerdo comercial: puede ser razonable cobrar el compilado entero como CAD, pero para una **cotización automática consistente**, el usuario admite **página 1 Póster y páginas 2–24 CAD** como referencia de trabajo. El criterio es subjetivo; no convertirlo en certeza técnica ni en regla de mayoría.
- Ensayo local del PDF privado (24 páginas A2, 59,41 × 42,02 cm). En miniaturas del lado mayor 360px, la superficie ocupada y la proporción de ventanas 13×13 densamente cubiertas dieron: página 1 cobertura 30,4%, pleno continuo 10,7%; página 3 29,3%/5,6%; página 5 17,9%/2,4%; página 21 19,1%/2,5%. El PDF privado permanece fuera de GitHub.
- Nueva `regla-comercial-ploteos.mjs`, incorporada al análisis de páginas, **sin mayoría del documento**. Para una página con rótulo técnico verificado por texto PDF.js: superficie continua desde 8,5% → Póster; las páginas visualmente dudosas con pleno continuo hasta 6,5% y cobertura total hasta 30% → CAD. Las páginas entre umbrales quedan con su clasificación previa o requieren revisión; un póster ya reconocido no se abarata a CAD solo por DWG.
- Los umbrales son **hipótesis iniciales calibradas con este ejemplo**: no confundir con 30% de fotografía real. Falta compararlos con más PDF y verificar la extracción de rótulos de PDF.js en Chrome. No cobrar automáticamente todavía.
- Se conserva el rollo de 42 cm con tolerancia física actualmente vigente; precios intactos.
- CI de pruebas automáticas: https://github.com/hernanchan/COTIZADOR/actions/runs/39960021762 — aprobado.
- **No desplegado** en Worker privado; no modificar sitio público ni autorizar pagos hasta reensayo.

## Política comercial definitiva para dudas visuales — 23/10/2026

- Decisión explícita: **si la página no satisface claramente los criterios de Póster, se cobra como CAD**, aunque el clasificador visual hubiera marcado `revision`.
- Implementado en `regla-comercial-ploteos.mjs`: un resultado `revision` con métricas válidas pasa a `cad`, tanto con rótulo técnico como sin él. Una página positivamente clasificada como `poster` conserva ese modo; una señal de superficie continua suficiente en plano técnico también puede justificar Póster.
- **Importante:** si no pudo leerse/renderizarse el PDF o faltan métricas numéricas fiables, NO se inventa la clasificación ni un precio. Errores técnicos siguen bloqueados.
- La política se aplica **por página**, no por votación del PDF; conserva trabajos mixtos CAD/Póster. Precios y selección automática de rollos sin modificaciones.
- Pendiente reensayo del compilado de 24 páginas en Chrome después de actualizar manualmente el Worker privado. No activar pagos ni publicar producción.

## Selección de páginas por PDF en carga única — 23/10/2026

- Se añadió en la ficha colapsable de cada PDF el campo **Páginas a imprimir (vacío=todas)** con rangos como `1-3,5`. Atiende al caso real de un PDF de siete páginas del que el cliente pide solo tres.
- `seleccionar-paginas.mjs` valida números, rangos, duplicados, límites y entrada malformada; conserva el orden original y no transforma el PDF del usuario.
- `/api/ensayo-carga-unica` recibe `paginasSeleccionadas` opcional (compatibilidad con clientes anteriores). Calcula documentos, ploteos, destino final y materiales usando **solo páginas seleccionadas**, preserva en el `plan` las numeraciones originales que deben imprimirse. Para precio de ploteos la numeración se normaliza internamente, manteniéndose `paginasElegidas` como fuente de instrucciones de producción.
- Pruebas unitarias de 1-3 de siete, mezcla de rangos, selección de todas y validaciones. **CI compilado correcto:** https://github.com/hernanchan/COTIZADOR/actions/runs/39961873096
- Este cambio no corta, elimina ni manda el PDF original. **Todavía no existe recepción verificable del PDF de origen ni emisión de archivo listo para imprimir.** Es presupuesto preliminar, paymentAuthorized=false. No desplegado automáticamente a Cloudflare.
