/**
 * Clasificación experimental CAD/Póster por cobertura y estructura espacial.
 * Los planos complejos con líneas rojas no son plenos, incluso si muchos píxeles
 * son de color. La cobertura sola no alcanza para identificar fotos o rellenos.
 * El análisis se realiza localmente, no transmite páginas ni imágenes.
 */
export function clasificarCoberturaPloteo(rgba,{ancho,alto,paso=1}={}){
 if(!rgba||!Number.isInteger(rgba.length)||rgba.length<4||rgba.length%4!==0)
  throw Error('Imagen de análisis inválida');
 const muestreo=Math.max(1,Math.floor(paso));
 // La decisión espacial requiere la geometría real de la miniatura.
 const espacial=Number.isSafeInteger(ancho)&&Number.isSafeInteger(alto)&&ancho>0&&alto>0&&
  ancho*alto*4===rgba.length&&muestreo===1;
 const mascara=espacial?new Uint8Array(ancho*alto):null;
 let total=0,ocupados=0,color=0,oscuros=0;
 for(let i=0;i<rgba.length;i+=4*muestreo){
  const a=rgba[i+3]/255;
  const r=255*(1-a)+rgba[i]*a,g=255*(1-a)+rgba[i+1]*a,b=255*(1-a)+rgba[i+2]*a;
  const luminosidad=(r+g+b)/3;
  const diferencia=Math.max(r,g,b)-Math.min(r,g,b);
  const ocupado=luminosidad<244;
  total++;
  if(ocupado){
   ocupados++;
   if(diferencia>32)color++;
   if(luminosidad<100)oscuros++;
  }
  if(mascara)mascara[i/4]=ocupado?1:0;
 }
 if(!total)throw Error('No se pudieron analizar píxeles.');
 const cobertura=ocupados/total,coberturaColor=color/total,coberturaOscura=oscuros/total;
 let plenoContinuo=null;
 if(mascara&&ancho>=26&&alto>=26){
  // Ventanas 13×13: una línea fina no rellena una ventana, un pleno sí.
  // Imagen integral para O(ancho × alto), sin recorrer 169 píxeles por ventana.
  const stride=ancho+1,integral=new Uint32Array(stride*(alto+1));
  for(let y=1;y<=alto;y++){
   let fila=0;
   for(let x=1;x<=ancho;x++){
    fila+=mascara[(y-1)*ancho+x-1];
    integral[y*stride+x]=integral[(y-1)*stride+x]+fila;
   }
  }
  let llenos=0;
  for(let y=6;y<alto-6;y++){
   for(let x=6;x<ancho-6;x++){
    const x0=x-6,x1=x+7,y0=y-6,y1=y+7;
    const n=integral[y1*stride+x1]-integral[y0*stride+x1]-
      integral[y1*stride+x0]+integral[y0*stride+x0];
    if(n>=136)llenos++; // 80,5% de una ventana de 169 píxeles
   }
  }
  plenoContinuo=llenos/total;
 }
 let modo='revision';
 // Distinguir líneas agrupadas de áreas sólidas, también si son rojas.
 if(cobertura<0.002)modo='revision';
 else if(plenoContinuo!==null&&cobertura<=0.28&&plenoContinuo<=0.022&&
   plenoContinuo/Math.max(cobertura,0.001)<=0.12)modo='cad';
 else if(cobertura>=0.30||coberturaColor>=0.15||
   (cobertura>=0.19&&coberturaColor>=0.06))modo='poster';
 else if(cobertura<=0.10||(cobertura<=0.17&&coberturaColor<=0.025))modo='cad';
 return {modo,cobertura:Math.round(cobertura*1000)/1000,
  coberturaColor:Math.round(coberturaColor*1000)/1000,
  coberturaOscura:Math.round(coberturaOscura*1000)/1000,
  plenoContinuo:plenoContinuo===null?null:Math.round(plenoContinuo*10000)/10000};
}
