# Fase comercial V3 — precios vivos y consulta por WhatsApp (05/11/2026)

**Estado:** activado solo en Worker de pruebas; sin publicar en libreriasaber.com.ar.

## Función
1. El comprador ve el catálogo activo y precios de Google Sheets, no una fotografía fija, usando \`GET /prueba-v2/diseno-sin-clave/catalogo.json\`.
2. Agrega productos y cambia cantidades; los guarda en sessionStorage dentro de la sesión.
3. «Preparar pedido para WhatsApp (prueba)» obliga a una nueva lectura de la planilla y recalcula. Si un código dejó de estar activo, lo retira.
4. Se muestra la consulta con nombres, códigos, cantidades, subtotales y total orientativo; **el usuario** debe tocar «Abrir WhatsApp» y decidir si envía el texto.
5. Sin stock reservado, sin envío automático, sin cobros y sin registros en la Central.

## Seguridad y validación
- Solo origen CSV publicado fijado en módulo; no se aceptan URL ni datos privados.
- Se admiten únicamente GET y códigos/importe normales, descripciones escapadas al pintar HTML.
- Respuesta sin cache y con \`X-Content-Type-Options:nosniff\`; imágenes desde Google Drive con origen previamente habilitado.
- CSP de visualización permite conexiones \`self\` exclusivamente, sin formularios externos ni frame embedding.
- El enlace WhatsApp existe solo después de revalidar los precios y vence 60 s después; ninguna URL de pago se utiliza.
- Si la lectura de la planilla falla, no se prepara una consulta.
- CI \`42109845552\`, \`42110405626\` éxito; deployment de prueba \`42110521555\` exitoso. El smoke corroboró \`SHEETS_CATALOGO_PUBLICO_ACTUAL_200_SIN_PAGOS\`, \`OPEN_VISUAL_ONLY_HTTP_200_NO_AUTH_NO_PAYMENT_PRIVATE_COTIZADOR_401\` y \`SABER_DIRECTO_PREVIEW_PROTECTED_LIVE_OK\`.
- Versión Cloudflare pruebas \`fe03703f-7757-4b33-a84c-f1a7cac2c3b2\`. Sin cambios en \`main\`, dominio público, D1, cobros o pedidos TUS.

**Pendiente de producción:** el catálogo sigue siendo hoja MODELO (cuatro productos activos); confirmar catálogo real, disponibilidad, y el proceso WhatsApp antes de habilitar a clientes. La integración de productos con el nuevo cotizador/pagos/Central es fase posterior, no implementada.
