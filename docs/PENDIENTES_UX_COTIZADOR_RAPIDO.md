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
