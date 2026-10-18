# Pagos Librería Saber — preparación local del 18/10/2026

## Estado comprobado

Base: rama `pagos/mercadopago-checkout-pro-pruebas-20261017`, commit `1cc9784`.
Los cambios de esta revisión son **locales y no desplegados**. Esta rama tiene Cloudflare Builds conectado según su README: hacer push puede publicar el Worker de ensayo. No se hizo push, merge, despliegue, cambio de configuración remota, alta de servicios ni cobro.

**No equivale a una aprobación de salida ni a una prueba con Mercado Pago/Google/Cloudflare reales.**

## Implementado

- Carrito de catálogo y Polaroids, pago total, precios de servidor, constancias de recepción y vínculo con el intento antes de borrar la clave temporal de subida.
- Cliente de checkout y proxy de mismo origen. La clave administrativa nunca se entrega al navegador. Sesiones con token aleatorio, hash en D1, vencimiento a 24 horas, Turnstile con hostname/acción y limitador obligatorio. Proxy con secreto exclusivo de servicio, comprobación de origen y máximo de 64 KB también en solicitudes fragmentadas.
- Frontend de ensayo generado fuera de los HTML públicos, incluido retorno que consulta el servidor y no confía en parámetros enviados por Mercado Pago. No manda mensajes de WhatsApp.
- Un intento conserva su ID antes y después de cargar fotos. Doble clic comparte operación en cliente; bloqueo SQL coordina creación concurrente de preferencia. Reintentos usan la preferencia persistida. El importe vence a 24 horas y se configura expiración en Mercado Pago.
- `notification_url` explícita en preferencias y retorno configurable. HMAC exige ID, request-id y timestamp de hasta 15 minutos; conciliación alternativa recorre pendientes sin dejar permanentemente atrás los antiguos.
- Registro de pago solo si es aprobado, ARS, importe completo, cuenta vendedora y orden comercial coincidentes; se admiten `live_mode=false` o, si informa `true`, únicamente identidad de vendedor confirmada con `tags` que contiene `test_user` mediante `GET /users/me` autenticado y coincidencia con el vendedor configurado.
- Revisión de pagos previamente aprobados. Una devolución parcial/total o cambio de estado retira el pedido del listado apto para producción y marca el estado de cliente como `review`. No se emiten devoluciones automáticamente. No se vuelve a habilitar automáticamente un pedido observado.
- Lectura de importes argentinos `3.500,00` sin concatenar centavos. Se rechazan formatos ambiguos o importes fraccionarios: este esquema trabaja en pesos enteros.
- Centro privado: detalle de líneas/referencias solo autenticado, pago íntegro y sin revisión negativa. No se guardan fotografías, tarjetas ni uploadKey en D1.

## Pruebas reproducibles

Requiere Node 24+ para `node:sqlite`:

```sh
node tools/test-pagos.mjs
```

La suite usa SQLite real con claves foráneas y rollback de batches. Mercado Pago, Google y Turnstile están simulados; toda salida de red no prevista falla. Cubre:

1. Sesión → recepción de 12 fotos/2 hojas → 2 artículos de $3.500 + Polaroids de $6.000 → total de $13.000.
2. Precio manipulado, recepción incompleta, sesión ajena/vencida, origen externo, acceso sin clave y limitación de intentos.
3. Reintento de carrito, carrito cambiado con mismo ID, doble checkout concurrente, preferencia única y cotización vencida.
4. Pago pendiente, vendedor/importe incorrectos, firma falsa/antigua, aviso repetido y recuperación mediante conciliación sin webhook.
5. Aparición del pedido y sus dos líneas en el panel solo tras aprobar el pago completo; devolución parcial lo retira y bloquea otro checkout.
6. Reutilización de una recepción consumida: falla la operación completa sin dejar órdenes huérfanas.
7. Respuesta perdida después de crear una preferencia: se recupera sin otro POST de creación.
8. Cliente: ID estable, pago total, doble clic, destino Mercado Pago y nuevo pedido solo tras pago confirmado.
9. Regresiones de editor/carrito y configuración pública apagada. Las fuentes públicas y wrangler se comparan con la rama original.

## Vista de ensayo

```sh
node tools/build-checkout-preview.mjs /tmp/saber-checkout-preview
```

Genera tienda, editor, cliente y retorno **apagados**. Solo la copia generada agrega `/api/checkout` al archivo de rutas. La recepción existente permanece apagada. Abrir estos HTML como archivos no constituye una prueba de los endpoints ni habilita nada. No ejecutar comandos de publicación para probarlos.

## Configuración pendiente del piloto (requiere autorización para desplegar)

No se configuró remotamente ninguno de estos valores/bindings:

| Capa | Requisito |
| --- | --- |
| Worker pagos | D1 existente de pruebas, esquema actualizado; secretos MP de ensayo, ID vendedor y HMAC; TEST_WEBHOOK_URL del ensayo |
| Worker pagos | CHECKOUT_ENABLED=APROBADO; CHECKOUT_HOST; CHECKOUT_RETURN_URL=https://HOST/pedido-pago.html |
| Worker pagos | CHECKOUT_GATEWAY_KEY secreto exclusivo compartido con proxy; TURNSTILE_SECRET_KEY; binding CHECKOUT_RATE_LIMIT |
| Pages/proxy | PAYMENTS como service binding al Worker de ensayo, CHECKOUT_GATEWAY_KEY, CHECKOUT_ENABLED y CHECKOUT_HOST coincidentes |
| Frontend generado | enabled=true, rollout=APROBADO, site key pública para el host autorizado; widget con acción checkout |
| Recepción Polaroids | Verificar el entorno de recepción ya existente y su configuración de prueba. El verificador actual consulta el endpoint protegido de libreriasaber.com.ar; no se habilitó ni se escribió en él |

No añadir R2. No crear D1, planes ni servicios nuevos sin autorización. Si el limitador o service binding no están disponibles sin costo dentro de la infraestructura actual, mantener el flujo apagado y resolverlo antes del piloto. Los valores de activación anteriores son requisitos técnicos, no autorización.

## Impedimentos concretos para declarar listo para publicar

- Falta desplegar y ensayar con las cuentas y credenciales reales de **prueba**, comprobar hostname de Turnstile, comunicación entre Workers y Google, PDF privado y verificación del pago. El piloto informó `live_mode=true` aun en Sandbox: se agregó comprobación de `test_user` del vendedor autenticado. Falta comprobar esa consulta real; sin confirmación el pago continúa bloqueado. Nunca se admite una cuenta real por el solo hecho de coincidir su ID.
- El Centro muestra referencias de archivos, no enlaces de descarga ni el PDF. Debe comprobarse su localización en el panel privado de Drive y definir el acceso administrativo sin exponerlos al cliente.
- Otros trabajos de gráfica/impresión permanecen bloqueados: todavía no tienen presupuesto de servidor ni constancia de todos sus archivos. El catálogo y Polaroids sí tienen validación. No afirmar que el carrito de todos los servicios está completo.
- El catálogo CSV no confirma ni reserva stock. Requiere decisión comercial antes de cobrar artículos sin confirmación de existencia.
- Un intento ya creado queda congelado. Cambiarlo devuelve 409. Pedidos vencidos y pagos en revisión necesitan resolución administrativa; no se liberan automáticamente sus referencias para otro cobro.
- Si se pierde la respuesta de creación, el intento persistido impide otro POST a ciegas. Se busca y recupera una única preferencia por referencia externa; resultados ambiguos o inexistentes bloquean el checkout para conciliación administrativa. Este caso pasó con la API simulada; falta comprobar la búsqueda y consistencia real de Mercado Pago en el piloto.
- Los mensajes comerciales/WhatsApp y textos legales siguen pendientes de revisión. Se conserva la tienda pública con su comportamiento previo; el ensayo no la modifica.

## Publicación y reversión (no ejecutadas)

1. Antes de push, comprobar/restringir Cloudflare Builds para que el permiso cubra el despliegue de ensayo. No subir esta rama asumiendo que es solo almacenamiento.
2. Con autorización, aplicar esquema aditivo en D1 de pruebas, configurar bindings/secretos y desplegar exclusivamente el piloto aislado. Probar pedido realista, rechazo, repetición, retorno, recepción, PDF y panel.
3. Resolver impedimentos anteriores y revisar WhatsApp/textos. Mantener accesos públicos cerrados.
4. Presentar resultado verificable y pedir autorización expresa para la activación pública coordinada.
5. Reversión: apagar CHECKOUT_ENABLED en proxy y Worker, volver al frontend anterior y conservar órdenes, pagos y auditoría. No borrar D1 ni Drive. Conciliar pagos que lleguen después del cierre.

## Corrección durante piloto · 18:39 ART

La captura del diagnóstico del pago de catálogo $4.500 mostró approved, moneda, importe, vendedor y orden comercial correctos, pero `paymentLiveModeFalse=false`. Se reemplazó la exigencia absoluta de `live_mode=false` por `paymentEnvironmentAllowed`: false es válido; true requiere consultar /users/me con el token servidor y confirmar ID del vendedor y etiqueta test_user. La preferencia sigue validándose desde merchant_order, pues el pago observado no incluye preference_id directo. Prueba SQL añadida: vendedor real con live_mode=true se rechaza; cuenta con etiqueta test_user se admite. El pago existente se puede conciliar sin volver a cobrar.

Referencias primarias: https://github.com/mercadopago/sdk-go/tree/master/pkg/user y https://developers.mercadolibre.com.ar/consulta-usuarios (campo tags/test_user). No se guardan ni se muestran datos personales devueltos por /users/me.
