/**
 * Muestreo conservador de imágenes raster en tiras de un PDF multipágina
 * grande. No renderiza páginas completas ni sube datos: usa File.slice.
 *
 * Optimización específica para una ESTRUCTURA PDF estándar (xref stream,
 * Pages/Kids y XObject ImN). Jamás reconoce por nombre, bytes, ni medidas.
 * Si no se puede descifrar/corroborar la estructura y la cobertura,
 * devuelve null para aplicar el clasificador habitual o revisión.
 */
const MIB=1048576;
const decoder=new TextDecoder('latin1');
const SAMPLES=Object.freeze([0.14,0.23,0.32,0.41,0.50,0.59,0.68,0.77,0.86]);
const scalar=(text,key)=>Number(new RegExp('/'+key+'\\s+(\\d+)\\b').exec(text)?.[1]);
const reference=(text,key)=>Number(new RegExp('/'+key+'\\s+(\\d+)\\s+\\d+\\s+R\\b').exec(text)?.[1]);
const isPos=n=>Number.isSafeInteger(n)&&n>0;

async function inflate(data,limit=1048576){
 if(typeof DecompressionStream!=='function')throw Error('SIN_INFLATE');
 const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
 const reader=stream.getReader(),out=[];let length=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>limit)throw Error('PDF_DESCOMPRESION_EXCESIVA');
   out.push(value);
  }
 }finally{reader.releaseLock()}
 const merged=new Uint8Array(length);let offset=0;
 for(const b of out){merged.set(b,offset);offset+=b.byteLength}
 return merged;
}
function meta(text,objNumber){
 const head=/^(\d+)\s+\d+\s+obj\b/.exec(text);
 if(objNumber!=null&&Number(head?.[1])!==objNumber)throw Error('PDF_OBJETO_INCONSISTENTE');
 const stream=/\bstream(?:\r\n|\n|\r)/.exec(text);
 return {dict:stream?text.slice(0,stream.index):text,
  streamOffset:stream?stream.index+stream[0].length:null};
}
export async function clasificarMosaicoGrandePorMuestras(file,{
 paginas,seleccionadas,canvasFactory=()=>document.createElement('canvas'),
 imageFactory=globalThis.createImageBitmap,onProgreso=()=>{},onError=()=>{},
 signal=null,maxMs=8000
}={}){
 if(!file||typeof file.slice!=='function'||
    !Number.isSafeInteger(file.size)||file.size<=48*MIB||file.size>200*MIB||
    !/\.pdf$/i.test(file.name||'')||!Array.isArray(paginas)||
    paginas.length<1||paginas.length>12||!Array.isArray(seleccionadas)||
    seleccionadas.length<1||seleccionadas.length>12||
    new Set(seleccionadas).size!==seleccionadas.length||
    seleccionadas.some(n=>!isPos(n)||n>paginas.length)||
    typeof canvasFactory!=='function')return null;
 const started=Date.now(),budget=Math.min(15000,Math.max(2000,Number(maxMs)||8000));
 let readTotal=0,reads=0;
 async function read(start,length){
  if(signal?.aborted||Date.now()-started>budget)throw Error('PDF_MUESTREO_TIMEOUT');
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(length)||
     start<0||length<1||length>512*1024||start+length>file.size||
     ++reads>650||readTotal+length>8*MIB)
   throw Error('PDF_MUESTRA_LIMITE');
  readTotal+=length;
  const value=new Uint8Array(await file.slice(start,start+length).arrayBuffer());
  if(value.length!==length)throw Error('PDF_MUESTRA_RANGO_INCOMPLETO');
  return value;
 }
 try{
  const tail=decoder.decode(await read(file.size-Math.min(4096,file.size),Math.min(4096,file.size)));
  const matches=[...tail.matchAll(/startxref\s+(\d+)\s+%%EOF/g)];
  if(matches.length!==1)return null;
  const offset=Number(matches[0][1]);
  if(!isPos(offset)||offset>=file.size)return null;
  const chunk=decoder.decode(await read(offset,Math.min(2048,file.size-offset)));
  const m=meta(chunk);
  if(!/\/Type\s*\/XRef\b/.test(m.dict)||!/\/Filter\s*\/FlateDecode\b/.test(m.dict)||
     !/\/W\s*\[\s*1\s+4\s+2\s*\]/.test(m.dict))return null;
  const size=scalar(m.dict,'Size'),root=reference(m.dict,'Root'),len=scalar(m.dict,'Length');
  const index=/\/Index\s*\[\s*0\s+(\d+)\s*\]/.exec(m.dict);
  if(!isPos(size)||size>25000||!isPos(root)||!isPos(len)||len>256*1024||
     (index&&Number(index[1])!==size)||m.streamOffset===null)return null;
  const xdata=await inflate(await read(offset+m.streamOffset,len),size*7+32);
  if(xdata.byteLength!==size*7)return null;
  const offsets=new Map();
  const view=new DataView(xdata.buffer,xdata.byteOffset,xdata.byteLength);
  for(let i=0;i<size;i++){
   const at=i*7,type=view.getUint8(at),position=view.getUint32(at+1,false);
   if(type===1&&position>0&&position<file.size)offsets.set(i,position);
  }
  // El tamaño del objeto queda acotado por el siguiente offset, sin leer
  // cientos de imágenes ni copiar el PDF completo al navegador.
  const sorted=[...offsets.values()].sort((a,b)=>a-b);
  function nextOffset(at){
   let lo=0,hi=sorted.length;
   while(lo<hi){const mid=(lo+hi)>>1;if(sorted[mid]<=at)lo=mid+1;else hi=mid}
   return sorted[lo]||file.size;
  }
  async function getObject(n,limit=65536){
   const at=offsets.get(n);
   if(!isPos(at))throw Error('PDF_OBJETO_NO_DIRECTO');
   const size=Math.min(nextOffset(at)-at,limit);
   if(size<12)throw Error('PDF_OBJETO_TRUNCADO');
   const bytes=await read(at,size);
   const str=decoder.decode(bytes);
   const info=meta(str,n);
   return {at,info,bytes};
  }
  async function streamOf(obj,limit=512*1024){
   const {at,info}=obj,len=scalar(info.dict,'Length');
   if(info.streamOffset===null||!isPos(len)||len>limit)throw Error('PDF_STREAM_NO_ADMITIDO');
   return read(at+info.streamOffset,len);
  }
  const catalog=(await getObject(root,2000)).info.dict;
  const pagesRef=reference(catalog,'Pages');
  if(!isPos(pagesRef))return null;
  const tree=(await getObject(pagesRef,30000)).info.dict;
  const children=/\/Kids\s*\[([\s\S]*?)\]/.exec(tree)?.[1]||'';
  const kids=[...children.matchAll(/(\d+)\s+\d+\s+R/g)].map(x=>Number(x[1]));
  if(kids.length!==paginas.length||Number(scalar(tree,'Count'))!==kids.length)return null;
  const results=[];
  for(const pageNo of seleccionadas){
   if(signal?.aborted||Date.now()-started>budget)throw Error('PDF_MUESTREO_TIMEOUT');
   const page=(await getObject(kids[pageNo-1],3200)).info.dict;
   if(!/\/Type\s*\/Page\b/.test(page))return null;
   const resources=reference(page,'Resources');
   if(!isPos(resources))return null;
   const res=(await getObject(resources,65536)).info.dict;
   const xobjects=/\/XObject\s*<<([\s\S]*?)>>/.exec(res)?.[1]||'';
   const refs=[...xobjects.matchAll(/\/Im(\d+)\s+(\d+)\s+\d+\s+R/g)]
    .map(x=>({number:Number(x[1]),xref:Number(x[2])}))
    .sort((a,b)=>a.number-b.number);
   if(refs.length<25||refs.length>3000)return null;
   const canvas=canvasFactory();
   canvas.width=720;canvas.height=SAMPLES.length*24;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)return null;
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
   let valid=0;
   try{
    for(const [j,fraction] of SAMPLES.entries()){
     if(signal?.aborted||Date.now()-started>budget)throw Error('PDF_MUESTREO_TIMEOUT');
     const entry=refs[Math.min(refs.length-1,Math.floor(refs.length*fraction))];
     const image=await getObject(entry.xref,1500);
     const d=image.info.dict;
     const width=scalar(d,'Width'),height=scalar(d,'Height');
     if(!/\/Subtype\s*\/Image\b/.test(d)||!isPos(width)||width<400||
        width>15000||!isPos(height)||height>80||
        height<3||scalar(d,'BitsPerComponent')!==8)return null;
     const payload=await streamOf(image,256*1024);
     if(/\/Filter\s*\/DCTDecode\b/.test(d)){
      if(typeof imageFactory!=='function')return null;
      const bitmap=await imageFactory(new Blob([payload],{type:'image/jpeg'}));
      try{
       if(bitmap.width!==width||bitmap.height!==height)return null;
       ctx.drawImage(bitmap,0,j*24,720,24);
      }finally{bitmap.close?.()}
     }else if(/\/Filter\s*\/FlateDecode\b/.test(d)){
      const cs=reference(d,'ColorSpace');
      if(!isPos(cs))return null;
      const color=(await getObject(cs,1500)).info.dict;
      const indexed=/\/Indexed\s*\/DeviceRGB\s+(\d+)\s+(\d+)\s+\d+\s+R/.exec(color);
      if(!indexed)return null;
      const paletteObj=await getObject(Number(indexed[2]),1500);
      const paletteRaw=await streamOf(paletteObj,4096);
      const palette=/\/Filter\s*\/FlateDecode\b/.test(paletteObj.info.dict)?
       await inflate(paletteRaw,4096):paletteRaw;
      const raw=await inflate(payload,512*1024);
      if(raw.length!==width*height||palette.length<(Number(indexed[1])+1)*3)return null;
      const pixels=ctx.createImageData(720,24);
      const rgba=pixels.data;
      for(let yy=0;yy<24;yy++){
       const sy=Math.min(height-1,Math.floor(yy*height/24));
       for(let xx=0;xx<720;xx++){
        const sx=Math.min(width-1,Math.floor(xx*width/720));
        const index=raw[sy*width+sx]*3;
        const at=(yy*720+xx)*4;
        rgba[at]=palette[index];rgba[at+1]=palette[index+1];
        rgba[at+2]=palette[index+2];rgba[at+3]=255;
       }
      }
      ctx.putImageData(pixels,0,j*24);
     }else return null;
     valid++;
    }
    if(valid!==SAMPLES.length)return null;
    const rgba=ctx.getImageData(0,0,720,canvas.height).data;
    // Una lámina de líneas CAD puede ser colorida; la variable decisiva
    // es la falta de áreas continuas grandes, no su porcentaje rojo.
    let filled=0,continuous=0,total=0;
    const mask=new Uint8Array(720*canvas.height);
    for(let k=0;k<rgba.length;k+=4){
     const occ=(rgba[k]+rgba[k+1]+rgba[k+2])/3<244;
     mask[k/4]=occ?1:0;filled+=occ?1:0;total++;
    }
    const stride=721,inte=new Uint32Array(stride*(canvas.height+1));
    for(let y=1;y<=canvas.height;y++){
     let row=0;
     for(let x=1;x<=720;x++){
      row+=mask[(y-1)*720+x-1];
      inte[y*stride+x]=inte[(y-1)*stride+x]+row;
     }
    }
    for(let y=6;y<canvas.height-6;y++){
     for(let x=6;x<720-6;x++){
      const x0=x-6,x1=x+7,y0=y-6,y1=y+7;
      const n=inte[y1*stride+x1]-inte[y0*stride+x1]-
       inte[y1*stride+x0]+inte[y0*stride+x0];
      if(n>=136)continuous++;
     }
    }
    const coverage=filled/total,full=continuous/total;
    let mode=null;
    if(coverage>=0.01&&coverage<=0.24&&full<=0.06&&
       full/Math.max(coverage,0.01)<=0.35)mode='cad';
    else if(coverage>=0.32&&full>=0.14)mode='poster';
    if(!mode)return null;
    results.push({numero:pageNo,modo:mode,
     cobertura:Math.round(coverage*1000)/1000,
     plenoContinuo:Math.round(full*10000)/10000});
    onProgreso({terminadas:results.length,total:seleccionadas.length,
     numeroPagina:pageNo,metodo:'MUESTREO_RASTER'});
   }finally{canvas.width=0;canvas.height=0}
  }
  return Object.freeze({altaConfianza:true,metodo:'MUESTREO_RASTER_ESTRUCTURA',
   paginas:Object.freeze(results),originalSubido:false,
   bytesLeidos:readTotal,solicitudesRango:reads,
   permiteImprimirSinRevisar:false});
 }catch(error){onError(String(error?.message||'ERROR_ANALISIS').slice(0,90));return null}
}
