import test from 'node:test';
import assert from 'node:assert/strict';
import {esCadPorContornosVectoriales,ameritaVerificarEstructura}
 from '../integraciones/autocotizador/recepcion/discriminar-plano-denso.mjs';
import {clasificarPaginasPloteo}
 from '../integraciones/autocotizador/recepcion/clasificar-paginas-ploteo.mjs';

// Solo trazos sin relleno ni fotos: regla GENERAL para tipografías contorneadas.
const OPS={
 constructPath:1,stroke:2,closeStroke:3,
 fill:4,eoFill:5,fillStroke:6,closeFillStroke:7,
 paintImageXObject:8,paintInlineImageXObject:9,
 shadingFill:10,paintImageMaskXObject:11
};
const strokes=(n=6)=>Array.from({length:n},()=>[OPS.constructPath,OPS.stroke]).flat();
const mini={modo:'poster',cobertura:0.61,coberturaColor:0.56,plenoContinuo:0.005};
test('contornos de letras sobre cualquier formato: CAD aunque miniatura dé póster y no haya rótulo',()=>{
 assert.equal(ameritaVerificarEstructura({miniatura:mini,texto:'',textos:0}),true);
 assert.equal(esCadPorContornosVectoriales({fnArray:strokes(),OPS}),true);
});
test('rellenos, fotos y sombreados NO se clasifican falsamente como CAD',()=>{
 for(const prohibido of [OPS.fill,OPS.eoFill,OPS.fillStroke,
   OPS.closeFillStroke,OPS.paintImageXObject,
   OPS.paintInlineImageXObject,OPS.shadingFill,OPS.paintImageMaskXObject]){
  assert.equal(esCadPorContornosVectoriales({fnArray:[...strokes(),prohibido],OPS}),false);
 }
 assert.equal(esCadPorContornosVectoriales({fnArray:[],OPS}),false);
 assert.equal(esCadPorContornosVectoriales({fnArray:[OPS.constructPath,OPS.stroke],OPS}),false);
});
test('un póster de color realmente pleno no necesita consultar trazos',()=>{
 assert.equal(ameritaVerificarEstructura({miniatura:{...mini,
  plenoContinuo:0.89},texto:'',textos:0}),false);
});
test('integración PDF.js: letras de contorno ancho 300 cm sin texto extraíble se cotizan CAD',async()=>{
 const pdfAntes=globalThis.pdfjsLib,domAntes=globalThis.document;
 async function run({paint=[]}={}){
  let operators=0;
  const page={
   getViewport({scale}){return {width:3000*scale,height:700*scale}},
   async getTextContent(){return {items:[]}},
   async getOperatorList(){operators++;return {fnArray:[...strokes(12),...paint]}},
   render(){return {promise:Promise.resolve()}},
   cleanup(){}
  };
  globalThis.pdfjsLib={OPS,GlobalWorkerOptions:{},getDocument(){
   return {promise:Promise.resolve({numPages:1,getPage:async()=>page,destroy:async()=>{}}),
    destroy:async()=>{}};}};
  globalThis.document={createElement(tag){
   assert.equal(tag,'canvas');
   const canvas={width:0,height:0};
   canvas.getContext=()=>({
    fillRect(){},
    getImageData(){
     const data=new Uint8ClampedArray(canvas.width*canvas.height*4);
     for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const k=(y*canvas.width+x)*4,red=x%3!==0;
      data[k]=red?150:255;data[k+1]=red?10:255;data[k+2]=red?10:255;data[k+3]=255;
     }
     return {data};
    }
   });
   return canvas;
  }};
  const r=await clasificarPaginasPloteo({arrayBuffer:async()=>new Uint8Array([37,80,68,70,45]).buffer});
  return {r,operators};
 }
 try{
  const out=await run();
  assert.equal(out.r[0].modo,'cad');
  assert.equal(out.r[0].regla,'cad_contornos_vectoriales_sin_relleno');
  assert.equal(out.operators,1);
  const poster=await run({paint:[OPS.fill]});
  assert.equal(poster.r[0].modo,'poster');
  const imagen=await run({paint:[OPS.paintImageXObject]});
  assert.equal(imagen.r[0].modo,'poster');
 }finally{globalThis.pdfjsLib=pdfAntes;globalThis.document=domAntes}
});
