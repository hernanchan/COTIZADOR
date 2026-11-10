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

## Actualización 10/11 — acceso Cloudflare Pages y D1 confirmado
- Nuevo `SABER_CF_EDITOR_TOKEN`: **D1 SELECT autorizado** ([GitHub Actions](https://github.com/hernanchan/COTIZADOR/actions/runs/42824963801)).
- API Pages GET **HTTP 200** con token editor ([GitHub Actions](https://github.com/hernanchan/COTIZADOR/actions/runs/42825117959)); error anterior HTTP 400 provenía de `per_page` inválido, no de credenciales.
- Proyecto: `libreriasaber`; dominio público y www asociados; Pages GitHub `COTIZADOR`, rama producción `main`, salida `vidriera`.
- Baseline producción confirmado mediante GET del proyecto ([GitHub Actions](https://github.com/hernanchan/COTIZADOR/actions/runs/42825518809)): deployment canónico `978d582b-b1a4-4943-a5ff-e1bc0fa928c3`, commit `864eb12272f6b8dfb2ca7eaee1be5326632e7bf3`. Anotar como punto de restauración; **no se ejecutó rollback**.
- La rama de integración despliega automáticamente en `preview`, no en producción. El público aún sirve `/cotizar` heredado.
- Bloqueo comercial real aún abierto: `vidriera/portal-comercial.json` sigue `enabled:false` / `NO_GO`; `vidriera/cotizar.html` solo redirige a sandbox en preview y exige endpoint público `pedidos.libreriasaber.com.ar/cotizar` para producción. La existencia y operatividad de dicho endpoint **no están comprobadas**. El módulo `integraciones/publicacion/mercadopago-live-preflight.mjs` declara expresamente ser validador puro, **no pasarela ni endpoint** de pago real. Por tanto, acceso a Pages no autoriza ni valida el lanzamiento.
- Próximos controles obligatorios: inspección comercial de preview, confirmar backend de cobro REAL y seguridad, definir alcance mínimo de release sin fusionar rama gigante, efectuar publicación acotada + smoke con rollback a baseline.

## Evidencia adicional de preview HTTP
- URL verificada vía Pages API del despliegue de preview: `https://227c8e6d.libreriasaber.pages.dev`.
- Smoke no autenticado GET portada/cotizador/JSON compuerta: HTTP 200 en los tres; el HTML de cotizador aún apunta al Worker sandbox y el JSON sigue en `NO_GO` ([CI](https://github.com/hernanchan/COTIZADOR/actions/runs/42826413107)).
- Este smoke demuestra accesibilidad HTTP y compuerta cerrada; **no demuestra interacción móvil, fotos correctas, carrito funcional ni cobro en vivo**.

## Incidencia PDF real «DCTO CABAÑAS POSE» — corrección privada (10/11)
- Archivo inspeccionado LOCALMENTE sin enviarlo al repositorio ni a Cloudflare: 45.655.680 bytes = 43,54 MiB; tres páginas (47,003×31,001 cm; 45,923×31,001 cm; 45,923×31,001 cm), cada una con una imagen raster a página completa. Cobertura visual reducida: aprox. 84–87 %, clase **PÓSTER / PLENO**. El nombre no determina clasificación ni papel.
- Causa: UI `carga-unica-cliente.mjs` omitía clasificación visual para PDF >40 MiB, salvo mosaicos estructurales de **una** página con ≥12 imágenes. Este PDF (3 páginas, una imagen por página, xref stream) quedaba en `sin-clasificar`.
- Corrección limitada a navegador: fallback visual PDF.js solo para archivos >40 y ≤48 MiB y hasta 4 páginas, cuando no confirma la clasificación rápida por rangos. Si falta una clase segura, conserva revisión manual. No sube ni cobra por clasificar.
- Nuevas pruebas + regresión compiladas: [CI](https://github.com/hernanchan/COTIZADOR/actions/runs/42829413421), 16 tests sin fallas.
- Worker privado `saber-documentos-pruebas` actualizado con rollback configurado: baseline `cf043fba-56bc-4718-a5c0-163ab80c3c29`, versión nueva `b498f405-6305-431b-b633-916b008ff8be`; activo, acceso Basic y compuertas pagos reales comprobados: [CI](https://github.com/hernanchan/COTIZADOR/actions/runs/42829677182). Ninguna modificación a Pages público, main, MP ni R2.
- Cotización D1 directa con las tres medidas y `modo=poster` (solo POST de presupuesto, **sin subir PDF ni crear pedido**): 80 g `$9.100`, 3 × `rollo42`; recubierto 130 g `$26.000`, 3 × `rec60`: [CI](https://github.com/hernanchan/COTIZADOR/actions/runs/42830119494).
- **Pendiente de comprobación en navegador con archivo original**: que el comprador efectivamente vea PÓSTER/PLENO y ambos materiales/precios; aplicar recarga completa y volver a elegir PDF. No está validada todavía recepción de los 43,54 MiB tras pago ni publicación en producción.

## Clasificador CAD de letras contorneadas: corrección GENERAL (10/11)
- Incidencia reportada por titular: PDF de 3 metros con letras solo en contorno fue clasificado como `Póster`. **No se dispone del archivo original para confirmar todavía la corrección end-to-end**.
- Causa probable identificada en código: decisión por ocupación cromática de miniatura podía marcar `poster` aunque estuviera formada por trazos; verificación estructural requería rótulo técnico, muchas operaciones o cobertura >=0.30.
- Ajuste **general** (sin nombres, medidas ni casos especiales): para pósters visuales con casi nulo `plenoContinuo`, consultar operadores PDF.js; si hay >=3 construcciones de trazo, >=3 strokes y **ningún relleno, imagen ni sombreado**, clasificar CAD. Para raster, rellenos o incertidumbre mantener regla previa/revisión. No se modifica la cotización ni material por nombre de archivo.
- [Regresiones 28 OK](https://github.com/hernanchan/COTIZADOR/actions/runs/42831696368), incluyendo CAD contornos a 300 cm, rechazo explícito para rellenos/fotos y conservación de pruebas anteriores.
- [Worker privado activo y verificado](https://github.com/hernanchan/COTIZADOR/actions/runs/42831996007): versión `341bc236-07f3-422c-b578-b068619c98d0`, base anterior `b498f405-6305-431b-b633-916b008ff8be`. HTTP anónimo sigue 401, JS nuevo verificable, pagos reales siguen desactivados.
- No se tocó `main`, `libreriasaber.com.ar` ni MP real. Se requiere PDF original de contornos para validar detección y precio de ese caso; un archivo con glifos rellenos o rasterizados podría no cumplir la regla de trazos sin relleno.

## 10/11 — circuito único TUS/R2 (corrección y activación privada)

- Regla comercial inalterable: dimensiones y selección final determinan documentos/plotter; CAD/Pleno por contenido; **bytes exclusivamente TUS <=40 MiB o R2 >40 MiB**. El nombre del archivo tampoco altera el destino.
- Código cliente `carga-unica-cliente.mjs`: eliminada la bifurcación `SABER_SMART_R2_PREPAGO` que permitía solo un ploteo PDF >40 MiB; ahora todo PDF >40 MiB se entrega por mensaje `SABER_SMART_UNIVERSAL_PDF` **si** el circuito universal está habilitado. Si el flag está apagado, bloquea envío/pago sin alterar el presupuesto.
- Caso regresión: PDF **A4 de 500 páginas, 100 MiB** usa el handoff universal y conserva destino documentos; caso **A0 2 MiB** conserva destino plotter por TUS. [46 pruebas correctas, compilación de interfaz](https://github.com/hernanchan/COTIZADOR/actions/runs/42838798180).
- [Despliegue Worker Documentos PRIVADO confirmado](https://github.com/hernanchan/COTIZADOR/actions/runs/42838949545): versión activa `edb9856a-053d-4f9c-bf2c-57859cb24454`; anterior de rollback `341bc236-07f3-422c-b578-b068619c98d0`; controles de configuración, protección 401 anónima, pagos reales OFF, nuevo bundle JS probado. No modificación de `main`, Pages público ni MP.
- [Auditoría real de flag vía panel privado de operador](https://github.com/hernanchan/COTIZADOR/actions/runs/42839353486): las 11 banderas `PRIVATE_TEST_ONLY` del universal están OK, `SABER_CENTRAL=service`, `SABER_R2_GRANDES=r2_bucket`; HTML privado (HTTP 200) contiene `src="/prueba-v2/carga-inteligente?universal=1"`. El endpoint comprador sin cookie Turnstile devuelve correctamente el formulario de acceso; no tratarlo como flag faltante.
- **Pruebas NO realizadas**: no se ha enviado PDF real de 100 MiB, no se ha pagado checkout nuevo, no se ha simulado un nuevo pedido, no se ha validado recepción R2 de ese apunte de 500 páginas en un navegador real. Las pruebas son de programación, compilación, API de configuración y presencia real de UI.
- El lanzamiento **sigue NO_GO** hasta verificar funcionamiento visual completo, MP real seguro, productos y reversión comercial. Mantener pagos reales desactivados.

## 10/11 — bloqueo de cobro real confirmado por revisión de código

- `integraciones/publicacion/mercadopago-live-preflight.mjs` declara expresamente ser una **función pura**, no pasarela ni endpoint. Sus validaciones exigen pago MP `live_mode=true`, vendedor LIVE coincidente y distinto de comprador de ensayo, `merchant_order`, orden D1 y monto íntegro, con webhook firmado. **No realiza** GET autenticados a MP ni persistencia en D1, ni crea preferencia.
- `integraciones/mercadopago/pruebas/worker.js` expone los checkout documentales revisados en modo sandbox; pagos reales no autorizados.
- `vidriera/portal-comercial.json` sigue `enabled:false, release:NO_GO, buyerUrl:null`.
- Por tanto las pruebas unitarias y de Worker privado **NO** equivalen a capacidad de cobrar en producción. No activar pagos reales ni publicar el cotizador hasta que exista implementación segura y comprobada del checkout y webhook LIVE, manteniendo la reversión del sitio vigente.
- La rama de integración ya no discrimina por peso para definir destino A4/A3/CAD/Pleno; el nuevo browser QA simula 500 páginas A4 de 100 MiB, **sin crear pedido ni subir archivos** (workflow `saber-qa-browser-universal-noenvio-20261110.yml`, resultado independiente de esta nota).

## Control de navegador de 500 páginas A4 / 100 MiB — estado de prueba

- Workflow de QA diseñado en la rama: `.github/workflows/saber-qa-browser-universal-noenvio-20261110.yml`, script `integraciones/autocotizador/recepcion/ui-universal-browser-noenvio.mjs`.
- Prueba no destructiva: genera un PDF sintético de 500 páginas A4 y 100 MiB, intenta cotización en Chrome/Worker privado y captura handoff universal **sin llamar a endpoints de orden, pago, TUS ni R2**.
- [Ejecución 42840193862](https://github.com/hernanchan/COTIZADOR/actions/runs/42840193862), iniciada 2026-11-10 15:02 UTC; a las 15:19 UTC seguía `in_progress` en el paso de navegador. **No atribuir éxito** ni inferir una falla comercial definitiva sin logs finales; el PDF de QA contiene un bloque de padding de texto artificial, que puede no representar un PDF de apunte real.
- La prueba no cambia el criterio de destino comercial: A4 es impresión documental por dimensión; R2 se selecciona solo por peso. Las pruebas unitarias de ese criterio y del handoff universal permanecen verdes.
- La referencia obsoleta a Google Drive en `pantalla-cotizador-v2-prueba-privada.mjs` se sustituyó por descripción neutral de recepción privada, **todavía sin afirmar que esa modificación esté desplegada**.
