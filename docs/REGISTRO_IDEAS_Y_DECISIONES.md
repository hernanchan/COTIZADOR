# Librería Saber — Registro maestro de ideas, decisiones y pendientes

**Proyecto:** migración integral del cotizador web, Polaroids, recepción privada y Centro de Pedidos.  
**Última actualización:** 20/10/2026.  
**Propósito:** conservar las ideas que van surgiendo en conversaciones, incluidas las que se implementarán más adelante, sin confundirlas con funciones ya entregadas. Mantener este archivo en la rama de desarrollo y enlazar a especificaciones técnicas detalladas. No incluir secretos, datos personales de clientes, claves, movimientos bancarios o enlaces privados.

## Presupuesto piloto vinculado al PDF real de 6 páginas — 20/10/2026

**Estado:** preparado en GitHub y validado en CI, **sin instalar todavía la fase 3 en Cloudflare**. La fase 2 de recepción y conteo de páginas sí fue probada en servicios reales.

- `worker-fase3-presupuesto-pdf.mjs` añade `GET /prueba-presupuesto` y `POST /api/presupuesto-pdf` al Worker existente. El navegador sólo puede escoger formato A4/A3, simple/doble faz, 1–200 copias y con/sin anillado; **jamás recibe control sobre páginas, recibos, estado ni precio**. El Worker consulta `privatePilotInfo` y `privateVerifiedStatus` de Google Apps Script mediante las **mismas claves HMAC** del piloto. Rechaza si no hay seis páginas verificadas, recibo ajeno/no verificado o si Google autoriza pagos; entonces integra `cotizacion-desde-recibos-servidor.mjs`, `cotizar-documentos.mjs` y `manifiesto-documentos.mjs` usando una copia empaquetada de `precios-web.json`.
- El archivo listo para instalar sin dependencias es `integraciones/autocotizador/recepcion/dist/saber-documentos-presupuesto-fase3.mjs` (generado en la rama de pruebas por CI). Conserva las rutas de validación, el piloto limitado y el **bloqueo incondicional de cargas generales**, incluso si accidentalmente `DOCS_UPLOAD_ENABLED=true`; no toca la página pública ni los sistemas Polaroids, Mercado Pago o Google.
- **CI real ejecutado exitosamente en GitHub:** <https://github.com/hernanchan/COTIZADOR/actions/runs/39457576546>. Incluye pruebas Node del presupuesto basado en recibos verificados, lector PDF auténtico y compilación esbuild; se guardó el archivo compilado en la rama. Ensayo adicional del **bundle final** con Google/Turnstile simulados: seis páginas verificadas B/N, A4, simple faz, una copia **$600 orientativos**; dos copias, A4 doble faz, con anillado **$5.620 orientativos**; cliente intenta insertar `pages=999999` → HTTP 400; ruta general de subida → HTTP 503 aun con `DOCS_UPLOAD_ENABLED=true`. Se comprobó sintaxis JS del formulario HTML.
- **IMPORTANTE sobre precios:** `precios-web.json` usado en build fue generado el **21/08/2026**. Este ensayo es de integración técnica, **NO un precio comercial aprobado ni apto para cobrarse a clientes**. Respuesta y pantalla indican `paymentAuthorized:false`.
- **Siguiente ensayo permitido:** sin cambiar Apps Script ni claves, copiar **sólo el bundle fase 3** al Worker aislado `saber-documentos-pruebas` mediante Editar código → Implementar, abrir `/prueba-presupuesto`, completar Turnstile y calcular con el PDF ya recibido. Pedir al titular el resultado literal antes de iniciar carrito/pagos. No reutilizar la tabla de agosto para publicar precios reales.


## Hito real — conteo autoritativo de páginas, 20/10/2026

El titular implementó el Apps Script `DocumentosReceiver_VALIDACION_FASE2.gs` sobre **PRUEBA 3** y el Worker compilado `dist/saber-documentos-validacion-fase2.mjs` en `saber-documentos-pruebas`, sin alterar sitio público ni Polaroids. Tras abrir `/prueba-validacion`, confirmó literalmente:

> PDF VERIFICADO EN SERVIDOR: 6 página(s).  
> Recibo: DOC-da162bf3-5b63-48d5-81fe-0f20bd7d02d9  
> Pagos: desactivados.

**Resultado confirmado en entorno real a partir del mensaje de la interfaz:** el Worker obtuvo por conexión firmada los bytes del mismo PDF previamente recibido de Drive, verificó SHA-256 y empleó el lector PDF empaquetado (`pdf-lib`) para contar **6 páginas**. Apps Script guardó el resultado verificado y lo asoció al recibo. No se modificó la carpeta privada ni hizo segunda carga. **Esta evidencia no confirma precio, carrito, cobro ni pedido del Centro de Pedidos.** Continúan desactivados.

**Siguiente prioridad:** enlazar `privateVerifiedStatus` al presupuesto servidor del cotizador con precios aprobados, primero como simulación B/N A4, sin habilitar cobro.

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

| ID | Idea / decisión | Estado al 20/10 | Etapa y próximo paso |
| --- | --- | --- | --- |
| WEB-01 | **Un solo cotizador migrado** con todas las categorías, precios reales, carrito unificado y sin reemplazos improvisados. Mantener web actual intacta hasta autorización. | DECIDIDO / EN DESARROLLO | Integración progresiva en rama privada; QA antes de publicar. |
| WEB-02 | **PDF por tandas B/N y color**. Leer páginas reales, A4/A3, papel, caras, copias; jamás confiar exclusivamente en recuento del navegador. | DECIDIDO / VERIFICADO EN PILOTO PARCIAL | 20/10: primer PDF almacenado en Drive verificado en backend por SHA y **6 páginas reales** con `pdf-lib` y confirmación Apps Script vinculada al recibo. Sigue pendiente vincular tarifas aprobadas, varias tandas, entrega a producción y pago. |
| WEB-03 | **Anillados conjuntos, separados y mixtos**: el cliente elige orden de los PDF y grupo; incluir trabajo suelto. | DECIDIDO / EN DESARROLLO | Motor de grupos y ficha de armado en código; falta integración end-to-end. |
| WEB-04 | **JPG/PNG**: componer 1, 2, 4 o 9 imágenes por cara A4/A3, encuadre y zoom, advertencia PPI según tamaño final, PDF privado listo para imprimir. | DECIDIDO / PARCIAL | Planificador puro ya preparado; falta interfaz, composición, validación y almacenamiento. |
| WEB-05 | **Ploteos**: planos CAD y pósteres/imágenes grandes por caminos de cálculo separados, tamaño final seleccionado por cliente, rollo/orientación apropiados. | DECIDIDO / PARCIAL | Reutilizar calculadora existente; falta ruteo por archivo/tamaño final. |
| WEB-06 | **Polaroids solo fotografías**: editor específico de seis por A4, calidad, encuadres y marcas de corte; no mezclar su recepción con documentos. | DECIDIDO / VERIFICADO EN PILOTO | Mantener receptor de fotos sin cambios; integrar al carrito y descargas del Centro de Pedidos. |
| WEB-07 | **Drive privado, un Centro de Pedidos**, separados por servicio/pedido. Archivos originales y PDF de impresión accesibles al operador mediante descarga protegida. | DECIDIDO / VERIFICADO EN PILOTO PARCIAL | **20/10: primer PDF real recibido desde Chrome, pasando por Cloudflare y Apps Script firmados, guardado en Drive y cotejado por tamaño y SHA-256 del archivo descargado; recibo `DOC-da162bf3-5b63-48d5-81fe-0f20bd7d02d9`.** Piloto de un único PDF hasta 1 MiB, sin páginas verificadas ni pagos. No se ha inspeccionado visualmente el archivo en el Drive privado desde ChatGPT; aún no existe Centro de Pedidos integrado. Polaroids y web pública intactos. |
| WEB-08 | **Subidas recuperables**, especialmente desde celular si se apaga pantalla; reanudar fragmentos, evitar archivos incompletos y cotejar integridad, sin gastos/R2. | DECIDIDO / PILOTO PARCIAL | Envío real fragmentado de 1 PDF con cotejo SHA-256 al final confirmado el 20/10; falta demostrar reanudación ante interrupción, cargas grandes y distintos dispositivos. El cupo del piloto inicial ya se utilizó. |
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

1. **COMPLETADO EN PILOTO (20/10):** comunicación Cloudflare ↔ Google HMAC y primera transferencia de un PDF de Chrome a Drive privado comprobado por SHA-256, con un solo PDF de hasta 1 MiB y sin cobros. No repetir el mismo piloto: el cupo ya se consumió.
2. **SIGUIENTE:** implementar conteo confiable de páginas PDF del lado servidor y reporte de tamaño/formato; mantener bloqueo de pago cuando no exista verificación. Diseñar después pruebas de reanudación con sesiones independientes, sin tocar la web pública.
3. Integrar precio servidor, carrito, recepción de JPG/PNG y ploteos, y Centro de Pedidos con descargas.
4. Conectar Mercado Pago y transferencias manuales al mismo estado seguro del pedido, incluir control de entregas.
5. Incorporar retención de 30+7 días, limpieza de abandonos 48 h + 7 días, y enlace para recuperar el carrito; primero simulaciones.
6. Después de publicación y estabilidad: estudiar recordatorio automático de WhatsApp y otras mejoras comerciales, con presupuesto aprobado.

## Avance de ingeniería del 20/10/2026 (posterior al primer PDF real)

- **Nuevo módulo:** `integraciones/autocotizador/pruebas/cotizacion-desde-recibos-servidor.mjs`. Une cotizador B/N/color + anillados y ficha de armado **sólo** si cada recibo, consultado por el backend, confirma `storageVerified:true`, `pageVerification:'server'`, páginas, SHA-256, pedido y nombre. El navegador NO puede imponer una cantidad de páginas ni un importe. El resultado bloquea explícitamente el pago (`paymentAuthorized:false`). Pruebas aisladas realizadas: cotización de un PDF A4 de tres páginas a ARS 300 según `precios-web.json` vigente en el código, y rechazo de discrepancias de páginas, SHA, pedido, nombre, modalidad, recibo sin verificación o tarifas faltantes. **No constituye aprobación comercial de las tarifas** (planilla generada en agosto de 2026).
- **Nuevo módulo:** `integraciones/autocotizador/recepcion/verificacion-pdf-drive-servidor.mjs`. Para Cloudflare Workers **empaquetado con** `pdf-lib`: vuelve a comparar hash/tamaño de los bytes originales **releídos del Drive privado** y lee el árbol de páginas con un motor PDF. Fail-closed: no verifica PDF corruptos/cifrados o pages fuera de rango. Pruebas unitarias con parser inyectado; **no** se ha empaquetado la librería ni probado con PDF real. No conectar a cobro ni llamar a esto integración terminada.
- **Bloqueante inmediato**: mecanismo firmado y por fragmentos para que el Worker de validación obtenga el PDF **privadamente de Drive**, biblioteca PDF empaquetada, y actualización autoritativa del estado del recibo antes de cotización. Después, una única prueba integral de cotización real. Mantener aislada la web pública y sin volver a pedir cambio de claves.
- **Prioridad de ejecución**: cerrar un flujo integral sencillo (PDF B/N/color A4/A3 → páginas del servidor → precio aprobado → carrito → pago confirmado → Centro de Pedidos), antes de ampliar ploteos y otras categorías. No reducir alcance funcional sin conformidad del titular.

## Validación fase 2 compilada y comprobada — 20/10/2026

- **CI real en GitHub (rama aislada):** ejecución exitosa <https://github.com/hernanchan/COTIZADOR/actions/runs/39453996039>. Ejecutó `npm test` contra `pdf-lib@1.17.1`, compiló el Worker con `esbuild` y lo guardó dentro de la propia rama de pruebas, sin implementar cambios en Cloudflare ni Google. Archivo de instalación: `integraciones/autocotizador/recepcion/dist/saber-documentos-validacion-fase2.mjs`.
- **Ensayo adicional aislado del archivo final:** se importó el Worker empaquetado en Node, se generó un PDF auténtico de **tres páginas** con ReportLab, se simuló la respuesta firmada de Apps Script y un retorno de bytes desde Drive, y el bundle real de `pdf-lib` contó **3 páginas**. La prueba también verificó idempotencia de una validación repetida, rechazo de Turnstile, conservación de `paymentAuthorized:false` y bloqueo de la ruta general de uploads (HTTP 503).
- **Importante:** las llamadas a Google se SIMULARON en este último ensayo. Todavía falta que el titular instale la versión `DocumentosReceiver_VALIDACION_FASE2.gs` en el Apps Script de documentos y el Worker compilado en `saber-documentos-pruebas`, conservando la misma implementación de Google, las variables y las claves. Entonces debe visitar `/prueba-validacion` para verificar páginas del **PDF real que ya se subió a Drive**, sin cargar otro PDF. Los archivos de Polaroids y la web pública no se tocan. No cobrar por este resultado piloto.

## Referencias técnicas

- [Especificación principal](ESPECIFICACION_COTIZADOR_UNICO_AUTOMATICO.md)
- [Bitácora de la prueba del cotizador](../pruebas/README_COTIZADOR_ARCHIVOS.md)
- [Receptor PDF independiente — piloto aislado instalado](../integraciones/autocotizador/recepcion/README.md)
- [Retención y carritos abandonados](../integraciones/autocotizador/retencion/README.md)
- [Pruebas de pagos](../integraciones/mercadopago/pruebas/README.md)

**Alcance de esta bitácora:** es documentación y planificación, no evidencia de despliegue. Mantener el estado exacto de cada idea al actualizarla.
