import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {clasificarMosaicoGrandePorMuestras} from './clasificar-mosaico-grande-muestreo-local.mjs';

const MIB=1048576,SIZE=55*MIB;
function fakePdf({poster=false}={}){
 const parts=[],offsets=new Map();let position=0;
 const push=b=>{const buf=Buffer.from(b);parts.push({start:position,buf});position+=buf.length};
 const obj=(n,text,stream=null)=>{
  offsets.set(n,position);
  push(n+' 0 obj\n'+text);
  if(stream!==null){push('\nstream\n');push(stream);push('\nendstream')}
  push('\nendobj\n');
 };
 push('%PDF-1.6\n');
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 obj(2,'<< /Type /Pages /Kids [ 3 0 R 4 0 R 5 0 R 6 0 R 7 0 R 8 0 R ] /Count 6 >>');
 for(let i=3;i<=8;i++)obj(i,'<< /Type /Page /Resources '+(i+6)+' 0 R /Parent 2 0 R >>');
 const images=Array.from({length:30},(_,i)=>'/Im'+(i+1)+' '+(20+i)+' 0 R').join('\n');
 for(let i=9;i<=14;i++)obj(i,'<< /XObject << '+images+' >> >>');
 obj(80,'[ /Indexed /DeviceRGB 1 81 0 R ]');
 obj(81,'<< /Length 6 >>',Uint8Array.of(255,255,255,190,60,60));
 for(let i=20;i<50;i++){
  const pixels=Buffer.alloc(720*24);
  for(let y=0;y<24;y++)for(let x=0;x<720;x++)
   pixels[y*720+x]=poster?1:(x%17===0||y%9===0?1:0);
  const content=deflateSync(pixels);
  obj(i,'<< /Subtype /Image /Width 720 /Height 24 /BitsPerComponent 8 '+
   '/ColorSpace 80 0 R /Filter /FlateDecode /Length '+content.length+' >>',content);
 }
 const xrefOffset=SIZE-1600,table=Buffer.alloc(100*7);
 offsets.set(99,xrefOffset);
 for(let i=0;i<100;i++){
  if(!offsets.has(i))continue;
  table[i*7]=1;
  table.writeUInt32BE(offsets.get(i),i*7+1);
 }
 const xdata=deflateSync(table);
 const xref=Buffer.concat([Buffer.from('99 0 obj\n<< /Type /XRef /Size 100 /Root 1 0 R /W [1 4 2] '+
  '/Index [0 100] /Filter /FlateDecode /Length '+xdata.length+
  ' >>\nstream\n'),xdata,Buffer.from('\nendstream\nendobj\nstartxref\n'+xrefOffset+'\n%%EOF\n')]);
 assert.ok(xref.length<1600);
 parts.push({start:xrefOffset,buf:xref});
 const reads=[];
 return {
  name:'Plano de prueba.pdf',size:SIZE,reads,
  slice(start,end){
   reads.push([start,end]);
   const data=Buffer.alloc(end-start);
   for(const part of parts){
    const from=Math.max(start,part.start),to=Math.min(end,part.start+part.buf.length);
    if(to>from)part.buf.copy(data,from-start,from-part.start,to-part.start);
   }
   return {size:data.length,async arrayBuffer(){
    return Uint8Array.from(data).buffer;
   }};
  },
  async arrayBuffer(){throw Error('NO_SE_DEBE_LEER_EL_ARCHIVO_ENTERO')}
 };
}
function canvasFactory(){
  let data=new Uint8ClampedArray(720*216*4);
  const context={
   fillStyle:'#fff',fillRect(){data.fill(255)},
   createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},
   putImageData(image,x,y){data.set(image.data,(y*720+x)*4)},
   getImageData(){return {data}}
  };
  return {width:0,height:0,getContext(){return context}};
}
const paginas=Array.from({length:6},(_,i)=>({
 numero:i+1,anchoCm:i<3?100.01:124.99,altoCm:60.96
}));
test('6 páginas seleccionadas se clasifican CAD con pequeñas muestras, sin render completo',async()=>{
 const file=fakePdf(),events=[],errors=[];
 const result=await clasificarMosaicoGrandePorMuestras(file,{
  paginas,seleccionadas:[1,2,3,4,5,6],
  canvasFactory,onProgreso:p=>events.push(p),onError:e=>errors.push(e)
 });
 assert.ok(result,errors.join('; '));
 assert.equal(result.altaConfianza,true);
 assert.deepEqual(result.paginas.map(p=>p.modo),Array(6).fill('cad'));
 assert.equal(result.metodo,'MUESTREO_RASTER_ESTRUCTURA');
 assert.equal(result.originalSubido,false);
 assert.equal(result.permiteImprimirSinRevisar,false);
 assert.equal(events.length,6);
 assert.ok(result.bytesLeidos<8*MIB);
 assert.ok(file.reads.every(([start,end])=>end-start<=512*1024));
});
test('misma estructura raster con rellenos extensos se identifica Pleno, nunca CAD',async()=>{
 const f=fakePdf({poster:true}),errors=[];
 const result=await clasificarMosaicoGrandePorMuestras(f,{
  paginas,seleccionadas:[1,2,3],canvasFactory,onError:e=>errors.push(e)
 });
 assert.ok(result,errors.join('; '));
 assert.equal(result.altaConfianza,true);
 assert.deepEqual(result.paginas.map(p=>p.modo),['poster','poster','poster']);
});
test('PDF sin evidencia suficiente o selección inconsistente nunca cotiza',async()=>{
 const f=fakePdf();
 assert.equal(await clasificarMosaicoGrandePorMuestras(f,{
  paginas,seleccionadas:[1,7],canvasFactory
 }),null);
 assert.equal(await clasificarMosaicoGrandePorMuestras(f,{
  paginas,seleccionadas:[1,1],canvasFactory
 }),null);
 assert.equal(f.reads.length,0);
});
