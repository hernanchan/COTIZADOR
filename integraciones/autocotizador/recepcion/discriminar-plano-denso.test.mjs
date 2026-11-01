import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 evidenciaPlanoTecnico,esCadVectorialDenso,esCadPorEstructuraPDF,ameritaVerificarEstructura
} from './discriminar-plano-denso.mjs';

// Mediciones de preflight local del plano real ya facilitado por el
// usuario (SUM/cocheras 97,01 x 61,49 cm), SIN incluir su PDF en GitHub.
// 360px: ocupación 0,5054, color 0,4771.
// 720px: ocupación 0,3486. La textura roja de líneas se fusiona a baja resolución.
const plano='Planta Baja SUM ESC.1.100 Fachada Sur SUM Corte A-A SUM PLANIMETRIA MODIFICACION DE PROYECTO';
test('plano municipal rojo con líneas densas conserva CAD, no se confunde con Póster',()=>{
 assert.equal(evidenciaPlanoTecnico(plano),true);
 assert.equal(esCadVectorialDenso({texto:plano,
  miniatura:{modo:'poster',cobertura:0.5054,coberturaColor:0.4771,plenoContinuo:0.2312},
  detalle:{modo:'poster',cobertura:0.3486,coberturaColor:0.3134}
 }),true);
});
test('póster de color sólido no se transforma en CAD, aunque lleve un rótulo técnico',()=>{
 assert.equal(esCadVectorialDenso({texto:plano,
  miniatura:{modo:'poster',cobertura:0.6,coberturaColor:0.4},
  detalle:{modo:'poster',cobertura:0.59}
 }),false);
});
test('página de arte con mucho texto genérico nunca activa la corrección técnica',()=>{
 for(const texto of ['PROMOCIÓN GRAN OFERTA 50% DESCUENTO',
  'FOTOGRAFÍA A COLOR ESCALA REAL 1:1',
  'FOLLETO CON PROYECTO NUEVO',
  'COBERTURA COMPLETA DE ESTACIONAMIENTOS']){
  assert.equal(evidenciaPlanoTecnico(texto),false,texto);
  assert.equal(esCadVectorialDenso({texto,
   miniatura:{modo:'poster',cobertura:0.55,coberturaColor:0.4},
   detalle:{modo:'poster',cobertura:0.22}
  }),false,texto);
 }
});
test('clasificador no interviene ante diferencia marginal o falta de color',()=>{
 const base={texto:plano,miniatura:{modo:'poster',cobertura:0.5,coberturaColor:0.45}};
 for(const cobertura of [0.5,0.49,0.46,0.40,0.36]){
  const expected=cobertura===0.36;
  assert.equal(esCadVectorialDenso({...base,detalle:{modo:'poster',cobertura}}),
   expected,'cobertura '+cobertura);
 }
 assert.equal(esCadVectorialDenso({
  ...base,miniatura:{...base.miniatura,coberturaColor:0.03},
  detalle:{modo:'poster',cobertura:0.2}
 }),false);
 assert.equal(esCadVectorialDenso({
  ...base,miniatura:{...base.miniatura,modo:'cad'},
  detalle:{modo:'poster',cobertura:0.2}
 }),false);
});
test('se ejecuta el segundo raster SOLO para Póster con evidencia textual técnica',()=>{
 const code=readFileSync(
  new URL('./clasificar-paginas-ploteo.mjs',import.meta.url),'utf8');
 assert.match(code,/ameritaVerificarEstructura\(\{miniatura:clasificacion,texto,textos\}\)/);
 assert.match(code,/esCadPorEstructuraPDF\(\{miniatura:clasificacion/);
 assert.match(code,/scale:720\/Math\.max\(v\.width,v\.height\)/);
 assert.match(code,/esCadVectorialDenso\(/);
 assert.match(code,/cAlta\.width=0;cAlta\.height=0/);
});


test('estructura PDF: 15.000 trazados sin imágenes certifican trama CAD incluso sin texto extraíble',()=>{
 const OPS={constructPath:4,paintImageXObject:8,paintInlineImageXObject:9,shadingFill:10};
 const miniatura={modo:'poster',cobertura:0.53,coberturaColor:0.48,plenoContinuo:0.23};
 assert.equal(ameritaVerificarEstructura({miniatura,texto:'',textos:0}),true);
 const paths=Array(15000).fill(OPS.constructPath);
 assert.equal(esCadPorEstructuraPDF({miniatura,fnArray:paths,OPS,texto:''}),true);
 assert.equal(esCadPorEstructuraPDF({miniatura,fnArray:[...paths,OPS.paintImageXObject],OPS,texto:plano}),false,
  'Una sola imagen impide convertir arbitrariamente un póster en CAD');
 assert.equal(esCadPorEstructuraPDF({miniatura,fnArray:[...paths,OPS.shadingFill],OPS,texto:plano}),false);
 assert.equal(esCadPorEstructuraPDF({miniatura,fnArray:Array(999).fill(OPS.constructPath),OPS,texto:plano}),false);
 assert.equal(esCadPorEstructuraPDF({
  miniatura:{...miniatura,plenoContinuo:0.95},fnArray:paths,OPS,texto:plano
 }),false);
});
test('función real del navegador: línea roja muy densa → CAD; póster raster → Póster',async()=>{
 const {clasificarPaginasPloteo}=await import('./clasificar-paginas-ploteo.mjs');
 const previousPdf=globalThis.pdfjsLib,previousDoc=globalThis.document;
 const OPS={constructPath:4,paintImageXObject:8,paintInlineImageXObject:9,shadingFill:10};
 async function ejecutar({imagen=false,texto=''}={}){
  let renders=0,operadores=0;
  const page={
   getViewport({scale}){return {width:1000*scale,height:640*scale}},
   async getTextContent(){return {items:texto?[{str:texto}]:[]}},
   async getOperatorList(){operadores++;return {fnArray:imagen?
    [...Array(15000).fill(OPS.constructPath),OPS.paintImageXObject]:
    Array(15000).fill(OPS.constructPath)}},
   render(){renders++;return {promise:Promise.resolve()}},
   cleanup(){}
  };
  globalThis.pdfjsLib={OPS,GlobalWorkerOptions:{},getDocument(){
   return {promise:Promise.resolve({numPages:1,getPage:async()=>page,destroy:async()=>{}}),
    destroy:async()=>{}};
  }};
  globalThis.document={createElement(type){
   assert.equal(type,'canvas');
   const canvas={width:0,height:0};
   canvas.getContext=()=>({
    fillRect(){},fillStyle:'#fff',
    getImageData(){
     const data=new Uint8ClampedArray(canvas.width*canvas.height*4);
     for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const k=(y*canvas.width+x)*4;
      const red=(x%4)<2;
      data[k]=red?170:255;data[k+1]=red?15:255;data[k+2]=red?15:255;data[k+3]=255;
     }
     return {data};
    }
   });
   return canvas;
  }};
  const resultado=await clasificarPaginasPloteo({arrayBuffer:async()=>new Uint8Array([37,80,68,70,45]).buffer});
  return {resultado,renders,operadores};
 }
 try{
  const cad=await ejecutar();
  assert.equal(cad.resultado[0].modo,'cad');
  assert.equal(cad.resultado[0].regla,'cad_vectorial_sin_imagenes');
  assert.equal(cad.renders,1,'No renderizar a 720 px si la estructura ya confirma CAD');
  assert.equal(cad.operadores,1);
  const poster=await ejecutar({imagen:true});
  assert.equal(poster.resultado[0].modo,'poster');
  assert.equal(poster.operadores,1);
 }finally{
  globalThis.pdfjsLib=previousPdf;
  globalThis.document=previousDoc;
 }
});
test('UI del pedido hace explícito CAD/Póster sin abrir opciones',()=>{
 const code=readFileSync(new URL('./carga-unica-cliente.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('./carga-unica-pagina.mjs',import.meta.url),'utf8');
 assert.match(code,/TIPO DETECTADO: /);
 assert.match(code,/CAD · Plano técnico/);
 assert.match(code,/PÓSTER \/ PLENO/);
 assert.match(css,/\.clasificacion-ploteo-visible/);
});
