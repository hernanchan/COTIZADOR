/**
 * Cotización orientativa del iframe privado.
 * Reintenta una sola vez respuestas transitorias 502/503/504 o problemas de red.
 * No altera importes, documentos ni estados de pago: todos provienen del servidor.
 */
export async function solicitarCotizacionPrivada(archivos,{
 fetcher=fetch,
 pausa=ms=>new Promise(resolve=>setTimeout(resolve,ms))
}={}){
 const payload=JSON.stringify({archivos});
 const endpoint='/api/ensayo-carga-unica';
 for(let intento=0;intento<2;intento++){
  let response;
  try{
   response=await fetcher(endpoint,{
    method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:payload
   });
  }catch(error){
   if(intento===0){await pausa(450);continue}
   throw Error('El servidor no respondió. El PDF sigue en esta pantalla; reintentá el presupuesto.');
  }
  let data=null;
  try{data=await response.json()}catch{}
  if(response.ok&&data?.ok===true&&data?.paymentAuthorized===false)return data;
  if([502,503,504].includes(response.status)&&intento===0){
   await pausa(450);continue;
  }
  const reason=typeof data?.error==='string'&&data.error.length<=220?
   data.error:'El servidor no pudo completar la cotización.';
  throw Error(reason);
 }
 throw Error('No fue posible consultar el precio vigente. Probá reintentar sin subir nuevamente el PDF.');
}
