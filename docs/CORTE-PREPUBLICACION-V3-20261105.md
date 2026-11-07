# Corte de prepublicación V3 — 05/11/2026

**Aprobación del titular (navegador):** carrito con agregar/quitar/cambiar cantidades y total; fotos de productos corregidas; lectura en vivo de Google Sheets; resumen y consulta de WhatsApp. Última confirmación: «todo ok».

**Sitio en producción:** `libreriasaber.com.ar` muestra todavía la tienda anterior. `vidriera/index.html` mantiene `saberCartV1`, seña para impresiones y envío conjunto por WhatsApp. `vidriera/cotizar.html` incrusta cotizador anterior por `iframe`, no el TUS nuevo.

**Sitio aprobado en ensayo:** `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/diseno-sin-clave`.
- V3 fotográfica con producto e impresión protagonistas.
- `GET /prueba-v2/diseno-sin-clave/catalogo.json`: lectura pública, solo CSV de Google Sheets, sin datos privados ni escritura.
- Carrito V3 con precios revalidados antes de generar consulta WhatsApp. No se envía mensaje automáticamente; no se reserva ni cobra.
- Cotizador TUS nuevo: permanece protegido en `/prueba-v2/`, no expuesto a clientes.
- Despliegue verificado en rama `integracion/tus-pedido-privado-20261101`: GitHub Actions `42110521555`, Worker `fe03703f-7757-4b33-a84c-f1a7cac2c3b2`.

## Confirmación del catálogo
Se buscó en el Google Drive conectado por «productos», «precios», «inventario», «catalogo». Solo se encontró como catálogo web pertinente la hoja **«Librería Saber · Productos web (MODELO)»**, identificador `1KowCxlQ0mZC1L1xYD7hvhKiJ9PDRnZnxRtIDVzK6JuM`. Tiene cuatro activos en el rango verificado y dos ofertas reales. **No tratar el contenido MODELO como inventario comercial completo autorizado.**

## Orden técnico de salida
1. **Catálogo comercial:** confirmar/ajustar en la planilla los artículos que realmente se ofrecen, precios y fotos. Mantener el origen Sheets sin duplicar datos ni construir otro administrador.
2. **Publicación del cotizador nuevo:** diseñar liberación controlada de TUS para clientes, protección antiabuso, límites y recuperación, pago/transferencia realmente conciliados, acceso de operador e integridad de archivos. Sin exponer `/prueba-v2/` por simple vínculo.
3. **Integración de página:** cambiar las entradas «Cotizar impresiones» a la ruta realmente aprobada; retirar promesas de carrito mixto y referencias a seña del 50% en la V3. Los productos pueden continuar por consulta WhatsApp inicialmente.
4. **Verificaciones:** móvil y escritorio, Sheets/CSV y miniaturas, navegación/CTA, pruebas de impresión, pedido pagado y Central, horarios, privacidad, SEO y rollback.
5. **Activación comercial:** únicamente después de los puntos anteriores y decisión explícita del titular. No realizar despliegue `main`, DNS, Pages ni cobros productivos automáticamente por este documento.

## NO-GO actual
- Catálogo conectado está etiquetado **MODELO** y no validado como final por el usuario.
- Cotizador nuevo aún exige autenticación privada.
- Página pública antigua sigue con el mecanismo de seña y cotizador anterior.
- No existe un carrito mixto V3 real que genere pago y orden única en D1; prohibido venderlo como integrado.

**Conclusión:** diseño y carrito de productos V3 aprobados en pruebas. **No está autorizado/terminado el lanzamiento comercial.** Evitar rehacer o volver a probar funciones superadas; concentrarse en cerrar estos bloqueos para publicar.

## 06/11 — Navegación comercial conectada en la vista V3 (sin publicar)
- Se verificó la URL pública existente del cotizador actual: https://libreriasaber.com.ar/cotizar (el enlace cotizar.html redirige allí).
- En la vista V3 sin contraseña, los CTA de «Cotizar impresiones» / «Ir al cotizador» dejaron de apuntar al aviso inerte y ahora llevan al **cotizador público ya operativo**. No se traslada el carrito de productos de la vista de ensayo: es un recorrido separado.
- El aviso de la portada incluye «Probar cotizador nuevo (acceso privado)», que abre /prueba-v2/ con la autenticación vigente del operador. La nueva carga TUS sigue cerrada al público; no confundir este acceso con habilitación comercial.
- La sección Impresión explica con claridad que en esta etapa los pedidos de artículos por WhatsApp y los trabajos de impresión se consultan por separado. Se retiró de la preview el texto que aseguraba un carrito mixto unificado todavía no implementado.
- Rama de pruebas solamente. CI completa [42221676825](https://github.com/hernanchan/COTIZADOR/actions/runs/42221676825) SUCCESS. Deploy privado [42221785886](https://github.com/hernanchan/COTIZADOR/actions/runs/42221785886) SUCCESS. Worker Documentos versión e27d00f0-1a25-4c10-b09c-a33117a3f551.
- Seguridad: tres flags de borrado siguen OFF, Mercado Pago real no habilitado, main y sitio público intactos.
- **Prioridad siguiente:** habilitar el nuevo cotizador TUS para clientes SIN reutilizar cookies ni claves del operador y SIN abrir las rutas de descarga o administración. Requiere sesión pública independiente, verificación antiabuso y bloqueo de pedidos sin pago, y su posterior integración con el carrito comercial. No repetir las pruebas anteriores de tienda/Storage.

## 06/11 — Presupuesto preliminar para clientes sin clave de operador (PRUEBAS)

- Nueva URL de ensayo: **https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/cotizar-cliente**. Abre sin contraseña de personal y exige verificación Turnstile antes de cotizar.
- Reutiliza la pantalla real de análisis local de PDFs y las tarifas aprobadas D1 exclusivamente mediante GET /api/ensayo-materiales-rapido y POST /api/ensayo-carga-unica. No emplea sesión ni clave de operador.
- Cookie independiente, firmada HMAC, HttpOnly, Secure y SameSite=Strict; validez 20 minutos. Verificación server-side de Turnstile, hostname y action saber_quote. La cookie no habilita iniciar TUS, registrar pedidos, pagos, descargas ni administración.
- Existen pruebas automáticas de bloqueo OFF, origen incorrecto, token inválido, hostname/action distinto, firma adulterada, expiración y acceso limitado únicamente a dos rutas de presupuesto.
- CI de rama [42222987656](https://github.com/hernanchan/COTIZADOR/actions/runs/42222987656) **SUCCESS**; despliegue privado de preparación [42223114504](https://github.com/hernanchan/COTIZADOR/actions/runs/42223114504) **SUCCESS**, con bandera OFF.
- Activación exclusivamente del acceso público quote-only [42223442900](https://github.com/hernanchan/COTIZADOR/actions/runs/42223442900) **SUCCESS**. Smoke externo desde GitHub Actions: GET HTML Turnstile HTTP200, /prueba-v2/ privado HTTP401, ZIP operador HTTP401, borrado interno HTTP503, solicitud sin token HTTP422. Versión Documentos **109423b5-c8b2-4c7a-a808-57e5fdce0a11**. No se habilitaron pagos reales ni producción; el sitio principal permanece intacto.
- **No es pedido comercial:** la cotización es preliminar; el visitante no puede subir, reservar, enviar ni pagar documentos. Falta ensayar Turnstile con interacción humana en navegador real y validar cotización con PDFs de distintas categorías, antes de afirmar acceso end-to-end.
- El workflow habitual de enlace TUS fue corregido para PRESERVAR la bandera quote-only de cara a futuros despliegues, sin alterar los tres interruptores de eliminación OFF.
- **Bloqueos siguientes para publicación:** conectar la sesión de comprador a TUS con límites y antispam sin abrir privilegios del operador, incorporar compra con pago real/transferencia verificada, integrar productos Sheets con el mismo pedido y terminar catálogo comercial (la fuente actual sigue siendo MODELO).

### Enlace desde la portada V3 a la nueva cotización preliminar
- La portada de diseño sin clave incluye un acceso directo «Probar cotización nueva sin clave» a /prueba-v2/cotizar-cliente, junto al acceso privado del operador. El CTA comercial de cotización sigue abriendo el cotizador público anterior para no ofrecer compras imposibles.
- Pruebas automáticas de navegación aprobadas en CI de rama.
- Deploy de portada y nuevas rutas en los Workers de ensayos [42223975540](https://github.com/hernanchan/COTIZADOR/actions/runs/42223975540) **SUCCESS**. Documentos versión dd504ef1-cb8e-44b2-9bdc-7e8ef07ec266. La verificación del deploy comprobó que se preservó la bandera previa del portal cliente quote-only y que los tres flags de borrado siguen OFF. Main y web pública no afectados.
- Pendiente: sesión de cliente con capacidad de recibir PDFs/TUS, ordenar, pagar con verificación y seguimiento; conectar con carrito de productos. No asumir por esta pantalla que ya se pueden enviar pedidos.

## 06/11 — Corrección visual de cotizador preliminar a partir de captura real
- Captura del usuario: 1 PDF A4 de 2 páginas, B/N simple faz, subtotal preliminar $200. La cotización funciona pero la pantalla era angosta, textos pequeños, resumen muy abajo y mostraba «Configuración compartida · 1 documentos», además de botón «Revisar pedido (sin enviar)» irrelevante en quote-only.
- Cambios exclusivos del `quotePage` en `integraciones/autocotizador/recepcion/cotizador-cliente-publico.mjs`: resumen único de precio trasladado arriba (sticky), tipografía y anchura mejoradas, nota breve, se ocultó el botón de revisión local y su resumen, y las opciones compartidas de lote se ocultan si sólo hay un PDF (la personalización individual permanece). No se tocó el motor de precios, el código de cargas del portal privado ni los cobros.
- Validación: CI general [42228424159](https://github.com/hernanchan/COTIZADOR/actions/runs/42228424159) SUCCESS; incluye comprobación de HTML, precio único primero y compilación del JavaScript inline de mejora. Deploy exclusivo Workers de ensayo [42228543045](https://github.com/hernanchan/COTIZADOR/actions/runs/42228543045) SUCCESS. Documentos versión `2b9e372f-5509-43bb-b395-256e41d2453b`; sigue preservado acceso Turnstile a cotización, 3 banderas de purga OFF, ZIP y operador protegidos.
- Pendiente: usuario vuelve a mirar la misma URL tras actualizar pantalla; no se afirma haber completado validación visual humana después de este cambio. Sitio comercial main intacto.


## 07/11/2026 — Bloqueante de publicación: PDF de 60 MB
**Decisión del titular:** rechazar un PDF de ~60 MB en el primer uso no es una experiencia aceptable del nuevo cotizador. La publicación del cotizador nuevo queda **NO-GO** mientras un archivo válido de 60 MB (y objetivo hasta 200 MiB) no pueda pasar el circuito completo sin atención manual.

**Diagnóstico comprobado en rama:**
- `carga-unica-cliente.mjs` todavía bloquea archivos **>40 MiB**, y un conjunto **>60 MiB** antes de enviarlos; `tus-pedido-contrato.mjs` tiene estos límites TUS expresos.
- Existe alternativa R2 con transferencia multipart de 8 MiB probada realmente a 80 y 200 MiB, reanudación, SHA-256 por rangos y borrado de objetos de ensayo (Actions `42332131513`).
- **No** equivale a cotización comercial integrada: falta análisis **autoritativo** de páginas/medidas grandes, asignación TUS/R2 por archivo, pedidos mixtos, ZIP de originales y liberación de cuotas al entregar.
- La web comercial y `main` siguen intactos; R2 permanece apagado para compradores.

**Requisitos de aceptación para publicar el cotizador nuevo:**
1. PDF real/sintético representativo de **60 MB**: carga completa con rutas R2, SHA-256 correcto, páginas y medidas verificadas por servidor sin exceder memoria; presupuesto calculado con las tarifas existentes.
2. Mismo recorrido con PDF de **200 MiB**, más pedido combinado de PDF pequeño TUS + grande R2, con número único de orden, protección por sesión y registro verificado en Central.
3. Descarga del original desde la Central/ZIP con instrucciones, pago Sandbox conciliado y bloqueo de pedidos incompletos o impagos. El cliente puede reanudar tras interrupción sin repetir toda la carga.
4. Retención/borrado: eliminar originales tras marcar entregado, liberar cuotas verificablemente y nunca borrar pedidos pendientes. Ensayo desde navegador móvil con condiciones realistas.
5. Solo después del GO técnico y autorización explícita del titular: abrir compra y cobro reales. El catálogo/portada pueden tener un calendario separado si siguen enlazando al cotizador público vigente; **no** presentar la nueva recepción como lista.

**Se retira cualquier compromiso de publicar el nuevo cotizador el lunes 09/11/2026** basado solo en que la portada esté terminada. No fijar nueva fecha sin completar las verificaciones de aceptación.


## 07/11/2026 — Caso real: plano/panel A1 de 150 MB bloquea equipos e impresoras

El propietario reporta experiencia operativa: clientes envían **un PDF de ~150 MB de una única página A1** y al intentar imprimirlo se bloquean computadoras/impresoras. Esto constituye riesgo de procesamiento en preprensa, **no motivo para rechazar la recepción comercial**.

**Revisión de código:** `medidas-local-pdf.mjs` abre el PDF completo con `file.arrayBuffer()` y `pdf-lib`; la clasificación CAD/Póster `clasificar-paginas-ploteo.mjs` vuelve a abrir el archivo y dibuja vistas de cada página en el navegador. Para 150 MB y geometría/efectos complejos esto puede producir mucha presión de memoria. El tamaño del archivo por sí solo **no demuestra** complejidad ni corrupción.

**Decisión de producto/preprensa:**
1. **Recibir** PDF de hasta 200 MiB por R2 sin que el navegador procese simultáneamente 150 MiB en memoria.
2. **Reconocer tamaño A1** por medidas verificadas y presupuestar con clasificación CAD/Póster fiable. Si el análisis no consigue verificar páginas/medidas o apariencia, el pedido queda en revisión; **no inventar precio ni cobrar como impresión lista**.
3. **Preparación de impresión separada:** original privado e íntegro → preparar una **copia de salida** con optimización de imágenes/acoplado o rasterizado solo si corresponde al contenido. No reemplazar original, no degradar líneas finas de planos CAD con DPI fijo ni imprimir automáticamente el original complejo.
4. **Señal de preprensa para operador:** PDF de ploteo **≥60 MiB** queda marcado para preparación especial, sin constituir diagnóstico de contenido, ni autorización para imprimir. Se implementa `riesgo-preprensa-ploteo.mjs`, conectado a la ficha de Central `ficha-produccion-central.mjs`, más pruebas `tests/preprensa-ploteo-pesado.test.mjs`. Esto es **una advertencia de metadatos**, no el motor de optimización terminado.
5. **Validación de producción:** comparar medida real, líneas/textos, color y escala del original frente a la copia preparada; imprimir una muestra representativa si hiciera falta. Sólo después liberar la cola, preferiblemente una carga pesada por vez para no saturar la máquina de ploteo.

**Bloqueante adicional para publicar el cotizador nuevo:** comprobar **PDF 150 MB / A1** de punta a punta incluyendo PDF procesable para impresión, sin colgar navegador, PC de producción ni plotter. No declarar esto probado sólo porque R2 transfirió 200 MiB.

La web comercial, `main` y pagos reales siguen sin modificaciones. No desplegar la alerta en Central comercial por el solo hecho de incluirla en rama de ensayo.
