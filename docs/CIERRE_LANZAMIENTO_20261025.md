# Cierre de lanzamiento — Librería Saber (25/10/2026)

**Rama de trabajo:** `polaroids/express-pdf-unico-20261023`. **No es aprobación de salida.**
**Regla:** no reemplazar el cotizador comercial vigente hasta completar todas las pruebas bloqueantes. No publicar ni habilitar cobros por inferencia de CI.

## Evidencia existente, sin exagerarla
- GitHub Actions `polaroids-express/ci`: valida módulos en Node y simulaciones. Última ejecución previa al presente control aprobada: https://github.com/hernanchan/COTIZADOR/actions/runs/40200681200
- V2: lectura de PDF, recepción fragmentada simulada, cotejo SHA/páginas y presupuesto de servidor con catálogo original. **No** hay pedido D1 para cada renglón V2; el portal usa carrito temporal en memoria.
- Central: rutas `/internal/central/stage`, `prepare-order`, `prepare-mixed-order`, PDF privado y firmas HMAC implementadas; pruebas con D1 SQLite local y servicios simulados.
- Express: motor de PDF único real probado; la recepción pública sigue apagada.
- Mercado Pago: hubo ensayo sandbox histórico de catálogo; no es certificación de cobros integrados de documentos + Express.

## Bloqueos de salida (todos deben resolverse y quedar evidenciados)
- [x] **P0 Auditoría real Cloudflare de solo lectura (25/10):** ejecución aprobada https://github.com/hernanchan/COTIZADOR/actions/runs/40202805405. `saber-pagos-pruebas` tiene D1 y CENTRAL_BRIDGE_KEY; `saber-documentos-pruebas` dispone de DOCS_SCRIPT_URL, DOCS_RELAY_KEY, origen y Turnstile, pero **no tiene `SABER_CENTRAL` ni `CENTRAL_BRIDGE_KEY`**, ni las banderas/contraseña del portal V2. El Worker documental no puede preparar un pedido D1 con esta configuración. El CI exitoso certifica la auditoría GET, NO que la integración esté habilitada.
- [ ] **P0 Conectividad Documentos → Central:** configurar en el Worker documental aislado el Service Binding `SABER_CENTRAL` apuntando solo a `saber-pagos-pruebas` y una clave compartida distinta de secretos de Google y administración. Verificar permisos/rutas y endpoints firmados mediante ensayo privado; NO habilitar recepción ni checkout público. Requiere autorización y acceso de escritura a Cloudflare; el token actual es de solo lectura.
- [ ] **P0 Despliegue privado autorizado:** código exacto de la rama empaquetado e instalado en Worker documental de pruebas; revisar rutas y compuertas, sin tocar dominio comercial.
- [ ] **P0 Recepción real:** PDF A4 y A3 desde PC y móvil a GAS/Drive aislado; validar fragmentos, reanudación, SHA, páginas, tiempos y cupo sin R2.
- [ ] **P0 Paridad comercial:** seis familias existentes, precios, variantes, mínimos, promociones diarias, cupones, materiales, anillado, selección de páginas, CAD/póster; comparar cotizador original y nuevo en casos representativos. Igualdad aritmética de dos importes no equivale a paridad.
- [ ] **P0 Pedido persistente unificado:** conectar cada renglón V2 verificado al manifiesto y pedido D1, con recálculo de servidor; restaurar carrito en móvil tras suspensión/cambio de pantalla y evitar duplicados.
- [ ] **P0 Polaroids real:** subir lotes de 6 a 24 fotos distintas, confirmar PDF A4 privado único por pedido, cotización, reintento y referencia D1; ningún PDF descargable por comprador.
- [ ] **P0 Checkout:** ensayo completo en sandbox de carrito mixto; verificar vendedor, importe total, notificación, reintento, devolución y bloqueo hasta constancia de pago.
- [ ] **P0 Central operador:** solo pedidos pagados sin devolución; PDF final imprimible vinculado al recibo, descarga privada autorizada, instrucciones de anillado/plotter; no liberar solo por recibir original.
- [ ] **P0 Seguridad:** acceso privado, Turnstile, HMAC, origen, límites, cuotas, prohibición de compartir claves, separación de entornos, no exponer Drive ni PDFs.
- [ ] **P0 Operación y salida:** ensayo Chrome/Android con múltiples archivos, cancelación y reposo; comprobar texto de precios, política de seña/pago total, rollback probado; aprobación explícita del titular antes de producción.
- [ ] **P1 Mantenimiento:** purga segura de pruebas/abandonados, monitoreo de errores y cupos, dependencia de librerías PDF externas y pruebas de impresión física.

## Decisión actual
**NO-GO para lanzamiento 100 % integrado.** No porque fallen las pruebas locales: faltan pruebas reales en servicios remotos y el carrito comercial del V2 no está conectado todavía a D1/checkout. Mantener `main`, `libreriasaber.com.ar` y cobros públicos inalterados.

## Criterio de trabajo
Prioridad: cerrar los P0 existentes con pruebas trazables; no crear módulos paralelos. Registrar el resultado de cada prueba remota (fecha, entorno, pedido sintético, recibo, estado, bloqueo) sin escribir secretos ni fotografías reales en GitHub.
