# Bloc de pendientes — Cotizador rápido de Librería Saber

Registrado el **22 de octubre de 2026** a pedido del titular, a partir de pruebas reales del cotizador preliminar con múltiples PDF.

> Estado del bloc: **pendientes**. No confundir estas notas con funcionalidades existentes o terminadas.

## Avance técnico — 22/10/2026

- **Precio arriba implementado en rama privada de pruebas, sin desplegar:** cabecera `#resumenRapido` con total preliminar, desglose resumido y estados `pendiente / calculando / listo / error`. Usa `position: sticky; top:0`, tamaño compacto para móviles, y descarta el precio viejo al modificar el pedido. **Pendiente:** validación visual y funcional real en PC/móvil con 20–30 PDF antes de marcar la tarea completamente aceptada.
- **Leyenda de tiempos completada en código, aún sin desplegar:** se quitaron los milisegundos visibles del mensaje de presupuesto y de la lectura local. La medición técnica no se muestra al cliente; no se alteraron las fórmulas ni descuentos.
- **Validación:** pruebas automáticas y compilación aprobadas: https://github.com/hernanchan/COTIZADOR/actions/runs/39764881324. Compilado `integraciones/autocotizador/recepcion/dist/saber-documentos-cotizador-fase4.mjs`.
- **Sin intervención:** precios y descuentos, papeles vigentes, ploteos, Drive/Apps Script, checkout, Polaroids y sitio público.

## Incidencia A3 color detectada por el usuario — 22/10/2026

- **Síntoma real en Cloudflare:** tras cambiar un único PDF a **A3 color**, la barra superior mostraba `Sin precio`. El cotizador actual ya resuelve ese trabajo; no es falta de tarifas.
- **Causa confirmada en código:** el prototipo reutilizaba los valores `obra70`, `obra140` y `obra180` propios de Color A4 para Color A3, cuyos IDs reales son `a3_color_obra80`, `a3_color_obra140`, etc. La validación del servidor rechazaba el material incompatible.
- **Corrección en rama privada:** nuevo endpoint `GET /api/ensayo-materiales-rapido` devuelve sólo IDs/nombres/familias A4/A3 del `precios-web.json` **ya existente**; el navegador llena los selectores por formato y cambia a un papel admitido al pasar de A4 a A3. No se editaron tarifas comerciales. Se conserva el formato del payload B/N esperado por el validador.
- **Prueba automatizada:** caso A3 color con papel real correcto; prueba de rechazo de ID A4 colocado en A3; catálogo con opciones comerciales completas A4 y A3.
- **Estado:** corrección en código, pendiente de desplegar de nuevo el Worker aislado y probar en navegador con PDF real. No marcar resuelta en operación hasta que el usuario lo compruebe.

## Avance de Ploteos — 22/10/2026

- **Implementado en código y probado automáticamente; NO desplegado todavía en Cloudflare.** Página privada `/prueba-ploteos-rapido`, con acceso desde `/prueba-cotizador-rapido`, y API de pruebas `/api/ensayo-ploteos-rapido`.
- Catálogo de rollos y tarifas CAD/póster tomados **sin editar precios** del módulo `plotter` de `precios-web.json`: rollos 42/60/90 cm y recubiertos 60/90 cm. Se solicitan medidas finales en centímetros, orientación automática para ajustar ancho, material y copias por archivo; valida anchos que excedan el material y calcula metros lineales con redondeo configurado.
- **Límite importante:** el PDF se elige para identificar el trabajo, pero la aplicación **todavía no obtiene el tamaño de impresión del PDF**. Las medidas las declara el cliente y el precio es **orientativo sin verificación**. No se envían PDF ni se habilitan cobros.
- **Pendiente para integración comercial real:** medición fiable de tamaños finales PDF/CAD y múltiplos de páginas, confirmación de recortes/orientación según el ploteo real, compatibilidad con el módulo vigente, unificación de ploteos + copias en un mismo carrito, recepción protegida y verificación previa al cobro. Por ello **no marcar el módulo completo como finalizado**.
- Prueba CI: https://github.com/hernanchan/COTIZADOR/actions/runs/39770857048. Compilado para copia manual en Worker privado `saber-documentos-pruebas`. No web pública.

## Detección automática de tamaños PDF para Ploteos — 22/10/2026

- **Implementado en código, CI aprobado, NO desplegado en Cloudflare todavía.** El cliente carga sus PDF, el navegador lee las dimensiones reales de **cada página** con `pdf-lib`, incluyendo `CropBox`, rotación 90/180/270 y factor `/UserUnit`, sin subir los originales. Dejan de existir los campos manuales ancho/alto.
- Las fichas muestran formatos detectados, material de rollo compatible, tipo CAD/póster y copias. Se excluyen rollos demasiado angostos y se suman los **metros lineales por página** dentro de un PDF multipágina. Tarifas `plotter` desde `precios-web.json`, sin alterar precios, únicamente cálculo orientativo.
- Caso probado: PDF multipágina con página rotada, A2 + A0 sobre rollo 90; se rechaza rollo 60 cuando no alcanza el ancho. CI https://github.com/hernanchan/COTIZADOR/actions/runs/39773141663.
- **Pendiente:** verificar el tamaño con el PDF original **recibido en servidor** antes de pagar o imprimir, y confirmar con el usuario que la presentación y los metros coinciden con la práctica de Librería Saber. Para PDF con escala de diseño distinta a tamaño físico deseado o imposición especial, se requerirá una opción de escala/corte, no presupuestar silenciosamente.
- Todo aislado en `/prueba-ploteos-rapido`; no publicado ni cobros activados.

## Clasificación automática CAD / Póster — 22/10/2026

- **Pedido del usuario:** detectar automáticamente si cada página de ploteo corresponde a CAD (líneas, poca cobertura) o póster (fotos, fondos y plenos). **No dejar el tipo de tarifa a criterio del cliente.**
- **Implementado en código de rama privada y pruebas sintéticas aprobadas:** la pantalla elimina el selector CAD/Póster y genera una miniatura local de cada página PDF (360 píxeles de lado mayor), estimando cobertura total y de color. La API admite `modo` por página para cobrar correctamente un PDF con mezcla de CAD y póster, sin modificar las tarifas. Si el resultado es ambiguo o casi vacío, muestra **Revisión Librería Saber**, sin precio automático y sin trasladar la decisión al cliente.
- **Tecnología de esta primera prueba:** PDF.js 3.11.174 cargado desde CDN público de forma fija; el PDF se procesa únicamente en el navegador y no se transmite al CDN. Si falla la dependencia o renderizado, no se presupone CAD. **Pendiente técnico:** alojar el motor de renderizado en nuestra propia infraestructura para reducir dependencia externa.
- **Limitaciones importantes:** heurística inicial por superficie rasterizada, no medición real de tinta ni clasificación infalible. Validar con planos escaneados, líneas densas, moldes, pósteres, fondos, páginas mixtas y archivos de baja resolución. Ajustar umbrales con casos reales. Evitar habilitar cobros basados en esta decisión hasta verificar originales en servidor.
- **Entorno:** sólo Worker privado `saber-documentos-pruebas`; requiere nueva copia manual del bundle compilado a Cloudflare. Sin publicaciones en web pública ni cambios en Google Apps Script, Polaroids o pagos.
- **Pruebas iniciales de clasificación y tarifa mixta:** https://github.com/hernanchan/COTIZADOR/actions/runs/39774874709. Falta validación real en navegador y PDFs del comercio.

## Checklist de aceptación

- [ ] **Igualar funciones del cotizador vigente.** Auditar las opciones de impresión ofrecidas hoy en el cotizador de producción, especialmente toda la **variedad de papeles y materiales**, y trasladar opciones, incompatibilidades y precios al flujo rápido, por archivo. Evitar reducirlo a Obra 70/140/180. Validar tarifas antes de habilitar pedidos.
- [ ] **Rediseñar estética y claridad visual.** Vista más compacta, jerarquía visual clara, nombres de PDF, controles diferenciados, grupos de anillado reconocibles; presentación intuitiva tanto en PC como móvil.
- [ ] **Precio visible arriba sin scroll excesivo.** Resumen corto de total preliminar, impresiones y anillados en cabecera y/o encabezado fijo cuando haya muchos documentos. Validar que en teléfono no bloquee la edición, navegación o botones. Actualizar sin usar precio obsoleto.
- [ ] **Incluir módulo de ploteos.** Reutilizar reglas, papeles, tamaños y precios del cotizador actual para planos y gran formato, contemplando formatos superiores a A3. Probar cálculo y desglose para quien imprime; no inventar tarifas.
- [x] **Eliminar la leyenda de tiempo de respuesta del cliente.** Ocultar mensajes de milisegundos y velocidad de red del resumen comercial; si se requieren estadísticas técnicas, dejarlas fuera de la vista del cliente.

## Condiciones para marcar terminado

- El cliente puede configurar individualmente todos los PDF y conocer el precio rápidamente **sin subirlos a Drive**.
- Puede distinguir el importe provisional y el estado del pedido sin desplazarse por toda una lista de archivos.
- Quien trabaja en Librería Saber obtiene instrucciones sin ambigüedades, con orden de archivos y grupos de anillado.
- Se mantienen descuentos agrupados por parámetros compatibles y verificación segura antes de pedido o cobro.
- Se prueban diversos papeles, A4/A3, ploteos, diez PDF, celular, anillados individuales y conjuntos.
- No tocar web pública, sistema Polaroids ni pagos mientras no exista aprobación.

**Repositorio/branch:** `hernanchan/COTIZADOR` — `cotizador/migracion-carga-archivos-20261018`.

**Documento vinculado:** `docs/REGISTRO_IDEAS_Y_DECISIONES.md` (entrada del 22/10/2026).

## Validación del usuario — 22/10/2026

- **A3 color corregido y probado satisfactoriamente en el Worker de Cloudflare:** el usuario confirmó «espectacular» después de actualizar manualmente `saber-documentos-pruebas`. No seguir tratando la incidencia A3 color como fallo abierto.
- **Decisión expresa sobre estética:** el usuario todavía **no está conforme con la apariencia** del cotizador rápido, pero solicita **posponer el rediseño visual integral hasta la etapa final**. Mantenerlo anotado como pendiente prioritario de terminación, sin distraerse ahora de los módulos y funciones restantes. No marcar estética como aprobada o completada.
- **Orden de trabajo:** priorizar funcionalidades pendientes (incluidos ploteos, compatibilidad de opciones y flujo de compra seguro), dejando la revisión integral de estética, jerarquía visual y usabilidad para el cierre del proyecto.

## Rollo asignado automáticamente — 22/10/2026

- **Validación del usuario:** tres PDF reales recién ingresados fueron clasificados como Póster/pleno y presupuestados correctamente. El usuario observó que el selector desplegable de rollos permite cambiar erróneamente el precio.
- **Decisión:** retirar por completo la selección de rollos del cliente. El sistema asigna **el rollo estándar más angosto compatible con todas las páginas del PDF** (rollo42/rollo60/rollo90) según el tamaño detectado. El cliente ve el rollo asignado como dato de lectura, sin desplegable; sólo edita copias. No se ofrecen automáticamente recubiertos 60/90: requieren política comercial o revisión especial.
- **Doble validación:** el servidor rechaza presupuestos del flujo multipágina cuyo rollo no coincide con el que asignaría automáticamente según dimensiones y catálogo de `precios-web.json`. No confía en la elección enviada desde el navegador; mantiene solamente el contrato heredado de ensayo de una sola hoja por compatibilidad técnica (sin compra habilitada).
- **Estado:** código modificado en rama privada, pendiente comprobación final de CI, nuevo despliegue manual en Worker privado y nueva prueba real del usuario. No tocar producción, pagos ni Google Apps Script.

## Caso real: PDF MUNICIPAL FINAL p567 — 22/10/2026

- **Archivo del cliente aportado para diagnóstico, no guardado en GitHub:** originalmente siete páginas; el comercio extrajo sólo las primeras tres, todas planos de arquitectura de líneas rojas sobre blanco. Al subir el PDF de tres páginas, el clasificador mostró `Clasificación dudosa` y bloqueó la cotización.
- **Diagnóstico confirmado en análisis de las tres páginas:** el algoritmo anterior tomaba la proporción de píxeles rojos por proxy de plenos, sin distinguir trazos densos de fondos rellenos. Una página alcanzó ~17,7% de cobertura roja en miniatura, aunque no era Póster.
- **Corrección:** evaluar además áreas uniformemente cubiertas en ventanas de 13×13 píxeles; un bloque de color llena muchas ventanas, las líneas finas cruzadas no. Con la heurística corregida y una representación reducida del PDF real, el diagnóstico dio **CAD en las tres páginas**. Las pruebas sintéticas de trazos rojos densos y bloques sólidos están en el repositorio; el PDF privado no se agregó a la base de pruebas.
- **Dimensiones detectadas en el ejemplar:** página 1, aprox. 120,02 × 60,01 cm; páginas 2 y 3, aprox. 124,99 × 60,96 cm. **Advertencia:** el ancho de 60,96 cm de las páginas 2–3 excede el rollo de 60 cm, por lo que, sin reescalar, el selector automático corresponde a **rollo 90** para el conjunto.
- **Estado:** corrección de código compilada y test automatizado aprobado: https://github.com/hernanchan/COTIZADOR/actions/runs/39776885528. Pendiente implementación manual en Cloudflare y reensayo con este mismo PDF para confirmar el renderizado PDF.js del navegador.


## Papeles para Póster — 22/10/2026

- **Pedido del usuario:** dar al cliente la posibilidad de escoger `Obra 80 g` o `Recubierto` **sólo cuando las páginas se detectan como Póster**, sin devolverle la facultad de decidir CAD/Póster ni manipular rollos.
- **Implementado en rama de ensayos, sin desplegar:** para archivos que contengan páginas Póster aparece un único selector de acabado, por defecto `Obra 80 g`; la alternativa es `Recubierto 130 g`, nombre/tarifas extraídos de los materiales `rec60` y `rec90` del catálogo comercial. Los PDF exclusivamente CAD no muestran esa opción.
- **PDF mixto:** todas las páginas CAD siguen en obra con tarifa CAD; sólo las páginas clasificadas Póster pasan al recubierto si se selecciona. El servidor asigna automáticamente rollo recubierto 60 o 90 según la medida; no existe recubierto 42 en el catálogo. La respuesta detalla material y tipo **por página**, para facilitar la producción en dos materiales.
- El servidor sólo acepta `papelPoster: 'obra80' | 'recubierto'`, rechaza opciones inventadas y rechaza recubierto sin páginas Póster. No se modificaron tarifas, clasificación ni modo de cobro (desactivado).
- **Pruebas automáticas aprobadas:** https://github.com/hernanchan/COTIZADOR/actions/runs/39779061543. Pendiente copiar último bundle al Worker privado y confirmar en navegador un caso exclusivamente Póster y uno mixto CAD/Póster.
