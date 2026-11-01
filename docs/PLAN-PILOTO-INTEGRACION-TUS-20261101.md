# Librería Saber — Plan de integración privada del transporte TUS comprobado
**1 de noviembre de 2026 · estado: propuesta documentada, NO IMPLEMENTADA**

## Evidencia de partida

- La web del laboratorio aislado, `hernanchan/saber-laboratorio-pdf`, ruta `/reales/`, **subió y verificó dos PDFs reales con SHA-256/páginas correctos** el 01/11/2026 a las 00:22 ART. Captura del usuario: **17,02 MiB + 9,66 MiB, 16 páginas en cada PDF**, **9,95 s de reloj total**; lectura local **0,51 s**, autorización **2,35 s**, subida TUS **3,99 s**, verificación server-side **3,09 s**. Sin D1 ni pedidos ni cobros.
- Corroboración independiente SQL de Supabase: invitación de uso único marcada `consumed=true`; 2 claves asignadas; **0 objetos remanentes correspondientes a la sesión** tras eliminación; bucket `saber-tus-lab` privado. Hay **4 objetos sintéticos históricos** en el bucket (2 ensayos anteriores), no son los PDFs reales recién enviados.
- Logs remotos: `/start` POST 200, dos firmas de subida 200, TUS PATCH 204 (fragmentado), `/verify` POST 200 (03:22:30 a 03:22:39 UTC). Resultado observado, no simulación.
- Frente al viejo Worker→Apps Script→Google Drive, las pruebas antiguas con otros archivos tardaron **93,5 y 97,7 s, y finalizaron 1/2 verificado** (etapa `LECTURA_DRIVE`). No atribuir a esta comparación una aceleración causal exacta: el nuevo ensayo **no incluyó cotizador, D1, estado de pedido, descarga de taller ni pagos**, y documentos distintos.
- **Conclusión demostrada:** TUS directo navegador → Supabase Storage con autorizaciones por objeto, relectura privada, SHA-256 y conteo de páginas es viable para 2 PDF de ~26,68 MiB en este entorno. **No demuestra que el cotizador comercial esté terminado.**

## Regla de alcance

Continuar en **rama privada**, sin tocar `COTIZADOR/main`, sitio `libreriasaber.com.ar`, Workers y Apps Script activos, Polaroids, ni activar Mercado Pago. **No hacer nuevos despliegues ni cambiar infraestructura de producción sin autorización explícita del dueño.** El código del laboratorio público NO debe usarse como autenticación comercial: el esquema de invitación actual sirve solo para pruebas y borra el archivo después de verificar.

## Arquitectura incremental propuesta

1. **Conservar interfaz de cotización y reglas actuales** de A4/A3, B/N-color, simple/doble faz, anillado junto/separado/mixto, ploteos CAD/Póster, tamaños, rotación, clasificación, precios y resumen arriba. Cambiar **únicamente la recepción de bytes** y sus estados, detrás de un flag privado `RECEPCION_TUS_LAB`. Mantener un botón único de envío.
2. El Worker privado autentica cada intento, fija `orderId` idempotente, límites por archivo/tanda y emite a navegador autorizaciones temporales de subida al bucket privado **por archivo de ese pedido**. Las claves de servicio nunca salen del servidor; Turnstile no debe pedirse varias veces por cada fragmento.
3. Browser usa **TUS directo en 2 carriles con progreso real**. Envía metadatos mínimos y SHA calculado localmente; nunca publica URLs `getPublicUrl` ni envía contenido por Google Apps Script.
4. Servidor verifica independientemente la existencia, SHA-256, bytes, tipo PDF y número de páginas, compara opciones/tamaño esperado y devuelve estado verificable por archivo. PDFs con contraseñas o páginas imposibles generan error claro. No contar sólo con el análisis del navegador.
5. **Registrar un único pedido en D1 solamente tras recibir todos los archivos**. Definir estado transitorio de carga / verificación / registro y mecanismo idempotente de reconciliación ante cortes de red o fallo parcial entre Storage y D1. No marcar pagado ni producir si falta un objeto.
6. La Central privada conserva referencia a objetos y habilita **descarga autenticada, temporal y auditable por el personal**. Eliminar archivos únicamente después de la entrega o según plazo comercial acordado (NO aplicar la eliminación inmediata del ensayo a pedidos reales).
7. Programar limpieza de cargas abandonadas y archivos vencidos, límites de cuota/costo/egreso y control de abuso. Medir latencia real por etapa e informar errores sin datos sensibles.

## Condiciones de aceptación antes de utilizarlo con clientes

- **Integridad:** 2/2 y luego 5-10 PDFs reales de ensayo autorizados, páginas/SHA iguales en navegador y servidor; impedir pedido D1 con un documento no verificado.
- **Confiabilidad:** corte de red, repetición, doble clic, bloqueo de sesión y recarga; sin pérdidas, sin duplicados, reanudación correcta con TUS y conciliación D1.
- **Seguridad:** bucket siempre privado, políticas de roles, URLs temporales sólo para personal y tokens por objeto; no exponer `service_role`; privacidad y retención demostradas.
- **Desempeño:** medir tamaño real, tiempos de carga, confirmación y cotización completa, p50/p95 en escenarios de 1/2/5/10 documentos; no asumir que el resultado de 9,95 s se repetirá para clientes.
- **Capacidad y costos:** comprobar plan Free, límites de almacenamiento/egreso/tamaño, volumen diario probable, expiración de proyecto inactivo, mecanismos de borrado y alternativa antes de depender del servicio como producción.
- **Negocio:** Central D1 usable, posibilidad de descargar documentos para imprimir, total de presupuesto correcto y trazabilidad del pedido; pagos permanecen desactivados hasta autorización separada.
- **Rollback:** bandera que permite volver al circuito anterior sin migraciones destructivas, pero **el anterior está fallando** y no debe usarse comercialmente hasta reparar o sustituir.

## Próxima acción técnica sin intervención del comerciante

En la rama experimental, comparar interfaces reales del Worker privado y `lab-tus-one-use`, construir contrato interno para **inicio firmado → subida → verificación → manifiesto → alta D1**, con tests que ejecuten lógica de almacenamiento y no sólo simulen `multiReadPart`. **No desplegar ni pedirle más archivos al usuario hasta que el diseño y su tratamiento de fallos estén listos.**

### Relación con registros anteriores
- `docs/EXPERIMENTO-TUS-SUPABASE-20261031-ESTADO.md` (evidencia E2E de 9,95 s)
- `docs/AUDITORIA-BASES-OPEN-SOURCE-20261031.md`
- `docs/DIAGNOSTICO-502-LOTE-20261028.md`
- `docs/UX-CIRCUITO-UNICO-CLIENTE-V1.md`
