# Librería Saber — PDF compuesto privado vinculado a Central D1

**24 de octubre de 2026.** Rama aislada `polaroids/express-pdf-unico-20261023`. No implementado en Cloudflare o Google remotos. Ningún cambio en `main`, `libreriasaber.com.ar`, cuentas de cobro ni recepción de clientes.

## Circuito implementado

1. El Worker documental de pruebas verifica desde Google Apps Script (HMAC) los bytes y páginas del PDF original y recalcula el presupuesto. Conserva `carasPresupuestadas` y `paginasPorCaraPresupuestadas` en la ficha técnica. Por ahora **el flujo de PDF compuesto admite una página por cara**, pues no corresponde cotizar 2/4/9 con el precio de una imposición no prevista.
2. El Worker firma y registra el manifiesto del PDF original en D1 mediante el Service Binding `SABER_CENTRAL`. Sin confirmación del registro original, no intenta la vinculación final.
3. Compone el PDF de impresión vectorial conforme a la ficha, lo sube en fragmentos al receptor privado de Drive aislado y comprueba el SHA-256 completo, el tamaño y número de caras. El receptor entrega un comprobante privado sin enlaces ni contenido descargable.
4. El módulo `integraciones/autocotizador/recepcion/registrar-pdf-compuesto-central.mjs` crea otra solicitud HMAC mediante el mismo Service Binding, sin exponer contenido al navegador. La Central recibe `POST /internal/central/stage-print-draft`, valida el recibo original registrado y la ficha del trabajo documental (`documentos`), calcula las caras esperadas según páginas elegidas, copias y simple/doble faz, y crea un único registro en `central_document_print_drafts`.
5. La tabla D1 une `receipt_id` del borrador con `original_receipt_id`, `file_id` y `web_order_id` originales, conservando unicidad por trabajo y prohibiendo sobrescribir un borrador diferente. El pedido comercial, cuando existe, se recupera por `central_document_manifests.commercial_order_id`. Sin pago se mantiene `stored_private_unpaid`.

## Seguridad y garantías

- Acceso **sólo entre Workers mediante HMAC y Service Binding**. `centralReadSigned` valida tiempo, firma y ausencia de cabecera `Origin`. Una referencia inventada de recibo, un original de otro pedido, un cambio de copias/dúplex o una repetición con otro hash devuelven error.
- Interruptores independientes, **sin activar remotamente**: `CENTRAL_BRIDGE_ENABLED=PRIVATE_TEST_ONLY`, `CENTRAL_PRINT_DRAFT_STAGE_ENABLED=PRIVATE_TEST_ONLY`, `DOCS_CENTRAL_SYNC_ENABLED=PRIVATE_TEST_ONLY`, `DOCS_PRINT_DRAFT_ENABLED=PRIVATE_TEST_ONLY` y `DOCS_PRINT_DRAFT_CENTRAL_ENABLED=PRIVATE_TEST_ONLY`. Además el Apps Script nuevo requeriría su bandera propia `DOCS_PRINT_DRAFT_ENABLED=PRIVATE_TEST_ONLY` en propiedades privadas.
- La ruta del Worker documental `/api/ensayo-guardar-pdf-compuesto` exige autenticación administrativa `DOCS_CENTRAL_ADMIN_KEY`. No responde con PDF/base64, URL de Drive ni credenciales.
- No se almacena el contenido de los PDF en D1, solo hashes, páginas y referencias privadas. No se activan órdenes de impresión, descarga para operador ni cobros; el pago total y ausencia de devolución deben comprobarse antes de diseñar la futura ruta de descarga.

## Evidencia reproducible

La prueba `tests/central-bridge-d1.test.mjs` ejecuta **la implementación real del Worker Central** contra SQLite con esquema D1: confirma el registro previo del manifiesto, rechaza firma ajena, `Origin`, archivo cruzado, páginas incompatibles, banderas de pago falsas y borrador distinto; acepta el mismo borrador idempotentemente. Verifica que la asociación continúa después de crear una orden comercial de documentos, sin `preference_id` de Mercado Pago.

Además, las pruebas existentes recorren original en Drive simulado → verificación → PDF vectorial compuesto → recepción resumable en Drive simulado con hash SHA-256; la compilación del Worker documental se ejecuta en CI. **Estas simulaciones no sustituyen una prueba real en servicios cloud**. Véase la ejecución reciente de `polaroids-express-ensayo.yml` para determinar la última conclusión aprobada.

## Pendientes para llegar a producción

Falta instalar y ensayar en Cloudflare + Apps Script + Drive **reales y privados**, autorizar después la integración con el centro de pedidos y diseñar la descarga **solo al operador autenticado** cuando el pago completo esté vigente y el PDF imprimible sea confirmado. Las impresiones 2/4/9 por cara necesitan paridad comercial de la cotización; los PDF de planos/póster, stickers y gráficos específicos tienen producción propia y no deben pasar silenciosamente por este compositor documental. Quedan pendientes pruebas desde móvil, fuentes, márgenes físicos, salida de plotter, limpieza de temporales y límites de cuota.
