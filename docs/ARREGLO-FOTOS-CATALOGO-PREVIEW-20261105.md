# 05/11/2026 — Fix imágenes de catálogo en preview V3

El cliente informó «salen los productos pero no levanta las fotos» en la vista sin contraseña.
La política CSP solo habilitaba `drive.google.com`, mientras que las miniaturas de Google Drive se sirven a menudo después de una redirección hacia `*.googleusercontent.com`. Se añadió **únicamente el origen de imagen de Google**, manteniendo `connect-src 'none'`, carritos y pedidos deshabilitados y cotizador privado protegido.

El workflow de despliegue incluye ahora chequeo previo externo de los 4 enlaces públicos reales de la planilla `Productos web (MODELO)`: HTTP 200, `image/*`, tamaño no trivial, además de las pruebas de seguridad y rollback existentes. Si cualquiera de esas fotos no se puede cargar externamente, no se despliega.

Cambio aislado al Worker de documentos de prueba. `main`, web pública, pagos, D1 y Central sin cambios.
