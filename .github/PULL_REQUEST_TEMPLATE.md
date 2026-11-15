# Solicitud de modificación — Librería Saber

> Antes de proponer un cambio: [Contrato de control de cambios](../docs/GOBERNANZA/CONTRATO_CONTROL_CAMBIOS.md). La autorización del titular, cuando afecta código o reglas protegidas, se da **en GitHub para el SHA exacto**, no en un chat.

Motivo: Describir qué problema concreto se resuelve y por qué el cambio es necesario.

Alcance: Enumerar exclusivamente los módulos y funcionalidades afectados y aclarar expresamente qué no se va a tocar.

Pruebas: Indicar pruebas ejecutadas, sus resultados, límites y evidencias. No confundir CI con un pedido/pago real.

Retroceso: Describir cómo regresar a la versión conocida si hay una regresión, incluyendo dependencias de datos y servicios.

## Decisiones protegidas

- [ ] No cambia precios, promociones ni reglas comerciales sin autorización expresa.
- [ ] No altera pagos, transferencias, recepción de archivos ni política de purga sin autorización.
- [ ] No revierte funcionalidades ya aprobadas fuera del alcance.
- [ ] No altera producción ni publica automáticamente desde este PR.
- [ ] La evidencia está documentada con commits, pruebas y diferencias entre código y versión desplegada.

## Aprobación (solo titular)

Después de revisar **el último commit**, comentar en este PR una línea idéntica al formato indicado en el contrato. Si cambia el SHA, volver a aprobar. **El asistente no puede autorizarse a sí mismo ni comentar como titular.**
