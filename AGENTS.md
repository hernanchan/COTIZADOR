# Instrucciones de trabajo — Librería Saber

## Repositorio y publicación

- Este repositorio (`hernanchan/COTIZADOR`) es la fuente oficial del cotizador publicado.
- El cotizador que carga `libreriasaber.com.ar/cotizar` proviene de `cotizador-web-v2.html` mediante GitHub Pages.
- Para leer o publicar cambios, usar primero la conexión instalada de GitHub/Codex para `hernanchan/COTIZADOR`.
- No intentar iniciar sesión en GitHub mediante usuario y contraseña, ni pedirle a Hernán que suba archivos manualmente, mientras la conexión de GitHub esté disponible.
- Antes de reemplazar un archivo, obtener su contenido y SHA actuales con la conexión de GitHub. Luego actualizar únicamente el archivo necesario en `main`, con un mensaje de commit descriptivo.
- No sobrescribir otros cambios recientes del repositorio. Comparar siempre con la versión actual antes de publicar.

## Verificación obligatoria

Después de publicar una modificación del cotizador:

1. Confirmar que GitHub devolvió el SHA del nuevo commit.
2. Abrir la versión publicada en `https://hernanchan.github.io/COTIZADOR/` con un parámetro de caché.
3. Verificar también el recorrido real en `https://libreriasaber.com.ar/cotizar`, incluido el contenido del iframe.
4. Informar como publicado solo cuando la versión real muestre el cambio.

## Promociones diarias

- Las promociones se determinan automáticamente mediante `scheduledPromo()`.
- El beneficio del día debe mostrarse desde la pantalla inicial del cotizador, aunque el visitante llegue directamente desde WhatsApp.
- Cuando la promoción se aplique, el presupuesto debe mostrar el beneficio, el precio anterior, el descuento y el total correspondiente.
