/**
 * Antes de crear multipart R2, reserva capacidad atómicamente en D1 Central.
 * Por diseño requiere 2 flags privados; nunca envía el PDF a Central.
 */
import {validarSolicitudCupoR2} from '../../mercadopago/pruebas/r2-grandes-cuotas-central.mjs';
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const HEX=x=>Array.from(x,b=>b.toString(16).padStart(2,'0')).join('');
export async function reservarR2GrandeAntesDeSubir({
 env,orderId,meta,objectUUID,
 service=env?.SABER_CENTRAL,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 if(env?.DOCS_R2_QUOTA_ENABLED!=='PRIVATE_TEST_ONLY'||
  env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
  typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
  typeof service?.fetch!=='function')throw Error('R2_CUPO_NO_CONFIGURADO');
 const request=validarSolicitudCupoR2({
  schema:'saber-central-r2-reserva-v1',orderId,
  fileId:meta?.fileId,sha256:meta?.sha256,bytes:meta?.bytes,
  objectKey:'r2-v1/'+orderId+'/'+objectUUID+'.pdf'
 });
 let target;try{target=new URL(env.CENTRAL_TEST_URL)}
 catch{throw Error('R2_CUPO_DESTINO_INVALIDO')}
 if(target.protocol!=='https:'||!HOST.test(target.hostname)||target.port||
  target.username||target.password||target.search||target.hash||
  target.pathname!=='/internal/central/stage')
  throw Error('R2_CUPO_DESTINO_INVALIDO');
 target.pathname='/internal/central/r2-reserve';
 const body=JSON.stringify(request),id=nonce(),time=now();
 if(body.length>4000||!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(time))
  throw Error('R2_CUPO_FIRMA_INVALIDA');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=HEX(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(time+'\n'+id+'\n'+body))));
 const result=await service.fetch(new Request(target.href,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(time),
  'x-saber-request-id':id,'x-saber-signature':signature
 },body}));
 if(result.status===429)throw Error('R2_CUPO_AGOTADO');
 if(!result.ok)throw Error('R2_CUPO_RECHAZADO');
 const raw=await result.text();
 if(raw.length>1600)throw Error('R2_CUPO_RESPUESTA_INVALIDA');
 let data;try{data=JSON.parse(raw)}catch{throw Error('R2_CUPO_RESPUESTA_INVALIDA')}
 if(data?.ok!==true||data.reserved!==true||data.quotaGranted!==true||
  data.orderId!==orderId||data.registeredInD1!==false||
  data.paymentAuthorized!==false||data.checkoutEnabled!==false)
  throw Error('R2_CUPO_CONFIRMACION_INVALIDA');
 return Object.freeze({reserved:true,objectUUID,orderId,bytes:meta.bytes,
  paymentAuthorized:false,registeredInD1:false});
}
