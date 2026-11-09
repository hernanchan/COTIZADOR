# Preparación comercial V3 — 09/11/2026 · SIN activación

**Autorización existente:** el titular aprobó PREPARAR el entorno comercial, no cobrar ni publicar. Este documento no autoriza modificar \`main\`, DNS, Pages producción, MP real, Central activa, D1 ni R2. Evitar recursos con costo hasta aclarar necesidad y cuota.

## Hechos confirmados
- Cloudflare Pages **\`libreriasaber\`** sirve \`libreriasaber.com.ar\` / \`www.libreriasaber.com.ar\` desde **\`main\`** (SHA antes del corte \`864eb12272f6b8dfb2ca7eaee1be5326632e7bf3\`).
- La nueva portada V3 en rama \`integracion/tus-pedido-privado-20261101\` despliega correctamente. El titular confirmó que abre el cotizador nuevo en pruebas.
- **No existe checkout documental productivo habilitado:** las rutas de documentos TUS/R2 exigen \`PRIVATE_TEST_ONLY\`, la Central usa \`MP_TEST_ACCESS_TOKEN\`, la identidad de orden incluye \`WEB-ENSAYO-\`. No basta con reemplazar el token.
- Catálogo Google Sheets identificado como **MODELO**, 4 activos validados técnicamente, sin aprobación como inventario completo.
- La Central privada funciona, pero el build automático de \`saber-pagos-pruebas\` falla porque el root del monorepo no contiene Wrangler. Dry-run desde \`integraciones/mercadopago/pruebas\` pasó CI. No cambiar Builds sobre un Worker activo sin respaldar versión, bindings y cron.
- Purga R2 al Entregado: guardas + cron probados en simulación, sin comprobación de DELETE de un original real. No borrar ni entregar registros históricos para fabricar ese ensayo.

## Implementación concreta ahora, apagada
- \`vidriera/cotizar.html\` conserva en producción el cotizador anterior hasta que un archivo público \`portal-comercial.json\` tenga **simultáneamente** \`enabled:true\`, \`release:"GO_COMERCIAL_CONFIRMADO"\` y destino \`https://pedidos.libreriasaber.com.ar/cotizar\`. El archivo versionado queda \`enabled:false\` y \`NO_GO\`.
- El destino \`pedidos.libreriasaber.com.ar\` es **propuesto, no creado ni enlazado**. Es necesario vincular y validar el subdominio antes de cambiar el archivo. El navegador rechaza rutas de prueba, workers.dev, Pages, puertos o query strings. El control del navegador es solo navegación, **no sustituye las compuertas de pago del servidor**.
- Las previews \`*.libreriasaber.pages.dev\` mantienen acceso al cotizador nuevo **Sandbox**, exclusivamente para ensayos. No enlazar clientes reales a esta ruta.

## Contrato técnico del entorno productivo (SIN aprovisionar)
1. **Documentos comerciales:** servicio aislado del Worker \`saber-documentos-pruebas\`; sesión comprador/Turnstile propia para \`pedidos.libreriasaber.com.ar\`, no autenticación del operador. Rutas sin prefijo \`/prueba-v2\`, límite/cupo y control de archivos. Carga resumible de PDF y preprensa segura.
2. **Central comercial:** servicio y D1 de producción separados del Worker \`saber-pagos-pruebas\` y su D1 de ensayo \`60124ac5-1941-44ba-96e5-ea3165b65ec9\`. No migrar automáticamente pedidos ni cobrar usando datos sandbox. Conservar estados, instrucciones y tracking.
3. **Mercado Pago real:** credenciales de la cuenta vendedora real almacenadas solo como secretos de ese servicio; verificar identidad del vendedor con API autenticada, \`live_mode=true\`, importe ARS total, ID de orden, preferencia, estado \`approved\`, webhook con firma y conciliación idempotente. Solo «pagado» server-side abre cola Nuevos; redirección del navegador jamás basta. Transferencias: siempre pendiente hasta comprobación bancaria.
4. **R2 privados:** usar bucket/namespace separado de pruebas si se aprueba aprovisionar. PDF grande solo se sube tras pago verificado, cuota y SHA. Borrado después de Entregado con auditoría y reintentos; sin eliminar antes de entrega ni cambiar órdenes históricas.
5. **Salida y rollback:** confirmar y registrar deployment ID de producción Pages, versión anterior del Worker, bindings/D1/R2, custom domain/Turnstile, y recuperación; smoke selectivo del enlace comercial, pago confirmado, Central, descargas y privacidad. Sin GO expreso mantener apagado.

## Prueba sin tocar sistemas
\`node --test tests/v3-cotizar-preview-nuevo.test.mjs\`

Verifica: preview→Sandbox; producción con \`NO_GO\` conserva el cotizador previo; URLs de ensayo/maliciosas nunca se aceptan; el único destino futuro admisible es el host comercial propio. **Un test exitoso NO acredita cobros productivos ni autoriza publicar.**

## Próxima intervención concreta
La implementación del nuevo checkout **live** se debe separar explícitamente de \`tus-pago-sandbox-cliente.mjs\` y \`r2-prepago-checkout-documentos.mjs\` y probar con contratos sin efectuar cobros. Después, cuando exista autorización puntual del titular y sin servicios innecesarios, aprovisionar dominios/entorno comercial y verificar las credenciales de vendedor dentro de Cloudflare (sin revelarlas en chat).
