// BEGIN POLAROID DEMO HTML
const polaroidDemoHtml="<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><meta name=\"referrer\" content=\"no-referrer\"><title>Polaroids y pago total | Ensayo privado</title>\n<style>*{box-sizing:border-box}body{font:16px system-ui;color:#173b68;background:#f6f8fb;max-width:850px;margin:28px auto;padding:18px}section{background:white;border:1px solid #dce3ed;padding:20px;border-radius:12px;margin:18px 0}input,button{font:inherit;padding:11px;margin:5px 4px 5px 0;max-width:100%}button{background:#174b8f;color:white;border:0;border-radius:8px;cursor:pointer}button:disabled{opacity:.5}label{display:block;margin-top:10px}#message{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}a{color:#174b8f}small{display:block;line-height:1.6;color:#53657b}</style></head>\n<body><h1>Polaroids + pago total · Pruebas</h1><p>Ensayo privado con fotos en Google Drive. Sin conexión a la tienda pública.</p>\n<section><h2>1. Acceso del operador</h2><label>Clave privada del demo <input type=\"password\" id=\"key\" autocomplete=\"off\"></label><small>Se usa únicamente en esta pestaña. No ingresar tokens de Mercado Pago.</small></section>\n<section><h2>2. Fotografías</h2><button id=\"photos\">Abrir editor de Polaroids de pruebas</button><p id=\"receipt\">Todavía no hay fotos verificadas para este ensayo.</p><small>En el editor podés cargar las seis fotos de demostración y enviarlas. Conservá abiertas ambas pestañas hasta confirmar la recepción. La clave temporal de subida se elimina del mensaje una vez verificada; no se guarda ni se imprime.</small></section>\n<section><h2>3. Carrito y Mercado Pago</h2><label>Artículo opcional del catálogo <input id=\"code\" placeholder=\"Ej.: ESC001; vacío para solo Polaroids\"></label><label>Cantidad del artículo <input type=\"number\" id=\"qty\" value=\"1\" min=\"1\" max=\"500\"></label><button id=\"prepare\" disabled>Preparar pedido y enlace de pago total</button><p id=\"message\" role=\"status\" aria-live=\"polite\"></p><p id=\"payment\"></p></section>\n<p><a href=\"/admin\" target=\"_blank\" rel=\"noopener\">Abrir Centro de Pedidos privado</a></p>\n<script>\nconst $=id=>document.getElementById(id),pilot='https://polaroids-integracion-sin-r2.libreriasaber.pages.dev';\nconst clientOrderId=crypto.randomUUID(),nonce=crypto.randomUUID();let popup,proof=null,working=false;\nasync function api(path,body){const key=$('key').value;if(!key)throw Error('Ingresá la clave privada del demo.');\n const r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});\n const data=await r.json();if(!r.ok)throw Error(data.error||'Error '+r.status);return data;}\n$('photos').onclick=async()=>{if(working||proof)return;\n try{\n  // Abrir durante el gesto del usuario para evitar que el navegador bloquee el popup.\n  if(!$('key').value)throw Error('Ingresá la clave privada del demo.');\n  popup=window.open('about:blank','saber-polaroid-'+nonce);\n  if(!popup)throw Error('Permití abrir la pestaña del editor para continuar.');\n  const check=await api('/demo/diagnostic');if(!check.ok)throw Error('Revisá la configuración del entorno de pruebas.');\n  popup.location=pilot+'/pruebas/polaroids/editor.html?pagosNonce='+encodeURIComponent(nonce);\n  $('message').textContent='Completá y enviá las fotos en la pestaña del editor.';\n }catch(e){if(popup)popup.close();$('message').textContent=e.message;}\n};\nwindow.addEventListener('message',async event=>{\n if(event.origin!==pilot||event.source!==popup||event.data?.type!=='SABER_PAYMENT_RECEIPT'||event.data?.nonce!==nonce)return;\n const msg=event.data;let reply;\n try{\n  if(working)throw Error('Hay otra operación en curso. Reintentá al terminar.');\n  working=true;$('message').textContent='Verificando la recepción en Google desde el servidor…';\n  proof=await api('/demo/polaroid-proof-pilot',{reference:msg.reference,uploadKey:msg.uploadKey,client_order_id:clientOrderId});\n  $('receipt').textContent=proof.photos+' fotos · '+proof.sheets+' hoja(s) A4 · $ '+proof.total_ars.toLocaleString('es-AR')+' · '+proof.reference;\n  $('prepare').disabled=false;$('photos').disabled=true;$('message').textContent='Recepción verificada. Ya podés preparar el pago total.';reply={ok:true};\n }catch(e){$('message').textContent=e.message;reply={ok:false,error:e.message}}\n finally{delete msg.uploadKey;working=false}\n popup.postMessage({type:'SABER_PAYMENT_PROOF_RESULT',nonce,...reply},pilot);\n});\n$('prepare').onclick=async()=>{\n if(working||!proof)return;working=true;$('prepare').disabled=true;$('payment').replaceChildren();\n try{\n  const items=[{type:'print',code:'POLAROID_A4',qty:1,proof_token:proof.proof_token}];\n  const code=$('code').value.trim(),qty=Number($('qty').value);\n  if(code){if(!Number.isSafeInteger(qty)||qty<1||qty>500)throw Error('Cantidad inválida.');items.push({type:'product',code,qty})}\n  const order=await api('/demo/cart-order',{schema:'saber-cart-v1',currency:'ARS',paymentMode:'FULL',client_order_id:clientOrderId,items});\n  $('code').disabled=true;$('qty').disabled=true;\n  $('message').textContent='Pedido '+order.order_id+' · Total validado: $ '+order.total_ars.toLocaleString('es-AR')+'.';\n  if(order.paid){$('message').textContent+=' Pago ya confirmado.';return;}\n  const pay=await api('/demo/checkout',{order_id:order.order_id});const url=new URL(pay.checkout_url);\n  if(url.protocol!=='https:'||!/(^|\\.)(mercadopago\\.com|mercadopago\\.com\\.ar)$/.test(url.hostname))throw Error('Enlace de pago inválido.');\n  const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir Mercado Pago de prueba';$('payment').append(link);\n  $('message').textContent+=' Todavía sin cobrar. Usá únicamente el comprador y medio de pago de pruebas.';\n }catch(e){$('message').textContent=e.message}finally{working=false;$('prepare').disabled=false}\n};\n</script></body></html>\n";
// END POLAROID DEMO HTML
// Librería Saber: integración AISLADA para Checkout Pro de Mercado Pago.
// No desplegar ni agregar secretos reales hasta revisar y aprobar la prueba.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const esc=s=>encodeURIComponent(s);
const tokenOK=(req,env)=>{const expected=env.DEMO_ADMIN_KEY;if(typeof expected!=="string"||!expected)return false;const actual=req.headers.get("Authorization")||"";return actual.startsWith("Bearer ") && actual.slice(7).trim()===expected.trim()};
async function mp(env,path,opts={}){
 const r=await fetch("https://api.mercadopago.com"+path,{signal:AbortSignal.timeout(15000),...opts,headers:{Authorization:"Bearer "+env.MP_TEST_ACCESS_TOKEN,"Content-Type":"application/json",...(opts.headers||{})}});
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
 if(!id||!requestId||!ts||!/^[0-9]{10,13}$/.test(ts)||!/^[a-fA-F0-9]{64}$/.test(supplied||""))return false;
 const timestamp=Number(ts)*(ts.length===13?1:1000);
 if(Math.abs(Date.now()-timestamp)>15*60*1000)return false;
 const manifest=(id?"id:"+id.toLowerCase()+";":"")+(requestId?"request-id:"+requestId+";":"")+"ts:"+ts+";";
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const result=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(manifest)));
 const received=new Uint8Array(32);
 for(let i=0;i<32;i++)received[i]=parseInt(supplied.slice(i*2,i*2+2),16);
 let mismatch=0;for(let i=0;i<32;i++)mismatch|=result[i]^received[i];
 return mismatch===0;
}
const demoHtml="<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Saber pagos prueba</title><style>body{font:16px system-ui;max-width:650px;margin:35px auto;padding:18px}input{padding:10px;width:95%}button{padding:12px;margin:8px 3px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h2>Librería Saber | Prueba de pagos</h2><p>Solo pruebas: pedido $10.000, pago total $10.000. No introduzcas tokens de Mercado Pago.</p><input type=\"password\" id=\"key\" placeholder=\"Clave del demo (no se guarda)\"><p><button id=\"start\">Crear pedido y preparar pago</button><button id=\"catalog\">Ver artículos del catálogo</button><p><input id=\"catalogCode\" placeholder=\"Código del artículo de prueba\"><button id=\"cartOrder\">Preparar carrito del artículo (sin cobrar)</button></p><button id=\"sync\">Actualizar pedidos pagados</button><button id=\"list\">Consultar pagos aprobados</button><button id=\"diag\">Diagnosticar configuración</button><button id=\"audit\">Ver eventos automáticos</button><button id=\"cryptotest\">Probar verificador HMAC</button><p><input id=\"paymentId\" inputmode=\"numeric\" placeholder=\"Número de operación de prueba\"><button id=\"paymentCheck\">Analizar pago de prueba</button><button id=\"reconcile\">Verificar y registrar pago aprobado</button></p></p><pre id=\"output\"></pre><script>\nconst o=document.querySelector('#output');\nasync function api(p,m='GET',b){const r=await fetch(p,{method:m,headers:{'Authorization':'Bearer '+document.querySelector('#key').value,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||r.status);return d}\ndocument.querySelector('#start').onclick=async()=>{try{o.textContent='Preparando...';const x=await api('/demo/order','POST');const y=await api('/demo/checkout','POST',{order_id:x.id});o.textContent='Pedido '+x.id+' creado. ';const a=document.createElement('a');a.href=y.checkout_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir pago de prueba';o.append(a)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#catalog').onclick=async()=>{try{const r=await api('/demo/catalog');o.textContent=JSON.stringify(r,null,2)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#cartOrder').onclick=async()=>{try{const code=document.querySelector('#catalogCode').value.trim();if(!code)throw Error('Ingresá un código del catálogo');const b={client_order_id:crypto.randomUUID(),schema:'saber-cart-v1',currency:'ARS',paymentMode:'FULL',items:[{type:'product',code,qty:1}]};const x=await api('/demo/cart-order','POST',b);o.textContent='Importe validado $'+x.total_ars+'. Pedido: '+x.order_id+'. Sin cobro aún. ';const y=await api('/demo/checkout','POST',{order_id:x.order_id});const a=document.createElement('a');a.href=y.checkout_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir Mercado Pago de prueba';o.append(a)}catch(e){o.textContent='Error: '+e.message}};\ndocument.querySelector('#sync').onclick=async()=>{try{o.textContent='Consultando pagos pendientes...';const x=await api('/demo/sync-pending','POST');const y=await api('/demo/paid-orders');o.textContent=JSON.stringify({sincronizacion:x,pedidos_pagados:y.orders},null,2)}catch(e){o.textContent='Error: '+e.message}};\ndocument.querySelector('#list').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/paid-orders'),null,2)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#diag').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/diagnostic'),null,2)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#audit').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/webhook-audit'),null,2)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#cryptotest').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/crypto-test'),null,2)}catch(e){o.textContent=e.message}};\ndocument.querySelector('#paymentCheck').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/payment-check','POST',{payment_id:document.querySelector('#paymentId').value.trim()}),null,2)}catch(e){o.textContent='Error: '+e.message}};\ndocument.querySelector('#reconcile').onclick=async()=>{try{o.textContent=JSON.stringify(await api('/demo/reconcile','POST',{payment_id:document.querySelector('#paymentId').value.trim()}),null,2)}catch(e){o.textContent='Error: '+e.message}};\n</script></html>";
/** The private central distinguishes approved payment from print production clearance.
 * Payment+rows originate from protected D1 reads, NEVER from a browser cart.
 */
function estadoProduccionPrivado(order,items){
 const pagado=order?.status==="paid"&&Number.isSafeInteger(order.amount_ars)&&order.amount_ars>0&&order.deposit_ars===order.amount_ars&&Boolean(order.paid_at);
 const lineas=Array.isArray(items)?items:[];
 const sum=lineas.reduce((n,x)=>n+Number(x.line_total_ars||0),0);
 const coherente=lineas.length>0&&lineas.length<=100&&lineas.every((x,i)=>
  Number.isSafeInteger(x.line_number)&&x.line_number===i+1&&
  ["print","product"].includes(x.item_type)&&Number.isSafeInteger(x.quantity)&&x.quantity>0&&
  Number.isSafeInteger(x.unit_price_ars)&&x.unit_price_ars>0&&
  Number.isSafeInteger(x.line_total_ars)&&x.line_total_ars===x.quantity*x.unit_price_ars
 )&&Number.isSafeInteger(sum)&&sum===order?.amount_ars;
 const trabajos=lineas.map(x=>{
  const producto=x.item_type==="product",polaroid=x.sku==="POLAROID_A4";
  const etapa=producto?"VERIFICAR_STOCK":polaroid?"VERIFICAR_PDF_POLAROIDS":"VERIFICAR_ARCHIVOS_IMPRESION";
  const instruccion=producto?"Comprobar existencia y preparar el artículo":
   polaroid?"Confirmar el PDF final y las fotos recibidas en Drive privado":
   "Revisar recibos, archivo original, medidas y PDF imprimible en Drive privado";
  let refs=[],especificaciones={};
  try{const val=JSON.parse(x.file_references_json||"[]");
   if(Array.isArray(val)&&val.length<=30&&val.every(r=>typeof r==="string"&&/^[A-Za-z0-9_-]{3,100}$/.test(r)))refs=val;
  }catch(_){}
  try{const obj=JSON.parse(x.detail_json||"{}");
   if(obj&&typeof obj==="object"&&!Array.isArray(obj)){
    for(const k of ["photos","sheets","format","size","mode","copies","pages","paper","binding"]){
     if((typeof obj[k]==="string"&&obj[k].length<=100)||Number.isSafeInteger(obj[k]))especificaciones[k]=obj[k];
    }
   }
  }catch(_){}
  return {linea:x.line_number,tipo:producto?"articulo":"impresion",
   sku:String(x.sku||"").slice(0,80),descripcion:String(x.title||"").slice(0,180),
   cantidad:x.quantity,subtotal:x.line_total_ars,referencias:refs,especificaciones,
   etapa,instruccion,archivoVerificadoParaProduccion:false};
 });
 return {estado:!pagado?"PAGO_NO_CONFIRMADO":!coherente?"REVISAR_DESGLOSE":"PAGADO_PENDIENTE_PREPARACION",
  pagoConfirmado:pagado,desgloseCoherente:coherente,
  listoParaProducir:false,archivosCompletosParaProduccion:false,
  pendienteDeComprobar:trabajos.length,trabajos,
  mensaje:!pagado?"No liberar pedido sin pago aprobado":
   !coherente?"Revisar renglones e importe antes de preparar":
   "Pago confirmado: comprobar archivos PDF finales y/o existencias antes de producir."};
}

/**
 * Central D1: recibe SOLO resúmenes de archivos verificados, firmados por el
 * servidor de documentos. No interpreta un pago como permiso de producción.
 */
const CENTRAL_WEB=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const CENTRAL_UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CENTRAL_RECEIPT=/^DOC-[a-f0-9-]{36}$/i;
const CENTRAL_HEX=/^[a-f0-9]{64}$/;
const CENTRAL_FILE=/^[A-Za-z0-9_-]{1,80}$/;
const CENTRAL_TYPES=new Set(["documentos","ploteos","stickers","fotos","corte","grafica"]);
async function centralHash(input){
 const bytes=new TextEncoder().encode(input);
 return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),
  x=>x.toString(16).padStart(2,"0")).join("");
}
function centralSafeManifest(data){
 if(!data||data.schema!=="saber-central-recepcion-verificada-v1"||
    !CENTRAL_WEB.test(data.orderId||"")||data.paymentAuthorized!==false||
    data.filesReceived!==true||data.listoParaProducir!==false||
    !Number.isSafeInteger(data.importeVerificado)||data.importeVerificado<1||
    data.importeVerificado>50000000||!Array.isArray(data.recibos)||
    data.recibos.length<1||data.recibos.length>30||!data.ficha||
    data.ficha.schema!=="saber-central-ficha-produccion-v1"||
    data.ficha.orderId!==data.orderId||data.ficha.pagoConfirmado!==false||
    data.ficha.listoParaProducir!==false||
    data.ficha.totalVerificadoSinPago!==data.importeVerificado||
    !Array.isArray(data.ficha.trabajos)||
    data.ficha.trabajos.length!==data.recibos.length)
  throw Error("Manifiesto de recepción incompleto o sin comprobación");
 const seenReceipts=new Set(),seenFiles=new Set(),seenWork=new Set(),seenIndices=new Set();
 const recibos=new Map();
 for(const r of data.recibos){
  if(!r||!CENTRAL_FILE.test(r.fileId||"")||seenFiles.has(r.fileId)||
     !CENTRAL_RECEIPT.test(r.receiptId||"")||seenReceipts.has(r.receiptId)||
     !CENTRAL_HEX.test(r.sha256||"")||
     !Number.isSafeInteger(r.bytes)||r.bytes<5||r.bytes>20*1024*1024||
     !Number.isSafeInteger(r.pages)||r.pages<1||r.pages>2000)
   throw Error("Recibo privado inválido");
  seenFiles.add(r.fileId);seenReceipts.add(r.receiptId);recibos.set(r.fileId,r);
 }
 const trabajos=data.ficha.trabajos.map(w=>{
  if(!w||!Number.isSafeInteger(w.orden)||w.orden<1||
     w.orden>data.recibos.length||seenIndices.has(w.orden)||
     typeof w.idTrabajo!=="string"||w.idTrabajo.length>80||
     seenWork.has(w.idTrabajo)||!CENTRAL_TYPES.has(w.servicio)||
     !CENTRAL_FILE.test(w.fileId||"")||typeof w.nombreOriginal!=="string"||
     w.nombreOriginal.length<1||w.nombreOriginal.length>180||
     w.pdfImprimibleVerificado!==false||w.descargaPrivadaHabilitada!==false)
   throw Error("Trabajo no identificado o marcado como imprimible");
  seenIndices.add(w.orden);seenWork.add(w.idTrabajo);
  const r=recibos.get(w.fileId);
  if(!r||w.reciboPrivado!==r.receiptId||w.sha256!==r.sha256||
     w.paginasOriginales!==r.pages||!Array.isArray(w.paginasElegidas)||
     w.paginasElegidas.length<1||w.paginasElegidas.length>2000||
     w.paginasElegidas.some(n=>!Number.isSafeInteger(n)||n<1||n>r.pages)||
     new Set(w.paginasElegidas).size!==w.paginasElegidas.length)
   throw Error("Archivo sin correspondencia con la ficha");
  const texto=(s,max=100)=>typeof s==="string"&&s.length<=max?s:null;
  const copies=w.copias;
  if(copies!==null&&copies!==undefined&&(!Number.isSafeInteger(copies)||copies<1||copies>500))
   throw Error("Cantidad de trabajo inválida");
  return {
   orden:w.orden,idTrabajo:w.idTrabajo,servicio:w.servicio,
   nombreOriginal:w.nombreOriginal,fileId:w.fileId,
   reciboPrivado:r.receiptId,sha256:r.sha256,paginasOriginales:r.pages,
   bytes:r.bytes,paginasElegidas:[...w.paginasElegidas],
   copias:copies??null,formatoFinal:texto(w.formatoFinal),
   material:texto(w.material),modo:texto(w.modo),productoId:texto(w.productoId),
   variante:texto(w.variante),metros:Number.isFinite(w.metros)&&w.metros>0?w.metros:null,
   descripcion:texto(w.descripcion,180),archivoFinalVerificado:false
  };
 }).sort((a,b)=>a.orden-b.orden);
 return {schema:"saber-central-documentos-d1-v1",webOrderId:data.orderId,
  importe: data.importeVerificado,archivos:trabajos.length,
  estado:"DOCUMENTOS_RECIBIDOS_NO_PAGADOS",trabajos,
  pagoConfirmado:false,listoParaProducir:false};
}
async function centralTables(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_document_manifests (web_order_id TEXT PRIMARY KEY,commercial_order_id TEXT UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,amount_ars INTEGER NOT NULL CHECK(amount_ars>0 AND amount_ars<=50000000),file_count INTEGER NOT NULL CHECK(file_count BETWEEN 1 AND 30),manifest_hash TEXT NOT NULL,manifest_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'verified_waiting_order' CHECK(status IN ('verified_waiting_order','linked_waiting_payment','linked_paid_pending_preparation')),created_at TEXT NOT NULL DEFAULT (datetime('now')),linked_at TEXT)").run();
 await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_central_manifests_commercial_order ON central_document_manifests(commercial_order_id)").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_bridge_requests (request_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,action TEXT NOT NULL CHECK(action IN ('stage','link')),created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_document_receipts (receipt_id TEXT PRIMARY KEY,web_order_id TEXT NOT NULL REFERENCES central_document_manifests(web_order_id) ON DELETE CASCADE,file_id TEXT NOT NULL,sha256 TEXT NOT NULL,UNIQUE(web_order_id,file_id))").run();
}
async function centralReadSigned(req,env){
 if(env.CENTRAL_BRIDGE_ENABLED!=="PRIVATE_TEST_ONLY"||
    typeof env.CENTRAL_BRIDGE_KEY!=="string"||env.CENTRAL_BRIDGE_KEY.length<32||
    env.CENTRAL_BRIDGE_KEY===env.DEMO_ADMIN_KEY||
    env.CENTRAL_BRIDGE_KEY===env.MP_WEBHOOK_SECRET)
  return {error:"Sincronización privada no configurada",status:503};
 if(req.method!=="POST"||req.headers.has("Origin")||
    !/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
  return {error:"Solicitud entre servidores requerida",status:403};
 const ts=req.headers.get("x-saber-ts")||"",id=req.headers.get("x-saber-request-id")||"";
 const sig=req.headers.get("x-saber-signature")||"";
 if(!/^\d{10}$/.test(ts)||!CENTRAL_UUID.test(id)||!CENTRAL_HEX.test(sig)||
    Math.abs(Math.floor(Date.now()/1000)-Number(ts))>300)
  return {error:"Firma o tiempo de solicitud inválidos",status:401};
 const raw=await req.text();
 if(raw.length<10||raw.length>32000)
  return {error:"Tamaño de manifiesto no permitido",status:413};
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const expected=Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,
  new TextEncoder().encode(ts+"\n"+id+"\n"+raw))),
  b=>b.toString(16).padStart(2,"0")).join("");
 let mismatch=0;
 for(let i=0;i<64;i++)mismatch|=expected.charCodeAt(i)^sig.charCodeAt(i);
 if(mismatch)return {error:"Firma de sincronización rechazada",status:401};
 let payload;
 try{payload=JSON.parse(raw)}
 catch(_){return {error:"Manifiesto JSON inválido",status:400}}
 return {requestId:id,raw,payload};
}
async function centralStage(req,env){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({error:signed.error},signed.status);
 let safe;
 try{safe=centralSafeManifest(signed.payload)}
 catch(_){return json({error:"Ficha de documentos incompleta"},422)}
 await centralTables(env);
 const digest=await centralHash(JSON.stringify(safe));
 const existing=await env.DB.prepare("SELECT manifest_hash,commercial_order_id FROM central_document_manifests WHERE web_order_id=?").bind(safe.webOrderId).first();
 if(existing){
  if(existing.manifest_hash!==digest)return json({error:"El pedido ya tiene otro manifiesto verificado"},409);
  return json({saved:true,idempotent:true,web_order_id:safe.webOrderId,paymentAuthorized:false});
 }
 const requestDigest=await centralHash(signed.raw);
 const statements=[
  env.DB.prepare("INSERT INTO central_bridge_requests(request_id,request_hash,action) VALUES(?,?,'stage')").bind(signed.requestId,requestDigest),
  env.DB.prepare("INSERT INTO central_document_manifests(web_order_id,amount_ars,file_count,manifest_hash,manifest_json) VALUES(?,?,?,?,?)").bind(safe.webOrderId,safe.importe,safe.archivos,digest,JSON.stringify(safe))
 ];
 for(const item of safe.trabajos)statements.push(
  env.DB.prepare("INSERT INTO central_document_receipts(receipt_id,web_order_id,file_id,sha256) VALUES(?,?,?,?)")
   .bind(item.reciboPrivado,safe.webOrderId,item.fileId,item.sha256));
 try{await env.DB.batch(statements)}
 catch(_){return json({error:"Conflicto de recepción; verificar si ya existe"},409)}
 return json({saved:true,idempotent:false,web_order_id:safe.webOrderId,
  estado:"VERIFICADO_PENDIENTE_DE_PEDIDO",paymentAuthorized:false},201);
}
async function centralLink(req,env){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({error:signed.error},signed.status);
 const d=signed.payload;
 if(!d||Object.keys(d).sort().join(",")!=="commercialOrderId,webOrderId"||
    !CENTRAL_WEB.test(d.webOrderId||"")||!CENTRAL_UUID.test(d.commercialOrderId||""))
  return json({error:"Identificación de pedidos inválida"},400);
 await centralTables(env);
 const manifest=await env.DB.prepare("SELECT * FROM central_document_manifests WHERE web_order_id=?").bind(d.webOrderId).first();
 if(!manifest)return json({error:"No existe documentación verificada"},404);
 if(manifest.commercial_order_id){
  if(manifest.commercial_order_id!==d.commercialOrderId)
   return json({error:"Esta recepción pertenece a otro pedido comercial"},409);
  return json({linked:true,idempotent:true,paymentAuthorized:false});
 }
 const order=await env.DB.prepare("SELECT id,amount_ars,deposit_ars,status FROM orders WHERE id=?").bind(d.commercialOrderId).first();
 if(!order)return json({error:"Pedido comercial no existe"},404);
 const items=(await env.DB.prepare("SELECT item_type,sku,line_total_ars,file_references_json FROM order_items WHERE order_id=? ORDER BY line_number").bind(d.commercialOrderId).all()).results||[];
 if(items.length<1||items.length>100||
    items.reduce((n,x)=>n+x.line_total_ars,0)!==order.amount_ars)
  return json({error:"El pedido no coincide con sus líneas comerciales"},409);
 let safe;
 try{safe=JSON.parse(manifest.manifest_json)}catch(_){return json({error:"Manifiesto no legible"},409)}
 const expected=new Set(safe.trabajos.map(w=>w.reciboPrivado));
 let docPrice=0,found=new Set();
 for(const row of items.filter(x=>x.item_type==="print"&&x.sku==="DOCS_VERIFIED")){
  let refs;
  try{refs=JSON.parse(row.file_references_json||"null")}catch(_){}
  if(!Array.isArray(refs)||refs.length<1||refs.length>30||
     refs.some(ref=>typeof ref!=="string"||!expected.has(ref)||found.has(ref)))
   return json({error:"Referencias de PDF incorrectas o repetidas"},409);
  refs.forEach(ref=>found.add(ref));
  docPrice+=row.line_total_ars;
 }
 if(docPrice!==manifest.amount_ars||found.size!==expected.size)
  return json({error:"Faltan archivos documentales o el importe no coincide"},409);
 const prior=await env.DB.prepare("SELECT web_order_id FROM central_document_manifests WHERE commercial_order_id=?").bind(order.id).first();
 if(prior)return json({error:"Pedido ya vinculado con otros documentos"},409);
 const digest=await centralHash(signed.raw);
 let linkage;
 try{linkage=await env.DB.batch([
  env.DB.prepare("INSERT INTO central_bridge_requests(request_id,request_hash,action) VALUES(?,?,'link')").bind(signed.requestId,digest),
  env.DB.prepare("UPDATE central_document_manifests SET commercial_order_id=?,status='linked_waiting_payment',linked_at=datetime('now') WHERE web_order_id=? AND commercial_order_id IS NULL").bind(order.id,d.webOrderId)
 ])}
 catch(_){return json({error:"Conflicto de vinculación"},409)}
 if(linkage?.[1]?.meta?.changes!==1)return json({error:"Otra solicitud modificó el pedido; volver a consultar"},409);
 return json({linked:true,idempotent:false,commercial_order_id:order.id,
  estado:"VINCULADO_PENDIENTE_DE_CONTROL",paymentAuthorized:false});
}

/** Create a D1 commercial order from signed, previously verified PDFs.
 * Prices for shop SKUs are reloaded from the live catalog on this server.
 * Deliberately DOES NOT create a Mercado Pago preference or allow checkout.
 */
async function centralPrepareDraft(req,env){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({error:signed.error},signed.status);
 if(env.CENTRAL_PREPARE_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Preparación documental deshabilitada"},503);
 const data=signed.payload;
 if(!data||Object.keys(data).sort().join(",")!=="clientOrderId,items,webOrderId"||
    !CENTRAL_WEB.test(data.webOrderId||"")||!CENTRAL_UUID.test(data.clientOrderId||"")||
    !Array.isArray(data.items)||data.items.length>50)
  return json({error:"Solicitud de pedido inválida"},400);
 const codes=new Set(),clean=[];
 for(const it of data.items){
  if(!it||Object.keys(it).sort().join(",")!=="code,qty"||
     typeof it.code!=="string"||!it.code.trim()||it.code.length>80||
     !Number.isSafeInteger(it.qty)||it.qty<1||it.qty>500||codes.has(it.code))
   return json({error:"Productos repetidos o cantidades inválidas"},422);
  codes.add(it.code);clean.push({code:it.code,qty:it.qty});
 }
 await centralTables(env);
 await ensureOrderItems(env);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS cart_requests (client_order_id TEXT PRIMARY KEY, request_hash TEXT NOT NULL,order_id TEXT NOT NULL UNIQUE)").run();
 const hash=await centralHash(JSON.stringify({webOrderId:data.webOrderId,items:clean}));
 const previous=await env.DB.prepare("SELECT request_hash,order_id FROM cart_requests WHERE client_order_id=?").bind(data.clientOrderId).first();
 if(previous){
  if(previous.request_hash!==hash)return json({error:"Identificador de compra usado con otro carrito"},409);
  const old=await env.DB.prepare("SELECT amount_ars,status FROM orders WHERE id=?").bind(previous.order_id).first();
  const manifest=await env.DB.prepare("SELECT web_order_id FROM central_document_manifests WHERE commercial_order_id=?").bind(previous.order_id).first();
  if(!old||manifest?.web_order_id!==data.webOrderId)return json({error:"Recepción del intento anterior no coincide"},409);
  return json({created:true,idempotent:true,commercial_order_id:previous.order_id,
   amount_ars:old.amount_ars,state:old.status,checkoutEnabled:false,paymentAuthorized:false});
 }
 const row=await env.DB.prepare("SELECT amount_ars,manifest_json,commercial_order_id FROM central_document_manifests WHERE web_order_id=?").bind(data.webOrderId).first();
 if(!row)return json({error:"No existe recepción comprobada para el pedido"},404);
 if(row.commercial_order_id)return json({error:"Esta recepción ya pertenece a otro pedido"},409);
 let manifest;
 try{manifest=JSON.parse(row.manifest_json)}
 catch(_){return json({error:"Recepción privada ilegible"},409)}
 if(manifest.schema!=="saber-central-documentos-d1-v1"||
    manifest.webOrderId!==data.webOrderId||
    manifest.importe!==row.amount_ars||!Array.isArray(manifest.trabajos)||
    manifest.trabajos.length<1||manifest.trabajos.length>30)
  return json({error:"Recepción fuera del contrato de documentos"},409);
 const reference=manifest.trabajos.map(x=>x.reciboPrivado);
 if(reference.some(x=>!CENTRAL_RECEIPT.test(x))||new Set(reference).size!==reference.length)
  return json({error:"Referencias documentales duplicadas"},409);
 let total=row.amount_ars,products=[];
 if(clean.length){
  const catalog=await getCatalog();
  for(const x of clean){
   const found=catalog.get(x.code);
   if(!found)return json({error:"Producto inexistente o inactivo"},422);
   const value=found.price*x.qty;
   if(!Number.isSafeInteger(value)||value<=0)return json({error:"Importe del producto inválido"},422);
   total+=value;
   products.push({...x,name:found.name,price:found.price,total:value});
  }
 }
 if(!Number.isSafeInteger(total)||total<=0||total>50000000)
  return json({error:"El pedido excede el límite de prueba"},422);
 const orderId=crypto.randomUUID(),requests=[
  env.DB.prepare("INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)").bind(orderId,"Librería Saber · documentos verificados y tienda",total,total),
  env.DB.prepare("INSERT INTO order_items(order_id,line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json) VALUES(?,?,?,?,?,?,?,?,?,?)")
   .bind(orderId,1,"print","DOCS_VERIFIED","Trabajos gráficos con PDF verificado",1,row.amount_ars,row.amount_ars,
    JSON.stringify({source:"central_verified",files:reference.length}),JSON.stringify(reference))
 ];
 products.forEach((it,i)=>requests.push(env.DB.prepare("INSERT INTO order_items(order_id,line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json) VALUES(?,?,?,?,?,?,?,?,?,?)")
  .bind(orderId,i+2,"product",it.code,it.name,it.qty,it.price,it.total,"{}","[]")));
 requests.push(env.DB.prepare("INSERT INTO cart_requests(client_order_id,request_hash,order_id) VALUES(?,?,?)").bind(data.clientOrderId,hash,orderId));
 requests.push(env.DB.prepare("UPDATE central_document_manifests SET commercial_order_id=?,status='linked_waiting_payment',linked_at=datetime('now') WHERE web_order_id=? AND commercial_order_id IS NULL").bind(orderId,data.webOrderId));
 let response;
 try{response=await env.DB.batch(requests)}
 catch(_){
  const other=await env.DB.prepare("SELECT request_hash,order_id FROM cart_requests WHERE client_order_id=?").bind(data.clientOrderId).first();
  if(other&&other.request_hash===hash){
   return json({created:true,idempotent:true,commercial_order_id:other.order_id,
    amount_ars:total,state:"awaiting_payment",checkoutEnabled:false,paymentAuthorized:false});
  }
  return json({error:"Pedido concurrente o recepción reutilizada"},409);
 }
 if(response?.[response.length-1]?.meta?.changes!==1)
  return json({error:"Vinculación del nuevo pedido sin confirmar"},409);
 return json({created:true,idempotent:false,commercial_order_id:orderId,
  amount_ars:total,state:"awaiting_payment",documentos_ars:row.amount_ars,
  productos_ars:total-row.amount_ars,checkoutEnabled:false,paymentAuthorized:false},201);
}

/**
 * Central privada, rama Express. PDF almacenado exclusivamente en Drive.
 * No se aceptan fotos, bytes, enlaces ni URLs suministrados por un comprador.
 */
const CENTRAL_POLAROID=/^POL-[A-F0-9]{24}$/;
async function centralPolaroidTable(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_polaroids_express (reference TEXT PRIMARY KEY,sha256 TEXT NOT NULL CHECK(length(sha256)=64),bytes INTEGER NOT NULL CHECK(bytes BETWEEN 100 AND 12582912),photos INTEGER NOT NULL CHECK(photos BETWEEN 1 AND 24),sheets INTEGER NOT NULL CHECK(sheets BETWEEN 1 AND 4),amount_ars INTEGER NOT NULL CHECK(amount_ars IN (3000,6000,9000,12000)),commercial_order_id TEXT UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,created_at TEXT NOT NULL DEFAULT (datetime('now')),linked_at TEXT)").run();
 await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_central_express_order ON central_polaroids_express(commercial_order_id)").run();
}
function centralPolaroidSafe(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).sort().join(",")!=="bytes,fotos,hojas,importeArs,listoParaProducir,pagoConfirmado,pdfPrivadoVerificado,referencia,schema,sha256"||
    data.schema!=="saber-polaroids-express-central-v1"||
    !CENTRAL_POLAROID.test(data.referencia||"")||!CENTRAL_HEX.test(data.sha256||"")||
    !Number.isSafeInteger(data.bytes)||data.bytes<100||data.bytes>12*1024*1024||
    !Number.isSafeInteger(data.fotos)||data.fotos<1||data.fotos>24||
    !Number.isSafeInteger(data.hojas)||data.hojas!==Math.ceil(data.fotos/6)||
    !Number.isSafeInteger(data.importeArs)||data.importeArs!==data.hojas*3000||
    data.pdfPrivadoVerificado!==true||data.pagoConfirmado!==false||
    data.listoParaProducir!==false)
  throw Error("PDF Polaroids Express sin verificación privada completa.");
 return {reference:data.referencia,sha256:data.sha256,bytes:data.bytes,
  photos:data.fotos,sheets:data.hojas,amount_ars:data.importeArs};
}
async function centralPolaroidStage(request,env){
 if(env.CENTRAL_EXPRESS_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Polaroids Express no está habilitado en la Central"},503);
 const signed=await centralReadSigned(request,env);
 if(signed.error)return json({error:signed.error},signed.status);
 let verified;try{verified=centralPolaroidSafe(signed.payload)}
 catch(_){return json({error:"Recibo Express no válido"},422)}
 await centralPolaroidTable(env);
 const old=await env.DB.prepare("SELECT reference,sha256,bytes,photos,sheets,amount_ars FROM central_polaroids_express WHERE reference=?").bind(verified.reference).first();
 if(old){
  if(old.sha256!==verified.sha256||old.bytes!==verified.bytes||
     old.photos!==verified.photos||old.sheets!==verified.sheets||
     old.amount_ars!==verified.amount_ars)
   return json({error:"La referencia ya corresponde a un PDF diferente"},409);
  return json({saved:true,idempotent:true,referencia:verified.reference,
   pdfPrivadoVerificado:true,paymentAuthorized:false},200);
 }
 try{
  await env.DB.prepare("INSERT INTO central_polaroids_express(reference,sha256,bytes,photos,sheets,amount_ars) VALUES(?,?,?,?,?,?)")
   .bind(verified.reference,verified.sha256,verified.bytes,verified.photos,verified.sheets,verified.amount_ars).run();
 }catch(_){return json({error:"Conflicto de referencia; consultá la recepción privada"},409)}
 return json({saved:true,idempotent:false,referencia:verified.reference,
  pdfPrivadoVerificado:true,paymentAuthorized:false},201);
}

/**
 * Alta de compra Express aún SIN CHECKOUT. Se limita a manifiestos auténticos
 * del backend y recalcula productos del catálogo; jamás acepta importe cliente.
 */
async function centralPolaroidPrepareOrder(req,env){
 if(env.CENTRAL_EXPRESS_PREPARE_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Pedidos Express todavía deshabilitados"},503);
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({error:signed.error},signed.status);
 const data=signed.payload;
 if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).sort().join(",")!=="clientOrderId,items,referencia"||
    !CENTRAL_UUID.test(data.clientOrderId||"")||
    !CENTRAL_POLAROID.test(data.referencia||"")||
    !Array.isArray(data.items)||data.items.length>40)
  return json({error:"Pedido Express comercial inválido"},400);
 const codes=new Set(),products=[];
 for(const item of data.items){
  if(!item||Object.keys(item).sort().join(",")!=="code,qty"||
     typeof item.code!=="string"||!item.code.trim()||item.code.length>80||
     !Number.isSafeInteger(item.qty)||item.qty<1||item.qty>500||
     codes.has(item.code))
   return json({error:"Artículo repetido o cantidad inválida"},422);
  codes.add(item.code);
  products.push({code:item.code,qty:item.qty});
 }
 await centralPolaroidTable(env);await ensureOrderItems(env);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS cart_requests (client_order_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,order_id TEXT NOT NULL UNIQUE)").run();
 const fingerprint=await centralHash(JSON.stringify({
  referencia:data.referencia,items:products
 }));
 const old=await env.DB.prepare("SELECT request_hash,order_id FROM cart_requests WHERE client_order_id=?").bind(data.clientOrderId).first();
 if(old){
  if(old.request_hash!==fingerprint)
   return json({error:"El intento de compra contiene otro carrito"},409);
  const manifest=await env.DB.prepare("SELECT reference FROM central_polaroids_express WHERE commercial_order_id=?").bind(old.order_id).first();
  const order=await env.DB.prepare("SELECT amount_ars,status FROM orders WHERE id=?").bind(old.order_id).first();
  if(!manifest||!order||manifest.reference!==data.referencia)
   return json({error:"No coincide el intento con la recepción verificada"},409);
  return json({created:true,idempotent:true,commercial_order_id:old.order_id,
   amount_ars:order.amount_ars,state:order.status,checkoutEnabled:false,
   paymentAuthorized:false},200);
 }
 const manifest=await env.DB.prepare("SELECT reference,photos,sheets,sha256,bytes,amount_ars,commercial_order_id FROM central_polaroids_express WHERE reference=?").bind(data.referencia).first();
 if(!manifest)return json({error:"La Central no recibió aún el PDF Express"},404);
 if(manifest.commercial_order_id)
  return json({error:"Este PDF ya pertenece a otro pedido"},409);
 if(manifest.amount_ars!==manifest.sheets*3000||manifest.photos>manifest.sheets*6||
    manifest.photos<manifest.sheets*6-5)
  return json({error:"Importe o cantidad de fotos inconsistentes"},409);
 let total=manifest.amount_ars;
 const details=[];
 if(products.length){
  const catalog=await getCatalog();
  for(const item of products){
   const entry=catalog.get(item.code);
   if(!entry)return json({error:"Artículo no disponible"},422);
   const amount=entry.price*item.qty;
   if(!Number.isSafeInteger(amount)||amount<1||amount>50000000)
    return json({error:"Valor del artículo fuera de rango"},422);
   total+=amount;
   details.push({...item,unit:entry.price,title:entry.name,amount});
  }
 }
 if(!Number.isSafeInteger(total)||total<1||total>50000000)
  return json({error:"El pedido supera el máximo de ensayo"},422);
 const orderId=crypto.randomUUID();
 const statements=[
  env.DB.prepare("INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)").bind(orderId,"Librería Saber · Polaroids Express y tienda",total,total),
  env.DB.prepare("INSERT INTO order_items(order_id,line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json) VALUES(?,?,?,?,?,?,?,?,?,?)")
   .bind(orderId,1,"print","POLAROID_EXPRESS_A4","Polaroids Express PDF privado",manifest.sheets,3000,manifest.amount_ars,
    JSON.stringify({photos:manifest.photos,sheets:manifest.sheets,pdfFinalVerified:true}),
    JSON.stringify([manifest.reference]))
 ];
 details.forEach((p,i)=>statements.push(
  env.DB.prepare("INSERT INTO order_items(order_id,line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json) VALUES(?,?,?,?,?,?,?,?,?,?)")
   .bind(orderId,i+2,"product",p.code,p.title,p.qty,p.unit,p.amount,"{}","[]")
 ));
 statements.push(env.DB.prepare("INSERT INTO cart_requests(client_order_id,request_hash,order_id) VALUES(?,?,?)").bind(data.clientOrderId,fingerprint,orderId));
 statements.push(env.DB.prepare("UPDATE central_polaroids_express SET commercial_order_id=?,linked_at=datetime('now') WHERE reference=? AND commercial_order_id IS NULL").bind(orderId,manifest.reference));
 let results;
 try{results=await env.DB.batch(statements)}
 catch(_){return json({error:"Otro intento utilizó esta referencia; consultar primero"},409)}
 if(results?.[results.length-1]?.meta?.changes!==1)
  return json({error:"Vinculación de PDF con compra no confirmada"},409);
 return json({created:true,idempotent:false,commercial_order_id:orderId,
  amount_ars:total,polaroids_ars:manifest.amount_ars,
  productos_ars:total-manifest.amount_ars,
  state:"awaiting_payment",checkoutEnabled:false,paymentAuthorized:false},201);
}


/**
 * Descarga administrativa: únicamente PDF Express asociado a un pedido pagado
 * íntegramente en Mercado Pago de pruebas, sin revocación y con referencia
 * consistente en D1. GAS recibe una solicitud firmada; no publica URLs.
 */
async function centralPolaroidDownload(req,env,reference){
 if(!tokenOK(req,env))return json({error:"Operador no autorizado"},401);
 if(env.CENTRAL_EXPRESS_DOWNLOAD_ENABLED!=="PRIVATE_TEST_ONLY"||
    typeof env.EXPRESS_DOWNLOAD_HMAC_KEY!=="string"||
    env.EXPRESS_DOWNLOAD_HMAC_KEY.length<32||
    env.EXPRESS_DOWNLOAD_HMAC_KEY===env.CENTRAL_BRIDGE_KEY||
    env.EXPRESS_DOWNLOAD_HMAC_KEY===env.DEMO_ADMIN_KEY)
  return json({error:"Descargas Express no habilitadas"},503);
 if(!CENTRAL_POLAROID.test(reference||""))
  return json({error:"Referencia Express no válida"},400);
 await centralPolaroidTable(env);
 await ensurePaymentReviews(env);
 await ensureOrderItems(env);
 const row=await env.DB.prepare("SELECT p.reference,p.sha256,p.bytes,p.photos,p.sheets,p.amount_ars,p.commercial_order_id,o.status,o.payment_id,o.preference_id,o.paid_at,o.deposit_ars,o.amount_ars AS order_amount FROM central_polaroids_express p JOIN orders o ON o.id=p.commercial_order_id WHERE p.reference=? AND o.status='paid' AND o.deposit_ars=o.amount_ars AND o.paid_at IS NOT NULL AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payment_reviews q WHERE q.order_id=o.id AND q.state='revoked')").bind(reference).first();
 if(!row)return json({error:"No existe PDF de pedido pagado verificable"},404);
 const lines=(await env.DB.prepare("SELECT sku,quantity,unit_price_ars,line_total_ars,file_references_json FROM order_items WHERE order_id=? ORDER BY line_number").bind(row.commercial_order_id).all()).results||[];
 if(!lines.length||lines.length>100||
    lines.reduce((n,l)=>n+Number(l.line_total_ars||0),0)!==row.order_amount)
  return json({error:"El importe del pedido requiere revisión"},409);
 const only=lines.filter(x=>x.sku==="POLAROID_EXPRESS_A4");
 let references;
 try{references=JSON.parse(only[0]?.file_references_json||"null")}catch(_){}
 if(only.length!==1||only[0].quantity!==row.sheets||
    only[0].unit_price_ars!==3000||only[0].line_total_ars!==row.amount_ars||
    !Array.isArray(references)||references.length!==1||references[0]!==reference)
  return json({error:"El PDF no coincide con la compra"},409);
 let gas;
 try{gas=new URL(env.EXPRESS_DOWNLOAD_SCRIPT_URL)}catch(_){return json({error:"Google privado no configurado"},503)}
 if(gas.protocol!=="https:"||gas.hostname!=="script.google.com"||
    !/^\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec\/?$/.test(gas.pathname)||
    gas.username||gas.password||gas.port||gas.search||gas.hash)
  return json({error:"Receptor privado incorrecto"},503);
 const payload=JSON.stringify({op:"leerPdfExpress",referencia:reference,
  bytes:row.bytes,sha256:row.sha256});
 const timestamp=Math.floor(Date.now()/1000),nonce=crypto.randomUUID();
 const hmac=await crypto.subtle.importKey("raw",
  new TextEncoder().encode(env.EXPRESS_DOWNLOAD_HMAC_KEY),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",hmac,
  new TextEncoder().encode(timestamp+"\n"+nonce+"\n"+payload))),
  n=>n.toString(16).padStart(2,"0")).join("");
 let response;
 try{
  const original=await fetch(gas.href,{method:"POST",
   headers:{"Content-Type":"text/plain;charset=UTF-8"},
   body:JSON.stringify({timestamp,nonce,payloadJson:payload,signature:bytes}),
   redirect:"manual",signal:AbortSignal.timeout(35000)});
  response=original;
  if([301,302,303,307,308].includes(original.status)){
   const redirect=new URL(original.headers.get("Location")||"",gas);
   if(redirect.protocol!=="https:"||
      redirect.hostname!=="script.googleusercontent.com"||
      !redirect.pathname.startsWith("/macros/echo")||
      redirect.username||redirect.password||redirect.port)
    throw Error("La URL de descarga de Google cambió.");
   response=await fetch(redirect.href,{method:"GET",redirect:"error",
    headers:{"Accept":"application/json"},signal:AbortSignal.timeout(35000)});
  }
  if(!response.ok)throw Error("Google no confirmó.");
  const text=await response.text();
  if(text.length<100||text.length>17*1024*1024+1500)
   throw Error("Respuesta demasiado grande.");
  const data=JSON.parse(text);
  if(data.ok!==true||data.verified!==true||
     data.referencia!==reference||data.sha256!==row.sha256||
     data.bytes!==row.bytes||typeof data.pdfBase64!=="string"||
     data.pdfBase64.length>17*1024*1024)
   throw Error("Recibo de Google distinto del registrado.");
  const raw=atob(data.pdfBase64);
  if(raw.length!==row.bytes)throw Error("El PDF está incompleto.");
  const pdf=Uint8Array.from(raw,ch=>ch.charCodeAt(0));
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",pdf)),
   b=>b.toString(16).padStart(2,"0")).join("");
  if(actual!==row.sha256||raw.slice(0,5)!=="%PDF-"||
     !raw.slice(-72).includes("%%EOF"))
   throw Error("El PDF privado está alterado.");
  return new Response(pdf,{status:200,headers:{
   "Content-Type":"application/pdf","Content-Disposition":'attachment; filename="'+reference+'_IMPRIMIR.pdf"',
   "Content-Length":String(pdf.length),"Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
   "X-Robots-Tag":"noindex, nofollow"
  }});
 }catch(_){return json({error:"No se pudo verificar la descarga de Drive."},502)}
}

async function centralPolaroidDetail(env,id){
 await centralPolaroidTable(env);
 const row=await env.DB.prepare("SELECT reference,sha256,bytes,photos,sheets,amount_ars,created_at FROM central_polaroids_express WHERE commercial_order_id=?").bind(id).first();
 return row?{
  referencia:row.reference,paginasA4:row.sheets,fotos:row.photos,
  totalPolaroids:row.amount_ars,bytes:row.bytes,
  sha256:row.sha256,fechaRecepcion:row.created_at,
  pdfPrivadoVerificado:true,
  descargaSoloOperador:true,
  descargaHabilitada:env.CENTRAL_EXPRESS_DOWNLOAD_ENABLED==="PRIVATE_TEST_ONLY",
  pagoConfirmado:false,listoParaProducir:false
 }:null;
}

async function centralAdminDetail(env,id){
 await centralTables(env);
 const row=await env.DB.prepare("SELECT web_order_id,manifest_json,created_at,amount_ars,file_count FROM central_document_manifests WHERE commercial_order_id=?").bind(id).first();
 if(!row)return null;
 let document;
 try{document=JSON.parse(row.manifest_json)}catch(_){return null}
 return {webOrderId:row.web_order_id,totalDocumentos:row.amount_ars,
  fechaRecepcion:row.created_at,archivos:row.file_count,
  estado:"DOCUMENTOS_VERIFICADOS_PDF_FINAL_PENDIENTE",
  trabajos:document.trabajos,pdfFinalVerificado:false,listoParaProducir:false};
}

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
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#details section{margin:14px 0;padding:13px;border:1px solid #d9e0ec;border-radius:10px;background:#f8fbff}#details section h4{margin:0 0 7px}#details section p{margin:6px 0}
#status{min-height:1.5em;font-weight:600}.grid{display:grid;grid-template-columns:minmax(260px,1fr) minmax(280px,1.4fr);gap:16px}
ol{padding-left:22px}li{padding:12px 6px;border-bottom:1px solid #e5ebf3}li button{margin-top:7px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px ui-monospace,monospace;background:#f0f3f9;padding:12px;border-radius:6px;max-height:450px;overflow:auto}
@media(max-width:700px){.grid{grid-template-columns:1fr}}
</style></head><body>
<header><div><h1>Centro de Pedidos · Pruebas</h1><div class="note">Solo pagos completos aprobados · No está conectado al sitio público</div></div></header>
<fieldset><legend>Acceso privado</legend><div class="toolbar">
<input type="password" autocomplete="off" id="secret" placeholder="Clave privada del panel" aria-label="Clave privada">
<button id="refresh">Consultar pedidos</button><button id="sync" class="outline">Verificar pagos pendientes</button>
</div><p id="status" role="status" aria-live="polite"></p><p id="cronState" class="note">Conciliación automática: sin consultar.</p></fieldset>
<fieldset><legend>Polaroids Express · PDF privado único</legend><button id="refreshExpress" class="outline">Consultar PDF recibidos</button><p class="note">Hasta cuatro hojas A4 por pedido. Archivo listo en Drive privado; el pago todavía no está confirmado.</p><ol id="expressReceipts"></ol></fieldset>
<fieldset><legend>Recepciones de PDF verificadas sin pedido comercial</legend><div class="toolbar"><button id="refreshReceipts" class="outline">Consultar recepciones pendientes</button></div><p class="note">Documentos confirmados en Drive, todavía no vinculados a un pedido cobrado. No están listos para imprimir.</p><ol id="verifiedReceipts"></ol></fieldset>
<fieldset><legend>Pedidos con PDF y pago pendiente</legend><button id="refreshUnpaid" class="outline">Consultar pedidos sin pago confirmado</button><ol id="unpaidDocs"></ol></fieldset>
<div class="grid"><fieldset><legend>Pedidos pagados</legend><ol id="orders"></ol></fieldset><fieldset><legend>Detalle del pedido</legend>
<div id="details">Seleccioná un pedido para ver sus datos y archivos referenciados.</div></fieldset></div>
<script>
const secret=document.querySelector("#secret"),status=document.querySelector("#status"),orders=document.querySelector("#orders"),details=document.querySelector("#details");
function money(n){return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n)||0)}
async function api(path,method="GET"){const r=await fetch(path,{method,headers:{"Authorization":"Bearer "+secret.value},cache:"no-store"});const x=await r.json().catch(()=>({}));if(!r.ok)throw Error(r.status===401?"Clave incorrecta":x.error||"Error "+r.status);return x}
function node(tag,txt){const x=document.createElement(tag);x.textContent=String(txt);return x}
async function showOrder(id){try{status.textContent="Consultando detalle...";const x=await api("/admin/api/order?id="+encodeURIComponent(id));details.replaceChildren();details.append(node("h3","Pedido "+x.order.id));details.append(node("p","Total: "+money(x.order.amount_ars)+" · Aprobado: "+(x.order.paid_at||"sin fecha")));if(x.produccion){const pr=x.produccion;details.append(node("h4","Estado operativo: "+pr.estado.replaceAll("_"," ")));details.append(node("p",pr.mensaje));for(const t of pr.trabajos){const area=node("section","");area.append(node("h4",t.linea+". "+t.cantidad+" × "+t.descripcion+" — "+money(t.subtotal)));area.append(node("p","Estado: "+t.etapa.replaceAll("_"," ")+" · "+t.instruccion));const valores=Object.entries(t.especificaciones||{}).map(a=>a[0]+": "+a[1]).join(" · ");if(valores)area.append(node("p","Ficha técnica: "+valores));if(t.referencias?.length)area.append(node("p","Referencias privadas: "+t.referencias.join(", ")));details.append(area)}}else details.append(node("p","La ficha de producción no está disponible."));if(x.produccion?.documentosVerificados){
 const d=x.produccion.documentosVerificados;
 details.append(node("h4","PDF originales verificados · "+d.archivos+" archivo(s)"));
 details.append(node("p","Recepción "+d.webOrderId+" · "+money(d.totalDocumentos)+" · PDF final listo para imprimir: pendiente"));
 for(const t of d.trabajos){
  const line=node("section","");
  line.append(node("h4",t.orden+". "+t.nombreOriginal+" · "+t.servicio));
  line.append(node("p","Páginas "+t.paginasElegidas.join(", ")+" de "+t.paginasOriginales+" · "+t.copias+" copia(s)/lote(s)"));
  line.append(node("p","Recibo privado: "+t.reciboPrivado+" · Preparación: pendiente de PDF final"));
  details.append(line);
 }
}
if(x.produccion?.polaroidsExpress){
 const d=x.produccion.polaroidsExpress;
 details.append(node("h4","Polaroids Express · PDF único verificado"));
 details.append(node("p",d.referencia+" · "+d.fotos+" fotos · "+d.paginasA4+
  " hoja(s) A4 · "+money(d.totalPolaroids)+" · Pago confirmado"));
 if(d.descargaHabilitada){
  const button=node("button","Descargar PDF privado");
  button.addEventListener("click",async()=>{
   button.disabled=true;
   try{
    const response=await fetch("/admin/api/central/polaroid-pdf?reference="+
      encodeURIComponent(d.referencia),{method:"GET",headers:{
       "Authorization":"Bearer "+secret.value},"cache":"no-store"});
    if(!response.ok||!String(response.headers.get("Content-Type")||"").startsWith("application/pdf"))
     throw Error("No se confirmó el PDF privado de Drive.");
    const blob=await response.blob();
    if(blob.size<100||blob.size>12*1024*1024)
     throw Error("El archivo recibido no es válido.");
    const uri=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=uri;link.download=d.referencia+"_IMPRIMIR.pdf";
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(uri),10000);
   }catch(e){status.textContent=String(e.message||e)}
   finally{button.disabled=false}
  });
  details.append(button);
 }else details.append(node("p","PDF en Drive privado. Descarga administrativa pendiente de habilitación."));
}status.textContent=""}catch(e){status.textContent=e.message}}
async function refreshCronState(){
 const el=document.querySelector("#cronState");
 try{
  const info=await api("/admin/api/cron-status");
  const x=info.lastRun;
  if(!x){el.textContent="Conciliación automática: todavía sin ejecuciones registradas por esta versión.";return}
  const fecha=x.finished_at||x.started_at||"sin fecha";
  el.textContent="Última ejecución automática: "+fecha+" UTC · "+x.status+" · pedidos revisados: "+x.checked+" · registrados: "+x.registered+" · errores: "+x.errors;
 }catch(e){el.textContent="Conciliación automática: no se pudo consultar el registro."}
}
async function refresh(){try{status.textContent="Consultando...";await refreshCronState();const x=await api("/admin/api/orders");orders.replaceChildren();if(!x.orders.length)orders.append(node("li","Aún no hay pedidos con pago total confirmado."));for(const o of x.orders){const li=node("li",o.description+" · "+money(o.amount_ars)+" · "+(o.paid_at||"sin fecha"));li.append(node("div",o.id));const b=node("button","Ver detalle");b.addEventListener("click",()=>showOrder(o.id));li.append(b);orders.append(li)}status.textContent=x.orders.length+" pedido(s) pagado(s) encontrado(s)"}catch(e){status.textContent=e.message}}
document.querySelector("#refreshExpress").addEventListener("click",async()=>{
 const list=document.querySelector("#expressReceipts");list.replaceChildren();
 try{
  const info=await api("/admin/api/central/polaroids");
  if(!info.manifests.length)list.append(node("li","Sin Polaroids Express recibidas."));
  for(const m of info.manifests){
   const item=node("li",m.referencia+" · "+m.fotos+" fotos · "+m.hojas+
    " hoja(s) A4 · "+money(m.importe));
   item.append(node("p","PDF final privado confirmado · Pago aún por verificar"));
   list.append(item);
  }
  status.textContent=info.manifests.length+" pedido(s) Polaroids Express recibido(s)";
 }catch(e){status.textContent=e.message}
});
document.querySelector("#refreshReceipts").addEventListener("click",async()=>{
 const list=document.querySelector("#verifiedReceipts");
 try{
  status.textContent="Consultando recepciones privadas...";
  const x=await api("/admin/api/central/pending");
  list.replaceChildren();
  if(!x.manifests.length)list.append(node("li","No hay documentos esperando vinculación."));
  for(const m of x.manifests){
   const li=node("li",m.web_order_id+" · "+m.file_count+" archivo(s) · "+money(m.amount_ars));
   li.append(node("p","Recibidos: "+m.created_at+" · Pago no confirmado"));
   list.append(li);
  }
  status.textContent=x.manifests.length+" recepción(es) sin pedido comercial";
 }catch(e){list.replaceChildren();status.textContent=e.message}
});
document.querySelector("#refreshUnpaid").addEventListener("click",async()=>{
 const list=document.querySelector("#unpaidDocs");
 try{
  status.textContent="Consultando pagos pendientes...";
  const x=await api("/admin/api/central/unpaid");
  list.replaceChildren();
  if(!x.orders.length)list.append(node("li","No hay pedidos documentales esperando pago."));
  for(const o of x.orders){
   const li=node("li",o.web_order_id+" · "+o.file_count+" PDF · Total pedido "+money(o.order_ars));
   li.append(node("p","Referencia de compra: "+o.commercial_order_id+" · Estado: pago sin confirmar"));
   list.append(li);
  }
  status.textContent=x.orders.length+" pedido(s) en espera de pago";
 }catch(e){list.replaceChildren();status.textContent=e.message}
});
document.querySelector("#refresh").addEventListener("click",refresh);
document.querySelector("#sync").addEventListener("click",async()=>{try{status.textContent="Verificando pagos en Mercado Pago...";const x=await api("/demo/sync-pending","POST");await refresh();status.textContent+=" · Sincronizados: "+x.registered+" · Errores: "+x.errors}catch(e){status.textContent=e.message}});
</script></body></html>`;
async function paymentEnvironmentAllowed(env,pay){
 if(pay.live_mode===false)return true;
 if(pay.live_mode!==true)return false;
 // Checkout Pro con cuentas TEST puede informar live_mode=true.
 // Nunca aceptar ese flag por sí solo: consultar la identidad del token en servidor.
 const seller=await mp(env,"/users/me");
 return String(seller.id)===String(env.MP_TEST_SELLER_ID)&&
  String(seller.id)===String(pay.collector_id)&&Array.isArray(seller.tags)&&seller.tags.includes("test_user");
}
async function reconcilePayment(env,paymentId){
 const pay=await mp(env,"/v1/payments/"+esc(paymentId));
 await ensurePaymentReviews(env);
 const recorded=await env.DB.prepare("SELECT id FROM orders WHERE payment_id=? AND status='paid'").bind(String(pay.id)).first();
 if(recorded&&(pay.status!=="approved"||Number(pay.transaction_amount_refunded||0)>0)){
  await env.DB.prepare("INSERT INTO payment_reviews(order_id,state,checked_at) VALUES(?,'revoked',datetime('now')) ON CONFLICT(order_id) DO UPDATE SET state='revoked',checked_at=datetime('now')").bind(recorded.id).run();
  return {registered:false,reason:"payment_revoked"};
 }
 if(Number(pay.transaction_amount_refunded||0)>0||pay.status!=="approved"||pay.currency_id!=="ARS"||String(pay.collector_id)!==String(env.MP_TEST_SELLER_ID))return {registered:false,reason:"payment_checks"};
 if(!await paymentEnvironmentAllowed(env,pay))return {registered:false,reason:"test_seller_unverified"};
 const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(String(pay.external_reference||"")).first();
 if(!order||!order.preference_id||Number(pay.transaction_amount)!==Number(order.amount_ars)||Number(order.deposit_ars)!==Number(order.amount_ars))return {registered:false,reason:"order_checks"};
 if(!pay.order?.id)return {registered:false,reason:"merchant_order_missing"};
 const mo=await mp(env,"/merchant_orders/"+esc(String(pay.order.id)));
 if(String(mo.preference_id)!==String(order.preference_id)||String(mo.external_reference)!==String(order.id)||!mo.payments?.some(p=>String(p.id)===String(pay.id)&&p.status==="approved"))return {registered:false,reason:"merchant_order_checks"};
 // Exclusivo de la cuenta de vendedor de prueba; no se procesan cobros productivos.
 if(order.status==="paid")return {registered:String(order.payment_id)===String(pay.id),alreadyRegistered:true};
 const res=await env.DB.prepare("UPDATE orders SET status='paid',payment_id=?,paid_at=datetime('now') WHERE id=? AND status='awaiting_payment' AND payment_id IS NULL").bind(String(pay.id),order.id).run();
 return {registered:Boolean(res.meta?.changes)};
}
async function syncPendingPayments(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS reconciliation_checks(order_id TEXT PRIMARY KEY,checked_at TEXT NOT NULL)").run();
 const pending=await env.DB.prepare("SELECT id FROM orders WHERE status='awaiting_payment' AND preference_id IS NOT NULL ORDER BY COALESCE((SELECT checked_at FROM reconciliation_checks WHERE order_id=orders.id),'') ASC,created_at ASC LIMIT 20").all();
 await ensurePaymentReviews(env);
 const paid=await env.DB.prepare("SELECT id,payment_id FROM orders WHERE status='paid' AND payment_id IS NOT NULL ORDER BY COALESCE((SELECT checked_at FROM payment_reviews WHERE order_id=orders.id),'') ASC LIMIT 20").all();
 const summary={checked:0,registered:0,errors:0};
 for(const order of paid.results||[]){
  try{await reconcilePayment(env,order.payment_id);
   await env.DB.prepare("INSERT INTO payment_reviews(order_id,state,checked_at) VALUES(?,'verified',datetime('now')) ON CONFLICT(order_id) DO UPDATE SET checked_at=datetime('now')").bind(order.id).run();
  }catch{summary.errors++}
 }
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
  finally{await env.DB.prepare("INSERT INTO reconciliation_checks(order_id,checked_at) VALUES(?,datetime('now')) ON CONFLICT(order_id) DO UPDATE SET checked_at=datetime('now')").bind(order.id).run()}
 }
 if(summary.registered||summary.errors)await audit(env,"payment_sync",JSON.stringify(summary));
 return summary;
}

const catalogUrl="https://docs.google.com/spreadsheets/d/e/2PACX-1vQx2zW0YP23ZjZMvLwkX_mkbPQgVPL_aUUtcI_n1ApZ6P9F4fBuKFOl-jB4qFmxwoeYsszAZSKbaUVn/pub?gid=419356696&single=true&output=csv";
function parseCSV(csv){
 const rows=[];let row=[],value="",quoted=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i],next=csv[i+1];
  if(c==='"'&&quoted&&next==='"'){value+='"';i++}
  else if(c==='"'){quoted=!quoted}
  else if(c===","&&!quoted){row.push(value);value=""}
  else if((c==="\n"||c==="\r")&&!quoted){
   if(c==="\r"&&next==="\n")i++;
   row.push(value);if(row.some(x=>x.trim()!==""))rows.push(row);
   row=[];value="";
  }else value+=c;
 }
 row.push(value);if(row.some(x=>x.trim()!==""))rows.push(row);
 if(quoted)throw Error("CSV del catálogo incompleto");
 return rows;
}
const normalizedCell=v=>String(v||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const amountFromCell=v=>{
 const raw=String(v||"").trim().replace(/^\$\s*/,""),clean=raw.replace(/\./g,"");
 if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw))return 0;
 const amount=Number(clean.replace(",","."));
 return Number.isSafeInteger(amount)?amount:0; // D1 y el catálogo actual trabajan en pesos enteros; jamás concatenar centavos.
};
async function getCatalog(){
 const r=await fetch(catalogUrl,{headers:{"Accept":"text/csv"},redirect:"follow",cf:{cacheTtl:0}});
 if(!r.ok)throw Error("No se pudo verificar el catálogo de precios");
 const csv=await r.text();
 if(csv.length>1500000)throw Error("Catálogo demasiado extenso");
 const rows=parseCSV(csv);if(rows.length<2)throw Error("El catálogo está vacío");
 const header=rows[0].map(normalizedCell),col=n=>header.indexOf(normalizedCell(n));
 const idx={active:col("Activo"),code:col("Código"),name:col("Producto"),price:col("Precio"),offer:col("Oferta")};
 if(Object.values(idx).some(i=>i<0))throw Error("Faltan columnas del catálogo");
 const catalog=new Map();
 for(const row of rows.slice(1)){
  const active=["SI","TRUE","1","X"].includes(normalizedCell(row[idx.active]));
  const code=String(row[idx.code]||"").trim();
  const name=String(row[idx.name]||"").trim();
  const regular=amountFromCell(row[idx.price]),offer=amountFromCell(row[idx.offer]);
  const current=offer>0?offer:regular;
  if(!active||!code||!name||!Number.isSafeInteger(current)||current<=0)continue;
  if(catalog.has(code))throw Error("Código duplicado en catálogo");
  catalog.set(code,{code,name,price:current});
 }
 if(catalog.size===0)throw Error("No hay artículos activos");
 return catalog;
}
const isUUID=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const POLAROID_SHEET_PRICE_ARS=3000;
async function ensurePolaroidProofs(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS polaroid_proofs (proof_token TEXT PRIMARY KEY,reference TEXT NOT NULL UNIQUE,client_order_id TEXT NOT NULL,photos INTEGER NOT NULL CHECK(photos BETWEEN 1 AND 60),sheets INTEGER NOT NULL CHECK(sheets BETWEEN 1 AND 10),created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS polaroid_redemptions (proof_token TEXT PRIMARY KEY REFERENCES polaroid_proofs(proof_token),order_id TEXT NOT NULL REFERENCES orders(id))").run();
}
async function createPolaroidProof(env,body,pilot=false){
 if(!body||!isUUID(body.client_order_id)||!/^POL-[A-F0-9]{24}$/.test(String(body.reference||""))||!/^[a-f0-9]{64}$/.test(String(body.uploadKey||"")))return {error:"Datos de recepción inválidos",status:400};
 // Validación de la recepción real, sin persistir ni devolver uploadKey.
 const receiptOrigin=pilot?"https://polaroids-integracion-sin-r2.libreriasaber.pages.dev":"https://libreriasaber.com.ar";
 const upstream=await fetch(receiptOrigin+"/api/polaroids-receiver?op=status",{
  method:"POST",headers:{"Origin":receiptOrigin,"Content-Type":"application/json"},
  body:JSON.stringify({reference:body.reference,uploadKey:body.uploadKey}),redirect:"manual",
  signal:AbortSignal.timeout(22000)
 });
 if(!upstream.ok)return {error:"No se pudo comprobar la recepción protegida de Polaroids",status:502};
 const status=await upstream.json();
 const photos=Number(status.photos),sheets=Number(status.sheets),received=Number(status.received);
 if(status.ok!==true||status.found!==true||status.status!=="received"||
    !Number.isInteger(photos)||photos<1||photos>60||!Number.isInteger(sheets)||sheets!==Math.ceil(photos/6)||
    sheets<1||sheets>10||received!==photos)
  return {error:"La recepción de fotografías todavía no está completa o confirmada",status:422};
 await ensurePolaroidProofs(env);
 const previous=await env.DB.prepare("SELECT proof_token,client_order_id,photos,sheets FROM polaroid_proofs WHERE reference=?").bind(body.reference).first();
 if(previous){
  if(previous.client_order_id!==body.client_order_id||previous.photos!==photos||previous.sheets!==sheets)
   return {error:"Esta recepción está asociada a otro intento de pedido",status:409};
  // Renovar vigencia solo después de volver a verificar la recepción en Google.
  await env.DB.prepare("UPDATE polaroid_proofs SET created_at=datetime('now') WHERE proof_token=?").bind(previous.proof_token).run();
  return {proof_token:previous.proof_token,reference:body.reference,photos,sheets,total_ars:sheets*POLAROID_SHEET_PRICE_ARS,idempotent:true};
 }
 const token=crypto.randomUUID();
 try{
  await env.DB.prepare("INSERT INTO polaroid_proofs(proof_token,reference,client_order_id,photos,sheets) VALUES(?,?,?,?,?)")
   .bind(token,body.reference,body.client_order_id,photos,sheets).run();
 }catch(e){
  // Una pestaña paralela pudo acreditar la misma recepción.
  const row=await env.DB.prepare("SELECT proof_token,client_order_id,photos,sheets FROM polaroid_proofs WHERE reference=?").bind(body.reference).first();
  if(!row||row.client_order_id!==body.client_order_id||row.photos!==photos||row.sheets!==sheets)throw e;
  return {proof_token:row.proof_token,reference:body.reference,photos,sheets,total_ars:sheets*POLAROID_SHEET_PRICE_ARS,idempotent:true};
 }
 return {proof_token:token,reference:body.reference,photos,sheets,total_ars:sheets*POLAROID_SHEET_PRICE_ARS,idempotent:false};
}
async function createCatalogCartOrder(env,body){
 if(!body||body.schema!=="saber-cart-v1"||body.currency!=="ARS"||body.paymentMode!=="FULL"||
    !Array.isArray(body.items)||body.items.length<1||body.items.length>100||!isUUID(body.client_order_id))
  return {error:"Carrito o identificador inválido",status:400};
 const intent=[],usedProofs=new Set();
 for(const item of body.items){
  if(!item||typeof item!=="object")return {error:"Artículo inválido",status:422};
  if(item.type==="product"){
   const code=String(item.code||"").trim(),qty=Number(item.qty);
   if(!code||code.length>80||!Number.isSafeInteger(qty)||qty<1||qty>500)return {error:"Código o cantidad inválidos",status:422};
   intent.push({type:"product",code,qty});
  }else if(item.type==="print"&&item.code==="POLAROID_A4"&&isUUID(item.proof_token)&&Number(item.qty)===1){
   if(usedProofs.has(item.proof_token))return {error:"Una misma recepción no puede incluirse dos veces",status:422};
   usedProofs.add(item.proof_token);
   intent.push({type:"polaroid",proof_token:item.proof_token,qty:1});
  }else return {error:"Este trabajo de gráfica requiere cotización o recepción validada por el servidor",status:422};
 }
 // Se fija la intención (SKU, cantidad y comprobante), no el precio mostrado en el dispositivo.
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(intent))));
 const hash=Array.from(digest,x=>x.toString(16).padStart(2,"0")).join("");
 await ensureOrderItems(env);
 await ensurePaymentReviews(env);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS cart_requests (client_order_id TEXT PRIMARY KEY, request_hash TEXT NOT NULL, order_id TEXT NOT NULL UNIQUE)").run();
 async function existingOrder(){
  const found=await env.DB.prepare("SELECT request_hash,order_id FROM cart_requests WHERE client_order_id=?").bind(body.client_order_id).first();
  if(!found)return null;
  if(found.request_hash!==hash)return {error:"Este identificador ya se utilizó con un carrito distinto",status:409};
  const order=await env.DB.prepare("SELECT amount_ars,status FROM orders WHERE id=?").bind(found.order_id).first();
  if(!order)return {error:"Inconsistencia de pedido",status:409};
  const review=await env.DB.prepare("SELECT state FROM payment_reviews WHERE order_id=?").bind(found.order_id).first();
  if(review?.state==="revoked")return {error:"El pago de este pedido requiere revisión privada",status:409};
  return {order_id:found.order_id,total_ars:order.amount_ars,currency:"ARS",idempotent:true,paid:order.status==="paid"};
 }
 const prior=await existingOrder();if(prior)return prior;
 if(usedProofs.size)await ensurePolaroidProofs(env);
 const catalog=intent.some(it=>it.type==="product")?await getCatalog():new Map();
 let total=0;const items=[];
 for(const item of intent){
  if(item.type==="product"){
   const p=catalog.get(item.code);
   if(!p)return {error:"Artículo inexistente o inactivo en el catálogo vigente",status:422};
   const subtotal=p.price*item.qty;
   if(!Number.isSafeInteger(subtotal)||subtotal>50000000)return {error:"Importe de prueba excedido",status:422};
   total+=subtotal;
   items.push({type:"product",code:p.code,title:p.name,qty:item.qty,price:p.price,subtotal,detail:"{}",references:"[]"});
  }else{
   const proof=await env.DB.prepare("SELECT reference,client_order_id,photos,sheets FROM polaroid_proofs WHERE proof_token=? AND created_at>=datetime('now','-24 hours')").bind(item.proof_token).first();
   if(!proof||proof.client_order_id!==body.client_order_id)return {error:"Constancia de recepción inexistente, vencida o ajena a este carrito",status:422};
   const subtotal=proof.sheets*POLAROID_SHEET_PRICE_ARS;
   total+=subtotal;
   items.push({type:"print",code:"POLAROID_A4",title:"Polaroids 85 × 90 mm · A4",qty:proof.sheets,
     price:POLAROID_SHEET_PRICE_ARS,subtotal,detail:JSON.stringify({photos:proof.photos,sheets:proof.sheets}),
     references:JSON.stringify([proof.reference]),proof_token:item.proof_token});
  }
  if(!Number.isSafeInteger(total)||total<=0||total>50000000)return {error:"Importe de prueba excedido",status:422};
 }
 const orderId=crypto.randomUUID();
 const stmts=[env.DB.prepare("INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)").bind(orderId,"Carrito Librería Saber · "+items.length+" trabajo(s)/artículo(s)",total,total)];
 items.forEach((it,i)=>{
  stmts.push(env.DB.prepare("INSERT INTO order_items(order_id,line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json) VALUES(?,?,?,?,?,?,?,?,?,?)")
   .bind(orderId,i+1,it.type,it.code,it.title,it.qty,it.price,it.subtotal,it.detail,it.references));
  if(it.proof_token)stmts.push(env.DB.prepare("INSERT INTO polaroid_redemptions(proof_token,order_id) VALUES(?,?)").bind(it.proof_token,orderId));
 });
 stmts.push(env.DB.prepare("INSERT INTO cart_requests(client_order_id,request_hash,order_id) VALUES(?,?,?)").bind(body.client_order_id,hash,orderId));
 try{await env.DB.batch(stmts)}
 catch(e){
  // Idempotencia ante reintentos concurrentes; UNIQUE evita volver a cobrar la misma recepción.
  const concurrent=await existingOrder();if(concurrent)return concurrent;
  return {error:"Recepción ya utilizada o pedido simultáneo; verificá el estado",status:409};
 }
 return {order_id:orderId,total_ars:total,currency:"ARS",idempotent:false,paid:false};
}

async function ensurePaymentReviews(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS payment_reviews(order_id TEXT PRIMARY KEY REFERENCES orders(id),state TEXT NOT NULL CHECK(state IN ('verified','revoked')),checked_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
}
async function ensureOrderItems(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS order_items (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,line_number INTEGER NOT NULL CHECK(line_number>=1 AND line_number<=100),item_type TEXT NOT NULL CHECK(item_type IN ('product','print')),sku TEXT,title TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),unit_price_ars INTEGER NOT NULL CHECK(unit_price_ars>0),line_total_ars INTEGER NOT NULL CHECK(line_total_ars>0),detail_json TEXT NOT NULL DEFAULT '{}',file_references_json TEXT NOT NULL DEFAULT '[]',PRIMARY KEY(order_id,line_number))").run();
}
// Un solo registro para comprobar la ejecucion automatica, sin Observability ni historial indefinido.
async function ensureCronHealth(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS cron_health (id INTEGER PRIMARY KEY CHECK(id=1),started_at TEXT,finished_at TEXT,status TEXT NOT NULL CHECK(status IN ('running','ok','errors','failed')),checked INTEGER NOT NULL DEFAULT 0,registered INTEGER NOT NULL DEFAULT 0,errors INTEGER NOT NULL DEFAULT 0)").run();
}
async function runScheduledReconciliation(env){
 await ensureCronHealth(env);
 await env.DB.prepare("INSERT INTO cron_health(id,started_at,finished_at,status,checked,registered,errors) VALUES(1,datetime('now'),NULL,'running',0,0,0) ON CONFLICT(id) DO UPDATE SET started_at=datetime('now'),finished_at=NULL,status='running',checked=0,registered=0,errors=0").run();
 try{
  const summary=await syncPendingPayments(env);
  await env.DB.prepare("UPDATE cron_health SET finished_at=datetime('now'),status=?,checked=?,registered=?,errors=? WHERE id=1")
   .bind(summary.errors?"errors":"ok",summary.checked,summary.registered,summary.errors).run();
  return summary;
 }catch(error){
  try{await env.DB.prepare("UPDATE cron_health SET finished_at=datetime('now'),status='failed',errors=1 WHERE id=1").run()}
  catch(e){console.error("Cron health update failed",String(e?.message||"unknown").slice(0,120))}
  throw error;
 }
}
async function audit(env,event,detail){
 try{
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS webhook_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), event TEXT NOT NULL, detail TEXT NOT NULL)").run();
  await env.DB.prepare("INSERT INTO webhook_audit(event,detail) VALUES(?,?)").bind(event,detail).run();
 }catch(e){console.error("Webhook audit failed",e?.message||"unknown")}
}
export default {
 async scheduled(event,env,ctx){
  ctx.waitUntil(runScheduledReconciliation(env).catch(e=>console.error("Scheduled payment sync failed",String(e?.message||"unknown").slice(0,120))));
 },
 async fetch(req,env){
  const url=new URL(req.url);
  if(url.pathname==="/demo/polaroids"&&req.method==="GET")return new Response(polaroidDemoHtml,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex,nofollow"}});
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
  if(!env.DB || !env.MP_TEST_ACCESS_TOKEN || !env.DEMO_ADMIN_KEY || !env.MP_TEST_SELLER_ID || !env.TEST_WEBHOOK_URL || !env.MP_WEBHOOK_SECRET)return json({error:"Falta configuración privada de pruebas. Consultar diagnóstico autorizado."},503);
  try {
   if(url.pathname==="/internal/central/polaroid-stage")return await centralPolaroidStage(req,env);
   if(url.pathname==="/internal/central/polaroid-prepare-order")return await centralPolaroidPrepareOrder(req,env);
   if(url.pathname==="/internal/central/stage")return await centralStage(req,env);
   if(url.pathname==="/internal/central/link")return await centralLink(req,env);
   if(url.pathname==="/internal/central/prepare-order")return await centralPrepareDraft(req,env);
   if(url.pathname.startsWith("/checkout/"))return await customerCheckout(req,env,this);
   // Solo un operador que conoce DEMO_ADMIN_KEY puede preparar un pedido ficticio.
   if(url.pathname==="/admin/api/cron-status"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await ensureCronHealth(env);
    const lastRun=await env.DB.prepare("SELECT started_at,finished_at,status,checked,registered,errors FROM cron_health WHERE id=1").first();
    return json({lastRun,periodMinutes:10,note:"Solo ejecuciones programadas; no cuenta las verificaciones manuales."});
   }
   if(url.pathname==="/admin/api/orders"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await ensurePaymentReviews(env);
    const rows=await env.DB.prepare("SELECT id,description,amount_ars,status,paid_at,created_at FROM orders WHERE status='paid' AND deposit_ars=amount_ars AND NOT EXISTS (SELECT 1 FROM payment_reviews WHERE order_id=orders.id AND state='revoked') ORDER BY paid_at DESC LIMIT 100").all();
    return json({orders:rows.results});
   }
   if(url.pathname==="/admin/api/central/unpaid"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await centralTables(env);await ensurePaymentReviews(env);
    const rows=await env.DB.prepare("SELECT m.web_order_id,m.commercial_order_id,m.amount_ars AS documents_ars,m.file_count,o.amount_ars AS order_ars,o.status,o.created_at FROM central_document_manifests m JOIN orders o ON o.id=m.commercial_order_id WHERE m.commercial_order_id IS NOT NULL AND (o.status!='paid' OR EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id AND p.state='revoked')) ORDER BY o.created_at DESC LIMIT 50").all();
    return json({estado:"PEDIDOS_DOCUMENTALES_SIN_PAGO_CONFIRMADO",orders:rows.results||[],productionAuthorized:false});
   }
   if(url.pathname==="/admin/api/central/polaroid-pdf"&&req.method==="GET"){
    return await centralPolaroidDownload(req,env,url.searchParams.get("reference")||"");
   }
   if(url.pathname==="/admin/api/central/polaroids"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await centralPolaroidTable(env);
    const rows=await env.DB.prepare("SELECT reference,photos,sheets,amount_ars,created_at,commercial_order_id FROM central_polaroids_express ORDER BY created_at DESC LIMIT 50").all();
    return json({estado:"POLAROIDS_PDF_FINAL_VERIFICADO_PAGO_PENDIENTE",
     manifests:(rows.results||[]).map(x=>({referencia:x.reference,
      fotos:x.photos,hojas:x.sheets,importe:x.amount_ars,
      recibido:x.created_at,vinculado:Boolean(x.commercial_order_id),
      pedidoComercial:x.commercial_order_id||null})),
     paymentAuthorized:false,listoParaProducir:false});
   }
   if(url.pathname==="/admin/api/central/pending"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await centralTables(env);
    const rows=await env.DB.prepare("SELECT web_order_id,amount_ars,file_count,created_at FROM central_document_manifests WHERE commercial_order_id IS NULL ORDER BY created_at DESC LIMIT 50").all();
    return json({estado:"DOCUMENTOS_VERIFICADOS_SIN_PEDIDO_COMERCIAL",
      manifests:rows.results||[],productionAuthorized:false});
   }
   if(url.pathname==="/admin/api/order"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const id=url.searchParams.get("id")||"";
    if(!/^[a-f0-9-]{36}$/i.test(id))return json({error:"ID de pedido inválido"},400);
    await ensurePaymentReviews(env);
    const order=await env.DB.prepare("SELECT id,description,amount_ars,deposit_ars,status,paid_at,created_at,payment_id FROM orders WHERE id=? AND status='paid' AND deposit_ars=amount_ars AND NOT EXISTS (SELECT 1 FROM payment_reviews WHERE order_id=orders.id AND state='revoked')").bind(id).first();
    if(!order)return json({error:"Pedido pagado no encontrado"},404);
    await ensureOrderItems(env);
    const rows=await env.DB.prepare("SELECT line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json FROM order_items WHERE order_id=? ORDER BY line_number").bind(id).all();
    const central=await centralAdminDetail(env,id);
    const produccion=estadoProduccionPrivado(order,rows.results);
    if(central)produccion.documentosVerificados=central;
    const express=await centralPolaroidDetail(env,id);
    if(express){express.pagoConfirmado=true;produccion.polaroidsExpress=express;}
    return json({order,items:rows.results,produccion});
   }
   if(url.pathname==="/demo/catalog"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const products=Array.from((await getCatalog()).values()).slice(0,30);
    return json({currency:"ARS",products,note:"Catálogo vigente; disponibilidad sujeta a confirmación."});
   }
   if(["/demo/polaroid-proof","/demo/polaroid-proof-pilot"].includes(url.pathname)&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const body=await req.json().catch(()=>null);
    const proof=await createPolaroidProof(env,body,url.pathname==="/demo/polaroid-proof-pilot");
    if(proof.error)return json({error:proof.error},proof.status);
    return json(proof,proof.idempotent?200:201);
   }
   if(url.pathname==="/demo/cart-order"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const data=await req.json().catch(()=>null);
    const result=await createCatalogCartOrder(env,data);
    if(result.error)return json({error:result.error},result.status);
    return json(result,result.idempotent?200:201);
   }
   if(url.pathname==="/demo/order"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"La clave de acceso del demo no coincide con DEMO_ADMIN_KEY en Cloudflare. No ingreses el nombre de la variable."},401);
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)").bind(id,"Pedido ficticio de prueba",10000,10000).run();
    return json({id,total:10000,amount_to_pay:10000},201);
   }
   if(url.pathname==="/demo/checkout"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const body=await req.json().catch(()=>null);
    const orderId=body?.order_id;
    if(!isUUID(orderId))return json({error:"order_id inválido"},400);
    const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first();
    if(!order)return json({error:"Pedido no encontrado"},404);
    if(order.description==="Librería Saber · documentos verificados y tienda")return json({error:"Cobro de documentos aún no habilitado. Falta el ensayo integral."},503);
    if(order.description==="Librería Saber · Polaroids Express y tienda")return json({error:"Cobro de Polaroids Express aún no habilitado. Falta el ensayo integral."},503);
    if(order.status!=="awaiting_payment")return json({error:"El pedido ya está pago"},409);
    const expiresAt=new Date(String(order.created_at).replace(" ","T")+"Z").getTime()+24*60*60*1000;
    if(!Number.isFinite(expiresAt)||Date.now()>=expiresAt)return json({error:"La cotización venció; prepará un nuevo pedido"},409);
    if(order.deposit_ars!==order.amount_ars)return json({error:"El pedido anterior no corresponde a la modalidad de pago total"},409);
    async function returnPreference(id,reused){
     const preference=await mp(env,"/checkout/preferences/"+esc(id));
     if(String(preference.external_reference||"")!==order.id)return json({error:"Preferencia incompatible con este pedido"},409);
     const checkoutUrl=preference.sandbox_init_point||preference.init_point;
     if(!/^https:\/\//.test(String(checkoutUrl||"")))return json({error:"Mercado Pago no devolvió un enlace válido"},502);
     return json({order_id:order.id,checkout_url:checkoutUrl,preference_id:id,reused});
    }
    if(order.preference_id)return returnPreference(order.preference_id,true);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS checkout_locks(order_id TEXT PRIMARY KEY,expires_at TEXT NOT NULL)").run();
    const lock=await env.DB.prepare("INSERT INTO checkout_locks(order_id,expires_at) VALUES(?,datetime('now','+90 seconds')) ON CONFLICT(order_id) DO UPDATE SET expires_at=excluded.expires_at WHERE checkout_locks.expires_at<datetime('now')").bind(order.id).run();
    if(!lock.meta?.changes)return json({error:"El pago se está preparando. Esperá unos segundos y reintentá."},409);
    try{
    const latest=await env.DB.prepare("SELECT preference_id,status FROM orders WHERE id=?").bind(order.id).first();
    if(latest?.preference_id)return returnPreference(latest.preference_id,true);
    // Persistir el intento ANTES de salir a Mercado Pago. Si la respuesta se pierde,
    // buscar la preferencia remota; jamás volver a crearla a ciegas.
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS checkout_attempts(order_id TEXT PRIMARY KEY,started_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    const attempted=await env.DB.prepare("INSERT OR IGNORE INTO checkout_attempts(order_id) VALUES(?)").bind(order.id).run();
    if(!attempted.meta?.changes){
     const found=await mp(env,"/checkout/preferences/search?"+new URLSearchParams({external_reference:order.id}));
     const candidates=(found.elements||[]).filter(p=>String(p.external_reference||"")===order.id);
     if(candidates.length!==1||!candidates[0].id)return json({error:"El intento de pago requiere conciliación. No se generará otro enlace hasta verificarlo."},409);
     const recovered=await mp(env,"/checkout/preferences/"+esc(candidates[0].id));
     const amount=(recovered.items||[]).reduce((sum,p)=>sum+Number(p.unit_price)*Number(p.quantity),0);
     if(String(recovered.external_reference)!==order.id||amount!==order.amount_ars||!recovered.items?.every(p=>p.currency_id==="ARS"))return json({error:"La preferencia recuperada requiere revisión privada"},409);
     await env.DB.prepare("UPDATE orders SET preference_id=? WHERE id=? AND preference_id IS NULL AND status='awaiting_payment'").bind(recovered.id,order.id).run();
     return returnPreference(recovered.id,true);
    }
    const preference=await mp(env,"/checkout/preferences",{method:"POST",headers:{"X-Idempotency-Key":order.id},body:JSON.stringify({
      items:[{id:order.id,title:String(order.description||"Pago total Librería Saber").slice(0,120),quantity:1,currency_id:"ARS",unit_price:order.amount_ars}],
      external_reference:order.id,
      notification_url:env.TEST_WEBHOOK_URL,
      ...(env.CHECKOUT_RETURN_URL?{back_urls:{success:env.CHECKOUT_RETURN_URL,pending:env.CHECKOUT_RETURN_URL,failure:env.CHECKOUT_RETURN_URL}}:{}),
      expires:true,expiration_date_to:new Date(expiresAt).toISOString(),
      metadata:{purpose:"libreria_saber_demo",payment_mode:"full"}
    })});
    if(!preference.id)return json({error:"Mercado Pago no devolvió el identificador de preferencia"},502);
    const updated=await env.DB.prepare("UPDATE orders SET preference_id=? WHERE id=? AND preference_id IS NULL AND status='awaiting_payment'").bind(preference.id,order.id).run();
    // Si dos pestañas prepararon un checkout al mismo tiempo, usar siempre
    // la preferencia que quedó persistida, nunca ofrecer la descartada.
    if(!updated.meta?.changes){
     const saved=await env.DB.prepare("SELECT preference_id,status FROM orders WHERE id=?").bind(order.id).first();
     if(saved?.status!=="awaiting_payment"||!saved.preference_id)return json({error:"El estado del pedido cambió; actualizá la pantalla"},409);
     return returnPreference(saved.preference_id,true);
    }
    const checkoutUrl=preference.sandbox_init_point||preference.init_point;
    if(!/^https:\/\//.test(String(checkoutUrl||"")))return json({error:"Mercado Pago no devolvió un enlace válido"},502);
    return json({order_id:order.id,checkout_url:checkoutUrl,preference_id:preference.id,reused:false});
    }finally{await env.DB.prepare("DELETE FROM checkout_locks WHERE order_id=?").bind(order.id).run()}
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
      paymentEnvironmentAllowed:await paymentEnvironmentAllowed(env,pay).catch(()=>false),
      currency:pay.currency_id==="ARS",
      orderExists:Boolean(order),
      paymentPreferenceMatches:Boolean(order&&pay.preference_id&&String(pay.preference_id)===String(order.preference_id)),
      merchantOrderPreferenceMatches:Boolean(order&&merchantOrder&&String(merchantOrder.preference_id)===String(order.preference_id)),
      merchantOrderReferencesPedido:Boolean(order&&merchantOrder&&String(merchantOrder.external_reference)===String(order.id)),
      merchantOrderContainsPayment:Boolean(merchantOrder?.payments?.some(p=>String(p.id)===String(pay.id))),
      amountMatches:Boolean(order&&Number(pay.transaction_amount)===order.deposit_ars),
      sellerMatches:String(pay.collector_id)===String(env.MP_TEST_SELLER_ID)
    };
    return json({checks,paymentPreferencePresent:Boolean(pay.preference_id),merchantOrderPresent:Boolean(merchantOrder),merchantOrderError,orderStatus:order?.status||null,note:"Solo diagnóstico. La preferencia se valida con la orden comercial; live_mode=true requiere vendedor marcado test_user por la API. No altera el pedido."});
   }
   if(url.pathname==="/demo/sync-pending"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    return json(await syncPendingPayments(env));
   }
   if(url.pathname==="/demo/paid-orders"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"La clave de acceso del demo no coincide con DEMO_ADMIN_KEY en Cloudflare. No ingreses el nombre de la variable."},401);
    await ensurePaymentReviews(env);
    const rows=await env.DB.prepare("SELECT id,description,amount_ars,deposit_ars,status,paid_at FROM orders WHERE status='paid' AND NOT EXISTS (SELECT 1 FROM payment_reviews WHERE order_id=orders.id AND state='revoked') ORDER BY paid_at DESC LIMIT 100").all();
    return json({orders:rows.results});
   }
   return json({error:"No encontrado"},404);
  }catch(e){return json({error:"Error de integración; consultar registros privados"},502)}
 }
};

// Pasarela preparada, APAGADA por defecto. Solo accesible desde el proxy con secreto de servicio.
// La clave administrativa nunca llega al navegador. Cada sesión queda ligada a un intento.
async function customerCheckout(req,env,worker){
 if(env.CHECKOUT_RETURN_URL){
  try{const u=new URL(env.CHECKOUT_RETURN_URL);if(u.origin!=="https://"+env.CHECKOUT_HOST||u.pathname!=="/pedido-pago.html")return json({error:"Retorno de pago no configurado"},503)}catch{return json({error:"Retorno de pago no configurado"},503)}
 }
 if(!env.CHECKOUT_RETURN_URL||env.CHECKOUT_ENABLED!=="APROBADO"||!env.CHECKOUT_GATEWAY_KEY||!env.TURNSTILE_SECRET_KEY||
    !env.CHECKOUT_HOST||!env.CHECKOUT_RATE_LIMIT||req.headers.get("x-checkout-gateway")!==env.CHECKOUT_GATEWAY_KEY)
  return json({error:"Pagos online todavía no habilitados"},503);
 if(req.method!=="POST")return json({error:"Método no admitido"},405);
 const ip=req.headers.get("x-checkout-client-ip");
 if(!ip)return json({error:"Origen de sesión no comprobable"},403);
 const limit=await env.CHECKOUT_RATE_LIMIT.limit({key:ip});
 if(!limit.success)return json({error:"Demasiados intentos. Esperá un momento."},429);
 let raw=await req.text();if(raw.length>64000)return json({error:"Solicitud demasiado extensa"},413);
 let body;try{body=JSON.parse(raw)}catch{return json({error:"Solicitud inválida"},400)}
 if(!body||!isUUID(body.client_order_id))return json({error:"Intento de pedido inválido"},400);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS checkout_sessions(token_hash TEXT PRIMARY KEY,client_order_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,"0")).join("");
 const path=new URL(req.url).pathname;
 if(path==="/checkout/session"){
  if(typeof body.turnstileToken!=="string"||body.turnstileToken.length>4096)return json({error:"Completá la verificación de seguridad"},400);
  const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:body.turnstileToken,remoteip:ip}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)return json({error:"Verificación de seguridad no disponible"},502);
  const check=await r.json();
  if(check.success!==true||check.hostname!==env.CHECKOUT_HOST||check.action!=="checkout")return json({error:"Verificación de seguridad rechazada"},403);
  const token=crypto.randomUUID()+crypto.randomUUID();
  await env.DB.batch([
   env.DB.prepare("DELETE FROM checkout_sessions WHERE created_at<datetime('now','-24 hours')"),
   env.DB.prepare("INSERT INTO checkout_sessions(token_hash,client_order_id) VALUES(?,?)").bind(await hash(token),body.client_order_id)
  ]);
  return json({session_token:token},201);
 }
 const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer /,"");
 if(!/^[0-9a-f-]{72}$/i.test(bearer))return json({error:"Sesión de compra requerida"},401);
 const session=await env.DB.prepare("SELECT client_order_id FROM checkout_sessions WHERE token_hash=? AND created_at>=datetime('now','-24 hours')").bind(await hash(bearer)).first();
 if(!session||session.client_order_id!==body.client_order_id)return json({error:"Sesión vencida o ajena al pedido"},401);
 const cart=await env.DB.prepare("SELECT order_id FROM cart_requests WHERE client_order_id=?").bind(body.client_order_id).first();
 if(path==="/checkout/status"){
  if(!cart)return json({state:"draft"});
  await ensurePaymentReviews(env);
  const order=await env.DB.prepare("SELECT amount_ars,status FROM orders WHERE id=?").bind(cart.order_id).first();
  const review=await env.DB.prepare("SELECT state FROM payment_reviews WHERE order_id=?").bind(cart.order_id).first();
  return json({order_id:cart.order_id,total_ars:order.amount_ars,state:review?.state==="revoked"?"review":order.status});
 }
 let target;
 if(path==="/checkout/polaroid-proof")target="/demo/polaroid-proof";
 else if(path==="/checkout/cart-order")target="/demo/cart-order";
 else if(path==="/checkout/pay"){
  if(!cart||cart.order_id!==body.order_id)return json({error:"Pedido ajeno a esta sesión"},403);
  target="/demo/checkout";
 }else return json({error:"Operación desconocida"},404);
 return worker.fetch(new Request(new URL(target,req.url),{method:"POST",headers:{Authorization:"Bearer "+env.DEMO_ADMIN_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)}),env);
}
