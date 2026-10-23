/** Cliente Express sin PDF imprimible ni envío de originales. */
export const MAX_FOTOS_EXPRESS=24;
export const MAX_HOJAS_EXPRESS=4;
const MAX_RECorte=750000;
const CALIDADES=[.82,.75,.68,.60];
function base64(bytes){
 const result=[],STEP=3*32768;
 for(let i=0;i<bytes.length;i+=STEP){
  const part=bytes.subarray(i,Math.min(bytes.length,i+STEP));
  let str='';for(let j=0;j<part.length;j++)str+=String.fromCharCode(part[j]);
  result.push(btoa(str));
 }
 return result.join('');
}
export async function prepararEnvioExpress({hojas,recortar,onAvance=()=>{},cancelado=()=>false}){
 if(!Array.isArray(hojas)||!hojas.length||hojas.length>MAX_HOJAS_EXPRESS||
    typeof recortar!=='function')
  throw Error('Polaroids Express permite hasta cuatro hojas A4.');
 if(hojas.some((x,i)=>!Array.isArray(x)||!x.length||x.length>6||
    (i<hojas.length-1&&x.length!==6)))
  throw Error('Cada hoja debe contener hasta seis fotografías.');
 const count=hojas.reduce((n,x)=>n+x.length,0);
 if(count>MAX_FOTOS_EXPRESS)throw Error('Máximo 24 fotografías por pedido.');
 const list=[];let completed=0,totalBase64=0;
 try{
  for(let h=0;h<hojas.length;h++){
   const sheet=[];
   for(const photo of hojas[h]){
    if(cancelado())throw Error('Se canceló la preparación de fotos.');
    let bytes=null;
    for(const quality of CALIDADES){
     const jpg=await recortar(photo,quality);
     if(jpg instanceof Blob&&jpg.type==='image/jpeg'&&jpg.size>=80&&jpg.size<=MAX_RECorte){
      bytes=new Uint8Array(await jpg.arrayBuffer());
      if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)
       throw Error('No se pudo preparar un JPEG de impresión.');
      break;
     }
    }
    if(!bytes)throw Error('Una foto es demasiado pesada incluso después de optimizarla.');
    const encoded=base64(bytes);
    totalBase64+=encoded.length;
    if(totalBase64>17*1024*1024)
     throw Error('El pedido excede el tamaño recomendado. Reducí la cantidad de fotos.');
    sheet.push(encoded);
    completed++;
    onAvance({preparadas:completed,total:count,hoja:h+1,hojas:hojas.length});
   }
   list.push(sheet);
  }
  return {hojas:list,fotos:count,numeroHojas:list.length,
   pesoAproximadoEnvio:totalBase64,originalesIncluidos:false,pdfCliente:false};
 }catch(e){list.length=0;throw e}
}
