# Estado verificado — limpieza de PDF al entregar (06-11-2026)

## Decisión comercial vigente
Al confirmar **Entregado** en la Central, eliminar los PDF del pedido. No mantener originales ni ZIP para reimpresión. Una reimpresión exige pedido, carga de archivos, cotización y pago nuevos. Mantener únicamente registros comerciales/fiscales y auditoría sin documentos.

## Entorno y restricciones
- Repositorio: `hernanchan/COTIZADOR`.
- Rama única intervenida: `integracion/tus-pedido-privado-20261101`; **`main` y la web pública no modificadas**.
- Cloudflare: únicamente `saber-documentos-pruebas` y `saber-pagos-pruebas`.
- MP real OFF. No habilitar cobros reales durante ensayos.
- Supabase: proyecto `qkbbqzbannyhuanngjpw`, bucket PRIVADO `saber-tus-lab`.
- Inventario SQL read-only 06/11, antes y después de los cambios: **40 objetos, 211.851.276 bytes**, 36 rutas `v2/` de 19 pedidos; **no se eliminó nada**.
- Los 40 objetos actuales son históricos/protegidos: **no son material descartable de ensayo**.

## Conexión privada ya desplegada — comprobación real
Se agregó workflow reversible, con validación de tests, compilación de Documentos, preservación de bindings existentes, comprobación de rutas protegidas y rollback:
- `.github/workflows/tus-preparar-enlace-borrado-pruebas.yml`
- Trigger `docs/PREPARAR-BORRADO-WORKERS-PRUEBAS.trigger`.
- Primer deploy: GitHub Actions [42202694785](https://github.com/hernanchan/COTIZADOR/actions/runs/42202694785) — SUCCESS.
- Segundo deploy con doble defensa canaria: [42203221268](https://github.com/hernanchan/COTIZADOR/actions/runs/42203221268) — SUCCESS.
- CI de integración al commit `aa263929f21d1f08f6dd91048a992302c9a2fc63`: [42203221421](https://github.com/hernanchan/COTIZADOR/actions/runs/42203221421) — SUCCESS.

**Versiones activadas verificadas desde Cloudflare (segundo deploy):**
- Documentos: `ca931c91-165a-45d8-9774-9036e8b8fef1`.
- Central: `9938f32f-b216-46ed-b90a-07c80ab581fc`.
- Central binding `SABER_DOCUMENTOS` → `saber-documentos-pruebas`: **PRESENTE** (metadata Cloudflare real).
- Central `CENTRAL_TUS_PURGE_QUEUE_ENABLED=OFF`.
- Central `CENTRAL_TUS_PURGE_EXECUTE_ENABLED=OFF`.
- Documentos `DOCS_TUS_PURGE_ENABLED=OFF`.
- Documentos `/prueba-v2/`: HTTP 401 sin credenciales.
- Documentos `/internal/tus-purge-delivered`: HTTP 503 al estar la limpieza apagada.
- Central ruta admin: HTTP 401 sin credenciales.
- Central health: D1 conectada, `paymentsEnabled=false`.
- Log: `SERVICE_BINDING_VERIFICADO_3_COMPUERTAS_OFF_SIN_DELETE_SIN_PAGOS_REALES`.

**No confundir:** metadata confirma binding instalado, pero el circuito completo de comunicación y borrado **todavía no fue probado en vivo**.

## Protección canaria de ensayos — código desplegado
- Central `integraciones/mercadopago/pruebas/worker.js`: añade `CENTRAL_TUS_PURGE_CANARY_ORDER` y exige coincidencia EXACTA del `WEB-ENSAYO-...` para encolar, reclamar y confirmar borrados. Ausente/incorrecta = bloquea.
- Documentos `integraciones/autocotizador/recepcion/borrado-tus-entregado.mjs`: exige `DOCS_TUS_PURGE_CANARY_ORDER` coincidente para cualquier DELETE real, y para aceptar la ruta interna.
- Tests: `tests/tus-cola-borrado-entregado.test.mjs` y `tests/tus-borrado-pipeline-extremo-a-extremo.test.mjs`, casos positivos y de intento sobre otra orden. CI SUCCESS.
- Protección canaria temporal: diseñada **solo para pruebas**. Antes de producción hay que reemplazarla por política de todos los pedidos válidos, nunca habilitarla sin verificación real.

## Estado exacto de funcionalidades
| Función | Estado 06/11 |
|---|---|
| Lógica HMAC, rutas exactas, D1 cola/reintentos/auditoría, bloqueo de ZIP tras eliminación | Código implementado; CI OK |
| Service Binding Central → Documentos | **DESPLEGADO, metadata verificada** |
| Doble bloqueo por orden canaria | **DESPLEGADO, CI OK** |
| Flags de borrado | **OFF** |
| PDF descartable creado para ensayo | **NO** |
| Orden canaria pagada/entregada creada en D1 | **NO** |
| DELETE de un PDF real, HEAD404 y verificación de orden ajena | **NO PROBADO** |
| Auditoría real de finalización en D1 | **NO PROBADA** |
| Botón “Entregado” → borrado real | **NO PROBADO** |
| Listo para activar en producción | **NO** |

## Bloqueo y siguiente procedimiento ejecutable
La Central verifica obligatoriamente pago auténtico completo, `payment_reviews=verified`, estado `entregado`, manifiesto y recibos TUS correctos. **No simular estos datos en D1 ni saltar la comprobación para forzar un resultado verde.** El token Cloudflare usado en un diagnóstico D1 anterior recibió `HTTP_401` (ver `docs/RESULTADO-D1-TUS-20261101.json`); no asumir que permite escritura de D1.

1. Crear **una orden TUS genuina y aislada** desde flujo de pruebas con un PDF sintético descartable, obteniendo `WEB-ENSAYO-...` y recibos de la propia aplicación. Confirmar explícitamente que esa ruta es nueva y no pertenece al inventario histórico.
2. Registrar pago **exclusivamente Sandbox**, verificación en D1 y orden canaria entregable a través del flujo normal. Confirmar el `webOrderId` exacto y el identificador comercial, sin tocar otras órdenes.
3. Antes de habilitar nada, configurar en Cloudflare **ambos** flags `*_PURGE_CANARY_ORDER` iguales al pedido aislado, con GET y comprobación; entonces las tres compuertas `PRIVATE_TEST_ONLY` en los Workers de pruebas, sin otros cambios de bindings, con rollback.
4. Usar el botón **Entregado**, verificar cola y eventos D1, ruta exacta ausente en Supabase (`HEAD 404` y SQL de inventario), ZIP/descarga cerrados y que los **40 objetos originales permanezcan intactos**.
5. Verificar reintentos e idempotencia; apagar las tres compuertas y retirar canaria al terminar el ensayo; corroborar nueva lectura Cloudflare.
6. Preparar activación de producción SOLO tras resultado de servidor real completo, nunca durante el ensayo. Definir retención independiente de PDFs impagos/abandonados.

**Conclusión al cierre del 06/11:** conexión y defensa canaria terminadas y realmente desplegadas; **el borrado automático NO está todavía operativo**, correctamente OFF, porque falta la prueba real de una orden sintética pagada/entregada.


## Avance 06/11 — PRIMER PEDIDO CANARIO REAL CREADO SIN PAGAR
- Nuevo script de prueba: \`integraciones/autocotizador/recepcion/ensayo-canario-pdf-tus.mjs\`.
- Workflow aislado: \`.github/workflows/tus-crear-orden-canaria-pruebas.yml\`; trigger \`docs/CREAR-ORDEN-CANARIA-20261106.trigger\`.
- Acción real [42205254413](https://github.com/hernanchan/COTIZADOR/actions/runs/42205254413): **SUCCESS**. Dependencias fijadas \`pdf-lib@1.17.1\`, \`tus-js-client@4.3.1\`.
- El propio Worker documental generó firma TUS individual, recepción privada y verificó SHA/PDF/precio ANTES de crear la orden D1. Sin datos de clientes, sin pagos ni entrega.
- N.º orden: **024**.
- \`webOrderId\`: \`WEB-ENSAYO-DA97408CCD06FFED80433A8E2A3B3FB4\`.
- \`commercialOrderId\`: \`f5bddab7-6078-4f00-9fba-61f2210b0b20\`.
- PDF canario exclusivamente generado por la suite; ruta EXACTA: \`v2/WEB-ENSAYO-DA97408CCD06FFED80433A8E2A3B3FB4/3c98ffd9-ab0a-47ae-ad92-125dd7c9a2a5.pdf\`.
- SHA256: \`5d28e8b1a783c8dc4d0b038db26f497498e29b88ea9f5d8042c4e92e81dd7ac6\`.
- Tamaño **1.102 bytes**; 1 página A4 B/N, precio total $100.
- Estado confirmado por respuesta interna: **pedido registrado en D1, PAGO PENDIENTE, NO ENTREGADO**.
- Supabase SQL de solo lectura **posterior**: 41 objetos, 211.852.378 bytes. Sólo 1 objeto coincide con la ruta canaria y tiene 1.102 bytes. Excluyéndolo quedan **exactamente 40 objetos y 211.851.276 bytes**, idénticos a la línea base previa.
- Los 3 flags de purga siguen OFF (no se habilitaron en este ensayo).
- Este ejercicio confirma TUS real, recibo, PDF revalidado, cotización y D1; NO es prueba del borrado ni del disparador Entregado.

### Siguiente paso crítico, sin simulaciones de pago
1. Se debe completar y conciliar un pago genuino **exclusivamente Sandbox** de la orden 024, con registro \`payment_reviews=verified\`. No insertar ni falsear registros de pago en D1.
2. Instalar \`CENTRAL_TUS_PURGE_CANARY_ORDER\` y \`DOCS_TUS_PURGE_CANARY_ORDER\` con el \`webOrderId\` exacto anterior y comprobar sus valores antes de habilitar las 3 compuertas de prueba. La protección canaria no se habilita automáticamente al crear un pedido.
3. Usar secuencia real de la Central hasta \`Entregado\`, confirmar borrar esa única ruta; HEAD404, SQL inventario 40 originales intactos, D1 \`central_tus_purge_audit\`, acceso ZIP/descarga bloqueado.
4. Reponer flags OFF al terminar y verificar. Los pedidos previos siguen protegidos.


## 06/11 — Canario 024 fijado en Cloudflare y 3 interruptores todavía apagados
- Workflow \`tus-preparar-enlace-borrado-pruebas.yml\` actualizado para instalar dos parámetros de coincidencia exacta:
  - Central \`CENTRAL_TUS_PURGE_CANARY_ORDER = WEB-ENSAYO-DA97408CCD06FFED80433A8E2A3B3FB4\`.
  - Documentos \`DOCS_TUS_PURGE_CANARY_ORDER = WEB-ENSAYO-DA97408CCD06FFED80433A8E2A3B3FB4\`.
- La ejecución de Cloudflare [42205754837](https://github.com/hernanchan/COTIZADOR/actions/runs/42205754837) terminó **SUCCESS**, confirmó bindings + 3 flags **OFF**, acceso Basic protegido y health \`paymentsEnabled=false\`. **Ningún DELETE**.
- Versiones verificadas desde GET deployments Cloudflare:
  - Documentos \`992bee3f-0e4b-4710-b340-f8849e559733\`.
  - Central \`fe2a6411-163a-4cf1-852b-fd92b4bd0d8d\`.
- Inventario Supabase tras el despliegue: **41 objetos = 40 históricos + 1 canario**, total 211.852.378 bytes.
- Estado del canario: \`pending payment\`, no entregado. Mientras falta pago Sandbox real, **no habilitar la cola ni el ejecutor**. No marcar artificialmente \`paid\` ni \`verified\` en D1.
- El siguiente paso requiere completar compra de prueba de la orden 024 con un comprador Sandbox y verificar webhook/conciliación auténtica; sólo entonces activar temporalmente 3 compuertas de prueba, pulsar \`Entregado\`, verificar borrado exacto en Storage y auditoría D1. Apagar compuertas al final.
