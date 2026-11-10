# Política comercial CAD / Pleno — Librería Saber

**Fecha:** 2026-11-10. **Ámbito:** cotización de impresión por plotter sobre papeles ofrecidos por Librería Saber; no prescribe un servicio de vinilo de corte. **No modifica tarifas aprobadas ni habilita pagos.**

## Regla superior: dimensiones físicas ≠ peso del PDF ≠ clasificación CAD/Pleno

Esta política se aplica **a todos los PDF y a todos los modos de recepción**. Nunca usar el tamaño en bytes del archivo para decidir impresora, plotter, clasificación CAD/Pleno, papel, rollo o tarifa.

1. **Salida y precio:** calcular según medidas reales de **cada página** (MediaBox/CropBox visible, rotación y escala PDF) y tamaño final seleccionado por el comprador. Si cabe en los formatos documentales aprobados (A4/A3, incluidos A5 cuando corresponde), corresponde **impresión documental**. Si supera A3 y no se reduce expresamente, corresponde **plotter**. Para plotter, clasificar contenido CAD/Pleno y aplicar los papeles y rollos disponibles.
2. **Transporte:** en una decisión distinta, aplicar exclusivamente **bytes del original por PDF**: hasta **40 MiB inclusive, TUS**; mayor a **40 MiB y hasta 200 MiB, R2** (tope vigente de interfaz). R2 exige pago confirmado **antes** de cargar el original. El umbral es de recepción, no de clasificación ni cotización.
3. **Equivalencia:** idéntico PDF en contenido, medidas, selección y opciones debe conservar el **mismo servicio, destino y precio**, se reciba por TUS o R2. Solo cambia cómo se transfiere y almacena tras la autorización. El mismo criterio CAD/Pleno se aplica a PDF pequeños y grandes; las limitaciones de análisis deben producir **revisión explícita**, jamás reclasificar como CAD o Pleno por peso.
4. **Multipágina:** decidir y cotizar página por página conforme a las medidas y opciones aplicables; el peso total del archivo no convierte 500 páginas A4 en un ploteo.

| Caso ilustrativo | Salida comercial | Transporte |
|---|---|---|
| Apunte de 500 páginas A4, 100 MiB | Impresión documental A4 | R2, solo postpago |
| Panel A0, 2 MiB | Plotter; CAD/Pleno depende del contenido | TUS |
| Plano A1, 150 MiB | Plotter; CAD/Pleno depende del contenido | R2, solo postpago |
| Apunte A4, 5 MiB | Impresión documental A4 | TUS |

**Situación del código al 10/11/2026:** `seleccionar-transporte-pdf.mjs` y `plan-recepcion-universal-r2.mjs` separan correctamente estas decisiones. Sin embargo, la **ruta antigua de recepción grande** en `carga-unica-cliente.mjs` solo acepta ploteo individual R2 si no está habilitado el flujo universal; `flujo-universal-pdf-cliente.mjs` sí transporta PDF grandes con independencia de A4/A3/CAD/Pleno, pero está sujeto a compuertas sandbox. No confundir regla aprobada y módulo compilado con disponibilidad comercial de A4 grande en producción. No habilitar pagos reales hasta validar ese flujo.

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
