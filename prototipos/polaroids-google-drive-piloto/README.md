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

## Piloto de 6 fotografías y recortes — 15/10/2026

Se actualizaron **los mismos archivos** `Code.gs` e `Index.html`. Ya no es necesario crear otro proyecto ni otra aplicación web.

- `Index.html`: editor aprobado de 6 fotos de 85×90 mm por hoja A4, con recorte manual, vista previa y marca de agua. En esta versión piloto es una sola hoja, JPG/PNG de hasta 5 MB por foto.
- `Code.gs`: agrega `comenzarHojaPrueba`, `subirFotoDeHoja`, `finalizarHojaPrueba`. Crea una subcarpeta privada de prueba, recibe los 6 originales por separado, valida cada recorte en píxeles y guarda `encuadres.json`.
- Los usuarios siguen restringidos al propietario por `TEST_OWNER_EMAIL`, `TEST_ENABLED` y a una aplicación web de acceso **Solo yo**. El navegador no recibe IDs de Drive; solo un identificador temporal de la hoja.
- Cada fotografía se envía secuencialmente mediante `google.script.run` y base64, evitando el error anterior de envío del formulario `Form upload failed`.
- El archivo final PDF no se genera ni se expone en el piloto; la recuperación profesional sigue pendiente.
- Si falla una carga a mitad de las seis, puede quedar una subcarpeta `PRUEBA_6_POLAROIDS_...` incompleta; hay que revisarla y borrarla manualmente tras la prueba.

**15 pruebas locales simuladas correctas** (seis cargas secuenciales, seis archivos, manifest con recortes, rechazo de incompletos, duplicados, usuario no autorizado, carpeta compartida, recorte inválido y recepción apagada). Todavía falta **probar la integración real en Apps Script con Drive**, no se ha publicado automáticamente desde GitHub.

### Actualización del proyecto ya implementado

1. Reemplazar el contenido de `Código.gs` y `Index.html` por las versiones de este directorio y guardar.
2. **Implementar → Administrar implementaciones → Editar (lápiz) → Nueva versión → Implementar**. Conservar **Solo yo / Yo** y la misma dirección `/exec`.
3. Abrir la URL existente desde el perfil Chrome dedicado, pulsar «Cargar prueba» para seis fotos ficticias y «Enviar 6 fotos a Drive». Verificar carpeta `PRUEBA_6_POLAROIDS_...` con `FOTO_1`–`FOTO_6` y `encuadres.json`.

**No se han modificado precios ni cotizador público.** El piloto no recibe fotografías de clientes.

## Versión PDF privado de imprenta — preparada 15/10/2026

La prueba de recepción en Google Drive se confirmó **realmente**: las seis imágenes originales más `encuadres.json` llegaron a Drive. **Esa implementación NO produce aún PDF**.

La **siguiente versión**, lista en este directorio GitHub, incorpora en `Index.html` recortes JPEG de 886×886 píxeles a partir de los encuadres del usuario. `Code.gs` guarda originales y recortes, y crea **en Apps Script privado** el archivo `POLAROIDS_A4_6_FOTOS_IMPRIMIR.pdf` con seis imágenes embebidas como JPEG, página A4 a escala real, Polaroids 85×90 mm, ventana de foto 75×75 mm, márgenes 5 mm a izquierda/derecha, 4 mm arriba y 11 mm abajo y marcas de guillotina fuera de las piezas.

La salida esperada de una hoja completa en carpeta privada es:
- `FOTO_1..6` originales JPG/PNG
- `RECORTE_1..6_300DPI.jpg`, 886×886 px, JPEG
- `encuadres.json` con coordenadas originales
- `POLAROIDS_A4_6_FOTOS_IMPRIMIR.pdf`, formato A4 con seis piezas

El PDF **no se devuelve a la web** ni se ofrece al cliente, solo se almacena en Drive privado. La app continúa con acceso **Solo yo** y valida propietario en servidor.

**Verificaciones locales con simulación:** 17 comprobaciones aprobadas, incluida estructura PDF (`%PDF-1.4`, A4 MediaBox, seis objetos de imagen, posiciones, tabla de referencias cruzadas y archivo privado), seis fotografías con recorte y restricciones de propiedad. **Todavía no está probada la generación del PDF real en el Apps Script implementado**, ni se midió visualmente un PDF creado con fotografías reales y guillotina; antes de producir pedidos es imprescindible prueba de impresión a tamaño 100%, sin "ajustar al papel".

Como actualización de código de una misma aplicación, se necesita reemplazar **ambos** `Code.gs`/`Index.html` y editar la implementación existente a `Nueva versión`. No modifica `main`, la web pública ni Cloudflare, no necesita R2.

## Panel de pedidos y seña — preparado en rama de pruebas (15/10/2026)

El mismo `Code.gs` e `Index.html` privado se ampliaron con botón **«Ver pedidos privados»**, sin añadir proyectos, carpetas ni propiedades de configuración.

- Lee las subcarpetas `PRUEBA_6_POLAROIDS_<referencia>` de `TEST_FOLDER_ID`, sin escanear otras carpetas de Drive.
- Muestra cada carpeta de prueba, fecha de recepción, cantidad de originales y recortes, existencia de PDF y estado.
- Estado inicial **Pendiente de seña**; permite **Confirmar seña → Preparado → Entregado** y **Anular** antes de entregar. La confirmación es MANUAL y NO implica una verificación bancaria ni cobro.
- Solo devuelve el link privado al PDF cuando se marcó **Seña confirmada** o un estado posterior. El PDF sigue en Drive privado y solo la cuenta autorizada puede acceder. No es una protección criptográfica contra el propio dueño, que puede abrir Drive directamente.
- Rechaza intentos desde otra cuenta, carpetas compartidas, referencias inválidas, cambios de estado no permitidos, y trabajos incompletos. Mantiene registro de estados en propiedades `PILOT_ADMIN_<referencia>` del mismo script. La lista se limita a 100 trabajos de prueba; se avisa si quedan otros fuera.
- Precio orientativo de este piloto de una hoja: ARS 3.000, seña ARS 1.500. Esta versión no recibe clientes públicos ni integra cobros y pedidos reales, por lo que no se debe usar como sistema definitivo de pedidos.

**Verificaciones simuladas realizadas:** 15/15 correctas (listado privado, recepción incompleta, bloqueo del PDF antes de la seña, cambios de estado, rechazo de acceso ajeno/carpeta compartida, etc.). No se probó todavía con Google Drive real en la aplicación desplegada.

Para probarlo, solo después de reemplazar `Code.gs` e `Index.html` en el proyecto Apps Script **ya existente**, crear **Nueva versión** en la implementación actual, abrir la misma URL desde el perfil propietario y pulsar **Ver pedidos privados**. No cambiar `Ejecutar como Yo` ni `Quién tiene acceso: Solo yo`.

## Compatibilidad con receptor de clientes multihoja — 15/10/2026

La prueba privada actual (6 originales + 6 recortes + `encuadres.json` + PDF) fue validada con Google Drive real por el dueño. El nuevo receptor público, todavía **desactivado**, se desarrolla en `prototipos/polaroids-recepcion-publica-controlada/` y soporta de 1 a 10 hojas por pedido con PDFs individuales. El panel privado actualizado en esta rama ahora detecta tanto carpetas piloto `PRUEBA_6_POLAROIDS_...` como futuras carpetas `PEDIDO_POL-...`, cuenta sus hojas, calcula ARS 3.000 por A4, la seña del 50 % y habilita enlaces de PDF únicamente cuando se confirma manualmente la seña. Este panel **no está instalado aún en Apps Script**: no reemplazar por ahora el código del proyecto privado. Todo cambio en `main` o producción queda expresamente excluido.
