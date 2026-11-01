/**
 * Decide sólo si es seguro preseleccionar A4. Las medidas originales proceden
 * de CropBox/rotación y se volverán a verificar al recibir el PDF.
 * La clasificación del ploteo y la cotización viven en otros módulos.
 */
export function decidirTamanoCliente(paginas){
 if(!Array.isArray(paginas)||paginas.length<1||
    paginas.some(p=>!Number.isFinite(p?.anchoCm)||!Number.isFinite(p?.altoCm)||
      p.anchoCm<=0||p.altoCm<=0))
  throw Error('Medidas del PDF aún no disponibles.');
 const coincide=(p,a,b,margen=0.2)=>{
  const ancho=Math.min(p.anchoCm,p.altoCm),alto=Math.max(p.anchoCm,p.altoCm);
  return Math.abs(ancho-a)<=margen&&Math.abs(alto-b)<=margen;
 };
 const a4=paginas.every(p=>coincide(p,21,29.7));
 const cuadrado20=paginas.every(p=>coincide(p,20,20));
 const a3=paginas.every(p=>coincide(p,29.7,42));
 const formato=cuadrado20?'a4':a4?'a4':'sin-confirmar';
 return Object.freeze({
  seleccionInicial:formato,
  requierePregunta:formato==='sin-confirmar',
  a4Exacto:a4,
  forzarA4:cuadrado20,
  a3Exacto:a3,
  medidas:paginas.map(p=>[p.anchoCm.toFixed(2),p.altoCm.toFixed(2)].join(' × ')+' cm'),
  variosTamanos:paginas.some(p=>
   Math.abs(p.anchoCm-paginas[0].anchoCm)>0.1||
   Math.abs(p.altoCm-paginas[0].altoCm)>0.1),
 });
}
