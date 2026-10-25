/**
 * Prepara UNA compra de documentos verificados + artículos de tienda.
 * Se ejecuta exclusivamente desde backend administrativo de pruebas.
 * PDF, páginas, precio de impresión y catálogo se verifican en Central D1.
 * Nunca crea preferencias de Mercado Pago ni habilita cobro o producción.
 */
const WEB=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function prepararDocumentosCentralFirmado({
 env,webOrderId,clientOrderId,items=[],
 subtle=crypto.subtle,requestId=()=>crypto.randomUUID(),
 now=()=>Math.floor(Date.now()/1000)
}){
 if(env?.DOCS_ORDER_PREPARE_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    env.CENTRAL_BRIDGE_KEY===env.DOCS_CENTRAL_ADMIN_KEY||
    env.CENTRAL_BRIDGE_KEY===env.DOCS_RELAY_KEY||
    typeof env?.SABER_CENTRAL?.fetch!=='function')
  throw Error('Preparación de compra documental privada deshabilitada.');
 if(!WEB.test(webOrderId||'')||!UUID.test(clientOrderId||'')||
    !Array.isArray(items)||items.length>50)
  throw Error('Pedido documental sin referencias verificables.');
 const used=new Set(),products=[];
 for(const p of items){
  if(!p||typeof p!=='object'||Array.isArray(p)||
     Object.keys(p).sort().join(',')!=='code,qty'||
     typeof p.code!=='string'||!p.code.trim()||p.code.length>80||
     !Number.isSafeInteger(p.qty)||p.qty<1||p.qty>500||used.has(p.code))
   throw Error('Artículos repetidos o inválidos.');
  used.add(p.code);
  products.push({code:p.code,qty:p.qty});
 }
 let target;
 try{target=new URL(env.CENTRAL_TEST_URL)}
 catch{throw Error('Central documental no configurada.')}
 if(target.protocol!=='https:'||!HOST.test(target.hostname)||target.port||
    target.username||target.password||target.search||target.hash||
    target.pathname!=='/internal/central/stage')
  throw Error('Destino de Central no autorizado.');
 target.pathname='/internal/central/prepare-order';
 const body=JSON.stringify({clientOrderId,webOrderId,items:products});
 const ts=now(),nonce=requestId();
 if(!Number.isSafeInteger(ts)||!UUID.test(nonce))
  throw Error('Firma privada inválida.');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+nonce+'\n'+body))));
 const response=await env.SABER_CENTRAL.fetch(new Request(target.href,{
  method:'POST',headers:{'Content-Type':'application/json',
   'x-saber-ts':String(ts),'x-saber-request-id':nonce,
   'x-saber-signature':signature},body
 }));
 if(response.status!==200&&response.status!==201)
  throw Error('La Central no confirmó el pedido de documentos.');
 const raw=await response.text();
 if(raw.length>2500)throw Error('Respuesta comercial no válida.');
 let data;
 try{data=JSON.parse(raw)}catch{throw Error('Respuesta comercial no válida.')}
 if(data?.created!==true||!UUID.test(data.commercial_order_id||'')||
    !Number.isSafeInteger(data.amount_ars)||data.amount_ars<1||
    data.state!=='awaiting_payment'||data.checkoutEnabled!==false||
    data.paymentAuthorized!==false)
  throw Error('Central devolvió un pedido no confirmado o un cobro.');
 return Object.freeze({created:true,idempotent:Boolean(data.idempotent),
  commercialOrderId:data.commercial_order_id,amountArs:data.amount_ars,
  checkoutEnabled:false,paymentAuthorized:false});
}
