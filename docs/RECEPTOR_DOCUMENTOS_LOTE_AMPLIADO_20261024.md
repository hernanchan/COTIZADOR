# Librería Saber — receptor documental ampliado (solo ensayo aislado)
Fecha: 24/10/2026. Rama: `polaroids/express-pdf-unico-20261023`.

## Objetivo
Sustituir **en un NUEVO Apps Script aislado**, nunca en el receptor que funciona ni en la web pública, el límite histórico FASE4 de cinco PDF de 1 MiB por una capacidad de laboratorio de **hasta 30 PDF por pedido, 20 MiB por archivo y 60 MiB acumulados por pedido**. El máximo global de sesiones recientes es 120; vencen del índice a los seis días. No se elimina ningún PDF automáticamente de Drive: limpieza/retención aún pendiente, igual que la medición de tiempos reales.

## Archivos creados o actualizados
- `integraciones/autocotizador/recepcion/DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs`: fuente completa de Apps Script para nueva implementación privada. Mantiene firma HMAC previa, estados y fragmentos de subida de 512 KiB, permite identificadores únicos por PDF, valida cuota global y por pedido, y recupera mediante HTTP Range **206** exactamente 256 KiB por respuesta, en lugar de descargar cada vez el PDF completo. No contiene credenciales.
- `integraciones/autocotizador/recepcion/fase4-ficha-central-lote-privada.mjs`, `leer-pdf-fase4-privado.mjs`, `worker-fase4-cotizador-unificado.mjs`: capacidad optativa 30 × 20 MiB tras `DOCS_EXTENDED_RECEIVER_ENABLED=PRIVATE_TEST_ONLY`; de manera predeterminada conservan 5 × 1 MiB. El worker conserva segundo control `DOCS_CENTRAL_SYNC_ENABLED` para alta D1 y no autoriza checkout.
- `integraciones/autocotizador/pruebas/cotizacion-multifichero-piloto.mjs`: cuotas explícitas y coherencia de referencia compartida entre archivos nuevos, preservando el piloto viejo de cinco recibos independientes.
- `integraciones/autocotizador/recepcion/pantalla-lote-pdf-ampliado.mjs`: pantalla aislada con cola de archivos, máximo 30 y total 60 MiB, referencia del pedido compartida y `fileId` calculado de SHA. **No es la interfaz comercial definitiva**, y continúa requiriendo avanzar archivos de la cola y validar Turnstile en cada inicio.

## URLs de ensayo (NO publicadas)
El código prepara `GET /prueba-cotizador-lote-ampliado`, `POST /api/ensayo-pdf-ampliado` y `POST /api/ensayo-cotizar-lote-ampliado`. Responden deshabilitados salvo el nuevo interruptor privado y los requisitos existentes de origen/Turnstile, HMAC, proyecto de pruebas y recepción. Sin despliegue de Worker ni Apps Script nuevos, estas rutas **no existen en el entorno remoto**.

## Pruebas
- `tests/autocotizador-gas-lote-ampliado.test.mjs`: 30 archivos y rechazo del 31, mismo archivo idempotente, 20 MiB individual, 60 MiB por pedido, lectura de 256 KiB por Range y rechazo del Content-Range alterado.
- `tests/autocotizador-lote-ampliado.test.mjs`: presupuesto 30 PDF de un pedido, rechazo de archivo repetido o de otro pedido y garantía de cuota anterior.
- `tests/autocotizador-lote-ampliado-pantalla.test.mjs`: rutas aisladas, nueva referencia compartida, formato de carga, JS de navegador y cobros desactivados.
- Incluidas en el workflow `.github/workflows/polaroids-express-ensayo.yml` junto a compilación del Worker documental, tests de D1, pagos deshabilitados y Express.

## Requisitos para un primer ensayo real (NO ejecutar sin autorización)
1. Crear un **nuevo** proyecto Apps Script con carpeta privada dedicada en Drive y claves separadas del receptor actual; instalar el fuente ampliado. No tocar ni reemplazar `Sin título` v5 o cualquier GAS utilizado por clientes.
2. Desplegar únicamente Worker `saber-documentos-pruebas` desde bundle nuevo, con `DOCS_SCRIPT_URL` apuntando al nuevo GAS, `DOCS_RELAY_KEY` correspondiente y `DOCS_EXTENDED_RECEIVER_ENABLED=PRIVATE_TEST_ONLY`; no cambiar producción ni cobros. Conservar variables de alojamiento autorizadas.
3. Cargar primero 2 PDF de 2–5 MiB y luego 10 PDF, verificar tiempos por etapa, integridad SHA, páginas, importe y mismo `WEB-`. Probar reintento luego de cortar la conexión. Revisar uso de Apps Script/Drive y los límites gratuitos antes de ampliar el ensayo.
4. Mantener `DOCS_CENTRAL_SYNC_ENABLED`, `DOCS_MIXED_PREPARE_ENABLED` y pagos apagados hasta que Google y D1 reales queden comprobados. No convertir esta versión de laboratorio en pública por el mero CI aprobado.

**Pendientes prioritarios de lanzamiento integral:** JPG/PNG y conversión controlada, carga/recuperación desde móvil sin pasos repetidos, rendimiento real (los 40 fragmentos de un archivo de 20 MiB no prometen cargas rápidas), retención y limpieza, composiciones imprimibles, verificación de todos los materiales y opciones del cotizador, carrito público y pagos únicamente tras conformidad final.


## Verificación CI efectiva

**24/10/2026.** Tras corregir una aserción de prueba sobre el texto de cuota excedida, la corrida **40143286602** completó con `success` en GitHub Actions, commit `3b13f46266f9846ac8d78832a56e2544249dee07`. Se inspeccionaron los pasos: compilación Worker documental unificado, validación de interfaz ampliada/JavaScript, cotización de 30 PDF y regresión del viejo límite de cinco, simulación del GAS ampliado con Range y cuotas, D1 y comunicaciones internas. Todos finalizaron sin fallos. 

https://github.com/hernanchan/COTIZADOR/actions/runs/40143286602

**No equivale a prueba remota.** Ningún Apps Script nuevo ni Worker fue desplegado; la versión original mantiene su límite de cinco PDF de 1 MiB. La página `/prueba-cotizador-lote-ampliado` y sus API siguen únicamente en la rama, detrás de `DOCS_EXTENDED_RECEIVER_ENABLED=PRIVATE_TEST_ONLY` (sin activar). La prueba no midió tiempos reales, reposo móvil o subida simultánea de diez archivos.
