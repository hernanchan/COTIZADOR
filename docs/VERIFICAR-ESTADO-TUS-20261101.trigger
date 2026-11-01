# Consulta autónoma de versión activa en Cloudflare para evitar más capturas del propietario.
# Solo GET deployments, registra resultado en docs/ESTADO-TUS-ACTIVACION-20261101.json.
# Sin modificaciones del Worker, sin datos secretos, sin cobros.

2026-11-01: consultar nuevo despliegue de preflight seguro (posterior a la version 6e6ff6aa), guardar ID real y estado en JSON. No redeploy, no envios PDF.

2026-11-01: validar version activada POSTERIOR a baed6a9f por corrección alcance Basic y cookie en /prueba-v2/api/; solo lectura Cloudflare, guardado GitHub. Si aún no está activa, NO declarar éxito.

2026-11-01: verificar despliegue con respuesta Cloudflare success=true y formato de respuesta distinto al esperado en CI; registrar ID activo y no ejecutar despliegue adicional en este control.

2026-11-01: confirmar nueva versión c172461f activa y que el portal sin contraseña conteste HTTP 401; no subir archivos. Verificación técnica independiente tras el despliegue automatizado.

2026-11-01: verificar versión posterior a c172461f; CI activación bb144f3a completado SUCCESS, se requiere confirmar por GET Cloudflare y protección HTTP401, no probar PDF.
