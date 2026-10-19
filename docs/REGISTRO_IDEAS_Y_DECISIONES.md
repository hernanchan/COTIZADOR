# Librería Saber — Registro maestro de ideas, decisiones y pendientes

**Proyecto:** migración integral del cotizador web, Polaroids, recepción privada y Centro de Pedidos.  
**Última actualización:** 19/10/2026.  
**Propósito:** conservar las ideas que van surgiendo en conversaciones, incluidas las que se implementarán más adelante, sin confundirlas con funciones ya entregadas. Mantener este archivo en la rama de desarrollo y enlazar a especificaciones técnicas detalladas. No incluir secretos, datos personales de clientes, claves, movimientos bancarios o enlaces privados.

## Cómo vamos a tomar nota

Cada idea nueva tiene ID estable, fecha, estado, alcance y criterio para retomarla. Etiquetas:

- **DECIDIDO:** el titular aprobó el comportamiento funcional. No implica implementación.
- **EN DESARROLLO:** hay código en rama de pruebas, pero falta conectar/probar o desplegar.
- **PROPUESTO:** idea a evaluar o diseñar; requiere aprobación antes de activar.
- **DIFERIDO:** conservar la idea para una fase posterior sin frenar el desarrollo principal.
- **VERIFICADO EN PILOTO:** ensayo funcional parcial; no presume disponibilidad en producción.
- **PUBLICADO:** solo cuando exista autorización expresa y se compruebe en la web oficial.

Cada vez que surja una propuesta: agregar nueva entrada o actualizar la correspondiente, registrar decisión/fecha y diferenciar claramente «programado», «ensayado» y «activo». En las revisiones del proyecto consultar primero este índice y luego la especificación de cada tema.

## Ideas y decisiones agrupadas

| ID | Idea / decisión | Estado al 19/10 | Etapa y próximo paso |
| --- | --- | --- | --- |
| WEB-01 | **Un solo cotizador migrado** con todas las categorías, precios reales, carrito unificado y sin reemplazos improvisados. Mantener web actual intacta hasta autorización. | DECIDIDO / EN DESARROLLO | Integración progresiva en rama privada; QA antes de publicar. |
| WEB-02 | **PDF por tandas B/N y color**. Leer páginas reales, A4/A3, papel, caras, copias; jamás confiar exclusivamente en recuento del navegador. | DECIDIDO / EN DESARROLLO | Motor y pantalla de prueba creados; falta validador de servidor y pruebas con PDF real. |
| WEB-03 | **Anillados conjuntos, separados y mixtos**: el cliente elige orden de los PDF y grupo; incluir trabajo suelto. | DECIDIDO / EN DESARROLLO | Motor de grupos y ficha de armado en código; falta integración end-to-end. |
| WEB-04 | **JPG/PNG**: componer 1, 2, 4 o 9 imágenes por cara A4/A3, encuadre y zoom, advertencia PPI según tamaño final, PDF privado listo para imprimir. | DECIDIDO / PARCIAL | Planificador puro ya preparado; falta interfaz, composición, validación y almacenamiento. |
| WEB-05 | **Ploteos**: planos CAD y pósteres/imágenes grandes por caminos de cálculo separados, tamaño final seleccionado por cliente, rollo/orientación apropiados. | DECIDIDO / PARCIAL | Reutilizar calculadora existente; falta ruteo por archivo/tamaño final. |
| WEB-06 | **Polaroids solo fotografías**: editor específico de seis por A4, calidad, encuadres y marcas de corte; no mezclar su recepción con documentos. | DECIDIDO / VERIFICADO EN PILOTO | Mantener receptor de fotos sin cambios; integrar al carrito y descargas del Centro de Pedidos. |
| WEB-07 | **Drive privado, un Centro de Pedidos**, separados por servicio/pedido. Archivos originales y PDF de impresión accesibles al operador mediante descarga protegida. | DECIDIDO / EN DESARROLLO | Carpeta privada de ensayos de documentos creada en cuenta Librería Saber (19/10); receptor nuevo solo escrito en GitHub, no instalado. Históricos de Polaroids intactos. |
| WEB-08 | **Subidas recuperables**, especialmente desde celular si se apaga pantalla; reanudar fragmentos, evitar archivos incompletos y cotejar integridad, sin gastos/R2. | DECIDIDO / EN DESARROLLO | Protocolo SHA y receptor preparado, simulaciones; falta instalación piloto y pruebas con red/dispositivos reales. |
| WEB-09 | **Mercado Pago pago total**: verificar pago de servidor, webhook cuando funcione y conciliación periódica aceptable; comprobación manual alternativa. | DECIDIDO / VERIFICADO EN PILOTO | Piloto de pagos existente; no asociar automáticamente archivos incompletos a producción. Comprobar cron sin intervención. |
| WEB-10 | **Transferencia a cuenta propia** como alternativa a MP, con verificación manual simple y botón «Confirmar pago» en Centro de Pedidos. | DECIDIDO / NO IMPLEMENTADO | Vincular movimiento real a pedido, titular/operación/comprobante opcional y evitar confundir transferencias del mostrador del mismo importe. Nunca confirmar por comprobante solamente. |
| WEB-11 | **Control de cuota de Drive**: conservar archivos de trabajos entregados **30 días** y luego enviarlos a papelera **7 días** antes de borrado definitivo. Mantener histórico comercial. | DECIDIDO / CÓDIGO EN SIMULACIÓN | Motor de retención desarrollado apagado; falta estado «Entregado», inventario confiable por pedido, prueba de reversión y autorización para activar borrado. No tocar históricos Polaroids. |
| WEB-12 | **Carritos abandonados**: borrar archivos privados **48 h después de inactividad**, más 7 días de papelera, cuando realmente no haya pago, transferencia pendiente ni reclamos. | DECIDIDO / NO IMPLEMENTADO | Crear estado de carrito abandonado y vencimientos; consulta bancaria/MP antes de borrar. Nunca aplicar automáticamente a transferencias pendientes. |
| WEB-13 | **Recuperación de carritos**: preservar archivos, fotos y encuadres y dar enlace seguro para retomar sin crear pedido duplicado. | DECIDIDO / NO IMPLEMENTADO | Preparar los identificadores y el estado persistente desde la etapa actual de carrito; revalidar precio/promos al regresar. |
| WEB-14 | **Mensaje automático de recordatorio por WhatsApp** si cliente abandona compra; sugerido **uno solo a las 3 h**, consentimiento expreso previo y posibilidad de baja. | DIFERIDO / IDEA APROBADA PARA PREPARAR | No bloquear la primera publicación. Evaluar más adelante WhatsApp Business Platform oficial, plantilla, categoría, costo y consentimiento; no usar WhatsApp Web automatizado ni gastar sin aprobación. |
| WEB-15 | **Ofertas exclusivas del cotizador**: mostrar un producto muy conveniente cuando el usuario calcula precio, válido sólo si compra impresiones. Primera idea: bitácora con foto real. | PROPUESTO / DIFERIDO | Recuperar condiciones y foto aprobadas, revisar márgenes y UX; no desviarse antes de cerrar recepción/pagos. |
| WEB-16 | **Descuentos por día y cupones** deben aplicarse igual entrando por oferta, WhatsApp o directamente al cotizador; coherencia del carrito y promos. | DECIDIDO / VERIFICACIÓN PENDIENTE | Comparar reglas y tarifas actuales de la web antes de migrar a backend autoritativo. |
| WEB-17 | **Control final de producción**: estados recibido, archivos verificados, pago pendiente, pagado, en producción, completado, entregado y pausado por reclamo. | DECIDIDO / NO INTEGRADO | Centro de Pedidos con descarga PDF privada y acción «Marcar entregado»; punto necesario para limpieza programada. |
| WEB-18 | **No modificar producción, no contratar servicios ni generar cargos sin permiso**. | DECIDIDO / RESTRICCIÓN PERMANENTE | Rama privada de pruebas; no fusionar a `main` ni activar receptor, borrado, MP nuevo o WhatsApp sin autorización expresa. |

## Prioridad inmediata (secuencial)

1. Crear/configurar **receptor de PDF real** y entorno de prueba separado, usando la carpeta privada ya creada en Google Drive, sin modificar Apps Script de Polaroids.
2. Verificar archivos PDF auténticos de punta a punta (cantidad de páginas validada del lado servidor, integridad y reanudación), bloqueando pago ante errores.
3. Integrar precio servidor, carrito, recepción de JPG/PNG y ploteos, y Centro de Pedidos con descargas.
4. Conectar Mercado Pago y transferencias manuales al mismo estado seguro del pedido, incluir control de entregas.
5. Incorporar retención de 30+7 días, limpieza de abandonos 48 h + 7 días, y enlace para recuperar el carrito; primero simulaciones.
6. Después de publicación y estabilidad: estudiar recordatorio automático de WhatsApp y otras mejoras comerciales, con presupuesto aprobado.

## Referencias técnicas

- [Especificación principal](ESPECIFICACION_COTIZADOR_UNICO_AUTOMATICO.md)
- [Bitácora de la prueba del cotizador](../pruebas/README_COTIZADOR_ARCHIVOS.md)
- [Receptor PDF independiente — NO instalado](../integraciones/autocotizador/recepcion/README.md)
- [Retención y carritos abandonados](../integraciones/autocotizador/retencion/README.md)
- [Pruebas de pagos](../integraciones/mercadopago/pruebas/README.md)

**Alcance de esta bitácora:** es documentación y planificación, no evidencia de despliegue. Mantener el estado exacto de cada idea al actualizarla.
