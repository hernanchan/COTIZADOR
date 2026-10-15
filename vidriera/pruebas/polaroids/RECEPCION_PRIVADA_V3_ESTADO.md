# Polaroids: recepción privada V3 preparada — SIN DESPLEGAR

Fecha: 14 de octubre de 2026.

Estado: **código técnico preparado y probado localmente**, no integrado aún al servicio público. No modificar la rama main por este trabajo. No se creó R2, Worker, Turnstile ni se generaron gastos.

## Prototipo V3 generado en esta conversación
Archivo entregado en la conversación: `Libreria_Saber_Polaroids_Recepcion_Privada_V3_Varias_Hojas.zip`. Conservar su contenido antes de desplegar; **el archivo fuente V3 aún no está incorporado como código al repositorio**.

- `web/polaroids-editor.html`: editor 1–10 hojas de 6 Polaroids, conserva encuadres y envía 6×N originales y posiciones solo si se configura la API privada.
- `worker/src/index.js`: Cloudflare Worker preparado para R2 privado; borradores con Turnstile, tokens por sesión, carga de 6–60 fotos, admin con credencial privada, descarte total, limpieza por caducidad.
- `web/polaroids-admin.html`: panel responsive, navega hojas, original privado solo para administración; genera PDF 300 ppp A4 de N páginas **solo cuando se registra la seña**.
- `tests/worker.test.mjs`: 12 pruebas aprobadas en almacenamiento simulado, incluidos los tamaños de 1, 2 y 3 hojas y autorización/borrado.
- Prueba con Chrome simulado: el PDF final tiene 2 páginas A4 210×297 mm, 6 imágenes por página, 12 imágenes en total, marcas exteriores de corte.

Precio de referencia **ARS 3.000 por hoja de 6**, seña 50%. No se activaron promociones particulares.

## Bloqueos explícitos antes de recibir pedidos

1. Acceso DNS de los subdominios Cloudflare Pages de pruebas: error NXDOMAIN observado.
2. No existe almacenamiento privado aprovisionado; consultar y obtener aprobación del titular antes de habilitar R2 u otro servicio que pueda implicar costos.
3. Configuración privada de Worker y Turnstile, credenciales, rate limiting, retención, privacidad y límite de almacenamiento pendiente de evaluación.
4. Integrar evento real `SABER_POLAROID_READY` con cotizador/carrito mixto (`SABER_ADD_PRINT`), manteniendo flujo único, referencia de recepción y pago de seña.
5. Pruebas de recepción desde celular al panel administrativo y PDF físico; aprobación expresa antes de producción.

**Nunca confundir el carrito simulado de la rama de pruebas con recepción efectiva de fotografías.** No se han recibido archivos de clientes.
