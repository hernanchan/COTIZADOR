# Investigación: Google Drive + Apps Script para Polaroids

**Fecha:** 15/10/2026. **Estado:** piloto técnico privado, no desplegado, no conectado a clientes, cero archivos reales recibidos.

## Conclusión

Es técnicamente posible guardar fotografías en Drive con un Apps Script web app usando `google.script.run` y un campo de archivo HTML. Google lo documenta explícitamente en: https://developers.google.com/apps-script/guides/html/communication

**No es todavía apto para clientes anónimos.** Un Web App configurado como "Cualquier persona" y "Ejecutar como yo" puede ejecutar funciones bajo los permisos del propietario. Hay riesgo de abuso, saturación del almacenamiento, filtración de archivos por un endpoint mal diseñado, y dificultades CORS cuando el sitio externo de Cloudflare invoca `doPost` directamente. La autenticación y separación de permisos deben diseñarse y probarse antes de publicar.

## Piloto acotado

- `Code.gs` + `Index.html`: prueba de una foto JPG/PNG hasta 5 MB desde la propia cuenta administradora.
- **Despliegue obligatorio del piloto:** acceso "**Solo yo**", ejecución "**Yo**" (propietario). NO desplegar como público ni `ANYONE` / `ANYONE_ANONYMOUS`.
- El piloto permanece **desactivado por defecto**. Para una prueba autorizada, configurar propiedades de script `TEST_ENABLED=yes`, `TEST_OWNER_EMAIL` (correo propietario) y `TEST_FOLDER_ID` (ID de carpeta privada de Drive). No guardar esos valores ni fotos en GitHub.
- El usuario debe crear previamente una carpeta privada y comprobar que NO tenga personas añadidas ni acceso por enlace.
- El formulario no devuelve enlace, contenido o ID de archivo. No constituye sistema de pedidos, ni registra referencias, ni tiene panel de clientes.
- Después de probar, cambiar `TEST_ENABLED=no`, borrar los archivos de prueba y vaciar la papelera si corresponde.
- El requisito de `Session.getActiveUser().getEmail()` puede impedir la carga en algunas configuraciones de Google, en cuyo caso el piloto debe fallar cerrado; **no eliminar ese control ni abrir el despliegue**.
- No instalar, desplegar, autorizar permisos de Google ni conectar cuentas sin aprobación expresa.

## Diseño futuro (si el piloto funciona)

1. Mantener Polaroids Web dentro del **cotizador y carrito existente**, con precio de ARS 3.000 por hoja y seña del 50 %. Ninguna página paralela de pagos.
2. Resolver integración entre Pages y Apps Script sin CORS: evaluar editor servido por Apps Script o iframe controlado. `HtmlService.XFrameOptionsMode.ALLOWALL` exige mitigaciones específicas de clickjacking y validación de mensajes. No se usará automáticamente.
3. Receptor público con sus propias autorizaciones, rate limiting, controles antispam, límites efectivos de almacenamiento por día, validación de imágenes y limpieza automática; **prohibir listar/descargar** imágenes desde el mismo servicio expuesto a clientes.
4. El panel administrativo es una aplicación **separada y autenticada**, con archivos privados. El PDF profesional se genera solo allí, con originales y encuadres, y nunca se envía al cliente.
5. Solo marcar `SABER_POLAROID_READY` después de confirmar la recepción real de todas las fotografías; referencia duradera, expiración y reintentos.
6. Guardar archivos por pedido (6 fotos/hoja, hasta 10 hojas), validar calidad de impresión, retención y política de eliminación.
7. Hacer un **ensayo con teléfono y cuenta de prueba**, con 1 foto; luego una plancha de 6; después 2 hojas/12 fotos, y solo finalmente probar el carrito mixto.
8. **No usar la cuenta principal de Gmail si hay riesgo de llenarla.** Una cuenta Google separada para las imágenes limita el riesgo para el correo operativo, aunque debe mantenerse segura y estar monitorizada.

## Capacidad/costos/limitaciones

- Google cuenta personal: hasta 15 GB **compartidos entre Gmail, Drive y Fotos**, no 15 GB adicionales dedicados a Polaroids.
- Apps Script: máximo documentado de **6 min por ejecución**, **30 ejecuciones simultáneas por usuario** y límites diarios cambiantes; Google puede detener la ejecución por exceso.
- Ejemplo orientativo (sin ocupar datos reales): 6 JPG de 3 MB por pedido ≈ 18 MB/pedido; 12 JPG ≈ 36 MB. Una imagen original de 12 MB excedería el tope de este **piloto de una foto** y requeriría una solución distinta.
- Google no garantiza capacidad libre ni continuidad ilimitada de un servicio gratuito. Si Drive llega a su cuota puede afectar el correo principal.
- Para garantizar **cero gastos**, no adquirir Google One ni activar Google Cloud con facturación; mantener el piloto limitado a las cuotas gratuitas disponibles.

## Fuentes oficiales

- Comunicación HTML-Service, formulario y Blob: https://developers.google.com/apps-script/guides/html/communication
- Acceso del Web App y ejecutor: https://developers.google.com/apps-script/manifest/web-app-api-executable
- Cuotas: https://developers.google.com/apps-script/guides/services/quotas
- Carpeta privada, DriveApp: https://developers.google.com/apps-script/reference/drive/folder
- Almacenamiento Google: https://support.google.com/mail/answer/9312312?hl=es-419

**Pruebas realizadas:** cinco tests locales simulados del piloto (JPG, contenido falso, anónimo, carpeta compartida e interruptor desactivado), todos aprobados. NO se ha ejecutado el script dentro de Google Apps Script ni se ha subido fotografía alguna a Drive.

## Corrección V2 del piloto (15/10/2026)

En la prueba real el HTML se abrió, pero Chrome mostró **"Form upload failed. Please try again."** antes de ejecutar `subirFotoPrueba` en Apps Script. No hay prueba suficiente para atribuirlo exclusivamente a cookies de incógnito. En vez de subir el elemento `<form>`, el nuevo `Index.html` usa `FileReader.readAsDataURL()` y manda solamente una cadena base64 con `google.script.run.subirFotoBase64({data:base64})`. `Code.gs` valida la autorización, tamaño, cabecera de archivo y privacidad de la carpeta, decodifica con `Utilities.base64Decode` y crea el Blob mediante `Utilities.newBlob`. No se envía ningún archivo a servicios externos a Apps Script/Drive.

La solución es **un cambio de código**, no un cambio de configuración de Chrome. Ambas fuentes están en esta carpeta del repositorio. **Es necesario reemplazar los dos archivos en el proyecto Apps Script y luego actualizar su implementación existente**; cambiar GitHub por sí solo no modifica el Apps Script desplegado. Evitar crear otra implementación o abrir el acceso al público.

Ocho pruebas locales con servicios simulados aprobadas: sintaxis de cliente, coincidencia entre las funciones, carga permitida, rechazo a datos inválidos, a usuario anónimo, a piloto deshabilitado, a carpeta compartida y a datos demasiado grandes. **Aún no se probó una carga real con el código V2.**
