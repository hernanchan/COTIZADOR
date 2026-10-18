/* Integración de clientes para ensayo. No se carga en la tienda pública. */
(function(global){
 'use strict';
 const cfg=global.SABER_CHECKOUT_CONFIG||{},adapter=global.SaberCartPaymentAdapter;
 let session=null,pending=null;
 const savedKey='saberCheckoutSessionV1';
 try{session=JSON.parse(localStorage.getItem(savedKey)||'null')}catch{}
 function enabled(){if(cfg.enabled!==true||cfg.rollout!=='APROBADO'||!cfg.turnstileSiteKey||!adapter)
  throw Error('El pago online todavía no está habilitado.');}
 async function api(op,body,authenticated=true){
  const response=await fetch('/api/checkout?op='+op,{method:'POST',headers:{'Content-Type':'application/json',
   ...(authenticated?{Authorization:'Bearer '+session?.token}:{})},body:JSON.stringify({...body,client_order_id:adapter.intentId()})});
  const data=await response.json();if(!response.ok){if(response.status===401){session=null;localStorage.removeItem(savedKey)}throw Error(data.error||'No se pudo completar la operación.');}return data;
 }
 async function challenge(){
  if(!global.turnstile){
   if(!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')){
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';document.head.append(script);
   }
   await new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{
    if(global.turnstile){clearInterval(timer);resolve()}else if(Date.now()-start>20000){clearInterval(timer);reject(Error('No se pudo cargar la verificación de seguridad.'));}
   },100)});
  }
  return new Promise((resolve,reject)=>{
   const box=document.createElement('div');box.setAttribute('role','dialog');box.style.cssText='position:fixed;inset:20% auto auto 5%;padding:20px;background:white;z-index:10000;border:2px solid #174b8f';
   const title=document.createElement('p');title.textContent='Verificá la seguridad para preparar tu pago.';box.append(title);
   const target=document.createElement('div');box.append(target);
   const cancel=document.createElement('button');cancel.textContent='Cancelar';box.append(cancel);document.body.append(box);
   let widget,timer;const finish=(error,token)=>{clearTimeout(timer);if(widget!==undefined)global.turnstile.remove(widget);box.remove();error?reject(error):resolve(token)};
   cancel.onclick=()=>finish(Error('Verificación cancelada. Tu carrito sigue guardado.'));
   timer=setTimeout(()=>finish(Error('La verificación venció. Intentá nuevamente.')),120000);
   widget=global.turnstile.render(target,{sitekey:cfg.turnstileSiteKey,action:'checkout',callback:token=>finish(null,token),
    'error-callback':()=>finish(Error('No se pudo verificar la seguridad.')),'expired-callback':()=>finish(Error('La verificación venció.'))});
  });
 }
 async function begin(){
  enabled();
  if(session?.intent===adapter.intentId()&&session.expires>Date.now())return;
  const result=await api('session',{turnstileToken:await challenge()},false);
  session={token:result.session_token,intent:adapter.intentId(),expires:Date.now()+23*60*60*1000};
  localStorage.setItem(savedKey,JSON.stringify(session));
 }
 async function receipt(reference,uploadKey){await begin();return api('polaroid-proof',{reference,uploadKey})}
 async function checkout(){
  if(pending)return pending;
  pending=(async()=>{
   await begin();const body=adapter.fromLocalStorage();const order=await api('cart-order',body);
   if(order.paid)return {state:'paid',order_id:order.order_id};
   localStorage.setItem('saberCheckoutSubmittedV1',JSON.stringify({order_id:order.order_id,cart:localStorage.getItem('saberCartV1')}));
   // Mostrar importe calculado en servidor y pedir conformidad si el catálogo cambió.
   if(order.total_ars!==body.displayTotal&&!global.confirm('El total actualizado es $ '+order.total_ars.toLocaleString('es-AR')+'. ¿Continuar?'))return {state:'cancelled'};
   const payment=await api('pay',{order_id:order.order_id});
   const url=new URL(payment.checkout_url);
   if(url.protocol!=='https:'||!/(^|\.)(mercadopago\.com|mercadopago\.com\.ar)$/.test(url.hostname))throw Error('El enlace de pago no es válido.');
   global.location.assign(url.href);return payment;
  })();
  try{return await pending}finally{pending=null}
 }
 async function status(){await begin();return api('status',{})}
 async function newOrder(){
  const current=await status();if(current.state!=='paid')throw Error('El pago todavía no está confirmado.');
  let saved;try{saved=JSON.parse(localStorage.getItem('saberCheckoutSubmittedV1')||'null')}catch{}
  if(saved?.order_id===current.order_id&&saved.cart===localStorage.getItem('saberCartV1'))localStorage.removeItem('saberCartV1');
  localStorage.removeItem('saberCheckoutIntentV2');localStorage.removeItem(savedKey);localStorage.removeItem('saberCheckoutSubmittedV1');session=null;
 }
 global.SaberCheckout=Object.freeze({begin,receipt,checkout,status,newOrder});
})(window);
