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

2026-11-01 — Corregir NO CONSTA en órdenes nuevas: ficha servidor usa materialColor verificado, B/N estandar sin atribuir gramaje, grupoAnillado persistido en D1 y ZIP, validación de campos obligatorios. Pruebas con PDF A4/A3 reales generados y distintas opciones, sin subir archivos de clientes; desplegar sólo Central privada después de suites verdes, rollback y pagos desactivados.

2026-11-01 ~17:31 ART — A5 original: mostrar tamaño real A5 + tarifa A4 en ficha de impresión Centro, formatoFinal a5 inmutable, instructivo ZIP 'A5 sin ampliar', sin permitir imposición no verificada. Suite central requiere nuevo test A5; solo saber-pagos-pruebas, no web comercial ni pagos.

2026-11-01 — Orden para originales pequeños como 14 × 20 cm: conservar medidas por página verificadas en D1, distinguir tamaño físico personalizado de tarifa A4, incluir medidas en vista de personal y manifiesto ZIP firmado. Rechazar medidas ausentes/manipuladas; tests Central obligatorios, solo entorno privado, pagos desactivados.

2026-11-01 — Revalidar original menor que A4, 14 × 20 cm, tras actualizar test heredado de presentación A5; debe preservar medidas por página en D1 y ZIP, sin pagos ni producción, solo Central privada. Commit test de2ef457.

2026-11-01 — CIERRE PLOTEOS CAD/POSTER EN D1: conservar `planoPorPagina` verificado por servidor a partir del PDF TUS en `centralSafeManifest`, validar correspondencia número original, dimensiones, rollo y papel, bloquear si la ficha de ploteo está incompleta. Exponer detalle de cada plano en la Central y en paquete firmado ZIP. Tests: `tus-instrucciones-reales` prueba 2 páginas CAD + Poster recubierto con PDF real/firmas, `tus-paquete-manifiesto` conserva plan en respuesta firmada, `tus-zip-orden-privada` verifica instrucciones impresas. Desplegar SOLO saber-pagos-pruebas con rollback 401+health sin pagos; no main ni web comercial.

2026-11-01: Actualizar texto de Centro: el operador imprime desde Adobe los PDF originales privados; no se genera PDF compuesto. CI obligatoria, despliegue solo Central de pruebas. Codigo dd1bbb40.

2026-11-02 — Actualizar exclusivamente saber-pagos-pruebas con estados de transferencia bancaria pendiente, panel privado de conciliación y compuertas Checkout Pro todavía apagadas. Conservar D1 existente, rollback, HTTP401 y health paymentsEnabled=false. Documentos privado ya desplegado con CI 41440068092.

2026-11-02 — Conciliación legible de transferencias pendientes: mostrar número comercial ya asignado (p.ej. 009) sin escribir números ni cambiar estado de cobro. CI 41446134719 aprobada. Deploy solo saber-pagos-pruebas con rollback HTTP401, health paymentsEnabled=false, no web comercial.

2026-11-02 — Aplicar vencimiento 24 horas a solicitudes bancarias en paridad con Mercado Pago. Test D1 simulado en CI 41447987997 aprobado. Desplegar solo saber-pagos-pruebas, conservar bindings, verificar /health y rechazo HTTP401, rollback obligatorio. No activar pagos ni web pública.

2026-11-02 — Desplegar solo Central privada con endpoint admin /admin/api/central/payment-preflight: cotejo de manifiesto D1, línea documental, pedido y pago completo, sin crear preferencia Mercado Pago ni acreditar ni autorizar producción. Suite CI 41448559285 verde; rollback, health sin pagos y HTTP401 obligatorios. No web pública.
