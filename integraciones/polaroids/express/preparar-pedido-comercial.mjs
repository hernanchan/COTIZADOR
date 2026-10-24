/** Enlace privado entre PDF Express ya verificado y pedido comercial en D1.
 * No hay endpoint público, no confirma pagos y nunca inicia checkout.
 * Requiere dos permisos apagados por defecto: el de Express y el de Central.
 */
const POL=/^POL-[A-F0-9]{24}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function prepararPedidoComercialExpress({
  referencia,clientOrderId,items=[],env,
  subtle=crypto.subtle,ahora=()=>Math.floor(Date.now()/1000),
  requestId=()=>crypto.randomUUID()
}){
  if(env?.EXPRESS_ORDER_PREPARE_ENABLED!=='PRIVATE_TEST_ONLY'||
     env?.EXPRESS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
     typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
     env.CENTRAL_BRIDGE_KEY===env.EXPRESS_PDF_HMAC_KEY||
     typeof env?.SABER_CENTRAL?.fetch!=='function')
    throw Error('Preparación comercial Express desactivada.');
  if(!POL.test(referencia||'')||!UUID.test(clientOrderId||'')||
     !Array.isArray(items)||items.length>40)
    throw Error('Pedido Express comercial inválido.');
  const codes=new Set();
  for(const item of items){
    if(!item||typeof item!=='object'||Array.isArray(item)||
       Object.keys(item).sort().join(',')!=='code,qty'||
       typeof item.code!=='string'||item.code.length<1||item.code.length>80||
       !item.code.trim()||!Number.isSafeInteger(item.qty)||item.qty<1||
       item.qty>500||codes.has(item.code))
      throw Error('Artículos Express inválidos o repetidos.');
    codes.add(item.code);
  }
  let target;
  try{target=new URL(env.CENTRAL_EXPRESS_URL)}
  catch{throw Error('Central Express no configurada.')}
  if(target.protocol!=='https:'||!HOST.test(target.hostname)||target.port||
     target.username||target.password||target.search||target.hash||
     target.pathname!=='/internal/central/polaroid-stage')
    throw Error('Destino de Central no autorizado.');
  target.pathname='/internal/central/polaroid-prepare-order';
  const body=JSON.stringify({clientOrderId,referencia,items});
  const ts=ahora(),id=requestId();
  if(!Number.isSafeInteger(ts)||!UUID.test(id))throw Error('Firma de pedido no válida.');
  const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
    new TextEncoder().encode(ts+'\n'+id+'\n'+body))));
  const request=new Request(target.href,{method:'POST',
    headers:{'Content-Type':'application/json',
      'x-saber-ts':String(ts),'x-saber-request-id':id,
      'x-saber-signature':signature},body});
  const response=await env.SABER_CENTRAL.fetch(request);
  if(response.status!==200&&response.status!==201)
    throw Error('La Central no confirmó el pedido comercial.');
  const text=await response.text();
  if(text.length>2000)throw Error('La respuesta comercial no es válida.');
  let answer;
  try{answer=JSON.parse(text)}catch{throw Error('La respuesta comercial no es válida.')}
  if(answer.created!==true||!UUID.test(answer.commercial_order_id||'')||
     !Number.isSafeInteger(answer.amount_ars)||answer.amount_ars<3000||
     answer.checkoutEnabled!==false||answer.paymentAuthorized!==false||
     answer.state!=='awaiting_payment')
    throw Error('Central devolvió un pedido no confirmado o un pago no autorizado.');
  return Object.freeze({created:true,idempotent:Boolean(answer.idempotent),
    commercialOrderId:answer.commercial_order_id,amountArs:answer.amount_ars,
    checkoutEnabled:false,paymentAuthorized:false});
}
