# Interfaz PC — seguimiento único (20/11/2026)

**Estado:** en desarrollo en rama aislada. **No publicado** en la web comercial.

## Decisiones aprobadas por el titular
- Solo PC: no alterar el asistente móvil por pasos.
- Lista compacta de archivos; una ficha abierta a la vez.
- Estados explícitos `Pendiente` / `Configurado`, cantidad pendiente y botón de revisión bloqueado si falta algo.
- `Guardar y siguiente` abre automáticamente el próximo archivo pendiente.
- En modo `Todos iguales`, **configurar una sola vez** los archivos compatibles y guardarlos **todos juntos**. No pedir cinco confirmaciones para cinco imágenes equivalentes.
- Archivos que exigen opciones distintas (p. ej. ploteos o tamaños sin confirmar) permanecen pendientes.
- Presupuesto visible a la derecha y recalculado por el motor existente, sin precios simulados.
- Aviso claro de baja resolución y aceptación obligatoria; no marcar como aceptado automáticamente.
- No modificar reglas comerciales, tarifas, pagos, Central, TUS, R2 ni infraestructura productiva.

## Código de partida
- Prototipo PC V3 probado en Worker independiente `saber-ampliaciones-ensayo-20261120`, ruta `/interfaz-pc`.
- V4 con corrección de `Todos iguales` preparada y verificada localmente, **aún sin desplegar** al detener la secuencia de ZIP.
- Archivo de trabajo previamente entregado en conversación: `SABER_PC_MOTOR_REAL_ENSAYO_V4_CONFIGURACION_COMUN_20261120.zip`.
- El Worker de ensayo usa **tarifas históricas**, no el tarifario comercial vigente.
- La fuente de UI V4 se conserva en el paquete; **hay que incorporar sus fuentes al repositorio antes de volver a desplegar**. Este documento registra el estado, no simula que el código ya esté versionado.

## Flujo único de trabajo, sin parches ZIP
1. Centralizar fuentes del ensayo y cambios de PC en esta rama de GitHub.
2. Acumular correcciones y ejecutar pruebas automáticas antes de actualizar el Worker de ensayo.
3. Validar en navegador con 5 imágenes y `Todos iguales`, y con mezcla de tipos.
4. Publicar al Worker de ensayo solo el conjunto aprobado, sin tocar móvil ni producción.
5. Integrar comercialmente únicamente mediante PR autorizada y comprobación de no regresión.

## Criterios de aceptación PC
- Cinco JPG compatibles en `Todos iguales`: una selección de B/N/color, caras y copias, una acción para guardar el lote, cinco configurados.
- PDF y ploteo mezclados: configurar por lote solo los compatibles; señalar los demás.
- Cambiar una opción vuelve a `Pendiente` los afectados y exige recalcular.
- `Revisar pedido` inactivo si quedan pendientes.
- Ploteo de 61 PPP: advertencia visible y aceptación expresa, nunca automática.
- PC y móvil comparten el motor de precios comercial **solo cuando se complete la integración futura**.

## Estado de publicación
- Esta rama no afecta `main`.
- No contiene secretos, ni archivos de clientes.
- No despliega ni habilita ningún Worker.
- Siguiente paso técnico: registrar los fuentes CSS/JS exactos de la V4 y organizar pruebas en repositorio.
