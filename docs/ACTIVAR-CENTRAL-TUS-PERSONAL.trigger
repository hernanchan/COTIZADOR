# Activar en el Worker PRIVADO saber-pagos-pruebas la vista de descarga de PDF originales TUS.
# Tests D1 + API admin autenticada obligatorios. Desplegar 100% sólo en Worker de pruebas.
# La seguridad debe seguir devolviendo HTTP 401 sin clave y /health paymentsEnabled=false.
# Rollback automático si falla, sin cambios en main, web comercial, pagos ni Polaroids.
# Cambios: worker central c3b25caf; tests 3e0fb959; descarga Basic documentos 677fed48.
# El pedido e2d76c8b-ce1c-4daf-9030-4bd402295a68 sigue NO PAGADO.

2026-11-01 — corregir botón «Ver PDF privados»: antes escribía en una columna fuera de pantalla; ahora detalle y errores aparecen debajo del pedido pulsado, con estado de carga y botones de descarga. Sin alterar claves, pagos, Storage ni lógica comercial. Commits fecce27e y 25fb1ea3. Activar solo saber-pagos-pruebas con tests y rollback.

2026-11-01 — Publicar en Centro de Pedidos PRIVADO ficha de impresión por cada PDF con páginas, copias, B/N-color, tamaño, caras, páginas por cara, papel y anillado. Los campos ausentes se muestran como NO CONSTA; para nuevos pedidos se conserva tipoAnillado del manifiesto firmado. Botón copiar instrucciones. No autoriza impresión ni cambia pagos, precios, sitio web público. Tests D1 y client script nuevos, commits 78dfd9df f09be3cb d36f770f. Versiones solo saber-pagos-pruebas, rollback condicional.

2026-11-01 ~13:35 ART — Prueba privada para número secuencial de orden D1 (001, 002...) y manifiesto de ZIP firmado HMAC. La Central asigna número atómico en la transacción del pedido nuevo o por POST administrador idempotente al abrir pedido histórico. La ruta entre Workers nunca expone Storage. Tests tests/tus-central-staff-download.test.mjs y tests/tus-paquete-manifiesto.test.mjs antes de desplegar solo saber-pagos-pruebas; rollback y paymentsEnabled=false. Sin tocar la web pública.

CI reintento: la suite del manifiesto importa pdf-lib; ahora instalado explícitamente en workflow privado central (commit 4ae4c6c5). No publicar si fallan pruebas.

Activar Central versión de pedido corto visible también en respuesta de prepare-order, incluyendo reintentos históricos. Sin cobros, JWT privados intactos. Revalidación CI.
