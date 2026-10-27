# Etapa 1 — Impresiones, ploteos y anillados

Estado: **en desarrollo y sin autorización de publicación**, 27-10-2026.

## Versión de referencia

- Rama de trabajo: `fase1/impresiones-ploteos-20261027`, creada desde `fix/pdf-extension-private-20261027`.
- Conservar `cotizador-web-v2.html` como cotizador comercial de referencia; **no editar main ni libreriasaber.com.ar**.
- Worker de ensayos: `saber-documentos-pruebas`; no activar pagos ni recepción comercial.
- Polaroids Express queda conservado, fuera del alcance de esta etapa.

## Hallazgos del código

1. `carga-unica-cliente.mjs` cotiza ploteos, pero bloquea explícitamente el envío de trabajos cuyo destino no es `documentos` y el anillado distinto de `ninguno`. **No están integrados a la recepción privada**.
2. El ensayo inteligente está embebido como iframe en `pantalla-cotizador-v2-prueba-privada.mjs`. Además hay un segundo iframe con el cotizador original de comparación. Esta presentación **no es todavía la UX comercial única**.
3. La corrección de la validación de extensión PDF está en el origen, con pruebas de sintaxis y de traspaso al carrito. GitHub Actions `40571610682` concluyó en éxito; **no prueba Drive/D1 en vivo**.
4. `worker-fase4-cotizador-unificado.mjs` contiene rutas privadas para recepción, vinculación, manifiestos, Central y composición, pero su presencia no confirma el circuito real de extremo a extremo. Varias operaciones dependen de interruptores `PRIVATE_TEST_ONLY`.

## Condiciones de salida, en orden obligatorio

- [ ] **Pantalla única:** carga múltiple y arrastre, progreso, precio visible, errores recuperables, sin repetir selección o volver a subir el PDF.
- [ ] **Cotización A4/A3:** B/N, color, simple/doble faz, 2/4/9 páginas por cara, escalas por cantidad y selección de páginas.
- [ ] **Ploteos:** CAD/Póster por página, tamaño y orientación, elección automática de rollo, papel obra/recubierto según clasificación, prueba de archivos mixtos y regla de duda → CAD.
- [ ] **Anillados:** archivos juntos, separados y mixtos; precio y composición del trabajo vinculados al pedido.
- [ ] **Recepción protegida:** PDF real de prueba sin datos de clientes → Google Drive; comparar nombre, bytes, páginas y SHA-256.
- [ ] **Central D1:** mismo ID de pedido, registros persistentes y recuperación administrativa efectiva.
- [ ] **PDF compuesto:** generación y descarga privada, concordancia de páginas, orden y opciones del pedido.
- [ ] **Aceptación móvil y PC:** completar pedido sin intervención técnica y sin errores JavaScript/Turnstile críticos.
- [ ] **Seguridad:** cobros desactivados y ningún cambio en web comercial hasta autorización explícita.

## Metodología de pruebas

- Distinguir: test unitario, integración con dobles, compilación, navegación autenticada y ejecución real Drive/D1.
- No promocionar una versión sólo porque Actions aparece en verde.
- No modificar código minificado desde Cloudflare; corregir fuentes, compilar y promover artefacto identificable con SHA.
- No desplegar a clientes sin las nueve condiciones verificadas con evidencia y autorización.
