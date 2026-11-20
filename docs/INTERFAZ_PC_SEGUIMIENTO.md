# Interfaz PC — seguimiento único (20/11/2026)

**Estado:** V4 de PC integrada en la rama y **desplegada solo en el Worker privado de ensayo** el 20/11/2026. **NO publicada en la web comercial**.

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
- Las fuentes de interfaz V4 ya están integradas en esta rama: `integraciones/interfaz-pc/interfaz-pc.js` y `integraciones/interfaz-pc/interfaz-pc.css`.
- Pruebas estáticas y de sintaxis de la rama: `tests/interfaz-pc-lote.test.mjs` (comando `node --test tests/interfaz-pc-lote.test.mjs`).
- Estas fuentes **todavía no están vinculadas a un despliegue automático de Cloudflare**. El Worker de ensayo antiguo no se modifica por crear commits.

## Flujo único de trabajo, sin parches ZIP
1. Centralizar fuentes de la interfaz PC en esta rama de GitHub. **Cumplido** para JS y CSS; el envoltorio Worker y su fuente comercial embebida aún deben consolidarse sin publicar secretos.
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

## Despliegue de ensayo verificado (20/11/2026)
- URL privada: `https://saber-ampliaciones-ensayo-20261120.libreriasaber.workers.dev/interfaz-pc`.
- Versión Cloudflare activa: `904e185d-73af-4480-837e-0c2474819504` (100%).
- GitHub Actions: [ejecución aprobada #44808818799](https://github.com/hernanchan/COTIZADOR/actions/runs/44808818799). Las 8 pruebas estructurales de PC aprobaron.
- El flujo confirmó HTTP 401 sin contraseña para `/interfaz-pc`, `/interfaz-pc.js`, `/interfaz-pc.css` y la página de ensayo anterior.
- Ante fallas de verificación, el desplegador hizo rollback a `7e380acc-9a44-4703-bd57-9db6333b0cf8`; el despliegue final fue verificado exitosamente.
- **Pendiente:** prueba interactiva del usuario con cinco imágenes, modo «Todos iguales», cálculo y avisos. Sin esa prueba no afirmar aceptación comercial.
- El flujo actual **promueve una versión específica ya construida**, no genera compilaciones futuras automáticamente. Para próximas correcciones de JS/CSS deberá prepararse una nueva versión desde fuentes verificadas y actualizar el despliegue controlado. No reactivar V4 vieja ante cambios nuevos.

## Estado de publicación
- Esta rama no afecta `main`; los cambios funcionales están exclusivamente en `integraciones/interfaz-pc/`.
- No contiene secretos, ni archivos de clientes.
- El despliegue aislado del Worker de ensayo V4 está confirmado; no se modifica ni habilita ningún Worker comercial.
- Siguiente paso: confirmar la UX en navegador con cinco imágenes y modo «Todos iguales»; después integrar mejoras nuevas sin regresiones.
