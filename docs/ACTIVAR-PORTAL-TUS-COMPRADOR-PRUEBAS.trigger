ENABLE_CUSTOMER_TUS_PORTAL_ON_PRIVATE_WORKER_ONLY
Fecha: 2026-11-06
Branch: integracion/tus-pedido-privado-20261101
Contrato: V3 => comprador Turnstile => TUS existente => D1 => Mercado Pago Sandbox => Central/seguimiento.
Última CI comprobada: https://github.com/hernanchan/COTIZADOR/actions/runs/42233639179 (SUCCESS).
Cambios permitidos: SOLO saber-documentos-pruebas; nueva variable DOCS_PUBLIC_ORDER_GATE_ENABLED=PRIVATE_TEST_ONLY.
Main, web pública, MP real y todos los interruptores de borrado: SIN CAMBIOS (OFF).
Control: rollback del Worker si el smoke de acceso, V3 o privacidad falla.
Reintento controlado 2: dependencias de test instaladas, deploy anterior no ejecutado (fallo antes de tocar Cloudflare).
Reintento controlado 3: corregida la consulta jq sobre bindings de Cloudflare; anteriores ejecuciones no llegaron a desplegar.

2026-11-06: DOCS_TUS_PDF_MIB=40; CENTRAL_TUS_MIB_40_VERIFIED; ONLY_TEST_WORKER.

2026-11-06: UI_PUBLICA_ALERTA_ROJA_PDF_NO_ADMITIDO; NO_CAMBIAR_CUPOS_PRECIOS_PAGOS; CI_SUCCESS_42241817416.
