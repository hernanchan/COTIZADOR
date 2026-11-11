# Continuidad ejecutiva — Librería Saber · 11/11/2026

## Estado real comprobado en este chat
Repositorio: `hernanchan/COTIZADOR`. Rama única de integración: `integracion/tus-pedido-privado-20261101`. **No tocar `main` ni web pública hasta validación final.**

1. **R2 LIVE:** subclave de inspección privada instalada sin revelar su valor, Action `43112412131` SUCCESS. Central `CENTRAL_LIVE_R2_INSPECTION_GATE=GO_COMERCIAL_CONFIRMADO`. Compuertas de cobro R2 grande siguen **NO_GO**, incluso después del deploy.
2. **Personal:** puente de acceso e inspección original R2 desplegado en Cloudflare. Deploy inicial `43115165918` SUCCESS. Nueva publicación con rollback automático `43119086294` SUCCESS; HTTP 401 sin autenticación en board, inspection-source y inspection-original. **Esto verifica protección, NO una descarga real autenticada.**
3. **Corrección LIVE móvil/PC:** `pagina-cotizar-live.mjs` muestra precio, fecha y promoción → selector PDF/JPG/PNG → datos del cliente/confirmación. Commit `919a9c7`, con prueba de regresión `9276676`. El selector antes quedaba por debajo del formulario.
4. **Textos comprador:** `worker-fase4-cotizador-unificado.mjs` limpia aviso obsoleto «prueba privada / sin cobros» en ruta LIVE y distingue hasta 10 PDF o hasta 30 JPG/PNG. Commit `789298c`. `carga-unica-cliente.mjs` diferencia el aviso LIVE del de prueba. Commit `75f94eb`.
5. **Pruebas:** la integración privada y QA LIVE aislada pasaron para `9276676`. Workflow `43118845467` actualizó Documentos de PRUEBAS con imágenes/promociones, SUCCESS. En `2d152740` se desplegaron a los Workers de producción los cambios anteriores con backup, control de bindings y restauración automática ante fallos.
6. **No se hicieron nuevos pagos ni pedidos de clientes en este chat.** Sin E2E autenticado de un PDF >40 MiB descargado por el personal en producción. No proclamar terminada la recepción comercial R2.

## Próximo paso concreto, SIN repetir ensayos aprobados
- Abrir en navegador real `https://pedidos.libreriasaber.com.ar/cotizar` con sesión del comprador; comprobar visualmente en móvil y PC que aparece primero la carga de PDF/JPG/PNG, precio/promo/fecha y confirmación. Sin pago nuevo innecesario.
- Probar **la inspección/descarga firmada R2 con credencial del personal y un archivo sintético controlado**, comprobando Central, PDF íntegro y manejo seguro; si falla, mantener cobro R2 NO_GO.
- Solo con esa comprobación, decidir con autorización previa cuándo abrir las compuertas R2 de cobro y validar un pedido completo PDF >40 MiB; conservar los pagos TUS/transferencia ya aprobados. Publicación `main`/dominio principal solo tras validación del circuito comercial.
- El error de capturas de pantalla era **carga oculta debajo del formulario** en el HTML LIVE; no interpretar éxito de CI como prueba visual real.

## Referencias
- Run deploy final: https://github.com/hernanchan/COTIZADOR/actions/runs/43119086294
- Run instalación subclave: https://github.com/hernanchan/COTIZADOR/actions/runs/43112412131
- Rama: https://github.com/hernanchan/COTIZADOR/tree/integracion/tus-pedido-privado-20261101

Mantener los archivos PDF privados. Política: borrar el original de cada pedido al marcarlo «Entregado» una vez confirmada la integración de retención. Nunca publicar secretos ni pedir al usuario repetir pruebas ya aprobadas.

## Hotfix 11/11/2026: enlace /cotizar desde ChatGPT
- Confirmado con HTTP real vía Actions: `/cotizar` daba 200 pero `/cotizar?utm_source=chatgpt.com` devolvía 404, texto «No disponible», porque `pagina-cotizar-live.mjs` rechazaba cualquier `u.search`.
- Corrección en `integraciones/autocotizador/recepcion/pagina-cotizar-live.mjs` commit `04da5e6`: mantiene HTTPS, host, path, seguridad y gates, pero ignora parámetros no utilizados en presentación. Prueba de regresión `pagina-cotizar-live.test.mjs` commit `705be02`, QA LIVE SUCCESS.
- Despliegue productivo reversible commit `7a43983`, Actions `43121245814` SUCCESS. No modificó `main`, no generó pedidos y mantuvo bloqueados cobros R2 grandes.
- **Validación posterior definitiva:** Actions `43121365599` SUCCESS, ambas rutas `/cotizar` y `/cotizar?utm_source=chatgpt.com` **HTTP 200**, `/pedido/estado` 200; gates UI, MP y sesión en GO. El mensaje «No disponible» por parámetro queda corregido.
