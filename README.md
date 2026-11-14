# Librería Saber — Cotizador y sistema de pedidos

Repositorio de desarrollo e histórico de la web, cotizador de impresiones y ploteos, recepción de archivos, pagos, Central de Pedidos y módulos de gráfica.

**Documentación actual:** [Manual maestro del sistema](docs/MANUAL_MAESTRO_SABER/00-INDICE-Y-ESTADO.md).

**Protección y reutilización:** [Auditoría inicial y hoja de ruta](docs/MANUAL_MAESTRO_SABER/02-PROTECCION-Y-COMERCIALIZACION.md).

> Este repositorio es actualmente **público**, pero **no tiene licencia abierta declarada**. La posibilidad de visualizarlo no concede una autorización general para revenderlo o reutilizarlo comercialmente. Los derechos y licencias de terceros deben verificarse.

## Importante antes de modificar

- La rama `main` y la rama de integración `integracion/tus-pedido-privado-20261101` no representan la misma generación de código.
- La web pública y el cotizador de documentos se despliegan por componentes distintos. Antes de intervenir, comprobar qué código está **realmente activo**.
- El contenido histórico de `docs/` puede describir fases que ya cambiaron.
- **No copiar secretos ni datos de clientes al repositorio.** Para cambios de producción, conservar una versión previa y verificar un rollback.
- El manual maestro **no constituye por sí solo un backup** de base de datos, secretos o infraestructura.

Para seguir el proyecto en otro chat, iniciar por el manual maestro y el archivo `AGENTS.md`, sin depender de resúmenes de conversaciones.
