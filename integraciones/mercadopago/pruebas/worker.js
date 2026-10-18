// Librería Saber: integración AISLADA para Checkout Pro de Mercado Pago.
// No desplegar ni agregar secretos reales hasta revisar y aprobar la prueba.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const esc=s=>encodeURIComponent(s);
const tokenOK=(req,env)=>{const expected=env.DEMO_ADMIN_KEY;if(!expected)return false;return req.headers.get("Authorization")==="Bearer "+expected};
async function mp(env,path,opts={}){
 const r=await fetch("https://api.mercadopago.com"+path,{...opts,headers:{Authorization:"Bearer "+env.MP_TEST_ACCESS_TOKEN,"Content-Type":"application/json",...(opts.headers||{})}});
 const t=await r.text();let data;try{data=JSON.parse(t)}catch{data={message:"Respuesta inválida de Mercado Pago"}}
 if(!r.ok)throw Error("Mercado Pago respondió "+r.status+" "+String(data.message||""));
 return data;
}
async function verifySignature(req,url,secret){
 if(!secret)return false;
 const hdr=req.headers.get("x-signature")||"", requestId=req.headers.get("x-request-id")||"";
 const parts=Object.fromEntries(hdr.split(",").map(p=>p.trim().split("=")));
 const ts=parts.ts, hex=parts.v1;
 const id=url.searchParams.get("data.id");
 if(!requestId||!ts||!/^\\d{9,16}$/.test(ts)||!id||!/^[a-f0-9]{64}$/i.test(hex||""))return false;
 const manifest="id:"+id.toLowerCase()+";request-id:"+requestId+";ts:"+ts+";";
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(manifest));
 const digest=Array.from(new Uint8Array(signed),v=>v.toString(16).padStart(2,"0")).join("");
 let mismatch=0;for(let i=0;i<64;i++)mismatch|=digest.charCodeAt(i)^hex.toLowerCase().charCodeAt(i);
 return mismatch===0;
}
export default {
 async fetch(req,env){
  const url=new URL(req.url);
  if(url.pathname==="/health"&&req.method==="GET")return json({ok:true,environment:"test",payments:"TEST_ONLY_SIGNATURE_REQUIRED"});
  if(!env.DB || !env.MP_TEST_ACCESS_TOKEN || !env.DEMO_ADMIN_KEY || !env.MP_TEST_SELLER_ID || !env.TEST_WEBHOOK_URL)return json({error:"Falta configuración privada de pruebas"},503);
  try {
   // Solo un operador que conoce DEMO_ADMIN_KEY puede preparar un pedido ficticio.
   if(url.pathname==="/demo/order"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)").bind(id,"Pedido ficticio de prueba",10000,5000).run();
    return json({id,total:10000,deposit:5000},201);
   }
   if(url.pathname==="/demo/checkout"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const {order_id}=await req.json();
    if(typeof order_id!=="string")return json({error:"order_id inválido"},400);
    const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(order_id).first();
    if(!order)return json({error:"Pedido no encontrado"},404);
    if(order.status!=="awaiting_payment")return json({error:"El pedido ya está pago"},409);
    if(order.preference_id)return json({error:"Ya existe una preferencia para este pedido; reutilizarla o revisar su estado"},409);
    const preference=await mp(env,"/checkout/preferences",{method:"POST",headers:{"X-Idempotency-Key":order.id},body:JSON.stringify({
      items:[{id:order.id,title:"Seña - Pedido de prueba Librería Saber",quantity:1,currency_id:"ARS",unit_price:order.deposit_ars}],
      external_reference:order.id,
      notification_url:env.TEST_WEBHOOK_URL,
      metadata:{purpose:"libreria_saber_demo"}
    })});
    await env.DB.prepare("UPDATE orders SET preference_id=? WHERE id=? AND preference_id IS NULL AND status='awaiting_payment'").bind(preference.id,order.id).run();
    return json({order_id:order.id,checkout_url:preference.sandbox_init_point || preference.init_point,preference_id:preference.id});
   }
   if(url.pathname==="/webhooks/mercadopago"&&req.method==="POST"){
    // Fallar cerrado: sin firma válida no se consulta ni confirma ningún pago.\n    if(!await verifySignature(req,url,env.MP_WEBHOOK_SECRET))return json({error:"Notificación no autenticada"},401);\n    // La firma valida el origen; la API verifica el estado y el importe.
    const message=await req.json().catch(()=>({}));
    const paymentId=url.searchParams.get("data.id");
    const kind=message.type||message.topic||url.searchParams.get("type");
    if(kind!=="payment" || !/^[0-9]{1,30}$/.test(String(paymentId||"")))return json({received:true});
    const pay=await mp(env,"/v1/payments/"+esc(String(paymentId)));
    if(pay.status!=="approved" || pay.currency_id!=="ARS" || pay.live_mode!==false)return json({received:true,registered:false});
    const orderId=String(pay.external_reference||"");
    const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first();
    if(!order || !order.preference_id)return json({received:true,registered:false});
    // El importe, preferencia y cuenta receptora deben corresponder exactamente al pedido.
    if(String(pay.preference_id)!==order.preference_id || Number(pay.transaction_amount)!==order.deposit_ars || String(pay.collector_id)!==String(env.MP_TEST_SELLER_ID))
      return json({received:true,registered:false});
    await env.DB.prepare("UPDATE orders SET status='paid',payment_id=?,paid_at=datetime('now') WHERE id=? AND status='awaiting_payment' AND payment_id IS NULL").bind(String(paymentId),orderId).run();
    return json({received:true});
   }
   if(url.pathname==="/demo/paid-orders"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const rows=await env.DB.prepare("SELECT id,description,amount_ars,deposit_ars,status,paid_at FROM orders WHERE status='paid' ORDER BY paid_at DESC LIMIT 100").all();
    return json({orders:rows.results});
   }
   return json({error:"No encontrado"},404);
  }catch(e){return json({error:"Error de integración; consultar registros privados"},502)}
 }
};
