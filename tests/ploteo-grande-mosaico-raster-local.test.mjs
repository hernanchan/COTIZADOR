import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {clasificarMosaicoRasterPDFGrande}
 from '../integraciones/autocotizador/recepcion/clasificar-ploteo-grande-raster-local.mjs';
const txt=t=>new TextEncoder().encode(t);
const MIB=1048576;
function pdfVirtual({imagenes=16,texto=false,paginaUnica=true,xref=true,maquetaParroquia=false}={}){
 const virtual=72*MIB,segments=[],offsets={};
 function add(offset,bytes){segments.push({offset,bytes:bytes instanceof Uint8Array?bytes:txt(bytes)})}
 add(0,'%PDF-1.6\n%test\n');
 function obj(n,at,head,data=null){
  offsets[n]=at;
  const prefix=txt(n+' 0 obj\r'+head+(data===null?'\rendobj\r':'stream\r\n'));
  add(at,prefix);
  if(data!==null){add(at+prefix.length,data);add(at+prefix.length+data.length,'\r\nendstream\rendobj\r')}
 }
 obj(1,200,'<</Type/Catalog/Pages 2 0 R>>');
 obj(2,400,'<</Type/Pages/Count '+(paginaUnica?1:2)+'/Kids[3 0 R]>>');
 const resources=Array.from({length:imagenes},(_,i)=>'/Im'+i+' '+(i+5)+' 0 R').join('');
 obj(3,600,'<</Type/Page/Parent 2 0 R/MediaBox[0 0 '+(maquetaParroquia?'1987.09 1474.02':'1000 1000')+']/Contents 4 0 R/Resources<</XObject<<'+resources+'>>>>>>');
 const statements=['q'];
 for(let i=0;i<imagenes;i++){
  const x=maquetaParroquia?37+(i%8)*241:(i%4)*250;
  const y=maquetaParroquia?7+Math.floor(i/8)*184.25:Math.floor(i/4)*250;
  const matrix=maquetaParroquia?'229.44 0 0 170.16':'240 0 0 240';
  statements.push('q\n'+matrix+' '+x+' '+y+' cm\n/Im'+i+' Do\nQ');
 }
 if(texto)statements.push('BT\n/F1 12 Tf\n(Test) Tj\nET');
 statements.push('Q');
 const compressed=deflateSync(txt(statements.join('\n')));
 obj(4,30000,'<</Filter/FlateDecode/Length '+compressed.length+'>>',compressed);
 for(let i=0;i<imagenes;i++){
  obj(i+5,2*MIB+i*8192,
   '<</Subtype/Image/Width 956/Height 709/Filter/FlateDecode/Length 762085>>');
 }
 if(xref){
  const xrefAt=virtual-15000;
  const count=imagenes+5;
  let table='xref\r\n0 '+count+'\r\n0000000000 65535 f\r\n';
  for(let i=1;i<count;i++)
   table+=String(offsets[i]).padStart(10,'0')+' 00000 n\r\n';
  table+='trailer\r\n<</Size '+count+'/Root 1 0 R>>\r\nstartxref\r\n'+xrefAt+'\r\n%%EOF\r\n';
  add(xrefAt,table);
 }
 const file={size:virtual,name:maquetaParroquia?'QR PARROQUIA- VINILO BLANCO + MEDIO CORTE- 50X70CM- 1 COPIA.pdf':'plano_72MiB.pdf',readBytes:0,maxSlice:0,
  slice(start,end){
   const len=end-start;
   assert.ok(start>=0&&end<=virtual&&len>0);
   this.readBytes+=len;this.maxSlice=Math.max(this.maxSlice,len);
   return {size:len,async arrayBuffer(){
    const out=new Uint8Array(len);
    for(const s of segments){
     const lo=Math.max(start,s.offset),hi=Math.min(end,s.offset+s.bytes.length);
     if(lo<hi)out.set(s.bytes.subarray(lo-s.offset,hi-s.offset),lo-start);
    }
    return out.buffer;
   }};
  }
 };
 return file;
}
test('72 MiB, una página de 16 imágenes raster: PLENO sin leer el PDF completo',async()=>{
 const file=pdfVirtual();
 const d=await clasificarMosaicoRasterPDFGrande(file);
 assert.equal(d?.modo,'poster',JSON.stringify(d));
 assert.equal(d.altaConfianza,true);
 assert.ok(d.coverage>0.65);
 assert.equal(d.imagenesDistintas,16);
 assert.ok(file.readBytes<512*1024,'No leer 72 MiB');
 assert.ok(file.maxSlice<=200000);
 assert.equal(d.originalSubido,false);
 assert.equal(d.permiteImprimirSinRevisar,false);
});
test('no clasifica como pleno a partir de pocas imágenes, texto o varias páginas',async()=>{
 assert.equal(await clasificarMosaicoRasterPDFGrande(pdfVirtual({imagenes:3})),null);
 assert.equal(await clasificarMosaicoRasterPDFGrande(pdfVirtual({texto:true})),null);
 assert.equal(await clasificarMosaicoRasterPDFGrande(pdfVirtual({paginaUnica:false})),null);
});
test('xref desconocido y archivos fuera de rango -> sin clasificación automática',async()=>{
 assert.equal(await clasificarMosaicoRasterPDFGrande(pdfVirtual({xref:false})),null);
 assert.equal(await clasificarMosaicoRasterPDFGrande({
  size:39*MIB,name:'pequeno.pdf',slice(){throw Error('No leer')}
 }),null);
 assert.equal(await clasificarMosaicoRasterPDFGrande({
  size:201*MIB,name:'gigante.pdf',slice(){throw Error('No leer')}
 }),null);
});

test('plancha grande como el archivo de parroquia: 64 imagenes 8x8, dimensiones 70.1 x 52 cm, sin inferir vinilo del nombre',async()=>{
 const file=pdfVirtual({imagenes:64,maquetaParroquia:true});
 const result=await clasificarMosaicoRasterPDFGrande(file);
 assert.equal(result?.modo,'poster',JSON.stringify(result));
 assert.equal(result.altaConfianza,true);
 assert.equal(result.imagenesPintadas,64);
 assert.equal(result.imagenesDistintas,64);
 assert.ok(result.coverage>=0.75,'La plancha cubre al menos el 75%');
 assert.ok(file.readBytes<512*1024);
 assert.equal(result.originalSubido,false);
 assert.equal(result.permiteImprimirSinRevisar,false);
 assert.equal(Object.hasOwn(result,'papelPoster'),false,'El clasificador no elige material ni vinilo');
});
