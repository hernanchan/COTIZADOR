# Librería Saber — continuidad posterior a orden 009 (1/11/2026, ART)

## Resultado validado por operador
- El usuario confirmó que un pedido nuevo devolvió **orden N.º 009**, sin inconvenientes visibles.
- Prueba privada anterior: orden N.º 008, 3 PDF recibidos y ZIP confirmado por operador.
- No equiparar esa validación con cobro, autorización de impresión ni despliegue comercial. Las pruebas siguen aisladas.

## Decisión explícita de secuencia
- **No interrumpir el frente funcional para rediseño visual ahora.**
- Anotar y abordar después la experiencia/visual de PC y celular, especialmente resumen compacto, legibilidad de opciones comunes e individuales, ploteos, grupos de anillado, y pantallas de progreso/confirmación.
- El circuito de pedido ya usa un CTA único, número de orden y botón para iniciar otro pedido.
- Conservar el cotizador actual y sus precios: ninguna publicación en `libreriasaber.com.ar` sin autorización específica.

## Nuevo avance funcional posterior a la orden 009
- Documentos A4/A3: selección parcial de páginas (ejemplo `1-3,5`) propagada de carga inteligente -> portal privado -> cliente TUS -> recálculo de servidor -> ficha D1.
- Se guarda y verifica **el PDF original completo**, preservando SHA y número de páginas; solo las páginas elegidas determinan cotización e instrucciones.
- Rangos inválidos y presupuesto desactualizado se bloquean; ploteos con páginas seleccionadas parcialmente permanecen fuera de esta ruta.
- Prueba automatizada con PDF real de ocho páginas, cotización de cuatro, validación de ficha, comprobante y manifiesto.
- CI aprobada: https://github.com/hernanchan/COTIZADOR/actions/runs/41375331090
- Despliegue privado aprobado: https://github.com/hernanchan/COTIZADOR/actions/runs/41375331078
- Worker privado activo versión `96f4fcf4-730c-4343-aa34-c0a2beaa4451`, acceso Basic cerrado (HTTP 401), cobros desactivados, web comercial intacta.
- **Aún falta comprobar selección parcial con interacción real Chrome/Android**. Las pruebas de CI no sustituyen esa aceptación.

## P0 restantes antes de publicar
- Aceptación real de un pedido con páginas seleccionadas, comprobar D1 y ficha/ZIP con páginas correctas.
- Paridad con el cotizador comercial, papeles/materiales/servicios y condiciones de precios, sin cambiar tarifas sin autorización.
- Pago TOTAL de documentos integrado a Mercado Pago de ensayo, importe final servidor, cancelación/reintento, webhook y conciliación, sin habilitar pagos públicos.
- Protección antiabuso de recepción y límites, recuperación tras cierre de navegador, monitorización y gestión de abandonados.
- Central operador con estados de pago, acceso a PDF e instrucciones y bloqueo estricto de pedidos sin pago.
- Prueba real de dispositivos PC/móvil y revisión UX antes del GO/NO-GO comercial.

Prohibiciones vigentes: no despliegue de `main`, no web pública, no cobros reales, no gastos no autorizados.

## Validación real posterior: selección de 6 páginas
- El titular confirmó una prueba adicional en navegador: **subió un PDF, seleccionó imprimir 6 páginas, el sistema cotizó y finalizó correctamente**.
- Este ensayo acredita el flujo observable de selección parcial; no se informa un número de orden ni la cantidad de páginas originales, porque no fueron suministrados.
- No equivale a validación de cobros: la web de pruebas continúa sin pago autorizado.

## Pago total: primera barrera de seguridad verificada
- Se incorporó la regresión `tests/tus-pagos-prepublicacion-bloqueados.test.mjs`, basada en el Worker de Mercado Pago real ejecutado dentro de un entorno aislado sin red.
- Comprueba que pedidos con `DOCS_VERIFIED` solos o mezclados con artículos, y pedidos documentales legados, no generen preferencias de pago mientras el checkout esté cerrado.
- Verifica que `/checkout/pay` continúe inhabilitado sin autorización y que la prueba no invoque Mercado Pago.
- GitHub CI aprobado: https://github.com/hernanchan/COTIZADOR/actions/runs/41375932529
- **No se activó checkout sandbox ni producción, ni se cambió el Worker de pagos.**

## 03/11/2026 — Pedido 014 verificado en navegador y visible en Central

- Captura del operador en `/prueba-v2/`: mensaje **«Pedido recibido correctamente»**, **orden N.º 014**, **1 PDF verificado y registrado**, **total ARS 1.600**, teléfono de contacto introducido, **sin cobro autorizado**. No guardar número de teléfono ni datos del PDF en GitHub.
- En el chat sucesor el operador abrió el Centro de Pedidos privado y confirmó expresamente **«sí sí ahí aparece»**. Esto valida la presencia de la orden 014 en la Central según prueba humana. No implica por sí solo ZIP descargado, contenido de instrucciones correcto o pago realizado.
- **Siguiente paso puntual:** sin volver a enviar PDF, desde Central abrir la orden 014 y descargar el ZIP de producción para corroborar PDF original e instrucciones HTML/TXT. Las configuraciones detalladas que explican los ARS 1.600 no se acreditaron mediante la captura de recibo; no inferir error de tarifa comparando con un ensayo anterior de ARS 1.000.
- Continúan ensayos privados. No tocar `main`, web comercial, cobros reales ni publicaciones de producción.

## 03/11/2026 — Criterio de liberación de producción reiterado por el propietario

- El propietario validó orden 014 en Central y confirmó que el PDF/ZIP funcionan, pero recordó que **NO desea revisar manualmente pedidos impagos**: estos son intentos o abandonos y no originan trabajo de producción.
- **Mercado Pago (futuro flujo real):** conciliación automática, mediante webhook verificado y consulta autenticada al proveedor de pagos; validar `approved`, importe, moneda, identificación de pedido y ausencia de reversión antes de marcar pagado. No aceptar redirección del navegador como comprobación. Al quedar pagado y con archivos íntegros, mover a bandeja de producción sin intervención manual de cobro.
- **Transferencia bancaria:** ofrecerla; requiere comprobar acreditación real en banco antes de marcar pagado o liberar producción, salvo que en futuro exista conciliación bancaria automatizada. El comprobante compartido por el cliente no basta.
- **Pedidos impagos:** mantener en bandeja separada, sin preparar/descargar/impresión operativa como tarea habitual; se puede conservar acceso técnico administrativo para diagnóstico. No tomar 'PDF verificado y registrado' como 'pago confirmado'.
- Estado a 03/11: ensayo privado, cobros reales inactivos; el botón «Preparar enlace Mercado Pago (ensayo)» no significa checkout real integrado y aprobado. La inspección de ZIP orden 014 fue una prueba técnica de integridad, no un paso manual obligatorio en cada venta.
- **Próximo frente prioritario:** circuito pago total sandbox Mercado Pago → notificación → conciliación → habilitación de pedido en Central, y alternativa transferencia confirmada manualmente. Sin activar cobros reales ni publicar sin autorización.

## 03/11/2026 — Cambio de método: prueba integral de compra, no más ensayos aislados

- Requerimiento explícito: validar en una misma operación de cliente **subir PDF(s) → configurar trabajos → completar datos de contacto → pagar en Mercado Pago con comprador de prueba → webhook/consulta autenticada → conciliación D1 → Central muestra pedido PAGADO y liberable → descargar ZIP para Adobe**. Incorporar un caso alternativo de transferencia con acreditación manual y otro de abandono sin pago; no exigir al operador revisar rutinariamente impagos.
- Diagnóstico por código en rama privada: existe endpoint de preflight `/admin/api/central/payment-preflight` y preparación `/admin/api/central/payment-sandbox-prepare`, protegido por `DOCS_SANDBOX_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY`, así como `/demo/checkout` y webhook `/webhooks/mercadopago`. Eso **NO** constituye prueba integral desde el front de cliente; la pantalla de orden 014 aún dice «Pago desactivado», y el botón de preparación está en Central administrativa.
- Aceptación mínima siguiente: (1) vincular CTA de pago de cliente al pedido recién registrado, con cotización íntegra y token de sesión; (2) ensayo sandbox con cuenta comprador de prueba y vendedor test_user, preferencia generada sólo tras revalidar D1; (3) comprobar webhook firmado y consulta a MP, transacción aprobada = importe/moneda/pedido exactos; (4) Central muestra pedido pagado y producción habilitada, sin intervención administrativa; rechazar pendientes/rechazados/revertidos/duplicados; (5) repetir con transferencia para comprobar confirmación manual, y pago abandonado.
- Mantener entorno privado y sin cobros reales; conservar `main` y web comercial intactos. No activar checkout comercial por el solo hecho de pasar una prueba automatizada. Evitar pedir nuevos ZIP o nuevos envíos como prueba aislada, salvo que formen parte de la misma compra integral.
