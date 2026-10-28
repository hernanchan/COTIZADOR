# Continuidad — lote concurrente — 28/10/2026

El usuario confirmó «implementdo» después de recibir instrucciones para promocionar al 100% la versión Cloudflare `5fcfcf56-52b8-471e-ac59-5ac9a50182ac` del Worker privado `saber-documentos-pruebas`. Confirmación del usuario, sin readback independiente todavía. Captura previa mostraba versión activa `0ba27539` tras actualización de `DOCS_SCRIPT_URL`, y versión anterior funcional `b7f58caf-7ca4-4abf-8e05-9694fa9593fd` disponible como recuperación.

Google Apps Script receptor «Receptor ampliado 30 PDF - pruebas privadas»: versión 8 instalada según captura; `DOCS_SCRIPT_URL` se corrigió al prefijo `AKfycbyIQA...` según captura. Verificar que se conserve tras la promoción.

**Pendiente inmediato:** comprobar tráfico 100% a `5fcfcf56` y binding del receptor; realizar UNA prueba real de dos PDF desde `/prueba-v2/?diagnostico=1`, comprobar ambos recibos SHA/Drive, precio del servidor, un solo registro D1 y tiempos. Mantener pagos apagados. Si falla, diagnosticar y revertir a `b7f58caf` sin borrar sesiones comprobadas. No repetir CI (113 pruebas aprobadas). No tocar `main`, web comercial ni Polaroids.

Registros relacionados: `docs/ETAPA1-IMPRESIONES-PLOTEOS-CIERRE.md` y `docs/PLAN-LOTE-CONCURRENTE-PDF-20261028.md`.
