# Polaroids Saber — recepción de clientes (prototipo NO IMPLEMENTADO)

**Estado: código preparado en GitHub, desactivado y no publicado.**
No modifica el sitio público, el Web App privado que ya recibe seis fotos, ni permisos de Drive. No hay suscripción, claves privadas ni URL de una implementación pública en el repositorio.

## Por qué proyecto separado

La prueba en Apps Script con acceso "Solo yo" funciona y entrega seis originales, seis recortes y el PDF A4 privado. Los clientes sin sesión de Google **no pueden usarla**. Exponer esa misma aplicación habilitaría demasiadas funciones sobre Drive, incluidos los métodos de administración. Por eso la recepción anónima, si se aprueba, requiere **un proyecto nuevo aislado**, bajo la cuenta de Drive dedicada, que implementa únicamente `doGet`, `startPublicOrder`, `uploadPublicPhoto` y `finishPublicOrder`.

Los dos archivos preparados aquí son:
- `Code.gs`: autenticación por capacidad temporal, validación, límites y generación del PDF A4 privado.
- `Bridge.html`: puente seguro por `postMessage`, previsto para alojarse en un iframe controlado desde Cloudflare Pages y enviar las fotos mediante `google.script.run`. No responde mensajes que provengan de otro origen.

**Todavía no se conectó este puente al editor público de pruebas.** El editor de Cloudflare sigue simulando cargas. Tampoco se abrió ningún acceso anónimo.

## Reglas incorporadas, sin instalar

1. `PUBLIC_ENABLED` es **no por defecto**. Si no vale exactamente `yes`, el servidor devuelve recepción deshabilitada y no escribe archivos.
2. El inicio exige un token Cloudflare Turnstile; se verifica en el servidor por Siteverify, incluyendo `success`, `hostname` exacto y `action=polaroids`. Sin un secret real configurado no funciona. El desafío deberá ejecutarse en la página de nuestro dominio autorizado.
3. Se crea una referencia definitiva `POL-<24 caracteres hexadecimales>`, pública y apta para carrito/WhatsApp. La **clave privada de carga** es independiente, aleatoria, de 64 caracteres hexadecimales. Solo se guarda su hash SHA-256 en Script Properties; el navegador la conserva en memoria, no debe incorporarla al pedido, la URL ni localStorage.
4. Se limita inicialmente a **una hoja de seis fotos** por orden, **8 pedidos por día**, **48 fotos por día**, **250 MB en originales + recortes al día**, **5 MB por archivo** y plazo de carga de **24 horas**. Son límites iniciales de seguridad, no la capacidad comercial definitiva de 10 hojas.
5. Los archivos deben ser JPG o PNG originales y recortes JPEG de 886×886 píxeles. El servidor verifica firma de archivo, dimensiones, tamaño, rangos de los encuadres y duplicados. Las seis fotos se reciben secuencialmente.
6. Solo se guardan originales, recortes, `encuadres.json` y el PDF dentro de la carpeta privada `PEDIDO_POL-...`. La respuesta pública contiene únicamente referencia y constancia de recepción, nunca URL ni ID de Drive.
7. Las propiedades técnicas de trabajos caducados se depuran a los 14 días sin eliminar archivos. **Sigue pendiente definir con el usuario una política de conservación y eliminación de imágenes de clientes** para no agotar los 15 GB de Drive.

## Contrato previsto entre la web y el iframe

Mensajes del padre al puente: `SABER_RECEIVER_REQUEST` con `id`, `op` = `start|photo|finish`, `payload`. Respuestas desde el puente: `SABER_RECEIVER_READY` y `SABER_RECEIVER_RESULT` con el mismo `id`. El iframe valida `window.parent` y origen exacto de la página Pages; el servidor valida Turnstile, el token temporal y todas las entradas.

- `start`: `{sheets:1,turnstileToken}` → `{reference,uploadKey,maxFiles:6}`.
- `photo`: `{reference,uploadKey,index,original,printJpeg,crop}` → `{reference,received}`.
- `finish`: `{reference,uploadKey}` → `{reference,received:true,sheets:1,photos:6}`.

La referencia generada por el servidor reemplazará la referencia **provisional** `POL-...` que hoy genera el editor simulado, y solo después de un `finish` exitoso podrá marcarse `filesReceived:true` y agregarse un ítem real al carrito.

## Configuración reservada para el futuro; NO hacer todavía

Solo cuando el usuario autorice explícitamente un ensayo privado de acceso anónimo:
- Crear un proyecto separado de Apps Script bajo la cuenta exclusiva de Polaroids, sin copiar las funciones administrativas.
- Configurar mediante Script Properties `PUBLIC_ENABLED=no`, `RECEIPT_FOLDER_ID`, `TURNSTILE_SECRET` y `TURNSTILE_HOSTNAME`. El sitio se deberá limitar al hostname propio del entorno de pruebas.
- Crear la clave pública (sitekey) y secreta de un widget gratuito Cloudflare Turnstile para el hostname de pruebas y probar el flujo del iframe. La clave secreta se conserva **solo** en Apps Script; no en GitHub.
- Revisar los riesgos de spam, cuotas de Apps Script y Drive, privacidad y almacenamiento; probar acceso anónimo con fotos **ficticias** antes de cambiar `PUBLIC_ENABLED` a `yes`.
- Mantener la app privada anterior en **Solo yo**, el despliegue público independiente y `main` sin cambios.

Cloudflare Turnstile dispone de modalidad gratuita para aplicaciones pequeñas, pero Apps Script y Drive están sujetos a sus límites propios, que pueden cambiar. No se puede garantizar disponibilidad continua, ni protección total contra spam, ni operación de clientes reales hasta hacer estas pruebas.

**Pruebas con mocks:** 20/20 aprobadas para el receptor público desactivado, captcha inválido, límites, token privado, seis archivos, PDF, cierre, privacidad, etc.; 5/5 aprobadas para que el panel privado de pruebas lea carpetas futuras `PEDIDO_POL-...`, bloquee PDF hasta marcar la seña y conserve referencia. Son pruebas técnicas locales, no carga anónima real ni impresión física.

**Pendientes antes de liberar el producto:** probar HTML puente cross-origin, montar Turnstile real, probar en Android/iOS, pasar a 1–10 hojas de manera segura, vincular referencias con carrito/WhatsApp definitivo, validar registros y seña, limpieza y consentimiento para tratamiento de fotografías.
