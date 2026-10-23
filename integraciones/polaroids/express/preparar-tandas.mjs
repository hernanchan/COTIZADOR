/** Polaroids Express: preprocesa fotos localmente, seis a la vez.
 * No envía originales ni devuelve un PDF imprimible al navegador.
 * Los recortes JPEG viven sólo en memoria hasta la transferencia autorizada.
 */
import {EXPRESS} from './motor-pdf.mjs';
export async function prepararTandasExpress({
 hojas,recortarFoto,onAvance=()=>{},cancelado=()=>false
}){
 if(!Array.isArray(hojas)||hojas.length<1||hojas.length>EXPRESS.maxHojas||
    typeof recortarFoto!=='function')
  throw Error('Elegí entre una y cuatro hojas para Polaroids Express.');
 if(hojas.some((hoja,i)=>!Array.isArray(hoja)||hoja.length<1||hoja.length>6||
    (i<hojas.length-1&&hoja.length!==6)))
  throw Error('Prepará las fotografías de a seis por hoja.');
 const total=hojas.reduce((sum,x)=>sum+x.length,0);
 if(total>EXPRESS.maxFotos)throw Error('Máximo 24 fotografías por pedido.');
 let listas=[],hechas=0;
 const qualities=[.82,.75,.68,.60];
 try{
  for(let h=0;h<hojas.length;h++){
   const page=[];
   for(let i=0;i<hojas[h].length;i++){
    if(cancelado())throw Error('Preparación de fotos cancelada.');
    const foto=hojas[h][i];
    let accepted=null;
    for(const quality of qualities){
     const blob=await recortarFoto(foto,quality);
     if(blob instanceof Blob&&blob.type==='image/jpeg'&&
        blob.size>=80&&blob.size<=EXPRESS.maxRecorteBytes){
      accepted=new Uint8Array(await blob.arrayBuffer());
      if(accepted[0]!==0xff||accepted[1]!==0xd8||accepted[2]!==0xff)
       throw Error('La imagen optimizada no tiene formato JPG válido.');
      break;
     }
    }
    if(!accepted)throw Error('La fotografía supera el peso máximo de calidad de impresión.');
    page.push(accepted);hechas++;
    onAvance({hoja:h+1,totalHojas:hojas.length,
      fotosPreparadas:hechas,totalFotos:total});
   }
   listas.push(page);
  }
  return Object.freeze({
   hojas:listas,fotos:total,hojasA4:listas.length,
   pdfEnDispositivo:false,originalesEnviados:false,
   precioOrientativo:listas.length*EXPRESS.precioPorHoja
  });
 }catch(error){
  // No conservar una tanda incompleta por un fallo de foto o una cancelación.
  listas.length=0;
  throw error;
 }
}
