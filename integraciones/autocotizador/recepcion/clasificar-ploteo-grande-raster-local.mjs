/**
 * Identificación local conservadora de una plancha raster grande (>40 MiB).
 * Lee únicamente xref, diccionarios y stream de instrucciones de la página:
 * NO lee ni renderiza los bytes de las imágenes, NO sube el PDF.
 *
 * Sólo reconoce PDF con xref clásico, una página, >=12 imágenes diferentes
 * y mosaico no solapado que ocupa >=65% de la hoja. Cualquier duda => null.
 * Es una pista comercial PRELIMINAR, nunca autorización de preprensa.
 */
const MIB=1048576,MIN=40*MIB,MAX=200*MIB;
const MAX_READ=512*1024,MAX_IMAGE_REFS=128,MAX_CONTENT=128*1024;
const DECODER=new TextDecoder();
const numberPattern='[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const RESPONSE=Object.freeze({
 numero:1,modo:'poster',regla:'pleno_mosaico_raster_por_estructura_pdf',
 altaConfianza:true,verificacion:'LOCAL_PRELIMINAR',
 originalSubido:false,permiteImprimirSinRevisar:false
});
function nums(box){
 const m=new RegExp('/'+box+'\\s*\\[\\s*('+numberPattern+')\\s+('+numberPattern+')\\s+('+numberPattern+')\\s+('+numberPattern+')\\s*\\]').exec(this);
 return m?m.slice(1).map(Number):null;
}
function decode(buffer){return DECODER.decode(buffer)}
function tableFromXref(source){
 if(!/^xref(?:\r\n|\r|\n)/.test(source))return null;
 const lines=source.split(/\r\n|\r|\n/);
 const offsets=new Map();let i=1,total=0;
 while(i<lines.length){
  const line=lines[i++].trim();
  if(line==='trailer')break;
  if(!line)continue;
  const section=/^(\d+)\s+(\d+)$/.exec(line);
  if(!section)return null;
  const start=Number(section[1]),count=Number(section[2]);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(count)||
     count<1||count>10000||total+count>10000)return null;
  for(let j=0;j<count;j++){
   const entry=/^(\d{10})\s+(\d{5})\s+([nf])\s*$/.exec(lines[i++]||'');
   if(!entry)return null;
   const off=Number(entry[1]);
   if(entry[3]==='n'&&off>0)offsets.set(start+j,off);
  }
  total+=count;
 }
 const trailer=lines.slice(i).join('\n');
 if(!trailer||/\/(?:Prev|Encrypt|XRefStm)\b/.test(trailer))return null;
 const root=/\/Root\s+(\d+)\s+\d+\s+R\b/.exec(trailer);
 return root?{offsets,root:Number(root[1])}:null;
}
async function inflate(bytes,maxOutput){
 if(typeof DecompressionStream!=='function')return null;
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
 const reader=stream.getReader(),chunks=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>maxOutput)return null;
   chunks.push(value);
  }
  const result=new Uint8Array(size);let at=0;
  for(const chunk of chunks){result.set(chunk,at);at+=chunk.length}
  return decode(result);
 }finally{reader.releaseLock();void reader.cancel().catch(()=>{})}
}
function imageUnionCoverage(content,images,box){
 const [left,bottom,right,top]=box,width=right-left,height=top-bottom;
 if(width<=0||height<=0)return null;
 const paints=[...content.matchAll(/\/([A-Za-z][A-Za-z0-9_]*)\s+Do\b/g)];
 if(paints.length<12||paints.length>600)return null;
 const re=new RegExp('('+numberPattern+')\\s+('+numberPattern+')\\s+('+numberPattern+')\\s+('+numberPattern+')\\s+('+numberPattern+')\\s+('+numberPattern+')\\s+cm\\s*\\/([A-Za-z][A-Za-z0-9_]*)\\s+Do\\b','g');
 const blocks=[],names=new Set();
 for(const m of content.matchAll(re)){
  if(!images.has(m[7]))continue;
  const [a,b,c,d,e,f]=m.slice(1,7).map(Number);
  if(![a,b,c,d,e,f].every(Number.isFinite))return null;
  // Rotated/skewed/raster-nested page: insufficient structural evidence.
  if(Math.abs(b)>0.001||Math.abs(c)>0.001||Math.abs(a)<1||Math.abs(d)<1)return null;
  blocks.push([Math.min(e,e+a),Math.min(f,f+d),Math.max(e,e+a),Math.max(f,f+d)]);
  names.add(m[7]);
 }
 if(blocks.length<12||blocks.length!==paints.length||names.size<12)return null;
 // Grid union prevents counting overlapping images as additional coverage.
 const nx=48,ny=36;let used=0;
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const px=left+(x+.5)*width/nx,py=bottom+(y+.5)*height/ny;
  if(blocks.some(([a,b,c,d])=>px>=a&&px<=c&&py>=b&&py<=d))used++;
 }
 return {coverage:used/(nx*ny),paintedImages:blocks.length,distinctImages:names.size};
}
export async function clasificarMosaicoRasterPDFGrande(file){
 if(!file||typeof file.slice!=='function'||!Number.isSafeInteger(file.size)||
    file.size<=MIN||file.size>MAX||!/\.pdf$/i.test(String(file.name||'')))
  return null;
 let readBytes=0;
 const get=async(offset,length)=>{
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||
     offset<0||length<1||offset+length>file.size||
     readBytes+length>MAX_READ)throw Error('ESTRUCTURA_PDF_FUERA_DE_CUPO');
  readBytes+=length;
  const b=await file.slice(offset,offset+length).arrayBuffer();
  if(b.byteLength!==length)throw Error('ESTRUCTURA_PDF_LECTURA_TRUNCADA');
  return new Uint8Array(b);
 };
 try{
  const tail=decode(await get(file.size-Math.min(file.size,65536),Math.min(file.size,65536)));
  const positions=[...tail.matchAll(/startxref\s+(\d+)\s+%%EOF/g)];
  if(positions.length!==1)return null;
  const offset=Number(positions[0][1]);
  if(!Number.isSafeInteger(offset)||offset<=0||offset>=file.size)return null;
  const xref=decode(await get(offset,Math.min(file.size-offset,200000)));
  const map=tableFromXref(xref);
  if(!map)return null;
  async function obj(n,length=4096){
   const at=map.offsets.get(n);
   if(!Number.isSafeInteger(at)||at<5)return null;
   const text=decode(await get(at,Math.min(length,file.size-at)));
   return new RegExp('^'+n+'\\s+\\d+\\s+obj\\b').test(text)?text:null;
  }
  const root=await obj(map.root);
  const pagesRef=/\/Pages\s+(\d+)\s+\d+\s+R\b/.exec(root||'');
  if(!pagesRef)return null;
  const pages=await obj(Number(pagesRef[1]));
  if(!pages||!/\/Count\s+1(?!\d)/.test(pages))return null;
  const child=/\/Kids\s*\[\s*(\d+)\s+\d+\s+R\b/.exec(pages);
  if(!child)return null;
  const page=await obj(Number(child[1]),16384);
  if(!page||!/\/Type\s*\/Page\b/.test(page)||/\/Font\s*<</.test(page))
   return null;
  const box=nums.call(page,'CropBox')||nums.call(page,'MediaBox');
  if(!box||box.some(x=>!Number.isFinite(x)))return null;
  const contents=/\/Contents\s+(\d+)\s+\d+\s+R\b/.exec(page);
  const resources=/\/XObject\s*<<([\s\S]*?)>>/.exec(page);
  if(!contents||!resources)return null;
  const images=new Map();
  for(const m of resources[1].matchAll(/\/([A-Za-z][A-Za-z0-9_]*)\s+(\d+)\s+\d+\s+R\b/g)){
   if(images.has(m[1])||images.size>=MAX_IMAGE_REFS)return null;
   images.set(m[1],Number(m[2]));
  }
  if(images.size<12)return null;
  const header=await obj(Number(contents[1]),2048);
  const len=/\/Length\s+(\d+)\b/.exec(header||'');
  const start=/stream(?:\r\n|\n|\r)/.exec(header||'');
  if(!start||!len)return null;
  const size=Number(len[1]);
  if(!Number.isSafeInteger(size)||size<10||size>MAX_CONTENT)return null;
  const contentAt=map.offsets.get(Number(contents[1]))+start.index+start[0].length;
  const raw=await get(contentAt,size);
  let decoded;
  if(/\/Filter\s*\/FlateDecode\b/.test(header))
   decoded=await inflate(raw,512*1024);
  else if(!/\/Filter\b/.test(header))decoded=decode(raw);
  else return null;
  if(!decoded||/\bBT\b/.test(decoded))return null;
  const refs=new Set([...decoded.matchAll(/\/([A-Za-z][A-Za-z0-9_]*)\s+Do\b/g)].map(m=>m[1]));
  if(refs.size<12||refs.size>MAX_IMAGE_REFS||[...refs].some(x=>!images.has(x)))
   return null;
  // Verify actual XObject /Subtype Image, not only a name such as /Im0.
  for(const name of refs){
   const o=await obj(images.get(name),768);
   if(!o||!/\/Subtype\s*\/Image\b/.test(o)||
      !/\/Width\s+\d+\b/.test(o)||!/\/Height\s+\d+\b/.test(o))
    return null;
  }
  const sample=imageUnionCoverage(decoded,images,box);
  if(!sample||sample.coverage<0.65)return null;
  return Object.freeze({...RESPONSE,coverage:Math.round(sample.coverage*1000)/1000,
   imagenesPintadas:sample.paintedImages,imagenesDistintas:sample.distinctImages,
   bytesLeidos:readBytes});
 }catch{return null}
}
