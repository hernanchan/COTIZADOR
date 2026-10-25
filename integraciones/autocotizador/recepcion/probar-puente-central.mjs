/** Solo diagnóstico privado entre Workers; no D1, no pedidos, no cobros. */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
export async function probarPuenteCentral({env,subtle=crypto.subtle,
 nuevoId=()=>crypto.randomUUID(),ahora=()=>Math.floor(Date.now()/1000)}){
 if(env?.DOCS_CENTRAL_PROBE_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.SABER_CENTRAL?.fetch!=='function'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    env.CENTRAL_BRIDGE_KEY===env.DOCS_RELAY_KEY||
    env.CENTRAL_BRIDGE_KEY===env.DOCS_CENTRAL_ADMIN_KEY)
  throw Error('Diagnóstico interno no habilitado.');
 let target;
 try{target=new URL(env.CENTRAL_TEST_URL)}catch{throw Error('Destino no configurado.')}
 if(target.protocol!=='https:'||!HOST.test(target.hostname)||
    target.port||target.username||target.password||target.search||target.hash||
    target.pathname!=='/internal/central/stage')
  throw Error('Destino externo no permitido.');
 target.pathname='/internal/central/bridge-probe';
 const challenge=nuevoId(),ts=ahora();
 if(!UUID.test(challenge)||!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999)
  throw Error('Desafío de diagnóstico inválido.');
 const body=JSON.stringify({schema:'saber-central-bridge-probe-v1',
  operation:'verify-only',challenge});
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new TextEncoder().encode(ts+'\n'+challenge+'\n'+body);
 const signature=Array.from(new Uint8Array(await subtle.sign('HMAC',key,bytes)),
  x=>x.toString(16).padStart(2,'0')).join('');
 const response=await env.SABER_CENTRAL.fetch(new Request(target.href,{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(ts),'x-saber-request-id':challenge,
   'x-saber-signature':signature},body
 }));
 if(response.status!==200)throw Error('La Central no validó la firma.');
 const raw=await response.text();
 if(raw.length>1500)throw Error('Respuesta de diagnóstico inválida.');
 let result;
 try{result=JSON.parse(raw)}catch{throw Error('Respuesta de diagnóstico inválida.')}
 if(result?.ok!==true||result.schema!=='saber-central-bridge-probe-v1'||
    result.challenge!==challenge||result.verifiedSignature!==true||
    result.dbTouched!==false||result.orderCreated!==false||
    result.paymentAuthorized!==false||result.checkoutEnabled!==false)
  throw Error('Confirmación de la Central no confiable.');
 return Object.freeze({ok:true,schema:'saber-central-bridge-probe-v1',
  signed:true,dbTouched:false,orderCreated:false,paymentAuthorized:false,
  checkoutEnabled:false});
}
