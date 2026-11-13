import test from 'node:test';
import assert from 'node:assert/strict';
import {clasificarPloteoGrandePorRangos}
 from './clasificar-ploteo-grande-por-rangos.mjs';

const MIB=1048576;
const paginas=Array.from({length:9},(_,i)=>({
 numero:i+1,anchoCm:i<4?100.013:i===4?120.015:i<8?124.989:129.999,
 altoCm:i===4?60.008:i===8?59.408:60.96
}));
function archivo(bytes=60*MIB){
 const reads=[];
 return {
  name:'Plano técnico de prueba.pdf',size:bytes,reads,
  slice(from,to){
   reads.push([from,to]);
   return {size:to-from,async arrayBuffer(){
    const v=new Uint8Array(to-from);
    if(from===0)v.set(new TextEncoder().encode('%PDF-1.6'));
    return v.buffer;
   }};
  },
  async arrayBuffer(){throw Error('JAMAS_CARGAR_PDF_ENTERO')}
 };
}
function canvasFactory(type){
 return ()=>{
  const canvas={
   width:0,height:0,getContext(){
    return {fillStyle:'#fff',fillRect(){},
     getImageData(){
      const {width:w,height:h}=canvas;
      const data=new Uint8ClampedArray(w*h*4);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
       const at=4*(y*w+x);
       const ink=type==='poster'?true:(x%18===0||y%8===0);
       data[at]=ink?215:255;
       data[at+1]=ink?75:255;
       data[at+2]=ink?75:255;
       data[at+3]=255;
      }
      return {data};
     }
    };
   }
  };
  return canvas;
 };
}
function pdfjsMock(pageCount=9){
 let renders=0;
 const lib={
  PDFDataRangeTransport:class{constructor(total,initial){this.total=total;this.initial=initial}onDataRange(){}},
  GlobalWorkerOptions:{workerSrc:''},
  getDocument({range,disableAutoFetch,disableStream}){
   assert.ok(range);
   assert.equal(disableAutoFetch,true);
   assert.equal(disableStream,true);
   const doc={numPages:pageCount,
    async getPage(n){
     return {getViewport({scale}){return {width:2835*scale,height:1728*scale}},
      render(){renders++;return {promise:Promise.resolve()}},
      cleanup(){}};
    },
    async destroy(){}
   };
   return {promise:Promise.resolve(doc),async destroy(){}};
  }
 };
 return {lib,get renders(){return renders}};
}
test('PDF de 60 MiB y nueve páginas técnicas raster se clasifica CAD sin leer entero',async()=>{
 const f=archivo(),mock=pdfjsMock(),seen=[];
 const result=await clasificarPloteoGrandePorRangos(f,{
  paginas,pdfjs:mock.lib,createCanvas:canvasFactory('cad'),onProgreso:p=>seen.push(p)
 });
 assert.equal(result.altaConfianza,true);
 assert.equal(result.metodo,'VISUAL_PDFJS_RANGOS');
 assert.equal(result.originalSubido,false);
 assert.equal(result.permiteImprimirSinRevisar,false);
 assert.equal(result.paginas.length,9);
 assert.ok(result.paginas.every(p=>p.modo==='cad'));
 assert.equal(result.bytesLeidos,65536);
 assert.equal(f.reads.length,1);
 assert.equal(mock.renders,9);
 assert.equal(seen.length,9);
});
test('raster con gran área sólida permanece Pleno, no CAD por tamaño ni nombre',async()=>{
 const f=archivo(),mock=pdfjsMock();
 const result=await clasificarPloteoGrandePorRangos(f,{
  paginas,pdfjs:mock.lib,createCanvas:canvasFactory('poster')
 });
 assert.equal(result.paginas.length,9);
 assert.ok(result.paginas.every(p=>p.modo==='poster'));
});
test('si lectura falla o excede 12 páginas no inventa clasificación',async()=>{
 const f=archivo();
 const many=Array.from({length:13},(_,i)=>({...paginas[0],numero:i+1}));
 assert.equal(await clasificarPloteoGrandePorRangos(f,{
  paginas:many,pdfjs:pdfjsMock(13).lib,createCanvas:canvasFactory('cad')
 }),null);
 const broken=pdfjsMock();
 broken.lib.getDocument=()=>({promise:Promise.reject(Error('PDF corrupto')),
  async destroy(){}});
 assert.equal(await clasificarPloteoGrandePorRangos(f,{
  paginas,pdfjs:broken.lib,createCanvas:canvasFactory('cad')
 }),null);
});

test('nueve páginas originales pero sólo 1-3 solicitadas: renderiza exactamente tres',async()=>{
 const f=archivo(),mock=pdfjsMock(),progress=[];
 const result=await clasificarPloteoGrandePorRangos(f,{
  paginas,seleccionadas:[1,2,3],pdfjs:mock.lib,
  createCanvas:canvasFactory('cad'),onProgreso:p=>progress.push(p)
 });
 assert.equal(result.altaConfianza,true);
 assert.deepEqual(result.paginas.map(p=>p.numero),[1,2,3]);
 assert.equal(mock.renders,3,'No procesar las seis páginas no solicitadas');
 assert.equal(f.reads.length,1);
 assert.equal(result.originalSubido,false);
 assert.deepEqual(progress.map(p=>[p.terminadas,p.total,p.numeroPagina]),
  [[1,3,1],[2,3,2],[3,3,3]]);
});
test('rechazar selección fuera de rango, repetida o vacía sin subir original',async()=>{
 const f=archivo(),mock=pdfjsMock();
 for(const seleccionadas of [[],[1,1],[0,1],[1,10],[1,'2']]){
  assert.equal(await clasificarPloteoGrandePorRangos(f,{
   paginas,seleccionadas,pdfjs:mock.lib,createCanvas:canvasFactory('cad')
  }),null);
 }
 assert.equal(mock.renders,0);
 assert.equal(f.reads.length,0);
});
