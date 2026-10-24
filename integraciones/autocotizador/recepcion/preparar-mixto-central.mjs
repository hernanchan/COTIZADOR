/** Une una ficha documental ya registrada y una recepción Express verificada
 * en UNA compra comercial interna de Central. No crea checkout ni autoriza pago.
 * Nunca acepta precios, archivos o comprobantes como autoridad del navegador.
 */
const DOC=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const POL=/^POL-[A-F0-9]{24}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{12}$/i;
const WORKER=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const hex=values=>Array.from(values,x=>x.toString(16).padStart(2,'0')).join('');
export async function prepararMixtoCentralFirmado({
 env,webOrderId,polaroidReference,clientOrderId,items=[],
 subtle=crypto.subtle,requestId=()=>crypto.randomUUID(),
 now=()=>Math.floor(Date.now()/1000)
}){
 if(env?.DOCS_MIXED_PREPARE_ENABLED!=='PRIVATE_TEST_ONLY'||
    env?.DOCS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    env.CENTRAL_BRIDGE_KEY===env.DOCS_CENTRAL_ADMIN_KEY||
    env.CENTRAL_BRIDGE_KEY===env.DOCS_RELAY_KEY||
    typeof env?.SABER_CENTRAL?.fetch!=='function')
  throw Error('Preparación mixta privada deshabilitada.');
 if(!DOC.test(webOrderId||'')||!POL.test(polaroidReference||'')||
    !UUID.test(clientOrderId||'')||!Array.isArray(items)||items.length>40)
  throw Error('Referencias del pedido mixto inválidas.');
 const codes=new Set(),products=[];
 for(const p of items){
  if(!p||typeof p!=='object'||Array.isArray(p)||
     Object.keys(p).sort().join(',')!=='code,qty'||
     typeof p.code!=='string'||p.code.length>80||!p.code.trim()||
     !Number.isSafeInteger(p.qty)||p.qty<1||p.qty>500||codes.has(p.code))
   throw Error('Artículos inválidos o duplicados.');
  codes.add(p.code);products.push({code:p.code,qty:p.qty});
 }
 let dest;
 try{dest=new URL(env.CENTRAL_TEST_URL)}
 catch{throw Error('Central documental no configurada.')}
 if(dest.protocol!=='https:'||!WORKER.test(dest.hostname)||dest.port||
    dest.username||dest.password||dest.search||dest.hash||
    dest.pathname!=='/internal/central/stage')
  throw Error('Destino de Central no autorizado.');
 dest.pathname='/internal/central/prepare-mixed-order';
 const body=JSON.stringify({clientOrderId,webOrderId,polaroidReference,items:products});
 const id=requestId(),ts=now();
 if(!UUID.test(id)||!Number.isSafeInteger(ts))
  throw Error('Firma privada inválida.');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sign=hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
 const req=new Request(dest.href,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(ts),
  'x-saber-request-id':id,'x-saber-signature':sign
 },body});
 const res=await env.SABER_CENTRAL.fetch(req);
 if(res.status!==200&&res.status!==201)
  throw Error('La Central no confirmó el carrito mixto.');
 const txt=await res.text();
 if(txt.length>2500)throw Error('Respuesta mixta no válida.');
 let data;
 try{data=JSON.parse(txt)}catch{throw Error('Respuesta mixta no válida.')}
 if(data?.created!==true||!UUID.test(data.commercial_order_id||'')||
    !Number.isSafeInteger(data.amount_ars)||data.amount_ars<1||
    data.state!=='awaiting_payment'||data.checkoutEnabled!==false||
    data.paymentAuthorized!==false)
  throw Error('Respuesta mixta no confirmada o intento de cobro.');
 return Object.freeze({created:true,idempotent:Boolean(data.idempotent),
  commercialOrderId:data.commercial_order_id,amountArs:data.amount_ars,
  checkoutEnabled:false,paymentAuthorized:false});
}
