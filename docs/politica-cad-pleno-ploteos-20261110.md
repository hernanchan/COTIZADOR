# Política comercial CAD / Pleno — Librería Saber

**Fecha:** 2026-11-10. **Ámbito:** cotización de impresión por plotter sobre papeles ofrecidos por Librería Saber; no prescribe un servicio de vinilo de corte. **No modifica tarifas aprobadas ni habilita pagos.**

## Reglas de decisión (en orden)

1. **Destino por dimensión.** Si el tamaño final seleccionado excede A3, el trabajo pasa a plotter. La longitud de la hoja NO permite distinguir CAD de Pleno, ni el tipo de material de impresión. El rollo se selecciona con las medidas reales y las restricciones de impresión del equipo.
2. **CAD — evidencia estructural clara.** Si una página contiene trazos/contornos vectoriales sin imágenes, rellenos o sombreados impresos (solo operadores de trazado), es **CAD**, sin importar si forman letras, dibujos o planos. El número de líneas, su color, el tamaño y las palabras del archivo no pueden transformar estos contornos en un póster.
3. **PLENO / PÓSTER — evidencia positiva.** Si predominan fotografías, imágenes, áreas de color o rellenos continuos que requieren una cobertura significativa de tinta, es **Pleno**. Ser vectorial NO implica CAD: los objetos vectoriales con rellenos grandes son Pleno.
4. **Documentos rasterizados.** Una imagen incrustada NO basta por sí sola para concluir Pleno: un plano escaneado puede ser CAD. El contenido visual se clasifica por continuidad y cobertura de tinta, preferentemente contrastadas a dos escalas. El análisis de texto técnico es auxiliar, no decisorio.
5. **PDF multipágina.** Clasificar cada página por separado. Si hay ambas clases, **Mixto**: conservar y cotizar sus clases individualmente, no fijar la tarifa de todas por mayoría.
6. **Evidencia insuficiente o contradictoria.** **Revisión**: no inventar clase ni precio final ni autorizar recepción/pago sin un presupuesto verificable. Una regla no debe caer a la clase más barata ni a la más cara por defecto.
7. **Papel y origen del archivo.** El cliente elige únicamente entre los papeles ofrecidos (obra 80 g / recubierto 130 g donde correspondan). Nombres como `vinilo`, `CAD`, `foto`, `poster` o `corte` no modifican servicio, clasificación, material ni precio. Los servicios de corte se presupuestan por su circuito propio.

## Caso patrón — PDF real de 3 metros

`VINILO DE CORTE NEGRO MATE 3 METROS.pdf`, inspeccionado localmente sin subir el original: 1 página, **300,0 × 60,0 cm**, 614.843 bytes, **0 imágenes**, **131 grupos de dibujos vectoriales de trazo**, **14.633 segmentos de dibujo**, **0 rellenos**, **0 texto PDF extraíble** (las letras están como contornos). **Resultado conforme a política: CAD.**

En raster de referencia independiente (PyMuPDF): a 360 px de ancho, cobertura de píxeles no blancos ≈26,74 % y cobertura de superficies continuas 13×13 ≈1,41 %; a 720 px, cobertura ≈16,68 %. Son indicios adicionales, NO reemplazan la prueba estructural ni garantizan idénticos resultados en PDF.js.

## Criterio de aceptación

- Las letras o figuras vectoriales únicamente de contorno se clasifican CAD aunque el trabajo mida 3 metros.
- Fotografías y grandes rellenos siguen como Pleno.
- Si la implementación da Pleno para el caso de 3 metros con estos datos, el resultado es un **falso positivo** según esta política; se corrige la regla general y nunca se incorpora una excepción por nombre de archivo.
- Para dar por validada la interfaz, probar el mismo archivo original en el navegador y verificar la clase final y tarifa D1. La lectura estructural local es evidencia sobre el archivo, no prueba de funcionamiento de la UI.
