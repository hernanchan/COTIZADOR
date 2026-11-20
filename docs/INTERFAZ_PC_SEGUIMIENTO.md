# Interfaz PC — seguimiento único (20/11/2026)

**Estado:** V7 de PC con confirmación de tamaños por lote corregida, **activa solo en el Worker privado de ensayo** el 20/11/2026. **NO publicada en la web comercial**.

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

## Corrección V5 del 20/11/2026
- **Fallo observado por titular:** cinco PDF de imágenes con medida detectada 16,71 × 29,70 cm; en `Todos iguales` se mantenían cinco preguntas de tamaño, el bloque de configuración común estaba deshabilitado, presupuesto con cinco advertencias, lista con barra horizontal.
- **Solución programada exclusivamente para PC:** pantalla de decisión de tamaño final por lote: A4, A3 o mantener original. Ejecuta la elección individual mediante los controles existentes del motor, uno por archivo, y deja que el motor actualice la clasificación. Después muestra color/caras/copias comunes cuando hay documentos compatibles. Los avisos repetitivos se condensan visualmente; originales siguen presentes en el DOM; se suprime scroll horizontal.
- **No se presume que archivos con medidas no estándar son A4:** el cliente debe elegir explícitamente su tamaño final, sin alterar los cálculos existentes.
- **Activa en Cloudflare privado:** `65216257-8e74-41e3-b96b-52c8b3b7d825` al 100%; version anterior para rollback `904e185d-73af-4480-837e-0c2474819504`.
- **Pruebas ejecutadas:** 11/11 en GitHub; compilación funcional local y endpoints de acceso privado HTTP 401. Despliegue completado: [ejecución 44810794755](https://github.com/hernanchan/COTIZADOR/actions/runs/44810794755).
- **Método de despliegue:** las fuentes del Worker original se recuperaron por el endpoint versionado de Cloudflare con `include=modules,sourcemaps`, sin alternar versiones activas. No se descargó ZIP ni se usaron claves fuera de los secretos de GitHub.
- **Pendiente de aceptar:** validación interactiva del titular con las cinco imágenes originales; no declarar funcionalmente aprobado hasta observar selección común, cinco archivos listos y presupuesto.
- **Versión comercial y móvil:** intactas. PR todavía en borrador; requiere aprobación personal y control de cambios antes de publicar a producción.

## V6: corrección orientada al usuario (20/11/2026)
- Se comprobó localmente con **cinco PDF de 16,71 × 29,70 cm** que los botones nativos de A4 permiten resolver los cinco tamaños y que la configuración compartida habilita el guardado **5/5**. La cotización de ese ensayo local no se validó porque el servidor privado de tarifas no estaba en el entorno local.
- **Cambio visible de PC V6:** primer paso de tamaño del lote junto al presupuesto (columna derecha, siempre visible); fichas de archivos temporalmente ocultas mientras ese paso esté pendiente. Una vez definido A4/A3/original para todos, se abre la configuración compartida de color/caras/copias. La aplicación usa botones de tamaño del motor existente.
- GitHub Actions para el escenario de cinco fichas, recreación de DOM al cambiar cada una y guardado de 5/5: [ejecución 44812950741](https://github.com/hernanchan/COTIZADOR/actions/runs/44812950741). **12/12 comprobaciones estructurales aprobadas y simulación DOM integral aprobada.**
- Despliegue privado **V6 confirmado:** `feaea544-3f07-43c4-b85e-b796467ef48f`, verificado en el registro de [ejecución 44812764045](https://github.com/hernanchan/COTIZADOR/actions/runs/44812764045). Conserva autenticación HTTP 401 y protección de acceso. Version V5 para rollback: `65216257-8e74-41e3-b96b-52c8b3b7d825`.
- Los flujos viejos iniciados después fueron rechazados por protección de versión activa; **no reemplazaron la V6**.
- El PR sigue en borrador y producción no fue modificada. **Pendiente:** validación con los archivos originales de Hernán y cálculo real en el Worker de ensayo; no afirmar aprobación comercial.
- Una versión nueva no debe promoverse automáticamente con flujos de V4/V5; cada actualización requiere compilar desde la rama aprobada y verificar la versión activa previa.

## Corrección V7 (20/11/2026)
- **Captura del titular:** pese a seleccionar «Todos iguales», aparecen 6 PDF de origen WhatsApp, cada uno pendiente de tamaño. El selector único de tamaño **no se mostraba**.
- **Causa confirmada en la interfaz:** la detección `needsSize` excluía cualquier archivo con botón `Ploteo / Ampliación` marcado mediante la clase `.seleccionada`, incluso cuando su ficha mostraba la pregunta `.pregunta-tamano` sin resolver.
- **Corrección:** considerar pendiente de tamaño todo archivo válido con `.pregunta-tamano`, sin depender de qué botón de clasificación esté visualmente seleccionado. Así, el panel derecho debe ofrecer una sola elección A4/A3/original para todo el lote y ocultar temporalmente las fichas mientras se resuelve.
- **Prueba más representativa:** escenario DOM de **6 PDF con botón «Ploteo / Ampliación» seleccionado**, una elección A4, seis tamaños resueltos, una configuración común y **6/6 guardados**.
- **GitHub Actions:** 12/12 tests estáticos aprobados, simulación DOM aprobada; compilación del Worker y verificación de acceso privado correctas: [ejecución #44813779812](https://github.com/hernanchan/COTIZADOR/actions/runs/44813779812).
- **Cloudflare Worker de ensayo privado:** versión activa `67bbf783-d1f3-4911-b59e-da5e1d891ada` (V7); versión anterior para rollback `feaea544-3f07-43c4-b85e-b796467ef48f` (V6).
- **Sin cambios** en producción, móvil, tarifas ni pagos. El PR sigue en borrador. **Pendiente:** validación interactiva con los archivos del titular y presupuesto de referencia. Las pruebas DOM simulan las fichas; no son prueba de extremo a extremo del navegador con documentos de clientes.

## Estado de publicación
- Esta rama no afecta `main`; los cambios funcionales están exclusivamente en `integraciones/interfaz-pc/`.
- No contiene secretos, ni archivos de clientes.
- El despliegue aislado del Worker de ensayo V4 está confirmado; no se modifica ni habilita ningún Worker comercial.
- Siguiente paso: confirmar la UX en navegador con cinco imágenes y modo «Todos iguales»; después integrar mejoras nuevas sin regresiones.
