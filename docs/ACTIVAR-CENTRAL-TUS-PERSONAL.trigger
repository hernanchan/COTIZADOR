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

2026-11-02 — Desplegar exclusivamente saber-pagos-pruebas commit 1e74da2: ruta preflight/payment-sandbox-prepare agregada pero inhabilitada sin DOCS_SANDBOX_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY. Probar 401 admin y health paymentsEnabled=false; rollback automático. No habilitar flag de pago, no hacer preferencias ni modificar producción.

2026-11-02 — Actualizar solo Worker saber-pagos-pruebas con cierre de bypass de preflight D1, commit 189c512, CI aprobado 41452231699. Rollback automático y HTTP401/health obligatorios. DOCS_SANDBOX_CHECKOUT_ENABLED permanece sin activar; no cobrar ni tocar web pública.

2026-11-02 — Desplegar solo saber-pagos-pruebas la Central con acción de enlace de prueba Mercado Pago para documentos, protección contra pedido mixto Express y reutilización de preferencias. CI 41455248120 aprobado. Mantener compuerta sandbox actual sin cambios y pagos comerciales deshabilitados. Rollback y verificaciones HTTP401/health obligatorios.

2026-11-02 — Reintentar despliegue SOLO de la Central de pruebas: corrección de layout de PDF y enlace sandbox, CI global 41455441360 aprobado. Mantener cerradas las compuertas de cobro; rollback automático y health obligatorio.

2026-11-04 — DESPLEGAR SOLO saber-pagos-pruebas: ficha Central de anillado conjunto con integrantes, orden, hojas y juegos derivados de manifiesto D1; sin alterar MP, transferencias, cobro ni base de pedidos. CI 41928147607 SUCCESS. Verificar HTTP 401 y health paymentsEnabled=false, con rollback; web comercial intacta.

2026-11-04 — Actualización de interfaz de referencias bancarias, solo Central de ensayos. CI 41931816288 SUCCESS. Conserva configuración y reversión.

2026-11-04 — Habilitar SOLO el módulo de preparación estimada en pruebas privadas, luego de CI 41941608715 SUCCESS. Preservar flujo de pagos, tarifas D1, acceso Basic y controles de rollback. Sin publicar main o web comercial.

2026-11-04: activacion aislada de seguimiento HMAC y demora global configurable con CI 41955189605 aprobado. Mantener seguridad y rollback, cobros reales desactivados y main intacto.

2026-11-05 — ACTIVAR SOLO saber-pagos-pruebas: calendario laboral manual por día, feriados/cierres con revisión y auditoría D1, cálculo ETA sin acumular horas por orden, mensajes prudentes de seguimiento móvil. Código ya aprobado CI 42010358018 (203 pruebas), SHA d8e6e204. Mantener HTTP401 admin, health paymentsEnabled=false, rollback automático. NO cambiar portal documental Basic, main, web pública ni cobros comerciales. Horarios quedan sin configurar hasta verificación humana.

2026-11-05 — ACTIVAR EXCLUSIVAMENTE Central privada: nueva emisión de accesos temporales móviles de un solo uso, ticket SHA256 en D1, vigencia tres minutos y consumo atómico vía HMAC entre Workers; botón visible solo para operador con clave de la Central. CI integral 42012738267 SUCCESS (209 pruebas del grupo principal). No revelar Basic ni crear passwords; no tocar main, web pública, pagos reales, tarifario o Worker documental en este trigger. Verificar 401 + /health y rollback automático.

2026-11-05 — ACTIVAR SOLO Central privada: lector de carga por recursos con conteo de órdenes pagadas verificadas en producción (documentos, anillado, CAD, póster y fichas que requieren revisión), y calibración independiente 0..30 de trabajos simultáneos por recurso, guardada con responsable/revisión y eventos D1. Valores por defecto 0=sin calibración; todavía NO afectan plazos ni prometen duración productiva. Suite integral CI 42014430034 SUCCESS: 214+96+4+3 controles, sintaxis, build. Verificar HTTP401/health, rollback, paymentsEnabled=false. No tocar Worker documental, main, sitio público ni pagos reales.

2026-11-05 — DESPLEGAR SOLO saber-pagos-pruebas, nueva cola por recursos: tras calibración explícita, los pedidos pagados y verificados anteriores y los ya EN PREPARACIÓN ocupan plazas de impresión, anillado y ploteos; CAD/Póster comparten recurso sin duplicarse; capacidad 0 o manifiesto incompleto NO origina plazo calculado; saturación obliga a revisión. La demora global de 3 horas NO se suma por pedido y el horario debe estar configurado para mostrar una fecha; prioridad manual intacta. CI 42022818989 SUCCESS, 220 controles en suite principal y validación completa. Verificar HTTP 401 administrativo, /health paymentsEnabled=false, rollback; sin tocar documentos Worker, main, web comercial ni cobros.

2026-11-05 — ACTIVAR EXCLUSIVAMENTE Central privada el registro interno de MEDICIONES REALES por recurso (B/N, color, anillados, CAD y póster) y acceso guiado a borrador de horario semanal. Esta nueva tabla D1 solo acepta registros manuales confirmados y NO altera las duraciones ETA ni el precio. CI integral 42026239201 SUCCESS, commit de implementación/corrección 71c9c2cb845215992efe264689aad13a00fb25e9. Mantener cupos actuales, agenda actual, pagos desactivados, cliente protegido. Rollback HTTP401 y health obligatorio. No modificar Documentos Worker, main, web comercial, cobros, promociones ni secretos.

2026-11-05: Actualizar únicamente Central privada con agenda confirmada (lunes a viernes 07:00-13:30 y 16:30-20:00; fin de semana cerrado), feriados editables y lectura separada de carga B/N-color. Sin alterar plazos, cupos existentes ni pagos. CI 42029051450 aprobada. Revertir si fallan las comprobaciones de seguridad.

2026-11-05 — Activar solo la Central privada el selector comercial de franja tras pago (hoy, hoy por la tarde, próximo día de atención o a confirmar), con auditoría D1 y protección de operador; hora individual únicamente cuando se registra desde seguimiento de producción. No publicar sitio comercial ni activar cobros. CI 42032264451 SUCCESS; código b2734ace, tests 5c34d433, documentación c7af8abf. Verificar autenticación HTTP401 y pagos desactivados; rollback automático ante fallo.
