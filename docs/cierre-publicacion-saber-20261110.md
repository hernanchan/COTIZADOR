# Cierre comercial / publicación controlada — 2026-11-10

**Estado: NO_GO — no publicar ni fusionar rama completa.**

## Evidencia actual
- Rama: `integracion/tus-pedido-privado-20261101`; frente a `main`: 3331 commits adelante, 20 atrás (comparación 2026-11-10).
- Head de diagnóstico: `b1220ddccd33d34658a3fb7263d7f1a0df741574`.
- QA real sobre **misma orden sintética** sandbox $4400, sin orden/pago/subida nueva: [ejecución 42815940344](https://github.com/hernanchan/COTIZADOR/actions/runs/42815940344), falla en autorización a Central.
- Variables de GitHub Actions inspeccionadas **solo por presencia**: `DEMO_ADMIN_KEY`, `SABER_CENTRAL_DEMO_ADMIN_KEY`, `SABER_CENTRAL_ADMIN_KEY` ausentes; `SABER_DOCS_CENTRAL_ADMIN_KEY` presente pero GET `/admin/api/central/r2-paid-review` => 401. `SABER_V2_OPERATOR_PASSWORD` presente pero no sirve como credencial admin (401).
- Código del Worker Central autentica exactamente `env.DEMO_ADMIN_KEY` mediante bearer; no modificar ruta ni relajar autenticación.
- CI integración privada sí pasó: [ejecución 42815940357](https://github.com/hernanchan/COTIZADOR/actions/runs/42815940357). No equivale a aprobación comercial.
- Anterior diagnóstico de publicación: `SABER_CF_DEPLOY_TOKEN` Pages GET 403, `SABER_CF_EDITOR_TOKEN` GET 401, D1 query 401; **fallos de acceso** no de cotización.
- `vidriera/portal-comercial.json`: `enabled:false`, `release:"NO_GO"`, `buyerUrl:null`.
- Sitio público `https://libreriasaber.com.ar` sigue con carrito/cotizador anterior. Sin cambios en `main` o pagos reales.

## Intervención mínima del titular (nunca pegar secretos en chat)
1. Guardar en los **secretos de GitHub Actions** del entorno `saber-cloudflare-pruebas` el secreto `DEMO_ADMIN_KEY` con el **mismo valor** que el `DEMO_ADMIN_KEY` del Worker `saber-pagos-pruebas`. Si el original no está guardado, rotar el secreto en ambos lugares, asumiendo invalidación de la clave antigua para el panel.
2. Reemplazar el secreto `SABER_CF_EDITOR_TOKEN` por token de la cuenta correcta con permisos **Cloudflare Pages Edit** y **D1 Read** (y recursos limitados a la cuenta operativa), para identificar proyecto Pages, verificar D1 y preparar publicación/rollback. No cambiar el token de deploy del Worker.

## Secuencia de reanudación
1. Reejecutar **solo QA fallida** de la ejecución 42815940344; comprobar `QA_ADMIN_AUTH_DEMO_ADMIN_KEY_HTTP_200`, aprobación en D1 y deduplicación en Nuevos. No repetir pago o R2.
2. Validar estados preparación, instrucciones, ETA, seguimiento y borrado Entregado **en orden sintética**, sin tocar datos de clientes.
3. Validar cotizador, carrito, fotos de productos, links y móvil en preview privado, con criterios comerciales ya aprobados.
4. Identificar proyecto Pages del dominio, registrar deployment de producción actual y mecanismo de rollback; preparar una publicación acotada **sin fusionar 3331 commits**.
5. Publicar **solo después** de controles críticos. Habilitar pagos reales únicamente con autorización y verificación final. Smoke post-publicación, reversión si falla.

**No está publicado ni aprobado comercialmente.** Este documento no implica validación funcional ni autorización para producción.


## Actualización verificada 10/11 — credenciales y producción sintética
- `DEMO_ADMIN_KEY` guardada por titular en el entorno de GitHub y **autenticada HTTP 200**: [QA aprobación](https://github.com/hernanchan/COTIZADOR/actions/runs/42815940344), `QA_R2_PREPRESS_APPROVED_D1_SANDBOX_ONLY`. No hubo segundo pago/subida.
- Pedido comercial sintético `89608817-95b1-41bc-ac88-579da519d32c` aparece **exactamente una vez en Nuevos**, numerado, con recibo R2 y estado pendiente: [verificación GET autenticada](https://github.com/hernanchan/COTIZADOR/actions/runs/42819990406).
- Mismo pedido sintético avanzó a `en_preparacion` con ETA manual persistida en D1, verificados GET pedido y GET tablero: [QA operacional](https://github.com/hernanchan/COTIZADOR/actions/runs/42820358898).
- **No se verificó todavía** descarga del ZIP ni transición `listo -> entregado` ni borrado R2. El PDF sintético se conserva hasta asegurar el control de eliminación.
- Siguiente dependencia externa: identificar Cloudflare Pages público, credenciales Cloudflare con permisos mínimos, rollback; sin publicar/activar MP real antes de controles.
