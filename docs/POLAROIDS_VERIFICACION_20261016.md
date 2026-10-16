# Polaroids: verificación de la preparación comercial — 16/10/2026

Rama: `polaroids/preparacion-produccion-20261016`. PR #1, borrador.
Base revisada: `a2908f52e9897f3e86bb9cf54d48f34841ca629b`.
`main` al iniciar: `6a7d284acdd5f29842ae8a85bbe1a549fd81fa1b`.

## Estado conservado

- `enabled:false`, `showInShop:false`, `rollout:PENDIENTE_DE_APROBACION`. Clave pública Turnstile configurada en `608b8adeeb623c507ed436ba69200b6696066854`.
- No se fusiona a main ni se activa recepción ni acceso comercial.
- Sin R2 ni nuevos servicios, bindings de almacenamiento o contrataciones.
- El PR tiene despliegues automáticos de vista previa de Cloudflare. Eso no equivale a publicar en el dominio oficial.
- La rama de integración de pruebas tiene una historia divergente. No fusionarla completa: la preparación comercial parte de main y conserva solo los archivos necesarios.

## Correcciones

1. El editor ya no acepta `unitPrice` por URL: muestra y agrega al carrito el mismo valor existente de $3.000 por hoja.
2. Durante recepción, reintento y después de la confirmación se bloquean cambios de fotos y encuadres. El carrito usa una instantánea del pedido confirmado, no cantidades modificables posteriormente.
3. Se evita un segundo envío simultáneo y enviar mientras se están cargando archivos o está abierto el ajuste de encuadre.
4. El editor exige `receptionEnabled:true` en el diagnóstico del relay antes de anunciar recepción disponible.
5. Una consulta de estado con JSON `null`, primitivo o array se rechaza sin excepción del servidor. La lectura se limita a 2.000 bytes incluso sin Content-Length.
6. El texto de las fotos de muestra habla de vista previa, sin prometer al cliente un PDF descargable.

## Pruebas ejecutadas (sin servicios externos)

Desde la raíz del repositorio, Node.js 24:

```sh
node tests/polaroids-preparacion.test.mjs
node tests/polaroids-carrito.test.mjs
```

Ambas PASAN.

- Sintaxis de los scripts del editor, tienda, cotizador y módulo del receptor.
- Recepción apagada y cada requisito de activación fallando por separado: cero contactos a Google.
- Dominio/origen/Sec-Fetch-Site incorrectos, ASSETS ausente o JSON inválido: rechazo.
- Consulta de estado mal formada o excesiva: rechazo controlado; contenido declarado mayor a 15 MiB: rechazo.
- Respuesta de estado limitada a los campos necesarios: no salen URL privadas ni uploadKey.
- HTTP 302 de Google significa despachado, nunca recepción confirmada.
- Ejecución de los scripts reales con DOM y red simulados: 19 fotos, cuatro hojas, confirmación final, bloqueo de edición y carrito con artículo de librería existente.
- Precio $12.000, seña $6.000, sin duplicación al pulsar dos veces, referencia incluida en el mensaje preparado para WhatsApp y sin claves ni fotos en localStorage/mensaje.

Esto no sustituye una prueba visual ni un envío real contra Cloudflare y Apps Script.
El navegador local no estaba instalado y su descarga falló. La prueba visual no se declara realizada.

## Pendientes reales de la activación (no modificar todavía)

- Confirmar configuración de Pages: raíz de proyecto y directorio de salida `vidriera`, Functions y ASSETS, rutas exactas y redirección www. El despliegue previo exitoso en el PR no prueba por sí solo que el relay esté operativo.
- Confirmar hostname/secret de Turnstile y propiedades de Apps Script para producción. El receptor revisado del piloto exige hostname exacto: no alcanza con cambiar el JSON público. El código del piloto se revisó en `88cb9c3fc38a8c662ca179461e4e36895144dc6d`; esto no certifica su despliegue ni propiedades actuales.
- El bridge URL sigue siendo el existente; no se creó un receptor productivo separado.
- Definir conservación de fotos/PDF. `pruneOrderStates_` del piloto solo elimina estados técnicos mayores a 14 días: NO borra fotografías ni carpetas de Drive. No prometer borrado automático.
- Aprobación explícita para fusionar; aprobación de activación por separado. Luego prueba real controlada antes de mostrar accesos comerciales.
- Al recibir pedidos, verificar referencia y PDF en el panel privado. El carrito es local y no reemplaza esa comprobación de recepción.

## Continuación: revisión visual en navegador remoto

Se verificó la vista previa de la rama en `https://polaroids-preparacion-produc.libreriasaber.pages.dev/polaroids/editor` (URL final sin extensión).

- Carga de seis fotos de prueba y segunda hoja con doce fotos: correcto; total $6.000.
- Modal de encuadre visible sin superposiciones en la ventana de escritorio revisada.
- Zoom al 350% actualiza la advertencia a calidad baja, 116 ppp, y permite aplicar el encuadre.
- Vista general de ambas hojas y hoja ampliada correctas; envío permanece deshabilitado.
- En tienda, categoría Impresión y gráfica sin acceso visible a Polaroids; en cotizador, acceso también oculto.
- No se probaron en esta revisión tamaños móviles ni transmisión real de fotografías.
- El navegador bloqueó la navegación al endpoint de diagnóstico: no se obtuvo evidencia de ejecución remota de la Function. No se intentó eludir ese bloqueo.
- Cloudflare Dashboard requiere inicio de sesión en este navegador; revisión de la configuración de cuenta pendiente de acceso.

Esta revisión resuelve la inspección visual de escritorio que antes estaba pendiente por falta de Chromium local; no sustituye la comprobación de configuración ni una prueba real autorizada.

## Confirmaciones desde la cuenta del titular (16/10/2026)

- Capturas de Pages: producción sigue en main `6a7d284`; raíz y comando de compilación vacíos, salida `vidriera`. Preview `f5f0c591-5dee-4d88-8e27-740c981df64c` corresponde a `4694a2a`.
- La pestaña Funciones confirma GET `/api/polaroids-ping`, GET y POST `/api/polaroids-receiver`. Rutas de invocación limitadas a ambos endpoints. Esto confirma registro, no ejecución ni disponibilidad de ASSETS durante una solicitud real.
- Widget existente LIBRERÍA SABER - POLAROIDS, modo Gestionado. Originalmente solo autorizaba `polaroids-integracion-sin-r2.libreriasaber.pages.dev`. El titular confirmó haber agregado y guardado `libreriasaber.com.ar` conservando el piloto; no se inspeccionó una captura posterior al guardado.
- Clave pública suministrada por el titular e incorporada en el JSON de preparación. No se solicitó ni almacenó la clave secreta.
- El titular confirmó que la propiedad actual `TURNSTILE_HOSTNAME` del receptor es `polaroids-integracion-sin-r2.libreriasaber.pages.dev`. Se conserva para no interrumpir el piloto.
- Para la transición autorizada al dominio oficial, el receptor deberá aceptar `libreriasaber.com.ar`. Con la validación actual de un único hostname, sustituir la propiedad dejará de aceptar nuevas recepciones del piloto. No modificarla antes de coordinar la activación.
- Permanecen pendientes ejecución real del relay preparado, comprobación móvil, redirección www, política de conservación y prueba completa sobre el dominio oficial después de autorización. No se fusionó ni se activó ningún acceso.

## Cierre de revisión autónoma: teclado y transición

- Error reproducido en la vista previa: ArrowRight sobre Zoom permanecía en 100 %, porque el manejador global de encuadre cancelaba el comportamiento del control.
- Corregido en `78567c7bc6b7b2be5ba299e1bdf9ad98ef2838a0`: los controles de formulario conservan sus teclas; Escape sigue cerrando el editor.
- Verificación del despliegue con `?revision=78567c7`: ArrowRight cambió de 100 % a 101 % y la resolución efectiva de 406 a 402 ppp. Ambas suites existentes de Node volvieron a pasar sobre el editor corregido.
- La herramienta del navegador remoto no expone cambio de viewport ni emulación de dispositivo. El intento de zoom de navegador no cambió el ancho (1363 px). No declarar inspección visual móvil completada; solo se revisaron reglas CSS y eventos de puntero en el código.

### Secuencia preparada, NO ejecutada

1. Obtener autorización explícita de publicación. Revisar diferencias con main actual y conservar cualquier cambio ajeno al proyecto antes de fusionar el PR con recepción y accesos apagados.
2. Verificar que el editor servido en el dominio oficial corresponde a la revisión aprobada, incluida adaptación móvil y redirección www. Comprobar que la recepción sigue apagada.
3. En la ventana de activación aprobada, cambiar TURNSTILE_HOSTNAME a libreriasaber.com.ar (guardar el valor del piloto para reversión), habilitar recepción con showInShop todavía false y realizar un pedido controlado. Confirmar PDF privado, originales/recortes, referencia, precio y seña en carrito y panel. No enviar WhatsApp automáticamente.
4. Solo después de esa prueba y de la aprobación de los accesos comerciales, activar showInShop. Si falla la prueba, apagar recepción y conservar accesos ocultos; restaurar hostname del piloto si se necesita volver a sus pruebas.

La política de conservación de fotos sigue sin definir: no configurar eliminación automática sin decisión del titular. No se ha cambiado main, el despliegue oficial ni la propiedad de Apps Script.

## Publicación autorizada y verificada — 16/10/2026 19:48 ART

El titular autorizó la publicación. PR #1 salió de borrador y fue fusionado en `0866197d2f5cb0ad80e1936e91d5d33654cea3ec`, con configuración apagada.

- Editor visible en `https://libreriasaber.com.ar/polaroids/editor?revision=0866197`; botón de servicio deshabilitado. Zoom con teclado 100 → 101 % verificado en el dominio oficial.
- Cotizador oficial carga su iframe real con menú de servicios y beneficio del viernes. Acceso nuevo Polaroids oculto.
- Tienda en www carga y categoría Impresión y gráfica conserva acceso al cotizador sin mostrar Polaroids. La URL del navegador permanece en www: no se certifica redirección al dominio raíz. La activación actual está restringida al dominio raíz; no ampliar hosts ni trasladar carritos entre orígenes automáticamente.
- Pendiente intervención del titular en Apps Script para cambiar TURNSTILE_HOSTNAME al dominio oficial antes de activar recepción. No hay acceso autenticado de este agente al proyecto Apps Script.
