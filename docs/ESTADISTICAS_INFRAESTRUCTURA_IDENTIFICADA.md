# Infraestructura localizada para estadísticas — 15/11/2026

Fuente inspeccionada: `integraciones/publicacion/monitor-postpublicacion-20261112.mjs` (rama main).

## Identificaciones respaldadas por código
- Dominio comercial: `https://pedidos.libreriasaber.com.ar`.
- Worker de pagos y Central: `saber-pagos-produccion`.
- Worker de documentos: `saber-documentos-produccion`.
- D1 productiva: `saber-pagos-produccion` (localizada por nombre en el monitor).
- Enlace interno de documentos a Central: binding `SABER_CENTRAL` de tipo service hacia `saber-pagos-produccion`.
- Acceso de personal comprobado por monitor: `/personal/api/live-r2-inspection-original`, exige autenticación (401 sin sesión).
- Rutas públicas comprobadas por monitor: `/cotizar`, `/pedido/continuar`, `/pedido/estado`.

## Restricciones para la siguiente integración
- **No** ejecutar la migración SQL contra la D1 productiva sin aprobación explícita y plan de reversión.
- **No** publicar endpoints en el Worker de pagos ni de documentos sin recuperar primero su código fuente vigente y verificar su autenticación y enrutamiento.
- El archivo de monitor acredita nombres y verificaciones esperadas, pero no prueba por sí solo el estado actual de despliegue ni aporta el código fuente del Worker.
- Los datos de pedidos y pagos confirmados se extraerán del servidor, nunca de eventos del cliente.
- El panel debe utilizar el control de acceso existente en `/personal/`, sin una ruta pública paralela.

## Pendientes técnicos
1. Recuperar fuente o versión de `saber-pagos-produccion` y `saber-documentos-produccion`.
2. Ubicar el controlador real de la Central y la ruta de autenticación.
3. Verificar esquema D1 existente para evitar colisiones.
4. Adaptar eventos y consultas al Worker real, probar en staging y solicitar autorización del PR.
