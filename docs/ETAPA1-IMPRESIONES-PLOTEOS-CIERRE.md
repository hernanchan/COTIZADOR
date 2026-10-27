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

## Auditoría de contrato de recepción (27-10-2026)

Se confirmó una **incompatibilidad entre cotización y recepción**, no una falta del motor de cálculo:

| Capa | Capacidad observada | Brecha real |
|---|---|---|
| `cotizar-carga-unica.mjs` | cotiza documentos, ploteos y anillados | su resultado es preliminar |
| `carga-unica-cliente.mjs` | genera evento de cola `SABER_SMART_DOCUMENTS_TO_PRIVATE` | rechaza destino distinto de `documentos` y anillado |
| `pantalla-cotizador-v2-prueba-privada.mjs` | recibe PDF y opciones; verifica cabecera y SHA antes de encolar | contrato de opciones limitado a A4/A3, sin clasificación CAD/Póster ni grupos de anillado |
| `fase4-ficha-central-lote-privada.mjs` | consulta recibos privados de Google y revalida archivos | prepara `conectarRecepcionConCentral` con opciones documentales |
| `preparar-manifiesto-v2-documental.mjs` | genera manifiesto sólo con recibos confirmados | formatos `a4/a3`, anillado `ninguno/juntos`; no representa rollo ni clasificación por página |
| `cotizar-nup-recibo-verificado.mjs` | recalcula N-up desde un PDF verificado | N-up sólo en documentos, anillado ninguno |
| `worker-fase4-cotizador-unificado.mjs` | rutas de recepción, verificación y composición | las rutas y compuertas no prueban que un ploteo sea producible |

### Orden técnico de cierre (sin módulos ni pantallas nuevos)

1. **Definir y probar el contrato de trabajo por archivo** con servicio, páginas seleccionadas, destino por página (CAD/Póster), rollo automático y papel Póster cuando corresponda. Los valores del navegador no autorizan precio.
2. **Extender el receptor y la revalidación del servidor** para recomputar tamaño, clasificación, rollo, papel y precio de cada página desde los bytes almacenados.
3. **Integrar anillado** por grupo de archivos en el pedido, validando que el grupo sea consistente; el PDF compuesto deberá conservar el orden e indicar los grupos.
4. **Extender manifiesto y Central** de manera transaccional sin perder el formato documental ya existente; guardar opciones verificadas de producción y total calculado en servidor.
5. **Conectar el único botón de envío** al contrato validado, seguido de pruebas reales Drive/D1/PDF compuesto. Mantener los rechazos actuales hasta que exista soporte verificable.

**Criterio de bloqueo:** no quitar restricciones de UI para ploteos/anillados antes de que el backend pueda aceptar, revalidar y registrar esos casos. Nunca usar el precio del navegador como importe confirmado.
