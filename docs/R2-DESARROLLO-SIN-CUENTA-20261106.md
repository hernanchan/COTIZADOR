# R2 PDF grandes — desarrollo previo a la habilitación
Fecha: 06/11/2026. Rama: `integracion/tus-pedido-privado-20261101`.

## Trabajo realizado (sin habilitar R2, sin despliegues)
- `integraciones/autocotizador/recepcion/r2-pdf-grandes-privado.mjs`: contrato de archivo grande entre **40 MiB y 256 MiB**, 8 MiB por parte, HMAC por sesión R2 de 2 horas, referencia de orden y fichero; creación, subida por stream, cierre, validación de tamaño en R2. El recibo **no autoriza pagos ni acredita PDF**.
- `integraciones/autocotizador/recepcion/r2-pdf-grandes-cliente.mjs`: cargador de partes mediante `File.slice` (sin conversión del PDF completo a ArrayBuffer), 3 cargas paralelas, reintentos acotados y recuperación de partes confirmadas desde `sessionStorage` si sigue vigente el recibo.
- `tests/r2-pdf-grandes-privado.test.mjs`: plan de 200 MiB/25 partes, HMAC inválido y vencido, tamaños, CORS/Origin, finalización no autorizante.
- `tests/r2-pdf-grandes-cliente.test.mjs`: 200 MiB **simulados** en 25 partes, recuperación tras interrupción, no duplicar partes, límites.
- Integración de tests en `.github/workflows/tus-integracion-privada-ci.yml`, ejecución **SUCCESS**: https://github.com/hernanchan/COTIZADOR/actions/runs/42260766149 .

**Muy importante**: la simulación usa un R2 falso y un `File` ficticio. No se transfirieron 200 MiB reales, no se midió velocidad y no hay validación servidor de hash ni parseo de páginas para PDF grande. No hay rutas expuestas al cliente ni Worker desplegado con R2.

## Qué falta, por orden
1. Habilitar R2 a nombre del titular (medio de pago en Cloudflare) y crear bucket privado en clase Standard; **NO** habilitar acceso público.
2. Token con permisos R2, mantener separado de tokens Workers, y binding R2 de Worker privado. Falló intento con tokens actuales: https://github.com/hernanchan/COTIZADOR/actions/runs/42247706791 (403) y https://github.com/hernanchan/COTIZADOR/actions/runs/42247890803 (401). Workflow de alta listo `.github/workflows/r2-habilitar-bucket-ensayo.yml`.
3. Implementar endpoints autenticados de iniciar, parte y completar, unidos a la sesión de pedido existente; limitar cargas simultáneas, tamaño acumulado y abuso. No aceptar el proof como reemplazo de autenticación. La ruta HTTP del Worker debe preservar `Content-Length` para subir `Request.body` a R2 sin buffering.
4. Integrar el mecanismo alternativo de PDF grande en **el mismo cotizador V3**, sin modificar el transporte TUS normal.
5. Diseñar verificación **incremental** del SHA-256 y validación de páginas, clasificación y precio desde el PDF real de 200 MB, sin superar memoria de Worker. Probar integridad, no confiar en SHA calculado por navegador.
6. Central D1, ZIP/descarga original de los archivos R2 y hoja de producción, estados, recuperaciones y eliminación solo después de Entregado, con controles de referencia.
7. Probar transmisión real 20/45/80/200 MiB y varios PDF mezclados; medir tiempo frente al TUS rápido actual, interrupción y reanudación. No declarar listo el pedido si falla verificación.

## Garantías de alcance
No modificar main ni web pública; pagos reales deshabilitados; sin borrar los 40 PDFs anteriores de Supabase; sin generar gastos ni simular creación de bucket. El código nuevo no se importa todavía desde la app publicada.

## Documentación técnica
https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
https://developers.cloudflare.com/r2/objects/upload-objects/
