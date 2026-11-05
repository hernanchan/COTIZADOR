# Saber Directo V1 — dirección visual y primera implementación

**Fecha:** 2026-11-05. **Rama exclusiva:** `integracion/tus-pedido-privado-20261101`. **Titular:** aprobó avanzar con la dirección «Saber Directo». **Situación:** código de portada en rama, **sin despliegue** ni ensayo visual aún. No publicado en `main` ni web comercial.

## 1. Diagnóstico del repositorio antes del cambio
- Portada activa en fuente `vidriera/index.html`: tipografías DM Sans/Manrope, marca azul/naranja, hero oscuro grande, imagen externa de stock, categorías con catálogo CSV, beneficio semanal dinámico situado al final, carrito local y enlace WhatsApp.
- Tres propuestas históricas en `vidriera/propuesta-profesional.html`, `vidriera/propuesta-tienda.html` y `vidriera/propuesta-visual.html`. Se eligió estética comercial limpia frente a portada institucional oscura o catálogo que relegue impresión.
- Cotizador privado `integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs` y capa inteligente: todavía estilos heterogéneos e iframe; **no se tocaron**.
- Central privada y seguimiento definidos en `integraciones/mercadopago/pruebas/worker.js`, con estados funcionales, entregas y editor de hora probados por el titular; **no se tocaron**.

## 2. Sistema visual aprobado (V1)
| Elemento | Especificación |
| --- | --- |
| Azul institucional | `#0A3158`, encabezados y botones principales |
| Naranja institucional | `#F7931E`, bordes, acentos, promociones, evitando texto blanco sobre este fondo |
| Texto | `#172230` |
| Fondo | `#FFFFFF`, paneles suaves `#F7F8FA` |
| Líneas | `#E1E7ED` |
| Tipografía | `Manrope` títulos, `DM Sans` textos y formularios, fallback sistema |
| Bordes | Radio compacto 10–14 px; sin efectos decorativos dominantes |
| Botones | Jerarquía primaria azul con texto blanco, secundaria blanca con borde visible; foco de teclado distinguible |
| Móvil | Dos columnas solo para accesos breves; bloques principales en una columna, sin scroll horizontal |
| Contenido | Precio, promociones y acción principal antes que elementos decorativos |

Nota de accesibilidad: naranja `#F7931E` contra blanco no ofrece contraste adecuado para texto pequeño; usar azul oscuro/tonos oscuros sobre naranja claro, y verificar WCAG en componentes nuevos.

## 3. Primera implementación en rama privada
**Commit de portada:** `1f3f54d0819b74bf0bd1fc1da8a50e72419bd754`.
Archivo: `vidriera/index.html`.
- Hero claro, compacto, sin fotografía genérica externa.
- Un CTA principal «Cotizar impresiones» y alternativa «Ver productos y servicios».
- Tarjeta del beneficio diario colocada a primera vista con **los mismos tres IDs** `promoDay`, `promoTitle`, `promoText`; la función histórica de promoción no fue reescrita.
- Cuatro accesos de servicio: documentos, ploteos, fotos/stickers, escolar/oficina.
- Categorías existentes siguen operando con sus controles `data-panel`. Catálogo CSV, carrito, WhatsApp, contactos, precios existentes y control de Polaroids se conservan sin cambiar su lógica.
- Estilos responsive, botones de 48 px en portada, contornos de foco y mayor jerarquía tipográfica.
- La sección de contacto permanece; `#beneficio` es ahora un ancla del hero, sin IDs duplicados.

## 4. Riesgos y barreras
- **Sin deploy:** editar `vidriera/index.html` de esta rama no equivale a publicarla en Cloudflare/GitHub Pages ni habilita pagos.
- La portada de rama es aún el **flujo histórico de catálogo/WhatsApp y señas**; no confundirlo con el nuevo pago total privado. La migración de checkout y el retiro de ese texto se realizará por fase posterior, con validación comercial. No habilitar flujo real mediante un cambio estético.
- La tarjeta del beneficio depende del JS histórico y datos que ya manejaba el sitio; esta etapa no cambia tasas ni reglas de descuento. Verificar siempre el beneficio desde Córdoba y la concordancia con el motor al integrar.
- Pruebas del nuevo diseño son estructurales y de CI; no atribuirles validación visual ni E2E de usuario.
- No tocar `main`, web pública, Worker's privados desplegados, archivos PDF, D1, precios, promociones configuradas o pagos reales.

## 5. Siguientes etapas, sin saltos
1. Validar CI y revisar visualmente la portada en tamaños 360/390/768/1440 px en entorno de vista privada, comprobar accesos de impresión, categorías, ofertas y carrito. Dejar registro de prueba y corrección antes de proclamar aprobación.
2. Extraer tokens CSS comunes y adaptar cotizador privado **solo presentación**, preservando carga TUS, detección, opciones comunes/individuales, anillados, totales y envío único. Evitar alturas fijas de iframe cuando se pueda sin modificar transporte.
3. Aplicar tipografía y componentes al seguimiento cliente, manteniendo estados, actualización (~30 s) y tiempo de entrega manual tal como funcionan.
4. Renovar Central: jerarquía «entregas / pagos pendientes / pedidos» y trasladar opciones históricas a controles desplegables, preservar permisos y acciones; mantener tablet/desktop de cuatro columnas solo si funcionan a ancho disponible.
5. Integración visual final, revisión completa de accesibilidad y ensayos humanos. Nada se publica comercialmente sin aprobación explícita.

**Próximo paso único:** verificar resultado del CI de rama, obtener una vista de navegador privada de la portada y corregir exclusivamente presentación antes de intervenir cotizador o Central.

## 6. Vista previa protegida (código)
- Se añadió ruta `/prueba-v2/diseno-saber-directo` y `/prueba-v2/diseno-saber-directo/ofertas.html` dentro del Worker documental privado existente, mediante `prepararVistaDisenoPrivada`.
- Ambas rutas pasan por `v2PrivateBrowserResponse`: compuerta `DOCS_V2_PRIVATE_UI_ENABLED` + Basic operador, con sesión móvil ya permitida en esta interfaz. Anonymous 401; flag apagado 503.
- Importa el HTML de portada y ofertas del repositorio, sin copiar una segunda versión divergiendo.
- Sustituye enlaces locales a cotizador por `/prueba-v2/` (ensayo protegido), y al catálogo de ofertas por ruta protegida de pruebas. Bloquea clics hacia envío WhatsApp y consultas externas desde las vistas de diseño; no toca motor de cotización ni datos de pedidos. Muestra banner de «Vista previa privada». Mantiene la carga CSV pública de productos como en portada histórica.
- Estado: **código**, pendiente de CI, despliegue privado y verificación real por HTTP. No confundir con disponibilidad pública.

## 7. Activación de la vista protegida solicitada por el titular
- Workflow exclusivo `.github/workflows/saber-directo-preview-privado.yml`, disparado sólo por `docs/ACTIVAR-SABER-DIRECTO-VISTA-PRIVADA.trigger`. Compila el Worker documental existente, hereda estrictamente sus configuraciones, instala únicamente nueva versión de ensayo, verifica antes/después y revierte ante fallos. No crea Worker ni altera `main`.
- Rutas: `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/diseno-saber-directo` y `.../ofertas.html`. Requiere Basic privado o sesión móvil V2. El diseño es solo demostración: consulta de productos pública, sin pedidos ni mensajes enviados desde el prototipo.
- En este paso se corrigió CSP para permitir estilos y scripts inline heredados del HTML, preservando `object-src 'none'`, `form-action 'none'`, `base-uri 'none'`.
- **Estado de despliegue:** ACTIVADO SOLO EN WORKER DE PRUEBAS, ver sección 9 para versión y pruebas.

## 8. Verificación de despliegue y rollback (registro de incidencia)
- Ejecución privada `42065123949`: compiló y superó pruebas estáticas, pero un marcador Unicode no era idéntico en JS minificado; **no llegó a desplegar**.
- Ejecución privada `42065328939`: compilación, pruebas y comprobación anónima 401 correctas; la autenticación de la ruta nueva devolvió **HTTP 503**. El workflow activó el **rollback automático**, y Cloudflare aceptó el retorno a versión previa. No afirmar que esté visible.
- Causa del 503 aún no identificada. Antes de nuevo despliegue se añade un test que importa **el Worker compilado** con una clave sintética y llama por GET las dos rutas con/sin autenticación, incluyendo comprobación del HTML y CSP. Solo si pasa se permite nueva activación.

## 9. Despliegue privado APROBADO — 05/11/2026
- **GitHub Actions:** `42066320074` SUCCESS. Trabajo `127381258117`, prueba de regressión y compilación completas, despliegue con comprobación HTTP GET de ambos HTML y del cotizador existente.
- **Versión Cloudflare activa:** `c3502246-9f53-48b3-8995-09928637f87c` en Worker exclusivo `saber-documentos-pruebas` (sin tocar el Worker de pagos). Se heredaron los bindings, sin crear servicios, modificar precios ni habilitar cobros.
- **Ruta portada:** `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/diseno-saber-directo`.
- **Ruta catálogo:** `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/diseno-saber-directo/ofertas.html`.
- **Pruebas HTTP reales:** portada, ofertas y cotizador `/prueba-v2/` devuelven HTTP 401 anónimo; portada y ofertas devuelven HTTP 200 autenticados con el HTML y los marcadores esperados; `/prueba-v2/` autenticado 200 conserva `id="smart"` y `send-all-pdf`. Firma de bindings `nombre + tipo` idéntica antes/después.
- Se encontró evidencia de **propagación diferida del edge**: primer GET de la ruta nueva devuelve 503 porque aún la atiende la versión anterior (su fallback `closed()` responde 503); en el siguiente intento respondió 401, y el GET autenticado también pasó de 503 a 200. Se agregó máximo 15 reintentos con 2 segundos entre intentos y rollback si no convergen.
- Los clics comerciales de envío WhatsApp desde la vista previa se bloquean en JavaScript de la página; las rutas originales y el carrito histórico no se modificaron. El cotizador de pruebas es accesible desde la portada a través de enlace interno protegido. No significa que esté integrada la pasarela de cobros reales.
- **Pendiente:** inspección humana de portada y ofertas en navegador real, especialmente móvil: verificar que no haya desbordes, que imágenes de productos carguen y que el beneficio vigente sea el que corresponde. Estas comprobaciones **no están demostradas por el smoke GET**.
- **Siguiente paso:** recibir opinión sobre el diseño de portada y ajustar solo presentación; después extender sistema Saber Directo al cotizador V2 y a seguimiento/Central, sin cambiar estados, cálculos ni pagos.

## 10. Ajuste solicitado: vista visual SIN CONTRASEÑA
- El titular detectó que la vista anterior seguía solicitando Basic; se corrigió el enfoque: nuevo enlace `/prueba-v2/diseno-sin-clave` y catálogo `/prueba-v2/diseno-sin-clave/ofertas.html`.
- **Estas dos rutas son públicas por diseño, pero solo muestran una maqueta visual estática.** No contienen autenticación, datos privados, pedidos ni API de pagos. Las rutas reales `/prueba-v2/`, Central y D1 continúan protegidas.
- Sanitización de la maqueta: elimina por completo el `<script>` histórico (que incluía carrito, datos de transferencias y WhatsApp), elimina atributos `on*`, neutraliza enlaces de cotización/WhatsApp/contacto, elimina carrito histórico, desactiva la conexión al catálogo; permite únicamente cambio visual de pestañas de categorías.
- Seguridad del Worker: `connect-src 'none'`, `form-action 'none'`, no cookies, `noindex`, `no-store` y bloqueo de métodos distintos a GET. Se mantienen los archivos originales y la vista previa protegida anterior para evitar romper funcionalidades.
- Incluye pruebas de sanitización y un ensayo real con el Worker **compilado**, más pruebas HTTP GET anónimas con cabeceras seguras y comprobación 401 de cotizador. No implica publicación de la web pública.
- **Estado al generar el código:** pendiente del workflow específico y de las comprobaciones HTTP antes de entregar enlace funcional.
