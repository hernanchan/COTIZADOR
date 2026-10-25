# Cotizador V2 existente — PDF pendiente vinculado al trabajo del carrito

**24/10/2026 — Librería Saber — desarrollo privado, sin despliegue.**

## Criterio rector

Se conserva `main:cotizador-web-v2.html` como base comercial. No se reemplazaron los seis servicios, el motor de precios, los descuentos diarios/cupones ni el carrito existente. La rama `polaroids/express-pdf-unico-20261023` incorpora una mejora bajo **`?ensayoArchivos=1`**, desactivada por defecto. La vista pública sigue apuntando al cotizador de producción y no recibió cambios.

## Lo implementado

1. En el módulo existente **Imprimir documentos**, `cotizador-v2-ensayo-archivos.mjs` permite seleccionar un PDF de hasta 20 MiB y detecta su cantidad de páginas en el navegador, sin subirlo. Si no es válido, se puede escribir la cantidad manualmente; los servicios restantes no se modifican.
2. Al calcular, el archivo se vincula **al trabajo de impresión correspondiente**, mediante una referencia local única de UUID, nombre, bytes y páginas; con `estado:'PENDIENTE_DE_ENVIO'`, `recibido:false` y `verificadoServidor:false`. La asociación solo se realiza cuando las páginas cotizadas coinciden con las detectadas. La cotización y promociones continúan con el motor original.
3. Al agregar otro trabajo, cada renglón conserva su propia referencia. La vista de resumen muestra el nombre escapando el texto a través de `textContent`. Si se cambia de formulario, la selección anterior no se reutiliza por accidente.
4. Al enviar al carrito existente desde el iframe, la operación transmite exclusivamente **metadatos por `pdfDrafts` con `itemIndex`**; nunca el objeto `File`, bytes, secretos o identificadores privados de Google. La vista `vidriera/cotizar.html` acepta y almacena esos datos en `saberCartV1` únicamente en modo de ensayo. Rechaza estructuras con referencias repetidas, campos extra o falsos estados de recepción. El mensaje de pedido distingue que el PDF aún está pendiente de envío.
5. Si `ensayoArchivos` no está activado, se mantiene el contrato antiguo del carrito: `name,price,qty,detail,deposit`, sin nuevas referencias en los pedidos reales.

## Límites explícitos

**Esta mejora todavía no sube los PDF.** Al salir del iframe, el navegador conserva la asociación declarativa, pero **no los bytes del archivo** en `localStorage`. Para transmitirlo al backend hará falta reelección por el cliente o un transporte privado temporal expresamente diseñado. El `localRef` y las páginas locales **no son recibos confiables para calcular, pagar ni producir**. El servidor debe recuperar el archivo real, cotejar contenido y SHA-256, confirmar las páginas, rehacer el presupuesto y vincular cada recibo autenticado con el renglón antes de abrir el flujo de pago. No usar un mero nombre de archivo como comprobante de recepción.

El lector de pruebas usa una biblioteca `pdf-lib@1.17.1` cargada desde CDN; para lanzamiento debe empaquetarse/localizarse con fijación de versión y política de recursos. Esta etapa tampoco habilita pago, Drive o Central D1 para este flujo del cotizador V2.

## Evidencia

`tests/cotizador-v2-archivo-optin.test.mjs` comprueba que, al revertir los puntos de extensión, el **hash Git del cotizador original coincide exactamente** con `main` (`4bb9c519f0df5efea6c1e9bd3eff3f96fbed759e`). Prueba lectura de PDF real, corruptos, protección de la entrada manual, cambios rápidos y formulario.

`tests/cotizador-v2-referencias-carrito.test.mjs` verifica asociación de dos PDF a índices diferentes del mismo pedido, unicidad, flujo del carrito, rechazo de estructuras manipuladas y preservación del carrito antiguo sin el indicador de ensayo.

**GitHub Actions aprobadas:** https://github.com/hernanchan/COTIZADOR/actions/runs/40149167495. Todos los demás trabajos de CI (Central D1, GAS simulado, Worker documental, Polaroids Express) concluyeron también sin fallas.

**Próximo criterio de aceptación** (sin cambiar de estrategia): conectar una selección de archivo real al receptor privado mediante sesión autenticada; confirmar bytes/páginas/precio en servidor y únicamente entonces convertir `PENDIENTE_DE_ENVIO` en **recibo verificado** de ese mismo renglón. También se necesita prueba visual en PC y celular antes de habilitarlo al público.
