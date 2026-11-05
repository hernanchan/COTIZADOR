# Almacenamiento actual TUS y diseño de liberación de espacio — 05/11/2026

## Foto actual verificada
- Proyecto Supabase: `saber-tus-lab`, organización LIBRERIA SABER PRUEBAS, Free, activo.
- Bucket `saber-tus-lab` **privado**. 40 objetos total, 211.851.276 bytes, unos 202 MiB; 36 bajo `v2/`, 202,03 MiB.
- Los PDF los envía Uppy/TUS directamente al bucket; Cloudflare Worker valida permisos y PDF; la Central y pagos registran estados en D1. No guardar PDF en GitHub ni en D1.
- Free: 1 GB almacenamiento y límite máximo de 50 MB por archivo, transferencia mensual Free 5 GB + 5 GB cacheado. Límite específico de aplicación 20 MiB/PDF, 60 MiB/tanda, 10 PDFs/tanda.
- Plan gratuito sin garantía de continuidad incondicional: proyecto puede pausarse por inactividad; superar cuotas puede restringir servicio.

## Política propuesta (a definir con propietario)
- Un pedido en estado «Entregado» puede tener acción privada «Liberar espacio» para **sus archivos exclusivamente**.
- No eliminar por cambiar solamente estado visual; entregar, verificar número pedido/objetos, confirmar irreversibilidad y registrar acto en historial. No permitir a clientes invocar eliminación.
- No borrar PDF en pendiente de pago, pendiente de transferencia, producción, reclamo, reimpresión o retención manual.
- Antes de borrar, opcional respaldo ZIP externo comprobado y/o pequeña ventana de retención tras entrega. El dueño decide plazo. Se puede programar limpieza posterior por Cron al validar pedidos entregados y dejar una eliminación manual para casos de urgencia.
- **Supabase Storage no cuenta con papelera reversible por API**. Eliminar vía API de Storage, jamás SQL directo; después de borrar conservar metadatos/ficha/pagos en D1 y mostrar archivos no disponibles en la Central.
- Abandonados/impagos requieren política independiente, con verificación estricta de cobros/transferencias pendientes.
- El módulo existente de retención de Drive (`integraciones/autocotizador/retencion/`) opera solo en simulación, no sirve para borrar en Supabase.
- **Esta nota no activa eliminaciones ni modifica el Worker**.

## Fuentes oficiales consultadas
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://supabase.com/docs/guides/storage/management/delete-objects
- https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
