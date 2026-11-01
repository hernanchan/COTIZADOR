# Activar en el Worker PRIVADO saber-pagos-pruebas la vista de descarga de PDF originales TUS.
# Tests D1 + API admin autenticada obligatorios. Desplegar 100% sólo en Worker de pruebas.
# La seguridad debe seguir devolviendo HTTP 401 sin clave y /health paymentsEnabled=false.
# Rollback automático si falla, sin cambios en main, web comercial, pagos ni Polaroids.
# Cambios: worker central c3b25caf; tests 3e0fb959; descarga Basic documentos 677fed48.
# El pedido e2d76c8b-ce1c-4daf-9030-4bd402295a68 sigue NO PAGADO.
