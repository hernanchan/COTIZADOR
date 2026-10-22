/**
 * Clasificación preliminar por cobertura de imagen rasterizada, no por el
 * formato interno del PDF. Conservadora: lo dudoso requiere revisión del local.
 * Procesar SIEMPRE en el dispositivo, sin transmitir la imagen al servidor.
 */
export function clasificarCoberturaPloteo(rgba,{paso=1}={}){
 if(!rgba||!Number.isInteger(rgba.length)||rgba.length<4||rgba.length%4!==0)throw Error('Imagen de análisis inválida');
 let total=0,ocupados=0,color=0,oscuros=0;
 for(let i=0;i<rgba.length;i+=4*Math.max(1,paso)){
  const a=rgba[i+3]/255;
  // Fondo blanco del renderer. Alfa 0 se considera vacío.
  const r=255*(1-a)+rgba[i]*a,g=255*(1-a)+rgba[i+1]*a,b=255*(1-a)+rgba[i+2]*a;
  const luminosidad=(r+g+b)/3;
  const diferencia=Math.max(r,g,b)-Math.min(r,g,b);
  total++;
  if(luminosidad<244){
   ocupados++;
   if(diferencia>32)color++;
   if(luminosidad<100)oscuros++;
  }
 }
 if(!total)throw Error('No se pudieron analizar píxeles.');
 const cobertura=ocupados/total,coberturaColor=color/total,coberturaOscura=oscuros/total;
 // Contraste muy alto y fondos poco cubiertos suele ser CAD, incluso escaneado.
 // El umbral conservador deja trabajos fronterizos para el operador.
 let modo='revision';
 if(cobertura>=0.30||coberturaColor>=0.15||
  (cobertura>=0.19&&coberturaColor>=0.06))modo='poster';
 else if(cobertura<=0.10||(cobertura<=0.17&&coberturaColor<=0.025))modo='cad';
 return {modo,cobertura:Math.round(cobertura*1000)/1000,
  coberturaColor:Math.round(coberturaColor*1000)/1000,
  coberturaOscura:Math.round(coberturaOscura*1000)/1000};
}
