/**
 * Librería Saber — Fuente de tarifas APROBADAS D1, sólo Worker documental privado.
 * La solicitud viaja por service binding con firma HMAC. Nunca consulta desde
 * el navegador directamente a D1 ni lee borradores. No activa pagos.
 */
const SCHEMA='saber-price-snapshot-v1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const URL='https://saber-pagos-pruebas.libreriasaber.workers.dev/internal/central/pricing-snapshot';
export async function obtenerTarifarioD1Privado(env,{
 subtle=crypto.subtle,now=()=>Math.floor(Date.now()/1000),
 requestId=()=>crypto.randomUUID()
}={}){
 if(env?.DOCS_PRICE_ADMIN_D1_ENABLED!=='PRIVATE_TEST_ONLY')
  throw Error('Consulta D1 de tarifas no habilitada.');
 if(typeof env.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    !env.SABER_CENTRAL||typeof env.SABER_CENTRAL.fetch!=='function')
  throw Error('Puente D1 de tarifas no configurado.');
 const ts=now(),id=requestId();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||!UUID.test(id))
  throw Error('Identificador temporal inválido para catálogo.');
 const payload=JSON.stringify({schema:SCHEMA,purpose:'quote-private-test'});
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sign=new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+payload)));
 const hmac=Array.from(sign,x=>x.toString(16).padStart(2,'0')).join('');
 const request=new Request(URL,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(ts),
  'x-saber-request-id':id,'x-saber-signature':hmac
 },body:payload});
 const response=await env.SABER_CENTRAL.fetch(request);
 if(response.status!==200)
  throw Error('No existe un tarifario aprobado y disponible para el ensayo privado.');
 const raw=await response.text();
 if(raw.length<120||raw.length>40000)
  throw Error('Tamaño inesperado del tarifario D1.');
 let data;
 try{data=JSON.parse(raw)}catch{throw Error('Tarifario D1 ilegible.')}
 if(data?.ok!==true||data.schema!==SCHEMA||data.source!=='private-d1-approved-only'||
    data.commercialRelease!==false||data.paymentAuthorized!==false||
    !Number.isSafeInteger(data.approvedRevision)||data.approvedRevision<1||
    data.prices?.schema!=='saber-web-prices-v1'||
    !Array.isArray(data.prices.bnA4?.scales)||
    !Array.isArray(data.prices.colorA4?.materials)||
    !Array.isArray(data.prices.plotter?.supports)||
    !Array.isArray(data.promotions?.codes))
  throw Error('Respuesta D1 no cumple contrato de tarifas aprobadas.');
 return {prices:{...data.prices,generatedAt:'d1-approved-revision-'+data.approvedRevision},
  promotions:data.promotions,revision:data.approvedRevision,source:data.source};
}
