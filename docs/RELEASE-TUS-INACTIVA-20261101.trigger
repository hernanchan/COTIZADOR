# Evento único de preparación de versión TUS privada.
Fecha: 2026-11-01
Worker: saber-documentos-pruebas
Rama: integracion/tus-pedido-privado-20261101
Autorización: trabajo en ambiente privado sin cobros
Compuerta TUS: deshabilitada hasta tener variables seguras y ensayo
Operación Github Actions: POST /versions?bindings_inherit=strict
PROHIBIDO: /deployments, www.libreriasaber.com.ar, main, Mercado Pago

Segunda ejecución: dependencias unitarias instaladas en raíz (corrección fallo inicial sólo de CI); ninguna versión activada previamente.

Nueva ejecución solicitada tras corrección SHA y prueba D1: commits 95ebb6d2 y 0d653750. Preparar versión SIN activar tráfico; verificar CI y compilación.

01/11/2026: tras guardar DOCS_TUS_PRIVATE_ENABLED, DOCS_TUS_PUBLISHABLE_KEY, DOCS_TUS_SUPABASE_SERVICE_KEY y DOCS_TUS_RECEIPT_KEY, preparar nueva versión INACTIVA. CI verifica presencia y tipo de las 4 variables sin exponer valores; no publicar, no promover tráfico.

01/11/2026 — Diagnóstico modo seguro: captura de ensayo V2 confirma LECTURA_DRIVE y Turnstile, Supabase Storage sin objetos nuevos. Nueva compilación TUS con bloqueo explícito ante requisitos inválidos y listado de NOMBRES sin valores secretos. Primero preparar versión INACTIVA, NO promover tráfico hasta prueba controlada. Commits código: 46288b2d, f77336d8, 852d7cef, 2f161b09.
