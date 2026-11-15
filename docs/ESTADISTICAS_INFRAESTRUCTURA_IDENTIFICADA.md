# Infraestructura verificada para estadísticas — 15/11/2026

## Evidencia revisada

- Captura de Cloudflare: Worker activo `saber-pagos-produccion`, versión `db857535`, 100% del tráfico en la vista de implementación.
- Captura de vinculaciones del Worker de pagos: D1 binding `DB` → base `saber-pagos-produccion`; service binding `SABER_DOCUMENTOS` → Worker `saber-documentos-produccion`.
- Código copiado del Worker de pagos y del Worker de documentos desde sus editores Cloudflare.
- Repositorio `hernanchan/COTIZADOR`, PR #24, rama `feat/estadisticas-comerciales-20261115`.

## Rutas, Central y autenticación

- El Worker de documentos sirve `/cotizar`, `/pedido/continuar` y `/pedido/estado` bajo las compuertas de producción del propio Worker.
- La Central de personal y sus API viven bajo `/personal/` en el Worker de documentos.
- El router exige el gate de personal y HTTP Basic; valida el usuario `operador` contra un secreto de entorno, y devuelve el desafío `WWW-Authenticate` si no está autorizado. Las respuestas privadas usan `no-store`.
- El Worker de documentos envía operaciones internas al Worker de pagos mediante `SABER_CENTRAL` y firma HMAC con el binding `CENTRAL_BRIDGE_KEY`.
- En el Worker de pagos, las consultas de administración existentes validan el token del panel; las rutas internas LIVE validan además la firma HMAC y el esquema esperado.
- Las consultas de estadísticas deben añadirse a este router y reutilizar la autenticación real; no abrir un endpoint público paralelo.

## Pedidos y pagos confirmados

- D1 contiene las tablas comerciales existentes `orders` y `payment_reviews`.
- Un pago de Mercado Pago se marca pagado después de validar la firma del webhook, pago aprobado, vendedor, referencia, importe/orden y ausencia de duplicado; la actualización escribe `orders.status='paid'` y una revisión `verified`.
- Una transferencia se marca pagada desde la ruta firmada de aprobación del personal, tras conciliar orden e importe; también escribe la acreditación y revisión `verified`.
- Por tanto, el panel puede contar pedidos pagados desde `orders` unido a `payment_reviews` en estado `verified`. No debe contarlos desde eventos enviados por el navegador.
- El código del cotizador ya emite `page_view` y algunos eventos a Google Analytics. Esos datos no se escriben en D1 y no sustituyen el embudo de sesión requerido.

## Estado y límites

- El módulo estadístico actualizado está en el PR #24. Ningún Worker lo importa todavía.
- La migración `saber_analytics_events` no se ejecutó en ninguna D1.
- No se cambió código, configuración ni tráfico de producción.
- No se verificó una relación persistente y segura entre sesión y pedido. Conversión visitante→comprador y abandono de la etapa de pago deben permanecer sin porcentaje hasta tenerla.
- La compilación de `saber-pagos-pruebas` del último SHA falló; el check de GitHub no expone la causa. No afirmar que exista una vista previa funcional hasta diagnosticar ese build.

## Próximos pasos

1. Adaptar ingesta del Worker de documentos → ruta interna HMAC en pagos, con validación, límite de tasa e idempotencia.
2. Añadir resumen de pagos verificados al endpoint interno y la pestaña Estadísticas protegida por el gate real de personal.
3. Programar purga diaria a 90 días en entorno de pruebas.
4. Ejecutar migración y pruebas sólo en D1/Workers de pruebas; verificar escritorio y móvil.
5. No fusionar ni desplegar producción sin autorización explícita para el SHA final y el procedimiento del contrato de cambios.