# Anillado conjunto — Librería Saber, 04/11/2026

## Decisiones vigentes
- Solo en rama `integracion/tus-pedido-privado-20261101`; web pública, `main`, pagos reales, MP/transferencias, Supabase/TUS y PDF originales sin cambios.
- Modalidades por PDF: sin anillado, individual y conjunto (grupo 1 a 5). El botón «Anillar todos juntos» crea el primer grupo cuando formatos/copias coinciden. Botones de orden Subir/Bajar cambian el orden efectivo del pedido y del ZIP sin modificar contenido del PDF.
- Se conserva configurar impresión compartida o por documento. Un grupo requiere al menos dos PDF, igual tamaño final y número de copias. El motor de TUS además verifica formato de selección y el precio del grupo en backend.
- Hojas físicas por juego de grupo: `sum(ceil(ceil(páginas elegidas / páginas por cara)/(doble faz ? 2 : 1)))`. El importe del anillado se cotiza **una sola vez por grupo y por juego**, con escalas aprobadas del motor; no se suma por cada archivo.
- Varios grupos separados y archivos independientes son compatibles en un mismo pedido.
- Central y ficha PDF del ZIP: integrantes y orden, cantidad de anillados (= juegos), hojas físicas del grupo. Originales PDF numerados. Si el manifiesto D1 es histórico/incompleto, la ficha muestra advertencia en vez de suponer instrucciones.
- Tests: `tests/tus-anillado-conjunto.test.mjs` (TUS y verificación con PDF real) y `tests/tus-anillado-conjunto-ui-zip.test.mjs` (selección, combinación de 3 PDF, cálculo de hojas para instrucciones, dos grupos, casos inválidos).

## Verificación y publicación
Primero CI de rama privada. Después despliegue exclusivamente en los Workers privados `saber-documentos-pruebas` y `saber-pagos-pruebas`, con comprobación de versión, Basic y rollback, sin activar cobros. GitHub no equivale a desplegado. Los pedidos antiguos siguen inalterados. Verificar humanamente un pedido nuevo de tres PDF si se decide realizar un ensayo adicional.

## Pendiente posterior
Estimación de tiempos de preparación según cola, complejidad y horario.
