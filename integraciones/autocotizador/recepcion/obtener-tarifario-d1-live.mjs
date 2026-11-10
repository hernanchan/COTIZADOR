/** Consulta de precios EXCLUSIVA de D1 producción por Service Binding.
 * No usa sandbox ni hace fallback a precios históricos.
 */
const GATE='GO_COMERCIAL_CONFIRMADO';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TARGET='https://pagos.libreriasaber.com.ar/internal/central/live/pricing';
export async function obtenerTarifarioD1Live(env,{
 fetchService=env?.SABER_CENTRAL?.fetch?.bind(env.SABER_CENTRAL),
 subtle=crypto.subtle,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID()
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.DOCS_LIVE_PRICING_GATE!==GATE||
    env?.DOCS_MP_LIVE_GATE!==GATE||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof fetchService!=='function')throw Error('LIVE_PRICING_OFF');
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||ts<1000000000||ts>9999999999||!UUID.test(id))
  throw Error('LIVE_PRICING_ID');
 const body=JSON.stringify({schema:'saber-price-snapshot-live-v1',purpose:'quote-production-approved'});
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Array.from(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))),x=>x.toString(16).padStart(2,'0')).join('');
 const request=new Request(TARGET,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(ts),
  'x-saber-request-id':id,'x-saber-signature':sig},body});
 const response=await fetchService(request);
 if(!response.ok)throw Error('LIVE_PRICING_NO_APPROVAL');
 const raw=await response.text();
 if(raw.length<120||raw.length>80000)throw Error('LIVE_PRICING_PAYLOAD');
 let data;try{data=JSON.parse(raw)}catch{throw Error('LIVE_PRICING_JSON')}
 if(data?.ok!==true||data.schema!=='saber-price-snapshot-v1'||
    data.source!=='production-d1-approved-only'||
    data.paymentAuthorized!==false||data.commercialRelease!==false||
    !Number.isSafeInteger(data.approvedRevision)||data.approvedRevision<1||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(data.approvedAt||'')||
    !Number.isFinite(Date.parse(data.approvedAt))||
    data.prices?.schema!=='saber-web-prices-v1'||
    !Array.isArray(data.prices.bnA4?.scales)||
    !Array.isArray(data.prices.colorA4?.materials)||
    !Array.isArray(data.prices.plotter?.supports)||
    !Array.isArray(data.promotions?.codes))
  throw Error('LIVE_PRICING_INVALID');
 return {prices:{...data.prices,generatedAt:data.approvedAt,
   priceVersion:'d1-approved-revision-'+data.approvedRevision},
  promotions:data.promotions,revision:data.approvedRevision,source:data.source};
}
