/** Sólo servidor: enviar documento VERIFICADO al D1 de la Central.
 * Los secretos se inyectan como env vars; este módulo no publica ni genera
 * pedidos pagados. Endpoint exclusivo del Worker de pagos de prueba.
 */
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
export async function enviarCentralFirmada({
 verificacion,url,clave,habilitado,service,fetcher=fetch,subtle=crypto.subtle,
 nuevoId=()=>crypto.randomUUID(),ahora=()=>Math.floor(Date.now()/1000)
}){
 if(habilitado!=='PRIVATE_TEST_ONLY'||typeof clave!=='string'||clave.length<32)
  throw Error('Sincronización privada deshabilitada.');
 let target;
 try{target=new URL(url)}catch(_){throw Error('Destino privado no configurado.');}
 if(target.protocol!=='https:'||!HOST.test(target.hostname)||target.port||
    target.username||target.password||target.search||target.hash||
    target.pathname!=='/internal/central/stage')
  throw Error('Destino ajeno al Worker de pruebas de la Central.');
 const v=verificacion;
 if(!v||v.schema!=='saber-central-recepcion-verificada-v1'||
    !/^WEB-[A-Za-z0-9_-]{5,80}$/.test(v.orderId||'')||
    v.paymentAuthorized!==false||v.filesReceived!==true||
    v.listoParaProducir!==false||!Number.isSafeInteger(v.importeVerificado)||
    v.importeVerificado<1||!v.ficha||!Array.isArray(v.recibos))
  throw Error('No se firmará un documento sin verificación completa.');
 const packet={schema:v.schema,orderId:v.orderId,filesReceived:true,
  paymentAuthorized:false,listoParaProducir:false,
  importeVerificado:v.importeVerificado,recibos:v.recibos,ficha:v.ficha};
 const body=JSON.stringify(packet);
 if(body.length>32000)throw Error('Manifiesto privado fuera del límite.');
 const requestId=nuevoId(),timestamp=ahora();
 if(!/^[a-f0-9-]{36}$/i.test(requestId)||!Number.isSafeInteger(timestamp))
  throw Error('Identificador de sincronización inválido.');
 const key=await subtle.importKey('raw',new TextEncoder().encode(clave),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=new TextEncoder().encode(timestamp+'\n'+requestId+'\n'+body);
 const signature=Array.from(new Uint8Array(await subtle.sign('HMAC',key,data)),
  x=>x.toString(16).padStart(2,'0')).join('');
 // El envío entre Workers de la misma cuenta usa un Service Binding.
 // No recurrir a workers.dev en producción si falta el binding: la Central
 // podría rechazar Worker-to-Worker fetch y no debe haber ruta alternativa.
 if(typeof service?.fetch!=='function'&&fetcher===fetch)
  throw Error('Falta vinculación privada SABER_CENTRAL en documentos.');
 const options={method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(timestamp),
  'x-saber-request-id':requestId,'x-saber-signature':signature
 },body};
 const response=typeof service?.fetch==='function'
  ?await service.fetch(new Request(target.href,options))
  :await fetcher(target.href,{...options,signal:AbortSignal.timeout(15000),redirect:'error'});
 const text=await response.text();
 if(!response.ok||text.length>4000)throw Error('La Central aún no confirmó la recepción.');
 let confirmacion;
 try{confirmacion=JSON.parse(text)}catch(_){throw Error('Respuesta de la Central no reconocida.');}
 if(confirmacion.saved!==true||confirmacion.paymentAuthorized!==false||
    confirmacion.web_order_id!==v.orderId)
  throw Error('La Central no confirmó el pedido original.');
 return Object.freeze({ok:true,webOrderId:v.orderId,
  guardado:true,existia:Boolean(confirmacion.idempotent),
  paymentAuthorized:false,listoParaProducir:false});
}
