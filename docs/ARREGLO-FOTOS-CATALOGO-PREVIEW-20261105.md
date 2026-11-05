# 05/11/2026 — Fix imágenes de catálogo en preview V3

El cliente informó «salen los productos pero no levanta las fotos» en la vista sin contraseña.
La política CSP solo habilitaba `drive.google.com`, mientras que las miniaturas de Google Drive se sirven a menudo después de una redirección hacia `*.googleusercontent.com`. Se añadió **únicamente el origen de imagen de Google**, manteniendo `connect-src 'none'`, carritos y pedidos deshabilitados y cotizador privado protegido.

El workflow de despliegue incluye ahora chequeo previo externo de los 4 enlaces públicos reales de la planilla `Productos web (MODELO)`: HTTP 200, `image/*`, tamaño no trivial, además de las pruebas de seguridad y rollback existentes. Si cualquiera de esas fotos no se puede cargar externamente, no se despliega.

Cambio aislado al Worker de documentos de prueba. `main`, web pública, pagos, D1 y Central sin cambios.

## Cierre de pruebas y despliegue
- Corrido CI de integración privada **42101767320**, resultado `success`.
- Despliegue controlado y rollback condicionado **42101853897**, resultado `success`.
- Versión del Worker documental en pruebas `07883ebf-7f8b-46af-9aac-056b6ca6fec3`.
- Los cuatro recursos mostraron HTTP 200, MIME `image/jpeg` o `image/png`, destino **`lh3.googleusercontent.com`**. Por tanto la causa era el origen de respuesta bloqueado por la CSP anterior.
- Verificado `OPEN_VISUAL_ONLY_HTTP_200_NO_AUTH_NO_PAYMENT_PRIVATE_COTIZADOR_401`, bindings sin cambios.
- No tocó `main`, portal público, Central, D1 ni pagos.
- URL de revisión: https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/diseno-sin-clave
