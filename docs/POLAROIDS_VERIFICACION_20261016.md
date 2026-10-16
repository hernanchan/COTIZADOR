# Polaroids: verificación de la preparación comercial — 16/10/2026

Rama: `polaroids/preparacion-produccion-20261016`. PR #1, borrador.
Base revisada: `a2908f52e9897f3e86bb9cf54d48f34841ca629b`.
`main` al iniciar: `6a7d284acdd5f29842ae8a85bbe1a549fd81fa1b`.

## Estado conservado

- `enabled:false`, `showInShop:false`, `rollout:PENDIENTE_DE_APROBACION`, clave Turnstile vacía.
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
