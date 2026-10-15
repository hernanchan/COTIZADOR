# Polaroids Web – Integración aislada (SIN R2)

**Rama de prueba:** `polaroids/integracion-sin-r2-20261014`.
**Estado:** prototipo técnico publicado solo como vista previa de Cloudflare Pages; no desplegado en producción.
**Sitio público y rama `main`:** sin modificaciones.

## Objetivo y recorrido

La copia de `index.html` usa el mismo tipo de carrito que la vidriera (artículos + impresión/gráfica).
El usuario va a `cotizar.html` y desde el iframe de `cotizador-web-v2.html`
selecciona **Imprimir fotos → Polaroid**. El editor `editor.html` permite cargar y recortar
seis fotos por hoja, sumar hasta diez hojas con navegación entre ellas, mostrar la vista previa con marca de agua y pulsar **Agregar al carrito de prueba**.
El iframe notifica solo los datos de demostración con `SABER_POLAROID_DRAFT_READY`.
El cotizador arma un único ítem de prueba `print` por lote (hasta diez hojas) y comunica `SABER_ADD_PRINT` al carrito,
que calcula la seña del 50 % como los otros trabajos.

**No se transmiten ni guardan las fotografías originales**, no se sube PDF, no se
crean pedidos reales, no se abre el WhatsApp del pedido. El precio regular informado para el servicio Polaroids es **ARS 3.000 por hoja A4 de seis fotografías**; por ejemplo, dos hojas cuestan ARS 6.000 y tres cuestan ARS 9.000.
Se configura en `precios-web.json` bajo `polaroidPack.pricePerSheet` y en este prototipo **no aplica promociones**.
El carrito y el pedido siguen siendo simulados; esta vista previa no debe utilizarse para recibir trabajos reales.

## Archivos

- `index.html`: tienda/carrito de laboratorio, WhatsApp de pedidos inhabilitado.
- `cotizar.html`: puente entre iframe de cotizador y carrito; usa clave
  de `localStorage` diferente a producción.
- `cotizador-web-v2.html`: copia del cotizador con la opción Polaroid enlazada al editor.
- `editor.html`: editor móvil con seis fotos y vista previa marcada, sin descarga de PDF.
- `precios-web.json`: copia puntual del catálogo de precios para la prueba.

## Cómo probar de forma local

Estos archivos deben servirse **desde un mismo origen HTTP**, no mediante `file://`,
para que funcione la validación de mensajes entre el editor, el cotizador y el carrito.
Desde esta carpeta, por ejemplo:

```bash
python -m http.server 8000
```

Abrir `http://localhost:8000/index.html` y elegir impresión de fotos.
Al terminar una hoja, pulsar «+ Otra hoja de 6» para armar la siguiente. El sistema no permite terminar hasta completar las seis fotos de cada hoja. Después, usar «Agregar al carrito de prueba»; volver a la
tienda y comprobar el ítem y el cálculo del 50 %. Se pueden combinar
artículos y otros trabajos. La página no envía el pedido.

## Pendiente antes de producción

1. Almacenamiento privado de originales y encuadres, más generación de PDF solo en servidor.
2. Registro de pedidos y referencia duradera recuperable por Librería Saber.
3. Validar calidad de imagen y subidas de varias hojas; límites y caducidad de archivos.
4. Revisar reglas comerciales y futuras promociones: precio regular actual ARS 3.000 por plancha de seis.
5. Revisar eliminación/cancelación de trabajos y privacidad de datos.
6. Testeo integral desde celular, prueba de carrito mixto, y control de seguridad.
7. Publicación únicamente tras aprobación expresa del titular.

Este prototipo **no afirma que Librería Saber haya recibido los archivos**.

> Carpeta servida por Cloudflare Pages: `vidriera/pruebas/polaroids` (raíz de despliegue `vidriera`).

## Ajuste de octubre 2026

- Navegación por hojas, conservación de encuadres de cada hoja y eliminación individual con confirmación.
- Total de la orden derivado del número de hojas; se muestra en el editor y se calcula nuevamente en el cotizador con el precio de configuración.
- Máximo operativo de prueba: diez hojas (60 Polaroids) por pedido.
- Se mantiene la simulación: los originales y archivos finales NO se transmiten.

## Panel de gestión — maqueta local (14/10/2026)

Archivo: `admin-demo.html` (también descargable como `Polaroids_Panel_Pedidos_DEMO_LOCAL.html`).

- Pedidos **exclusivamente ficticios**, de una a tres hojas A4; importes de ARS 3.000 por hoja, seña del 50 %.
- Búsqueda, filtros, navegación entre hojas, simulación de recepción de seña, preparado, entregado y descarte.
- Persistencia local de los pedidos ficticios mediante `localStorage`, restablecible; **ningún archivo real ni pedido real se guarda o envía**.
- PDF profesional deshabilitado; requiere recuperar imágenes originales desde el backend privado.
- No confundir el panel de demostración con `web/polaroids-admin.html` del prototipo Worker/R2. Aquel panel técnico hoy solo admite una hoja, y **no está desplegado**.
- La autenticación y el almacenamiento privados siguen pendientes. Este archivo nunca debe interpretarse como sistema de recepción seguro.


## Avance de experiencia de compra y pedido mixto (15/10/2026)

Se actualizó `editor.html` con el mismo mini tutorial de encuadre y zoom incorporado en el piloto privado de Apps Script, y se retiró de la columna izquierda el detalle técnico de imposición (pose, márgenes, marcas de corte). **No se alteraron ni las medidas de imprenta ni los recortes**.

En `index.html` del entorno de pruebas, el carrito mixto permite revisar un **texto simulado de pedido** antes de enviarlo por WhatsApp. Contiene:
- Artículos de librería, cantidades y subtotales.
- Impresión/gráfica y Polaroids por cantidad de hojas (ARS 3.000 c/hoja).
- Total conjunto y seña para los trabajos de producción, no sobre productos.
- Aclaración de que el pedido puede enviarse antes de pagar, pero la impresión requiere confirmar la seña del 50 %.

La vista previa NO abre WhatsApp ni envía/registrar pedidos. El texto lleva **SIMULACIÓN - NO ENVIAR** para evitar confundirlo con una orden real. Las fotos del `editor.html` de Cloudflare no se transfieren a Drive; el Apps Script privado sigue siendo una herramienta exclusiva de Librería Saber.

**Verificación técnica:** el JavaScript del carrito y del editor analiza sin errores de sintaxis; prueba de carrito mixto con dos cuadernos por ARS 8.000 + dos hojas Polaroids por ARS 6.000 genera total ARS 14.000 y seña ARS 3.000; contiene saltos de línea reales.

**Bloqueador antes de habilitar clientes:** el Web App de Drive actual está restringido a «Solo yo». No se puede afirmar que los clientes anónimos puedan enviar fotografías; hace falta diseñar y probar un mecanismo público con control de abuso, identificación del pedido y separación entre el sitio y las fotos privadas. No aflojar permisos ni abrir la aplicación existente al público sin aprobación. La producción pública, la rama `main` y Cloudflare original no se modificaron.

## Cotizador: Polaroids como categoría independiente (15/10/2026)

El usuario aprobó separar Polaroids de «Imprimir fotos». Cambios realizados en `cotizador-web-v2.html` **de esta rama de pruebas**:

- Nueva tarjeta propia `Polaroids`, con descripción «6 fotos por hoja A4 · $3.000 · Editor propio».
- Al pulsarla se abre directamente el editor embebido, sin tener que entrar antes al menú Fotos ni calcular un tamaño.
- `Imprimir fotos` deja de enumerar Polaroids y el selector excluye el producto de tamaño `POLAROID`; se conservan todos los otros tamaños y precios de fotografías.
- La presentación del trabajo en el carrito sigue usando un solo ítem por lote de hojas, precio regular `polaroidPack.pricePerSheet`, sin promociones y seña del 50 %.
- No habilita cargas públicas ni modifica `main` o el sitio de producción.

Se verificó sintaxis JavaScript y ocho invariantes estáticas: categoría propia, acceso directo, cotización correcta, menú Fotos depurado, puente de carrito preservado y prohibición de uploads públicos en el prototipo.
