# Integración técnica del cotizador organizado por trabajos

**Fecha:** 25/11/2026  
**Estado:** propuesta técnica; sin cambios de motor, pedidos, pagos ni infraestructura.  
**Base auditada:** `integracion/tus-pedido-privado-20261101` en `367938a241529e0cf70e7c124d8d5599b6ca4250`.

## Hallazgos confirmados en el código

- `cotizarCargaUnica()` cotiza una lista de configuraciones por archivo, admite 1 a 30 líneas y devuelve un único total, desglose, promociones, pendientes y plan. La validación de cada línea es estricta: no se le pueden agregar campos de interfaz sin que el motor los rechace.
- El flujo de pedido universal limita la orden comercial a 10 PDF. `crearFlujoUniversalPDF()` exige una configuración por archivo, calcula manifiestos de archivo y crea un checkout único para el pedido.
- `normalizarArchivosImpresion()` convierte JPG/PNG a PDF en el dispositivo del comprador. Los originales de imagen no pasan al servidor. El contrato comercial de recepción sigue siendo PDF.
- `fichaPrearchivoUniversal()` ejecuta el mismo motor, concilia el total con el plan y crea una entrada por archivo, con recibo, SHA, configuración, desglose y subtotal. `repartirPromocionFicha()` asigna el descuento autorizado por D1 a las líneas y concilia el total.
- El borrador y varias rutas de la Central validan campos y esquemas de forma estricta. La ficha de producción y la hoja de instrucciones reciben una lista ordenada de archivos y grupos de anillado; no contienen un identificador explícito de trabajo de impresión creado por el cliente.

## Modelo propuesto

1. La interfaz mantiene `trabajos[]`. Cada trabajo tiene un ID aleatorio local, servicio, configuración compartida y una lista ordenada de archivos. Las excepciones individuales se guardan junto a cada archivo.
2. Al cotizar, un adaptador aplana los trabajos en el orden visible y genera una configuración completa por archivo, aplicando primero los valores compartidos y después las excepciones. El ID de trabajo viaja en un mapa paralelo; no se agrega a las líneas que recibe `cotizarCargaUnica()`.
3. Se llama una sola vez al motor con todos los archivos del pedido. Así se mantienen las escalas multifichero y la promoción sobre el pedido completo. Los importes de cada trabajo se presentan sumando sus líneas y armados de la ficha generada por el servidor, incluida la distribución de promoción ya existente.
4. El contrato del borrador debe versionarse para incluir una agrupación validada de IDs de trabajo a referencias de archivo. Cada archivo debe pertenecer exactamente a un trabajo; no se aceptan referencias ausentes, repetidas o ajenas. El servidor recalcula precio y destino como hoy; el agrupamiento solo organiza el pedido y las instrucciones.
5. La ficha de Central, la hoja de instrucciones y el ZIP deben conservar el ID/orden del trabajo además del orden de archivo. El anillado agrupado sigue siendo una relación separada: sus restricciones actuales permiten agrupar archivos compatibles y no debe confundirse con la pertenencia a un trabajo.
6. Duplicar un trabajo copia su servicio y configuración compartida, pero crea un ID nuevo y no copia archivos. Editar o quitar un trabajo modifica el modelo de interfaz sin volver a pedir los archivos que siguen cargados.

## Alcance de integración recomendado

- Interfaz cliente: modelo de trabajos, editor progresivo por servicio, excepciones por archivo, duplicar configuración, conservar archivos al editar y resumen adaptable a PC/móvil.
- Adaptador de cotización: transformación trabajos → líneas actuales del motor y reconstrucción del resumen por trabajo, sin segunda fórmula de precios.
- Contrato versionado de borrador/pedido, validadores de Central, ficha de producción e instrucciones/ZIP para guardar el agrupamiento de forma verificable.
- Conservar en catálogo las alternativas vigentes y obtenerlas de las fuentes actuales. No codificar materiales ni precios nuevos en la interfaz.

## Pruebas de integración necesarias

- Total y promociones iguales al cotizar las mismas líneas planas, con varias distribuciones de trabajos.
- Escalas de precios calculadas sobre el pedido completo, no por separado por trabajo.
- ID de cada archivo preservado desde carga y cotización hasta borrador, orden, Central, ficha e instrucciones/ZIP.
- Rechazar manifiestos con archivo sin trabajo, archivo repetido, IDs inválidos o cambio de orden no conciliado.
- Anillado agrupado válido e incompleto, incluso cuando sus archivos pertenecen a trabajos diferentes, respetando tamaño y copias.
- Archivos PDF de tamaños y servicios distintos; imágenes locales convertidas; selección de páginas; cambios de configuración sin recargar originales.
- Duplicar configuración sin duplicar archivos; quitar un archivo o trabajo sin perder los demás.
- Pruebas de navegador en PC y móvil con datos ficticios. No realizar pagos ni usar datos de clientes.

## Estado y límites

- Esta revisión es estática. No se modificó código comercial y no se ejecutaron pruebas nuevas.
- No se inspeccionó Cloudflare ni se afirma cuál Worker está activo.
- GitHub muestra el PR #32 como borrador abierto, con base `367938a...` y head `be6791e...`; su descripción menciona una versión de rollback distinta de la informada en el estado inicial del proyecto. La versión activa no queda resuelta desde GitHub.
- No se mezcló la rama `interfaz/vidriera-progresiva-20261124` con esta base. Antes de preparar el PR funcional se debe fijar explícitamente la base técnica desde la que se integrará la interfaz.

## Siguiente paso

Implementar el adaptador y el nuevo contrato de agrupación en una rama aislada, con pruebas de conciliación del pedido y de navegación. Mantener la cotización única y dejar la publicación fuera de este trabajo. El cambio funcional debe pasar por PR y por la autorización manual del SHA final que exige el contrato de Saber.