/**
 * Proxy de pago TOTAL en sandbox, exclusivo del portal documental privado.
 * No acepta importes, no expone secretos y no habilita pagos comerciales.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const reply=(value,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
export async function pagoTUSSandboxCliente(request,env,{authorized=false,subtle=crypto.subtle,now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()}={}){
 if(!authorized)return reply({ok:false,error:'Acceso privado requerido'},401);
 if(env?.DOCS_CLIENT_SANDBOX_CHECKOUT_ENABLED!=='PRIVATE_TEST_ONLY')
  return reply({ok:false,error:'Pago documental de ensayo deshabilitado'},503);
 if(request.method!=='POST'||request.headers.get('Content-Type')?.split(';')[0]!=='application/json')
  return reply({ok:false,error:'Método no admitido'},405);
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)
  return reply({ok:false,error:'Origen no autorizado'},403);
 if(typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof env?.SABER_CENTRAL?.fetch!=='function')
  return reply({ok:false,error:'Central privada no configurada'},503);
 let data;
 try{
  const raw=await request.text();
  if(raw.length>1200)throw Error('exceso');
  data=JSON.parse(raw);
 }catch{return reply({ok:false,error:'Solicitud inválida'},400)}
 if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).sort().join(',')!=='action,clientOrderId,commercialOrderId,webOrderId'||
    !['start','status','bank'].includes(data.action)||
    !UUID.test(data.clientOrderId||'')||!UUID.test(data.commercialOrderId||'')||
    !WEB.test(data.webOrderId||''))
  return reply({ok:false,error:'Pedido de prueba inválido'},400);
 let url;
 try{url=new URL(env.CENTRAL_TEST_URL)}
 catch{return reply({ok:false,error:'Central privada no configurada'},503)}
 if(url.protocol!=='https:'||!HOST.test(url.hostname)||url.pathname!=='/internal/central/stage'||
    url.port||url.search||url.hash||url.username||url.password)
  return reply({ok:false,error:'Destino privado no autorizado'},503);
 url.pathname='/internal/central/payment-sandbox-client';
 const body=JSON.stringify(data);
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||!UUID.test(id))return reply({ok:false,error:'Firma privada no disponible'},503);
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))),x=>x.toString(16).padStart(2,'0')).join('');
 try{
  const response=await env.SABER_CENTRAL.fetch(new Request(url.href,{method:'POST',headers:{
   'Content-Type':'application/json','x-saber-ts':String(ts),
   'x-saber-request-id':id,'x-saber-signature':signature},body
  }));
  const raw=await response.text();
  if(raw.length>3000)return reply({ok:false,error:'Respuesta de pago inesperada'},502);
  const result=JSON.parse(raw);
  if(!response.ok)return reply({ok:false,error:String(result?.error||'No se pudo preparar el pago').slice(0,180)},response.status===409?409:502);
  if(result?.ok!==true||result.commercialOrderId!==data.commercialOrderId)
   return reply({ok:false,error:'El pago no corresponde al pedido'},502);
  if(data.action==='bank'){
   if(result.estado!=='transferencia_pendiente'||result.paymentAuthorized!==false||
      typeof result.alias!=='string'||!/^[A-Za-z0-9._-]{6,50}$/.test(result.alias)||
      !Number.isSafeInteger(result.amountArs)||result.amountArs<1)
    return reply({ok:false,error:'La instrucción bancaria no pudo verificarse'},502);
   return reply({ok:true,estado:'transferencia_pendiente',alias:result.alias,
    amountArs:result.amountArs,orderId:data.commercialOrderId,paymentAuthorized:false});
  }
  if(data.action==='start'){
   let safe=false;
   try{const link=new URL(result.checkoutUrl);
    safe=link.protocol==='https:'&&/(^|\.)(mercadopago\.com|mercadopago\.com\.ar)$/.test(link.hostname);
   }catch{}
   if(!safe)return reply({ok:false,error:'Mercado Pago no devolvió un enlace seguro'},502);
   return reply({ok:true,estado:'pendiente',checkoutUrl:result.checkoutUrl,orderId:data.commercialOrderId});
  }
  if(!['pendiente','pagado','revocado','transferencia_pendiente'].includes(result.estado))
   return reply({ok:false,error:'Estado de pago no verificable'},502);
  // Releer las instrucciones desde D1, nunca del navegador; no autoriza pagos.
  let instructions={};
  if(result.estado==='transferencia_pendiente'&&
     (result.alias!==undefined||result.amountArs!==undefined)){
   if(result.paymentAuthorized!==false||typeof result.alias!=='string'||
      !/^[A-Za-z0-9._-]{6,50}$/.test(result.alias)||
      !Number.isSafeInteger(result.amountArs)||result.amountArs<1)
    return reply({ok:false,error:'Instrucciones bancarias inválidas'},502);
   instructions={alias:result.alias,amountArs:result.amountArs};
  }
  // Plazo informativo, solamente desde Central firmada y con pago aprobado.
  let preparacionEstimada;
  if(result.estado==='pagado'&&result.preparacionEstimada){
   const eta=result.preparacionEstimada,parsed=Date.parse(eta.readyAt);
   if(eta.provisional===true&&typeof eta.readyAt==='string'&&
      Number.isFinite(parsed)&&new Date(parsed).toISOString()===eta.readyAt)
    preparacionEstimada={readyAt:eta.readyAt,provisional:true};
  }
  return reply({ok:true,estado:result.estado,...instructions,
   ...(preparacionEstimada?{preparacionEstimada}:{}),orderId:data.commercialOrderId});
 }catch{return reply({ok:false,error:'No se pudo contactar la Central privada'},502)}
}
