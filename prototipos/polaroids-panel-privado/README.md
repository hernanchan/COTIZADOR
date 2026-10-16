# Librería Saber · Panel privado de Polaroids

**Estado al 16/10/2026: panel instalado y validado en Google Apps Script por la cuenta propietaria.** Captura del propietario confirma primer pedido POL-664B0B45776E023B08D43F46: 6 fotos, 1 hoja A4, PDF recibido y oculto por seña pendiente, total ARS 3.000 y seña ARS 1.500. No se ha probado ni confirmado ningún pago real.

**Corrección de nombre:** el archivo de Google fue creado como `panel.html` (minúsculas); `Code.gs` ahora usa `createHtmlOutputFromFile('panel')`. No volver a cambiar a mayúsculas.

Este panel es un proyecto de Apps Script **SEPARADO** del receptor público `POLAROIDS SABER - RECEPCIÓN CLIENTES`. Nunca copiar los métodos de este panel dentro del receptor público y nunca desplegar el panel con acceso «Cualquiera». Su cuenta propietaria debe tener acceso a la misma carpeta privada donde el receptor guarda `PEDIDO_POL-...`.

## Archivos

- `Code.gs`: lectura de carpetas privadas, validación de originales/recortes/metadatos/PDF, estados de seña y producción, autorizaciones.
- `Panel.html` (copiar a archivo `panel.html` en Apps Script): interfaz de gestión, filtros, botones para confirmar la seña y enlaces de impresión una vez confirmada.

## Instalación (una sola vez, en el perfil «Polaroids Saber»)

1. En Google Apps Script creá un **proyecto nuevo**, por ejemplo **POLAROIDS SABER - PANEL PRIVADO**. No edites `POLAROIDS SABER - RECEPCIÓN CLIENTES`.
2. Sustituí su `Code.gs` por este código y agregá un archivo HTML con nombre **`panel`** (Google crea `panel.html`) pegando su contenido.
3. En **Configuración del proyecto → Propiedades de script**, agregá:
   - `PANEL_OWNER_EMAIL`: correo exacto de la cuenta Google que será propietaria del panel.
   - `RECEIPT_FOLDER_ID`: el ID de la carpeta privada **POLAROIDS - LIBRERIA SABER**, el mismo que el receptor tiene en sus propiedades. No pegar el enlace entero.
4. Guardá, autorizá los permisos de Drive exclusivamente en esa cuenta.
5. **Implementar → Nueva implementación → Aplicación web → Ejecutar como: Yo → Quién tiene acceso: Solo yo**. Nunca «Cualquiera» o «Cualquier usuario con cuenta de Google».
6. Abrí el enlace /exec desde el perfil propietario. Deberá listar automáticamente el pedido recibido `POL-664B0B45776E023B08D43F46` como **Pendiente de seña** con 6 fotos, un PDF, total $3.000 y seña $1.500. **No marcar la seña como confirmada salvo que efectivamente esté pagada**.

## Comportamiento

- Verifica referencia `POL-` con 24 caracteres, seis originales/recortes por hoja excepto la última (entre una y 60 fotos), `encuadres.json` coherente y PDF(s) A4 esperados.
- Antes de la seña no entrega ninguna URL de PDF al navegador del panel. Después de pulsar **Confirmar seña** y confirmar el pago real, habilita los enlaces de PDF privados. **Los PDFs siguen físicamente en Google Drive privado; esto es control de flujo desde el panel, no cifrado ni bloqueo del acceso directo del propietario en Drive**.
- Estados válidos: Pendiente de seña → Seña confirmada → Listo para entregar → Entregado, con las transiciones de reversión o anulación permitidas.
- Precios: ARS $3.000 por hoja A4; seña de ARS $1.500 por hoja A4, sin descuentos automáticos.
- La aprobación de la seña es **manual**; no conecta con bancos ni verifica comprobantes automáticamente.
- Los datos de autorización quedan en las Propiedades del Script y no se publican en GitHub.
- Los estados manuales se guardan en Script Properties del **proyecto privado**; no se modifican archivos del pedido ni la propiedad `PUBLIC_ENABLED` del receptor.
- El panel nunca genera ni cobra pedidos y no altera la web pública.

## Estado de pruebas

Código JavaScript y HTML: sintaxis comprobada. Validación simulada: pedido de 6 y de 17 fotos completos, estados correctos, importes $3.000/$9.000 y señas $1.500/$4.500, PDF oculto antes de pago y visible después; accesos con usuario incorrecto y transiciones ilegales rechazados. **Superado:** instalación y listado real del primer pedido por el propietario, con PDF bloqueado hasta seña. **Pendiente:** validar cambios de estado únicamente tras pago real; completar puesta en producción controlada.

No publicar `main` ni cambios en `libreriasaber.com.ar` sin autorización explícita.
