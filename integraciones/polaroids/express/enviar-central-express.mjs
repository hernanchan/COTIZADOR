/**
 * Sólo backend. Informa a la Central el PDF Express ya confirmado por GAS.
 * Prohíbe URLs públicas, datos del comprador, originales, fotos y encuadres.
 * El HMAC y la URL del Worker de prueba NUNCA llegan al cliente.
 */
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const REF=/^POL-[A-F0-9]{24}$/;
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
export async function enviarPolaroidsACentral({
 recibo,env,fetcher=fetch,subtle=crypto.subtle,
 nuevoId=()=>crypto.randomUUID(),ahora=()=>Math.floor(Date.now()/1000)
}){
 if(env?.EXPRESS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    env.CENTRAL_BRIDGE_KEY===env.EXPRESS_PDF_HMAC_KEY)
  throw Error('Central de Polaroids Express no configurada.');
 let url;try{url=new URL(env.CENTRAL_EXPRESS_URL)}catch(_){throw Error('Destino de Central no configurado.');}
 if(url.protocol!=='https:'||!HOST.test(url.hostname)||url.port||url.username||
    url.password||url.search||url.hash||
    url.pathname!=='/internal/central/polaroid-stage')
  throw Error('El destino no es la Central de pruebas autorizada.');
 if(!recibo||recibo.pdfPrivadoVerificado!==true||
    !REF.test(recibo.referencia||'')||
    !Number.isSafeInteger(recibo.fotos)||recibo.fotos<1||recibo.fotos>24||
    !Number.isSafeInteger(recibo.hojas)||recibo.hojas!==Math.ceil(recibo.fotos/6)||
    !Number.isSafeInteger(recibo.pdfTamanoBytes)||recibo.pdfTamanoBytes<100||
    recibo.pdfTamanoBytes>12*1024*1024||
    !SHA.test(recibo.pdfSha256||'')||
    recibo.permiteDescargaCliente!==false)
  throw Error('Falta constancia íntegra del PDF Express privado.');
 const data={schema:'saber-polaroids-express-central-v1',referencia:recibo.referencia,
  fotos:recibo.fotos,hojas:recibo.hojas,sha256:recibo.pdfSha256,
  bytes:recibo.pdfTamanoBytes,importeArs:recibo.hojas*3000,
  pdfPrivadoVerificado:true,pagoConfirmado:false,listoParaProducir:false};
 const body=JSON.stringify(data);
 const ts=ahora(),id=nuevoId();
 if(!Number.isSafeInteger(ts)||!UUID.test(id))throw Error('Firma HMAC inválida.');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 const response=await fetcher(url.href,{method:'POST',
  headers:{'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':id,'x-saber-signature':digest},
  body,redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('La Central no confirmó el PDF.');
 const message=await response.text();
 if(message.length>1600)throw Error('Respuesta inválida de la Central.');
 let reply;try{reply=JSON.parse(message)}catch(_){throw Error('Respuesta inválida de la Central.');}
 if(reply?.saved!==true||reply.referencia!==data.referencia||
    reply.paymentAuthorized!==false||reply.pdfPrivadoVerificado!==true)
  throw Error('La Central no reconoció la constancia privada.');
 return Object.freeze({ok:true,referencia:data.referencia,
  registrado:true,yaExistia:Boolean(reply.idempotent),
  paymentAuthorized:false,listoParaProducir:false});
}
