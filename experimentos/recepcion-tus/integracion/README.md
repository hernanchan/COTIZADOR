# Integración privada de recepción TUS — código EN RAMA, NO DESPLEGADO

**Estado 01/11/2026:** flujo de transporte TUS con Supabase validado con 2 PDF reales (17,02 MiB + 9,66 MiB; 9,95 s total, hash y páginas correctos, archivos posteriormente borrados). El código de **esta carpeta** es un contrato aislado para integrar ese transporte en el Worker privado sin recurrir a Google Drive. **No representa un pedido D1 funcionando.**

## Lo implementado en esta carpeta

- `contract.mjs` exporta `validateManifest`, `reconcileVerifiedObjects` y `stagePrivateTusOrder`.
- Requiere identificador de pedido y de cliente verificables, entre 1 y 30 archivos con referencias únicas, SHA256, páginas (1-2000), tamaños <=20MiB cada uno y <=60MiB totales, bucket privado y comprobantes originados en **servidor**.
- Verifica primero **todos** los objetos con una función backend inyectada, después solicita precios **recalculados en servidor**, por último llama una sola vez a un callback idempotente de registro en Central D1. Prohíbe cualquier autorización de checkout/pago/producción. Un fallo en PDF o precio impide siquiera llamar al callback D1.
- Módulo puro, **sin rutas públicas, sin claves, sin conexión real a D1 ni a Supabase**. Los `proofs` de la función `verifyFromPrivateBucket` deben proceder de la descarga real y SHA/parseo de Supabase, NO del navegador.

## Lo que falta ANTES de declarar el cotizador operativo

1. **Conexión real privada:** adaptar detrás de flag `RECEPCION_TUS_LAB` el Worker `integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs`, con una autenticación de sesión coherente y firmas de Supabase emitidas exclusivamente por servidor. Nunca exponer service_role o tokens de personal.
2. **Verificador independiente:** cambiar la prueba con borrado instantáneo por almacenamiento temporal retenido; devolver comprobantes privados con SHA/pages/bytes desde lectura de los objetos reales. Nunca dar por verificado el PDF con parámetros cliente.
3. **Presupuesto real:** conectar `quoteOnServer` a las reglas de impresión y ploteo **existentes**, sin nuevas tablas de precios ni descartar opciones del usuario. Debe mantenerse la regla de precio definido por el backend.
4. **Registro D1:** adaptar `createOrderOnce` a la Central actual con operación idempotente y conciliación única `clientOrderId+webOrderId`. El endpoint de `/api/ensayo-preparar-documentos-v2-lote` hoy exige comprobantes **DOC- de Google**, por tanto **NO acepta** el contrato nuevo y no debe engañarse falsificando esos recibos. Es necesario un camino nuevo de registro seguro que conserve los archivos de Supabase y permita descargarlos al personal.
5. **Descarga Central privada y retención:** sin enlace público, vencimiento y limpieza de abandonos, cuota y control de costos.
6. **Pruebas E2E:** repetir 2/2 (luego 5-10), registro único D1, importe correcto A4/A3/ploteos, recuperación tras corte/duplicación y acceso real a descargar documentos, sin activar cobros.

## Pruebas efectuadas

- `tests/smoke.test.mjs`: 5 tests estáticos de manifiestos y reconciliación. 
- Función de integración probada en V8 con el contenido **real recuperado de GitHub**: 8/8 condiciones cumplidas (verifica datos, rechaza hashes falsos y PDFs no privados, y respeta orden `verificar → cotizar → D1`).
- Prueba Node local adicional del diseño inicial: 9/9 pruebas, no incluida en GitHub por no corresponder exactamente al código actual. **Estas pruebas simulan callbacks** y no prueban endpoints D1 ni cotizador completo.

**Restricción inalterable:** no modificar `COTIZADOR/main`, `libreriasaber.com.ar`, pagos, Polaroids, Worker activo ni GAS sin autorización y validación real. El usuario autorizó avanzar el proyecto; la falta de despliegue debe declararse explícitamente. 
