# Benchmark funcional: MrByn vs. Librería Saber — 21/10/2026

**Origen observado:** https://mrbyn.com.ar/producto/impresiones/ y https://mrbyn.com.ar/ (páginas públicas).
**Prueba del titular:** seleccionó 10 archivos juntos y obtuvo un precio en aproximadamente 10 segundos. Dato observado por el usuario; NO se repitió ni instrumentó aquí, no conocemos MB totales ni páginas.
**No copiar código, textos o interfaz ajenos**: implementar funcionalidad equivalente con código original, precios SABER y flujo propio.

## Hechos comprobables vs. hipótesis
- Formulario público de MrByn: campos "Archivo 1" a "Archivo 17", cada uno con mensaje "tamaño máx. de archivo 250 MB". Esto NO demuestra que acepte realmente 17×250 MB en una operación, ni el tiempo de transferirlos.
- Selecciones públicas: tipo de tinta, tamaño, caras, copias, orientación, impresiones por cara, acabados, encuadernación y portadas, con botón añadir al carrito y tabla de precios por volumen.
- **No tenemos evidencia de su algoritmo** para contar páginas, cuándo sube los archivos, arquitectura o validación; no atribuirle tecnologías concretas.
- Nuestra prueba real anterior: 2 PDF pequeños tardaron mucho; ping separado Cloudflare→Apps Script firmado medido por usuario en 1455 ms (navegador total 1555 ms). Un ping no representa una carga completa.

## Brecha en SABER
- La pantalla actual permite elegir y preparar varios archivos, pero el piloto recibe cada uno en serie con Turnstile, `multiStart`, envío de fragmentos y `multiFinish`; después de recibirlos todos se cotiza desde PDF guardados en Drive y verificados por el servidor.
- El límite 5 sesiones globales de 1 MiB pertenece al **piloto**, no al diseño comercial; no aumentar el cupo ni 1 MiB sin sustituir o robustecer el protocolo y el control de abuso.
- Esperar Google para poder mostrar cualquier importe provoca una sensación de lentitud incluso con 2 páginas.

## Arquitectura propuesta (dos etapas independientes)
### Etapa A: presupuesto preliminar casi inmediato SIN subir a Drive
1. Cliente elige 10 o más PDF en una sola selección/arrastre (sin asumir que existe límite 17).
2. Contar páginas *localmente*, con una librería PDF abierta empaquetada/servida por Librería Saber, sin enviar documentos a terceros. Para PDF protegido, dañado o no legible, declarar "No se pudo leer" y pedir revisión, no inventar páginas.
3. Cliente define B/N o color por documento, A4/A3, simple/doble faz, copias, acabados. Incluir cantidad agregada por tramo para descuento progresivo.
4. Consulta breve al Worker exclusivamente con metadatos declarados para **cotización orientativa**. El Worker aplica las tarifas del servidor y retorna precio marcado **PRELIMINAR / NO APTO PARA COBRO**. No guardar datos sensibles ni emitir recibos privados en esta etapa.
5. La cifra se actualiza al cambiar copias o modalidad sin recontar PDF ni subirlos. Velocidad objetivo de referencia: un lote de 10 PDF típicos con precio preliminar visible en ~10 s en dispositivo y conexión comparables, a medir (p50/p95). No prometer que todos los PDF de 250 MB se procesen en ese tiempo.
### Etapa B: confirmación protegida y pedido
1. Cuando el cliente decide **comprar**, transferir originales a almacenamiento privado; preferir cargas directas controladas/fragmentadas y reanudables, no decenas de viajes secuenciales Google Apps Script.
2. El backend vuelve a comprobar SHA-256, bytes, páginas reales y precio a partir de recibos **verificados por servidor**. Si difiere de la estimación, informar y pedir reconfirmación explícita antes del carrito/WhatsApp/seña.
3. No permitir que páginas/costos del navegador autoricen pagos; usar una sola identidad de pedido y límites por usuario/sesión para evitar abuso.
4. Compatibilidad con móvil, suspensión de pantalla, desconexión y reanudación sin perder el lote.
5. PDF final/documentos privados solamente accesibles a Librería Saber, con políticas de retención y eliminación.

## Orden técnico
1. Prototipo autónomo de cotización preliminar y parser local para 10 PDF SIN consumir cupos Drive.
2. Instrumentar p50/p95 de lectura local y respuesta Worker, tamaño de archivo, número de páginas y errores; comparar con prueba del titular.
3. Migrar carga pesada al canal escalable con cuotas y seguridad; medir velocidad, reintentos, integridad.
4. Validar tarifas comerciales, checkout, WhatsApp y aprobación antes de producción.

## No hacer
- No subir 10 PDF al piloto de 5 sesiones ni eliminar a ciegas los límites.
- No copiar scripts, CSS, diseños, textos o código de MrByn ni asumir detalles internos por el aspecto de la web.
- No presentar un presupuesto del navegador como confirmado o cobrable.
- No desplegar en `main` ni en la web pública; no tocar Polaroids, Apps Script activo o pagos.
