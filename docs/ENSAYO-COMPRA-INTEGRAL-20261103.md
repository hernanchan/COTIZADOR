# Librería Saber — Ensayo integral PDF → Mercado Pago → Central
Fecha: 03/11/2026 (Argentina). Entorno exclusivamente privado.

## Objetivo contractual
Un cliente sube PDF, configura cada trabajo, confirma teléfono, recibe número de orden, inicia pago total con comprador test_user en Mercado Pago, webhook verifica importe/ARS/orden/vendedor y Central D1 marca pagado. El operador SOLO produce si la Central confirma pago verified; impagos/abandonos quedan separados. Transferencias requieren acreditación bancaria manual. Ninguna prueba debe usar dinero/tarjetas reales.

## Implementado en GitHub y desplegado
- Cliente: botón **Pagar con Mercado Pago (prueba)** en el recibo de orden TUS; abre enlace HTTPS del dominio oficial MP en pestaña nueva y consulta periódicamente la conciliación mientras la pestaña original está abierta. Botón adicional de consulta; no supone éxito por redirección. Solo se muestra cuando DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY y la orden existe.
- Worker documental: ruta /prueba-v2/api/ensayo-tus-pago-sandbox protegida por Basic o cookie privada HttpOnly; controla Origin, tres identificadores, flag exclusivamente privado y Service Binding HMAC; no expone secretos ni acepta importe o precio del navegador.
- Central: ruta POST /internal/central/payment-sandbox-client exclusivamente HMAC; cruza cart_requests.client_order_id, central_document_manifests.web_order_id y orders.id. Reutiliza /demo/checkout: validación de recepción y tarifa en D1, vendedor test_user, preferencia exacta, moneda ARS, expiración, idempotencia y rechazo de transferencia abierta. Estado de pago solo confirmado mediante D1 orders paid + payment_reviews verified; revertidos no se liberan.
- CI rama privada: 41668469199 success después de corregir tests de UI aislados; 41668701530 y 41668776592 success con nuevas pruebas; 41668849370 success previo al despliegue; 41669022139 success.
- Central privada saber-pagos-pruebas: workflow 41668849260 **SUCCESS**, versión activa f58d58ae-4368-4dbf-b778-e4c17c09e2ed, HTTP 401 en API anónima, health databaseReady y paymentsEnabled=false. Rollback anterior ca72fea0-b59b-496e-b972-4c383b200a2d.
- Worker documentos saber-documentos-pruebas: workflow 41669021788 **SUCCESS**, versión 043b49db-2c70-4b19-9174-af7c65dc1d48; flags DOCS_PRICE_ADMIN_D1_ENABLED=PRIVATE_TEST_ONLY y DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY; validación real de precios D1 A4 B/N SF 100 y póster recubierto rollo60 18.700, acceso Basic 401 anónimo y web comercial intacta. La versión anterior de rollback está registrada en los logs del workflow.
- Repo: hernanchan/COTIZADOR, rama integracion/tus-pedido-privado-20261101. NO publicar main ni libreriasaber.com.ar.

## ESTADO REAL
**Código, CI y ambos despliegues privados verificados.** Aún **NO** hay ensayo del pago real con usuario comprador de prueba ni comprobación de webhook/conciliación D1/orden pagada desde Chrome. No afirmar compra end-to-end aprobada hasta que el usuario la complete y compruebe Central. No volver a hacer pruebas aisladas de ZIP o pedidos impagos.

## Siguiente acción exacta (operador)
Abrir https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/ y Ctrl+F5. Subir UN PDF nuevo, configurar, completar teléfono, Enviar mi pedido; en recibo elegir **Pagar con Mercado Pago (prueba)**, abrir enlace MP oficial desde nueva pestaña y efectuar pago solamente con comprador/medio de prueba. Mantener pestaña original abierta para estado automático. Luego abrir https://saber-pagos-pruebas.libreriasaber.workers.dev/admin y corroborar que ese número de orden aparezca como **PAGADO**. Si falla, registrar paso, mensaje y estado, sin re-subir a ciegas. Nunca compartir contraseñas ni tokens.

## Pendiente antes de publicar
- Confirmación E2E de pago aprobado, rechazado, abandonado y reversión; prueba idempotente sin doble cargo.
- Alternativa transferencia y confirmación manual de crédito real (sin usar dinero en ensayo).
- Opción dirección entrega (opcional) y UX de teléfono/pago, comparación de promociones, móvil y seguridad de liberación. No confundir sandbox operativo con autorización para producción.


## 04/11/2026 — Resultado primer pago y corrección de autoconciliación

- El titular completó un pago real **de sandbox**, con cuenta de prueba compradora. Primero NO apareció la orden nueva en la bandeja de pagados; el panel mostraba cron automático con `pedidos revisados: 3 · registrados: 0 · errores: 1` (captura 04/11). Posteriormente el titular pulsó **«Verificar pagos pendientes»** y confirmó que la orden pasó a la Central. La conciliación bajo solicitud sí funcionó. **No se puede afirmar que el webhook funcionó** ni atribuir el error del cron a ese pedido sin más evidencia.
- Confirmación de producto: pedidos pagados deben entrar automáticamente en **Nuevos**, sin botón administrativo. Las transferencias requieren acreditación bancaria real verificada manualmente, no un comprobante; impagos apartados. No liberar trabajo basándose solo en la vuelta del navegador a MP.
- **Corrección implementada:** el endpoint HMAC de estado cliente ejecuta respaldo idempotente ante cobros pendientes: consulta la API autenticada de Mercado Pago cada 25 segundos como máximo por orden (bloqueo persistido en D1), valida el pago con la rutina `reconcilePayment` existente y relee D1 + `payment_reviews.verified` antes de informar `pagado`. Si falla proveedor, mantiene pendiente y el cron puede reintentar. No acepta señal de pago del navegador. Pruebas automatizadas `tests/tus-pagos-autoconciliacion-cliente.test.mjs` y suite completa aprobadas, Actions 41846960392.
- **Central desplegada:** versión `5922e84c-d26b-4dc9-b0c7-53a92ec3c210`, Actions 41847131990 **SUCCESS** (HTTP 401 sin admin, health OK, pagos reales OFF, sin cambios a sitio público). La bandeja de estado interno `pendiente` ahora se titula **«Nuevos · pagos confirmados»**. La sección de transferencias se denomina **«Transferencias por verificar · Acreditación bancaria manual»**.
- **Estado faltante:** no hay prueba humana nueva de pago E2E que demuestre que ya entra sin pulsar manualmente. El respaldo responde a las consultas automáticas del cliente mientras la pestaña original está abierta; el webhook y el cron deben continuar procesando pagos aunque el cliente cierre el navegador. Falta confirmar entrega/validez de webhook real y causa del error cron. No declarar integración final hasta esas pruebas.
- **Transferencias:** existen solicitud y listado pendientes en el sistema privado, pero todavía falta un flujo de confirmación de acreditación bancaria por operador que dé autorización trazable de producción. No presentarlo como completado ni activar transferencia con alias real por accidente.
