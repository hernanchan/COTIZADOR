# Librería Saber — Manual maestro del sistema

**Edición inicial:** 14/11/2026.  
**Objetivo:** permitir operar, mantener, recuperar y eventualmente adaptar el sistema a otro comercio sin depender de conversaciones de chat.  
**Alcance:** inventario verificable y guía de continuidad. **No contiene claves, tokens, datos de compradores ni documentación privada de seguridad.** El repositorio es actualmente público.

## Continuidad activa — 25/11/2026

El rediseño del cotizador por trabajos está en desarrollo en el PR [#34](https://github.com/hernanchan/COTIZADOR/pull/34). Estado, pruebas, límites y próximo paso: [`docs/REDISENO-COTIZADOR-TRABAJOS-20261125.md`](../REDISENO-COTIZADOR-TRABAJOS-20261125.md). No se ha publicado ni desplegado.

> **Regla:** este índice es la puerta de entrada, no sustituye el código ni el estado del despliegue en Cloudflare. Ante discrepancias, verificar la implementación y el servicio desplegado. No tratar informes históricos como estado actual.

## Norma prioritaria de la fase beta

El [Contrato de control de cambios](../GOBERNANZA/CONTRATO_CONTROL_CAMBIOS.md) define decisiones protegidas, trámite de autorización del titular por PR/SHA y comprobación automatizada sin despliegue. **No está técnicamente bloqueado el merge hasta activar GitHub Rulesets y exigir el estado `saber/contrato`.** El repositorio sigue siendo público; el contrato no contiene secretos.

## 1. Repositorio y fuente de verdad

- Repositorio: [hernanchan/COTIZADOR](https://github.com/hernanchan/COTIZADOR).
- Rama de integración comercial al crear este manual: `integracion/tus-pedido-privado-20261101`.
- Rama `main`: conserva un frente anterior/statico y **no equivale al código completo desplegado de Documentos**.
- La web comercial incluye superficies distintas: `https://libreriasaber.com.ar` (portal/vidriera) y `https://pedidos.libreriasaber.com.ar/cotizar` (comprador/documentos).
- **No actualizar `main`, cambiar visibilidad de GitHub ni modificar Cloudflare para mantener documentación.**
- Los scripts de publicación, el código empaquetado y los Workers activos deben compararse antes de declarar un release.

## 2. Situación funcional de referencia

Información consolidada a partir del código de integración, el PR [#18](https://github.com/hernanchan/COTIZADOR/pull/18) y el despliegue [43651836322](https://github.com/hernanchan/COTIZADOR/actions/runs/43651836322), que terminó en SUCCESS:

| Componente | Estado conocido | Precaución |
| --- | --- | --- |
| Cotización comercial de documentos | Publicada en `/cotizar` | Se requiere sesión y presupuestación válida |
| Experiencia móvil | Asistente de **6 pasos** dentro del mismo cotizador; Atrás/Siguiente al final de las opciones | No es un segundo motor de precios |
| Experiencia PC | Interfaz completa anterior | No aplicar estilos móvil sin verificar viewport |
| Paso presupuesto → datos | Probado en navegador Chromium con respuesta simulada del motor | No sustituye un pedido/pago real de extremo a extremo |
| Mercado Pago y transferencia | Rutas comerciales existentes reutilizadas | No se efectuó un nuevo pago real después de este cambio visual |
| Central, precios privados y seguimiento | Monitor de producción y controles de acceso conformes al despliegue citado | Monitoreo sin login no demuestra cada tarea operativa interna |
| Recepción TUS/R2 de archivos | Módulos en código y monitoreo de compuertas | Comprobar límites y disponibilidad real por caso antes de prometer soporte |
| Polaroids Express, catálogo y carrito unificado | Componentes y antecedentes en el repositorio | **No dar por terminada la integración general** sin una prueba comercial específica |

**No se deben trasladar a este manual afirmaciones como “NO_GO” o “PUBLICADO” de documentos viejos sin fecha y evidencia del release concreto.**

## 3. Documentación de trabajo

1. [01 — Arquitectura y operación](01-ARQUITECTURA-Y-OPERACION.md): piezas, flujos, mantenimiento y pruebas mínimas.
2. [02 — Protección y comercialización](02-PROTECCION-Y-COMERCIALIZACION.md): propiedad tecnológica, exposición pública, separación y plan de reutilización.
3. Historial de decisiones: [../REGISTRO_IDEAS_Y_DECISIONES.md](../REGISTRO_IDEAS_Y_DECISIONES.md) y [../PROMPT_BASE_CONTINUIDAD.md](../PROMPT_BASE_CONTINUIDAD.md). Son **históricos** y contienen referencias a estados anteriores.
4. Estado histórico de cotizador: [../ESTADO-COTIZADOR-LIVE-20261111.md](../ESTADO-COTIZADOR-LIVE-20261111.md).
5. Política acordada de eliminación: [../ESTADO-BORRADO-TUS-20261106.md](../ESTADO-BORRADO-TUS-20261106.md), verificar implementación vigente.

## 4. Cómo mantener la documentación actualizada

Cada cambio importante debe registrar:

- Qué necesitaba el comercio y qué cambió realmente.
- Rama, commit, PR y módulos afectados.
- Qué pruebas se ejecutaron y qué **no** se probó.
- Worker/versión desplegada y enlace a la ejecución, si hubo despliegue.
- Posibilidad de rollback, dependencias, decisiones comerciales y pendientes.
- Fecha y responsable de la verificación.

**Estados permitidos:** `propuesto`, `implementado en código`, `probado local/CI`, `desplegado en pruebas`, `desplegado comercial`, `validado con operación real`. No mezclar estados.

## 5. En otro chat o con otro desarrollador

Empezar por este índice, revisar `AGENTS.md`, el código vigente y el último release, y recién entonces consultar las notas históricas pertinentes. Nunca usar la memoria de chats como respaldo único.

## 6. Resguardo

Este manual guardado en GitHub **no es una copia independiente de seguridad**. Falta completar y verificar respaldos externos versionados de repositorio, exportaciones recuperables de bases de datos y configuraciones de infraestructura, con secretos separados y cifrados. No hacer copias de archivos de clientes como parte de esta documentación.

## Cierre operativo del control de cambios — 14/11/2026

**Fase:** beta publicada. **Decisión de continuidad:** cerrar este tramo y continuar desde este manual, sin reconstruir chats ni requerir que el titular configure GitHub desde el teléfono.

### Comprobado
- Contrato de doce reglas y verificador de autorización por PR + SHA instalados en la rama de integración; workflow de comprobación instalado también en `main` (sin modificar código comercial ni tarifas).
- Once pruebas automáticas aprobadas.
- Ensayo negativo real: [PR #21](https://github.com/hernanchan/COTIZADOR/pull/21) intentó modificar un archivo protegido sin comentario de autorización. El control lo rechazó y publicó `saber/contrato = failure` sobre el commit de la propuesta. [Ejecución 43656071522](https://github.com/hernanchan/COTIZADOR/actions/runs/43656071522). PR cerrado sin fusionarse.
- La compilación/publicación de GitHub Pages posterior a la instalación del control en `main` terminó con éxito (run 43656050368).

### Pendiente real — NO anunciar como resuelto
- **GitHub Rulesets:** no hay ninguna regla de protección activa. El workflow detecta cambios y publica un estado negativo, pero por sí mismo **no bloquea la fusión ni un push directo**. La conexión disponible no permite crear/modificar Rulesets; el pendiente administrativo está en [issue #23](https://github.com/hernanchan/COTIZADOR/issues/23).
- Revisar permisos y los numerosos workflows históricos que podrían desplegar sin pasar por el nuevo control, y configurar revisores/entornos protegidos antes de declarar el sistema totalmente protegido.
- Continuar el proyecto desde el código y esta documentación; cualquier nueva corrección comercial requiere pruebas y verificación del despliegue. No confundir control de cambios probado con cierre definitivo de todas las tareas de seguridad.

**Instrucción de traspaso:** el próximo chat debe abrir primero este archivo, `AGENTS.md`, el [contrato](../GOBERNANZA/CONTRATO_CONTROL_CAMBIOS.md) y el estado real de GitHub/Cloudflare. No pedirle al titular que reproduzca el contexto ni que copie un prompt. No activar cambios en producción por el solo hecho de leer esta nota.
