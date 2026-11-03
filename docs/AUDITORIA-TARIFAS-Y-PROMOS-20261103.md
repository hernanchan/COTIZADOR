# Librería Saber — Auditoría de paridad de tarifas y promociones
Fecha: 03/11/2026. Rama privada `integracion/tus-pedido-privado-20261101`. No publicar por este documento.

## Fuentes existentes y alcance

1. `precios-web.json`: snapshot técnico de 21/08/2026, generado por Presupuestador Saber V13.23.5; A4/A3 B/N y color, materiales, fotos, stickers, anillados, CAD/Póster y plotter de corte.
2. `config.json`: tarifas del cotizador existente, promociones y otros servicios comerciales. No equivale a un catálogo actualizado automáticamente.
3. `promos.json`: cinco cupones; únicamente `ANILLADO0` consta como `active: true` en ese archivo. No deducir por ello que todos los cupones de otros días estén realmente habilitados.
4. `vidriera/index.html`: anuncia siete beneficios según el día, en zona horaria del navegador. No confundir mostrar un anuncio con aplicar el beneficio en el checkout.
5. Productos de la vidriera: CSV publicado desde Google Sheets, con columnas `Precio` y `Oferta`. No están en el motor D1 de tarifas de impresión.

## Comparación comprobada de campos comunes

- **Impresiones A4 B/N (SF/DF) y A4 color obra 70 g:** los tramos comparados entre `precios-web.json` y `config.json` coinciden.
- **Anillados A4:** los tres tramos comparados coinciden.
- **Ploteo Póster / pleno, recubierto 130 g, rollo 60 cm:** **PRECIO REAL CONFIRMADO POR EL TITULAR (03/11/2026): ARS 18.700 por metro**. Se unificaron `precios-web.json`, `config.json` y el catálogo base del editor D1 en la rama de pruebas. El valor anterior (ARS 18.704/metro frente a ARS 17.300/metro) queda registrado como discrepancia resuelta. **Aún no desplegado ni publicado en la web comercial.**
- No se considera finalizada la comparación de todos los servicios, materiales, cupones y reglas: los esquemas no tienen una correspondencia uno a uno para todo el catálogo.

## Promociones que no se deben perder

Portada actual: lunes CAD 10% desde 2 metros; martes impresiones 10%; miércoles fotografía premium al precio de la normal; jueves anillado gratuito; viernes stickers A3 10%; sábado/domingo 20% online en los trabajos elegibles. Además, ofertas de Escolar, Oficina y Novedades y los cupones del cotizador.

**Pendiente:** verificar reglas, fechas, exclusiones, descuentos acumulables, límites y equivalencia entre anuncio y precio final. No activar una promoción por solo existir en `promos.json` o en la portada.

## Arquitectura de precios en desarrollo (sin activar)

- `Central privada /admin`: edición por rubro, borradores y aprobaciones privadas, historial en D1; esta edición no es todavía publicación comercial.
- `/internal/central/pricing-snapshot`: ruta POST firmada HMAC, entrega exclusivamente JSON aprobado en D1; rechaza borradores y ausencia de aprobación.
- Worker `saber-documentos-pruebas`: cliente HMAC `obtener-tarifario-d1-privado.mjs`; sus rutas de precio/catálogo pueden usar la versión aprobada con `DOCS_PRICE_ADMIN_D1_ENABLED=PRIVATE_TEST_ONLY`. **Dejar esta bandera apagada** hasta validar paridad y la experiencia completa. Sin fallback a tarifas antiguas si el flag está encendido y D1 falla.
- La aprobación en Central no debe convertirse por sí sola en una publicación comercial. Se requiere versionado de compra y aceptación explícita si la tarifa cambia durante la carga/pago.
- El catálogo de productos de Google Sheets necesita migración/edición autorizada por separado antes de ofrecer un único panel para absolutamente todos los precios.

## Bloqueos antes del lanzamiento

1. Restaurar despliegue autorizado Cloudflare: `SABER_CF_DEPLOY_TOKEN` de entorno `saber-cloudflare-pruebas` registró HTTP 401. Nunca pegar el token en ChatGPT.
2. Verificar que los nuevos módulos se compilen en el Worker privado; probar catálogo, cotización y pago sandbox con un precio de prueba modificado, sin afectar producción.
3. Decidir tarifa comercial correcta para las discrepancias, probar promociones por día con hora local de Córdoba y precios reales antes de habilitar publicación comercial.
4. Mantener desactivados los pagos reales y la web pública hasta pruebas end-to-end del mismo número de orden, PDF privado, ZIP e importe confirmado.
