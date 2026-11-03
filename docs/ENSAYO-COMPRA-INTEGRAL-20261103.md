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
