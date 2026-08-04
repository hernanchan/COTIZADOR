# Productos en oferta

La página principal lee los productos desde `ofertas.json`.

## Activar una oferta

1. Subir la foto del producto a la carpeta `assets/ofertas/`.
2. Completar los datos del producto en `ofertas.json`.
3. Cambiar `active` a `true`.
4. Cargar un `offer_price` mayor que cero.

## Campos disponibles

- `id`: identificador único, sin espacios.
- `active`: muestra u oculta la oferta.
- `name`: nombre comercial del producto.
- `image`: ruta de la fotografía.
- `normal_price`: precio anterior que aparece tachado.
- `offer_price`: precio promocional.
- `condition`: condición comercial visible para el cliente.
- `requires_print_job`: indica que la oferta está condicionada a agregar un trabajo de impresión.
- `max_per_order`: cantidad máxima permitida por pedido.
- `badge`: etiqueta visible, por ejemplo `OFERTA EXCLUSIVA`.
- `from` y `to`: fechas opcionales en formato `AAAA-MM-DD`.

## Ejemplo

```json
{
  "id": "resma-autor-a4",
  "active": true,
  "name": "Resma Autor A4 75 g",
  "image": "assets/ofertas/resma-autor-a4.jpg",
  "normal_price": 8500,
  "offer_price": 6900,
  "condition": "Oferta exclusiva agregando un trabajo de impresión.",
  "requires_print_job": true,
  "max_per_order": 2,
  "badge": "OFERTA EXCLUSIVA",
  "from": "2026-08-04",
  "to": "2026-08-31"
}
```

Para revisar la mecánica sin activar una oferta real, se puede abrir la página agregando `?demoPromos=1` al final de la dirección.
