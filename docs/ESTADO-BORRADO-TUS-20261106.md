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
