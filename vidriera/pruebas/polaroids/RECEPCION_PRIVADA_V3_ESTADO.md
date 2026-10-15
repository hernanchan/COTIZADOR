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

## Continuación 15/10/2026 — adaptación al carrito (sin despliegue)

- Reejecutada en local la suite `node --test tests/worker.test.mjs` del paquete V3: **12 pruebas correctas, 0 fallas**. Son pruebas con R2 y Turnstile simulados.
- Incorporado un módulo independiente de contrato de integración: `prototipos/polaroids-v3/integracion-carrito.mjs`, con tests en `integracion-carrito.test.mjs`. Valida `SABER_POLAROID_READY`, la misma ventana y origen del editor, el formato, una referencia `PS-AAMMDD-XXXXXXX` y de 1 a 10 hojas completas.
- El artículo de impresión se calcula exclusivamente con el precio que le proporcione el cotizador: **ARS 3.000 por hoja, seña del 50%**, sin utilizar importes emitidos por el editor. Se ejecutaron **11 comprobaciones funcionales del adaptador, todas satisfactorias**.
- **No se modificó la rama `main`** ni se desplegó el Worker. El servicio no recibe fotos hasta disponer de alojamiento HTTPS accesible, almacenamiento privado y autorización para activarlo.
- IMPORTANTE: el módulo de integración todavía no está activado en las páginas del cotizador; tampoco sustituye la validación de una referencia en el backend antes de aceptar pagos o preparar trabajos.
- Se intentó ampliar la prueba integral de interfaz/editor/panel en un navegador simulado, pero el entorno de ejecución bloqueó el acceso de red incluso a `localhost`. No se declara superada esa prueba; se mantiene como requisito antes de producción.
- Los archivos completos del editor, panel y Worker V3 siguen en el paquete ZIP de desarrollo que se entregó, no están publicados ni desplegados desde el repositorio.
