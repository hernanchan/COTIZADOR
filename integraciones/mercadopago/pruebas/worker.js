// Librería Saber: integración AISLADA para Checkout Pro de Mercado Pago.
// No desplegar ni agregar secretos reales hasta revisar y aprobar la prueba.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const esc=s=>encodeURIComponent(s);
const tokenOK=(req,env)=>{const expected=env.DEMO_ADMIN_KEY;if(typeof expected!=="string"||!expected)return false;const actual=req.headers.get("Authorization")||"";return actual.startsWith("Bearer ") && actual.slice(7).trim()===expected.trim()};
async function mp(env,path,opts={}){
 const r=await fetch("https://api.mercadopago.com"+path,{...opts,headers:{Authorization:"Bearer "+env.MP_TEST_ACCESS_TOKEN,"Content-Type":"application/json",...(opts.headers||{})}});
 const t=await r.text();let data;try{data=JSON.parse(t)}catch{data={message:"Respuesta inválida de Mercado Pago"}}
 if(!r.ok)throw Error("Mercado Pago respondió "+r.status+" "+String(data.message||""));
 return data;
}
async function verifySignature(req,url,secret){
 if(typeof secret!=="string"||!secret)return false;
 const parts=Object.fromEntries((req.headers.get("x-signature")||"").split(",").map(v=>{const i=v.indexOf("=");return i<0?["", ""]:[v.slice(0,i).trim(),v.slice(i+1).trim()]}));
 const ts=parts.ts, supplied=parts.v1;
 const id=url.searchParams.get("data.id")||url.searchParams.get("data_id");
 const requestId=req.headers.get("x-request-id");
 if(!ts||!/^[0-9]{9,16}$/.test(ts)||!/^[a-fA-F0-9]{64}$/.test(supplied||""))return false;
 const manifest=(id?"id:"+id.toLowerCase()+";":"")+(requestId?"request-id:"+requestId+";":"")+"ts:"+ts+";";
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const result=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(manifest)));
 const received=new Uint8Array(32);
 for(let i=0;i<32;i++)received[i]=parseInt(supplied.slice(i*2,i*2+2),16);
 let mismatch=0;for(let i=0;i<32;i++)mismatch|=result[i]^received[i];
 return mismatch===0;
}
const demoHtml="<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Saber pagos prueba</title><style>body{font:16px system-ui;max-width:650px;margin:35px auto;padding:18px}input{padding:10px;width:95%}button{padding:12px;margin:8px 3px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h2>Librería Saber | Prueba de pagos</h2><p>Solo pruebas: pedido $10.000, pago total $10.000. No introduzcas tokens de Mercado Pago.</p><input type=\"password\" id=\"key\" placeholder=\"Clave del demo (no se guarda)\"><p><button id=\"start\">Crear pedido y preparar pago</button><button id=\"sync\">Actualizar pedidos pagados</button><button id=\"list\">Consultar pagos aprobados</button><button id=\"diag\">Diagnosticar configuración</button><button id=\"audit\">Ver eventos automáticos</button><button id=\"cryptotest\">Probar verificador HMAC</button><p><input id=\"paymentId\" inputmode=\"numeric\" placeholder=\"Número de operación de prueba\"><button id=\"paymentCheck\">Analizar pago de prueba</button><button id=\"reconcile\">Verificar y registrar pago aprobado</button></p></p><pre id=\"output\"></pre><script>\nconst o=document.querySelector('#output');\nasync function api(p,m='GET',b){const r=await fetch(p,{method:m,headers:{'Authorization':'Bearer '+document.querySelector('#key').value,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||r.status);return d}\ndocument.querySelector('#start').onclick=async()=>{try{o.textContent='Preparando...';const x=await api('/demo/order','POST');const y=await api('/demo/checkout','POST',{order_id:x.id});o.textContent='Pedido '+x.id+' creado. ';const a=document.createElement('a');a.href=y.checkout_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir pago de prueba';o.append(a)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#sync').onclick=async()=>{try{o.textContent='Consultando pagos pendientes...';const x=await api('/demo/sync-pending','POST');const y=await api('/demo/paid-orders');o.textContent=JSON.stringify({sincronizacion:x,pedidos_pagados:y.orders},null,2)}catch(e){o.textContent='Error: '+e.message}};\ndocument.querySelector('#list').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/paid-orders'),null,2)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#diag').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/diagnostic'),null,2)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#audit').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/webhook-audit'),null,2)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#cryptotest').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/crypto-test'),null,2)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#paymentCheck').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/payment-check','POST',{payment_id:document.querySelector('#paymentId').value.trim()}),null,2)}catch(e){o.textContent='Error: '+e.message}};\ndocument.querySelector('#reconcile').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/reconcile','POST',{payment_id:document.querySelector('#paymentId').value.trim()}),null,2)}catch(e){o.textContent='Error: '+e.message}};\n</script></html>";
const adminHtml = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Centro de Pedidos | Librería Saber · Pruebas</title>
<style>
*{box-sizing:border-box}body{font:15px system-ui,Arial,sans-serif;max-width:1020px;margin:25px auto;padding:16px;color:#17283d;background:#f6f8fb}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
h1{margin:0 0 6px;color:#163c73;font-size:1.55rem}.note{font-size:.87rem;color:#57677e}
fieldset{border:1px solid #d9e0ec;border-radius:12px;background:white;padding:16px;margin:16px 0}
input{font:inherit;padding:10px;max-width:100%;border:1px solid #aab6c5;border-radius:7px}
button{font:inherit;padding:10px 14px;background:#174b8f;color:white;border:0;border-radius:7px;cursor:pointer}
button:disabled{opacity:.5;cursor:default}.outline{color:#174b8f;background:white;border:1px solid #174b8f}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#status{min-height:1.5em;font-weight:600}.grid{display:grid;grid-template-columns:minmax(260px,1fr) minmax(280px,1.4fr);gap:16px}
ol{padding-left:22px}li{padding:12px 6px;border-bottom:1px solid #e5ebf3}li button{margin-top:7px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px ui-monospace,monospace;background:#f0f3f9;padding:12px;border-radius:6px;max-height:450px;overflow:auto}
@media(max-width:700px){.grid{grid-template-columns:1fr}}
</style></head><body>
<header><div><h1>Centro de Pedidos · Pruebas</h1><div class="note">Solo pagos completos aprobados · No está conectado al sitio público</div></div></header>
<fieldset><legend>Acceso privado</legend><div class="toolbar">
<input type="password" autocomplete="off" id="secret" placeholder="Clave privada del panel" aria-label="Clave privada">
<button id="refresh">Consultar pedidos</button><button id="sync" class="outline">Verificar pagos pendientes</button>
</div><p id="status" role="status" aria-live="polite"></p></fieldset>
<div class="grid"><fieldset><legend>Pedidos pagados</legend><ol id="orders"></ol></fieldset><fieldset><legend>Detalle del pedido</legend>
<div id="details">Seleccioná un pedido para ver sus datos y archivos referenciados.</div></fieldset></div>
<script>
const secret=document.querySelector("#secret"),status=document.querySelector("#status"),orders=document.querySelector("#orders"),details=document.querySelector("#details");
function money(n){return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n)||0)}
async function api(path,method="GET"){const r=await fetch(path,{method,headers:{"Authorization":"Bearer "+secret.value},cache:"no-store"});const x=await r.json().catch(()=>({}));if(!r.ok)throw Error(r.status===401?"Clave incorrecta":x.error||"Error "+r.status);return x}
function node(tag,txt){const x=document.createElement(tag);x.textContent=String(txt);return x}
async function showOrder(id){try{status.textContent="Consultando detalle...";const x=await api("/admin/api/order?id="+encodeURIComponent(id));details.replaceChildren();details.append(node("h3","Pedido "+x.order.id));details.append(node("p","Total: "+money(x.order.amount_ars)+" · Aprobado: "+(x.order.paid_at||"sin fecha")));if(!x.items.length){details.append(node("p","Este pedido de prueba anterior no tiene detalle de artículos guardado."))}
for(const i of x.items){details.append(node("h4",i.quantity+" × "+i.title+" — "+money(i.line_total_ars)));if(i.detail_json)details.append(node("pre",i.detail_json));if(i.file_references_json)details.append(node("pre","Archivos / referencias: "+i.file_references_json))}status.textContent=""}catch(e){status.textContent=e.message}}
async function refresh(){try{status.textContent="Consultando...";const x=await api("/admin/api/orders");orders.replaceChildren();if(!x.orders.length)orders.append(node("li","Aún no hay pedidos con pago total confirmado."));for(const o of x.orders){const li=node("li",o.description+" · "+money(o.amount_ars)+" · "+(o.paid_at||"sin fecha"));li.append(node("div",o.id));const b=node("button","Ver detalle");b.addEventListener("click",()=>showOrder(o.id));li.append(b);orders.append(li)}status.textContent=x.orders.length+" pedido(s) pagado(s) encontrado(s)"}catch(e){status.textContent=e.message}}
document.querySelector("#refresh").addEventListener("click",refresh);
document.querySelector("#sync").addEventListener("click",async()=>{try{status.textContent="Verificando pagos en Mercado Pago...";const x=await api("/demo/sync-pending","POST");await refresh();status.textContent+=" · Sincronizados: "+x.registered+" · Errores: "+x.errors}catch(e){status.textContent=e.message}});
</script></body></html>`;
async function reconcilePayment(env,paymentId){
 const pay=await mp(env,"/v1/payments/"+esc(paymentId));
 if(pay.status!=="approved"||pay.currency_id!=="ARS"||String(pay.collector_id)!==String(env.MP_TEST_SELLER_ID))return {registered:false,reason:"payment_checks"};
 const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(String(pay.external_reference||"")).first();
 if(!order||!order.preference_id||Number(pay.transaction_amount)!==Number(order.amount_ars)||Number(order.deposit_ars)!==Number(order.amount_ars))return {registered:false,reason:"order_checks"};
 if(!pay.order?.id)return {registered:false,reason:"merchant_order_missing"};
 const mo=await mp(env,"/merchant_orders/"+esc(String(pay.order.id)));
 if(String(mo.preference_id)!==String(order.preference_id)||String(mo.external_reference)!==String(order.id)||!mo.payments?.some(p=>String(p.id)===String(pay.id)&&p.status==="approved"))return {registered:false,reason:"merchant_order_checks"};
 // Exclusivo de la cuenta de vendedor de prueba; no se procesan cobros productivos.
 if(order.status==="paid")return {registered:true,alreadyRegistered:true};
 const res=await env.DB.prepare("UPDATE orders SET status='paid',payment_id=?,paid_at=datetime('now') WHERE id=? AND status='awaiting_payment' AND payment_id IS NULL").bind(String(pay.id),order.id).run();
 return {registered:Boolean(res.meta?.changes)};
}
async function syncPendingPayments(env){
 const pending=await env.DB.prepare("SELECT id FROM orders WHERE status='awaiting_payment' AND preference_id IS NOT NULL ORDER BY created_at DESC LIMIT 20").all();
 const summary={checked:0,registered:0,errors:0};
 for(const order of pending.results||[]){
  summary.checked++;
  try{
   const search=await mp(env,"/v1/payments/search?"+new URLSearchParams({external_reference:order.id,limit:"20",sort:"date_created",criteria:"desc"}));
   for(const payment of search.results||[]){
    if(payment.status!=="approved"||String(payment.external_reference||"")!==order.id)continue;
    const result=await reconcilePayment(env,String(payment.id));
    if(result.registered){if(!result.alreadyRegistered)summary.registered++;break}
   }
  }catch(e){summary.errors++;console.error("Pending payment verification failed",order.id,String(e?.message||"error").slice(0,100))}
 }
 if(summary.registered||summary.errors)await audit(env,"payment_sync",JSON.stringify(summary));
 return summary;
}
async function ensureOrderItems(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS order_items (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,line_number INTEGER NOT NULL CHECK(line_number>=1 AND line_number<=100),item_type TEXT NOT NULL CHECK(item_type IN ('product','print')),sku TEXT,title TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),unit_price_ars INTEGER NOT NULL CHECK(unit_price_ars>0),line_total_ars INTEGER NOT NULL CHECK(line_total_ars>0),detail_json TEXT NOT NULL DEFAULT '{}',file_references_json TEXT NOT NULL DEFAULT '[]',PRIMARY KEY(order_id,line_number))").run();
}
async function audit(env,event,detail){
 try{
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS webhook_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), event TEXT NOT NULL, detail TEXT NOT NULL)").run();
  await env.DB.prepare("INSERT INTO webhook_audit(event,detail) VALUES(?,?)").bind(event,detail).run();
 }catch(e){console.error("Webhook audit failed",e?.message||"unknown")}
}
export default {
 async scheduled(event,env,ctx){
  ctx.waitUntil(syncPendingPayments(env).catch(e=>console.error("Scheduled payment sync failed",e?.message||"unknown")));
 },
 async fetch(req,env){
  const url=new URL(req.url);
  if(url.pathname==="/demo"&&req.method==="GET")return new Response(demoHtml,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
  if(url.pathname==="/admin"&&req.method==="GET")return new Response(adminHtml,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex,nofollow","x-content-type-options":"nosniff"}});
  if(url.pathname==="/health"&&req.method==="GET"){
   const configured=Boolean(env.DB&&env.MP_TEST_ACCESS_TOKEN&&env.DEMO_ADMIN_KEY&&env.MP_TEST_SELLER_ID&&env.TEST_WEBHOOK_URL&&env.MP_WEBHOOK_SECRET);
   let databaseReady=false;
   if(env.DB){try{const r=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").first();databaseReady=r?.name==="orders"}catch{}}
   return json({ok:true,environment:"test",configured,databaseReady,paymentsEnabled:false});
  }
  if(url.pathname==="/demo/crypto-test"&&req.method==="GET"){
   if(!tokenOK(req,env))return json({error:"No autorizado"},401);
   if(!env.MP_WEBHOOK_SECRET)return json({cryptoSelfTest:false,reason:"Secret no configurado"},503);
   const ts=String(Math.floor(Date.now()/1000));
   const id="123456", requestId="test-local-no-network";
   const manifest="id:"+id+";request-id:"+requestId+";ts:"+ts+";";
   const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.MP_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
   const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(manifest)));
   const hex=Array.from(sig,v=>v.toString(16).padStart(2,"0")).join("");
   const mock=new Request("https://local.invalid/webhooks/mercadopago?data.id="+id,{headers:{"x-request-id":requestId,"x-signature":"ts="+ts+",v1="+hex}});
   const ok=await verifySignature(mock,new URL(mock.url),env.MP_WEBHOOK_SECRET);
   return json({cryptoSelfTest:ok,note:"Ensayo local, no prueba la coincidencia de la clave de Mercado Pago."});
  }
  if(url.pathname==="/demo/diagnostic"&&req.method==="GET"){
   if(!tokenOK(req,env))return json({error:"La clave de acceso del demo no coincide con DEMO_ADMIN_KEY en Cloudflare. No ingreses el nombre de la variable."},401);
   const required=["DB","MP_TEST_ACCESS_TOKEN","DEMO_ADMIN_KEY","MP_TEST_SELLER_ID","TEST_WEBHOOK_URL","MP_WEBHOOK_SECRET"];
   const missing=required.filter(k=>!env[k]);
   let table=false;
   if(env.DB){try{table=Boolean(await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orders'").first())}catch{}}
   return json({ok:missing.length===0&&table,missing,ordersTableReady:table});
  }
  if(!env.DB || !env.MP_TEST_ACCESS_TOKEN || !env.DEMO_ADMIN_KEY || !env.MP_TEST_SELLER_ID || !env.TEST_WEBHOOK_URL)return json({error:"Falta configuración privada de pruebas. Consultar diagnóstico autorizado."},503);
  try {
   // Solo un operador que conoce DEMO_ADMIN_KEY puede preparar un pedido ficticio.
   if(url.pathname==="/admin/api/orders"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const rows=await env.DB.prepare("SELECT id,description,amount_ars,status,paid_at,created_at FROM orders WHERE status='paid' AND deposit_ars=amount_ars ORDER BY paid_at DESC LIMIT 100").all();
    return json({orders:rows.results});
   }
   if(url.pathname==="/admin/api/order"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const id=url.searchParams.get("id")||"";
    if(!/^[a-f0-9-]{36}$/i.test(id))return json({error:"ID de pedido inválido"},400);
    const order=await env.DB.prepare("SELECT id,description,amount_ars,status,paid_at,created_at,payment_id FROM orders WHERE id=? AND status='paid' AND deposit_ars=amount_ars").bind(id).first();
    if(!order)return json({error:"Pedido pagado no encontrado"},404);
    await ensureOrderItems(env);
    const rows=await env.DB.prepare("SELECT line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json FROM order_items WHERE order_id=? ORDER BY line_number").bind(id).all();
    return json({order,items:rows.results});
   }
   if(url.pathname==="/demo/order"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"La clave de acceso del demo no coincide con DEMO_ADMIN_KEY en Cloudflare. No ingreses el nombre de la variable."},401);
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)").bind(id,"Pedido ficticio de prueba",10000,10000).run();
    return json({id,total:10000,amount_to_pay:10000},201);
   }
   if(url.pathname==="/demo/checkout"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"La clave de acceso del demo no coincide con DEMO_ADMIN_KEY en Cloudflare. No ingreses el nombre de la variable."},401);
    const {order_id}=await req.json();
    if(typeof order_id!=="string")return json({error:"order_id inválido"},400);
    const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(order_id).first();
    if(!order)return json({error:"Pedido no encontrado"},404);
    if(order.status!=="awaiting_payment")return json({error:"El pedido ya está pago"},409);
    if(order.preference_id)return json({error:"Ya existe una preferencia para este pedido; reutilizarla o revisar su estado"},409);
    const preference=await mp(env,"/checkout/preferences",{method:"POST",headers:{"X-Idempotency-Key":order.id},body:JSON.stringify({
      items:[{id:order.id,title:"Pago total - Pedido de prueba Librería Saber",quantity:1,currency_id:"ARS",unit_price:order.deposit_ars}],
      external_reference:order.id,
      // El webhook se configura desde Mercado Pago Developers (modo de prueba).
      metadata:{purpose:"libreria_saber_demo"}
    })});
    await env.DB.prepare("UPDATE orders SET preference_id=? WHERE id=? AND preference_id IS NULL AND status='awaiting_payment'").bind(preference.id,order.id).run();
    return json({order_id:order.id,checkout_url:preference.sandbox_init_point || preference.init_point,preference_id:preference.id});
   }
   if(url.pathname==="/webhooks/mercadopago"&&req.method==="POST"){
    const valid=await verifySignature(req,url,env.MP_WEBHOOK_SECRET);
    if(!valid){
      const hdr=req.headers.get("x-signature")||"";
      const detail=JSON.stringify({
        signatureHeader:hdr.includes("v1="),
        requestIdHeader:Boolean(req.headers.get("x-request-id")),
        queryDataId:Boolean(url.searchParams.get("data.id")),
        queryId:Boolean(url.searchParams.get("id")),
        queryType:url.searchParams.get("type")||null,
        secretConfigured:Boolean(env.MP_WEBHOOK_SECRET),secretHasWhitespace:typeof env.MP_WEBHOOK_SECRET==="string"&&env.MP_WEBHOOK_SECRET!==env.MP_WEBHOOK_SECRET.trim(),timestampPresent:Boolean((req.headers.get("x-signature")||"").includes("ts=")),timestampDigits:((hdr.split(",").map(v=>v.trim()).find(v=>v.startsWith("ts="))||"").split("=")[1]||"").length,signatureV1Format:/v1=[a-f0-9]{64}/i.test(hdr),idDigits:(url.searchParams.get("data.id")||"").length,hasValidTsFormat:/^[0-9]{9,16}$/.test((hdr.split(",").map(v=>v.trim()).find(v=>v.startsWith("ts="))||"").split("=")[1]||"")
      });
      await audit(env,"rejected_signature",detail.slice(0,400));
      return json({error:"Notificación no autenticada"},401)
    }
    const message=await req.json().catch(()=>({}));
    const paymentId=url.searchParams.get("data.id");
    const kind=message.type||message.topic||url.searchParams.get("type");
    if(kind!=="payment"||!/^[0-9]{1,30}$/.test(String(paymentId||""))){await audit(env,"ignored_event",String(kind||"unknown").slice(0,64));return json({received:true})}
    try{
      const result=await reconcilePayment(env,String(paymentId));
      await audit(env,result.registered?"payment_registered":"payment_ignored",String(result.reason||"verified").slice(0,64));
      return json({received:true,...result});
    }catch(error){await audit(env,"payment_error","API or D1 verification failed");throw error}
   }
   if(url.pathname==="/demo/webhook-audit"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    try{const rows=await env.DB.prepare("SELECT created_at,event,detail FROM webhook_audit ORDER BY id DESC LIMIT 25").all();return json({events:rows.results})}
    catch{return json({events:[],note:"Aún no hay eventos auditados"})}
   }
   if(url.pathname==="/demo/reconcile"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const body=await req.json().catch(()=>({}));
    if(!/^[0-9]{1,30}$/.test(String(body.payment_id||"")))return json({error:"ID inválido"},400);
    return json(await reconcilePayment(env,String(body.payment_id)));
   }
   if(url.pathname==="/demo/payment-check"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const body=await req.json().catch(()=>({}));
    if(!/^[0-9]{1,30}$/.test(String(body.payment_id||"")))return json({error:"Identificador de pago inválido"},400);
    const pay=await mp(env,"/v1/payments/"+esc(String(body.payment_id)));
    const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(String(pay.external_reference||"")).first();
    let merchantOrder=null,merchantOrderError=null;
    if(pay.order?.id){
      try{merchantOrder=await mp(env,"/merchant_orders/"+esc(String(pay.order.id)))}
      catch{merchantOrderError="No se pudo consultar la orden comercial"}
    }
    const checks={
      approved:pay.status==="approved",
      paymentLiveModeFalse:pay.live_mode===false,
      currency:pay.currency_id==="ARS",
      orderExists:Boolean(order),
      paymentPreferenceMatches:Boolean(order&&pay.preference_id&&String(pay.preference_id)===String(order.preference_id)),
      merchantOrderPreferenceMatches:Boolean(order&&merchantOrder&&String(merchantOrder.preference_id)===String(order.preference_id)),
      merchantOrderReferencesPedido:Boolean(order&&merchantOrder&&String(merchantOrder.external_reference)===String(order.id)),
      merchantOrderContainsPayment:Boolean(merchantOrder?.payments?.some(p=>String(p.id)===String(pay.id))),
      amountMatches:Boolean(order&&Number(pay.transaction_amount)===order.deposit_ars),
      sellerMatches:String(pay.collector_id)===String(env.MP_TEST_SELLER_ID)
    };
    return json({checks,paymentPreferencePresent:Boolean(pay.preference_id),merchantOrderPresent:Boolean(merchantOrder),merchantOrderError,orderStatus:order?.status||null,note:"Solo diagnóstico: no altera el estado del pedido."});
   }
   if(url.pathname==="/demo/sync-pending"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    return json(await syncPendingPayments(env));
   }
   if(url.pathname==="/demo/paid-orders"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"La clave de acceso del demo no coincide con DEMO_ADMIN_KEY en Cloudflare. No ingreses el nombre de la variable."},401);
    const rows=await env.DB.prepare("SELECT id,description,amount_ars,deposit_ars,status,paid_at FROM orders WHERE status='paid' ORDER BY paid_at DESC LIMIT 100").all();
    return json({orders:rows.results});
   }
   return json({error:"No encontrado"},404);
  }catch(e){return json({error:"Error de integración; consultar registros privados"},502)}
 }
};
