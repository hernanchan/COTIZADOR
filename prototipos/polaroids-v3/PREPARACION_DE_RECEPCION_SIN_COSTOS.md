# Polaroids Web V3 — preparación de recepción privada

**Estado al 15/10/2026:** editor y carrito de pruebas accesibles en Cloudflare Pages. DNS resuelto en Chrome mediante DNS seguro Cloudflare. **La recepción real NO está activada.** Rama pública `main` intacta en esta etapa.

## Prototipo que ya funciona

- Editor 1–10 hojas A4, 6 fotos por hoja, proporciones y guías de corte aprobadas.
- Cotizador privado de pruebas y un único carrito mixto simulado.
- Tarifa pública aprobada: ARS 3.000 por hoja de 6; seña 50%.
- Panel de demostración optimizado para Android, pedidos ficticios.
- Prototipo de Worker/R2, editor con subida, y panel privado multipágina están en el ZIP entregado **Libreria_Saber_Polaroids_Recepcion_Privada_V3_Varias_Hojas.zip**, todavía **NO** publicados como código ejecutable desde el repositorio.

## Seguridad y autorización para activar recepción

1. **No crear R2 ni contratar servicios sin autorización nueva y expresa del titular.**
2. R2 Standard: Cloudflare anuncia 10 GB-mes, 1 millón de operaciones clase A y 10 millones de clase B incluidos mensualmente; el consumo excedente es facturable. La suscripción R2 no garantiza una factura de $0 (ver https://developers.cloudflare.com/r2/pricing/ y https://developers.cloudflare.com/r2/get-started/).
3. Mantener los originales y los encuadres en R2 privado, sin enlaces públicos. Panel protegido: secretos configurados SOLO en entorno de servidor; no incrustar credenciales en HTML ni en GitHub.
4. El evento `SABER_POLAROID_READY` solo se admite después de confirmar TODOS los archivos en backend. La referencia es `PS-AAMMDD-XXXXXXX`; el precio se calcula en el cotizador, nunca desde los datos enviados por el editor.
5. No entregar PDF profesional al cliente. Descarga exclusivamente administrativa después de registrar la seña. Enviar por WhatsApp solo la referencia y el precio en el carrito habitual.
6. Políticas pendientes de validar: CORS por dominio autorizado, Turnstile, validación de archivos (no solo extensión o cabecera), límites por cliente/IP y por pedido, caducidad, privacidad, protección contra solicitudes duplicadas, monitoreo y alertas. Un aviso de uso NO es una garantía automática contra cobros.
7. **Capacidad a revisar antes de activar**: V3 permite hasta 60 fotografías con un límite nominal de 12 MB por imagen (hasta 720 MB de archivos por pedido de diez hojas). Conviene definir tamaños máximos y compresión preservando resolución de imprenta antes de recibir pedidos.
8. Pruebas finales pendientes con Worker real de pruebas: carga real 1/2/3 hojas, revisión desde Android/PC, token de administración, recuperación y descarte, PDF de 300 ppp al tamaño real, pedido mixto y carrito, sin exponer archivos.

## Trabajo completado, sin despliegue

- V3: 12/12 pruebas automáticas de backend aprobadas con almacenamiento simulado; no es una prueba de producción.
- Integración de referencia/cotización disponible en `prototipos/polaroids-v3/integracion-carrito.mjs` y sus pruebas (11 comprobaciones anteriores).
- Toda la web pública y la recepción de clientes permanecen sin modificaciones en esta fase.

## Siguiente decisión

**Consultar con el titular:** mantener exclusivamente la simulación sin gastos o autorizar revisar la pantalla de alta de R2 *sin confirmar la suscripción*. No finalizar checkout, asociar medios de pago, crear buckets ni desplegar Workers hasta una aprobación específica.
