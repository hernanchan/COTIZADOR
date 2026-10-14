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
