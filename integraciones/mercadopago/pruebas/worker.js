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
     !Number.isSafeInteger(r.bytes)||r.bytes<5||r.bytes>40*1024*1024||
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
  const medidasOriginalesCm=w.formatoFinal==="personalizado_a4"&&
    Array.isArray(w.medidasOriginalesCm)&&
    w.medidasOriginalesCm.length===w.paginasElegidas.length&&
    w.medidasOriginalesCm.every((p,i)=>p&&p.pagina===w.paginasElegidas[i]&&
     Number.isFinite(p.anchoCm)&&Number.isFinite(p.altoCm)&&p.anchoCm>0&&p.altoCm>0&&
     Math.min(p.anchoCm,p.altoCm)<=21.1&&Math.max(p.anchoCm,p.altoCm)<=29.8)
     ?w.medidasOriginalesCm.map(p=>({pagina:p.pagina,anchoCm:p.anchoCm,altoCm:p.altoCm})):null;
  if(w.formatoFinal==="personalizado_a4"&&!medidasOriginalesCm)
   throw Error("Faltan medidas originales verificadas en la orden.");
  // El motor de precios YA verificó medidas, modo CAD/Póster y rollo de
  // CADA página. No descartarlos al escribir el manifiesto inmutable D1.
  const planoPorPagina=w.servicio==="ploteos"&&
   Array.isArray(w.planoPorPagina)&&
   w.planoPorPagina.length===w.paginasElegidas.length&&
   w.planoPorPagina.every((p,i)=>p&&
    p.numeroOriginal===w.paginasElegidas[i]&&
    ["cad","poster"].includes(p.modo)&&
    Number.isFinite(p.anchoCm)&&Number.isFinite(p.altoCm)&&
    p.anchoCm>0&&p.altoCm>0&&p.anchoCm<=2000&&p.altoCm<=2000&&
    typeof p.rollo==="string"&&/^(rollo|rec)\d+$/.test(p.rollo)&&
    ["obra80","recubierto"].includes(p.papel)&&
    (p.modo!=="cad"||(p.papel==="obra80"&&/^rollo\d+$/.test(p.rollo))))
   ?w.planoPorPagina.map(p=>({numeroOriginal:p.numeroOriginal,modo:p.modo,
     anchoCm:p.anchoCm,altoCm:p.altoCm,rollo:p.rollo,papel:p.papel})):null;
  if(w.servicio==="ploteos"&&!planoPorPagina)
   throw Error("Faltan las instrucciones verificadas de CAD/Póster por página.");
  return {
   orden:w.orden,idTrabajo:w.idTrabajo,servicio:w.servicio,
   nombreOriginal:w.nombreOriginal,fileId:w.fileId,
   reciboPrivado:r.receiptId,sha256:r.sha256,paginasOriginales:r.pages,
   bytes:r.bytes,paginasElegidas:[...w.paginasElegidas],
   copias:copies??null,formatoFinal:texto(w.formatoFinal),
   tarifaAplicada:w.formatoFinal==='personalizado_a4'?'a4':texto(w.tarifaAplicada),
   medidasOriginalesCm,planoPorPagina,
   carasPresupuestadas:w.servicio==="documentos"?(w.carasPresupuestadas??null):null,
   paginasPorCaraPresupuestadas:w.servicio==="documentos"?(w.paginasPorCaraPresupuestadas??null):null,
   // Conservar sólo el anillado de la ficha VERIFICADA por el servidor.
   // Para recibos históricos sin este dato, null (jamás inferir "ninguno").
   tipoAnillado:w.servicio==="documentos"&&
     ["ninguno","individual","grupo"].includes(w.tipoAnillado)?w.tipoAnillado:null,
   grupoAnillado:w.servicio==="documentos"&&w.tipoAnillado==="grupo"&&
     /^[1-9][0-9]?$/.test(String(w.grupoAnillado||""))?String(w.grupoAnillado):null,
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
 // D1 asigna secuencia única transaccional: jamás derivar el N.º de una lista.
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_work_order_numbers (number INTEGER PRIMARY KEY AUTOINCREMENT,commercial_order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,assigned_at TEXT NOT NULL DEFAULT (datetime('now')) )").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_document_manifests (web_order_id TEXT PRIMARY KEY,commercial_order_id TEXT UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,amount_ars INTEGER NOT NULL CHECK(amount_ars>0 AND amount_ars<=50000000),file_count INTEGER NOT NULL CHECK(file_count BETWEEN 1 AND 30),manifest_hash TEXT NOT NULL,manifest_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'verified_waiting_order' CHECK(status IN ('verified_waiting_order','linked_waiting_payment','linked_paid_pending_preparation')),created_at TEXT NOT NULL DEFAULT (datetime('now')),linked_at TEXT)").run();
 await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_central_manifests_commercial_order ON central_document_manifests(commercial_order_id)").run();
 // Aprobación R2 inmóvil y asociada a la orden, nunca a la ruta R2 del navegador.
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_r2_prepress_approvals ("+
  "order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,"+
  "receipt_id TEXT NOT NULL UNIQUE REFERENCES central_r2_large_pending(receipt_id),"+
  "sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,quote_sha256 TEXT NOT NULL,"+
  "amount_ars INTEGER NOT NULL,measured_json TEXT NOT NULL,operator TEXT NOT NULL,"+
  "notes TEXT NOT NULL,approved_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_order_contacts (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,phone TEXT NOT NULL CHECK(length(phone) BETWEEN 10 AND 26),created_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_order_customer_details (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 100),address TEXT NOT NULL DEFAULT '' CHECK(length(address)<=180),created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_bridge_requests (request_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,action TEXT NOT NULL CHECK(action IN ('stage','link')),created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_document_receipts (receipt_id TEXT PRIMARY KEY,web_order_id TEXT NOT NULL REFERENCES central_document_manifests(web_order_id) ON DELETE CASCADE,file_id TEXT NOT NULL,sha256 TEXT NOT NULL,UNIQUE(web_order_id,file_id))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_document_print_drafts (receipt_id TEXT PRIMARY KEY,web_order_id TEXT NOT NULL REFERENCES central_document_manifests(web_order_id) ON DELETE CASCADE,file_id TEXT NOT NULL,original_receipt_id TEXT NOT NULL UNIQUE REFERENCES central_document_receipts(receipt_id) ON DELETE RESTRICT,sha256 TEXT NOT NULL CHECK(length(sha256)=64),bytes INTEGER NOT NULL CHECK(bytes BETWEEN 100 AND 20971520),pages INTEGER NOT NULL CHECK(pages BETWEEN 1 AND 2000),status TEXT NOT NULL DEFAULT 'stored_private_unpaid' CHECK(status='stored_private_unpaid'),created_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(web_order_id,file_id))").run();
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
 const maxSignedChars=new URL(req.url).pathname==="/internal/central/r2-universal-draft"
  ?512000:32000;
 if(raw.length<10||raw.length>maxSignedChars)
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
/** Probe de firma, únicamente pruebas: jamás consulta/escribe D1 ni genera pedido. */
async function centralBridgeProbe(req,env){
 if(env.CENTRAL_BRIDGE_PROBE_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({ok:false,reason:"probe_disabled",paymentAuthorized:false},503);
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({ok:false,reason:"signature_rejected",paymentAuthorized:false},signed.status);
 const body=signed.payload;
 if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).sort().join(",")!=="challenge,operation,schema"||
    body.schema!=="saber-central-bridge-probe-v1"||
    body.operation!=="verify-only"||
    typeof body.challenge!=="string"||
    !CENTRAL_UUID.test(body.challenge)||
    signed.requestId!==body.challenge)
  return json({ok:false,reason:"probe_invalid",paymentAuthorized:false},422);
 return json({ok:true,schema:"saber-central-bridge-probe-v1",
  challenge:body.challenge,verifiedSignature:true,dbTouched:false,
  orderCreated:false,paymentAuthorized:false,checkoutEnabled:false},200);
}
/** Consulta exclusiva entre Workers: recibo TUS perteneciente a un pedido D1.
 * Prohíbe descargar un archivo no registrado o con metadatos incompatibles.
 */
async function centralTUSFilesPurged(env,webOrderId){
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='central_tus_purge_queue'").first();
 if(!exists)return false;
 const row=await env.DB.prepare("SELECT state FROM central_tus_purge_queue WHERE web_order_id=?").bind(webOrderId).first();
 return row?.state==='completed';
}
async function centralTUSReceiptLookup(req,env){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({ok:false,error:"Consulta privada no autorizada",paymentAuthorized:false},signed.status);
 const p=signed.payload;
 if(!p||typeof p!=="object"||Array.isArray(p)||
    Object.keys(p).sort().join(",")!=="receiptId,schema,webOrderId"||
    p.schema!=="saber-central-tus-recibo-lookup-v1"||
    !CENTRAL_WEB.test(p.webOrderId||"")||
    !CENTRAL_RECEIPT.test(p.receiptId||""))
  return json({ok:false,found:false,paymentAuthorized:false},422);
 if(await centralTUSFilesPurged(env,p.webOrderId))
  return json({ok:false,found:false,error:"Archivos eliminados al entregar",paymentAuthorized:false},410);
 await centralTables(env);
 const row=await env.DB.prepare(
  "SELECT r.file_id,r.sha256,m.manifest_json FROM central_document_receipts r "+
  "INNER JOIN central_document_manifests m ON m.web_order_id=r.web_order_id "+
  "WHERE r.web_order_id=? AND r.receipt_id=? LIMIT 1"
 ).bind(p.webOrderId,p.receiptId).first();
 if(!row)return json({ok:false,found:false,paymentAuthorized:false},404);
 let parsed;
 try{parsed=JSON.parse(row.manifest_json)}catch(_){return json({ok:false,found:false,paymentAuthorized:false},409)}
 const matches=Array.isArray(parsed?.trabajos)?
  parsed.trabajos.filter(t=>t.reciboPrivado===p.receiptId&&t.fileId===row.file_id&&
   t.sha256===row.sha256):[];
 if(matches.length!==1)return json({ok:false,found:false,paymentAuthorized:false},409);
 const t=matches[0];
 if(!Number.isSafeInteger(t.bytes)||t.bytes<5||t.bytes>40*1024*1024||
    !Number.isSafeInteger(t.paginasOriginales)||t.paginasOriginales<1||t.paginasOriginales>2000||
    !CENTRAL_HEX.test(row.sha256)||typeof t.nombreOriginal!=="string"||
    t.nombreOriginal.length<1||t.nombreOriginal.length>180)
  return json({ok:false,found:false,paymentAuthorized:false},409);
 return json({ok:true,found:true,schema:"saber-central-tus-recibo-lookup-v1",
   webOrderId:p.webOrderId,receiptId:p.receiptId,fileId:row.file_id,
   sha256:row.sha256,bytes:t.bytes,pages:t.paginasOriginales,
   name:t.nombreOriginal,paymentAuthorized:false,listoParaProducir:false
 },200);
}

/**
 * Consulta firmada entre Workers de la ficha completa del paquete.
 * Protegida por el mismo HMAC que D1 receipt-check; nunca incluye bytes,
 * enlaces de Storage, claves de Supabase, autorización de pago o producción.
 */

/**
 * Plan firmado de eliminación de originales TUS: lectura de D1 solamente.
 * ÚNICAMENTE para otro Worker con HMAC; no borra archivos ni expone contenido.
 * La orden debe estar entregada, totalmente pagada y verificada.
 */
async function centralTUSDeliveryPurgePlan(req,env){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({ok:false,error:"Acceso privado no autorizado"},signed.status);
 const p=signed.payload;
 if(!p||typeof p!=="object"||Array.isArray(p)||
    Object.keys(p).sort().join(",")!=="schema,webOrderId"||
    p.schema!=="saber-central-tus-purge-plan-v1"||
    !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(p.webOrderId||""))
  return json({ok:false,error:"Pedido TUS inválido"},422);
 await centralTables(env);
 await centralProductionTables(env);
 await ensurePaymentReviews(env);
 const row=await env.DB.prepare(
  "SELECT m.web_order_id,m.commercial_order_id,m.manifest_json,m.file_count,m.created_at AS manifest_created_at,"+
  "o.status AS payment_status,o.paid_at,o.amount_ars,o.deposit_ars,"+
  "p.state AS production_state,p.version AS production_version,p.updated_at AS delivered_at "+
  "FROM central_document_manifests m JOIN orders o ON o.id=m.commercial_order_id "+
  "JOIN central_production_status p ON p.order_id=o.id "+
  "WHERE m.web_order_id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
  "AND o.deposit_ars=o.amount_ars AND p.state='entregado' "+
  "AND EXISTS (SELECT 1 FROM payment_reviews r WHERE r.order_id=o.id AND r.state='verified') LIMIT 1"
 ).bind(p.webOrderId).first();
 if(!row||!centralPurgeCanaryAllowed(env,p.webOrderId,row.manifest_created_at)||
     !Number.isSafeInteger(row.production_version)||row.production_version<1)
  return json({ok:false,error:"Pedido no entregado o pago sin verificar"},409);
 const receipts=await env.DB.prepare(
  "SELECT r.receipt_id,r.file_id,r.sha256 FROM central_document_receipts r "+
  "WHERE r.web_order_id=? ORDER BY r.receipt_id"
 ).bind(p.webOrderId).all();
 const list=receipts.results||[];
 let manifest;
 try{manifest=JSON.parse(row.manifest_json)}catch{return json({ok:false,error:"Manifiesto ilegible"},409)}
 if(manifest?.schema!=="saber-central-documentos-d1-v1"||
   manifest.webOrderId!==row.web_order_id||!Array.isArray(manifest.trabajos)||
   manifest.trabajos.length!==row.file_count||list.length!==row.file_count||
   row.file_count<1||row.file_count>10)
  return json({ok:false,error:"Manifiesto de archivos incompatible"},409);
 const byReceipt=new Map(manifest.trabajos.map(t=>[t.reciboPrivado,t]));
 const used=new Set(),files=[];
 for(const r of list){
  const t=byReceipt.get(r.receipt_id);
  if(!CENTRAL_RECEIPT.test(r.receipt_id||"")||
     !CENTRAL_FILE.test(r.file_id||"")||!CENTRAL_HEX.test(r.sha256||"")||
     used.has(r.receipt_id)||!t||t.fileId!==r.file_id||t.sha256!==r.sha256||
     !Number.isSafeInteger(t.bytes)||t.bytes<5||t.bytes>40*1024*1024)
   return json({ok:false,error:"Archivos no coinciden con el pedido"},409);
  used.add(r.receipt_id);
  files.push({receiptId:r.receipt_id,fileId:r.file_id,sha256:r.sha256,bytes:t.bytes});
 }
 if(used.size!==manifest.trabajos.length)
  return json({ok:false,error:"Recibos incompletos"},409);
 return json({ok:true,schema:"saber-central-tus-purge-plan-v1",
   webOrderId:row.web_order_id,commercialOrderId:row.commercial_order_id,
   productionState:row.production_state,productionVersion:row.production_version,
   deliveredAt:row.delivered_at,manifestCreatedAt:row.manifest_created_at||null,paymentVerified:true,files,
   deletionExecuted:false,retentionDays:0},200);
}

async function centralTUSPackageManifest(req,env){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({ok:false,error:"Acceso privado no autorizado"},signed.status);
 const p=signed.payload;
 if(!p||typeof p!=="object"||Array.isArray(p)||
    Object.keys(p).sort().join(",")!=="schema,webOrderId"||
    p.schema!=="saber-central-tus-package-v1"||
    !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(p.webOrderId||""))
  return json({ok:false,error:"Pedido TUS inválido"},422);
 if(await centralTUSFilesPurged(env,p.webOrderId))
  return json({ok:false,error:"Los archivos se eliminaron al entregar",paymentAuthorized:false},410);
 await centralTables(env);
 const row=await env.DB.prepare(
  "SELECT m.web_order_id,m.commercial_order_id,m.manifest_json,m.amount_ars,m.file_count,o.status,n.number,"+
  "c.phone AS telefonoContacto,d.name AS nombreCliente,d.address AS direccionCliente "+
  "FROM central_document_manifests m JOIN orders o ON o.id=m.commercial_order_id "+
  "JOIN central_work_order_numbers n ON n.commercial_order_id=o.id "+
  "LEFT JOIN central_order_contacts c ON c.order_id=o.id "+
  "LEFT JOIN central_order_customer_details d ON d.order_id=o.id "+
  "WHERE m.web_order_id=? LIMIT 1"
 ).bind(p.webOrderId).first();
 if(!row||!Number.isSafeInteger(row.number)||row.number<=0)
  return json({ok:false,error:"Orden no numerada o inexistente"},404);
 let data;
 try{data=JSON.parse(row.manifest_json)}catch{return json({ok:false,error:"Ficha D1 ilegible"},409)}
 if(data?.schema!=="saber-central-documentos-d1-v1"||
    data.webOrderId!==p.webOrderId||
    !Array.isArray(data.trabajos)||data.trabajos.length!==row.file_count||
    data.trabajos.length<1||data.trabajos.length>30)
  return json({ok:false,error:"Ficha de orden incongruente"},409);
 const trabajos=data.trabajos.map(t=>({
  orden:t.orden,nombreOriginal:t.nombreOriginal,reciboPrivado:t.reciboPrivado,
  servicio:t.servicio,paginasOriginales:t.paginasOriginales,
  paginasElegidas:t.paginasElegidas,copias:t.copias,formatoFinal:t.formatoFinal,
  tarifaAplicada:t.tarifaAplicada,medidasOriginalesCm:t.medidasOriginalesCm,
  planoPorPagina:t.planoPorPagina,
  carasPresupuestadas:t.carasPresupuestadas,
  paginasPorCaraPresupuestadas:t.paginasPorCaraPresupuestadas,
  modo:t.modo,material:t.material,tipoAnillado:t.tipoAnillado,
  grupoAnillado:t.grupoAnillado,
  descripcion:t.descripcion,bytes:t.bytes
 }));
 if(trabajos.some(t=>!CENTRAL_RECEIPT.test(t.reciboPrivado||"")||
    typeof t.nombreOriginal!=="string"||t.nombreOriginal.length>180||
    !Number.isSafeInteger(t.orden)||t.orden<1||
    !Number.isSafeInteger(t.bytes)||t.bytes<5||t.bytes>40*1024*1024)||
    new Set(trabajos.map(t=>t.reciboPrivado)).size!==trabajos.length)
  return json({ok:false,error:"Ficha incompleta"},409);
 // El ZIP usa únicamente originales verificados. El estado PAGADO
 // requiere, además del pedido, la conciliación explícita de D1.
 let pagoVerificado=false;
 if(row.status==="paid"){
  await ensurePaymentReviews(env);
  const review=await env.DB.prepare(
   "SELECT o.id FROM orders o JOIN payment_reviews r ON r.order_id=o.id "+
   "WHERE o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
   "AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL "+
   "AND o.deposit_ars=o.amount_ars AND r.state='verified' LIMIT 1"
  ).bind(row.commercial_order_id).first();
  pagoVerificado=Boolean(review);
  if(!pagoVerificado){
   const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bank_accreditations'").first();
   if(table){
    const bank=await env.DB.prepare(
     "SELECT o.id FROM orders o JOIN payment_reviews r ON r.order_id=o.id "+
     "JOIN bank_accreditations b ON b.order_id=o.id AND b.amount_ars=o.amount_ars "+
     "WHERE o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
     "AND o.deposit_ars=o.amount_ars AND o.payment_id IS NULL AND o.preference_id IS NULL "+
     "AND r.state='verified' LIMIT 1"
    ).bind(row.commercial_order_id).first();
    pagoVerificado=Boolean(bank);
   }
  }
  if(!pagoVerificado)return json({ok:false,error:"Pago sin conciliación verificada"},409);
 }
 return json({ok:true,schema:p.schema,numeroOrden:shortWorkNumber(row.number),
  webOrderId:p.webOrderId,importe:row.amount_ars,trabajos,
  nombreCliente:row.nombreCliente||null,telefonoContacto:row.telefonoContacto||null,
  direccionCliente:row.direccionCliente||null,
  estadoPago:pagoVerificado?"PAGADO_VERIFICADO":"SIN_PAGO_CONFIRMADO",
  pagoVerificado,pdfImprimibleVerificado:false,listoParaProducir:false,
  paymentAuthorized:false},200);
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

/** Internal immutable link: private Drive draft PDF to verified web order.
 * Only signed Worker-to-Worker calls, never customer references or payment.
 */
async function centralStagePrintDraft(req,env){
 if(env.CENTRAL_PRINT_DRAFT_STAGE_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Registro de borradores privados deshabilitado"},503);
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({error:signed.error},signed.status);
 const d=signed.payload;
 if(!d||typeof d!=="object"||Array.isArray(d)||
    Object.keys(d).sort().join(",")!==
     "bytes,descargaPrivadaHabilitada,estado,fileId,guardadoEnDrive,listoParaProducir,orderId,originalReceiptId,pages,paymentAuthorized,pdfImprimibleVerificado,receiptId,schema,sha256"||
    d.schema!=="saber-central-borrador-drive-v1"||
    !CENTRAL_WEB.test(d.orderId||"")||!CENTRAL_FILE.test(d.fileId||"")||
    !CENTRAL_RECEIPT.test(d.originalReceiptId||"")||
    !CENTRAL_RECEIPT.test(d.receiptId||"")||
    d.originalReceiptId===d.receiptId||
    !CENTRAL_HEX.test(d.sha256||"")||
    !Number.isSafeInteger(d.bytes)||d.bytes<100||d.bytes>20*1024*1024||
    !Number.isSafeInteger(d.pages)||d.pages<1||d.pages>2000||
    d.estado!=="BORRADOR_VERIFICADO_EN_DRIVE_PAGO_PENDIENTE"||
    d.guardadoEnDrive!==true||d.pdfImprimibleVerificado!==false||
    d.descargaPrivadaHabilitada!==false||d.paymentAuthorized!==false||
    d.listoParaProducir!==false)
  return json({error:"Borrador de impresión sin comprobación privada"},422);
 await centralTables(env);
 const [manifest,original]=await Promise.all([
  env.DB.prepare("SELECT manifest_json,commercial_order_id FROM central_document_manifests WHERE web_order_id=?").bind(d.orderId).first(),
  env.DB.prepare("SELECT receipt_id,file_id FROM central_document_receipts WHERE web_order_id=? AND receipt_id=?").bind(d.orderId,d.originalReceiptId).first()
 ]);
 if(!manifest||!original||original.file_id!==d.fileId)
  return json({error:"El borrador no pertenece a un PDF original del pedido"},409);
 let parsed;
 try{parsed=JSON.parse(manifest.manifest_json)}
 catch(_){return json({error:"No se pudo leer la ficha del pedido"},409)}
 const jobs=parsed?.trabajos;
 const job=Array.isArray(jobs)?jobs.find(x=>x.reciboPrivado===d.originalReceiptId):null;
 // Prices, duplex and copy count are immutable after original checkout.
 if(!job||job.servicio!=="documentos"||job.fileId!==d.fileId||
    !["a4","a3"].includes(job.formatoFinal)||
    !["simple","double"].includes(job.carasPresupuestadas)||
    job.paginasPorCaraPresupuestadas!==1||
    !Number.isSafeInteger(job.copias)||job.copias<1||job.copias>200||
    !Array.isArray(job.paginasElegidas)||!job.paginasElegidas.length)
  return json({error:"Este trabajo no tiene imposición documental cotizada"},409);
 const faceCount=job.paginasElegidas.length;
 const perGame=faceCount+(job.carasPresupuestadas==="double"&&faceCount%2===1?1:0);
 if(d.pages!==perGame*job.copias)
  return json({error:"El borrador cambió caras, copias o doble faz presupuestadas"},409);
 const prev=await env.DB.prepare("SELECT * FROM central_document_print_drafts WHERE web_order_id=? AND file_id=?").bind(d.orderId,d.fileId).first();
 const same=p=>Boolean(p&&p.receipt_id===d.receiptId&&
  p.original_receipt_id===d.originalReceiptId&&p.sha256===d.sha256&&
  p.bytes===d.bytes&&p.pages===d.pages);
 if(prev)return same(prev)?
  json({saved:true,idempotent:true,web_order_id:d.orderId,receipt_id:d.receiptId,
   paymentAuthorized:false,productionAuthorized:false}):
  json({error:"El pedido ya tiene un borrador distinto para el archivo"},409);
 try{
  await env.DB.prepare("INSERT INTO central_document_print_drafts(receipt_id,web_order_id,file_id,original_receipt_id,sha256,bytes,pages) VALUES(?,?,?,?,?,?,?)")
   .bind(d.receiptId,d.orderId,d.fileId,d.originalReceiptId,d.sha256,d.bytes,d.pages).run();
 }catch(_){
  const raced=await env.DB.prepare("SELECT * FROM central_document_print_drafts WHERE web_order_id=? AND file_id=?").bind(d.orderId,d.fileId).first();
  if(same(raced))return json({saved:true,idempotent:true,
   web_order_id:d.orderId,receipt_id:d.receiptId,
   paymentAuthorized:false,productionAuthorized:false});
  return json({error:"Conflicto de registro de borrador"},409);
 }
 return json({saved:true,idempotent:false,web_order_id:d.orderId,
  receipt_id:d.receiptId,paymentAuthorized:false,
  productionAuthorized:false},201);
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
 if(!data||typeof data!=="object"||Array.isArray(data)||
    !Object.keys(data).every(k=>["clientOrderId","items","webOrderId","telefono","nombre","direccion"].includes(k))||
    !Object.hasOwn(data,"clientOrderId")||!Object.hasOwn(data,"items")||!Object.hasOwn(data,"webOrderId")||
    !CENTRAL_WEB.test(data.webOrderId||"")||!CENTRAL_UUID.test(data.clientOrderId||"")||
    !Array.isArray(data.items)||data.items.length>50)
  return json({error:"Solicitud de pedido inválida"},400);
 const telefono=typeof data.telefono==='string'?data.telefono.trim():null;
 if(data.telefono!==undefined){
  const digits=String(telefono||'').replace(/\D/g,'');
  if(!telefono||!/^[+]?[0-9 ()-]{10,26}$/.test(telefono)||
     digits.length<10||digits.length>15)
   return json({error:"Teléfono de contacto inválido"},422);
 }
 const nombre=typeof data.nombre==="string"?data.nombre.trim():null;
 const direccion=typeof data.direccion==="string"?data.direccion.trim():null;
 if(data.nombre!==undefined&&(!nombre||nombre.length<2||nombre.length>100||/[<>]/.test(nombre)||!telefono))
  return json({error:"Nombre o teléfono del responsable inválido"},422);
 if(data.direccion!==undefined&&(direccion===null||direccion.length>180||/[<>]/.test(direccion)))
  return json({error:"Dirección del cliente inválida"},422);
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
 const hash=await centralHash(JSON.stringify({webOrderId:data.webOrderId,items:clean,
  ...(telefono?{telefono}:{}),...(nombre?{nombre}:{}),...(direccion!==null?{direccion}:{})}));
 const previous=await env.DB.prepare("SELECT request_hash,order_id FROM cart_requests WHERE client_order_id=?").bind(data.clientOrderId).first();
 if(previous){
  if(previous.request_hash!==hash)return json({error:"Identificador de compra usado con otro carrito"},409);
  const old=await env.DB.prepare("SELECT amount_ars,status FROM orders WHERE id=?").bind(previous.order_id).first();
  const manifest=await env.DB.prepare("SELECT web_order_id FROM central_document_manifests WHERE commercial_order_id=?").bind(previous.order_id).first();
  if(!old||manifest?.web_order_id!==data.webOrderId)return json({error:"Recepción del intento anterior no coincide"},409);
  await env.DB.prepare("INSERT OR IGNORE INTO central_work_order_numbers(commercial_order_id) VALUES(?)").bind(previous.order_id).run();
  const short=await env.DB.prepare("SELECT number FROM central_work_order_numbers WHERE commercial_order_id=?").bind(previous.order_id).first();
  return json({created:true,idempotent:true,commercial_order_id:previous.order_id,
   numeroOrden:shortWorkNumber(short?.number),amount_ars:old.amount_ars,
   state:old.status,checkoutEnabled:false,paymentAuthorized:false});
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
 if(telefono)requests.push(env.DB.prepare("INSERT INTO central_order_contacts(order_id,phone) VALUES(?,?)").bind(orderId,telefono));
 if(nombre)requests.push(env.DB.prepare("INSERT INTO central_order_customer_details(order_id,name,address) VALUES(?,?,?)").bind(orderId,nombre,direccion||""));
 requests.push(env.DB.prepare("INSERT INTO central_work_order_numbers(commercial_order_id) VALUES(?)").bind(orderId));
 requests.push(env.DB.prepare("INSERT INTO cart_requests(client_order_id,request_hash,order_id) VALUES(?,?,?)").bind(data.clientOrderId,hash,orderId));
 requests.push(env.DB.prepare("UPDATE central_document_manifests SET commercial_order_id=?,status='linked_waiting_payment',linked_at=datetime('now') WHERE web_order_id=? AND commercial_order_id IS NULL").bind(orderId,data.webOrderId));
 let response;
 try{response=await env.DB.batch(requests)}
 catch(_){
  const other=await env.DB.prepare("SELECT request_hash,order_id FROM cart_requests WHERE client_order_id=?").bind(data.clientOrderId).first();
  if(other&&other.request_hash===hash){
   // Una colisión concurrente no autoriza devolver el total precalculado
   // sin revisar el registro COMMIT de la transacción ganadora.
   const [stored,linked]=await Promise.all([
    env.DB.prepare("SELECT amount_ars,status FROM orders WHERE id=?").bind(other.order_id).first(),
    env.DB.prepare("SELECT commercial_order_id FROM central_document_manifests WHERE web_order_id=?").bind(data.webOrderId).first()
   ]);
   if(stored&&linked?.commercial_order_id===other.order_id&&
      stored.status==="awaiting_payment"&&stored.amount_ars===total){
    await env.DB.prepare("INSERT OR IGNORE INTO central_work_order_numbers(commercial_order_id) VALUES(?)").bind(other.order_id).run();
    const number=await env.DB.prepare("SELECT number FROM central_work_order_numbers WHERE commercial_order_id=?").bind(other.order_id).first();
    if(!Number.isSafeInteger(number?.number)||number.number<1)
     return json({error:"Número de orden concurrente no confirmado"},409);
    return json({created:true,idempotent:true,commercial_order_id:other.order_id,
     numeroOrden:shortWorkNumber(number.number),
     amount_ars:stored.amount_ars,state:stored.status,checkoutEnabled:false,paymentAuthorized:false});
   }
  }
  return json({error:"Pedido concurrente o recepción reutilizada"},409);
 }
 if(response?.[response.length-1]?.meta?.changes!==1)
  return json({error:"Vinculación del nuevo pedido sin confirmar"},409);
 const workNumber=await env.DB.prepare("SELECT number FROM central_work_order_numbers WHERE commercial_order_id=?").bind(orderId).first();
 if(!workNumber||!Number.isSafeInteger(workNumber.number)||workNumber.number<1)
  return json({error:"Pedido registrado, número interno pendiente de comprobación"},503);
 return json({created:true,idempotent:false,commercial_order_id:orderId,
  numeroOrden:shortWorkNumber(workNumber.number),
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
 * Ensayo de carrito integral: documentos + Polaroids Express + catálogo.
 * Sólo servidor HMAC. Requiere guardas independientes de AMBAS familias
 * y no tiene ningún vínculo con checkout ni con habilitación de pagos.
 */
async function centralPrepareMixedOrder(req,env){
 if(env.CENTRAL_MIXED_PREPARE_ENABLED!=="PRIVATE_TEST_ONLY"||
    env.CENTRAL_PREPARE_ENABLED!=="PRIVATE_TEST_ONLY"||
    env.CENTRAL_EXPRESS_PREPARE_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Carrito mixto privado deshabilitado"},503);
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({error:signed.error},signed.status);
 const d=signed.payload;
 if(!d||typeof d!=="object"||Array.isArray(d)||
    Object.keys(d).sort().join(",")!=="clientOrderId,items,polaroidReference,webOrderId"||
    !CENTRAL_UUID.test(d.clientOrderId||"")||
    !CENTRAL_WEB.test(d.webOrderId||"")||
    !CENTRAL_POLAROID.test(d.polaroidReference||"")||
    !Array.isArray(d.items)||d.items.length>40)
  return json({error:"Pedido mixto sin referencias verificables"},400);
 const seen=new Set(),products=[];
 for(const x of d.items){
  if(!x||typeof x!=="object"||Array.isArray(x)||
     Object.keys(x).sort().join(",")!=="code,qty"||
     typeof x.code!=="string"||!x.code.trim()||x.code.length>80||
     !Number.isSafeInteger(x.qty)||x.qty<1||x.qty>500||seen.has(x.code))
   return json({error:"Artículo repetido o cantidad inválida"},422);
  seen.add(x.code);products.push({code:x.code,qty:x.qty});
 }
 await centralTables(env);
 await centralPolaroidTable(env);
 await ensureOrderItems(env);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS cart_requests (client_order_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,order_id TEXT NOT NULL UNIQUE)").run();
 const fingerprint=await centralHash(JSON.stringify({
  webOrderId:d.webOrderId,polaroidReference:d.polaroidReference,items:products
 }));
 const previous=await env.DB.prepare("SELECT request_hash,order_id FROM cart_requests WHERE client_order_id=?").bind(d.clientOrderId).first();
 if(previous){
  if(previous.request_hash!==fingerprint)
   return json({error:"El identificador de compra pertenece a otro carrito"},409);
  const [o,a,b]=await Promise.all([
   env.DB.prepare("SELECT amount_ars,status FROM orders WHERE id=?").bind(previous.order_id).first(),
   env.DB.prepare("SELECT web_order_id FROM central_document_manifests WHERE commercial_order_id=?").bind(previous.order_id).first(),
   env.DB.prepare("SELECT reference FROM central_polaroids_express WHERE commercial_order_id=?").bind(previous.order_id).first()
  ]);
  if(!o||o.status!=="awaiting_payment"||a?.web_order_id!==d.webOrderId||
     b?.reference!==d.polaroidReference)
   return json({error:"El intento anterior no coincide con ambos trabajos"},409);
  return json({created:true,idempotent:true,commercial_order_id:previous.order_id,
   amount_ars:o.amount_ars,state:"awaiting_payment",
   checkoutEnabled:false,paymentAuthorized:false},200);
 }
 const [docs,pol]=await Promise.all([
  env.DB.prepare("SELECT amount_ars,file_count,manifest_json,commercial_order_id FROM central_document_manifests WHERE web_order_id=?").bind(d.webOrderId).first(),
  env.DB.prepare("SELECT reference,sha256,bytes,photos,sheets,amount_ars,commercial_order_id FROM central_polaroids_express WHERE reference=?").bind(d.polaroidReference).first()
 ]);
 if(!docs||!pol)return json({error:"Faltan recibos privados de uno o ambos trabajos"},404);
 if(docs.commercial_order_id||pol.commercial_order_id)
  return json({error:"Uno de los trabajos ya pertenece a otra compra"},409);
 let manifest;
 try{manifest=JSON.parse(docs.manifest_json)}
 catch(_){return json({error:"Manifiesto documental ilegible"},409)}
 if(manifest.schema!=="saber-central-documentos-d1-v1"||
    manifest.webOrderId!==d.webOrderId||manifest.importe!==docs.amount_ars||
    manifest.archivos!==docs.file_count||
    !Array.isArray(manifest.trabajos)||manifest.trabajos.length!==docs.file_count||
    docs.file_count<1||docs.file_count>30)
  return json({error:"Recibo de documentos inconsistente"},409);
 const receipts=manifest.trabajos.map(x=>x.reciboPrivado);
 if(receipts.some(x=>!CENTRAL_RECEIPT.test(x))||
    new Set(receipts).size!==receipts.length)
  return json({error:"Recibos documentales duplicados"},409);
 if(!CENTRAL_HEX.test(pol.sha256)||pol.bytes<100||pol.bytes>12*1024*1024||
    pol.photos<1||pol.photos>24||pol.sheets!==Math.ceil(pol.photos/6)||
    pol.amount_ars!==pol.sheets*3000)
  return json({error:"PDF Polaroids sin integridad o precio confirmado"},409);
 let total=docs.amount_ars+pol.amount_ars,shop=[];
 if(products.length){
  const catalog=await getCatalog();
  for(const item of products){
   const p=catalog.get(item.code);
   if(!p)return json({error:"Producto inexistente o inactivo"},422);
   const price=p.price*item.qty;
   if(!Number.isSafeInteger(price)||price<1||price>50000000)
    return json({error:"Cantidad o precio de artículo inválido"},422);
   total+=price;
   shop.push({...item,name:p.name,unit:p.price,total:price});
  }
 }
 if(!Number.isSafeInteger(total)||total<=0||total>50000000)
  return json({error:"Total mixto supera el máximo autorizado"},422);
 const id=crypto.randomUUID();
 const sql="INSERT INTO order_items(order_id,line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json) VALUES(?,?,?,?,?,?,?,?,?,?)";
 const changes=[
  env.DB.prepare("INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)")
   .bind(id,"Librería Saber · Documentos, Polaroids y tienda",total,total),
  env.DB.prepare(sql).bind(id,1,"print","DOCS_VERIFIED","Documentos y trabajos gráficos verificados",1,
    docs.amount_ars,docs.amount_ars,
    JSON.stringify({source:"central_verified",files:receipts.length}),JSON.stringify(receipts)),
  env.DB.prepare(sql).bind(id,2,"print","POLAROID_EXPRESS_A4","Polaroids Express PDF privado",
    pol.sheets,3000,pol.amount_ars,
    JSON.stringify({photos:pol.photos,sheets:pol.sheets,pdfFinalVerified:true}),JSON.stringify([pol.reference]))
 ];
 shop.forEach((p,i)=>changes.push(env.DB.prepare(sql)
  .bind(id,i+3,"product",p.code,p.name,p.qty,p.unit,p.total,"{}","[]")));
 changes.push(env.DB.prepare("UPDATE central_document_manifests SET commercial_order_id=?,status='linked_waiting_payment',linked_at=datetime('now') WHERE web_order_id=? AND commercial_order_id IS NULL").bind(id,d.webOrderId));
 changes.push(env.DB.prepare("UPDATE central_polaroids_express SET commercial_order_id=?,linked_at=datetime('now') WHERE reference=? AND commercial_order_id IS NULL").bind(id,d.polaroidReference));
 // Si otro proceso tomó cualquiera de las referencias durante el lote,
 // ORDER_ID NULL viola NOT NULL y revierte la transacción completa en D1.
 changes.push(env.DB.prepare(
  "INSERT INTO cart_requests(client_order_id,request_hash,order_id) VALUES(?,?,CASE WHEN (SELECT commercial_order_id FROM central_document_manifests WHERE web_order_id=?)=? AND (SELECT commercial_order_id FROM central_polaroids_express WHERE reference=?)=? THEN ? ELSE NULL END)"
 ).bind(d.clientOrderId,fingerprint,d.webOrderId,id,d.polaroidReference,id,id));
 let written;
 try{written=await env.DB.batch(changes)}
 catch(_){return json({error:"El carrito mixto ya fue utilizado o hay un pedido concurrente"},409)}
 if(written?.[written.length-1]?.meta?.changes!==1)
  return json({error:"El pedido mixto no fue confirmado"},409);
 return json({created:true,idempotent:false,commercial_order_id:id,
  amount_ars:total,documentos_ars:docs.amount_ars,
  polaroids_ars:pol.amount_ars,productos_ars:total-docs.amount_ars-pol.amount_ars,
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
 const row=await env.DB.prepare("SELECT p.reference,p.sha256,p.bytes,p.photos,p.sheets,p.amount_ars,p.commercial_order_id,o.status,o.payment_id,o.preference_id,o.paid_at,o.deposit_ars,o.amount_ars AS order_amount FROM central_polaroids_express p JOIN orders o ON o.id=p.commercial_order_id WHERE p.reference=? AND o.status='paid' AND o.deposit_ars=o.amount_ars AND o.paid_at IS NOT NULL AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL AND EXISTS (SELECT 1 FROM payment_reviews q WHERE q.order_id=o.id AND q.state='verified')").bind(reference).first();
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

function shortWorkNumber(n){
 return Number.isSafeInteger(n)&&n>0?String(n).padStart(3,"0"):null;
}


/* Administración V1 de tarifario PRIVADO. No gobierna todavía el cotizador público.
 * Fuente histórica importada: precios-web.json (21/08/2026) y promos.json.
 * Un borrador/aprobación de ensayo jamás activa cobros ni modifica la vidriera.
 */
const PRICE_ADMIN_BASELINE={"prices":{"schema":"saber-web-prices-v1","generatedAt":"2026-08-21T13:50:37.427Z","source":"Presupuestador Saber V13.23.5","note":"Archivo comercial: contiene precios de venta. No incluye costos internos, factores de costo, ganancias, historial ni ventas.","bnA4":{"scales":[{"from":1,"to":10,"label":"1 a 10","simple":100,"double":100},{"from":11,"to":30,"label":"11 a 30","simple":84,"double":80},{"from":31,"to":100,"label":"31 a 100","simple":76,"double":64},{"from":101,"to":200,"label":"101 a 200","simple":66,"double":56},{"from":201,"to":300,"label":"201 a 300","simple":63,"double":50},{"from":301,"to":null,"label":"301+","simple":49,"double":42}]},"colorA4":{"scales":[{"from":1,"to":10,"label":"1 a 10"},{"from":11,"to":20,"label":"11 a 20"},{"from":21,"to":50,"label":"21 a 50"},{"from":51,"to":100,"label":"51 a 100"},{"from":101,"to":null,"label":"+100"}],"materials":[{"id":"obra70","name":"Obra 70 g","family":"Obra","prices":[{"simple":200,"double":200},{"simple":180,"double":180},{"simple":160,"double":160},{"simple":140,"double":126},{"simple":90,"double":90}]},{"id":"obra140","name":"Obra 140 A4","family":"Obra","prices":[{"simple":600,"double":600},{"simple":600,"double":600},{"simple":500,"double":500},{"simple":500,"double":500},{"simple":500,"double":500}]},{"id":"obra180","name":"Obra 180 A4","family":"Obra","prices":[{"simple":800,"double":800},{"simple":800,"double":800},{"simple":700,"double":700},{"simple":700,"double":700},{"simple":700,"double":700}]},{"id":"custom_color_1784038750485_d5c0","name":"Ilustraci{on d/faz 120g","family":"Ilustración","prices":[{"simple":500,"double":500},{"simple":500,"double":500},{"simple":500,"double":500},{"simple":400,"double":400},{"simple":400,"double":400}]},{"id":"ilustr120","name":"Ilustración 120 A4","family":"Ilustración","prices":[{"simple":700,"double":700},{"simple":700,"double":700},{"simple":600,"double":600},{"simple":600,"double":600},{"simple":500,"double":500}]},{"id":"ilustr180","name":"Ilustración 180 g A4","family":"Ilustración","prices":[{"simple":800,"double":800},{"simple":800,"double":800},{"simple":700,"double":700},{"simple":700,"double":700},{"simple":700,"double":700}]},{"id":"custom_color_1787306408531_5eab","name":"Ilustracion 200 grs","family":"Ilustración","prices":[{"simple":1000,"double":1000},{"simple":1000,"double":1000},{"simple":900,"double":900},{"simple":900,"double":900},{"simple":900,"double":900}]},{"id":"ilustrDF240A4","name":"Ilustración D/F 240 g A4","family":"Ilustración","prices":[{"simple":1000,"double":1000},{"simple":1000,"double":1000},{"simple":900,"double":900},{"simple":900,"double":900},{"simple":900,"double":900}]},{"id":"fotografico","name":"Fotográfico A4","family":"Fotográfico","prices":[{"simple":1600,"double":1600},{"simple":1500,"double":1500},{"simple":1400,"double":1400},{"simple":1400,"double":1400},{"simple":1400,"double":1400}]},{"id":"adhesivo","name":"Adhesivo A4","family":"Adhesivo","prices":[{"simple":1900,"double":1900},{"simple":1800,"double":1800},{"simple":1700,"double":1700},{"simple":1700,"double":1700},{"simple":1600,"double":1600}]},{"id":"filmilo","name":"Filmilo A4","family":"Otros","prices":[{"simple":4200,"double":4200},{"simple":4000,"double":4000},{"simple":3800,"double":3800},{"simple":3700,"double":3700},{"simple":3600,"double":3600}]},{"id":"holofan","name":"Holofan A4","family":"Otros","prices":[{"simple":4200,"double":4200},{"simple":4000,"double":4000},{"simple":3800,"double":3800},{"simple":3700,"double":3700},{"simple":3600,"double":3600}]},{"id":"matelina","name":"Matelina A4","family":"Otros","prices":[{"simple":1200,"double":1200},{"simple":1100,"double":1100},{"simple":1100,"double":1100},{"simple":1100,"double":1100},{"simple":1000,"double":1000}]},{"id":"natucraft","name":"Natucraft A4","family":"Otros","prices":[{"simple":2200,"double":2200},{"simple":2100,"double":2100},{"simple":2000,"double":2000},{"simple":1900,"double":1900},{"simple":1900,"double":1900}]},{"id":"tapaCartonA4","name":"Tapa cartón A4","family":"Otros","prices":[{"simple":900,"double":900},{"simple":900,"double":900},{"simple":800,"double":800},{"simple":800,"double":800},{"simple":800,"double":800}]},{"id":"tatufan","name":"Tatufan A4","family":"Otros","prices":[{"simple":5200,"double":5200},{"simple":4900,"double":4900},{"simple":4700,"double":4700},{"simple":4600,"double":4600},{"simple":4400,"double":4400}]}]},"bnA3":{"scales":[{"from":1,"to":10,"label":"1 a 10","simple":500,"double":500},{"from":11,"to":30,"label":"11 a 30","simple":465,"double":447},{"from":31,"to":100,"label":"31 a 100","simple":430,"double":394},{"from":101,"to":200,"label":"101 a 200","simple":394,"double":341},{"from":201,"to":300,"label":"201 a 300","simple":366,"double":318},{"from":301,"to":null,"label":"301+","simple":282,"double":212}]},"colorA3":{"scales":[{"from":1,"to":10,"label":"1 a 10"},{"from":11,"to":20,"label":"11 a 20"},{"from":21,"to":50,"label":"21 a 50"},{"from":51,"to":100,"label":"51 a 100"},{"from":101,"to":null,"label":"+100"}],"materials":[{"id":"a3_color_obra80","name":"Color A3 · Obra 80 g","family":"Obra","prices":[{"simple":1000,"double":1000},{"simple":930,"double":894},{"simple":930,"double":894},{"simple":860,"double":788},{"simple":788,"double":682}]},{"id":"a3_color_obra140","name":"Color A3 · Obra 140","family":"Obra","prices":[{"simple":1200,"double":1200},{"simple":1140,"double":1140},{"simple":1100,"double":1100},{"simple":1050,"double":1050},{"simple":1000,"double":1000}]},{"id":"a3_color_obra180","name":"Color A3 · Obra 180","family":"Obra","prices":[{"simple":1560,"double":1560},{"simple":1482,"double":1482},{"simple":1430,"double":1430},{"simple":1365,"double":1365},{"simple":1300,"double":1300}]},{"id":"a3_color_ilustr120","name":"Color A3 · Ilustración 120","family":"Ilustración","prices":[{"simple":1499.74,"double":1499.74},{"simple":1421.2,"double":1421.2},{"simple":1346.4,"double":1346.4},{"simple":1309,"double":1309},{"simple":1215.5,"double":1215.5}]},{"id":"custom_a3_1787306995917_e35f","name":"Color A3 · Ilustracion 200 grs","family":"Ilustración","prices":[{"simple":2362.5,"double":2362.5},{"simple":2205,"double":2205},{"simple":2126.25,"double":2126.25},{"simple":1984.5,"double":1984.5},{"simple":1890,"double":1890}]},{"id":"a3_color_autoadh","name":"Color A3 · Autoadhesivo","family":"Adhesivo","prices":[{"simple":3290,"double":3290},{"simple":3055,"double":3055},{"simple":2961,"double":2961},{"simple":2820,"double":2820},{"simple":2350,"double":2350}]}]},"photos":{"scales":[{"from":1,"to":19,"label":"1 a 19"},{"from":20,"to":49,"label":"+20"},{"from":50,"to":99,"label":"+50"},{"from":100,"to":null,"label":"+100"}],"products":[{"id":"foto_10x15","paper":"Papel fotográfico","size":"10x15","prices":[500,475,450,435]},{"id":"foto_13x18","paper":"Papel fotográfico","size":"13x18","prices":[800,760,720,696]},{"id":"foto_a4","paper":"Papel fotográfico","size":"A4","prices":[1600,1520,1440,1392]},{"id":"foto_a3","paper":"Papel fotográfico","size":"A3","prices":[3500,3325,3150,3045]},{"id":"foto_polaroid","paper":"Papel fotográfico","size":"Polaroid","prices":[3000,3000,3000,3000]},{"id":"foto_carnet","paper":"Papel fotográfico","size":"Carnet","prices":[1000,1000,1000,1000]},{"id":"luster_10x15","paper":"Luster","size":"10x15","prices":[800,760,720,696]},{"id":"luster_13x18","paper":"Luster","size":"13x18","prices":[1200,1140,1080,1044]},{"id":"luster_a4","paper":"Luster","size":"A4","prices":[2500,2375,2250,2175]},{"id":"luster_a3","paper":"Luster","size":"A3","prices":[4500,4275,4050,3915]},{"id":"luster_polaroid","paper":"Luster","size":"Polaroid","prices":[3000,3000,3000,3000]}]},"stickers":{"tiers":[{"from":1,"to":20,"discount":0},{"from":21,"to":null,"discount":10}],"products":[{"id":"sticker_a4","name":"Plancha A4 con precorte","size":"A4","prices":[{"from":1,"to":20,"unit":3000},{"from":21,"to":null,"unit":2700}]},{"id":"sticker_a3","name":"Plancha A3 con precorte","size":"A3","prices":[{"from":1,"to":20,"unit":5000},{"from":21,"to":null,"unit":4500}]}]},"bindings":{"a4":[{"to":100,"price":2330},{"to":200,"price":2580},{"to":350,"price":3800}],"a3":[{"to":100,"price":4660},{"to":200,"price":5160},{"to":350,"price":7600}]},"plotter":{"roundTo":100,"minMeters":0,"supports":[{"id":"rollo42","name":"Rollo 42","widthCm":42,"cadPerMeter":3618,"posterPerMeter":6534},{"id":"rollo60","name":"Rollo 60","widthCm":60,"cadPerMeter":5184,"posterPerMeter":9072},{"id":"rollo90","name":"Rollo 90","widthCm":90,"cadPerMeter":6024,"posterPerMeter":9912},{"id":"rec60","name":"Recubierto 130 g 60","widthCm":60,"cadPerMeter":14168,"posterPerMeter":18700},{"id":"rec90","name":"Recubierto 130 g 90","widthCm":90,"cadPerMeter":17668,"posterPerMeter":22204}]},"cutPlotter":{"minimumPrice":5000,"roundTo":100,"variants":[{"id":"gt3","name":"Piezas +3 cm","pricePerMeter":31200},{"id":"lt3","name":"Piezas -3 cm","pricePerMeter":39000},{"id":"solo","name":"Corte solo","pricePerMeter":23999.96}]}},"promotions":{"enabled":true,"one_code_at_a_time":true,"codes":[{"code":"PROMOFINDE","active":false,"label":"20% OFF en todo el carrito","type":"percent_total","percent":20},{"code":"MARTESDECOPIAS","active":false,"label":"10% en impresiones","type":"percent_kinds","percent":10,"kinds":["impresiones"]},{"code":"FOTOSPREMIUM","active":false,"label":"Premium al precio normal (10x15/13x18/A4)","type":"photo_premium_to_normal"},{"code":"ANILLADO0","active":true,"label":"Anillado gratis","type":"free_binding"},{"code":"STICKER10","active":false,"label":"10% Stickers A3","type":"percent_adh_types","percent":10,"types":["stickers_a3"]}],"weekly":[{"day":0,"title":"Fin de semana","summary":"20% online, en trabajos alcanzados","kind":"percent","percent":20,"enabled":true},{"day":1,"title":"Lunes de planos","summary":"10% en ploteos CAD desde 2 metros","kind":"percent","percent":10,"minMeters":2,"enabled":true},{"day":2,"title":"Martes de copias","summary":"10% en impresiones","kind":"percent","percent":10,"enabled":true},{"day":3,"title":"Miércoles de fotos","summary":"Premium al precio normal","kind":"premium_to_normal","enabled":true},{"day":4,"title":"Jueves de anillado","summary":"Anillado sin cargo","kind":"free_binding","enabled":true},{"day":5,"title":"Viernes de stickers","summary":"10% en stickers A3","kind":"percent","percent":10,"enabled":true},{"day":6,"title":"Fin de semana","summary":"20% online, en trabajos alcanzados","kind":"percent","percent":20,"enabled":true}]}};
const PRICE_ADMIN_GROUPS=Object.freeze({
 bnA4:"B/N A4",colorA4:"Color A4",bnA3:"B/N A3",colorA3:"Color A3",
 photos:"Fotografías",stickers:"Stickers",bindings:"Anillados",
 plotter:"Ploteos",cutPlotter:"Plotter de corte",promotions:"Cupones"
});
function priceAdminClone(value){return JSON.parse(JSON.stringify(value))}
function priceAdminAt(data,path){
 let at=data;
 for(const part of path.split(".")){
  if(at==null||!Object.prototype.hasOwnProperty.call(at,part))return undefined;
  at=at[part];
 }
 return at;
}
function priceAdminSet(data,path,value){
 const parts=path.split(".");
 const last=parts.pop();
 let parent=data;
 for(const part of parts)parent=parent[part];
 parent[last]=value;
}
function priceAdminFields(){
 const fields=[];
 const allowed=new Set(["simple","double","price","unit","cadPerMeter","posterPerMeter","minimumPrice","pricePerMeter"]);
 const recurse=(v,path)=>{
  if(Array.isArray(v)){v.forEach((part,i)=>recurse(part,path.concat(String(i))));return}
  if(v&&typeof v==="object"){for(const [key,value] of Object.entries(v))recurse(value,path.concat(key));return}
  const root=path[0],key=path[path.length-1],rootName=root==="promotions"?"promotions":root==="prices"?path[1]:root;
  if(root==="prices"&&
   (allowed.has(key)||(path[1]==="photos"&&path.includes("prices")&&/^\d+$/.test(key)))&&
   typeof v==="number"){
    const prefix=path.slice(0,-1),current=priceAdminAt(PRICE_ADMIN_BASELINE,prefix.join("."));
    const category=PRICE_ADMIN_GROUPS[rootName];
    if(!category)return;
    const ownerIndex=path.findIndex((_,i)=>i>1&&["materials","products","supports","variants"].includes(path[i-1]));
    const owner=ownerIndex<0?null:priceAdminAt(PRICE_ADMIN_BASELINE,path.slice(0,ownerIndex+1).join("."));
    const tierIndex=path.findIndex((_,i)=>i>1&&["scales","prices"].includes(path[i-1]));
    const tier=tierIndex<0?null:priceAdminAt(PRICE_ADMIN_BASELINE,path.slice(0,tierIndex+1).join("."));
    const materialName=owner?.name||owner?.paper||owner?.size||owner?.id||"";
    let scale=tier&&typeof tier==="object"?(tier.label||(Object.prototype.hasOwnProperty.call(tier,"from")?String(tier.from)+" a "+(tier.to??"más"):"")):"";
    if(!scale&&tierIndex>=0&&path[tierIndex-1]==="prices"){
     const tierLabel=priceAdminAt(PRICE_ADMIN_BASELINE,"prices."+path[1]+".scales."+path[tierIndex]+".label");
     if(typeof tierLabel==="string")scale=tierLabel;
    }
    if(!scale&&tierIndex>=0&&path[1]==="bindings"&&tier&&typeof tier==="object"&&Number.isFinite(tier.to))
     scale="Hasta "+tier.to+" hojas";
    const face=({simple:"Simple faz",double:"Doble faz",unit:"Unidad",price:"Precio",cadPerMeter:"CAD por metro",posterPerMeter:"Póster por metro",minimumPrice:"Precio mínimo",pricePerMeter:"Precio por metro"})[key]||"Precio";
    fields.push({path:path.join("."),category,label:[materialName,scale,face].filter(Boolean).join(" · "),kind:"price",baseline:v});
  }
  if(root==="promotions"&&path[1]==="codes"&&
    (key==="active"&&typeof v==="boolean"||key==="percent"&&typeof v==="number")){
    const promo=priceAdminAt(PRICE_ADMIN_BASELINE,path.slice(0,3).join("."));
    fields.push({path:path.join("."),category:"Cupones",label:(promo?.code||"Cupón")+" · "+(key==="active"?"Activo":"Descuento %"),kind:key==="active"?"boolean":"percent",baseline:v});
  }
  if(root==="promotions"&&path[1]==="weekly"&&
     (key==="enabled"&&typeof v==="boolean"||key==="percent"&&typeof v==="number")){
    const promo=priceAdminAt(PRICE_ADMIN_BASELINE,path.slice(0,3).join("."));
    fields.push({path:path.join("."),category:"Promos semanales",label:(promo?.title||"Día")+" · "+(key==="enabled"?"Mostrar beneficio":"Descuento %"),kind:key==="enabled"?"boolean":"percent",baseline:v});
  }
 };
 recurse(PRICE_ADMIN_BASELINE,[]);
 return fields;
}
const PRICE_ADMIN_FIELDS=priceAdminFields();
const PRICE_ADMIN_ALLOWED=new Map(PRICE_ADMIN_FIELDS.map(x=>[x.path,x]));
function priceAdminValidValue(field,value){
 if(field.kind==="boolean")return typeof value==="boolean";
 if(typeof value!=="number"||!Number.isFinite(value))return false;
 if(field.kind==="percent")return value>=0&&value<=50&&Math.round(value*100)===value*100;
 return value>0&&value<=50000000&&Math.abs(value*100-Math.round(value*100))<0.000001;
}
function priceAdminValidatePayload(payload){
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return false;
 for(const field of PRICE_ADMIN_FIELDS){
  if(!priceAdminValidValue(field,priceAdminAt(payload,field.path)))return false;
 }
 return JSON.stringify(Object.keys(payload).sort())===JSON.stringify(["prices","promotions"])&&
  payload.prices?.schema===PRICE_ADMIN_BASELINE.prices.schema&&
  payload.promotions?.one_code_at_a_time===PRICE_ADMIN_BASELINE.promotions.one_code_at_a_time;
}
async function priceAdminTables(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_pricing_admin_head (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL DEFAULT 0,approved_revision INTEGER NOT NULL DEFAULT 0,draft_json TEXT,approved_json TEXT,updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("INSERT OR IGNORE INTO central_pricing_admin_head(id) VALUES(1)").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_pricing_admin_history (revision INTEGER PRIMARY KEY,action TEXT NOT NULL CHECK(action IN ('draft','approve','restore')),operator TEXT NOT NULL,payload_json TEXT NOT NULL,changed_count INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
}
async function priceAdminHead(env){
 const row=await env.DB.prepare("SELECT revision,approved_revision,draft_json,approved_json,updated_at FROM central_pricing_admin_head WHERE id=1").first();
 if(!row)throw Error("No está disponible el catálogo de prueba");
 return row;
}
function priceAdminCurrent(head){
 const raw=head.draft_json||head.approved_json;
 const current=raw?JSON.parse(raw):priceAdminClone(PRICE_ADMIN_BASELINE);
 if(!priceAdminValidatePayload(current))throw Error("Tarifario guardado no válido");
 return current;
}
/** Única lectura del tarifario APROBADO, sin borradores ni importes sin revisar.
 * HMAC obligatorio entre Workers. No publica, cobra ni altera cotizaciones.
 */
async function priceAdminApprovedSnapshot(req,env){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({ok:false,error:signed.error,paymentAuthorized:false},signed.status);
 if(env.PRICE_ADMIN_PRIVATE_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({ok:false,error:"Tarifario privado deshabilitado",paymentAuthorized:false},503);
 const d=signed.payload;
 if(!d||typeof d!=="object"||Array.isArray(d)||
    Object.keys(d).sort().join(",")!=="purpose,schema"||
    d.schema!=="saber-price-snapshot-v1"||d.purpose!=="quote-private-test")
  return json({ok:false,error:"Petición de precios sin contrato válido",paymentAuthorized:false},422);
 await priceAdminTables(env);
 const head=await priceAdminHead(env);
 if(!head.approved_json||!Number.isSafeInteger(head.approved_revision)||head.approved_revision<1)
  return json({ok:false,error:"No existe versión tarifaria aprobada para ensayos",paymentAuthorized:false},409);
 let snapshot;
 try{snapshot=JSON.parse(head.approved_json)}
 catch(_){return json({ok:false,error:"Versión tarifaria ilegible",paymentAuthorized:false},409)}
 if(!priceAdminValidatePayload(snapshot))
  return json({ok:false,error:"Versión tarifaria inválida",paymentAuthorized:false},409);
 const approval=await env.DB.prepare("SELECT created_at FROM central_pricing_admin_history WHERE revision=? AND action='approve' LIMIT 1")
  .bind(head.approved_revision).first();
 if(!approval||typeof approval.created_at!=="string"||
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(approval.created_at))
  return json({ok:false,error:"No se pudo comprobar la fecha de aprobación",paymentAuthorized:false},409);
 const approvedAt=approval.created_at.replace(" ","T")+"Z";
 return json({ok:true,schema:"saber-price-snapshot-v1",approvedRevision:head.approved_revision,
  approvedAt,prices:snapshot.prices,promotions:snapshot.promotions,paymentAuthorized:false,
  commercialRelease:false,source:"private-d1-approved-only"},200);
}

/** Simulación PREVIA para detectar cambios accidentales. No calcula
 * promociones ni importa al checkout; usa solo tarifas de ejemplo.
 */
function priceAdminExamples(prices){
 const p=prices?.prices;
 if(!p)throw Error("Tarifario incompleto");
 const a4Color=p.colorA4.materials.find(x=>x.id==="obra70");
 const rec60=p.plotter.supports.find(x=>x.id==="rec60");
 if(!a4Color||!rec60)throw Error("Material de ejemplo no encontrado");
 const samples=[
  ["A4 B/N · 10 caras simple faz",10*p.bnA4.scales[0].simple],
  ["A4 B/N · 100 caras doble faz",100*p.bnA4.scales.find(x=>100>=x.from&&(x.to===null||100<=x.to)).double],
  ["A4 color obra 70 g · 10 caras simple faz",10*a4Color.prices[0].simple],
  ["Anillado A4 · hasta 100 hojas",p.bindings.a4[0].price],
  ["Póster recubierto 130 g · 60 cm · 1 metro",rec60.posterPerMeter]
 ];
 if(samples.some(row=>!Number.isFinite(row[1])||row[1]<0))
  throw Error("Valor de simulación inválido");
 return samples.map(([label,total])=>({label,total}));
}
function priceAdminPreview(base,proposed){
 if(!priceAdminValidatePayload(base)||!priceAdminValidatePayload(proposed))
  throw Error("Datos de vista previa inválidos");
 const edits=PRICE_ADMIN_FIELDS.flatMap(field=>{
  const before=priceAdminAt(base,field.path),after=priceAdminAt(proposed,field.path);
  return before===after?[]:[{
   path:field.path,category:field.category,label:field.label,before,after,
   ...(typeof before==="number"&&before>0?
    {changePercent:Math.round(((after-before)/before)*10000)/100}:{})
  }];
 });
 const earlier=priceAdminExamples(base),later=priceAdminExamples(proposed);
 return {edits,
  examples:earlier.map((row,i)=>({label:row.label,before:row.total,after:later[i].total})),
  caution:"Simulación orientativa sin promociones, cupones ni costos adicionales. No publica ni habilita cobros."};
}
async function priceAdminHandle(req,env,pathname){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.PRICE_ADMIN_PRIVATE_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Editor de tarifas privado inactivo"},503);
 await priceAdminTables(env);
 if(pathname==="/admin/api/pricing"&&req.method==="GET"){
  const head=await priceAdminHead(env);
  const current=priceAdminCurrent(head);
  const history=(await env.DB.prepare("SELECT revision,action,operator,changed_count,created_at FROM central_pricing_admin_history ORDER BY revision DESC LIMIT 15").all()).results||[];
  return json({revision:head.revision,approvedRevision:head.approved_revision,
   draftPresent:!!head.draft_json,baselineSource:"precios-web.json (21/08/2026); cupones promos.json",
   caution:"Tarifas históricas para revisión. No gobiernan pedidos ni la web pública.",
   fields:PRICE_ADMIN_FIELDS.map(field=>({...field,value:priceAdminAt(current,field.path)})),
   history,publicPricingConnected:false,paymentsEnabled:false});
 }
 if(req.method!=="POST")return json({error:"Método no permitido"},405);
 const raw=await req.text();
 if(raw.length>25000)return json({error:"Solicitud demasiado extensa"},413);
 let d;
 try{d=JSON.parse(raw)}catch{return json({error:"Solicitud inválida"},400)}
 const actor=d?.operator;
 if(typeof actor!=="string"||actor.trim().length<2||actor.trim().length>60||
    !Number.isSafeInteger(d?.expectedRevision)||d.expectedRevision<0)
  return json({error:"Responsable o revisión inválidos"},422);
 const head=await priceAdminHead(env);
 if(head.revision!==d.expectedRevision)
  return json({error:"Otra computadora modificó el tarifario. Volvé a cargar antes de guardar."},409);
 if(pathname==="/admin/api/pricing/preview"){
  if(!d||Object.keys(d).sort().join(",")!=="changes,expectedRevision,operator"||
     !Array.isArray(d.changes)||d.changes.length>100)
   return json({error:"Vista previa inválida"},422);
  const before=priceAdminCurrent(head),after=priceAdminClone(before);
  const seen=new Set();
  for(const edit of d.changes){
   if(!edit||Object.keys(edit).sort().join(",")!=="path,value"||
      typeof edit.path!=="string"||seen.has(edit.path)||
      !PRICE_ADMIN_ALLOWED.has(edit.path)||
      !priceAdminValidValue(PRICE_ADMIN_ALLOWED.get(edit.path),edit.value))
    return json({error:"Cambio no permitido en vista previa"},422);
   seen.add(edit.path);priceAdminSet(after,edit.path,edit.value);
  }
  if(!priceAdminValidatePayload(after))return json({error:"Tarifario resultante inválido"},422);
  const base=head.approved_json?JSON.parse(head.approved_json):priceAdminClone(PRICE_ADMIN_BASELINE);
  const pending=priceAdminPreview(base,after);
  return json({preview:true,revision:head.revision,approvedRevision:head.approved_revision,
   ...pending,paymentsEnabled:false,commercialPublication:false});
 }
 let next,action,changed=0,update;
 if(pathname==="/admin/api/pricing/draft"){
  if(!d||Object.keys(d).sort().join(",")!=="changes,expectedRevision,operator"||
     !Array.isArray(d.changes)||d.changes.length<1||d.changes.length>100)
   return json({error:"Modificaciones inválidas"},422);
  next=priceAdminCurrent(head);
  const seen=new Set();
  for(const entry of d.changes){
   if(!entry||typeof entry.path!=="string"||
      Object.keys(entry).sort().join(",")!=="path,value"||
      !PRICE_ADMIN_ALLOWED.has(entry.path)||seen.has(entry.path)||
      !priceAdminValidValue(PRICE_ADMIN_ALLOWED.get(entry.path),entry.value))
    return json({error:"Valor o campo de tarifa no permitido"},422);
   seen.add(entry.path);
   if(priceAdminAt(next,entry.path)!==entry.value){
    priceAdminSet(next,entry.path,entry.value);changed++;
   }
  }
  if(changed===0)return json({error:"No hay cambios nuevos para guardar"},409);
  action="draft";
  update=env.DB.prepare("UPDATE central_pricing_admin_head SET draft_json=?,revision=revision+1,updated_at=datetime('now') WHERE id=1 AND revision=?")
   .bind(JSON.stringify(next),head.revision);
 }else if(pathname==="/admin/api/pricing/approve"){
  if(!d||Object.keys(d).sort().join(",")!=="confirmed,expectedRevision,operator"||
    d.confirmed!==true||!head.draft_json)
   return json({error:"Primero guardá un borrador válido y confirmá su aprobación privada"},422);
  next=priceAdminCurrent(head);action="approve";
  changed=0;
  update=env.DB.prepare("UPDATE central_pricing_admin_head SET approved_json=draft_json,draft_json=NULL,approved_revision=revision+1,revision=revision+1,updated_at=datetime('now') WHERE id=1 AND revision=? AND draft_json IS NOT NULL")
   .bind(head.revision);
 }else if(pathname==="/admin/api/pricing/restore"){
  if(!d||Object.keys(d).sort().join(",")!=="expectedRevision,operator,restoreRevision"||
    !Number.isSafeInteger(d.restoreRevision)||d.restoreRevision<1)
   return json({error:"Versión a restaurar inválida"},422);
  const past=await env.DB.prepare("SELECT payload_json FROM central_pricing_admin_history WHERE revision=?").bind(d.restoreRevision).first();
  if(!past)return json({error:"Revisión no encontrada"},404);
  try{next=JSON.parse(past.payload_json)}catch{return json({error:"Revisión histórica ilegible"},409)}
  if(!priceAdminValidatePayload(next))return json({error:"La revisión histórica no es válida"},409);
  action="restore";changed=0;
  update=env.DB.prepare("UPDATE central_pricing_admin_head SET draft_json=?,revision=revision+1,updated_at=datetime('now') WHERE id=1 AND revision=?")
   .bind(JSON.stringify(next),head.revision);
 }else return json({error:"Ruta inválida"},404);
 const revised=head.revision+1;
 try{
  const res=await env.DB.batch([
   update,
   env.DB.prepare("INSERT INTO central_pricing_admin_history(revision,action,operator,payload_json,changed_count) SELECT revision,?,?,?,? FROM central_pricing_admin_head WHERE id=1 AND revision=?")
    .bind(action,actor.trim(),JSON.stringify(next),changed,revised)
  ]);
  if(res?.[0]?.meta?.changes!==1||res?.[1]?.meta?.changes!==1)
   return json({error:"No se confirmó el guardado. Actualizá el panel."},409);
 }catch{return json({error:"Guardado simultáneo o error de D1; actualizá el panel"},409)}
 return json({saved:true,action,revision:revised,approvedPrivateOnly:action==="approve",
  publicPricingConnected:false,paymentsEnabled:false});
}

/** Integrar R2 pagado sin aprobar, incluso cuando SELECT ya devolvió su orden.
 * Nunca habilita producción. La aprobación D1 sigue siendo condición del backend. */
function centralMergePendingR2Orders(board,reviewOrders){
 if(!Array.isArray(board)||!Array.isArray(reviewOrders))return board;
 for(const r of reviewOrders){
  if(!r||typeof r.commercialOrderId!=="string"||
     !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(r.webOrderId||"")||
     !Number.isSafeInteger(r.amountArs)||r.amountArs<1)continue;
  const existing=board.find(o=>o.id===r.commercialOrderId);
  // Aprobados, órdenes TUS y pedidos en preparación no se tocan.
  if(existing&&existing.production_state!=null)continue;
  if(existing&&Number(existing.amount_ars)!==r.amountArs)continue;
  // V1 histórico: pagado pero SIN cotización inmutable de papel/rollo/copias.
  // No puede pasar la preprensa v2. Conservar el registro de pago pero fuera
  // de Nuevos: no convertir un ensayo viejo en una orden operativa falsa.
  if(r.quotedParametersAvailable!==true||r.quoteSnapshot?.schema!=="saber-r2-cotizacion-firmada-v1"){
   const legacy={
    production_state:null,
    r2_legacy_unusable:true,
    r2_prepress_pending:false,
    web_order_id:r.webOrderId,
    r2_receipt_id:r.receiptId,
    description:"Ensayo R2 histórico · sin ficha completa · "+r.webOrderId.slice(-8)
   };
   if(existing)Object.assign(existing,legacy);
   else board.push({
    id:r.commercialOrderId,amount_ars:r.amountArs,
    status:"paid",paid_at:r.paidAt,...legacy
   });
   continue;
  }
  const waiting={
   production_state:"pendiente",production_version:0,
   work_number:null,file_count:r.received?1:0,
   web_order_id:r.webOrderId,r2_receipt_id:r.receiptId,
   r2_prepress_pending:true,r2_prepress_state:r.estado,
   r2_prepress_receipt_verified:r.verifiedReceipt===true,
   estimated_ready_at:null,estimated_ready_version:0
  };
  if(existing)Object.assign(existing,waiting);
  else board.unshift({
   id:r.commercialOrderId,description:"Ploteo R2 · "+r.webOrderId.slice(-8),
   amount_ars:r.amountArs,status:"paid",paid_at:r.paidAt,...waiting
  });
 }
 return board;
}
const PRODUCTION_STATES=["pendiente","en_preparacion","en_espera","listo","entregado"];
const PRODUCTION_NEXT={
 pendiente:["en_preparacion","en_espera"],
 en_preparacion:["listo","en_espera"],
 en_espera:["en_preparacion"],
 listo:["entregado","en_preparacion","en_espera"],
 entregado:[]
};
async function centralProductionTables(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_production_status (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,state TEXT NOT NULL DEFAULT 'pendiente' CHECK(state IN ('pendiente','en_preparacion','en_espera','listo','entregado')),version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),operator TEXT,reason TEXT,updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_production_events (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,version INTEGER NOT NULL,from_state TEXT NOT NULL,to_state TEXT NOT NULL,operator TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(order_id,version))").run();
}
async function centralProductionDetail(env,id){
 await centralProductionTables(env);
 const current=await env.DB.prepare("SELECT state,version,operator,reason,updated_at FROM central_production_status WHERE order_id=?").bind(id).first();
 const rows=await env.DB.prepare("SELECT version,from_state,to_state,operator,reason,created_at FROM central_production_events WHERE order_id=? ORDER BY version DESC LIMIT 30").bind(id).all();
 return {state:current?.state||"pendiente",version:current?.version||0,
  operator:current?.operator||null,updated_at:current?.updated_at||null,
  history:rows.results||[],allowed:PRODUCTION_NEXT[current?.state||"pendiente"],productionAuthorized:false};
}

/**
 * Cola durable de eliminación de PDF al entregar (aún sin ejecución en Storage).
 * La compuerta de ensayo está APAGADA por defecto; al encenderse solo encola
 * originales TUS, nunca borra bytes ni modifica registros de pago.
 * La ejecución futura verificará nuevamente la Central antes de borrar.
 */

/* Entrega de PDF: cola reintentable, auditoría durable y comunicación firmada.
   Ambas compuertas quedan OFF en entorno real y pruebas hasta autorización. */
async function centralEnsureTUSPurgeTables(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_tus_purge_queue ("+
  "order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,"+
  "web_order_id TEXT NOT NULL UNIQUE REFERENCES central_document_manifests(web_order_id) ON DELETE RESTRICT,"+
  "production_version INTEGER NOT NULL CHECK(production_version>=1),"+
  "state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','completed','error')),"+
  "attempts INTEGER NOT NULL DEFAULT 0,operator TEXT NOT NULL,"+
  "created_at TEXT NOT NULL DEFAULT (datetime('now')),"+
  "locked_at TEXT,last_try_at TEXT,completed_at TEXT)").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_tus_purge_audit ("+
  "id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,"+
  "production_version INTEGER NOT NULL,phase TEXT NOT NULL CHECK(phase IN ('queued','attempt','error','completed')),"+
  "file_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
}
/**
 * Política de eliminación: por defecto SOLO la canaria explícita.
 * Nueva fase exige un corte fijo posterior al inventario histórico y dos
 * confirmaciones independientes (Central + Documentos) ANTES del DELETE.
 * JAMÁS convertir una orden anterior al corte en elegible por cambiar flags.
 */
const TUS_PURGE_NEW_ORDERS_CUTOFF='2026-11-07 00:00:00';
function centralPurgeCanaryAllowed(env,webOrderId,createdAt){
 if(!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(webOrderId||''))return false;
 if(env?.CENTRAL_TUS_PURGE_SCOPE==='NEW_ORDERS_ONLY')
  return typeof createdAt==='string'&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(createdAt)&&
   createdAt>=TUS_PURGE_NEW_ORDERS_CUTOFF;
 const canary=env?.CENTRAL_TUS_PURGE_CANARY_ORDER;
 return typeof canary==='string'&&/^WEB-ENSAYO-[A-F0-9]{32}$/.test(canary)&&canary===webOrderId;
}
async function centralQueueDeliveryCleanup(env,orderId,version,operator){
 if(env.CENTRAL_TUS_PURGE_QUEUE_ENABLED!=="PRIVATE_TEST_ONLY")
  return {state:"desactivado",filesDeleted:0};
 await centralEnsureTUSPurgeTables(env);
 const row=await env.DB.prepare(
  "SELECT m.web_order_id,m.file_count,m.created_at AS manifest_created_at FROM central_document_manifests m "+
  "JOIN orders o ON o.id=m.commercial_order_id "+
  "JOIN central_production_status p ON p.order_id=o.id "+
  "WHERE o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
  "AND o.deposit_ars=o.amount_ars AND p.state='entregado' AND p.version=? "+
  "AND EXISTS (SELECT 1 FROM payment_reviews r WHERE r.order_id=o.id AND r.state='verified') "+
  "LIMIT 1").bind(orderId,version).first();
 if(!row||!/^WEB-ENSAYO-[A-F0-9]{32}$/.test(row.web_order_id||"")||
    !centralPurgeCanaryAllowed(env,row.web_order_id,row.manifest_created_at)||
    !Number.isSafeInteger(row.file_count)||row.file_count<1||row.file_count>10)
  return {state:"no_elegible",filesDeleted:0};
 const inserted=await env.DB.prepare(
  "INSERT OR IGNORE INTO central_tus_purge_queue "+
  "(order_id,web_order_id,production_version,operator) VALUES(?,?,?,?)"
 ).bind(orderId,row.web_order_id,version,operator).run();
 if(Number(inserted?.meta?.changes)===1)
  await env.DB.prepare("INSERT INTO central_tus_purge_audit "+
   "(order_id,production_version,phase,file_count) VALUES(?,?,'queued',?)")
   .bind(orderId,version,row.file_count).run();
 const job=await env.DB.prepare(
  "SELECT state FROM central_tus_purge_queue WHERE order_id=? AND web_order_id=? "+
  "AND production_version=?").bind(orderId,row.web_order_id,version).first();
 return {state:job?.state||"error",filesDeleted:0};
}
async function centralTUSPurgeComplete(req,env){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({ok:false,error:'Acceso privado no autorizado'},signed.status);
 const p=signed.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
   Object.keys(p).sort().join(',')!=='deletedCount,productionVersion,schema,webOrderId'||
   p.schema!=='saber-central-tus-purge-complete-v1'||
   !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(p.webOrderId||'')||
   !Number.isSafeInteger(p.deletedCount)||p.deletedCount<1||p.deletedCount>10||
   !Number.isSafeInteger(p.productionVersion)||p.productionVersion<1)
  return json({ok:false,error:'Acuse inválido'},422);
 if(env.CENTRAL_TUS_PURGE_EXECUTE_ENABLED!=='PRIVATE_TEST_ONLY'||
    env.CENTRAL_TUS_PURGE_QUEUE_ENABLED!=='PRIVATE_TEST_ONLY')
  return json({ok:false,error:'Retención desactivada'},503);
 if(env.CENTRAL_TUS_PURGE_SCOPE!=='NEW_ORDERS_ONLY'&&
     !centralPurgeCanaryAllowed(env,p.webOrderId))
  return json({ok:false,error:'Orden fuera del ensayo autorizado'},403);
 await centralEnsureTUSPurgeTables(env);
 const row=await env.DB.prepare(
  "SELECT q.order_id,q.state,m.file_count,m.created_at AS manifest_created_at FROM central_tus_purge_queue q "+
  "JOIN central_document_manifests m ON m.web_order_id=q.web_order_id "+
  "JOIN orders o ON o.id=q.order_id "+
  "JOIN central_production_status p ON p.order_id=q.order_id "+
  "WHERE q.web_order_id=? AND q.production_version=? AND p.state='entregado' "+
  "AND p.version=q.production_version AND o.status='paid' AND o.paid_at IS NOT NULL "+
  "AND o.deposit_ars=o.amount_ars AND EXISTS (SELECT 1 FROM payment_reviews r "+
  "WHERE r.order_id=o.id AND r.state='verified') LIMIT 1"
 ).bind(p.webOrderId,p.productionVersion).first();
 if(!row||!centralPurgeCanaryAllowed(env,p.webOrderId,row.manifest_created_at)||
     row.file_count!==p.deletedCount||!['processing','completed'].includes(row.state))
  return json({ok:false,error:'Cola de eliminación incongruente'},409);
 if(row.state==='completed')return json({ok:true,state:'completed',alreadyConfirmed:true},200);
 const updated=await env.DB.prepare(
  "UPDATE central_tus_purge_queue SET state='completed',completed_at=datetime('now'),locked_at=NULL "+
  "WHERE web_order_id=? AND production_version=? AND state='processing'"
 ).bind(p.webOrderId,p.productionVersion).run();
 if(Number(updated?.meta?.changes)!==1)
  return json({ok:false,error:'La orden cambió de estado'},409);
 await env.DB.prepare("INSERT INTO central_tus_purge_audit "+
  "(order_id,production_version,phase,file_count) VALUES(?,?,'completed',?)")
  .bind(row.order_id,p.productionVersion,p.deletedCount).run();
 return json({ok:true,state:'completed',filesDeleted:p.deletedCount},200);
}
async function centralSignPurgeRequest(env,webOrderId){
 const bridge=env.SABER_DOCUMENTOS;
 if(typeof bridge?.fetch!=='function')throw Error('Worker de documentos no vinculado');
 if(typeof env.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32)
  throw Error('Clave de puente privada no configurada');
 const payload=JSON.stringify({schema:'saber-docs-tus-purge-delivered-v1',webOrderId});
 const ts=String(Math.floor(Date.now()/1000)),id=crypto.randomUUID();
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+payload))),b=>b.toString(16).padStart(2,'0')).join('');
 const r=await bridge.fetch(new Request(
  'https://saber-documentos-pruebas.libreriasaber.workers.dev/internal/tus-purge-delivered',{
   method:'POST',headers:{'Content-Type':'application/json','x-saber-ts':ts,
    'x-saber-request-id':id,'x-saber-signature':signature},body:payload
  }));
 if(r.status!==200)throw Error('El Worker de PDF no confirmó eliminación');
 const raw=await r.text();
 if(raw.length>2000)throw Error('Respuesta de limpieza inválida');
 let data;try{data=JSON.parse(raw)}catch{throw Error('Respuesta de limpieza inválida')}
 if(data?.ok!==true||data.mode!=='execute'||data.webOrderId!==webOrderId)
  throw Error('No se verificó eliminación de Storage');
 return data;
}
/**
 * Reintentos: reclamar atómicamente una fila, encolar auditoría y transferir
 * al Worker de documentos. Sin service binding / flags no modifica Storage.
 */
async function centralProcessTUSPurgeQueue(env,{orderId=null,limit=3}={}){
 if(env.CENTRAL_TUS_PURGE_EXECUTE_ENABLED!=='PRIVATE_TEST_ONLY'||
    env.CENTRAL_TUS_PURGE_QUEUE_ENABLED!=='PRIVATE_TEST_ONLY')return {enabled:false,processed:0};
 await centralEnsureTUSPurgeTables(env);
 const rows=await env.DB.prepare(
  "SELECT q.order_id,q.web_order_id,q.production_version,m.created_at AS manifest_created_at FROM central_tus_purge_queue q "+
   "JOIN central_document_manifests m ON m.web_order_id=q.web_order_id "+
  "WHERE (? IS NULL OR q.order_id=?) AND "+
  "(state IN ('pending','error') OR (state='processing' AND locked_at<datetime('now','-3 minutes'))) "+
  "ORDER BY q.created_at ASC LIMIT ?"
 ).bind(orderId,orderId,Math.min(5,Math.max(1,limit))).all();
 let processed=0,errors=0;
 for(const job of rows.results||[]){
  if(!centralPurgeCanaryAllowed(env,job.web_order_id,job.manifest_created_at))continue;
  const claimed=await env.DB.prepare(
   "UPDATE central_tus_purge_queue SET state='processing',locked_at=datetime('now'),"+
   "last_try_at=datetime('now'),attempts=attempts+1 "+
   "WHERE order_id=? AND web_order_id=? AND production_version=? AND "+
   "(state IN ('pending','error') OR (state='processing' AND locked_at<datetime('now','-3 minutes')))"
  ).bind(job.order_id,job.web_order_id,job.production_version).run();
  if(Number(claimed?.meta?.changes)!==1)continue;
  await env.DB.prepare("INSERT INTO central_tus_purge_audit "+
   "(order_id,production_version,phase) VALUES(?,?,'attempt')")
   .bind(job.order_id,job.production_version).run();
  try{
   await centralSignPurgeRequest(env,job.web_order_id);
   // El Worker documental confirma D1 antes de responder: no marcar aquí.
   processed++;
  }catch{
   await env.DB.prepare(
    "UPDATE central_tus_purge_queue SET state='error',locked_at=NULL "+
    "WHERE order_id=? AND production_version=? AND state='processing'"
   ).bind(job.order_id,job.production_version).run();
   await env.DB.prepare("INSERT INTO central_tus_purge_audit "+
    "(order_id,production_version,phase) VALUES(?,?,'error')")
    .bind(job.order_id,job.production_version).run();
   errors++;
  }
 }
 return {enabled:true,processed,errors};
}

async function centralUpdateProduction(req,env,ctx){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Seguimiento operativo no habilitado"},503);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
  return json({error:"Formato JSON obligatorio"},415);
 const raw=await req.text();
 if(raw.length>1200)return json({error:"Solicitud demasiado extensa"},413);
 let d;try{d=JSON.parse(raw)}catch{return json({error:"JSON incorrecto"},400)}
 if(!d||typeof d!=="object"||Array.isArray(d)||
    Object.keys(d).sort().join(",")!=="confirmed,from,operator,order_id,reason,to,version"||
    !CENTRAL_UUID.test(d.order_id||"")||
    !PRODUCTION_STATES.includes(d.from)||!PRODUCTION_STATES.includes(d.to)||
    !Number.isSafeInteger(d.version)||d.version<0||
    typeof d.operator!=="string"||d.operator.trim().length<2||d.operator.trim().length>60||
    typeof d.reason!=="string"||d.reason.length>280||
    typeof d.confirmed!=="boolean")
  return json({error:"Datos del cambio inválidos"},400);
 const operator=d.operator.trim(),reason=d.reason.trim();
 if(!PRODUCTION_NEXT[d.from].includes(d.to))return json({error:"Transición no permitida"},409);
 if(d.to==="en_espera"&&reason.length<5)return json({error:"Indicá el motivo de espera"},422);
 if(["listo","entregado"].includes(d.to)&&!d.confirmed)
  return json({error:"Confirmación operativa obligatoria"},422);
 await ensurePaymentReviews(env);
 await centralTables(env);
 await centralProductionTables(env);
 const universalLink=env.CENTRAL_R2_UNIVERSAL_ORDER_ENABLED==="PRIVATE_TEST_ONLY"?
  await env.DB.prepare("SELECT web_order_id FROM central_r2_universal_order_links "+
   "WHERE commercial_order_id=?").bind(d.order_id).first().catch(()=>null):null;
 if(universalLink){
  const {comprobarPreprensaUniversal}=await import("./r2-universal-preprensa-central.mjs");
  const authorized=await comprobarPreprensaUniversal(env,d.order_id);
  if(!authorized)return json({error:"Preprensa del pedido mixto sin aprobación"},409);
  if(d.to==="entregado"&&(
      env.CENTRAL_R2_UNIVERSAL_PURGE_ENABLED!=="PRIVATE_TEST_ONLY"||
      env.CENTRAL_R2_UNIVERSAL_PURGE_EXECUTE_ENABLED!=="PRIVATE_TEST_ONLY"||
      typeof env.SABER_DOCUMENTOS?.fetch!=="function"||
      typeof env.SABER_R2_GRANDES?.head!=="function"||
      typeof env.SABER_R2_GRANDES?.delete!=="function"||
      !(env.CENTRAL_R2_UNIVERSAL_PURGE_SCOPE==="NEW_ORDERS_ONLY"||
        env.CENTRAL_R2_UNIVERSAL_PURGE_CANARY_ORDER===universalLink.web_order_id)))
   return json({error:"Borrado mixto no preparado: no marcar Entregado"},409);
 }
 const eligible=universalLink?
  await env.DB.prepare("SELECT o.id FROM orders o WHERE o.id=? "+
   "AND o.status='paid' AND o.paid_at IS NOT NULL AND o.deposit_ars=o.amount_ars "+
   "AND EXISTS(SELECT 1 FROM payment_reviews r WHERE r.order_id=o.id "+
   "AND r.state='verified') LIMIT 1").bind(d.order_id).first():
 await env.DB.prepare(
  "SELECT o.id FROM orders o "+
  "LEFT JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
  "LEFT JOIN central_r2_prepress_approvals a ON a.order_id=o.id "+
  "WHERE (m.commercial_order_id IS NOT NULL OR a.order_id IS NOT NULL) "+
  "AND o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
  "AND o.deposit_ars=o.amount_ars AND EXISTS (SELECT 1 FROM payment_reviews p "+
  "WHERE p.order_id=o.id AND p.state='verified') LIMIT 1"
 ).bind(d.order_id).first();
 if(!eligible)return json({error:"Pedido documental sin pago verificado"},409);
 await env.DB.prepare("INSERT OR IGNORE INTO central_production_status(order_id) VALUES(?)").bind(d.order_id).run();
 const prior=await env.DB.prepare("SELECT state,version FROM central_production_status WHERE order_id=?").bind(d.order_id).first();
 if(!prior||prior.state!==d.from||prior.version!==d.version)
  return json({error:"El estado cambió en otro puesto. Actualizá el pedido."},409);
 const results=await env.DB.batch([
  env.DB.prepare("UPDATE central_production_status SET state=?,version=version+1,operator=?,reason=?,updated_at=datetime('now') "+
   "WHERE order_id=? AND state=? AND version=? AND EXISTS ("+
   "SELECT 1 FROM orders o WHERE o.id=central_production_status.order_id "+
   "AND o.status='paid' AND o.deposit_ars=o.amount_ars AND EXISTS ("+
   "SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id AND p.state='verified'))")
   .bind(d.to,operator,reason,d.order_id,d.from,d.version),
  env.DB.prepare("INSERT INTO central_production_events(order_id,version,from_state,to_state,operator,reason) "+
   "SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM central_production_status "+
   "WHERE order_id=? AND state=? AND version=?)")
   .bind(d.order_id,d.version+1,d.from,d.to,operator,reason,d.order_id,d.to,d.version+1)
 ]);
 if(Number(results?.[0]?.meta?.changes)!==1||Number(results?.[1]?.meta?.changes)!==1)
  return json({error:"Cambio no confirmado; actualizá el pedido"},409);
 let cleanup=null;
 if(d.to==='entregado'){
  try{
   cleanup=await centralQueueDeliveryCleanup(env,d.order_id,d.version+1,operator);
   if(cleanup.state==='pending'&&ctx?.waitUntil&&
      env.CENTRAL_TUS_PURGE_EXECUTE_ENABLED==='PRIVATE_TEST_ONLY')
    ctx.waitUntil(centralProcessTUSPurgeQueue(env,{orderId:d.order_id,limit:1})
     .catch(()=>{}));
  }catch{cleanup={state:'error',filesDeleted:0}}
 }
 let cleanupR2=null;
 if(d.to==='entregado'){
  try{
   const {encolarBorradoR2Entregado,ejecutarBorradoR2Entregado}=await import("./r2-borrado-entregado-central.mjs");
   cleanupR2=await encolarBorradoR2Entregado(env,d.order_id,d.version+1);
   if(cleanupR2.state==='pending')
    cleanupR2=await ejecutarBorradoR2Entregado(env,d.order_id);
  }catch{cleanupR2={state:'error',filesDeleted:0}}
 }
 let cleanupUniversal=null;
 if(d.to==='entregado'&&universalLink){
  try{
   const {encolarBorradoUniversalEntregado,procesarBorradoUniversalEntregado}=
    await import("./r2-universal-purge-central.mjs");
   cleanupUniversal=await encolarBorradoUniversalEntregado(env,d.order_id,d.version+1);
   if(cleanupUniversal.state==='pending'){
    const executed=await procesarBorradoUniversalEntregado(env,d.order_id);
    cleanupUniversal={...cleanupUniversal,...executed,
     state:executed.failed?'pendiente_reintento':'procesado'};
   }
  }catch{cleanupUniversal={state:'error_pendiente',filesDeleted:0}}
 }
 const current=await centralProductionDetail(env,d.order_id);
 return json({saved:true,production:current,cleanup,cleanupR2,
  cleanupUniversal,productionAuthorized:false});
}


/** Plazo inicial: lo confirma un operador; jamás inventa tiempos a partir del precio.
 * Los cambios quedan versionados y auditados en D1 privado.
 */
async function ensurePreparationEstimates(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_preparation_estimates (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,ready_at TEXT,version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),operator TEXT,reason TEXT,updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_preparation_estimate_events (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,version INTEGER NOT NULL,previous_at TEXT,ready_at TEXT,operator TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(order_id,version))").run();
}
async function preparationEstimateDetail(env,id){
 await ensurePreparationEstimates(env);
 const row=await env.DB.prepare("SELECT ready_at,version,operator,reason,updated_at FROM central_preparation_estimates WHERE order_id=?").bind(id).first();
 return {ready_at:row?.ready_at||null,version:row?.version||0,
  operator:row?.operator||null,reason:row?.reason||"",updated_at:row?.updated_at||null,
  provisional:true,source:"operador"};
}
async function updatePreparationEstimate(req,env){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Plazos privados deshabilitados"},503);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
  return json({error:"JSON requerido"},415);
 const raw=await req.text();
 if(raw.length>1200)return json({error:"Solicitud demasiado extensa"},413);
 let d;try{d=JSON.parse(raw)}catch{return json({error:"Solicitud inválida"},400)}
 if(!d||typeof d!=="object"||Array.isArray(d)||
  Object.keys(d).sort().join(",")!=="confirmed,expected_version,operator,order_id,ready_at,reason"||
  !CENTRAL_UUID.test(d.order_id||"")||d.confirmed!==true||
  !Number.isSafeInteger(d.expected_version)||d.expected_version<0||
  typeof d.operator!=="string"||d.operator.trim().length<2||d.operator.trim().length>60||
  typeof d.reason!=="string"||d.reason.length>240||
  !(d.ready_at===null||typeof d.ready_at==="string"))
  return json({error:"Datos de plazo incorrectos"},400);
 const ready=d.ready_at,operator=d.operator.trim(),reason=d.reason.trim();
 if(ready!==null){
  const when=Date.parse(ready),now=Date.now();
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(ready)||
   !Number.isFinite(when)||new Date(when).toISOString()!==ready||
   when<now+5*60000||when>now+45*24*3600000)
   return json({error:"Plazo fuera de rango: de 5 minutos a 45 días"},422);
 }
 await centralTables(env);await ensurePaymentReviews(env);await centralProductionTables(env);
 const eligible=await env.DB.prepare(
  "SELECT o.id,COALESCE(s.state,'pendiente') AS stage FROM orders o "+
  "LEFT JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
  "LEFT JOIN central_r2_prepress_approvals a ON a.order_id=o.id "+
  "LEFT JOIN central_production_status s ON s.order_id=o.id "+
  "WHERE (m.commercial_order_id IS NOT NULL OR a.order_id IS NOT NULL) AND "+
  "o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
  "AND o.deposit_ars=o.amount_ars AND EXISTS (SELECT 1 FROM payment_reviews p "+
  "WHERE p.order_id=o.id AND p.state='verified') LIMIT 1"
 ).bind(d.order_id).first();
 if(!eligible||["listo","entregado"].includes(eligible.stage))
  return json({error:"Pedido documental sin pago verificado o ya terminado"},409);
 await ensurePreparationEstimates(env);
 await env.DB.prepare("INSERT OR IGNORE INTO central_preparation_estimates(order_id) VALUES(?)").bind(d.order_id).run();
 const prior=await env.DB.prepare("SELECT ready_at,version FROM central_preparation_estimates WHERE order_id=?").bind(d.order_id).first();
 if(!prior||prior.version!==d.expected_version)
  return json({error:"El plazo cambió en otro puesto; actualizá el detalle"},409);
 if(ready===prior.ready_at)return json({error:"No hay cambios que guardar"},409);
 if(prior.ready_at&&(ready===null||Date.parse(ready)>Date.parse(prior.ready_at))&&reason.length<5)
  return json({error:"Indicá el motivo del cambio de plazo"},422);
 let res;
 try{
  res=await env.DB.batch([
   env.DB.prepare("UPDATE central_preparation_estimates SET ready_at=?,version=version+1,operator=?,reason=?,updated_at=datetime('now') "+
    "WHERE order_id=? AND version=? AND EXISTS (SELECT 1 FROM orders o "+
    "WHERE o.id=central_preparation_estimates.order_id AND o.status='paid' "+
    "AND o.deposit_ars=o.amount_ars AND EXISTS (SELECT 1 FROM payment_reviews p "+
    "WHERE p.order_id=o.id AND p.state='verified'))")
    .bind(ready,operator,reason,d.order_id,d.expected_version),
   env.DB.prepare("INSERT INTO central_preparation_estimate_events(order_id,version,previous_at,ready_at,operator,reason) "+
    "SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM central_preparation_estimates "+
    "WHERE order_id=? AND version=? AND ready_at IS ?)")
    .bind(d.order_id,d.expected_version+1,prior.ready_at,ready,operator,reason,
     d.order_id,d.expected_version+1,ready)
  ]);
 }catch(_){return json({error:"No se guardó el cambio; actualizá el detalle"},409)}
 if(!Array.isArray(res)||res.length!==2||res.some(x=>Number(x?.meta?.changes)!==1))
  return json({error:"No se confirmó el cambio de plazo"},409);
 return json({saved:true,estimate:await preparationEstimateDetail(env,d.order_id),
  productionAuthorized:false,paymentsEnabled:false});
}


/** Mensaje de entrega configurable por la Central: jamás calcula tiempos de producción. */
const DELIVERY_MODES=["por_confirmar","hoy","hoy_tarde","proximo_dia"];
async function ensureDeliveryPlan(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_delivery_plan (id INTEGER PRIMARY KEY CHECK(id=1),mode TEXT NOT NULL CHECK(mode IN ('por_confirmar','hoy','hoy_tarde','proximo_dia')),revision INTEGER NOT NULL,operator TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_delivery_plan_events (id INTEGER PRIMARY KEY AUTOINCREMENT,revision INTEGER NOT NULL UNIQUE,mode TEXT NOT NULL,operator TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
}
async function deliveryPlanSetting(env){
 await ensureDeliveryPlan(env);
 const row=await env.DB.prepare("SELECT mode,revision,operator,updated_at FROM central_delivery_plan WHERE id=1").first();
 return row||{mode:"por_confirmar",revision:0,operator:null,updated_at:null};
}
function deliveryPlanForCustomer(mode,paidAt,stage,now=Date.now()){
 if(!["pendiente","en_preparacion"].includes(stage)||!DELIVERY_MODES.includes(mode))return "por_confirmar";
 if(mode!=="hoy"&&mode!=="hoy_tarde")return mode;
 const paid=typeof paidAt==="string"?Date.parse(paidAt.includes("T")?paidAt:paidAt.replace(" ","T")+"Z"):NaN;
 if(!Number.isFinite(paid))return "por_confirmar";
 const parts=ms=>Object.fromEntries(new Intl.DateTimeFormat("en-US",{
  timeZone:"America/Argentina/Cordoba",year:"numeric",month:"2-digit",day:"2-digit",
  weekday:"short",hour:"2-digit",hourCycle:"h23"
 }).formatToParts(new Date(ms)).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 const p=parts(paid),n=parts(now);
 if(n.weekday==="Sat"||n.weekday==="Sun"||Number(n.hour)>=20||
    [p.year,p.month,p.day].join("-")!==[n.year,n.month,n.day].join("-"))return "por_confirmar";
 return mode;
}
async function deliveryPlanApi(req,env){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Previsión privada deshabilitada"},503);
 if(req.method==="GET")return json({settings:await deliveryPlanSetting(env),paymentsEnabled:false});
 if(req.method!=="POST")return json({error:"Método no admitido"},405);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
  return json({error:"JSON requerido"},415);
 const raw=await req.text();if(raw.length>600)return json({error:"Solicitud demasiado extensa"},413);
 let d;try{d=JSON.parse(raw)}catch{return json({error:"Solicitud inválida"},400)}
 if(!d||typeof d!=="object"||Array.isArray(d)||
    Object.keys(d).sort().join(",")!=="confirmed,expectedRevision,mode,operator"||
    !DELIVERY_MODES.includes(d.mode)||d.confirmed!==true||
    !Number.isSafeInteger(d.expectedRevision)||d.expectedRevision<0||
    typeof d.operator!=="string"||d.operator.trim().length<2||d.operator.trim().length>60)
  return json({error:"Previsión de entrega inválida"},400);
 const prior=await deliveryPlanSetting(env);
 if(prior.revision!==d.expectedRevision)return json({error:"La previsión cambió en otro puesto"},409);
 if(prior.mode===d.mode)return json({error:"No hay cambios"},409);
 const operator=d.operator.trim();
 let result;
 try{
  if(prior.revision===0)result=await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO central_delivery_plan(id,mode,revision,operator) VALUES(1,?,1,?)").bind(d.mode,operator),
   env.DB.prepare("INSERT INTO central_delivery_plan_events(revision,mode,operator) SELECT 1,?,? WHERE EXISTS(SELECT 1 FROM central_delivery_plan WHERE id=1 AND revision=1)").bind(d.mode,operator)
  ]);
  else result=await env.DB.batch([
   env.DB.prepare("UPDATE central_delivery_plan SET mode=?,revision=revision+1,operator=?,updated_at=datetime('now') WHERE id=1 AND revision=?").bind(d.mode,operator,prior.revision),
   env.DB.prepare("INSERT INTO central_delivery_plan_events(revision,mode,operator) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM central_delivery_plan WHERE id=1 AND revision=?)").bind(prior.revision+1,d.mode,operator,prior.revision+1)
  ]);
 }catch{return json({error:"No se pudo confirmar el cambio"},409)}
 if(!Array.isArray(result)||result.length!==2||result.some(x=>Number(x?.meta?.changes)!==1))
  return json({error:"Cambio no confirmado"},409);
 return json({saved:true,settings:await deliveryPlanSetting(env),productionAuthorized:false,paymentsEnabled:false});
}

/** Ajuste global de demora: criterio comercial del operador, no duración por orden.
 * Sin capacidad simultánea calibrada, no sumar pedidos linealmente.
 */
async function ensureEtaSettings(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_eta_settings (id INTEGER PRIMARY KEY CHECK(id=1),base_minutes INTEGER NOT NULL CHECK(base_minutes BETWEEN 30 AND 1440),parallel_orders INTEGER NOT NULL DEFAULT 0 CHECK(parallel_orders BETWEEN 0 AND 30),revision INTEGER NOT NULL DEFAULT 1,operator TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_eta_settings_events (id INTEGER PRIMARY KEY AUTOINCREMENT,revision INTEGER NOT NULL UNIQUE,base_minutes INTEGER NOT NULL,parallel_orders INTEGER NOT NULL,operator TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
}
async function etaSettings(env){
 await ensureEtaSettings(env);
 const row=await env.DB.prepare("SELECT base_minutes,parallel_orders,revision,operator,updated_at FROM central_eta_settings WHERE id=1").first();
 return row||{base_minutes:180,parallel_orders:0,revision:0,operator:null,updated_at:null};
}
async function etaQueue(env){
 await centralTables(env);await centralProductionTables(env);await ensurePaymentReviews(env);
 const row=await env.DB.prepare("SELECT COUNT(*) AS active FROM orders o "+
  "JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
  "LEFT JOIN central_production_status s ON s.order_id=o.id "+
  "WHERE o.status='paid' AND o.paid_at IS NOT NULL AND o.deposit_ars=o.amount_ars "+
  "AND COALESCE(s.state,'pendiente') IN ('pendiente','en_preparacion') "+
  "AND EXISTS (SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id AND p.state='verified')").first();
 return Number(row?.active)||0;
}
function etaForQueue(settings,activeAhead){
 // El tiempo habitual NO mide duración de cada trabajo. No sumarlo por tandas.
 // Si hay saturación, pedir revisión humana en vez de prometer horas ficticias.
 const cap=settings.parallel_orders;
 return {minutes:settings.base_minutes,queueCalibrated:cap>0,
  requiresReview:cap>0&&activeAhead>=cap,
  baseMinutes:settings.base_minutes,activeAhead,parallelOrders:cap};
}
function standardPrintJob(manifest){
 let docs;
 try{docs=JSON.parse(manifest)}catch{return false}
 if(!Array.isArray(docs?.trabajos)||docs.trabajos.length<1)return false;
 let pages=0;
 for(const t of docs.trabajos){
  if(t.servicio!=="documentos"||!Number.isSafeInteger(t.copias)||t.copias<1||
     !Array.isArray(t.paginasElegidas)||t.paginasElegidas.length<1)return false;
  pages+=t.paginasElegidas.length*t.copias;
  if(pages>400)return false;
 }
 return pages>0;
}
async function etaAdminApi(req,env){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Configuración privada deshabilitada"},503);
 if(req.method==="GET"){
  const [settings,active]=await Promise.all([etaSettings(env),etaQueue(env)]);
  return json({settings,activePaidOrders:active,queueCalibrated:settings.parallel_orders>0,
   note:"La demora es aproximada; 0 capacidad significa que no se agrega cola sin calibración."});
 }
 if(req.method!=="POST")return json({error:"Método no admitido"},405);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
  return json({error:"JSON requerido"},415);
 const raw=await req.text();if(raw.length>900)return json({error:"Solicitud demasiado larga"},413);
 let d;try{d=JSON.parse(raw)}catch{return json({error:"JSON inválido"},400)}
 if(!d||typeof d!=="object"||Array.isArray(d)||
   Object.keys(d).sort().join(",")!=="baseMinutes,confirmed,expectedRevision,operator,parallelOrders"||
   !Number.isSafeInteger(d.baseMinutes)||d.baseMinutes<30||d.baseMinutes>1440||
   !Number.isSafeInteger(d.parallelOrders)||d.parallelOrders<0||d.parallelOrders>30||
   !Number.isSafeInteger(d.expectedRevision)||d.expectedRevision<0||d.confirmed!==true||
   typeof d.operator!=="string"||d.operator.trim().length<2||d.operator.trim().length>60)
  return json({error:"Configuración de demora inválida"},400);
 const current=await etaSettings(env);
 if(d.expectedRevision!==current.revision)return json({error:"La configuración fue modificada en otra pestaña"},409);
 if(d.baseMinutes===current.base_minutes&&d.parallelOrders===current.parallel_orders)
  return json({error:"No hay cambios"},409);
 let result;
 try{
  if(current.revision===0){
   result=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO central_eta_settings(id,base_minutes,parallel_orders,revision,operator) VALUES(1,?,?,1,?)").bind(d.baseMinutes,d.parallelOrders,d.operator.trim()),
    env.DB.prepare("INSERT INTO central_eta_settings_events(revision,base_minutes,parallel_orders,operator) "+
      "SELECT 1,?,?,? WHERE EXISTS (SELECT 1 FROM central_eta_settings WHERE id=1 AND revision=1)").bind(d.baseMinutes,d.parallelOrders,d.operator.trim())
   ]);
  }else{
   result=await env.DB.batch([
    env.DB.prepare("UPDATE central_eta_settings SET base_minutes=?,parallel_orders=?,revision=revision+1,operator=?,updated_at=datetime('now') WHERE id=1 AND revision=?").bind(d.baseMinutes,d.parallelOrders,d.operator.trim(),d.expectedRevision),
    env.DB.prepare("INSERT INTO central_eta_settings_events(revision,base_minutes,parallel_orders,operator) "+
      "SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM central_eta_settings WHERE id=1 AND revision=?)").bind(d.expectedRevision+1,d.baseMinutes,d.parallelOrders,d.operator.trim(),d.expectedRevision+1)
   ]);
  }
 }catch{return json({error:"Conflicto de actualización; recargá configuración"},409)}
 if(!Array.isArray(result)||result.some(x=>Number(x?.meta?.changes)!==1))
  return json({error:"No se confirmó el ajuste"},409);
 return json({saved:true,settings:await etaSettings(env),activePaidOrders:await etaQueue(env),
  productionAuthorized:false,paymentsEnabled:false});
}


/** Agenda privada de preparación; sin horario configurado NO se calcula un retiro. */
const ETA_DAYS=["mon","tue","wed","thu","fri","sat","sun"];
const ETA_EMPTY={mon:"",tue:"",wed:"",thu:"",fri:"",sat:"",sun:""};
function etaParseSlots(value){
 if(typeof value!=="string"||value.length>120)return null;
 if(!value.trim())return [];
 const out=[];let last=0;
 const parts=value.split(",");if(parts.length>4)return null;
 for(const p of parts){
  const m=p.trim().match(/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]|24):([0-5]\d)$/);
  if(!m||m[3]==="24"&&m[4]!=="00")return null;
  const a=Number(m[1])*60+Number(m[2]),b=Number(m[3])*60+Number(m[4]);
  if(a>=b||b-a<15||a<last||b>1440)return null;
  out.push([a,b]);last=b;
 }
 return out;
}
function etaNormalizeCalendar(weekly,closedDates){
 if(!weekly||typeof weekly!=="object"||Array.isArray(weekly)||
    Object.keys(weekly).sort().join(",")!==[...ETA_DAYS].sort().join(",")||
    !Array.isArray(closedDates)||closedDates.length>180)return null;
 const normalized={};
 for(const day of ETA_DAYS){
  const slots=etaParseSlots(weekly[day]);if(slots===null)return null;
  normalized[day]=slots.map(([a,b])=>[a,b].map(n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")).join("-")).join(",");
 }
 if(closedDates.some(date=>{
  if(typeof date!=="string"||!/^(20\d\d|2100)-\d{2}-\d{2}$/.test(date))return true;
  const d=new Date(date+"T00:00:00Z");
  return !Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date;
 })||new Set(closedDates).size!==closedDates.length)return null;
 return {weekly:normalized,closedDates:[...closedDates].sort()};
}
async function ensureEtaCalendar(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_eta_calendar (id INTEGER PRIMARY KEY CHECK(id=1),weekly_json TEXT NOT NULL,closed_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,operator TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_eta_calendar_events (id INTEGER PRIMARY KEY AUTOINCREMENT,revision INTEGER NOT NULL UNIQUE,weekly_json TEXT NOT NULL,closed_json TEXT NOT NULL,operator TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
}
async function etaCalendar(env){
 await ensureEtaCalendar(env);
 const row=await env.DB.prepare("SELECT weekly_json,closed_json,revision,operator,updated_at FROM central_eta_calendar WHERE id=1").first();
 if(!row)return {weekly:{...ETA_EMPTY},closedDates:[],configured:false,revision:0,operator:null,updated_at:null};
 const data=etaNormalizeCalendar(JSON.parse(row.weekly_json),JSON.parse(row.closed_json));
 if(!data)throw Error("Agenda inválida");
 return {...data,configured:ETA_DAYS.some(day=>Boolean(data.weekly[day])),
  revision:row.revision,operator:row.operator,updated_at:row.updated_at};
}
/** Computar tiempo de atención real en Córdoba. La hora de pago es un ancla fija,
 * no Date.now(): refrescar la página no desplaza el compromiso.
 */
function etaOperatingFinish(calendar,anchorUtc,minutes){
 if(!calendar?.configured||!Number.isSafeInteger(minutes)||minutes<1)return null;
 const raw=String(anchorUtc||"");
 const start=Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(raw)?raw.replace(" ","T")+"Z":raw);
 if(!Number.isFinite(start))return null;
 let local=start-3*3600000,remaining=minutes;
 const closed=new Set(calendar.closedDates);
 for(let n=0;n<370;n++){
  const midnight=Math.floor(local/86400000)*86400000;
  const day=new Date(midnight),key=day.toISOString().slice(0,10);
  const wd=ETA_DAYS[(day.getUTCDay()+6)%7];
  if(!closed.has(key)){
   for(const [a,b] of etaParseSlots(calendar.weekly[wd])||[]){
    const from=Math.max(local,midnight+a*60000),end=midnight+b*60000;
    if(from>=end)continue;
    const available=(end-from)/60000;
    if(remaining<=available)return new Date(from+remaining*60000+3*3600000).toISOString();
    remaining-=available;
   }
  }
  local=midnight+86400000;
 }
 return null;
}
async function etaCalendarApi(req,env){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Agenda privada deshabilitada"},503);
 if(req.method==="GET")return json({calendar:await etaCalendar(env),paymentsEnabled:false});
 if(req.method!=="POST")return json({error:"Método no admitido"},405);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
  return json({error:"JSON requerido"},415);
 const raw=await req.text();if(raw.length>6500)return json({error:"Agenda demasiado larga"},413);
 let d;try{d=JSON.parse(raw)}catch{return json({error:"JSON inválido"},400)}
 if(!d||typeof d!=="object"||Array.isArray(d)||
   Object.keys(d).sort().join(",")!=="closedDates,confirmed,expectedRevision,operator,weekly"||
   !Number.isSafeInteger(d.expectedRevision)||d.expectedRevision<0||d.confirmed!==true||
   typeof d.operator!=="string"||d.operator.trim().length<2||d.operator.trim().length>60)
  return json({error:"Campos de agenda inválidos"},400);
 const normalized=etaNormalizeCalendar(d.weekly,d.closedDates);
 if(!normalized)return json({error:"Horarios o fechas inválidos o superpuestos"},422);
 const current=await etaCalendar(env);
 if(d.expectedRevision!==current.revision)return json({error:"La agenda cambió en otra pestaña"},409);
 if(JSON.stringify(normalized.weekly)===JSON.stringify(current.weekly)&&
   JSON.stringify(normalized.closedDates)===JSON.stringify(current.closedDates))
  return json({error:"No hay cambios"},409);
 const w=JSON.stringify(normalized.weekly),c=JSON.stringify(normalized.closedDates),o=d.operator.trim();
 let result;
 try{
  if(current.revision===0)result=await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO central_eta_calendar(id,weekly_json,closed_json,revision,operator) VALUES(1,?,?,1,?)").bind(w,c,o),
   env.DB.prepare("INSERT INTO central_eta_calendar_events(revision,weekly_json,closed_json,operator) SELECT 1,?,?,? WHERE EXISTS (SELECT 1 FROM central_eta_calendar WHERE id=1 AND revision=1)").bind(w,c,o)
  ]);
  else result=await env.DB.batch([
   env.DB.prepare("UPDATE central_eta_calendar SET weekly_json=?,closed_json=?,revision=revision+1,operator=?,updated_at=datetime('now') WHERE id=1 AND revision=?").bind(w,c,o,current.revision),
   env.DB.prepare("INSERT INTO central_eta_calendar_events(revision,weekly_json,closed_json,operator) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM central_eta_calendar WHERE id=1 AND revision=?)").bind(current.revision+1,w,c,o,current.revision+1)
  ]);
 }catch{return json({error:"Conflicto al guardar; recargá agenda"},409)}
 if(!Array.isArray(result)||result.some(x=>Number(x?.meta?.changes)!==1))
  return json({error:"No se confirmó el cambio de agenda"},409);
 return json({saved:true,calendar:await etaCalendar(env),paymentsEnabled:false,productionAuthorized:false});
}


/** Invitaciones móviles privadas: la contraseña Basic no se guarda ni se entrega.
 * El titular se autoriza desde la Central; el portal consume una invitación una vez.
 * En D1 se persiste únicamente SHA-256 del ticket (nunca el ticket completo).
 */
async function ensureMobileInvites(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_mobile_invites (token_hash TEXT PRIMARY KEY CHECK(length(token_hash)=64),operator TEXT NOT NULL,issued_at TEXT NOT NULL DEFAULT (datetime('now')),expires_at TEXT NOT NULL,consumed_at TEXT)").run();
 await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_central_mobile_invites_issued ON central_mobile_invites(issued_at)").run();
}
async function mobileInviteHash(raw){
 const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
 return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
async function createMobileInvite(req,env){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY"||
    env.CENTRAL_BRIDGE_ENABLED!=="PRIVATE_TEST_ONLY"||
    typeof env.CENTRAL_BRIDGE_KEY!=="string"||env.CENTRAL_BRIDGE_KEY.length<32)
  return json({error:"Ingreso móvil privado no disponible"},503);
 if(req.method!=="POST")return json({error:"Método no admitido"},405);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
  return json({error:"JSON requerido"},415);
 const raw=await req.text();
 if(raw.length>400)return json({error:"Datos demasiado extensos"},413);
 let d;try{d=JSON.parse(raw)}catch{return json({error:"Datos inválidos"},400)}
 if(!d||typeof d!=="object"||Array.isArray(d)||
    Object.keys(d).sort().join(",")!=="confirmed,operator"||
    d.confirmed!==true||typeof d.operator!=="string"||
    d.operator.trim().length<2||d.operator.trim().length>60)
  return json({error:"Indicá responsable y confirmá el acceso móvil"},400);
 await ensureMobileInvites(env);
 const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM central_mobile_invites WHERE issued_at>=datetime('now','-10 minutes')").first();
 if(Number(count?.count)>9)return json({error:"Demasiados enlaces; intentá más tarde"},429);
 const ticket=crypto.randomUUID()+"."+crypto.randomUUID();
 const digest=await mobileInviteHash(ticket);
 const saved=await env.DB.prepare("INSERT INTO central_mobile_invites(token_hash,operator,expires_at) VALUES(?,?,datetime('now','+3 minutes'))").bind(digest,d.operator.trim()).run();
 if(Number(saved?.meta?.changes)!==1)return json({error:"No se pudo habilitar el acceso"},503);
 const url="https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/ingresar#ticket="+ticket;
 return new Response(JSON.stringify({ok:true,url,expiresInSeconds:180,oneUse:true}),{
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private",
   "Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex,nofollow"}});
}
async function redeemMobileInvite(req,env){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({ok:false,error:"Invitación no autorizada"},signed.status);
 const d=signed.payload;
 if(!d||typeof d!=="object"||Array.isArray(d)||
    Object.keys(d).sort().join(",")!=="schema,tokenHash"||
    d.schema!=="saber-private-mobile-redeem-v1"||
    typeof d.tokenHash!=="string"||!/^[a-f0-9]{64}$/.test(d.tokenHash))
  return json({ok:false,error:"Invitación inválida"},400);
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({ok:false,error:"Ingreso privado no habilitado"},503);
 await ensureMobileInvites(env);
 const updated=await env.DB.prepare(
  "UPDATE central_mobile_invites SET consumed_at=datetime('now') "+
  "WHERE token_hash=? AND consumed_at IS NULL AND expires_at>datetime('now')"
 ).bind(d.tokenHash).run();
 if(Number(updated?.meta?.changes)!==1)
  return json({ok:false,error:"Invitación vencida o utilizada"},409);
 return new Response(JSON.stringify({ok:true,consumed:true}),{
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private"}});
}


/** Instrumentación de recursos: cuenta pedidos, nunca minutos ficticios ni
 * movimientos de máquina. Un pedido mixto puede ocupar más de una categoría.
 */
function etaResourceTags(manifest){
 let m;
 try{m=typeof manifest==="string"?JSON.parse(manifest):manifest}catch{return {review:true}}
 if(!m||!Array.isArray(m.trabajos)||!m.trabajos.length)return {review:true};
 const tags={documents:false,bn:false,color:false,unknownPrint:false,binding:false,cad:false,poster:false,review:false};
 for(const t of m.trabajos){
  if(t?.servicio==="documentos"){
   tags.documents=true;
   if(t.modo==="bn"||t.modo==="b/n")tags.bn=true;
   else if(t.modo==="color")tags.color=true;
   else tags.unknownPrint=true; // Solo lectura; no inferir B/N ni color.
   if(t.tipoAnillado==="individual"||t.tipoAnillado==="grupo")tags.binding=true;
   else if(t.tipoAnillado!=="ninguno")tags.review=true;
  }else if(t?.servicio==="ploteos"){
   if(!Array.isArray(t.planoPorPagina)||!t.planoPorPagina.length)tags.review=true;
   else for(const page of t.planoPorPagina){
    if(page?.modo==="cad")tags.cad=true;
    else if(page?.modo==="poster")tags.poster=true;
    else tags.review=true;
   }
  }else tags.review=true;
 }
 return tags;
}
async function etaResourceLoad(env){
 await centralTables(env);await centralProductionTables(env);await ensurePaymentReviews(env);
 const response=await env.DB.prepare(
  "SELECT m.manifest_json FROM orders o JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
  "LEFT JOIN central_production_status s ON s.order_id=o.id "+
  "WHERE o.status='paid' AND o.paid_at IS NOT NULL AND o.deposit_ars=o.amount_ars "+
  "AND COALESCE(s.state,'pendiente') IN ('pendiente','en_preparacion') "+
  "AND EXISTS (SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id AND p.state='verified') "+
  "ORDER BY o.paid_at ASC,o.id ASC LIMIT 501"
 ).all();
 const rows=response.results||[],out={paidActive:Math.min(rows.length,500),
  documents:0,bn:0,color:0,unknownPrint:0,binding:0,cad:0,poster:0,review:0,partial:rows.length>500};
 for(const row of rows.slice(0,500)){
  const tags=etaResourceTags(row.manifest_json);
  for(const key of ["documents","bn","color","unknownPrint","binding","cad","poster","review"])if(tags[key])out[key]++;
 }
 return out;
}
async function ensureEtaResourceSettings(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_eta_resources (id INTEGER PRIMARY KEY CHECK(id=1),print_parallel INTEGER NOT NULL CHECK(print_parallel BETWEEN 0 AND 30),binding_parallel INTEGER NOT NULL CHECK(binding_parallel BETWEEN 0 AND 30),plotter_parallel INTEGER NOT NULL CHECK(plotter_parallel BETWEEN 0 AND 30),revision INTEGER NOT NULL,operator TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_eta_resource_events (id INTEGER PRIMARY KEY AUTOINCREMENT,revision INTEGER NOT NULL UNIQUE,print_parallel INTEGER NOT NULL,binding_parallel INTEGER NOT NULL,plotter_parallel INTEGER NOT NULL,operator TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
}
async function etaResourceSettings(env){
 await ensureEtaResourceSettings(env);
 const row=await env.DB.prepare("SELECT print_parallel,binding_parallel,plotter_parallel,revision,operator,updated_at FROM central_eta_resources WHERE id=1").first();
 return row||{print_parallel:0,binding_parallel:0,plotter_parallel:0,revision:0,operator:null,updated_at:null};
}
async function etaResourcesApi(req,env){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Capacidad privada deshabilitada"},503);
 if(req.method==="GET"){
  const [settings,load]=await Promise.all([etaResourceSettings(env),etaResourceLoad(env)]);
  return json({settings,load,notice:"Conteo orientativo por pedido pagado; no calcula duración ni promete retiro."});
 }
 if(req.method!=="POST")return json({error:"Método no admitido"},405);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
  return json({error:"JSON requerido"},415);
 const raw=await req.text();if(raw.length>500)return json({error:"Datos demasiado extensos"},413);
 let d;try{d=JSON.parse(raw)}catch{return json({error:"Solicitud inválida"},400)}
 if(!d||typeof d!=="object"||Array.isArray(d)||
   Object.keys(d).sort().join(",")!=="bindingParallel,confirmed,expectedRevision,operator,plotterParallel,printParallel"||
   [d.bindingParallel,d.plotterParallel,d.printParallel].some(n=>!Number.isSafeInteger(n)||n<0||n>30)||
   !Number.isSafeInteger(d.expectedRevision)||d.expectedRevision<0||
   d.confirmed!==true||typeof d.operator!=="string"||
   d.operator.trim().length<2||d.operator.trim().length>60)
  return json({error:"Capacidad de recursos inválida"},400);
 const current=await etaResourceSettings(env);
 if(current.revision!==d.expectedRevision)return json({error:"Configuración modificada en otro puesto"},409);
 if(current.print_parallel===d.printParallel&&current.binding_parallel===d.bindingParallel&&
    current.plotter_parallel===d.plotterParallel)return json({error:"No hay cambios"},409);
 const values=[d.printParallel,d.bindingParallel,d.plotterParallel,d.operator.trim()];
 let result;
 try{
  if(current.revision===0)result=await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO central_eta_resources(id,print_parallel,binding_parallel,plotter_parallel,revision,operator) VALUES(1,?,?,?,1,?)").bind(...values),
   env.DB.prepare("INSERT INTO central_eta_resource_events(revision,print_parallel,binding_parallel,plotter_parallel,operator) SELECT 1,?,?,?,? WHERE EXISTS(SELECT 1 FROM central_eta_resources WHERE id=1 AND revision=1)").bind(...values)
  ]);
  else result=await env.DB.batch([
   env.DB.prepare("UPDATE central_eta_resources SET print_parallel=?,binding_parallel=?,plotter_parallel=?,operator=?,revision=revision+1,updated_at=datetime('now') WHERE id=1 AND revision=?").bind(...values,current.revision),
   env.DB.prepare("INSERT INTO central_eta_resource_events(revision,print_parallel,binding_parallel,plotter_parallel,operator) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM central_eta_resources WHERE id=1 AND revision=?)").bind(current.revision+1,...values,current.revision+1)
  ]);
 }catch{return json({error:"Conflicto al guardar capacidades"},409)}
 if(!Array.isArray(result)||result.some(x=>Number(x?.meta?.changes)!==1))
  return json({error:"No se confirmó el ajuste de capacidades"},409);
 return json({saved:true,settings:await etaResourceSettings(env),productionAuthorized:false,paymentsEnabled:false});
}



/** Mediciones verificadas manualmente del proceso real; NO son una fórmula de ETA.
 * Solo datos agregados por tipo de trabajo, sin archivos, contactos ni pedidos.
 * Una impresión usa hojas; un anillado usa unidades; un ploteo mide centímetros de rollo.
 */
const ETA_SAMPLE_RESOURCES=["docs_bn","docs_color","anillados","cad","poster"];
async function ensureEtaSamples(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_eta_productivity_samples (id INTEGER PRIMARY KEY AUTOINCREMENT,resource TEXT NOT NULL CHECK(resource IN ('docs_bn','docs_color','anillados','cad','poster')),quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 25000),duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 1 AND 28800),operator TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
 await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_central_eta_samples_resource ON central_eta_productivity_samples(resource,id)").run();
}
async function etaSamplesApi(req,env){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Calibración privada deshabilitada"},503);
 if(req.method!=="GET"&&req.method!=="POST")return json({error:"Método no admitido"},405);
 if(req.method==="POST"){
  if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
   return json({error:"JSON requerido"},415);
  const raw=await req.text();if(raw.length>480)return json({error:"Datos demasiado extensos"},413);
  let d;try{d=JSON.parse(raw)}catch{return json({error:"JSON inválido"},400)}
  if(!d||typeof d!=="object"||Array.isArray(d)||
     Object.keys(d).sort().join(",")!=="confirmed,durationSeconds,operator,quantity,resource"||
     !ETA_SAMPLE_RESOURCES.includes(d.resource)||
     !Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>25000||
     !Number.isSafeInteger(d.durationSeconds)||d.durationSeconds<1||d.durationSeconds>28800||
     d.confirmed!==true||typeof d.operator!=="string"||
     d.operator.trim().length<2||d.operator.trim().length>60)
   return json({error:"Medición inválida: ingresá cantidad y tiempo realmente medidos"},400);
  await ensureEtaSamples(env);
  const inserted=await env.DB.prepare(
   "INSERT INTO central_eta_productivity_samples(resource,quantity,duration_seconds,operator) VALUES(?,?,?,?)"
  ).bind(d.resource,d.quantity,d.durationSeconds,d.operator.trim()).run();
  if(Number(inserted?.meta?.changes)!==1)return json({error:"No se guardó la medición"},503);
  return json({saved:true,etaApplied:false,paymentsEnabled:false});
 }
 await ensureEtaSamples(env);
 const rows=(await env.DB.prepare(
  "SELECT resource,quantity,duration_seconds,created_at FROM central_eta_productivity_samples ORDER BY id DESC LIMIT 40"
 ).all()).results||[];
 const count=Object.fromEntries(ETA_SAMPLE_RESOURCES.map(k=>[k,0]));
 for(const x of rows)if(Object.prototype.hasOwnProperty.call(count,x.resource))count[x.resource]++;
 return json({samples:rows,countLast40:count,limit:40,etaApplied:false,
  notice:"Mediciones reales registradas, todavía sin cálculo automático de plazos."});
}

/** Recursos productivos por pedido, no horas ficticias por tanda.
 * CAD y póster ocupan la misma capacidad de ploteos por pedido.
 * Un dato faltante o una cola demasiado grande exige revisión humana.
 */
function etaResourceQueueDecision(current,rows,settings,partial=false){
 const need=etaResourceTags(current),cap={
  documents:Number(settings?.print_parallel)||0,
  binding:Number(settings?.binding_parallel)||0,
  plotter:Number(settings?.plotter_parallel)||0
 };
 const required=["documents","binding","plotter"].filter(k=>
  k==="plotter"?(need.cad||need.poster):need[k]);
 if(need.review||required.length===0)
  return {calibrated:false,requiresReview:true,status:"incomplete"};
 if(partial)return {calibrated:false,requiresReview:true,status:"unknown_queue"};
 if(required.some(k=>cap[k]<=0))
  return {calibrated:false,requiresReview:false,status:"unconfigured"};
 const busy={documents:0,binding:0,plotter:0};
 for(const row of rows){
  const used=etaResourceTags(row.manifest_json);
  if(used.review)return {calibrated:true,requiresReview:true,status:"unknown_queue"};
  if(used.documents)busy.documents++;
  if(used.binding)busy.binding++;
  if(used.cad||used.poster)busy.plotter++;
 }
 if(required.some(k=>busy[k]>=cap[k]))
  return {calibrated:true,requiresReview:true,status:"saturated"};
 return {calibrated:true,requiresReview:false,status:"available"};
}
async function etaResourceQueueForOrder(env,order){
 const settings=await etaResourceSettings(env);
 // Revisión cero: el titular aún no configuró capacidades por recurso.
 if(!settings.revision)return null;
 await centralTables(env);await centralProductionTables(env);await ensurePaymentReviews(env);
 const result=await env.DB.prepare(
  "SELECT m.manifest_json FROM orders o "+
  "JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
  "LEFT JOIN central_production_status s ON s.order_id=o.id "+
  "WHERE o.id<>? AND o.status='paid' AND o.paid_at IS NOT NULL "+
  "AND o.deposit_ars=o.amount_ars "+
  "AND EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id AND p.state='verified') "+
  "AND (COALESCE(s.state,'pendiente')='en_preparacion' OR "+
  "(COALESCE(s.state,'pendiente')='pendiente' AND "+
  "(o.paid_at<? OR (o.paid_at=? AND o.id<?)))) "+
  "ORDER BY CASE WHEN COALESCE(s.state,'pendiente')='en_preparacion' THEN 0 ELSE 1 END,"+
  "o.paid_at ASC,o.id ASC LIMIT 501"
 ).bind(order.id,order.paid_at,order.paid_at,order.id).all();
 const rows=result.results||[];
 return etaResourceQueueDecision(order.manifest_json,rows.slice(0,500),settings,rows.length>500);
}

async function trackingMac(env,id){
 if(!CENTRAL_UUID.test(id)||typeof env.CENTRAL_BRIDGE_KEY!=="string"||
    env.CENTRAL_BRIDGE_KEY.length<32||env.CENTRAL_BRIDGE_KEY===env.DEMO_ADMIN_KEY)return null;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode("saber-tracking-client-v1\n"+id.toLowerCase())));
 return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
async function trackingUrl(env,id,requestUrl){
 const mac=await trackingMac(env,id);if(!mac)return null;
 const out=new URL("/seguimiento",requestUrl);
 out.searchParams.set("token",id.toLowerCase()+"."+mac);return out.href;
}
async function trackingCustomerStatus(req,env){
 if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY"||
   env.CENTRAL_PREPARE_ENABLED!=="PRIVATE_TEST_ONLY")return json({error:"Seguimiento no habilitado"},503);
 const token=new URL(req.url).searchParams.get("token")||"";
 const match=token.match(/^([a-f0-9-]{36})\.([a-f0-9]{64})$/);
 if(!match||!CENTRAL_UUID.test(match[1]))return json({error:"Enlace inválido"},404);
 const expected=await trackingMac(env,match[1]);
 if(!expected)return json({error:"Seguimiento no disponible"},503);
 let bad=0;for(let i=0;i<64;i++)bad|=expected.charCodeAt(i)^match[2].charCodeAt(i);
 if(bad!==0)return json({error:"Enlace inválido"},404);
 await centralTables(env);await ensurePaymentReviews(env);await centralProductionTables(env);
 const x=await env.DB.prepare("SELECT o.id,o.status,o.paid_at,o.deposit_ars,o.amount_ars,"+
  "n.number,m.manifest_json,COALESCE(s.state,'pendiente') AS stage,p.state AS review_state "+
  "FROM orders o JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
  "LEFT JOIN central_work_order_numbers n ON n.commercial_order_id=o.id "+
  "LEFT JOIN central_production_status s ON s.order_id=o.id "+
  "LEFT JOIN payment_reviews p ON p.order_id=o.id WHERE o.id=? LIMIT 1").bind(match[1]).first();
 if(!x){
  // Solo el pedido firmado que corresponda a un R2 prepago conciliado:
  // NO falsear un manifiesto TUS, prometer hora o iniciar impresión.
  const {consultarSeguimientoR2PrevioPreprensa}=await import("./r2-prepago-seguimiento-central.mjs");
  return await consultarSeguimientoR2PrevioPreprensa(env,match[1],{
   readEstimate:id=>preparationEstimateDetail(env,id),
   readPlan:async (paidAt,stage)=>deliveryPlanForCustomer(
    (await deliveryPlanSetting(env)).mode,paidAt,stage),
   formatNumber:shortWorkNumber
  });
 }
 const paid=x.status==="paid"&&Boolean(x.paid_at)&&x.deposit_ars===x.amount_ars&&x.review_state==="verified";
 const review=x.review_state==="revoked",stage=paid?x.stage:null;
 const phases={pendiente:"Pago confirmado",en_preparacion:"En preparación",en_espera:"En espera",
  listo:"Listo para retirar",entregado:"Entregado"};
 let estimate=null;
 if(paid&&!["listo","entregado"].includes(stage)){
  const manual=await preparationEstimateDetail(env,x.id);
  if(manual.ready_at)estimate={type:"manual",readyAt:manual.ready_at,provisional:true};
 }
 // Mostrar una franja general sólo al pedido pagado que todavía no se inició.
 // El operador asigna la hora individual cuando comienza la preparación.
 const deliveryPlan=paid&&["pendiente","en_preparacion"].includes(stage)&&!estimate?
  deliveryPlanForCustomer((await deliveryPlanSetting(env)).mode,x.paid_at,stage):null;
 return new Response(JSON.stringify({ok:true,orderNumber:shortWorkNumber(x.number),
  payment:review?"requiere_revision":paid?"pagado":"pendiente",stage,
  phase:review?"Pago en revisión":paid?phases[stage]||"Pago confirmado":"Esperando pago",
  estimate,deliveryPlan}),{headers:{"content-type":"application/json; charset=utf-8",
   "cache-control":"no-store, private","referrer-policy":"no-referrer",
   "x-robots-tag":"noindex,nofollow","x-content-type-options":"nosniff"}});
}

async function centralAdminDetail(env,id){
 await centralTables(env);
 const row=await env.DB.prepare("SELECT m.web_order_id,m.manifest_json,m.created_at,m.amount_ars,m.file_count,c.phone AS telefonoContacto,d.name AS nombreCliente,d.address AS direccionCliente FROM central_document_manifests m LEFT JOIN central_order_contacts c ON c.order_id=m.commercial_order_id LEFT JOIN central_order_customer_details d ON d.order_id=m.commercial_order_id WHERE m.commercial_order_id=?").bind(id).first();
 if(!row)return null;
 let document;
 try{document=JSON.parse(row.manifest_json)}catch(_){return null}
 const number=await env.DB.prepare("SELECT number FROM central_work_order_numbers WHERE commercial_order_id=?").bind(id).first();
 return {numeroOrden:shortWorkNumber(number?.number),webOrderId:row.web_order_id,totalDocumentos:row.amount_ars,telefonoContacto:row.telefonoContacto||null,
  nombreCliente:row.nombreCliente||null,direccionCliente:row.direccionCliente||null,
  fechaRecepcion:row.created_at,archivos:row.file_count,
  estado:"DOCUMENTOS_VERIFICADOS_PDF_FINAL_PENDIENTE",
  esTUS:/^WEB-ENSAYO-[A-F0-9]{32}$/.test(row.web_order_id),
  trabajos:document.trabajos,pdfFinalVerificado:false,listoParaProducir:false};
}

const clientTrackingHtml = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><meta name=\"referrer\" content=\"no-referrer\"><title>Mi pedido | Librería Saber</title><style>body{font:16px system-ui;color:#163d62;background:#f4f7fa;margin:0 auto;padding:clamp(12px,3vw,24px);max-width:560px;box-sizing:border-box}main{padding:22px;background:white;border-radius:12px}h1{font-size:1.4rem}li{padding:8px}li.active{color:#175ba4;font-weight:700}p{line-height:1.5}#eta{background:#edf5fc;padding:15px;border-radius:9px}</style></head><body><main><h1>Librería Saber · Mi pedido</h1><p id=\"order\">Consultando…</p><h2 id=\"stage\">Cargando estado…</h2><ol id=\"steps\"></ol><p id=\"eta\">Demora por confirmar.</p><p id=\"message\">Actualización automática cada 30 segundos.</p><small>Ensayo privado. El tiempo es orientativo y corresponde a preparación, no a envío a domicilio.</small></main><script>\nconst token=new URLSearchParams(location.search).get(\"token\")||\"\",el=id=>document.getElementById(id);\nconst labels=[\"Pedido recibido\",\"Pago confirmado\",\"En preparación\",\"Listo para retirar\",\"Entregado\"];\nfunction render(d){\n el(\"order\").textContent=d.orderNumber?\"Orden N.º \"+d.orderNumber:\"Orden en consulta\";\n el(\"stage\").textContent=d.phase||\"Sin estado\";\n const progress=d.payment!==\"pagado\"?0:({pendiente:1,en_preparacion:2,en_espera:2,listo:3,entregado:4})[d.stage]||1;\n el(\"steps\").replaceChildren();\n labels.forEach((txt,i)=>{const li=document.createElement(\"li\");li.textContent=txt;if(i===progress)li.className=\"active\";el(\"steps\").append(li)});\n if(d.payment!==\"pagado\"){el(\"eta\").textContent=\"Esperando pago verificado. La producción aún no comienza.\";return}\n if(d.stage===\"listo\"||d.stage===\"entregado\"){el(\"eta\").textContent=\"Pedido \"+(d.stage===\"listo\"?\"listo para retirar.\":\"entregado.\");return}\n if(d.stage===\"en_espera\"){el(\"eta\").textContent=\"Trabajo en espera. El plazo puede cambiar.\";return}\n const x=d.estimate;if(x?.type===\"manual\"){\n const fecha=new Intl.DateTimeFormat(\"es-AR\",{timeZone:\"America/Argentina/Cordoba\",day:\"2-digit\",month:\"2-digit\",hour:\"2-digit\",minute:\"2-digit\",hourCycle:\"h23\"}).format(new Date(x.readyAt));\n el(\"eta\").textContent=\"Preparación estimada: \"+fecha+\" hs (provisional).\";\n }else if(d.stage===\"en_preparacion\"){const planes={hoy:\"La previsión general es durante el día de hoy.\",hoy_tarde:\"La previsión general es hoy por la tarde.\",proximo_dia:\"La previsión general es el próximo día de atención.\",por_confirmar:\"La previsión general está en revisión.\"};\n el(\"eta\").textContent=\"Ya empezamos tu trabajo. \"+(planes[d.deliveryPlan]||planes.por_confirmar)+\" En breve verás una fecha y hora más precisas.\";}\n else if(d.stage===\"pendiente\"){\n  const planes={hoy:\"Prevemos que tu trabajo estará listo durante el día de hoy.\",hoy_tarde:\"Prevemos que estará listo hoy por la tarde.\",proximo_dia:\"Prevemos que estará listo el próximo día de atención.\",por_confirmar:\"Estamos organizando las entregas; pronto confirmaremos cuándo estará listo.\"};\n  el(\"eta\").textContent=(planes[d.deliveryPlan]||planes.por_confirmar)+\" Es orientativo. Seguí este pedido: cuando empecemos, indicaremos una hora estimada.\";\n }\n else el(\"eta\").textContent=\"Entrega a confirmar por la Central.\";\n}\nlet busy=false;async function update(){\n if(busy)return;busy=true;try{\n if(!/^[a-f0-9-]{36}\\.[a-f0-9]{64}$/.test(token))throw Error(\"Enlace incompleto\");\n const r=await fetch(\"/seguimiento/api/estado?token=\"+encodeURIComponent(token),{cache:\"no-store\"});\n const d=await r.json();if(!r.ok||d.ok!==true)throw Error(\"Enlace no válido\");\n render(d);el(\"message\").textContent=\"Última actualización: \"+new Date().toLocaleTimeString(\"es-AR\");\n }catch(e){el(\"stage\").textContent=\"Seguimiento no disponible\";el(\"message\").textContent=e.message}finally{busy=false}}\nvoid update();setInterval(()=>{if(!document.hidden)void update()},30000);\ndocument.addEventListener(\"visibilitychange\",()=>{if(!document.hidden)void update()});\n</script></body></html>";
const adminHtml = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Centro de Pedidos | Librería Saber · Pruebas</title>
<style>
*{box-sizing:border-box}body{font:15px system-ui,Arial,sans-serif;max-width:1450px;margin:20px auto;padding:16px;color:#17283d;background:#f6f8fb}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
h1{margin:0 0 6px;color:#163c73;font-size:1.55rem}.note{font-size:.87rem;color:#57677e}
fieldset{border:1px solid #d9e0ec;border-radius:12px;background:white;padding:16px;margin:16px 0}
input{font:inherit;padding:10px;max-width:100%;border:1px solid #aab6c5;border-radius:7px}
button{font:inherit;padding:10px 14px;background:#174b8f;color:white;border:0;border-radius:7px;cursor:pointer}
button:disabled{opacity:.5;cursor:default}.outline{color:#174b8f;background:white;border:1px solid #174b8f}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#details section{margin:14px 0;padding:13px;border:1px solid #d9e0ec;border-radius:10px;background:#f8fbff}#details section h4{margin:0 0 7px}#details section p{margin:6px 0}
#status{min-height:1.5em;font-weight:600}
.board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:14px}
.board-lane{border:1px solid #d2ddea;border-radius:12px;background:#f0f4f8;min-width:0;padding:10px}
.board-lane h3{font-size:1rem;margin:3px 0 12px;display:flex;align-items:center;justify-content:space-between;gap:6px}
.board-count{font-size:.84rem;border-radius:30px;padding:2px 9px;background:#fff;border:1px solid #dae3ee}
.board-cards{display:flex;flex-direction:column;gap:10px;min-height:65px}
.board-card{padding:13px;background:#fff;border:1px solid #d9e2ed;border-radius:10px;box-shadow:0 1px 3px #142a4514;overflow-wrap:anywhere}
.board-card h4{font-size:1rem;margin:0 0 5px;color:#153956}
.board-card p{font-size:.88rem;margin:7px 0;color:#415469}
.board-card .money{font-size:1rem;font-weight:700;color:#193d6a}
.board-card .actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
.board-card button{font-size:.88rem;padding:8px 10px}
.board-card .primary-next{flex:1 0 100%;font-weight:650}
.delivery-editor{margin-top:12px;padding:12px;border:1px solid #b9ccdf;border-radius:8px;background:#f7faff}
.delivery-editor[hidden]{display:none}
.delivery-editor label{display:block;margin:6px 0 4px;font-size:.9rem;font-weight:650}
.delivery-editor input{width:100%;max-width:370px;padding:10px;border:1px solid #a8b7c9;border-radius:6px;font:inherit}
.delivery-editor .delivery-feedback{font-weight:650;white-space:pre-wrap}
.delivery-editor .delivery-save{margin-top:10px}
.board-feedback{font-size:.87rem;font-weight:600;min-height:0;color:#93410b;white-space:pre-wrap;margin:7px 0 0}
.board-feedback:empty{display:none}
.transfer-feedback{color:#85510d;font-weight:650;white-space:pre-wrap;margin:8px 0}.transfer-feedback:empty{display:none}#bankTransfersArea li{padding:12px 6px}#bankTransfersArea label{display:block;margin:10px 0 5px;font-weight:650}#bankTransfersArea input{min-width:min(100%,330px)}#bankTransfersArea button{display:block;margin-top:9px}#bankTransfersArea strong{color:#174b8f}
.board-footer{margin-top:12px}
#details{overflow-wrap:anywhere}#details button{margin:4px 7px 4px 0}
@media(max-width:1150px){.board{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:630px){.board{grid-template-columns:1fr}.board-lane{padding:12px}.board-card .actions button{flex-grow:1}}
.unpaid-result:not([hidden]){margin:12px 0;padding:12px;background:#eff6ff;border:1px solid #bfd4ea;border-radius:10px}.unpaid-result h4{margin:6px 0}.unpaid-result section{margin:10px 0;padding:12px;border:1px solid #d0e0ef;border-radius:8px;background:white}.unpaid-result p{margin:7px 0}.print-specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:2px 12px;margin:10px 0;padding:10px;background:#f7faff;border-radius:7px}.print-specs p{margin:5px 0}.print-missing{color:#a14404;font-weight:600}.grid{display:grid;grid-template-columns:minmax(260px,1fr) minmax(280px,1.4fr);gap:16px}
ol{padding-left:22px}li{padding:12px 6px;border-bottom:1px solid #e5ebf3}li button{margin-top:7px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px ui-monospace,monospace;background:#f0f3f9;padding:12px;border-radius:6px;max-height:450px;overflow:auto}
@media(max-width:700px){.grid{grid-template-columns:1fr}}

.pricing-panel>summary{cursor:pointer;font-size:1.13rem;font-weight:750;color:#163c73;padding:4px}
.pricing-panel .price-note{background:#fff5dd;padding:10px 12px;border:1px solid #e1b96b;border-radius:8px;margin:12px 0;font-size:.9rem}
.price-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0}
.price-toolbar input[type="search"]{min-width:185px}
.price-toolbar select{padding:10px;border:1px solid #aab6c5;border-radius:7px;max-width:100%;font:inherit;background:white}
.price-line{display:grid;grid-template-columns:minmax(210px,1fr) 150px 150px;align-items:center;gap:10px;padding:10px 7px;border-bottom:1px solid #e2e7ed}
.price-line:nth-child(odd){background:#f7faff}
.price-line label{font-size:.9rem;font-weight:600}
.price-line small{color:#53657b;display:block}
.price-line input[type=number]{width:140px}
.price-line input[type=checkbox]{width:22px;height:22px;justify-self:center;accent-color:#174b8f}
.price-line .reference{font-size:.85rem;color:#59677b}
.price-line.modified{background:#eff9f2}
.price-head{font-size:.85rem;color:#53657b;font-weight:700}
#priceMessage{font-weight:650;white-space:pre-wrap}
#priceDiffs{margin:12px 0;max-height:190px;overflow:auto;border:1px solid #e2e7ed;border-radius:7px;padding:9px}
#pricePreviewResult{margin:10px 0;padding:12px;background:#f8fbff;border:1px solid #c7d9ee;border-radius:8px}
#pricePreviewResult p{margin:6px 0;font-size:.9rem}
#pricePreviewResult strong{font-weight:700}
@media(max-width:700px){.price-line{grid-template-columns:minmax(0,1fr) 108px}.price-line input[type=number]{width:100px}.price-line .reference{display:none}}

body.price-only{max-width:1080px}
body.price-only fieldset:not(#privateAccess):not(#priceAdminFieldset){display:none}
body.price-only #privateAccess #refresh,body.price-only #privateAccess #sync{display:none}
body.price-only #openPricing{display:none}
body.price-only #priceAdminFieldset{margin-top:9px}
body.price-only #priceAdminFieldset summary{font-size:1.3rem}
.eta-week{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:14px 0}.eta-week label{font-weight:600}.eta-week input{display:block;width:100%;margin-top:4px}#etaCalendarPanel{margin-top:14px}#etaCalendarPanel summary{cursor:pointer;font-weight:700;color:#174b8f}
</style></head><body>
<header><div><h1>Centro de Pedidos · Pruebas</h1><div class="note">Solo pagos completos aprobados · No está conectado al sitio público</div></div></header>
<fieldset id="privateAccess"><legend>Acceso privado</legend><div class="toolbar">
<input type="password" autocomplete="off" id="secret" placeholder="Clave privada del panel" aria-label="Clave privada">
<input type="text" id="productionOperator" maxlength="60" placeholder="Responsable del cambio" aria-label="Nombre de responsable" autocomplete="off">
<details id="centralExtraTools" style="flex:1 1 100%;margin-top:6px"><summary style="cursor:pointer;color:#174b8f;font-weight:700">Herramientas adicionales (normalmente no hacen falta)</summary>
<div class="toolbar" style="margin-top:10px"><button id="refresh" class="outline">Actualizar tablero manualmente</button><button type="button" id="goR2Paid" class="outline">Revisar ploteos R2</button><button id="sync" class="outline">Sincronizar Mercado Pago (solo incidencias)</button><button id="openPricing" class="outline" type="button">Editar precios y promociones</button>
<button id="mobileInviteCreate" class="outline" type="button">Acceso temporal al celular</button></div></details>
</div><p id="status" role="status" aria-live="polite"></p>
<div id="mobileInviteArea" hidden>
<p class="note">Enlace privado de un solo uso. Vence en 3 minutos. Copialo y abrilo en tu celular; no lo compartas con terceros.</p>
<div class="toolbar"><input id="mobileInviteLink" type="text" readonly autocomplete="off" aria-label="Enlace temporal de ingreso" style="flex:1;min-width:230px">
<button id="mobileInviteCopy" class="outline" type="button">Copiar enlace</button></div></div>
<p id="mobileInviteStatus" role="status" class="note" aria-live="polite"></p>
<p id="cronState" class="note">Conciliación automática: sin consultar.</p></fieldset>
<fieldset id="deliveryPlanPanel"><legend>Plazo general · visible antes del pago y en seguimiento</legend>
<p class="note">Elegí la previsión orientativa vigente según los trabajos y la capacidad. Se mostrará junto al presupuesto ANTES del pago y en el seguimiento del pedido pagado mientras no tenga hora propia, incluso al iniciar su preparación. No asegura una hora de retiro. Cambiarla actualiza las previsiones; no modifica pedidos listos. Una previsión de "hoy" deja de anunciarse después del cierre.</p>
<div class="toolbar"><label>Previsión general
<select id="deliveryPlanMode">
<option value="por_confirmar">Entrega a confirmar</option>
<option value="hoy">En el día de hoy</option>
<option value="hoy_tarde">Hoy por la tarde</option>
<option value="proximo_dia">Próximo día de atención</option>
</select></label>
<button id="deliveryPlanLoad" type="button" class="outline">Consultar previsión</button>
<button id="deliveryPlanSave" type="button" disabled>Guardar previsión</button></div>
<p id="deliveryPlanStatus" role="status" aria-live="polite" class="note">Consultá primero la previsión guardada.</p>
</fieldset>
<fieldset id="bankTransfersArea"><legend>Transferencias por verificar · <strong id="transferCount">0 pendientes</strong></legend><p class="note">Los pendientes se cargan solos y se actualizan cada 30 segundos. Comprobar el ingreso en el banco: un comprobante del cliente no acredita el pago. Operación limitada al ENSAYO privado.</p><p id="transferPanelStatus" class="transfer-feedback" role="status" aria-live="polite">Ingresá la clave privada para consultar las transferencias.</p><ol id="transferPending"></ol><section id="transferLiveArea" hidden><h4>Transferencias bancarias reales · verificá el banco antes de aprobar</h4><p id="transferLiveStatus" class="transfer-feedback" role="status" aria-live="polite"></p><ol id="transferLivePending"></ol></section><details><summary style="cursor:pointer;color:#174b8f">Actualización manual de transferencias</summary><button id="refreshTransfers" class="outline" type="button">Actualizar ahora</button></details></fieldset>
<fieldset id="productionBoardArea"><legend>Tablero de producción · pedidos pagos</legend>
<p class="note">Cada pedido avanza de columna al registrar su estado. Descargar el ZIP no cambia el seguimiento. Actualización automática cada 30 segundos mientras el panel esté abierto.</p>
<div class="board" id="productionBoard">
<section class="board-lane" aria-label="Pedidos nuevos pagados"><h3>Nuevos · pagos confirmados <span class="board-count" id="count-pendiente">0</span></h3><div class="board-cards" id="lane-pendiente"></div></section>
<section class="board-lane" aria-label="Trabajos en preparación"><h3>En preparación <span class="board-count" id="count-en_preparacion">0</span></h3><div class="board-cards" id="lane-en_preparacion"></div></section>
<section class="board-lane" aria-label="Trabajos listos"><h3>Listos para retirar <span class="board-count" id="count-listo">0</span></h3><div class="board-cards" id="lane-listo"></div></section>
<section class="board-lane" aria-label="Trabajos en espera"><h3>En espera <span class="board-count" id="count-en_espera">0</span></h3><div class="board-cards" id="lane-en_espera"></div></section>
</div>
<div class="board-footer">
<details><summary>Entregados · historial (<span id="count-entregado">0</span>)</summary><div class="board-cards" id="lane-entregado"></div></details>
<details><summary>Otros pedidos pagados (<span id="count-other">0</span>)</summary><div id="orders"></div></details>
</div></fieldset>
<details id="centralLegacyAdmin" style="margin:16px 0"><summary style="cursor:pointer;padding:13px 16px;background:#eef3f8;border:1px solid #d9e0ec;border-radius:9px;color:#174b8f;font-weight:700">Configuración avanzada de horarios, capacidad y estadísticas</summary>
<fieldset id="etaAdminArea"><legend>Información histórica de producción y horarios</legend>
<p class="note">La entrega que se comunica al cliente se elige únicamente en «Entrega general» y, al iniciar, en «Definir hora de entrega». Los tiempos anteriores de tres horas y cupos no se utilizan para prometer retiros.</p>
<details id="etaLegacyPanel"><summary>Configuración anterior de demora · no utilizada para entregar</summary>
<div class="toolbar">
<label>Demora habitual (horas) <input id="etaHours" type="number" step="0.5" min="0.5" max="24" value="3" style="width:90px"></label>
<label>Pedidos simultáneos <input id="etaCapacity" type="number" step="1" min="0" max="30" value="0" style="width:80px" title="0: sin cálculo adicional de cola"></label>
<button id="etaLoad" class="outline" type="button">Consultar demora</button>
<button id="etaSave" type="button" disabled>Guardar demora</button>
</div>
<p id="etaStatus" class="note" role="status" aria-live="polite">Configuración histórica para diagnóstico, sin efecto en la previsión del cliente.</p>
</details>
<details id="etaCalendarPanel"><summary>Horarios de atención, feriados y cierres</summary>
<p class="note">Horario confirmado para lunes a viernes: 07:00-13:30 y 16:30-20:00. Sábados y domingos: CERRADO (confirmado). Un día vacío se considera cerrado al guardar. Los feriados y cierres excepcionales se pueden agregar, modificar o borrar como fechas AAAA-MM-DD. Sin agenda guardada no se anuncia una hora calculada.</p>
<div class="eta-week">
<label>Lunes<input id="etaDayMon" placeholder="07:00-13:30,16:30-20:00" autocomplete="off"></label>
<label>Martes<input id="etaDayTue" placeholder="07:00-13:30,16:30-20:00" autocomplete="off"></label>
<label>Miércoles<input id="etaDayWed" placeholder="07:00-13:30,16:30-20:00" autocomplete="off"></label>
<label>Jueves<input id="etaDayThu" placeholder="07:00-13:30,16:30-20:00" autocomplete="off"></label>
<label>Viernes<input id="etaDayFri" placeholder="07:00-13:30,16:30-20:00" autocomplete="off"></label>
<label>Sábado<input id="etaDaySat" placeholder="Cerrado (confirmado)" autocomplete="off"></label>
<label>Domingo<input id="etaDaySun" placeholder="Cerrado (confirmado)" autocomplete="off"></label>
</div>
<label for="etaClosed">Feriados sin atención y cierres especiales (AAAA-MM-DD, una fecha por línea)</label>
<p class="note">La mayoría de los feriados no trabajan, pero algunos sí: cada fecha se decide manualmente. Agregá los feriados en que el local cerrará; si trabajan, borrá la fecha o no la agregues. Nada se cierra automáticamente por ser feriado. Podés editar la lista cuando cambie el calendario.</p>
<textarea id="etaClosed" rows="3" placeholder="2026-12-25" style="display:block;width:min(100%,400px);font:inherit;padding:10px"></textarea>
<div class="toolbar"><button id="etaCalendarLoad" class="outline" type="button">Consultar agenda</button><button id="etaCalendarWeekdayDraft" class="outline" type="button">Completar lunes a viernes (borrador)</button><button id="etaCalendarSave" type="button" disabled>Guardar agenda</button></div>
<p id="etaCalendarStatus" class="note" role="status" aria-live="polite">Agenda aún sin consultar.</p>
</details>

<details id="etaResourcesPanel"><summary>Carga y capacidad por recursos de trabajo</summary>
<p class="note">Los cupos representan <strong>trabajos que realmente pueden prepararse en paralelo</strong>, no cantidad nominal de máquinas. La impresión B/N tiene 1 equipo rápido confirmado; el número de equipos color sigue pendiente. Por ahora, el control de documentos es CONJUNTO: no ingresar 1 suponiendo que representa también las impresoras color. 0 = sin calibrar. Un cupo sin configurar no inventa duración.</p>
<div class="toolbar">
<label>Documentos simultáneos (cupo conjunto anterior) <input id="etaPrintParallel" type="number" min="0" max="30" step="1" value="0" style="width:75px"></label>
<label>Anillados simultáneos <input id="etaBindingParallel" type="number" min="0" max="30" step="1" value="0" style="width:75px"></label>
<label>Ploteos simultáneos <input id="etaPlotterParallel" type="number" min="0" max="30" step="1" value="0" style="width:75px"></label>
<button id="etaResourcesLoad" class="outline" type="button">Ver carga actual</button>
<button id="etaResourcesSave" type="button" disabled>Guardar capacidad</button>
</div>
<p id="etaResourcesStatus" class="note" role="status" aria-live="polite">Carga pendiente de consultar.</p>
<p id="etaResourcesLoadResult" class="note" aria-live="polite"></p>
</details>

<details id="etaSamplesPanel"><summary>Medir tiempos reales · impresiones, anillados y ploteos</summary>
<p class="note">Anotá una medición <strong>cuando el trabajo termine</strong>. Usá hojas físicas impresas (no páginas PDF), anillados terminados o centímetros realmente avanzados del rollo. Medí el tiempo transcurrido del trabajo; no incluyas esperas ajenas a ese recurso. Estos datos son internos y no cambian la ETA del cliente.</p>
<div class="toolbar">
<label>Recurso <select id="etaSampleType">
<option value="docs_bn">Impresión B/N · hojas</option>
<option value="docs_color">Impresión color · hojas</option>
<option value="anillados">Anillado · unidades</option>
<option value="cad">CAD · cm de rollo</option>
<option value="poster">Póster · cm de rollo</option>
</select></label>
<label>Cantidad real <input id="etaSampleQuantity" type="number" min="1" max="25000" step="1" placeholder="Cantidad" style="width:100px"></label>
<label>Duración medida (min) <input id="etaSampleMinutes" type="number" min="0.1" max="480" step="0.1" placeholder="Minutos" style="width:105px"></label>
<button id="etaSamplesLoad" class="outline" type="button">Ver mediciones</button>
<button id="etaSamplesSave" type="button">Registrar medición</button>
</div>
<p id="etaSamplesStatus" class="note" role="status" aria-live="polite">Todavía no se consultaron las mediciones.</p>
<div id="etaSamplesHistory" class="note" aria-live="polite"></div>
</details>
</fieldset>
</details>
<fieldset id="r2ReviewPanel"><legend>Ploteos grandes pagados · revisión de preprensa</legend><div class="toolbar"><button id="refreshR2Paid" class="outline">Consultar originales R2 pagados</button></div><p class="note">Pago acreditado y archivo recibido son etapas distintas. Las páginas, medidas y precio final deben verificarse antes de imprimir. Sin producción automática.</p><ol id="r2PaidReview"></ol></fieldset>
<fieldset id="liveRecepcionPanel"><legend>Recepción LIVE de documentos · solo lectura</legend>
<p class="note">Órdenes pagadas conciliadas con D1. Un R2 con SHA almacenado todavía requiere inspección del PDF. Este panel no habilita descarga, ZIP ni producción.</p>
<div class="toolbar"><button id="refreshLiveRecepcion" class="outline" type="button">Consultar recepción LIVE</button></div>
<p class="note" role="status" id="liveRecepcionStatus">Consulta manual pendiente.</p>
<ol id="liveRecepcionList"></ol></fieldset>
<fieldset id="priceAdminFieldset"><details id="pricingPanel" class="pricing-panel"><summary>Precios y promociones · administración privada</summary>
<p class="price-note">Ensayo: estos valores provienen de un tarifario histórico del 21/08/2026 y de los cupones existentes. Guardar o aprobar aquí NO cambia los precios de la web pública, los pagos ni el cotizador. Primero hay que validar los precios comerciales reales y conectar un único tarifario al motor.</p>
<div class="price-toolbar">
<button id="priceLoad" type="button">Cargar tarifas</button>
<label>Rubro <select id="priceGroup"><option value="B/N A4">B/N A4</option><option value="Color A4">Color A4</option><option value="B/N A3">B/N A3</option><option value="Color A3">Color A3</option><option value="Fotografías">Fotografías</option><option value="Stickers">Stickers</option><option value="Anillados">Anillados</option><option value="Ploteos">Ploteos</option><option value="Plotter de corte">Plotter de corte</option><option value="Cupones">Cupones</option><option value="Promos semanales">Promos semanales</option></select></label>
<label>Buscar <input type="search" id="priceSearch" placeholder="Papel, escala, producto o código"></label>
</div>
<p id="priceMessage" role="status" aria-live="polite">Pulsá «Cargar tarifas». La carga es solo de lectura.</p>
<div class="price-line price-head"><span>Servicio y escala</span><span>Valor</span><span>Referencia anterior</span></div>
<div id="priceItems"></div>
<div id="priceDiffs">Sin cambios pendientes.</div>
<div class="price-toolbar">
<button type="button" id="pricePreviewButton" class="outline" disabled>Ver impacto antes de guardar</button>
<button type="button" id="priceSave" disabled>Guardar borrador</button>
<button type="button" id="priceApprove" class="outline" disabled>Aprobar solo para ensayo</button>
</div>
<div id="pricePreviewResult" aria-live="polite">La vista previa compara los valores que editarías con los aprobados para ensayo. No cambia ningún cobro.</div>
<details><summary>Historial de versiones y restauración</summary><ol id="priceHistory"></ol></details>
</details></fieldset>
<fieldset><legend>Detalle de pedido e instrucciones</legend>
<div id="details">Elegí «Detalle» en un pedido para consultar las instrucciones, archivos e historial.</div></fieldset>
<fieldset><legend>Polaroids Express · PDF privado único</legend><button id="refreshExpress" class="outline">Consultar PDF recibidos</button><p class="note">Hasta cuatro hojas A4 por pedido. Archivo listo en Drive privado; el pago todavía no está confirmado.</p><ol id="expressReceipts"></ol></fieldset>

<fieldset><legend>Recepciones de PDF verificadas sin pedido comercial</legend><div class="toolbar"><button id="refreshReceipts" class="outline">Consultar recepciones pendientes</button></div><p class="note">Documentos confirmados en Drive, todavía no vinculados a un pedido cobrado. No están listos para imprimir.</p><ol id="verifiedReceipts"></ol></fieldset>

<fieldset><legend>Pedidos con PDF y pago pendiente</legend><button id="refreshUnpaid" class="outline">Consultar pedidos sin pago confirmado</button><ol id="unpaidDocs"></ol></fieldset>

<script>
const secret=document.querySelector("#secret"),status=document.querySelector("#status"),orders=document.querySelector("#orders"),details=document.querySelector("#details");
let deliveryPlanSnapshot=null;
const deliveryPlanMode=document.querySelector("#deliveryPlanMode");
const deliveryPlanSave=document.querySelector("#deliveryPlanSave");
const deliveryPlanInfo=document.querySelector("#deliveryPlanStatus");
async function loadDeliveryPlan(){
 try{
  const data=await api("/admin/api/central/delivery-plan");
  deliveryPlanSnapshot=data.settings;
  deliveryPlanMode.value=data.settings.mode;
  deliveryPlanSave.disabled=false;
  deliveryPlanInfo.textContent="Previsión vigente: "+deliveryPlanMode.selectedOptions[0].textContent+
   " · revisión "+data.settings.revision+". Sin horario garantizado.";
 }catch(e){deliveryPlanSnapshot=null;deliveryPlanSave.disabled=true;
  deliveryPlanInfo.textContent="No se pudo consultar: "+String(e.message||e)}
}
document.querySelector("#deliveryPlanLoad").addEventListener("click",loadDeliveryPlan);
deliveryPlanSave.addEventListener("click",async()=>{
 if(!deliveryPlanSnapshot)return;
 const operator=requestOperator();
 if(!operator){deliveryPlanInfo.textContent="Indicá un responsable.";return}
 if(deliveryPlanMode.value===deliveryPlanSnapshot.mode){
  deliveryPlanInfo.textContent="La previsión no cambió.";return;
 }
 if(!confirm("¿Actualizar la previsión general? Cambiará el mensaje de los pedidos pagos que aún estén pendientes y no tengan hora individual."))return;
 deliveryPlanSave.disabled=true;
 try{
  await apiPost("/admin/api/central/delivery-plan",{mode:deliveryPlanMode.value,
   expectedRevision:deliveryPlanSnapshot.revision,operator,confirmed:true});
  await loadDeliveryPlan();await refresh({silent:true,force:true});
 }catch(e){deliveryPlanInfo.textContent="No se pudo guardar: "+String(e.message||e);
  deliveryPlanSave.disabled=false}
});

let etaAdminSnapshot=null;
const etaInfo=document.querySelector("#etaStatus");
const etaHours=document.querySelector("#etaHours"),etaCapacity=document.querySelector("#etaCapacity");
const etaSave=document.querySelector("#etaSave");
async function loadEtaAdmin(){
 try{
  const data=await api("/admin/api/central/eta-settings");
  etaAdminSnapshot=data.settings;
  etaHours.value=String(data.settings.base_minutes/60);
  etaCapacity.value=String(data.settings.parallel_orders);
  etaSave.disabled=false;
  etaInfo.textContent="Demora habitual: "+etaHours.value+" h · "+data.activePaidOrders+
   " pedido(s) pagados en cola · "+
   (data.settings.parallel_orders>0?"Se consideran "+data.settings.parallel_orders+" pedidos simultáneos":
   "Ajuste de cola pendiente de configurar.");
 }catch(e){etaAdminSnapshot=null;etaSave.disabled=true;etaInfo.textContent="No se pudo consultar la demora: "+String(e.message||e)}
}
document.querySelector("#etaLoad").addEventListener("click",loadEtaAdmin);
etaSave.addEventListener("click",async()=>{
 if(!etaAdminSnapshot)return;
 const operator=requestOperator();
 if(!operator){etaInfo.textContent="Indicá el responsable del cambio.";return}
 const hours=Number(etaHours.value),capacity=Number(etaCapacity.value);
 if(!Number.isFinite(hours)||hours<0.5||hours>24||
    !Number.isSafeInteger(hours*60)||!Number.isSafeInteger(capacity)||capacity<0||capacity>30){
  etaInfo.textContent="Elegí horas válidas y entre 0 y 30 pedidos simultáneos.";return;
 }
 if(!confirm("¿Guardar configuración histórica para diagnóstico? No afecta el mensaje ni la hora de entrega del cliente."))return;
 etaSave.disabled=true;
 try{
  await apiPost("/admin/api/central/eta-settings",{
   baseMinutes:hours*60,parallelOrders:capacity,
   expectedRevision:etaAdminSnapshot.revision,operator,confirmed:true
  });
  await loadEtaAdmin();await refresh({silent:true,force:true});
 }catch(e){etaInfo.textContent=String(e.message||e);etaSave.disabled=false}
});
let etaCalendarSnapshot=null;
const etaCalendarDays=["mon","tue","wed","thu","fri","sat","sun"];
const etaCalendarFields=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const etaCalendarInfo=document.querySelector("#etaCalendarStatus");
const etaCalendarSave=document.querySelector("#etaCalendarSave");
async function loadEtaCalendar(){
 try{
  const r=await api("/admin/api/central/eta-calendar");
  etaCalendarSnapshot=r.calendar;
  etaCalendarDays.forEach((day,i)=>{
   document.querySelector("#etaDay"+etaCalendarFields[i]).value=r.calendar.weekly[day]||"";
  });
  document.querySelector("#etaClosed").value=r.calendar.closedDates.join("\\n");
  etaCalendarSave.disabled=false;
  etaCalendarInfo.textContent=r.calendar.configured?
   "Agenda cargada · revisión "+r.calendar.revision+" · zona Córdoba.":
   "Sin horarios configurados. No se anuncia fecha de retiro automática.";
 }catch(e){etaCalendarSnapshot=null;etaCalendarSave.disabled=true;etaCalendarInfo.textContent="No se pudo consultar agenda: "+String(e.message||e)}
}
document.querySelector("#etaCalendarLoad").addEventListener("click",loadEtaCalendar);
document.querySelector("#etaCalendarWeekdayDraft").addEventListener("click",()=>{
 if(!etaCalendarSnapshot){etaCalendarInfo.textContent="Primero consultá la agenda guardada.";return}
 if(!confirm("¿Completar el horario confirmado de lunes a viernes 07:00-13:30 y 16:30-20:00 y marcar sábados y domingos cerrados? Solo prepara un borrador: no guarda nada todavía."))return;
 for(const day of ["Mon","Tue","Wed","Thu","Fri"])
  document.querySelector("#etaDay"+day).value="07:00-13:30,16:30-20:00";
 document.querySelector("#etaDaySat").value="";
 document.querySelector("#etaDaySun").value="";
 etaCalendarInfo.textContent="Borrador sin guardar: lunes a viernes y fin de semana cerrado. Revisá feriados y guardá con responsable.";
});
etaCalendarSave.addEventListener("click",async()=>{
 if(!etaCalendarSnapshot)return;
 const operator=requestOperator();
 if(!operator){etaCalendarInfo.textContent="Indicá el responsable del cambio.";return}
 const weekly={};
 etaCalendarDays.forEach((day,i)=>weekly[day]=document.querySelector("#etaDay"+etaCalendarFields[i]).value.trim());
 const closedDates=document.querySelector("#etaClosed").value.split(/[\\n,;]/).map(x=>x.trim()).filter(Boolean);
 if(closedDates.some(d=>!/^\\d{4}-\\d\\d-\\d\\d$/.test(d))){
  etaCalendarInfo.textContent="Revisá las fechas: AAAA-MM-DD, una por línea.";return;
 }
 if((weekly.sat||weekly.sun)&&!confirm("El horario informado es sábados y domingos CERRADO. ¿Confirmás que querés abrir alguno de esos días en esta agenda?"))return;
 if(!confirm("¿Guardar estos horarios y cierres para el piloto privado? Los feriados se podrán editar después."))return;
 etaCalendarSave.disabled=true;
 try{
  await apiPost("/admin/api/central/eta-calendar",{weekly,closedDates,
   expectedRevision:etaCalendarSnapshot.revision,operator,confirmed:true});
  await loadEtaCalendar();await refresh({silent:true,force:true});
 }catch(e){etaCalendarInfo.textContent=String(e.message||e);etaCalendarSave.disabled=false}
});

const mobileInviteCreate=document.querySelector("#mobileInviteCreate");
const mobileInviteCopy=document.querySelector("#mobileInviteCopy");
const mobileInviteArea=document.querySelector("#mobileInviteArea");
const mobileInviteLink=document.querySelector("#mobileInviteLink");
const mobileInviteStatus=document.querySelector("#mobileInviteStatus");
mobileInviteCreate.addEventListener("click",async()=>{
 const operator=requestOperator();
 if(!operator){mobileInviteStatus.textContent="Indicá el responsable.";return}
 if(!secret.value.trim()){mobileInviteStatus.textContent="Ingresá la clave de la Central.";return}
 if(!confirm("¿Generar un enlace de ingreso al cotizador de pruebas? Dura tres minutos y se utiliza una sola vez."))return;
 mobileInviteArea.hidden=true;mobileInviteLink.value="";mobileInviteCreate.disabled=true;
 mobileInviteStatus.textContent="Generando acceso temporal…";
 try{
  const result=await apiPost("/admin/api/central/mobile-invite",{operator,confirmed:true});
  if(result.ok!==true||typeof result.url!=="string")throw Error("No se pudo generar el acceso.");
  mobileInviteLink.value=result.url;mobileInviteArea.hidden=false;
  mobileInviteStatus.textContent="Enlace listo. Abrilo desde el celular antes de 3 minutos.";
 }catch(e){mobileInviteStatus.textContent=e.message||"Acceso no disponible"}
 finally{mobileInviteCreate.disabled=false}
});
mobileInviteCopy.addEventListener("click",async()=>{
 if(!mobileInviteLink.value)return;
 try{await navigator.clipboard.writeText(mobileInviteLink.value);
  mobileInviteStatus.textContent="Enlace copiado. Pegalo en tu celular.";
 }catch{mobileInviteLink.select();mobileInviteStatus.textContent="Seleccioná y copiá el enlace."; }
});

let etaResourcesSnapshot=null;
const etaResourceStatus=document.querySelector("#etaResourcesStatus");
const etaResourcesSave=document.querySelector("#etaResourcesSave");
const etaResourceInputs={
 printParallel:document.querySelector("#etaPrintParallel"),
 bindingParallel:document.querySelector("#etaBindingParallel"),
 plotterParallel:document.querySelector("#etaPlotterParallel")
};
async function loadEtaResources(){
 try{
  const data=await api("/admin/api/central/resource-capacity");
  etaResourcesSnapshot=data.settings;
  etaResourceInputs.printParallel.value=data.settings.print_parallel;
  etaResourceInputs.bindingParallel.value=data.settings.binding_parallel;
  etaResourceInputs.plotterParallel.value=data.settings.plotter_parallel;
  etaResourcesSave.disabled=false;
  const d=data.load;
  document.querySelector("#etaResourcesLoadResult").textContent=
   "Pedidos activos verificados: "+d.paidActive+" · con documentos: "+d.documents+
   " (B/N: "+d.bn+", color: "+d.color+", modo sin especificar: "+d.unknownPrint+")"+
   " · con anillado: "+d.binding+" · con CAD: "+d.cad+" · con póster: "+d.poster+
   " · requieren revisión de ficha: "+d.review+(d.partial?" · listado parcial (más de 500)":"")+".";
  etaResourceStatus.textContent="Configuración de recursos · revisión "+data.settings.revision+".";
 }catch(e){etaResourcesSnapshot=null;etaResourcesSave.disabled=true;
  etaResourceStatus.textContent="No se pudo cargar recursos: "+(e.message||e)}
}
document.querySelector("#etaResourcesLoad").addEventListener("click",loadEtaResources);
etaResourcesSave.addEventListener("click",async()=>{
 if(!etaResourcesSnapshot)return;
 const operator=requestOperator();
 if(!operator){etaResourceStatus.textContent="Indicá el responsable.";return}
 const values=Object.fromEntries(Object.entries(etaResourceInputs).map(([key,el])=>[key,Number(el.value)]));
 if(Object.values(values).some(n=>!Number.isSafeInteger(n)||n<0||n>30)){
  etaResourceStatus.textContent="La capacidad simultánea debe ser de 0 a 30.";return;
 }
 if(!confirm("¿Guardar cupos por recurso en el piloto? Estos valores afectan si se puede mostrar una ETA automática, pero no calculan minutos de producción."))return;
 etaResourcesSave.disabled=true;
 try{
  await apiPost("/admin/api/central/resource-capacity",{...values,
   expectedRevision:etaResourcesSnapshot.revision,operator,confirmed:true});
  await loadEtaResources();
 }catch(e){etaResourceStatus.textContent=e.message||"No se pudo guardar.";etaResourcesSave.disabled=false}
});

const etaSamplesStatus=document.querySelector("#etaSamplesStatus");
const etaSamplesHistory=document.querySelector("#etaSamplesHistory");
const sampleLabels={docs_bn:"B/N · hojas",docs_color:"Color · hojas",
 anillados:"Anillados · unidades",cad:"CAD · cm",poster:"Póster · cm"};
async function loadEtaSamples(){
 try{
  const data=await api("/admin/api/central/productivity-samples");
  etaSamplesHistory.replaceChildren();
  const samples=data.samples||[];
  if(!samples.length)etaSamplesHistory.textContent="Sin mediciones reales registradas.";
  else{
   const list=document.createElement("ol");
   for(const x of samples.slice(0,20)){
    const item=document.createElement("li");
    item.textContent=(sampleLabels[x.resource]||x.resource)+": "+x.quantity+
     " en "+(x.duration_seconds/60).toLocaleString("es-AR",{maximumFractionDigits:2})+
     " min · "+x.created_at;
    list.append(item);
   }
   etaSamplesHistory.append(list);
  }
  etaSamplesStatus.textContent=samples.length+" mediciones recientes (máximo 40 consultadas). Sin ETA automática basada en mediciones.";
 }catch(e){etaSamplesStatus.textContent="No se pudieron leer mediciones: "+(e.message||e)}
}
document.querySelector("#etaSamplesLoad").addEventListener("click",loadEtaSamples);
document.querySelector("#etaSamplesSave").addEventListener("click",async()=>{
 const operator=requestOperator();
 if(!operator){etaSamplesStatus.textContent="Indicá el responsable.";return}
 const quantity=Number(document.querySelector("#etaSampleQuantity").value);
 const minutes=Number(document.querySelector("#etaSampleMinutes").value);
 const durationSeconds=Math.round(minutes*60);
 const resource=document.querySelector("#etaSampleType").value;
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>25000||
    !Number.isFinite(minutes)||minutes<=0||!Number.isSafeInteger(durationSeconds)||
    durationSeconds<1||durationSeconds>28800){
  etaSamplesStatus.textContent="Ingresá una cantidad real y una duración medida entre 1 segundo y 8 horas.";return;
 }
 if(!confirm("¿Registrar esta medición realizada, no estimada? No cambiará los plazos del cliente."))return;
 const btn=document.querySelector("#etaSamplesSave");btn.disabled=true;
 try{
  await apiPost("/admin/api/central/productivity-samples",{
   resource,quantity,durationSeconds,operator,confirmed:true
  });
  etaSamplesStatus.textContent="Medición registrada.";
  document.querySelector("#etaSampleQuantity").value="";
  document.querySelector("#etaSampleMinutes").value="";
  await loadEtaSamples();
 }catch(e){etaSamplesStatus.textContent=e.message||"No se pudo registrar."}
 finally{btn.disabled=false}
});
function money(n){return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n)||0)}
async function apiPost(path,data){
 const r=await fetch(path,{method:"POST",headers:{"Authorization":"Bearer "+secret.value,
  "Content-Type":"application/json"},body:JSON.stringify(data),cache:"no-store"});
 const x=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(r.status===401?"Clave incorrecta":x.error||"Error "+r.status);
 return x;
}
async function api(path,method="GET"){const r=await fetch(path,{method,headers:{"Authorization":"Bearer "+secret.value},cache:"no-store"});const x=await r.json().catch(()=>({}));if(!r.ok)throw Error(r.status===401?"Clave incorrecta":x.error||"Error "+r.status);return x}
function node(tag,txt){const x=document.createElement(tag);x.textContent=String(txt);return x}
function productionLabel(x){return ({
 pendiente:"Pendiente",en_preparacion:"En preparación",en_espera:"En espera",
 listo:"Listo para retirar",entregado:"Entregado"
 })[x]||"Sin estado"}
function renderProductionTracking(orderId,track){
 const area=node("section","");
 area.append(node("h4","Seguimiento · "+productionLabel(track.state)));
 area.append(node("p","Último cambio: "+(track.updated_at||"sin movimientos")+
  (track.operator?" · Responsable indicado: "+track.operator:"")));
 const actions={
  en_preparacion:"Empezar preparación",en_espera:"Poner en espera",
  listo:"Marcar listo para retirar",entregado:"Marcar entregado"
 };
 for(const next of track.allowed||[]){
  const btn=node("button",actions[next]||productionLabel(next));
  btn.type="button";if(next==="en_espera")btn.className="outline";
  btn.addEventListener("click",async()=>{
   const person=requestOperator();
   if(!person){const msg="Indicá el responsable para cambiar el estado.";area.append(node("p",msg));status.textContent=msg;return}
   let reason="",confirmed=false;
   if(next==="en_espera"){
    reason=prompt("Motivo del problema o espera (obligatorio):")||"";
    if(reason.trim().length<5){status.textContent="Se necesita un motivo de espera de al menos 5 caracteres.";return}
   }
   if(next==="listo"||next==="entregado"){
    confirmed=confirm(next==="listo"?
     "¿Comprobaste que todo el trabajo está terminado y listo para retirar?":
     "¿Confirmás que el pedido fue entregado al cliente?");
    if(!confirmed)return;
   }
   btn.disabled=true;
   try{
    await apiPost("/admin/api/central/production-status",{
     order_id:orderId,from:track.state,to:next,version:track.version,
     operator:person,reason,confirmed
    });
    await refresh();
    await showOrder(orderId);
   }catch(e){status.textContent="No se pudo cambiar el estado: "+String(e.message||e)}
   finally{btn.disabled=false}
  });
  area.append(btn);
 }
 if(track.state==="entregado")area.append(node("p","Pedido entregado. Archivos sin servicio de reimpresión. La limpieza automática de PDF se habilitará después de completar la verificación de seguridad."));
 if(track.history?.length){
  const log=node("details","");
  const summary=node("summary","Ver historial de movimientos");
  log.append(summary);
  for(const event of track.history){
   log.append(node("p",(event.created_at||"Sin fecha")+" · "+
    productionLabel(event.from_state)+" → "+productionLabel(event.to_state)+
    " · "+event.operator+(event.reason?" · "+event.reason:"")));
  }
  area.append(log);
 }
 details.append(area);
}

function preparationTimeLocal(utc){
 const date=new Date(utc);
 if(!Number.isFinite(date.getTime()))return "fecha inválida";
 return new Intl.DateTimeFormat("es-AR",{timeZone:"America/Argentina/Cordoba",
  day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date)+" hs";
}
function renderPreparationEstimate(orderId,track,estimate){
 const area=node("section","");
 area.append(node("h4","Hora estimada para el cliente · Córdoba"));
 area.append(node("p",estimate.ready_at?
  "Horario provisional: "+preparationTimeLocal(estimate.ready_at):
  "Cuando comiences a preparar esta orden, indicá aquí la hora de retiro que considerás viable. El seguimiento se actualizará automáticamente."));
 if(estimate.operator)area.append(node("p","Último responsable: "+estimate.operator+
  " · "+(estimate.updated_at||"sin fecha")+
  (estimate.reason?" · Motivo: "+estimate.reason:"")));
 if(["listo","entregado"].includes(track.state)){
  area.append(node("p","Pedido terminado: no se pueden establecer nuevos plazos."));
  details.append(area);return;
 }
 const row=node("div",""),input=node("input",""),reason=node("input",""),
  save=node("button","Guardar estimación");
 row.className="toolbar";
 input.type="datetime-local";input.step="60";
 input.setAttribute("aria-label","Fecha y hora estimada de preparación, hora de Córdoba");
 if(estimate.ready_at){
  const milliseconds=Date.parse(estimate.ready_at)-3*60*60*1000;
  input.value=new Date(milliseconds).toISOString().slice(0,16);
 }
 reason.type="text";reason.maxLength=240;
 reason.placeholder="Motivo si postergás o retirás el plazo";
 reason.setAttribute("aria-label","Motivo del cambio de fecha estimada");
 save.type="button";
 row.append(input,reason,save);
 area.append(row);
 area.append(node("p","El plazo es provisional. Para quitarlo, borrá la fecha y guardá con un motivo. Solo se informa al cliente tras pago verificado."));
 const feedback=node("p","");
 feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 area.append(feedback);
 save.addEventListener("click",async()=>{
  const operator=requestOperator();
  if(!operator){feedback.textContent="Indicá el responsable en el encabezado.";return}
  let ready_at=null;
  if(input.value){
   const when=new Date(input.value+":00-03:00");
   if(!Number.isFinite(when.getTime())){
    feedback.textContent="Fecha u hora inválida.";return;
   }
   ready_at=when.toISOString();
  }
  if(ready_at===estimate.ready_at){
   feedback.textContent="La fecha no cambió.";return;
  }
  if(!estimate.ready_at&&!ready_at){
   feedback.textContent="Indicá una fecha para comenzar.";return;
  }
  const why=reason.value.trim();
  if(estimate.ready_at&&(ready_at===null||
     Date.parse(ready_at)>Date.parse(estimate.ready_at))&&why.length<5){
   feedback.textContent="Indicá el motivo de la postergación (mínimo 5 caracteres).";return;
  }
  if(!confirm(ready_at?"¿Guardar fecha provisional de preparación para el cliente?":
   "¿Retirar la estimación anterior y avisar que está pendiente?"))return;
  save.disabled=true;feedback.textContent="Guardando horario…";
  try{
   await apiPost("/admin/api/central/preparation-estimate",{
    order_id:orderId,expected_version:estimate.version,ready_at,
    operator,reason:why,confirmed:true});
   await refresh({silent:true,force:true});
   await showOrder(orderId);
  }catch(e){feedback.textContent="No se pudo guardar: "+String(e.message||e)}
  finally{save.disabled=false}
 });
 details.append(area);
}

async function showOrder(id){try{status.textContent="Consultando detalle...";const x=await api("/admin/api/order?id="+encodeURIComponent(id));details.replaceChildren();details.append(node("h3","Pedido "+x.order.id));details.append(node("p","Total: "+money(x.order.amount_ars)+" · Aprobado: "+(x.order.paid_at||"sin fecha")));if(x.bankAccreditation){
 details.append(node("p","Acreditación bancaria verificada por "+x.bankAccreditation.operator+
  " · "+x.bankAccreditation.recorded_at+" · Ref.: "+x.bankAccreditation.bank_reference));
}if(x.produccion?.r2Preprensa){
 const d=x.produccion.r2Preprensa;
 details.append(node("h4","Ploteo grande R2 · preprensa aprobada por "+d.responsable));
 details.append(node("p","Recibo "+d.recibo+" · "+
  d.medidas.map((v,i)=>"#"+(i+1)+" "+v[0]+"×"+v[1]+" cm").join("; ")));
 details.append(node("p","Importe verificado: "+money(d.importe)+
  " · Original privado disponible para preparación. NO enviar el PDF pesado directamente al plotter."));
 const zipR2=node("button","Abrir ZIP R2 original + instrucciones");
 zipR2.addEventListener("click",()=>{
  const url=new URL("https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/r2-preprensa-personal");
  url.searchParams.set("webOrderId",d.webOrderId);
  url.searchParams.set("receiptId",d.recibo);
  const link=document.createElement("a");
  link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
  document.body.append(link);link.click();link.remove();
 });
 details.append(zipR2);
}if(x.produccion?.seguimiento)renderProductionTracking(id,x.produccion.seguimiento);if(x.produccion?.seguimiento&&x.produccion?.preparacionEstimada)renderPreparationEstimate(id,x.produccion.seguimiento,x.produccion.preparacionEstimada);if(x.produccion){const pr=x.produccion;details.append(node("h4","Estado operativo: "+pr.estado.replaceAll("_"," ")));details.append(node("p",pr.mensaje));for(const t of pr.trabajos){const area=node("section","");area.append(node("h4",t.linea+". "+t.cantidad+" × "+t.descripcion+" — "+money(t.subtotal)));area.append(node("p","Estado: "+t.etapa.replaceAll("_"," ")+" · "+t.instruccion));const valores=Object.entries(t.especificaciones||{}).map(a=>a[0]+": "+a[1]).join(" · ");if(valores)area.append(node("p","Ficha técnica: "+valores));if(t.referencias?.length)area.append(node("p","Referencias privadas: "+t.referencias.join(", ")));details.append(area)}}else details.append(node("p","La ficha de producción no está disponible."));if(x.produccion?.documentosVerificados){
 const d=x.produccion.documentosVerificados;
 details.append(node("h4",(d.numeroOrden?"Orden de trabajo N.º "+d.numeroOrden+" · ":"")+
  "PDF originales verificados · "+d.archivos+" archivo(s)"));
 details.append(node("p","Nombre del cliente: "+(d.nombreCliente||"No informado")));
 details.append(node("p","Teléfono de contacto: "+(d.telefonoContacto||"No informado")));
 details.append(node("p","Dirección: "+(d.direccionCliente||"No informada · retiro en local")));
 details.append(node("p","PAGO VERIFICADO · "+money(d.totalDocumentos)+
  " · Preparación de archivos pendiente. Los originales no están impuestos ni listos para imprimir automáticamente."));
 if(!Array.isArray(d.trabajos)||d.trabajos.length!==d.archivos){
  details.append(node("p","ALERTA: la cantidad de PDF no coincide con la recepción verificada; revisar antes de producir."));
 }else{
  if(d.esTUS&&/^WEB-ENSAYO-[A-F0-9]{32}$/.test(d.webOrderId||"")&&d.numeroOrden){
   const pack=node("button","Descargar ZIP + orden de trabajo PDF");
   pack.type="button";
   pack.addEventListener("click",()=>{
    const url=new URL("https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/orden-paquete");
    url.searchParams.set("webOrderId",d.webOrderId);
    const link=document.createElement("a");
    link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
    document.body.append(link);link.click();link.remove();
   });
   details.append(pack);
   details.append(node("p","ZIP: PDF originales numerados + orden de trabajo A4 en PDF. Armado privado; verificar en Adobe antes de imprimir."));
  }
  for(const t of d.trabajos){
   const line=node("section","");
   line.append(node("h4",t.orden+". "+t.nombreOriginal+" · "+t.servicio));
   line.append(node("p","Original verificado · "+t.paginasOriginales+" página(s) · "+
    (Array.isArray(t.paginasElegidas)?t.paginasElegidas.length:0)+" seleccionadas · "+
    t.copias+" copia(s)/lote(s)"));
   agregarFichaDeImpresion(line,t,{pagado:true,trabajos:d.documentos.trabajos});
   if(d.esTUS&&/^WEB-ENSAYO-[A-F0-9]{32}$/.test(d.webOrderId||"")&&
      /^DOC-[a-f0-9-]{36}$/i.test(t.reciboPrivado||"")){
    const action=node("button","Descargar PDF original verificado");
    action.type="button";
    action.addEventListener("click",()=>{
     const url=new URL("https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/personal-descargar");
     url.searchParams.set("webOrderId",d.webOrderId);
     url.searchParams.set("receiptId",t.reciboPrivado);
     const link=document.createElement("a");
     link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
     document.body.append(link);link.click();link.remove();
    });
    line.append(action);
   }else line.append(node("p","Descarga de PDF original: referencia privada no disponible para esta recepción."));
   line.append(node("p","PDF final / imposición: PENDIENTE · Verificar en Adobe Acrobat antes de imprimir."));
   details.append(line);
  }
 }
}

if(x.produccion?.polaroidsExpress){
 const d=x.produccion.polaroidsExpress;
 details.append(node("h4","Polaroids Express · PDF único verificado"));
 details.append(node("p",d.referencia+" · "+d.fotos+" fotos · "+d.paginasA4+
  " hoja(s) A4 · "+money(d.totalPolaroids)+" · "+(d.pagoConfirmado?
   "Pago verificado":"Falta confirmar el pago")));
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
}status.textContent="";details.scrollIntoView?.({behavior:"smooth",block:"start"})}catch(e){status.textContent=e.message}}
function agregarFichaDeImpresion(area,t,{pagado=false,trabajos=[]}={}){
 // La ficha proviene del manifiesto privado de D1, NUNCA de parámetros URL
 // ni del PDF original. Los datos ausentes se señalan: no inventar instrucciones.
 const modo=(t.modo==="bn"||t.modo==="b/n")?"Blanco y negro":
  t.modo==="color"?"Color":null;
 const medidas=t.formatoFinal==="personalizado_a4"&&Array.isArray(t.medidasOriginalesCm)
  ?t.medidasOriginalesCm.map(x=>({
   pagina:x.pagina,valor:Number(x.anchoCm.toFixed(2))+" × "+Number(x.altoCm.toFixed(2))+" cm"
  })):null;
 const medidasUnicas=medidas?[...new Set(medidas.map(x=>x.valor))]:[];
 const formato=t.formatoFinal==="personalizado_a4"&&medidasUnicas.length
  ?"Original: "+(medidasUnicas.length===1?medidasUnicas[0]:
   medidasUnicas.length+" tamaños distintos (ver detalle por página)")
  :(["a5","a4","a3"].includes(t.formatoFinal)?t.formatoFinal.toUpperCase():null);
 const caras=t.carasPresupuestadas==="simple"?"Simple faz":
  t.carasPresupuestadas==="double"?"Doble faz":null;
 const anillado=t.tipoAnillado==="ninguno"?"Sin anillado":
  t.tipoAnillado==="individual"?"Anillado individual":
  t.tipoAnillado==="grupo"?"Anillado junto a otros archivos (verificar agrupación)":null;
 const papel={
  estandar:"Papel estándar B/N (gramaje sin especificar)",
  obra70:"Papel obra 70 g",obra80:"Papel obra 80 g",recubierto:"Papel recubierto",
  fotografico:"Papel fotográfico"
 }[t.material]||t.material||null;
 const paginas=Array.isArray(t.paginasElegidas)?t.paginasElegidas:[];
 const todas=paginas.length===t.paginasOriginales&&
  paginas.every((v,i)=>v===i+1);
 const seleccion=todas?"Todas ("+t.paginasOriginales+")":
  paginas.length?paginas.join(", "):null;
 const descripcion=t.descripcion||null;
 const opciones=[
  ["Servicio",t.servicio==="documentos"?"Impresión de documentos":
    t.servicio==="ploteos"?"Ploteo":t.servicio||null],
  ["Páginas del archivo",Number.isSafeInteger(t.paginasOriginales)?String(t.paginasOriginales):null],
  ["Páginas a imprimir",seleccion],
  ["Tamaño final",formato],
  ["Tarifa aplicada",t.formatoFinal==="personalizado_a4"?
   "Tarifa A4 vigente (original sin ampliar)":t.formatoFinal==="a5"?
   "Tarifa A4 vigente (A5 sin ampliar)":formato?"Tarifa "+formato:null],
  ["Impresión",modo],
  ["Caras",caras],
  ["Páginas por cara",[1,2,4,9].includes(t.paginasPorCaraPresupuestadas)?
    String(t.paginasPorCaraPresupuestadas):null],
  ["Copias",Number.isSafeInteger(t.copias)&&t.copias>0?String(t.copias):null],
  ["Papel",papel],
  ["Anillado",anillado]
 ];
 const title=node("h4","Instrucciones para imprimir · ficha registrada");
 area.append(title);
 const grid=node("div","");grid.className="print-specs";
 for(const [label,value] of opciones){
  const line=node("p",label+": "+(value??"NO CONSTA — verificar"));
  if(value===null)line.className="print-missing";
  grid.append(line);
 }
 area.append(grid);
 if(medidas&&medidasUnicas.length>1)
  area.append(node("p","Medidas por página: "+
   medidas.map(x=>"pág. "+x.pagina+": "+x.valor).join("; ")));
 if(descripcion)area.append(node("p","Descripción técnica: "+descripcion));
 if(t.servicio==="ploteos"){
  const planos=Array.isArray(t.planoPorPagina)?t.planoPorPagina:null;
  if(planos?.length){
   area.append(node("h4","Detalle de ploteo por página · verificado por servidor"));
   for(const p of planos){
    const material=p.papel==="recubierto"?"Recubierto":"Obra 80 g";
    const label="Pág. "+p.numeroOriginal+" · "+
     (p.modo==="cad"?"Plano CAD":"Póster / pleno")+" · "+
     p.anchoCm.toFixed(2)+" × "+p.altoCm.toFixed(2)+" cm · "+
     p.rollo+" · "+material;
    area.append(node("p",label));
   }
  }else area.append(node("p","Ploteo: instrucciones históricas sin medidas verificadas. Revisar original antes de imprimir."));
 }
 if(t.tipoAnillado==="grupo"){
  const miembros=Array.isArray(trabajos)?trabajos.filter(w=>
   w.servicio==="documentos"&&w.tipoAnillado==="grupo"&&
   w.grupoAnillado===t.grupoAnillado).sort((a,b)=>a.orden-b.orden):[];
  const correcto=miembros.length>=2&&miembros.every(w=>
   w.formatoFinal===t.formatoFinal&&w.copias===t.copias&&
   Number.isSafeInteger(w.copias)&&w.copias>=1&&
   ["simple","double"].includes(w.carasPresupuestadas)&&
   [1,2,4,9].includes(w.paginasPorCaraPresupuestadas)&&
   Array.isArray(w.paginasElegidas)&&w.paginasElegidas.length>0);
  const hojas=correcto?miembros.reduce((s,w)=>s+
   Math.ceil(Math.ceil(w.paginasElegidas.length/w.paginasPorCaraPresupuestadas)/
    (w.carasPresupuestadas==="double"?2:1)),0):null;
  const nombres=miembros.map(w=>w.orden+". "+w.nombreOriginal).join(" → ");
  area.append(node("p",correcto?
   "ANILLADO CONJUNTO · Grupo "+t.grupoAnillado+" · "+t.copias+
   " anillado(s) · "+hojas+" hojas físicas por anillado. Orden: "+nombres:
   "Grupo de anillado "+(t.grupoAnillado||"NO CONSTA")+
   ": datos históricos incompletos; verificar integrantes y hojas antes de armar."));
 }
 if(opciones.some(([,value])=>value===null))
  area.append(node("p","AVISO: la ficha histórica no conserva todas las instrucciones. Confirmar los campos marcados antes de imprimir."));
 const lines=[pagado?"PEDIDO PAGADO Y VERIFICADO · PREPARACIÓN PENDIENTE":"PEDIDO SIN PAGO CONFIRMADO",t.nombreOriginal||"PDF",
  ...opciones.map(([k,v])=>k+": "+(v??"NO CONSTA — verificar")),
  ...(t.servicio==="ploteos"&&Array.isArray(t.planoPorPagina)?
   t.planoPorPagina.map(p=>"Pág. "+p.numeroOriginal+" · "+p.modo+" · "+
    p.anchoCm+" × "+p.altoCm+" cm · rollo "+p.rollo+" · "+p.papel):[]),
  ...(descripcion?["Descripción técnica: "+descripcion]:[]),
  pagado?"NO IMPRIMIR SIN COMPROBAR ORIGINAL, ESCALA, PAPEL Y PDF FINAL":"NO IMPRIMIR SIN PAGO CONFIRMADO Y VALIDACIÓN DE PRODUCCIÓN"];
 const copy=node("button","Copiar instrucciones");copy.type="button";
 copy.className="outline";
 copy.addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(lines.join("\\n"));
   copy.textContent="Instrucciones copiadas";
  }catch{copy.textContent="No se pudo copiar; seleccioná el texto de la ficha."}
 });
 area.append(copy);
}
async function showUnpaidDetails(id,target,trigger){
 // Mostrar el resultado donde se hizo clic, no en una columna al final de las listas.
 const panelList=document.querySelector("#unpaidDocs");
 for(const other of panelList.querySelectorAll(".unpaid-result")){
  if(other!==target){other.hidden=true;other.replaceChildren()}
 }
 target.hidden=false;
 target.replaceChildren(node("p","Consultando los PDF de este pedido…"));
 trigger.disabled=true;
 trigger.textContent="Consultando…";
 try{
  // POST administrativo idempotente: asigna 001, 002, 003... de forma atómica.
  const numbered=await apiPost("/admin/api/central/asignar-numero",{orderId:id});
  const x=await api("/admin/api/central/unpaid-detail?id="+encodeURIComponent(id));
  if(x.documentos.numeroOrden!==numbered.numeroOrden)
   throw Error("El número de orden no coincide con D1.");
  if(!x?.documentos||!Array.isArray(x.documentos.trabajos))
   throw Error("La Central no devolvió los datos de los archivos.");
  target.replaceChildren();
  target.append(node("h3","ORDEN DE TRABAJO N.º "+x.documentos.numeroOrden+" · SIN PAGO"));
  target.append(node("p","Referencia interna disponible en D1 · "+money(x.documentos.totalDocumentos)+
   " · "+x.documentos.archivos+" archivo(s)"));
  target.append(node("p","PDF originales recibidos. El pago no está confirmado; no imprimir ni entregar."));
  if(x.documentos.esTUS){
   const pack=node("button","Descargar orden "+x.documentos.numeroOrden+" + ZIP de PDF");
   pack.type="button";
   pack.addEventListener("click",()=>{
    const url=new URL("https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/orden-paquete");
    url.searchParams.set("webOrderId",x.documentos.webOrderId);
    const link=document.createElement("a");
    link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
    document.body.append(link);link.click();link.remove();
   });
   target.append(pack);
   target.append(node("p","ZIP: PDF originales + instrucciones numeradas listas para imprimir, sin autorizar producción."));
  }
  for(const t of x.documentos.trabajos){
   const area=node("section","");
   area.append(node("h4",t.orden+". "+t.nombreOriginal));
   area.append(node("p",t.paginasOriginales+" páginas · "+t.bytes+" bytes · "+t.servicio));
   agregarFichaDeImpresion(area,t,{trabajos:x.documentos.trabajos});
   if(x.documentos.esTUS){
    const action=node("button","Descargar PDF original");
    action.type="button";
    action.addEventListener("click",()=>{
     const url=new URL("https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/personal-descargar");
     url.searchParams.set("webOrderId",x.documentos.webOrderId);
     url.searchParams.set("receiptId",t.reciboPrivado);
     const link=document.createElement("a");
     link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
     document.body.append(link);link.click();link.remove();
    });
    area.append(action);
   }else area.append(node("p","Este recibo no corresponde al ensayo Supabase/TUS."));
   target.append(area);
  }
  if(x.documentos.trabajos.length===0)
   target.append(node("p","No se encontraron archivos asociados al pedido."));
  target.scrollIntoView({block:"nearest",behavior:"smooth"});
 }catch(e){
  target.replaceChildren(node("p","No se pudo abrir este pedido: "+String(e.message||e)));
 }finally{
  trigger.disabled=false;
  trigger.textContent="Ver PDF privados";
 }
}
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
const operatorInput=document.querySelector("#productionOperator");
function requestOperator(){
 let who=operatorInput.value.trim();
 if(who.length<2){
  const typed=prompt("¿Quién se encarga de este pedido? Escribilo una sola vez por turno:");
  if(typed===null)return null;
  who=typed.trim();
  if(who.length<2||who.length>60)return null;
  operatorInput.value=who;
 }
 try{sessionStorage.setItem("saberProductionOperator",who)}catch(_){}
 return who;
}

try{operatorInput.value=sessionStorage.getItem("saberProductionOperator")||""}catch(_){}
operatorInput.addEventListener("change",()=>{
 try{sessionStorage.setItem("saberProductionOperator",operatorInput.value.trim())}catch(_){}
});
const liveRecepcionStatus=document.querySelector("#liveRecepcionStatus");
const liveRecepcionList=document.querySelector("#liveRecepcionList");
const liveRecepcionButton=document.querySelector("#refreshLiveRecepcion");
async function actualizarRecepcionLive(){
 liveRecepcionButton.disabled=true;
 liveRecepcionStatus.textContent="Consultando recepción verificada…";
 liveRecepcionList.replaceChildren();
 try{
  const data=await api("/admin/api/central/live-recepcion");
  if(data.ok!==true||data.source!=="production-d1-verified-payments-only"||
     !Array.isArray(data.orders)||data.productionAuthorized!==false||
     data.downloadAuthorized!==false)throw Error("Respuesta LIVE inconsistente");
  liveRecepcionStatus.textContent=data.orders.length?
   data.orders.length+" pedido(s) pagos: verificar sus archivos y preprensa antes de producir.":
   "No hay pedidos documentales LIVE pagados pendientes en esta consulta.";
  const labels={
   PAGADO_ESPERANDO_ORIGINALES:"Aún faltan PDF originales",
   R2_ALMACENADO_PENDIENTE_ANALISIS_PDF:"R2 almacenado · falta analizar PDF",
   ORIGINALES_RECIBIDOS_PREPRENSA_PENDIENTE:"Originales recibidos · preprensa pendiente"
  };
  for(const o of data.orders){
   if(!/^[0-9]{3,}$/.test(o.numeroOrden||"")||
      !Object.hasOwn(labels,o.estado)||
      !Number.isSafeInteger(o.fileCount)||o.fileCount<1||
      !Number.isSafeInteger(o.receivedCount)||o.receivedCount<0||
      !Number.isSafeInteger(o.stagedR2Count)||o.stagedR2Count<0||
      o.readyForProduction!==false||o.zipEnabled!==false)
    throw Error("Pedido sin trazabilidad completa");
   const li=document.createElement("li");
   li.textContent="Orden "+o.numeroOrden+" · "+labels[o.estado]+
    " · recibidos "+o.receivedCount+"/"+o.fileCount+
    " · R2 pendiente de análisis "+o.stagedR2Count+
    " · $"+Number(o.amountArs).toLocaleString("es-AR");
   li.append(node("p","Cliente: "+(o.nombreCliente||"No informado")+
    " · Teléfono: "+(o.telefonoContacto||"No informado")+
    " · Dirección: "+(o.direccionCliente||"No informada · retiro en local")));
   if(o.estado==="ORIGINALES_RECIBIDOS_PREPRENSA_PENDIENTE"&&
      o.pendingCount===0&&o.receivedCount===o.fileCount&&
      /^WEB-ENSAYO-[A-F0-9]{32}$/.test(o.webOrderId||"")){
    // Acceso a ZIP original para revisión humana; no autoriza imprimir.
    const link=document.createElement("a");
    link.href="https://pedidos.libreriasaber.com.ar/personal/paquete?webOrderId="+o.webOrderId;
    link.textContent=" Abrir ZIP e instrucciones para preprensa (acceso personal)";
    link.target="_blank";link.rel="noopener noreferrer";
    li.append(link);
   }
   liveRecepcionList.append(li);
  }
 }catch(e){
  liveRecepcionList.replaceChildren();
  liveRecepcionStatus.textContent="No se pudo consultar recepción LIVE: "+
   String(e.message||e).slice(0,110)+". No se habilita producción.";
 }finally{liveRecepcionButton.disabled=false}
}
liveRecepcionButton.addEventListener("click",actualizarRecepcionLive);
const lanes=["pendiente","en_preparacion","listo","en_espera","entregado"];
let refreshingBoard=false;
/** Edición operativa junto a la tarjeta. Nunca depender de un detalle lejano. */
function inlineDeliveryEditor(order){
 const panel=node("section",""),toggle=node("button",order.estimated_ready_at?
  "Modificar hora de entrega":"Definir hora de entrega");
 panel.className="delivery-editor";panel.hidden=true;
 toggle.type="button";toggle.className="outline";
 const label=node("label","Fecha y hora estimada para retirar (Córdoba)");
 const input=node("input","");input.type="datetime-local";input.step="60";
 input.setAttribute("aria-label","Fecha y hora estimada de retiro, Córdoba");
 const old=Date.parse(order.estimated_ready_at||"");
 if(Number.isFinite(old))
  input.value=new Date(old-3*60*60*1000).toISOString().slice(0,16);
 const reasonLabel=node("label","Motivo del cambio (solo si se posterga la hora)");
 const reason=node("input","");reason.type="text";reason.maxLength=240;
 reason.setAttribute("aria-label","Motivo si la entrega se posterga");
 const save=node("button","Guardar hora estimada");save.type="button";
 save.className="delivery-save";
 const feedback=node("p","");feedback.className="delivery-feedback";
 feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 label.append(input);reasonLabel.append(reason);
 panel.append(node("p","Ingresá una hora que puedas cumplir. El cliente la verá en «Mi pedido»."),label,
  reasonLabel,save,feedback);
 toggle.addEventListener("click",()=>{
  panel.hidden=!panel.hidden;
  if(!panel.hidden){feedback.textContent="";input.focus?.()}
 });
 save.addEventListener("click",async()=>{
  if(!input.value){feedback.textContent="Elegí fecha y hora de entrega.";return}
  const date=new Date(input.value+":00-03:00"),when=date.getTime();
  if(!Number.isFinite(when)||when<Date.now()+5*60000||when>Date.now()+45*24*3600000){
   feedback.textContent="La hora debe ser futura: entre 5 minutos y 45 días.";return;
  }
  const explanation=reason.value.trim();
  if(Number.isFinite(old)&&when>old&&explanation.length<5){
   feedback.textContent="Para postergar una entrega, indicá el motivo (mínimo 5 caracteres).";return;
  }
  const operator=requestOperator();
  if(!operator){feedback.textContent="Ingresá el responsable de este trabajo.";return}
  if(!confirm("¿Informar al cliente esta hora estimada de retiro?"))return;
  save.disabled=true;feedback.textContent="Guardando hora…";
  try{
   const response=await apiPost("/admin/api/central/preparation-estimate",{
    order_id:order.id,expected_version:Number(order.estimated_ready_version)||0,
    ready_at:date.toISOString(),operator,reason:explanation,confirmed:true
   });
   if(response.saved!==true)throw Error("No se confirmó el horario");
   status.textContent="Orden "+String(order.work_number||"")+" · hora estimada guardada y disponible en «Mi pedido».";
   await refresh({silent:true,force:true});
  }catch(e){feedback.textContent="No se pudo guardar: "+String(e.message||e)}
  finally{save.disabled=false}
 });
 return {toggle,panel};
}

/** Revisión R2 en una sola tarjeta: sin exigir navegar a otra cola. */
function inlineR2Review(order){
 const toggle=node("button","Revisar preprensa");toggle.type="button";
 toggle.className="primary-next";
 const panel=node("section","");panel.className="delivery-editor";panel.hidden=true;
 toggle.addEventListener("click",async()=>{
  panel.hidden=!panel.hidden;
  if(panel.hidden)return;
  panel.replaceChildren(node("p","Consultando presupuesto y archivo verificado…"));
  try{
   const review=await api("/admin/api/central/r2-paid-review");
   const r=(review.orders||[]).find(v=>v.commercialOrderId===order.id);
   if(!r)throw Error("Este pedido cambió de estado. Actualizá Nuevos.");
   const q=r.quoteSnapshot;
   if(!r.verifiedReceipt||!r.quotedParametersAvailable||!q){
    panel.replaceChildren(node("p","No se puede aprobar todavía: falta el PDF íntegro o la ficha cotizada. Revisá la recepción desde la cola R2."));
    return;
   }
   const pageInfo=q.paginas.map((v,i)=>
    "#"+(i+1)+" · "+v[0]+"×"+v[1]+" cm · "+v[2]+
    " · "+v[3]+" · "+v[4]).join("; ");
   panel.replaceChildren(
    node("h4","Preprensa R2 · "+(q.nombre||"Archivo")),
    node("p","Pagado "+money(r.amountArs)+" · "+q.copias+" copia(s) · "+
     (q.modoImpresion==="bn"?"B/N":"Color")+
     " · "+q.papelPoster+" · rollo "+q.rolloBase),
    node("p","Cotizado: "+pageInfo));
   const url=new URL("https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/r2-preprensa-personal");
   url.searchParams.set("webOrderId",r.webOrderId);
   url.searchParams.set("receiptId",r.receiptId);
   const original=node("a","Abrir PDF original para verificar");
   original.href=url.href;original.target="_blank";original.rel="noopener noreferrer";
   panel.append(original);
   const label=node("label","Medidas del presupuesto (corregí si el PDF real difiere; separar páginas con ;)");
   const dimensions=node("input","");
   dimensions.type="text";dimensions.maxLength=2000;
   dimensions.placeholder="Ej.: 59,4 x 84,1";
   // Referencia del presupuesto, no una medición del archivo recibido:
   // el operador la contrasta con el PDF y sólo entonces confirma.
   dimensions.value=q.paginas.map(v=>v[0]+" x "+v[1]).join("; ");
   label.append(dimensions);panel.append(label);
   const confirmLabel=node("label","");
   const confirmed=node("input","");confirmed.type="checkbox";
   confirmLabel.append(confirmed);
   confirmLabel.append(node("span"," Verifiqué el contenido real, medidas, CAD/póster, copias, rollo, papel y precio contra el presupuesto. No imprimir si hay diferencias."));
   panel.append(confirmLabel);
   const save=node("button","Aprobar preprensa");save.type="button";
   const feedback=node("p","");feedback.className="delivery-feedback";
   feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
   panel.append(save,feedback);
   save.addEventListener("click",async()=>{
    if(!confirmed.checked){
     feedback.textContent="Primero revisá el original y confirmá todos los controles.";return;
    }
    const parts=dimensions.value.trim().split(";").map(x=>x.trim());
    const sizes=parts.map(x=>{
     const m=x.match(/^(\\d+(?:[,.]\\d+)?)\\s*[x×]\\s*(\\d+(?:[,.]\\d+)?)$/i);
     return m?[Number(m[1].replace(",",".")),Number(m[2].replace(",","."))]:null;
    });
    if(parts.length!==q.paginas.length||sizes.some(x=>!x||x.some(v=>!Number.isFinite(v)||v<=0||v>2000))){
     feedback.textContent="Ingresá las medidas reales de todas las páginas. No se aprobó el pedido.";return;
    }
    const operator=requestOperator();
    if(!operator){feedback.textContent="Falta responsable del control.";return}
    save.disabled=true;feedback.textContent="Registrando verificación en D1…";
    try{
     const result=await apiPost("/admin/api/central/r2-prepress-approve",{
      schema:"saber-r2-preprensa-aprobacion-v1",
      orderId:order.id,receiptId:r.receiptId,medidasCm:sizes,operator,
      notes:"Preprensa confirmada en Nuevos: original, medidas, clasificación, copias, papel, rollo y precio verificados por el responsable.",
      confirmed:{contenido:true,clasificacion:true,copias:true,papel:true,rollo:true,precio:true}
     });
     if(result.approved!==true)throw Error("La Central no confirmó la aprobación");
     await refresh({silent:true,force:true});
     status.textContent="Preprensa aprobada · el ploteo continúa en Nuevos, listo para iniciar.";
    }catch(e){feedback.textContent="Sin aprobación: "+String(e.message||e);save.disabled=false}
   });
  }catch(e){panel.replaceChildren(node("p","No se pudo abrir la preprensa: "+String(e.message||e)))}
 });
 return {toggle,panel};
}

function boardCard(order){
 const card=node("article","");card.className="board-card";
 const num=order.work_number?String(order.work_number).padStart(3,"0"):"Sin número";
 const heading=node("h4",order.r2_prepress_pending?
  "Nuevo ploteo R2 · "+String(order.web_order_id||"").slice(-8):
  "Orden "+num);card.append(heading);
 card.append(node("p",String(order.description||"Pedido documental").slice(0,130)));
 const totals=node("p",money(order.amount_ars)+" · "+(order.file_count||0)+" PDF · Pago verificado");
 totals.className="money";card.append(totals);
 card.append(node("p","Cliente: "+(order.customer_name||"No informado")));
 card.append(node("p","Teléfono: "+(order.customer_phone||"No informado")));
 card.append(node("p","Dirección: "+(order.customer_address||"No informada · retiro en local")));
 if(order.universal_pdf_pending===true){
  const count=Number.isSafeInteger(order.universal_pdf_pending_count)?
   order.universal_pdf_pending_count:order.file_count;
  if(count===0&&/^WEB-ENSAYO-[A-F0-9]{32}$/.test(order.web_order_id||"")){
   card.append(node("p","Todos los PDF recibidos. Preprensa pendiente: NO imprimir ni iniciar hasta revisar el ZIP."));
   const actions=node("div","");actions.className="actions";
   const zip=node("button","Descargar ZIP y revisar");zip.className="outline";
   zip.addEventListener("click",()=>{
    const u=new URL("https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/universal-paquete");
    u.searchParams.set("webOrderId",order.web_order_id);
    const a=document.createElement("a");a.href=u.href;a.target="_blank";
    a.rel="noopener noreferrer";document.body.append(a);a.click();a.remove();
   });actions.append(zip);
   const approve=node("button","Aprobar preprensa");approve.className="outline";
   approve.addEventListener("click",async()=>{
    const operator=requestOperator();
    if(!operator){status.textContent="Indicar responsable de preprensa";return}
    const checked=confirm("¿Revisaste TODOS los PDF del ZIP en Adobe? Confirmá integridad, medidas, clasificación CAD/Póster, páginas, caras, copias, material, rollos, escala y precio. NO aprobar sin revisar.");
    if(!checked)return;
    approve.disabled=true;
    try{
     const fields=["archivo","caras","clasificacion","copias","escala","material","medidas","paginas","precio","rollo"];
     const confirmed=Object.fromEntries(fields.map(k=>[k,true]));
     const result=await apiPost("/admin/api/central/r2-universal-prepress-approve",{
      schema:"saber-central-r2-universal-prepress-approval-v1",
      webOrderId:order.web_order_id,commercialOrderId:order.id,operator,confirmed
     });
     if(result.approved!==true||result.productionGatePassed!==true)
      throw Error("Preprensa sin aprobación");
     await refresh({silent:true,force:true});
     status.textContent="Preprensa mixta aprobada: pedido habilitado para comenzar.";
    }catch(e){
     status.textContent="Preprensa pendiente: "+String(e.message||e);
     approve.disabled=false;
    }
   });actions.append(approve);
   const detail=node("button","Detalle");detail.className="outline";
   detail.addEventListener("click",()=>showOrder(order.id));actions.append(detail);
   card.append(actions);return card;
  }
  card.append(node("p","PDF mixtos TUS/R2 · "+count+
   " original(es) pendiente(s) de verificación. No preparar ni imprimir."));
  card.append(node("p","Pedido pagado: se conserva en Nuevos hasta completar recepción y preprensa."));
  const only=node("button","Detalle");only.className="outline";
  only.addEventListener("click",()=>showOrder(order.id));
  card.append(only);
  return card;
 }
  if(order.r2_prepress_pending){
  const received=order.r2_prepress_state==="RECIBIDO_PENDIENTE_PREPRENSA";
  const label=received?"Original recibido · falta aprobar preprensa":
   order.r2_prepress_state==="PAGADO_ESPERANDO_ARCHIVO"?
    "Pago confirmado · esperando PDF del cliente":
    "Recepción a revisar · NO imprimir";
  card.append(node("p",label));
  const controls=node("div","");controls.className="actions";
  if(received&&order.r2_prepress_receipt_verified){
   const review=inlineR2Review(order);
   controls.append(review.toggle);card.append(controls,review.panel);
  }else{
   card.append(node("p","El pedido permanece en Nuevos hasta recibir y verificar el original."));
  }
  card.append(node("p","Revisión obligatoria antes de habilitar producción y ZIP final."));
  return card;
 }
  if(order.estimated_ready_at&&["pendiente","en_preparacion","en_espera"].includes(order.production_state))
   card.append(node("p","Preparación estimada: "+preparationTimeLocal(order.estimated_ready_at)+" · provisional"));
 const controls=node("div","");controls.className="actions";
 const current=order.production_state;
 const next=({pendiente:"en_preparacion",en_preparacion:"listo",en_espera:"en_preparacion",listo:"entregado"})[current];
 const name=({en_preparacion:current==="en_espera"?"Retomar":"Iniciar trabajo",listo:"Marcar listo",entregado:"Entregado"})[next];
 if(next){
  const main=node("button",name);main.className="primary-next";
  main.addEventListener("click",()=>moveCard(order,next,main));controls.append(main);
 }
 if(["pendiente","en_preparacion","listo"].includes(current)){
  const hold=node("button","En espera");hold.className="outline";
  hold.addEventListener("click",()=>moveCard(order,"en_espera",hold));controls.append(hold);
 }
 if(current!=="entregado"&&/^WEB-ENSAYO-[A-F0-9]{32}$/.test(order.web_order_id||"")){
  const isR2=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(order.r2_receipt_id||"");
  const zip=node("button",isR2?"ZIP ploteo grande":"Descargar ZIP");zip.className="outline";
  zip.addEventListener("click",()=>{
   const u=new URL("https://saber-documentos-pruebas.libreriasaber.workers.dev"+
    (order.universal_pdf_approved?"/prueba-v2/universal-paquete":
     isR2?"/prueba-v2/r2-preprensa-personal":"/prueba-v2/orden-paquete"));
   u.searchParams.set("webOrderId",order.web_order_id);
   if(isR2)u.searchParams.set("receiptId",order.r2_receipt_id);
   const link=document.createElement("a");
   link.href=u.href;link.target="_blank";link.rel="noopener noreferrer";
   document.body.append(link);link.click();link.remove();
  });controls.append(zip);
 }
 const deliveryEditor=current==="en_preparacion"?inlineDeliveryEditor(order):null;
 if(deliveryEditor)controls.append(deliveryEditor.toggle);
 const detail=node("button","Detalle");detail.className="outline";
 detail.addEventListener("click",()=>showOrder(order.id));
 controls.append(detail);card.append(controls);
 if(deliveryEditor)card.append(deliveryEditor.panel);
 const feedback=node("p","");feedback.className="board-feedback";
 feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 card.append(feedback);
 return card;
}
async function moveCard(order,next,button){
 const card=button.closest(".board-card");
 const feedback=card?.querySelector(".board-feedback");
 const inform=(message)=>{
  if(feedback)feedback.textContent=message;
  status.textContent=message;
 };
 const operator=requestOperator();
 if(!operator){inform("Indicá quién está preparando el pedido; no se cambió el estado.");return}
 let reason="";
 if(next==="en_espera"){
  const typed=prompt("¿Por qué se detiene la orden "+(order.work_number||"")+"?");
  if(typed===null)return;
  reason=typed.trim();
  if(reason.length<5){inform("Indicá el motivo de la espera (mínimo 5 caracteres).");return}
 }
 if(next==="entregado"&&!confirm("¿Confirmás que la orden "+(order.work_number||"")+" fue entregada al cliente?"))return;
 button.disabled=true;
 if(feedback)feedback.textContent="Guardando cambio de estado…";
 try{
  const updated=await apiPost("/admin/api/central/production-status",{
   order_id:order.id,from:order.production_state,to:next,
   version:order.production_version,operator,reason,confirmed:next==="listo"||next==="entregado"
  });
  await refresh({silent:true,force:true});
  status.textContent="Orden "+(order.work_number||"")+" → "+productionLabel(next)+" · cambio registrado.";
  if(next==="entregado"&&updated.cleanupR2&&
     !["no_elegible","desactivado"].includes(updated.cleanupR2.state))
   status.textContent+=" · Limpieza R2: "+(
    updated.cleanupR2.state==="deleted"?"original eliminado y auditado":
    "PENDIENTE o ERROR; verificar antes de dar por eliminado");
  if(next==="en_preparacion")status.textContent+=" · Definí la hora de retiro desde el detalle del pedido.";
 }catch(e){
  inform("No se pudo cambiar el estado: "+String(e.message||e));
 }finally{button.disabled=false}
}
async function refresh({silent=false,force=false}={}){
 if(refreshingBoard){
  if(force){
   for(let i=0;i<20&&refreshingBoard;i++)
    await new Promise(resolve=>setTimeout(resolve,150));
   if(refreshingBoard)throw Error("La Central sigue actualizando. Volvé a consultar pedidos.");
  }else return;
 }
 refreshingBoard=true;
 try{
  if(!silent){status.textContent="Actualizando tablero…";await refreshCronState()}
  const response=await api("/admin/api/orders");
  const ordersList=Array.isArray(response.orders)?response.orders:[];
  const counts={pendiente:0,en_preparacion:0,listo:0,en_espera:0,entregado:0};
  for(const name of lanes)document.querySelector("#lane-"+name).replaceChildren();
  orders.replaceChildren();
  let other=0;
  for(const o of ordersList){
   if(Object.prototype.hasOwnProperty.call(counts,o.production_state)){
    counts[o.production_state]++;
    document.querySelector("#lane-"+o.production_state).append(boardCard(o));
   }else{
    other++;
    const item=node("p",(o.description||"Pedido")+
     " · "+money(o.amount_ars)+
     (o.r2_legacy_unusable?
       " · ENSAYO HISTÓRICO, no operativo: requiere ficha nueva para producir.":
       " · pago confirmado"));
    const b=node("button","Detalle");b.className="outline";
    b.addEventListener("click",()=>showOrder(o.id));
    item.append(b);orders.append(item);
   }
  }
  for(const name of lanes){
   document.querySelector("#count-"+name).textContent=counts[name];
   if(counts[name]===0){
    const empty=node("p","Sin trabajos");empty.className="note";
    document.querySelector("#lane-"+name).append(empty);
   }
  }
  document.querySelector("#count-other").textContent=other;
  if(other===0)orders.append(node("p","No hay otros pedidos pagados."));
  if(response.universalReviewUnavailable){
   status.textContent="ATENCIÓN: la cola universal de pedidos pagados no pudo verificarse. Revisá la Central.";
  }else if(response.r2ReviewUnavailable){
   status.textContent="ATENCIÓN: no se pudo cargar la cola de R2 pagados. Reintentá; los pedidos documentales siguen visibles.";
  }else if(!silent)status.textContent="Tablero actualizado · "+
   (counts.pendiente+counts.en_preparacion+counts.listo+counts.en_espera)+" trabajos activos";
 }catch(e){status.textContent="No se pudo actualizar el tablero: "+String(e.message||e)}
 finally{refreshingBoard=false}
}
setInterval(()=>{
 if(!document.hidden&&secret.value.trim()){
  refresh({silent:true});
  refreshTransfers({silent:true});
 }
},30000);
document.querySelector("#refreshExpress").addEventListener("click",async()=>{
 const list=document.querySelector("#expressReceipts");list.replaceChildren();
 try{
  const info=await api("/admin/api/central/polaroids");
  if(!info.manifests.length)list.append(node("li","Sin Polaroids Express recibidas."));
  for(const m of info.manifests){
   const item=node("li",m.referencia+" · "+m.fotos+" fotos · "+m.hojas+
    " hoja(s) A4 · "+money(m.importe));
   item.append(node("p","PDF final privado confirmado · "+(m.estadoPago==="PAGADO"?
    "Pago confirmado · Ver en pedidos pagados":"Pago pendiente de confirmar")));
   list.append(item);
  }
  status.textContent=info.manifests.length+" pedido(s) Polaroids Express recibido(s)";
 }catch(e){status.textContent=e.message}
});
document.querySelector("#goR2Paid")?.addEventListener("click",()=>{
 const panel=document.querySelector("#r2ReviewPanel");
 if(!panel)return;
 panel.scrollIntoView({behavior:"smooth",block:"start"});
 document.querySelector("#refreshR2Paid")?.click();
});
document.querySelector("#refreshR2Paid")?.addEventListener("click",async()=>{
 const list=document.querySelector("#r2PaidReview");
 list.replaceChildren(node("li","Consultando pagos y originales..."));
 try{
  const data=await api("/admin/api/central/r2-paid-review");
  list.replaceChildren();
  const rows=Array.isArray(data.orders)?data.orders:[];
  if(!rows.length)list.append(node("li","Sin ploteos grandes pagados pendientes."));
  for(const r of rows){
   const statusName=r.estado==="RECIBIDO_PENDIENTE_PREPRENSA"
    ?"Original recibido · verificar contenido, medida y precio"
    :r.estado==="PAGADO_ESPERANDO_ARCHIVO"
    ?"Pago acreditado · esperando archivo del comprador"
    :"ATENCIÓN · el archivo recibido no coincide con la reserva";
   const item=node("li",(r.webOrderId||"Orden sin referencia")+" · "+money(r.amountArs)+" · "+statusName);
   item.append(node("p","Pedido comercial: "+r.commercialOrderId+
    " · "+(Number(r.expectedBytes)/1048576).toFixed(1)+" MiB previstos"+
    " · "+r.declaredPages+" página(s) declarada(s), aún sin validar"));
   if(r.quotedParametersAvailable&&r.quoteSnapshot){
    const q=r.quoteSnapshot;
    item.append(node("p","Cotizado (declarado, NO comprobado): "+
     q.copias+" copia(s) · "+q.modoImpresion+" · póster "+q.papelPoster+
     " · rollo base "+q.rolloBase+" · "+q.paginas.length+" página(s)"));
    const pag=q.paginas.slice(0,20).map((v,i)=>
     "#"+(i+1)+" "+v[0]+"×"+v[1]+" cm "+v[2]+" / "+v[3]+" / "+v[4]);
    item.append(node("p","Detalle por página: "+pag.join("; ")+
      (q.paginas.length>20?" · consultar resto en ficha":"")));
   }else{
    item.append(node("p","ATENCIÓN: presupuesto anterior sin detalle completo de papel/rollo/copias; revisar manualmente antes de producir."));
   }
   if(r.receiptId){
    item.append(node("p","Referencia del original en R2: "+r.receiptId));
    if(/^WEB-ENSAYO-[A-F0-9]{32}$/.test(r.webOrderId||"")&&
       /^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.receiptId)){
     const u=new URL("https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/r2-preprensa-personal");
     u.searchParams.set("webOrderId",r.webOrderId);
     u.searchParams.set("receiptId",r.receiptId);
     const link=node("a","Descargar original R2 (personal autorizado)");
     link.href=u.href;link.target="_blank";link.rel="noopener noreferrer";
     item.append(link);
    }
   }
   if(r.verifiedReceipt&&r.quotedParametersAvailable&&r.quoteSnapshot){
    const approve=node("button","Confirmar preprensa y enviar a producción");
    approve.type="button";
    approve.addEventListener("click",async()=>{
     const operator=requestOperator();
     if(!operator){status.textContent="Falta responsable de preprensa.";return}
     const count=r.quoteSnapshot.paginas.length;
     const measured=prompt("Ingresá las medidas REALES leídas del original en Acrobat. "+
      count+" página(s), cada una ancho x alto en centímetros, separadas por punto y coma. "+
      "Ejemplo: 59,4 x 84,1; 60 x 90. No copies automáticamente las medidas cotizadas.","");
     if(measured===null)return;
     const nums=measured.split(";").map(part=>{
      const m=part.trim().match(/^(\\d+(?:[,.]\\d+)?)\\s*[x×]\\s*(\\d+(?:[,.]\\d+)?)$/i);
      return m?[Number(m[1].replace(",",".")),Number(m[2].replace(",","."))]:null;
     });
     if(nums.length!==count||nums.some(x=>!x||x.some(n=>!Number.isFinite(n)||n<=0))){
      status.textContent="Medidas reales inválidas; no se aprobó el ploteo.";return;
     }
     const notes=prompt("Constancia breve de revisión del original (mínimo 6 caracteres):","");
     if(notes===null||notes.trim().length<6){status.textContent="Falta constancia de revisión.";return}
     if(!confirm("¿Verificaste visualmente contenido PDF, clasificación CAD/póster de CADA página, "+
      "copias, papel, rollo y precio contra la ficha guardada? "+
      "Si hay una diferencia, CANCELÁ y resolvé comercialmente antes de producir."))return;
     approve.disabled=true;
     try{
      await apiPost("/admin/api/central/r2-prepress-approve",{
       schema:"saber-r2-preprensa-aprobacion-v1",orderId:r.commercialOrderId,
       receiptId:r.receiptId,medidasCm:nums,operator,notes:notes.trim(),
       confirmed:{contenido:true,clasificacion:true,copias:true,papel:true,
        rollo:true,precio:true}
      });
      status.textContent="Preprensa aprobada en D1. Pedido disponible en el tablero de producción.";
      await refresh({force:true});document.querySelector("#refreshR2Paid")?.click();
     }catch(e){status.textContent="NO APROBADO: "+String(e.message||e)}
     finally{approve.disabled=false}
    });
    item.append(approve);
   }
   item.append(node("p","No habilitado para impresión ni ZIP de producción hasta completar preprensa."));
   list.append(item);
  }
  status.textContent=rows.length+" ploteo(s) grandes pagados en revisión";
 }catch(e){
  list.replaceChildren(node("li","No se pudo consultar R2: "+String(e.message||e)));
 }
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
let refreshingTransfers=false,transferVisibleKey="";
async function refreshTransfers({silent=false,force=false}={}){
 if(refreshingTransfers)return;
 const panel=document.querySelector("#transferPanelStatus");
 const list=document.querySelector("#transferPending");
 if(!secret.value.trim()){
  panel.textContent="Ingresá la clave privada para consultar las transferencias.";
  return;
 }
 refreshingTransfers=true;
 try{
  if(!silent)panel.textContent="Consultando transferencias…";
  const result=await api("/admin/api/transfers/pending");
  const pending=Array.isArray(result.orders)?result.orders:[];
  const key=pending.map(t=>t.order_id+":"+t.amount_ars).join("|");
  document.querySelector("#transferCount").textContent=pending.length+" pendiente(s)";
  // No reconstruir el formulario si la cola no cambió: conservar referencias mientras se escriben.
  if(force||key!==transferVisibleKey||(!list.children.length)){
   list.replaceChildren();
   transferVisibleKey=key;
   if(!pending.length)list.append(node("li","No hay transferencias pendientes."));
   for(const t of pending){
    const orderLabel=t.numero_orden?"Orden N.º "+String(t.numero_orden).padStart(3,"0"):"Pedido sin número comercial";
    const item=node("li",orderLabel+" · "+money(t.amount_ars)+" · PENDIENTE");
    item.append(node("p","Cliente: "+(t.customer_name||"No informado")+" · Teléfono: "+(t.customer_phone||"No informado")));
    item.append(node("p","Dirección: "+(t.customer_address||"No informada · retiro en local")));
    item.append(node("p","Solicitada: "+t.created_at+" · Pago NO verificado · NO imprimir"));
    const label=node("label","Referencia de operación bancaria (obligatoria):");
    const reference=node("input","");
    reference.type="text";reference.maxLength=80;reference.autocomplete="off";
    reference.placeholder="Ej.: Banco MP 34 55";
    reference.setAttribute("aria-label","Referencia única de la operación bancaria");
    const note=node("p","Los espacios se conservan en la referencia registrada. Comprobá importe y operación en el banco. Solo ENSAYO privado; nunca transfieras dinero al alias ficticio.");
    note.className="note";
    const feedback=node("p","");
    feedback.className="transfer-feedback";feedback.setAttribute("role","status");
    const approve=node("button","Confirmar acreditación de ensayo");
    approve.type="button";
    approve.addEventListener("click",async()=>{
     const operator=requestOperator();
     const bankReference=reference.value.trim().toUpperCase().replace(/\s+/g," ");
     const inform=message=>{feedback.textContent=message;panel.textContent=orderLabel+": "+message;status.textContent=message};
     if(!operator){inform("Falta indicar el responsable. Completalo en el encabezado.");operatorInput.focus();return}
     if(!/^[A-Z0-9][A-Z0-9._/ -]{5,79}$/.test(bankReference)||/\.(?:PDF|PNG|JPE?G|WEBP)$/.test(bankReference)){
      inform("Ingresá la referencia de 6 a 80 caracteres. Podés usar espacios entre letras y números.");
      reference.setAttribute("aria-invalid","true");reference.focus();return;
     }
     reference.setAttribute("aria-invalid","false");
     if(!confirm("¿Confirmás la acreditación de ENSAYO por "+money(t.amount_ars)+" de "+orderLabel+"? Debés haber cotejado el movimiento. Esto no acredita dinero real.")){
      inform("Acreditación cancelada; el pedido sigue pendiente.");return;
     }
     approve.disabled=true;
     inform("Registrando la acreditación de ensayo…");
     let approved=false;
     try{
      const saved=await apiPost("/admin/api/transfers/approve",{
       order_id:t.order_id,amount_ars:t.amount_ars,bank_reference:bankReference,
       operator,confirmed:true
      });
      if(saved.ok!==true||saved.payment_confirmed!==true)throw Error("El servidor no confirmó la acreditación");
      approved=true;
      await refreshTransfers({silent:true,force:true});
      await refresh({silent:true,force:true});
      panel.textContent=orderLabel+" acreditada en ENSAYO · "+saved.operator+" · "+saved.recorded_at+
       ". Ya debe figurar en «Nuevos · pagos confirmados».";
      status.textContent=panel.textContent;
     }catch(e){
      inform((approved?"Acreditado, pero no se pudo actualizar el tablero: ":"No se acreditó: ")+String(e.message||e));
     }finally{if(!approved)approve.disabled=false}
    });
    item.append(label,reference,note,feedback,approve);
    list.append(item);
   }
  }
  if(!silent)panel.textContent=pending.length?
   pending.length+" transferencia(s) esperando verificación. Es necesario indicar responsable y referencia.":"Sin transferencias por verificar.";
 }catch(e){
  panel.textContent="No se pudieron cargar las transferencias: "+String(e.message||e);
  if(!silent)status.textContent=panel.textContent;
 }finally{refreshingTransfers=false}
}
document.querySelector("#refreshTransfers").addEventListener("click",()=>refreshTransfers({force:true}));
let liveTransferRefreshing=false;
async function refreshLiveTransfers(){
 if(liveTransferRefreshing||!secret.value.trim())return;
 let area,list,message;
 try{
  area=document.querySelector("#transferLiveArea");
  list=document.querySelector("#transferLivePending");
  message=document.querySelector("#transferLiveStatus");
 }catch{return} // Panel ausente en clientes antiguos o pruebas del tablero.
 if(!area||!list||!message)return;
 liveTransferRefreshing=true;
 try{
  const result=await api("/admin/api/central/live-transfers/pending");
  if(result.ok!==true||!Array.isArray(result.pending))throw Error("Respuesta de Central inconsistente");
  area.hidden=false;list.replaceChildren();
  if(!result.pending.length){
   message.textContent="No hay transferencias reales esperando acreditación.";
  }else{
   message.textContent=result.pending.length+" transferencia(s) REAL(ES) pendientes. Confirmar únicamente el movimiento en el banco.";
   for(const t of result.pending){
    if(!/^[a-f0-9-]{36}$/i.test(t.order_id||"")||
       !Number.isSafeInteger(t.amount_ars)||t.amount_ars<1)continue;
    const li=node("li","Orden "+(t.numero_orden||t.order_id)+" · "+money(t.amount_ars));
    li.append(node("p","Cliente: "+(t.nombre||"No informado")+
     " · Teléfono: "+(t.telefono||"No informado")+
     " · Dirección: "+(t.direccion||"No informada · retiro en local")));
    const operator=node("input","");operator.placeholder="Nombre del responsable";operator.maxLength=60;
    const reference=node("input","");reference.placeholder="Referencia REAL del banco";reference.maxLength=80;
    const approve=node("button","Confirmar acreditación bancaria REAL");approve.type="button";
    approve.addEventListener("click",async()=>{
     const op=operator.value.trim(),ref=reference.value.trim().toUpperCase().replace(/\s+/g," ");
     if(op.length<2||op.length>60||!/^[A-Z0-9][A-Z0-9._/ -]{5,79}$/.test(ref)){
      message.textContent="Ingresá operador y referencia verificable del banco.";return;
     }
     if(!confirm("¿Verificaste EN EL BANCO la acreditación REAL de "+money(t.amount_ars)+
      " para esta orden? El comprobante del cliente NO alcanza."))return;
     approve.disabled=true;
     try{
      const saved=await apiPost("/admin/api/central/live-transfers/approve",{
       order_id:t.order_id,amount_ars:t.amount_ars,bank_reference:ref,operator:op,confirmed:true
      });
      if(saved.ok!==true||saved.paymentVerified!==true||saved.productionAuthorized!==false)
       throw Error("Acreditación no confirmada.");
      message.textContent="Acreditación real registrada. Pedido disponible en recepción LIVE.";
      await refresh();
      await actualizarRecepcionLive();
      await refreshLiveTransfers();
     }catch(e){approve.disabled=false;message.textContent=String(e.message||"Revisión no registrada").slice(0,145)}
    });
    li.append(node("p","Operador responsable"),operator,node("p","Referencia bancaria"),reference,approve);
    list.append(li);
   }
  }
 }catch(e){
  // En entorno de ensayo o sin compuerta comercial no se muestra esta sección.
  area.hidden=true;list.replaceChildren();
 }finally{liveTransferRefreshing=false}
}
if(typeof setInterval==='function'){
 setInterval(()=>refreshLiveTransfers(),30000);
 refreshLiveTransfers();
}

document.querySelector("#refreshUnpaid").addEventListener("click",async()=>{
 const list=document.querySelector("#unpaidDocs");
 try{
  status.textContent="Consultando pagos pendientes...";
  const x=await api("/admin/api/central/unpaid");
  list.replaceChildren();
  if(!x.orders.length)list.append(node("li","No hay pedidos documentales esperando pago."));
  for(const o of x.orders){
   const li=node("li",(o.numero_orden?"Orden N.º "+String(o.numero_orden).padStart(3,"0"):"Pedido sin numerar")+
    " · "+o.file_count+" PDF · Total "+money(o.order_ars));
   li.append(node("p","Estado: pago sin confirmar · Identificador técnico reservado al sistema"));
   const btn=node("button","Ver PDF privados");btn.className="outline";btn.type="button";
   const panel=node("div","");panel.className="unpaid-result";panel.hidden=true;
   btn.addEventListener("click",()=>showUnpaidDetails(o.commercial_order_id,panel,btn));
   li.append(btn);
   li.append(panel);
   const sandboxButton=node("button","Preparar enlace Mercado Pago (ensayo)");
   sandboxButton.className="outline";sandboxButton.type="button";
   const sandboxInfo=node("div","");
   sandboxButton.addEventListener("click",async()=>{
    sandboxButton.disabled=true;
    sandboxInfo.replaceChildren(node("p","Validando importe y documentos en D1…"));
    try{
     const pre=await apiPost("/admin/api/central/payment-preflight",{order_id:o.commercial_order_id});
     if(!pre.ready_for_sandbox_test&&pre.reason!=="PAGO_YA_INICIADO")
      throw Error("Pedido no apto para ensayo: "+pre.reason);
     const pay=await apiPost("/admin/api/central/payment-sandbox-prepare",{order_id:o.commercial_order_id});
     const url=new URL(pay.checkout_url);
     if(url.protocol!=="https:"||!/(^|\\.)(mercadopago\\.com|mercadopago\\.com\\.ar)$/.test(url.hostname))
      throw Error("Mercado Pago devolvió un enlace no autorizado.");
     const link=node("a","Abrir Mercado Pago con comprador de prueba");
     link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
     sandboxInfo.replaceChildren(node("p","PRUEBA CON CUENTA COMPRADORA DE ENSAYO · No autoriza producción ni confirma pagos."),link);
    }catch(e){sandboxInfo.replaceChildren(node("p",String(e.message||e)));}
    finally{sandboxButton.disabled=false;}
   });
   li.append(sandboxButton);
   li.append(sandboxInfo);
   const diagnosticButton=node("button","Diagnosticar intento de pago");
   diagnosticButton.className="outline";diagnosticButton.type="button";
   const diagnosticInfo=node("div","");
   diagnosticButton.addEventListener("click",async()=>{
    diagnosticButton.disabled=true;
    diagnosticInfo.replaceChildren(node("p","Consultando estados en Mercado Pago…"));
    try{
     const d=await apiPost("/admin/api/central/payment-diagnostic",{order_id:o.commercial_order_id});
     const texts=[
      "Estado interno: "+d.order_state,
      "Preferencia registrada: "+(d.preference_registered?"Sí":"No"),
      "Preferencia vinculada al pedido: "+(d.preference_matches===undefined?"No consta":d.preference_matches?"Sí":"No"),
      "Consulta de pagos: "+(d.payment_search_ok?"Correcta":"No disponible"),
      "Intentos encontrados: "+d.payment_attempts.length,
      ...d.payment_attempts.map(p=>"Pago "+p.status+" · "+p.status_detail+
       " · importe "+(p.amount_matches?"correcto":"a revisar")),
      "Consulta de órdenes MP: "+(d.merchant_order_search_ok?"Correcta":"No disponible"),
      ...(d.merchant_orders||[]).map(m=>"Orden MP: "+m.status+
       (m.payments.length?" · "+m.payments.map(p=>p.status+"/"+p.status_detail).join(", "):" · sin pagos"))
     ];
     diagnosticInfo.replaceChildren(...texts.map(t=>node("p",t)));
    }catch(e){diagnosticInfo.replaceChildren(node("p",String(e.message||e)));}
    finally{diagnosticButton.disabled=false;}
   });
   li.append(diagnosticButton);
   li.append(diagnosticInfo);
   list.append(li);
  }
  status.textContent=x.orders.length+" pedido(s) en espera de pago";
 }catch(e){list.replaceChildren();status.textContent=e.message}
});

const pricePreviewButton=document.querySelector("#pricePreviewButton");
const pricePreviewResult=document.querySelector("#pricePreviewResult");
const priceLoadButton=document.querySelector("#priceLoad");
const priceSaveButton=document.querySelector("#priceSave");
const priceApproveButton=document.querySelector("#priceApprove");
const priceMessage=document.querySelector("#priceMessage");
const priceItems=document.querySelector("#priceItems");
const priceGroup=document.querySelector("#priceGroup");
const priceSearch=document.querySelector("#priceSearch");
const priceDiffs=document.querySelector("#priceDiffs");
const priceHistory=document.querySelector("#priceHistory");
let priceSnapshot=null;
let priceChanges=new Map();
function priceEditSummary(){
 if(!priceSnapshot)return;
 const items=[...priceChanges.entries()];
 priceSaveButton.disabled=items.length===0;
 pricePreviewButton.disabled=false;
 priceApproveButton.disabled=!priceSnapshot.draftPresent||items.length>0;
 priceDiffs.replaceChildren(node("strong",items.length+" cambio(s) sin guardar."));
 for(const [path,value] of items.slice(0,35)){
  const field=priceSnapshot.fields.find(x=>x.path===path);
  if(!field)continue;
  priceDiffs.append(node("p",field.category+" · "+field.label+": "+field.value+" → "+value));
 }
 if(items.length>35)priceDiffs.append(node("p","Y "+(items.length-35)+" cambios más."));
}
function priceRender(){
 priceItems.replaceChildren();
 if(!priceSnapshot){priceItems.append(node("p","Cargá las tarifas para comenzar."));return}
 const q=priceSearch.value.trim().toLowerCase();
 const filtered=priceSnapshot.fields.filter(field=>
  (q?(field.category+" "+field.label+" "+field.path).toLowerCase().includes(q):field.category===priceGroup.value));
 for(const field of filtered){
  const row=node("div","");row.className="price-line";
  const name=node("label",field.category+" · "+field.label);
  const input=document.createElement("input");
  input.type=field.kind==="boolean"?"checkbox":"number";
  if(field.kind==="boolean")input.checked=priceChanges.has(field.path)?priceChanges.get(field.path):field.value;
  else{
   input.min=field.kind==="percent"?"0":"0.01";
   input.max=field.kind==="percent"?"50":"50000000";
   input.step="0.01";
   input.value=String(priceChanges.has(field.path)?priceChanges.get(field.path):field.value);
  }
  input.addEventListener("change",()=>{
   const value=field.kind==="boolean"?input.checked:Number(input.value);
   const valid=field.kind==="boolean"||(
    Number.isFinite(value)&&
    (field.kind==="percent"?value>=0&&value<=50:value>0&&value<=50000000)&&
    Math.abs(value*100-Math.round(value*100))<0.000001);
   if(!valid){
    priceMessage.textContent="Revisá "+field.label+": solo valores positivos, hasta dos decimales.";
    input.value=String(field.value);return;
   }
   if(value===field.value)priceChanges.delete(field.path);
   else priceChanges.set(field.path,value);
   row.classList.toggle("modified",priceChanges.has(field.path));
   pricePreviewResult.textContent="Hay cambios nuevos. Volvé a ver el impacto antes de guardar.";
   priceEditSummary();
  });
  name.htmlFor="";
  const reference=node("span",String(field.value));reference.className="reference";
  row.append(name,input,reference);
  row.classList.toggle("modified",priceChanges.has(field.path));
  priceItems.append(row);
 }
 if(!filtered.length)priceItems.append(node("p","No hay precios para ese filtro."));
 priceEditSummary();
}
function priceHistoryRender(){
 priceHistory.replaceChildren();
 for(const item of priceSnapshot?.history||[]){
  const li=node("li","Revisión "+item.revision+" · "+item.action+
    " · "+item.operator+" · "+item.created_at+" · "+item.changed_count+" campo(s)");
  const btn=node("button","Preparar restauración de esta versión");
  btn.className="outline";btn.type="button";
  btn.addEventListener("click",async()=>{
   const operator=requestOperator();
   if(!operator)return;
   if(!confirm("¿Preparar revisión "+item.revision+" como borrador? No se modifica la web ni se publica nada."))return;
   try{
    btn.disabled=true;
    await apiPost("/admin/api/pricing/restore",{operator,expectedRevision:priceSnapshot.revision,restoreRevision:item.revision});
    await priceLoad();
    priceMessage.textContent="Revisión recuperada como borrador privado. Revisá antes de aprobar.";
   }catch(e){priceMessage.textContent=String(e.message||e)}
   finally{btn.disabled=false}
  });
  li.append(btn);priceHistory.append(li);
 }
 if(!priceHistory.children.length)priceHistory.append(node("li","Aún no hay versiones guardadas."));
}
async function priceLoad(){
 priceLoadButton.disabled=true;
 priceMessage.textContent="Leyendo tarifas privadas…";
 try{
  const data=await api("/admin/api/pricing");
  priceSnapshot=data;priceChanges=new Map();
  pricePreviewResult.textContent="Revisá la vista previa antes de aprobar. Aún no se modifica ningún precio comercial.";
  priceRender();priceHistoryRender();
  priceMessage.textContent="Revisión "+data.revision+" · "+
   (data.draftPresent?"Hay un borrador para revisar.":"Sin borradores.")+
   " No cambia el cotizador ni la web pública.";
 }catch(e){priceMessage.textContent="No se pudieron cargar precios: "+String(e.message||e)}
 finally{priceLoadButton.disabled=false}
}
pricePreviewButton.addEventListener("click",async()=>{
 if(!priceSnapshot)return;
 const operator=requestOperator();if(!operator)return;
 pricePreviewButton.disabled=true;
 pricePreviewResult.textContent="Calculando simulación sin modificar tarifas…";
 try{
  const before=priceSnapshot.revision;
  const result=await apiPost("/admin/api/pricing/preview",{
   operator,expectedRevision:before,
   changes:[...priceChanges.entries()].map(([path,value])=>({path,value}))
  });
  if(result.revision!==before)throw Error("La revisión cambió; volvé a cargar.");
  pricePreviewResult.replaceChildren(node("strong",
   result.edits.length+" diferencias respecto de la última versión aprobada para ensayo."));
  if(!result.edits.length)pricePreviewResult.append(node("p","No hay diferencias que afecten el tarifario."));
  for(const edit of result.edits.slice(0,30)){
   const fmt=v=>typeof v==="boolean"?(v?"Activo":"Inactivo"):String(v);
   pricePreviewResult.append(node("p",edit.category+" · "+edit.label+": "+fmt(edit.before)+" → "+fmt(edit.after)+
    (typeof edit.changePercent==="number"?" ("+(edit.changePercent>=0?"+":"")+edit.changePercent+"%)":"")));
  }
  if(result.edits.length>30)pricePreviewResult.append(node("p","Y "+(result.edits.length-30)+" diferencias más."));
  pricePreviewResult.append(node("strong","Ejemplos sin promociones ni costos adicionales"));
  for(const row of result.examples){
   pricePreviewResult.append(node("p",row.label+": $"+row.before.toLocaleString("es-AR")+" → $"+
    row.after.toLocaleString("es-AR")));
  }
  pricePreviewResult.append(node("p",result.caution));
 }catch(e){pricePreviewResult.textContent="No se pudo mostrar el impacto: "+String(e.message||e)}
 finally{pricePreviewButton.disabled=false}
});
priceLoadButton.addEventListener("click",priceLoad);
priceGroup.addEventListener("change",priceRender);
priceSearch.addEventListener("input",priceRender);
priceSaveButton.addEventListener("click",async()=>{
 if(!priceSnapshot||!priceChanges.size)return;
 const operator=requestOperator();if(!operator)return;
 priceSaveButton.disabled=true;
 try{
  await apiPost("/admin/api/pricing/draft",{operator,expectedRevision:priceSnapshot.revision,
   changes:[...priceChanges.entries()].map(([path,value])=>({path,value}))});
  await priceLoad();
  priceMessage.textContent="Borrador guardado en D1; NO publicado. Revisá las tarifas antes de aprobar para ensayo.";
 }catch(e){priceMessage.textContent=String(e.message||e);priceSaveButton.disabled=false}
});
priceApproveButton.addEventListener("click",async()=>{
 if(!priceSnapshot||!priceSnapshot.draftPresent||priceChanges.size)return;
 const operator=requestOperator();if(!operator)return;
 if(!confirm("¿Aprobar esta versión solo dentro del panel privado? NO modifica cotizador ni precios comerciales."))return;
 priceApproveButton.disabled=true;
 try{
  await apiPost("/admin/api/pricing/approve",{operator,expectedRevision:priceSnapshot.revision,confirmed:true});
  await priceLoad();
  priceMessage.textContent="Versión aprobada para ENSAYO privado. Todavía NO modifica ninguna cotización.";
 }catch(e){priceMessage.textContent=String(e.message||e);priceApproveButton.disabled=false}
});
if(typeof location!=='undefined'&&location.pathname==='/admin/precios'){
 document.body.classList.add('price-only');
 document.querySelector('#pricingPanel').open=true;
 document.title='Administración de precios | Librería Saber · Pruebas';
 document.querySelector('h1').textContent='Precios y promociones · Librería Saber';
}
document.querySelector("#openPricing").addEventListener("click",()=>{
 const panel=document.querySelector("#pricingPanel");
 panel.open=true;panel.scrollIntoView({behavior:"smooth",block:"start"});
 if(!priceSnapshot)priceLoad();
});

document.querySelector("#refresh").addEventListener("click",async()=>{
 await Promise.all([refresh(),refreshTransfers({force:true}),loadEtaAdmin()]);
});
secret.addEventListener("change",()=>{
 if(secret.value.trim()){refresh({silent:true});refreshTransfers({silent:true});loadEtaAdmin()}
});
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden&&secret.value.trim()){
  refresh({silent:true});refreshTransfers({silent:true});
 }
});
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
 // La Central exige revisión explícita: registrar el pago verificado desde el
 // webhook, sin esperar al próximo cron. Una revocación es irreversible aquí.
 const markVerified=()=>env.DB.prepare("INSERT INTO payment_reviews(order_id,state,checked_at) VALUES(?,'verified',datetime('now')) ON CONFLICT(order_id) DO UPDATE SET state=CASE WHEN payment_reviews.state='revoked' THEN 'revoked' ELSE 'verified' END,checked_at=datetime('now')").bind(order.id).run();
 if(order.status==="paid"){
  const samePayment=String(order.payment_id)===String(pay.id);
  if(samePayment)await markVerified();
  return {registered:samePayment,alreadyRegistered:true};
 }
 const res=await env.DB.prepare("UPDATE orders SET status='paid',payment_id=?,paid_at=datetime('now') WHERE id=? AND status='awaiting_payment' AND payment_id IS NULL").bind(String(pay.id),order.id).run();
 if(res.meta?.changes)await markVerified();
 return {registered:Boolean(res.meta?.changes)};
}
/**
 * Respaldo de conciliación sin intervención del mostrador.
 * Sólo se invoca tras validar HMAC y la triple pertenencia cliente/pedido/PDF.
 * La confirmación sigue dependiendo de la API autenticada de MP, nunca del navegador.
 */
async function reconcileCustomerPaymentIfDue(env,orderId){
 if(env.DOCS_SANDBOX_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY")return false;
 const current=await env.DB.prepare("SELECT status,preference_id FROM orders WHERE id=?").bind(orderId).first();
 if(current?.status!=="awaiting_payment"||!current.preference_id)return false;
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS customer_payment_rechecks (order_id TEXT PRIMARY KEY,checked_at TEXT NOT NULL)").run();
 const slot=await env.DB.prepare(
  "INSERT INTO customer_payment_rechecks(order_id,checked_at) VALUES(?,datetime('now')) "+
  "ON CONFLICT(order_id) DO UPDATE SET checked_at=excluded.checked_at "+
  "WHERE customer_payment_rechecks.checked_at<=datetime('now','-25 seconds')"
 ).bind(orderId).run();
 if(!slot.meta?.changes)return false;
 try{
  const query=new URLSearchParams({external_reference:orderId,limit:"10",sort:"date_created",criteria:"desc"});
  const search=await mp(env,"/v1/payments/search?"+query);
  for(const payment of search.results||[]){
   if(payment.status!=="approved"||String(payment.external_reference||"")!==orderId||
      !/^[0-9]{1,30}$/.test(String(payment.id||"")))continue;
   const result=await reconcilePayment(env,String(payment.id));
   if(result.registered){
    await audit(env,"client_payment_confirmed","server_verified");
    return true;
   }
  }
 }catch(error){
  // No simular un pago por error de red: sigue en espera y lo reintenta el cron.
  console.warn("Sandbox buyer payment recheck failed",String(error?.message||"unknown").slice(0,95));
  await audit(env,"client_payment_recheck_failed","provider_or_database_unavailable");
 }
 return false;
}
async function syncPendingPayments(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS reconciliation_checks(order_id TEXT PRIMARY KEY,checked_at TEXT NOT NULL)").run();
 const pending=await env.DB.prepare("SELECT id FROM orders WHERE status='awaiting_payment' AND preference_id IS NOT NULL ORDER BY COALESCE((SELECT checked_at FROM reconciliation_checks WHERE order_id=orders.id),'') ASC,created_at ASC LIMIT 20").all();
 await ensurePaymentReviews(env);
 const paid=await env.DB.prepare("SELECT id,payment_id FROM orders WHERE status='paid' AND payment_id IS NOT NULL ORDER BY COALESCE((SELECT checked_at FROM payment_reviews WHERE order_id=orders.id),'') ASC LIMIT 20").all();
 const summary={checked:0,registered:0,errors:0};
 for(const order of paid.results||[]){
  try{
   const result=await reconcilePayment(env,order.payment_id);
   if(result.registered){
    await env.DB.prepare("INSERT INTO payment_reviews(order_id,state,checked_at) VALUES(?,'verified',datetime('now')) ON CONFLICT(order_id) DO UPDATE SET state=CASE WHEN payment_reviews.state='revoked' THEN 'revoked' ELSE 'verified' END,checked_at=datetime('now')").bind(order.id).run();
   }else if(result.reason!=="payment_revoked"){
    summary.errors++;
   }
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
/**
 * Compra integral en ENSAYO PRIVADO. Solo llega por HMAC desde el Worker
 * documental; nunca expone la clave admin ni acepta precio del navegador.
 */
async function ensureBankAccreditations(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS bank_accreditations (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,amount_ars INTEGER NOT NULL CHECK(amount_ars>0),operator TEXT NOT NULL,bank_reference TEXT NOT NULL UNIQUE,recorded_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_reference_espacios_guiones ON bank_accreditations(REPLACE(bank_reference, ' ', '-'))").run();
}
async function centralApproveBankTransfer(req,env){
 if(!tokenOK(req,env))return json({error:"No autorizado"},401);
 if(env.TRANSFER_PRIVATE_ENABLED!=="PRIVATE_TEST_ONLY"||env.DOCS_SANDBOX_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({error:"Acreditación bancaria privada deshabilitada"},503);
 const origin=req.headers.get("Origin");
 if(origin&&origin!==new URL(req.url).origin)return json({error:"Origen no autorizado"},403);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
  return json({error:"Formato JSON obligatorio"},415);
 const raw=await req.text();
 if(raw.length>1200)return json({error:"Solicitud demasiado extensa"},413);
 let d;try{d=JSON.parse(raw)}catch{return json({error:"Solicitud inválida"},400)}
 if(!d||typeof d!=="object"||Array.isArray(d)||
    Object.keys(d).sort().join(",")!=="amount_ars,bank_reference,confirmed,operator,order_id"||
    !CENTRAL_UUID.test(d.order_id||"")||
    !Number.isSafeInteger(d.amount_ars)||d.amount_ars<1||d.confirmed!==true||
    typeof d.operator!=="string"||d.operator.trim().length<2||d.operator.trim().length>60||
    typeof d.bank_reference!=="string")
  return json({error:"Datos de acreditación incompletos"},400);
 const operator=d.operator.trim(),reference=d.bank_reference.trim().toUpperCase().replace(/\s+/g," ");
 if(!/^[A-Z0-9][A-Z0-9._/ -]{5,79}$/.test(reference)||/\.(?:PDF|PNG|JPE?G|WEBP)$/.test(reference))
  return json({error:"Ingresá la referencia de la operación que figura en el banco"},422);
 await centralTables(env);await ensureOrderItems(env);await ensurePaymentReviews(env);
 await ensureBankAccreditations(env);
 const order=await env.DB.prepare(
  "SELECT o.id,o.status,o.amount_ars,o.deposit_ars,o.preference_id,o.payment_id,"+
  "t.amount_ars AS transfer_amount,m.amount_ars AS document_amount,m.file_count,"+
  "(SELECT COALESCE(SUM(line_total_ars),0) FROM order_items WHERE order_id=o.id) AS items_total,"+
  "(SELECT COUNT(*) FROM order_items WHERE order_id=o.id AND sku='DOCS_VERIFIED') AS document_lines "+
  "FROM orders o JOIN transfer_requests t ON t.order_id=o.id "+
  "JOIN central_document_manifests m ON m.commercial_order_id=o.id WHERE o.id=?"
 ).bind(d.order_id).first();
 if(!order||order.status!=="awaiting_payment"||order.preference_id||order.payment_id||
    order.amount_ars!==d.amount_ars||order.deposit_ars!==order.amount_ars||
    order.transfer_amount!==order.amount_ars||order.document_amount!==order.amount_ars||
    !Number.isSafeInteger(order.file_count)||order.file_count<1||
    order.items_total!==order.amount_ars||order.document_lines!==1)
  return json({error:"Importe o estado de pedido no coincide con la transferencia pendiente"},409);
 const existing=await env.DB.prepare("SELECT state FROM payment_reviews WHERE order_id=?").bind(d.order_id).first();
 if(existing)return json({error:"El pedido ya tiene una revisión de pago"},409);
 // Transacción D1: un crédito único, cambio de pedido y revisión de pago juntos.
 let result;
 try{
  result=await env.DB.batch([
   env.DB.prepare("INSERT INTO bank_accreditations(order_id,amount_ars,operator,bank_reference) "+
    "SELECT o.id,o.amount_ars,?,? FROM orders o JOIN transfer_requests t ON t.order_id=o.id "+
    "JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
    "WHERE o.id=? AND o.status='awaiting_payment' AND o.preference_id IS NULL AND o.payment_id IS NULL "+
    "AND o.deposit_ars=o.amount_ars AND t.status='awaiting_bank_verification' "+
    "AND t.amount_ars=o.amount_ars AND m.amount_ars=o.amount_ars "+
    "AND NOT EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id)")
    .bind(operator,reference,d.order_id),
   env.DB.prepare("UPDATE orders SET status='paid',paid_at=datetime('now') "+
    "WHERE id=? AND status='awaiting_payment' AND preference_id IS NULL AND payment_id IS NULL "+
    "AND deposit_ars=amount_ars AND EXISTS(SELECT 1 FROM bank_accreditations b "+
    "WHERE b.order_id=orders.id AND b.amount_ars=orders.amount_ars)")
    .bind(d.order_id),
   env.DB.prepare("INSERT INTO payment_reviews(order_id,state,checked_at) "+
    "SELECT o.id,'verified',datetime('now') FROM orders o "+
    "JOIN bank_accreditations b ON b.order_id=o.id AND b.amount_ars=o.amount_ars "+
    "WHERE o.id=? AND o.status='paid' AND o.paid_at IS NOT NULL "+
    "AND NOT EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id)")
    .bind(d.order_id)
  ]);
 }catch(_){return json({error:"Operación bancaria ya usada o acreditación simultánea. Actualizá la bandeja."},409)}
 if(!Array.isArray(result)||result.length!==3||result.some(x=>Number(x?.meta?.changes)!==1))
  return json({error:"No se pudo completar la acreditación; revisar estado en Central"},409);
 const audit=await env.DB.prepare("SELECT operator,recorded_at FROM bank_accreditations WHERE order_id=?").bind(d.order_id).first();
 return json({ok:true,order_id:d.order_id,amount_ars:d.amount_ars,state:"pagado",
  payment_confirmed:true,operator:audit.operator,recorded_at:audit.recorded_at,production_enabled:false});
}

/** Checkout de pruebas únicamente para orden canaria exacta. Comunicación privada HMAC. */
async function centralCanarySandboxPrivate(req,env,dispatch){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({ok:false,error:signed.error},signed.status);
 if(env.DOCS_SANDBOX_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY"||
    env.CENTRAL_PREPARE_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({ok:false,error:"Sandbox documental no habilitado"},503);
 const p=signed.payload;
 if(!p||typeof p!=="object"||Array.isArray(p)||
    Object.keys(p).sort().join(",")!=="action,schema,webOrderId"||
    p.schema!=="saber-central-tus-canary-checkout-v1"||
    !["start","status"].includes(p.action)||
    !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(p.webOrderId||"")||
    env.CENTRAL_TUS_PURGE_CANARY_ORDER!==p.webOrderId)
  return json({ok:false,error:"Orden fuera de ensayo autorizado"},403);
 // La canaria 024 ya se eliminó físicamente en el ensayo 06/11/2026.
 // Prohibir nuevos Checkout: esta orden no tiene PDF y NO debe pagarse.
 if(p.action==="start")
  return json({ok:false,error:"Orden canaria 024 cerrada: el PDF sintético ya fue eliminado"},410);
 await centralTables(env);await ensurePaymentReviews(env);
 const order=await env.DB.prepare(
  "SELECT o.id,o.status,o.amount_ars,o.preference_id FROM orders o "+
  "JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
  "WHERE m.web_order_id=? AND m.file_count=1 AND m.amount_ars=o.amount_ars "+
  "AND o.deposit_ars=o.amount_ars LIMIT 1"
 ).bind(p.webOrderId).first();
 if(!order||!CENTRAL_UUID.test(order.id||"")||
    !Number.isSafeInteger(order.amount_ars)||order.amount_ars<1)
  return json({ok:false,error:"Orden documental canaria no conciliada"},409);
 if(p.action==="status"){
  if(order.status==="awaiting_payment"&&order.preference_id)
   await reconcileCustomerPaymentIfDue(env,order.id);
  const fresh=await env.DB.prepare("SELECT status FROM orders WHERE id=?").bind(order.id).first();
  const rev=await env.DB.prepare("SELECT state FROM payment_reviews WHERE order_id=?").bind(order.id).first();
  const estado=rev?.state==="revoked"?"revocado":
   fresh?.status==="paid"&&rev?.state==="verified"?"pagado":"pendiente";
  return json({ok:true,webOrderId:p.webOrderId,commercialOrderId:order.id,
   amountArs:order.amount_ars,estado},200);
 }
 if(typeof dispatch!=="function"||typeof env.DEMO_ADMIN_KEY!=="string"||
    !env.DEMO_ADMIN_KEY)
  return json({ok:false,error:"Checkout privado no disponible"},503);
 const preflight=await documentSandboxEligibility(env,order.id,true);
 if(preflight.reason)
  return json({ok:false,error:"Preflight de ensayo: "+preflight.reason},409);
 const call=await dispatch(new Request(new URL("/admin/api/central/payment-sandbox-prepare",req.url),{
  method:"POST",headers:{Authorization:"Bearer "+env.DEMO_ADMIN_KEY,
   "Content-Type":"application/json"},body:JSON.stringify({order_id:order.id})
 }));
 const raw=await call.text();
 if(raw.length>4000)return json({ok:false,error:"Respuesta de checkout demasiado grande"},502);
 let result;try{result=JSON.parse(raw)}catch{return json({ok:false,error:"Respuesta de checkout ilegible"},502)}
 if(!call.ok||result?.order_id!==order.id||typeof result?.checkout_url!=="string")
  return json({ok:false,error:String(result?.error||"Checkout Sandbox no autorizado").slice(0,140)},call.status===409?409:503);
 let url;try{url=new URL(result.checkout_url)}catch{return json({ok:false,error:"Checkout inválido"},502)}
 if(url.protocol!=="https:"||
   !/(^|\.)mercadopago\.com(\.ar)?$/.test(url.hostname)||
   url.username||url.password||url.hash)
  return json({ok:false,error:"Destino de pago inválido"},502);
 return json({ok:true,webOrderId:p.webOrderId,commercialOrderId:order.id,
  amountArs:order.amount_ars,checkoutUrl:url.href},200);
}

async function centralClientSandboxPayment(req,env,dispatch){
 const signed=await centralReadSigned(req,env);
 if(signed.error)return json({ok:false,error:signed.error},signed.status);
 if(env.DOCS_SANDBOX_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY"||
    env.CENTRAL_PREPARE_ENABLED!=="PRIVATE_TEST_ONLY")
  return json({ok:false,error:"Sandbox documental deshabilitado"},503);
 const p=signed.payload;
 if(!p||typeof p!=="object"||Array.isArray(p)||
    Object.keys(p).sort().join(",")!=="action,clientOrderId,commercialOrderId,webOrderId"||
    !["start","status","bank"].includes(p.action)||
    !CENTRAL_UUID.test(p.clientOrderId||"")||
    !CENTRAL_UUID.test(p.commercialOrderId||"")||
    !/^WEB-ENSAYO-[A-F0-9]{32}$/.test(p.webOrderId||""))
  return json({ok:false,error:"Identificación de compra incorrecta"},400);
 await centralTables(env);
 await ensureOrderItems(env);
 // Tres identidades deben coincidir en D1; conocer una orden corta no basta.
 const belongs=await env.DB.prepare(
  "SELECT o.id,o.status,o.amount_ars FROM orders o "+
  "JOIN cart_requests c ON c.order_id=o.id "+
  "JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
  "WHERE o.id=? AND c.client_order_id=? AND m.web_order_id=? LIMIT 1"
 ).bind(p.commercialOrderId,p.clientOrderId,p.webOrderId).first();
 if(!belongs)return json({ok:false,error:"La orden no corresponde a esta sesión"},403);
 if(p.action==="bank"){
  if(env.TRANSFER_PRIVATE_ENABLED!=="PRIVATE_TEST_ONLY")return json({ok:false,error:"Transferencias privadas no habilitadas"},503);
  const eligible=await documentSandboxEligibility(env,belongs.id,false);
  if(eligible.reason&&eligible.reason!=="TRANSFERENCIA_EN_PROCESO")
   return json({ok:false,error:"Pedido no apto para transferencia: "+eligible.reason},409);
  if(typeof dispatch!=="function"||!env.DEMO_ADMIN_KEY)return json({ok:false,error:"Central no disponible"},503);
  const response=await dispatch(new Request(new URL("/demo/transfer-request",req.url),{
   method:"POST",headers:{Authorization:"Bearer "+env.DEMO_ADMIN_KEY,"Content-Type":"application/json"},
   body:JSON.stringify({order_id:belongs.id})
  }));
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.order_id!==belongs.id||result.state!=="awaiting_bank_verification")
   return json({ok:false,error:String(result?.error||"Transferencia no disponible").slice(0,160)},response.status===409?409:503);
  return json({ok:true,commercialOrderId:belongs.id,estado:"transferencia_pendiente",
   alias:result.alias,amountArs:result.amount_ars,paymentAuthorized:false});
 }
 if(p.action==="status"){
  // Esta verificación es automática: el comprador nunca presiona un botón
  // administrativo. Mercado Pago se consulta solo para su propia orden D1,
  // con límite persistente de una verificación cada 25 segundos.
  if(belongs.status==="awaiting_payment")
   await reconcileCustomerPaymentIfDue(env,belongs.id);
  await ensurePaymentReviews(env);
  const fresh=await env.DB.prepare("SELECT status FROM orders WHERE id=?").bind(belongs.id).first();
  const r=await env.DB.prepare("SELECT state FROM payment_reviews WHERE order_id=?").bind(belongs.id).first();
  let transfer=null;
  if(fresh?.status==="awaiting_payment"){
   const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_requests'").first();
   if(table)transfer=await env.DB.prepare("SELECT status,amount_ars FROM transfer_requests WHERE order_id=?").bind(belongs.id).first();
  }
  const estado=r?.state==="revoked"?"revocado":
   fresh?.status==="paid"&&r?.state==="verified"?"pagado":
   transfer?.status==="awaiting_bank_verification"?"transferencia_pendiente":"pendiente";
  // Instrucciones recuperables sólo por la sesión de los tres identificadores,
  // y únicamente para transferencias pendientes; nunca confirmar el pago aquí.
  const alias=String(env.TRANSFER_ALIAS||"").trim();
  const instrucciones=estado==="transferencia_pendiente"&&
   env.TRANSFER_PRIVATE_ENABLED==="PRIVATE_TEST_ONLY"&&
   /^[A-Za-z0-9._-]{6,50}$/.test(alias)&&
   Number.isSafeInteger(transfer?.amount_ars)&&
   transfer.amount_ars===belongs.amount_ars&&transfer.amount_ars>0?
   {alias,amountArs:transfer.amount_ars}:{};
  let preparacionEstimada=null,deliveryPlan=null;
  if(estado==="pagado"&&env.CENTRAL_PRODUCTION_TRACKING_ENABLED==="PRIVATE_TEST_ONLY"){
   const estimate=await preparationEstimateDetail(env,belongs.id);
   await centralProductionTables(env);
   const stage=await env.DB.prepare("SELECT state FROM central_production_status WHERE order_id=?").bind(belongs.id).first();
   if(estimate.ready_at&&!["listo","entregado"].includes(stage?.state))
    preparacionEstimada={readyAt:estimate.ready_at,provisional:true};
   else if(!estimate.ready_at&&(!stage||["pendiente","en_preparacion"].includes(stage.state))){
    const timing=await env.DB.prepare("SELECT paid_at FROM orders WHERE id=?").bind(belongs.id).first();
    deliveryPlan=deliveryPlanForCustomer((await deliveryPlanSetting(env)).mode,
     timing?.paid_at,"pendiente");
   }
  }
  const seguimientoUrl=await trackingUrl(env,belongs.id,req.url);
  return json({ok:true,commercialOrderId:belongs.id,estado,
   ...instrucciones,...(preparacionEstimada?{preparacionEstimada}:{}),
   ...(deliveryPlan?{deliveryPlan}:{}),
   ...(seguimientoUrl?{seguimientoUrl}:{}),paymentAuthorized:estado==="pagado"});
 }
 if(typeof dispatch!=="function"||typeof env.DEMO_ADMIN_KEY!=="string"||!env.DEMO_ADMIN_KEY)
  return json({ok:false,error:"Pasarela privada no disponible"},503);
 const eligibility=await documentSandboxEligibility(env,belongs.id,true);
 if(eligibility.reason)return json({ok:false,error:"Pedido no apto para pago: "+eligibility.reason},409);
 // Reutilizar validación D1, vendedor test_user, importe, expiración e idempotencia MP.
 const result=await dispatch(new Request(new URL("/demo/checkout",req.url),{
  method:"POST",headers:{"Authorization":"Bearer "+env.DEMO_ADMIN_KEY,
   "Content-Type":"application/json"},body:JSON.stringify({order_id:belongs.id})
 }));
 const raw=await result.text();
 let checkout;try{checkout=JSON.parse(raw)}catch{return json({ok:false,error:"Respuesta de pasarela inválida"},502)}
 if(!result.ok)return json({ok:false,error:String(checkout?.error||"No se pudo preparar Mercado Pago").slice(0,160)},result.status);
 if(checkout.order_id!==belongs.id||typeof checkout.checkout_url!=="string")
  return json({ok:false,error:"Enlace de pago no coincidente"},502);
 return json({ok:true,commercialOrderId:belongs.id,checkoutUrl:checkout.checkout_url,
  estado:"pendiente"});
}

async function documentSandboxEligibility(env,orderId,allowExistingPreference=false){
  const order=await env.DB.prepare("SELECT id,amount_ars,deposit_ars,status,created_at,preference_id FROM orders WHERE id=?").bind(orderId).first();
  if(!order)return {reason:"PEDIDO_INEXISTENTE"};
  const manifest=await env.DB.prepare("SELECT amount_ars,file_count,manifest_json FROM central_document_manifests WHERE commercial_order_id=?").bind(order.id).first();
  if(!manifest)return {reason:"SIN_MANIFIESTO"};
  const lines=(await env.DB.prepare("SELECT sku,line_total_ars,quantity,unit_price_ars FROM order_items WHERE order_id=? ORDER BY line_number").bind(order.id).all()).results||[];
  let parsed=null;
  try{parsed=JSON.parse(manifest.manifest_json)}catch(_){}
  const createdAt=Date.parse(String(order.created_at||"").replace(" ","T")+"Z");
  const docs=lines.filter(x=>x.sku==="DOCS_VERIFIED");
  const total=lines.reduce((sum,x)=>sum+Number(x.line_total_ars),0);
  const reason=order.status!=="awaiting_payment"?"PEDIDO_NO_PENDIENTE":
   order.preference_id&&!allowExistingPreference?"PAGO_YA_INICIADO":
   !Number.isFinite(createdAt)||Date.now()>=createdAt+86400000?"COTIZACION_VENCIDA":
   !Number.isSafeInteger(order.amount_ars)||order.amount_ars<1||order.deposit_ars!==order.amount_ars?"PAGO_TOTAL_INVALIDO":
   !Number.isSafeInteger(manifest.amount_ars)||manifest.amount_ars<1||!Number.isSafeInteger(manifest.file_count)||manifest.file_count<1?"RECEPCION_INVALIDA":
   !parsed||parsed.schema!=="saber-central-documentos-d1-v1"||parsed.importe!==manifest.amount_ars||
    !Array.isArray(parsed.trabajos)||parsed.trabajos.length!==manifest.file_count?"MANIFIESTO_INVALIDO":
   docs.length!==1||docs[0].line_total_ars!==manifest.amount_ars?"LINEA_DOCUMENTAL_INVALIDA":
   !lines.length||lines.some(line=>!Number.isSafeInteger(line.line_total_ars)||line.line_total_ars<1||
    !Number.isSafeInteger(line.quantity)||line.quantity<1||!Number.isSafeInteger(line.unit_price_ars)||line.unit_price_ars<1)||
    total!==order.amount_ars?"IMPORTE_NO_COINCIDE":null;
  if(reason)return {reason};
  const transferTable=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_requests'").first();
  if(transferTable){
    const transfer=await env.DB.prepare("SELECT order_id FROM transfer_requests WHERE order_id=?").bind(order.id).first();
    if(transfer)return {reason:"TRANSFERENCIA_EN_PROCESO"};
  }
  return {reason:null};
}
export default {
 async scheduled(event,env,ctx){
  // LIVE: las órdenes aprobadas deben llegar a la Central sin acción del mostrador.
  // Nunca ejecutar la sincronización de pagos Sandbox con credenciales LIVE.
  if(env?.SABER_ENTORNO==='produccion'&&env?.CENTRAL_DB_ENV==='produccion'){
   ctx.waitUntil(import('./central-mp-live-rescate.mjs')
    .then(({conciliarPendientesMPLiveAutomatico})=>conciliarPendientesMPLiveAutomatico(env))
    .then(async result=>{
     // Estado técnico agregado: permite detectar si el cron dejó de ejecutarse.
     // No almacena nombres, IDs de transacción, tokens ni importes.
     try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_mp_live_auto_health (id INTEGER PRIMARY KEY CHECK(id=1),checked_at TEXT NOT NULL,checked INTEGER NOT NULL,recovered INTEGER NOT NULL,pending INTEGER NOT NULL,review INTEGER NOT NULL,errors INTEGER NOT NULL,state TEXT NOT NULL)").run();
      await env.DB.prepare("INSERT INTO central_mp_live_auto_health(id,checked_at,checked,recovered,pending,review,errors,state) VALUES(1,datetime('now'),?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,checked=excluded.checked,recovered=excluded.recovered,pending=excluded.pending,review=excluded.review,errors=excluded.errors,state=excluded.state")
       .bind(result?.revisados||0,result?.recuperados||0,result?.pendientes||0,
        result?.enRevision||0,result?.errores||0,result?.ok?'ok':
        String(result?.error||'FALLO_NO_IDENTIFICADO').replace(/[^A-Z0-9_]/gi,'').slice(0,64)).run();
     }catch{console.warn('SABER_MP_LIVE_CRON_AUDITORIA_INDISPONIBLE')}
     if(!result?.ok||result?.errores||result?.enRevision)
      console.warn('SABER_MP_LIVE_CRON_REVISION',{
       error:result?.error||null,errores:result?.errores||0,enRevision:result?.enRevision||0});
     if(result?.recuperados)console.log('SABER_MP_LIVE_CRON_ACREDITADOS',result.recuperados);
    }).catch(()=>console.warn('SABER_MP_LIVE_CRON_INDISPONIBLE')));
   // Purga LIVE de entregados: antes el RETURN impedía reintentar
   // borrados con error en el cron de producción. Independiente de MP.
   if(env.CENTRAL_LIVE_PURGE_GATE==='GO_COMERCIAL_CONFIRMADO'&&
      env.CENTRAL_LIVE_PURGE_EXECUTE_GATE==='GO_COMERCIAL_CONFIRMADO')
    ctx.waitUntil(import('./central-entrega-purga-live.mjs')
     .then(({reintentarEntregasLive})=>reintentarEntregasLive(env))
     .then(r=>{if(r?.checked)console.log('SABER_PURGA_ENTREGADOS_REINTENTOS',r.checked)})
     .catch(()=>console.warn('SABER_PURGA_ENTREGADOS_CRON_ERROR')));
   // Revisión de retención de 48h solo D1 SELECT. No confundir
   // un pedido impago con un archivo que pueda borrarse sin bloquear cobro.
   const scheduledAt=Number.isFinite(event?.scheduledTime)?
    event.scheduledTime:Date.now();
   if(new Date(scheduledAt).getUTCMinutes()===0)
    ctx.waitUntil(import('./central-retencion-abandonados-live.mjs')
    .then(({revisarRetencion48hLive})=>revisarRetencion48hLive(env))
    .then(r=>{
     if(r?.enabled&&!r.ok)console.warn('SABER_RETENCION_48H_AUDITORIA_ERROR',r.reason);
     else if(r?.unpaidFilesReview>0)
      console.warn('SABER_RETENCION_48H_REQUIERE_REVISION',r.unpaidFilesReview);
    }).catch(()=>console.warn('SABER_RETENCION_48H_CRON_ERROR')));
   // Mantener aislados los procesos Sandbox obsoletos.
   console.log('SABER_MP_LIVE_CRON_AISLADO');
   return;
  }else{
   ctx.waitUntil(runScheduledReconciliation(env).catch(e=>console.error("Scheduled payment sync failed",String(e?.message||"unknown").slice(0,120))));
  }
  ctx.waitUntil(centralProcessTUSPurgeQueue(env).catch(()=>{}));
  if(env.CENTRAL_R2_UNIVERSAL_PURGE_ENABLED==='PRIVATE_TEST_ONLY'&&
     env.CENTRAL_R2_UNIVERSAL_PURGE_EXECUTE_ENABLED==='PRIVATE_TEST_ONLY')
   ctx.waitUntil(import("./r2-universal-purge-central.mjs")
    .then(({reintentarBorradosUniversal})=>reintentarBorradosUniversal(env))
    .catch(()=>{}));
  if(env.CENTRAL_LIVE_PURGE_GATE==='GO_COMERCIAL_CONFIRMADO'&&
     env.CENTRAL_LIVE_PURGE_EXECUTE_GATE==='GO_COMERCIAL_CONFIRMADO')
   ctx.waitUntil(import('./central-entrega-purga-live.mjs')
    .then(({reintentarEntregasLive})=>reintentarEntregasLive(env))
    .catch(()=>{}));
  if(env.CENTRAL_R2_PURGE_EXECUTE_ENABLED==='PRIVATE_TEST_ONLY')
   ctx.waitUntil(import("./r2-borrado-entregado-central.mjs")
    .then(({reintentarBorradosR2})=>reintentarBorradosR2(env)).catch(()=>{}));
 },
 async fetch(req,env,ctx){
  const url=new URL(req.url);
  // Solo con compuerta LIVE y credenciales de producción independientes.
  // En saber-pagos-pruebas quedan cerradas (HTTP 503).
  if(url.pathname==='/internal/central/live/pricing'){
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   const signed=await leerFirmaInternaLive(req,env);
   if(signed.error)return json({ok:false,error:'LIVE_PRICING_FIRMA'},signed.status);
   if(env?.CENTRAL_LIVE_PRICING_GATE!=='GO_COMERCIAL_CONFIRMADO'||
      env?.CENTRAL_DB_ENV!=='produccion'||env?.SABER_ENTORNO!=='produccion'||
      !env?.DB?.prepare)return json({ok:false,error:'LIVE_PRICING_OFF'},503);
   try{
    // Solo SELECT. No crear tablas ni sembrar tarifas antiguas automáticamente.
    const head=await env.DB.prepare('SELECT approved_revision,approved_json FROM central_pricing_admin_head WHERE id=1').first();
    if(!head?.approved_json||!Number.isSafeInteger(head.approved_revision)||head.approved_revision<1)
     return json({ok:false,error:'LIVE_PRICING_NO_APPROVAL'},409);
    const approval=await env.DB.prepare("SELECT created_at FROM central_pricing_admin_history WHERE revision=? AND action='approve' LIMIT 1")
     .bind(head.approved_revision).first();
    if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(approval?.created_at||''))
     return json({ok:false,error:'LIVE_PRICING_NO_AUDIT'},409);
    const snapshot=JSON.parse(head.approved_json);
    if(!priceAdminValidatePayload(snapshot))return json({ok:false,error:'LIVE_PRICING_INVALID'},409);
    return json({ok:true,schema:'saber-price-snapshot-v1',
     approvedRevision:head.approved_revision,approvedAt:approval.created_at.replace(' ','T')+'Z',
     prices:snapshot.prices,promotions:snapshot.promotions,
     paymentAuthorized:false,commercialRelease:false,source:'production-d1-approved-only'});
   }catch{return json({ok:false,error:'LIVE_PRICING_UNAVAILABLE'},503)}
  }
  if(url.pathname==='/internal/central/live/draft'){
   const {registrarFichaUniversalD1}=await import('./r2-lote-universal-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return registrarFichaUniversalD1(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/package-manifest'||
     url.pathname==='/internal/central/live/package-file'){
   const {consultarPaqueteUniversalCentral,consultarArchivoUniversalCentral}=
    await import('./r2-universal-package-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return url.pathname.endsWith('package-manifest')?
    consultarPaqueteUniversalCentral(req,env,{readSigned:leerFirmaInternaLive}):
    consultarArchivoUniversalCentral(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/r2-staff-board'){
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   const signed=await leerFirmaInternaLive(req,env);
   if(signed?.error)return json({ok:false,error:'LIVE_BOARD_FIRMA'},signed.status||401);
   // Respaldo automático ante ausencia del webhook: no afecta la respuesta del tablero.
   // La firma HMAC ya se verificó; no hay acceso público ni nuevos cobros.
   if(env?.SABER_ENTORNO==='produccion'&&env?.CENTRAL_DB_ENV==='produccion'){
    try{
     await env.DB.prepare("CREATE TABLE IF NOT EXISTS central_mp_live_staff_rechecks (id INTEGER PRIMARY KEY CHECK(id=1),checked_at TEXT NOT NULL)").run();
     const slot=await env.DB.prepare("INSERT INTO central_mp_live_staff_rechecks(id,checked_at) VALUES(1,datetime('now')) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at WHERE central_mp_live_staff_rechecks.checked_at<=datetime('now','-40 seconds')").run();
     if(slot?.meta?.changes&&typeof ctx?.waitUntil==='function'){
      ctx.waitUntil(import('./central-mp-live-rescate.mjs')
       .then(({conciliarPendientesMPLiveAutomatico})=>conciliarPendientesMPLiveAutomatico(env))
       .then(out=>{if(out?.recuperados)console.log('SABER_MP_LIVE_STAFF_AUTO_ACREDITADOS',out.recuperados)})
       .catch(()=>console.warn('SABER_MP_LIVE_STAFF_AUTO_REVISION')));
     }
    }catch{console.warn('SABER_MP_LIVE_STAFF_AUTO_GUARDIA_INDISPONIBLE')}
   }
   const {listarRecepcionUniversalLive}=await import('./central-recepcion-live.mjs');
   return listarRecepcionUniversalLive(
    new Request('https://pagos.libreriasaber.com.ar/admin/api/central/live-recepcion'),
    env,{authorized:true,r2StaffOnly:true,staffAll:true});
  }
  if(url.pathname==='/internal/central/live/staff-calendar'){
   const {agendaCentralPersonalLive}=await import('./central-agenda-personal-live.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return agendaCentralPersonalLive(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/staff-forecast'){
   const {previsionCentralPersonalLive}=await import('./central-prevision-personal-live.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return previsionCentralPersonalLive(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/staff-status'){
   const {cambiarEstadoCentralPersonalLive}=await import('./central-estado-personal-live.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return cambiarEstadoCentralPersonalLive(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/r2-inspection-source'||
     url.pathname==='/internal/central/live/r2-inspection-confirm'){
   const {operarInspeccionR2LiveInterna}=await import('./r2-live-personal-inspection-bridge.mjs');
   return operarInspeccionR2LiveInterna(req,env);
  }
  if(url.pathname==='/internal/central/live/r2-recover'){
   const {consultarRecuperacionR2Live}=await import('./r2-universal-live-recovery-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return consultarRecuperacionR2Live(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/r2-stage'){
   const {registrarR2LivePendiente}=await import('./r2-universal-live-stage-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return registrarR2LivePendiente(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/r2-reserve'){
   const {reservarR2Live}=await import('./r2-universal-live-reserve-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return reservarR2Live(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/r2-gate'){
   const {autorizarOriginalR2Live}=await import('./r2-universal-live-gate-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return autorizarOriginalR2Live(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/tus-gate'){
   const {autorizarTUSUniversalCentral}=await import('./r2-universal-tus-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return autorizarTUSUniversalCentral(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/tus-received'){
   const {recibirTUSUniversalCentral}=await import('./r2-universal-tus-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return recibirTUSUniversalCentral(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/public/api/plazo-produccion'){
   const {plazoPublicoCentral}=await import('./plazo-produccion-informativo.mjs');
   return plazoPublicoCentral(req,env);
  }
  if(url.pathname==='/internal/central/live/order'){
   const {promoverPedidoUniversalD1}=await import('./r2-universal-order-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return promoverPedidoUniversalD1(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/diag-seller'){
   const {diagnosticarVendedorMPLive}=await import('./mercadopago-live-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return diagnosticarVendedorMPLive(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/transfer-staff-pending'||
     url.pathname==='/internal/central/live/transfer-staff-approve'){
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   const signed=await leerFirmaInternaLive(req,env);
   if(signed?.error)return json({ok:false,error:'TRANSFER_LIVE_STAFF_FIRMA'},
     signed.status||401);
   const {listarTransferenciasLiveCentral,aprobarTransferenciaLiveCentral}=
    await import('./transferencias-live-central.mjs');
   if(url.pathname.endsWith('pending')){
    const synthetic=new Request('https://pagos.libreriasaber.com.ar/admin/api/central/live-transfers/pending',
     {method:'GET'});
    return listarTransferenciasLiveCentral(synthetic,env,{authorized:true});
   }
   const p=signed.payload;
   const input={order_id:p.order_id,amount_ars:p.amount_ars,
    bank_reference:p.bank_reference,operator:p.operator,confirmed:p.confirmed};
   const synthetic=new Request('https://pagos.libreriasaber.com.ar/admin/api/central/live-transfers/approve',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(input)
   });
   return aprobarTransferenciaLiveCentral(synthetic,env,{authorized:true});
  }
  if(url.pathname==='/internal/central/live/transfer-start'||
     url.pathname==='/internal/central/live/transfer-notify'||
     url.pathname==='/internal/central/live/transfer-status'){
   const {manejarTransferenciaLiveCentral}=await import('./transferencias-live-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return manejarTransferenciaLiveCentral(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/admin/api/central/live-transfers/pending'&&req.method==='GET'){
   const {listarTransferenciasLiveCentral}=await import('./transferencias-live-central.mjs');
   return listarTransferenciasLiveCentral(req,env,{authorized:tokenOK(req,env)});
  }
  if(url.pathname==='/admin/api/central/live-transfers/approve'&&req.method==='POST'){
   const {aprobarTransferenciaLiveCentral}=await import('./transferencias-live-central.mjs');
   return aprobarTransferenciaLiveCentral(req,env,{authorized:tokenOK(req,env)});
  }
  if(url.pathname==='/internal/central/live/staff-reconcile'){
   const {rescatarPagosMPLiveCentral}=await import('./central-mp-live-rescate.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return rescatarPagosMPLiveCentral(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/internal/central/live/checkout'){
   const {checkoutMPLiveCentral}=await import('./mercadopago-live-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return checkoutMPLiveCentral(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==='/webhooks/mercadopago-live'){
   const {conciliarWebhookMPLive}=await import('./mercadopago-live-central.mjs');
   return conciliarWebhookMPLive(req,env);
  }
  if(url.pathname==='/internal/central/live/status'){
   const {estadoMPLiveCentral}=await import('./mercadopago-live-central.mjs');
   const {leerFirmaInternaLive}=await import('./central-live-bridge.mjs');
   return estadoMPLiveCentral(req,env,{readSigned:leerFirmaInternaLive});
  }
  if(url.pathname==="/demo/polaroids"&&req.method==="GET")return new Response(polaroidDemoHtml,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex,nofollow"}});
  if(url.pathname==="/demo"&&req.method==="GET")return new Response(demoHtml,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
  if((url.pathname==="/admin"||url.pathname==="/admin/precios")&&req.method==="GET")return new Response(adminHtml,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex,nofollow","x-content-type-options":"nosniff"}});
  if(url.pathname==="/health"&&req.method==="GET"){
   const configured=Boolean(env.DB&&env.MP_TEST_ACCESS_TOKEN&&env.DEMO_ADMIN_KEY&&env.MP_TEST_SELLER_ID&&env.TEST_WEBHOOK_URL&&env.MP_WEBHOOK_SECRET);
   let databaseReady=false;
   if(env.DB){try{const r=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").first();databaseReady=r?.name==="orders"}catch{}}
   return json({ok:true,environment:"test",configured,databaseReady,paymentsEnabled:false});
  }
  if(url.pathname==="/seguimiento/api/estado"&&req.method==="GET")return await trackingCustomerStatus(req,env);
  if(url.pathname==="/seguimiento"&&req.method==="GET"){
   if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY")return json({error:"Seguimiento deshabilitado"},503);
   return new Response(clientTrackingHtml,{headers:{"content-type":"text/html; charset=utf-8",
    "cache-control":"no-store, private","referrer-policy":"no-referrer","x-robots-tag":"noindex,nofollow",
    "content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'"}});
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
   // Diagnóstico privado y de sólo lectura: nunca exponer claves ni su longitud.
   const bridgeKey=env.CENTRAL_BRIDGE_KEY;
   const centralBridge={
    bridgeEnabled:env.CENTRAL_BRIDGE_ENABLED==="PRIVATE_TEST_ONLY",
    expressEnabled:env.CENTRAL_EXPRESS_ENABLED==="PRIVATE_TEST_ONLY",
    keyPresent:typeof bridgeKey==="string"&&bridgeKey.length>0,
    keyMinimumLength:typeof bridgeKey==="string"&&bridgeKey.length>=32,
    keyDifferentFromAdmin:typeof bridgeKey==="string"&&bridgeKey!==env.DEMO_ADMIN_KEY,
    keyDifferentFromWebhook:typeof bridgeKey==="string"&&bridgeKey!==env.MP_WEBHOOK_SECRET
   };
   return json({ok:missing.length===0&&table,missing,ordersTableReady:table,centralBridge});
  }
  if(!env.DB || !env.MP_TEST_ACCESS_TOKEN || !env.DEMO_ADMIN_KEY || !env.MP_TEST_SELLER_ID || !env.TEST_WEBHOOK_URL || !env.MP_WEBHOOK_SECRET)return json({error:"Falta configuración privada de pruebas. Consultar diagnóstico autorizado."},503);
  try {
   if(url.pathname==="/internal/central/polaroid-stage")return await centralPolaroidStage(req,env);
   if(url.pathname==="/internal/central/polaroid-prepare-order")return await centralPolaroidPrepareOrder(req,env);
   if(url.pathname==="/internal/central/prepare-mixed-order")return await centralPrepareMixedOrder(req,env);
   if(url.pathname==="/internal/central/stage-print-draft")return await centralStagePrintDraft(req,env);
   if(url.pathname==="/internal/central/bridge-probe")return await centralBridgeProbe(req,env);
   if(url.pathname==="/internal/central/r2-reserve"){
    const {reservarCupoR2Central}=await import("./r2-grandes-cuotas-central.mjs");
    return await reservarCupoR2Central(req,env,{readSigned:centralReadSigned});
   }
   if(url.pathname==="/internal/central/r2-reservation-lookup"){
    const {consultarReservaR2Central}=await import("./r2-reserva-consulta-central.mjs");
    return await consultarReservaR2Central(req,env,{readSigned:centralReadSigned});
   }
   if(url.pathname==="/internal/central/r2-pending-stage"){
    const {stageR2PendienteCentral}=await import("./r2-grandes-central-pendientes.mjs");
    return await stageR2PendienteCentral(req,env,{readSigned:centralReadSigned});
   }
   if(url.pathname==="/internal/central/r2-pending-lookup"){
    const {lookupR2PendienteCentral}=await import("./r2-grandes-central-pendientes.mjs");
    return await lookupR2PendienteCentral(req,env,{readSigned:centralReadSigned});
   }
   if(url.pathname==="/internal/central/r2-production-sheet"){
    const {consultarFichaR2AprobadaCentral}=await import("./r2-ficha-produccion-firmada-central.mjs");
    return await consultarFichaR2AprobadaCentral(req,env,{readSigned:centralReadSigned});
   }
   if(url.pathname==="/internal/central/r2-prepay-checkout"){
    const {checkoutR2PrepaidSandboxCentral}=await import("./r2-prepago-checkout-sandbox-central.mjs");
    return await checkoutR2PrepaidSandboxCentral(req,env,{
      readSigned:centralReadSigned,
      dispatch:async request=>this.fetch(request,env),
      reconcile:reconcileCustomerPaymentIfDue,
      trackingLink: id=>trackingUrl(env,id,req.url)
    });
   }
   if(url.pathname==="/internal/central/r2-universal-checkout"){
     const {checkoutUniversalSandboxCentral}=await import("./r2-universal-checkout-central.mjs");
     return await checkoutUniversalSandboxCentral(req,env,{
      readSigned:centralReadSigned,dispatch:async internal=>this.fetch(internal,env),
      reconcile:reconcileCustomerPaymentIfDue
     });
    }
    if(url.pathname==="/internal/central/r2-universal-package-manifest"){
     const {consultarPaqueteUniversalCentral}=await import("./r2-universal-package-central.mjs");
     return consultarPaqueteUniversalCentral(req,env,{readSigned:centralReadSigned});
    }
    if(url.pathname==="/internal/central/r2-universal-package-file"){
     const {consultarArchivoUniversalCentral}=await import("./r2-universal-package-central.mjs");
     return consultarArchivoUniversalCentral(req,env,{readSigned:centralReadSigned});
    }
    if(url.pathname==="/internal/central/r2-universal-tus-gate"){
     const {autorizarTUSUniversalCentral}=await import("./r2-universal-tus-central.mjs");
     return autorizarTUSUniversalCentral(req,env,{readSigned:centralReadSigned});
    }
    if(url.pathname==="/internal/central/r2-universal-tus-received"){
     const {recibirTUSUniversalCentral}=await import("./r2-universal-tus-central.mjs");
     return recibirTUSUniversalCentral(req,env,{readSigned:centralReadSigned});
    }
    if(url.pathname==="/internal/central/r2-universal-received"){
     const {confirmarOriginalUniversalR2}=await import("./r2-universal-recibido-central.mjs");
     return await confirmarOriginalUniversalR2(req,env,{readSigned:centralReadSigned});
    }
    if(url.pathname==="/internal/central/r2-universal-payment-lookup"){
     const {consultarPagoUniversalR2}=await import("./r2-universal-checkout-central.mjs");
     return await consultarPagoUniversalR2(req,env,{readSigned:centralReadSigned});
    }
    if(url.pathname==="/internal/central/r2-universal-order"){
     const {promoverPedidoUniversalD1}=await import("./r2-universal-order-central.mjs");
     return await promoverPedidoUniversalD1(req,env,{readSigned:centralReadSigned});
    }
    if(url.pathname==="/internal/central/r2-universal-draft"){
     const {registrarFichaUniversalD1}=await import("./r2-lote-universal-central.mjs");
     return await registrarFichaUniversalD1(req,env,{readSigned:centralReadSigned});
    }
    if(url.pathname==="/internal/central/r2-prepay-intent"){
    const {registrarIntencionR2Prepaga}=await import("./r2-prepago-intencion-central.mjs");
    if(env.CENTRAL_R2_PREPAY_DRAFT_ENABLED==="PRIVATE_TEST_ONLY")
      await ensureOrderItems(env);
    return await registrarIntencionR2Prepaga(req,env,{readSigned:centralReadSigned});
   }
   if(url.pathname==="/internal/central/r2-payment-lookup"){
    const {consultarPagoR2PreviaCarga}=await import("./r2-pago-verificado-central.mjs");
    return await consultarPagoR2PreviaCarga(req,env,{readSigned:centralReadSigned});
   }
   if(url.pathname==="/internal/central/stage")return await centralStage(req,env);
   if(url.pathname==="/internal/central/receipt-check")return await centralTUSReceiptLookup(req,env);
   if(url.pathname==="/internal/central/tus-purge-plan")return await centralTUSDeliveryPurgePlan(req,env);
   if(url.pathname==="/internal/central/tus-purge-complete")return await centralTUSPurgeComplete(req,env);
    if(url.pathname==="/internal/central/tus-package")return await centralTUSPackageManifest(req,env);
   if(url.pathname==="/internal/central/link")return await centralLink(req,env);
   if(url.pathname==="/internal/central/prepare-order")return await centralPrepareDraft(req,env);
   if(url.pathname==="/internal/central/canary-checkout")
     return await centralCanarySandboxPrivate(req,env,(internal)=>this.fetch(internal,env));
    if(url.pathname==="/internal/central/payment-sandbox-client")
    return await centralClientSandboxPayment(req,env,(internal)=>this.fetch(internal,env));
   if(url.pathname==="/internal/central/mobile-invite-redeem")return await redeemMobileInvite(req,env);
    if(url.pathname==="/internal/central/pricing-snapshot")
    return await priceAdminApprovedSnapshot(req,env);
   if(url.pathname.startsWith("/checkout/"))return await customerCheckout(req,env,this);
   // Solo un operador que conoce DEMO_ADMIN_KEY puede preparar un pedido ficticio.
   if(url.pathname==="/admin/api/cron-status"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await ensureCronHealth(env);
    const lastRun=await env.DB.prepare("SELECT started_at,finished_at,status,checked,registered,errors FROM cron_health WHERE id=1").first();
    return json({lastRun,periodMinutes:2,note:"Conciliación programada de respaldo en entorno privado; no incluye comprobaciones manuales."});
   }
   // Consulta privada y de SOLO LECTURA. Una instrucción de transferencia
   // jamás habilita fabricación ni acredita fondos por sí sola.
   if(url.pathname==="/admin/api/transfers/approve"&&req.method==="POST")return await centralApproveBankTransfer(req,env);
    if(url.pathname==="/admin/api/transfers/pending"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    if(env.TRANSFER_PRIVATE_ENABLED!=="PRIVATE_TEST_ONLY")
     return json({error:"Conciliación de transferencias no habilitada"},503);
    const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_requests'").first();
    if(!exists)return json({orders:[],payment_confirmed:false,production_enabled:false});
    await centralTables(env); // La numeración ya asignada se consulta sin crear números nuevos.
    const rows=await env.DB.prepare(
     "SELECT t.order_id,t.amount_ars,t.created_at,o.description,o.created_at AS order_created_at,n.number AS numero_orden,c.phone AS customer_phone,d.name AS customer_name,d.address AS customer_address FROM transfer_requests t JOIN orders o ON o.id=t.order_id LEFT JOIN central_work_order_numbers n ON n.commercial_order_id=t.order_id LEFT JOIN central_order_contacts c ON c.order_id=t.order_id LEFT JOIN central_order_customer_details d ON d.order_id=t.order_id WHERE t.status='awaiting_bank_verification' AND o.status='awaiting_payment' AND o.deposit_ars=o.amount_ars AND t.amount_ars=o.amount_ars ORDER BY t.created_at ASC LIMIT 100"
    ).all();
    return json({orders:rows.results||[],payment_confirmed:false,production_enabled:false});
   }
   if(url.pathname==="/admin/api/pricing-live"||
      url.pathname==="/admin/api/pricing-live/draft"||
      url.pathname==="/admin/api/pricing-live/approve"){
    const {pricingLiveAdmin}=await import('./pricing-live-admin.mjs');
    return pricingLiveAdmin(req,env,{authorized:tokenOK(req,env),
      validate:priceAdminValidatePayload});
   }
   if(url.pathname.startsWith("/admin/api/pricing"))
    return await priceAdminHandle(req,env,url.pathname);
   if(url.pathname==="/admin/api/central/production-status"&&req.method==="POST")
    return await centralUpdateProduction(req,env,ctx);
   if(url.pathname==="/admin/api/central/preparation-estimate"&&req.method==="POST")
    return await updatePreparationEstimate(req,env);
   if(url.pathname==="/admin/api/central/eta-settings")return await etaAdminApi(req,env);
   if(url.pathname==="/admin/api/central/delivery-plan")return await deliveryPlanApi(req,env);
    if(url.pathname==="/admin/api/central/eta-calendar")return await etaCalendarApi(req,env);
    if(url.pathname==="/admin/api/central/mobile-invite")return await createMobileInvite(req,env);
    if(url.pathname==="/admin/api/central/resource-capacity")return await etaResourcesApi(req,env);
    if(url.pathname==="/admin/api/central/productivity-samples")return await etaSamplesApi(req,env);
   if(url.pathname==="/admin/api/central/r2-universal-prepress-approve"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const {aprobarPreprensaUniversalCentral}=await import("./r2-universal-preprensa-central.mjs");
    return aprobarPreprensaUniversalCentral(req,env,{authorized:true});
   }
   if(url.pathname==="/admin/api/central/r2-prepress-approve"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await centralTables(env);
    const {aprobarPreprensaR2}=await import("./r2-prepago-aprobacion-central.mjs");
    return await aprobarPreprensaR2(req,env,{authorized:true});
   }
   if(url.pathname==="/admin/api/central/r2-universal-drafts"&&req.method==="GET"){
     if(!tokenOK(req,env))return json({error:"No autorizado"},401);
     const {listarFichasR2Universales}=await import("./r2-lote-universal-central.mjs");
     return await listarFichasR2Universales(req,env,{authorized:true});
    }
    if(url.pathname==="/admin/api/central/r2-paid-review"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const {listarR2PagadosRevision}=await import("./r2-prepago-revision-central.mjs");
    return await listarR2PagadosRevision(req,env,{authorized:true});
   }
   if(url.pathname==="/admin/api/central/live-r2-manifest"){
    const {manifiestoInspeccionR2Live}=await import('./r2-live-inspection-finalize.mjs');
    return manifiestoInspeccionR2Live(req,env,{authorized:tokenOK(req,env)});
   }
   if(url.pathname==="/admin/api/central/live-r2-inspection"){
    const {finalizarInspeccionR2Live}=await import('./r2-live-inspection-finalize.mjs');
    return finalizarInspeccionR2Live(req,env,{authorized:tokenOK(req,env)});
   }
   if(url.pathname==="/admin/api/central/live-recepcion"){
    const {listarRecepcionUniversalLive}=await import('./central-recepcion-live.mjs');
    return listarRecepcionUniversalLive(req,env,{authorized:tokenOK(req,env)});
   }
   if(url.pathname==="/admin/api/orders"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await ensurePaymentReviews(env);
    if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED!=="PRIVATE_TEST_ONLY"){
     const previous=await env.DB.prepare("SELECT id,description,amount_ars,status,paid_at,created_at FROM orders WHERE status='paid' AND deposit_ars=amount_ars AND EXISTS (SELECT 1 FROM payment_reviews WHERE order_id=orders.id AND state='verified') ORDER BY paid_at DESC LIMIT 100").all();
     return json({orders:previous.results});
    }
    await centralTables(env);await centralProductionTables(env);await ensurePreparationEstimates(env);
    const rows=await env.DB.prepare("SELECT o.id,o.description,o.amount_ars,o.status,o.paid_at,o.created_at,"+
     "CASE WHEN m.commercial_order_id IS NULL AND a.order_id IS NULL THEN NULL ELSE COALESCE(s.state,'pendiente') END AS production_state,"+
     "n.number AS work_number,a.receipt_id AS r2_receipt_id,"+
     "COALESCE(m.file_count,CASE WHEN a.order_id IS NOT NULL THEN 1 END) AS file_count,"+
     "COALESCE(m.web_order_id,i.web_order_id) AS web_order_id,"+
     "c.phone AS customer_phone,d.name AS customer_name,d.address AS customer_address,"+
     "COALESCE(s.version,0) AS production_version,"+
     "e.ready_at AS estimated_ready_at,COALESCE(e.version,0) AS estimated_ready_version FROM orders o "+
     "LEFT JOIN central_document_manifests m ON m.commercial_order_id=o.id "+
     "LEFT JOIN central_r2_prepress_approvals a ON a.order_id=o.id "+
     "LEFT JOIN central_r2_prepaid_intents i ON i.commercial_order_id=a.order_id "+
     "LEFT JOIN central_production_status s ON s.order_id=o.id "+
     "LEFT JOIN central_preparation_estimates e ON e.order_id=o.id "+
     "LEFT JOIN central_work_order_numbers n ON n.commercial_order_id=o.id "+
     "LEFT JOIN central_order_contacts c ON c.order_id=o.id "+
     "LEFT JOIN central_order_customer_details d ON d.order_id=o.id "+
     "WHERE o.status='paid' AND o.deposit_ars=o.amount_ars AND EXISTS ("+
     "SELECT 1 FROM payment_reviews WHERE order_id=o.id AND state='verified') "+
     "ORDER BY CASE COALESCE(s.state,'pendiente') WHEN 'en_espera' THEN 0 WHEN 'pendiente' THEN 1 "+
     "WHEN 'en_preparacion' THEN 2 WHEN 'listo' THEN 3 ELSE 4 END,o.paid_at DESC LIMIT 100").all();
    // Mostrar TODOS los R2 pagos pendientes en Nuevos, aunque falte la
    // preprensa. Solo la ficha aprobada habilita acciones de producción.
    const board=Array.isArray(rows.results)?rows.results:[];
    let r2ReviewUnavailable=false;
    if(env.CENTRAL_R2_PREPAY_DRAFT_ENABLED==="PRIVATE_TEST_ONLY"&&
       env.CENTRAL_R2_STAGING_ENABLED==="PRIVATE_TEST_ONLY"){
     try{
      const {listarR2PagadosRevision}=await import("./r2-prepago-revision-central.mjs");
      const reviewResponse=await listarR2PagadosRevision(req,env,{authorized:true});
      if(!reviewResponse.ok)throw Error("No se confirmó cola R2");
      const review=await reviewResponse.json();
      // Las órdenes pagas YA vienen en board por el SELECT general.
      // Marcarlas "duplicadas" omitía justo las R2 pendientes: quedaban
      // en Otros (production_state=null) en vez de Nuevos.
      centralMergePendingR2Orders(board,review.orders||[]);
     }catch(_){
      // No derribar el tablero TUS si falla el listado R2.
      // Exponer alerta explícita al operador sin fingir que la cola está vacía.
      r2ReviewUnavailable=true;
     }
    }
    // Mostrar en NUEVOS los pedidos universales pagados, sin ofrecer
    // preparación ni ZIP mientras no estén todos los PDF y la preprensa.
    let universalReviewUnavailable=false;
    if(env.CENTRAL_R2_UNIVERSAL_ORDER_ENABLED==="PRIVATE_TEST_ONLY"){
     try{
      const schema=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' "+
       "AND name IN ('central_r2_universal_order_links','central_r2_universal_files','central_r2_universal_drafts')").all();
      if((schema.results||[]).length!==3)throw Error("Tablas universales no disponibles");
      const approvals=new Map();
      if(env.CENTRAL_R2_UNIVERSAL_PREPRESS_ENABLED==="PRIVATE_TEST_ONLY"){
       const prepressTable=await env.DB.prepare("SELECT name FROM sqlite_master "+
        "WHERE type='table' AND name='central_r2_universal_prepress_approvals'").first();
       if(prepressTable){
        const res=await env.DB.prepare("SELECT commercial_order_id,web_order_id,"+
         "quote_hash,file_count FROM central_r2_universal_prepress_approvals").all();
        for(const row of res.results||[])approvals.set(row.commercial_order_id,row);
       }
      }
      const pending=await env.DB.prepare(
       "SELECT l.commercial_order_id,l.web_order_id,d.file_count,d.quote_hash,"+
       "SUM(CASE WHEN f.received=0 THEN 1 ELSE 0 END) AS pending_count "+
       "FROM central_r2_universal_order_links l "+
       "JOIN central_r2_universal_drafts d ON d.web_order_id=l.web_order_id "+
       "JOIN central_r2_universal_files f ON f.web_order_id=l.web_order_id "+
       "JOIN orders o ON o.id=l.commercial_order_id "+
       "WHERE o.status='paid' AND o.paid_at IS NOT NULL "+
       "AND o.deposit_ars=o.amount_ars AND o.amount_ars=l.amount_ars "+
       "AND EXISTS (SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id AND p.state='verified') "+
       "GROUP BY l.commercial_order_id,l.web_order_id,d.file_count LIMIT 100").all();
      const byId=new Map(board.map(order=>[order.id,order]));
      for(const entry of pending.results||[]){
       const card=byId.get(entry.commercial_order_id);
       if(!card)continue;
       const priorApproval=approvals.get(entry.commercial_order_id);
       const approved=entry.pending_count===0&&priorApproval?.web_order_id===entry.web_order_id&&
        priorApproval?.quote_hash===entry.quote_hash&&priorApproval?.file_count===entry.file_count;
       card.universal_pdf_pending=!approved;
       card.universal_pdf_approved=approved;
       card.universal_pdf_pending_count=entry.pending_count;
       // Sin estado de producción, la orden pagada corresponde a Nuevos,
       // incluso si la inspección/preprensa ya quedó aprobada.
       if(!card.production_state)card.production_state="pendiente";
       card.web_order_id=entry.web_order_id;
       card.file_count=entry.file_count;
      }
     }catch(_){universalReviewUnavailable=true}
    }
    return json({orders:board,r2ReviewUnavailable,universalReviewUnavailable});
   }
   // Un pedido histórico se numera SOLO al solicitar su ficha desde un
   // POST administrativo. No mutar D1 en GET ni renumerar pedidos ya asignados.
   if(url.pathname==="/admin/api/central/asignar-numero"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
     return json({error:"Formato no válido"},415);
    let p;
    try{p=await req.json()}catch{return json({error:"Cuerpo inválido"},400)}
    if(!p||Object.keys(p).join(",")!=="orderId"||!CENTRAL_UUID.test(p.orderId||""))
     return json({error:"Pedido inválido"},400);
    await centralTables(env);
    const row=await env.DB.prepare("SELECT m.commercial_order_id FROM central_document_manifests m JOIN orders o ON o.id=m.commercial_order_id WHERE m.commercial_order_id=? AND o.status='awaiting_payment' LIMIT 1").bind(p.orderId).first();
    if(!row)return json({error:"No es un pedido documental pendiente"},404);
    await env.DB.prepare("INSERT OR IGNORE INTO central_work_order_numbers(commercial_order_id) VALUES(?)").bind(p.orderId).run();
    const saved=await env.DB.prepare("SELECT number FROM central_work_order_numbers WHERE commercial_order_id=?").bind(p.orderId).first();
    if(!saved||!Number.isSafeInteger(saved.number))return json({error:"Número no confirmado"},503);
    return json({numeroOrden:shortWorkNumber(saved.number),paymentAuthorized:false,listoParaProducir:false});
   }
   if(url.pathname==="/admin/api/central/unpaid-detail"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const id=url.searchParams.get("id")||"";
    if(!CENTRAL_UUID.test(id)||url.searchParams.size!==1)
     return json({error:"Pedido inválido"},400);
    await centralTables(env);
    const order=await env.DB.prepare(
     "SELECT id,status,amount_ars FROM orders WHERE id=? AND status='awaiting_payment' LIMIT 1"
    ).bind(id).first();
    if(!order)return json({error:"Pedido pendiente no encontrado"},404);
    const documentos=await centralAdminDetail(env,id);
    if(!documentos||!Array.isArray(documentos.trabajos)||
       documentos.trabajos.length!==documentos.archivos)
     return json({error:"Archivos del pedido pendientes de verificar"},409);
    return json({documentos,paymentAuthorized:false,listoParaProducir:false});
   }
   if(url.pathname==="/admin/api/central/unpaid"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await centralTables(env);await ensurePaymentReviews(env);
    const rows=await env.DB.prepare("SELECT m.web_order_id,m.commercial_order_id,m.amount_ars AS documents_ars,m.file_count,o.amount_ars AS order_ars,o.status,o.created_at,n.number AS numero_orden FROM central_document_manifests m JOIN orders o ON o.id=m.commercial_order_id LEFT JOIN central_work_order_numbers n ON n.commercial_order_id=o.id WHERE m.commercial_order_id IS NOT NULL AND (o.status!='paid' OR EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id AND p.state='revoked')) ORDER BY o.created_at DESC LIMIT 50").all();
    return json({estado:"PEDIDOS_DOCUMENTALES_SIN_PAGO_CONFIRMADO",orders:rows.results||[],productionAuthorized:false});
   }
   if(url.pathname==="/admin/api/central/polaroid-pdf"&&req.method==="GET"){
    return await centralPolaroidDownload(req,env,url.searchParams.get("reference")||"");
   }
   if(url.pathname==="/admin/api/central/polaroids"&&req.method==="GET"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    await centralPolaroidTable(env);await ensurePaymentReviews(env);
    const rows=await env.DB.prepare("SELECT p.reference,p.photos,p.sheets,p.amount_ars,p.created_at,p.commercial_order_id,CASE WHEN o.status='paid' AND o.deposit_ars=o.amount_ars AND o.paid_at IS NOT NULL AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payment_reviews r WHERE r.order_id=o.id AND r.state='revoked') THEN 1 ELSE 0 END AS paid_confirmed FROM central_polaroids_express p LEFT JOIN orders o ON o.id=p.commercial_order_id ORDER BY p.created_at DESC LIMIT 50").all();
    return json({estado:"POLAROIDS_PDF_RECIBIDO_CON_ESTADO_PAGO",
     manifests:(rows.results||[]).map(x=>({referencia:x.reference,
      fotos:x.photos,hojas:x.sheets,importe:x.amount_ars,
      recibido:x.created_at,vinculado:Boolean(x.commercial_order_id),
      pedidoComercial:x.commercial_order_id||null,
      estadoPago:x.paid_confirmed===1?"PAGADO":"PENDIENTE"})),
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
    const order=await env.DB.prepare("SELECT id,description,amount_ars,deposit_ars,status,paid_at,created_at,payment_id,preference_id FROM orders WHERE id=? AND status='paid' AND deposit_ars=amount_ars AND EXISTS (SELECT 1 FROM payment_reviews WHERE order_id=orders.id AND state='verified')").bind(id).first();
    if(!order)return json({error:"Pedido pagado no encontrado"},404);
    await ensureOrderItems(env);
    const rows=await env.DB.prepare("SELECT line_number,item_type,sku,title,quantity,unit_price_ars,line_total_ars,detail_json,file_references_json FROM order_items WHERE order_id=? ORDER BY line_number").bind(id).all();
    const central=await centralAdminDetail(env,id);
    const produccion=estadoProduccionPrivado(order,rows.results);
    await centralTables(env);
    const r2=await env.DB.prepare("SELECT a.receipt_id,a.operator,a.approved_at,"+
     "a.measured_json,a.amount_ars,i.web_order_id "+
     "FROM central_r2_prepress_approvals a "+
     "JOIN central_r2_prepaid_intents i ON i.commercial_order_id=a.order_id "+
     "WHERE a.order_id=? LIMIT 1").bind(id).first();
    if(r2){
     produccion.r2Preprensa={recibo:r2.receipt_id,
      responsable:r2.operator,aprobadoEn:r2.approved_at,
      medidas:JSON.parse(r2.measured_json),importe:r2.amount_ars,
      webOrderId:r2.web_order_id};
     if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED==="PRIVATE_TEST_ONLY"){
      produccion.seguimiento=await centralProductionDetail(env,id);
      produccion.preparacionEstimada=await preparationEstimateDetail(env,id);
     }
    }
    if(central){
     produccion.documentosVerificados=central;
     if(env.CENTRAL_PRODUCTION_TRACKING_ENABLED==="PRIVATE_TEST_ONLY"){
       produccion.seguimiento=await centralProductionDetail(env,id);
       produccion.preparacionEstimada=await preparationEstimateDetail(env,id);
      }
    }
    const express=await centralPolaroidDetail(env,id);
    if(express){
     // El estado paid por sí solo no demuestra una transacción validada.
     express.pagoConfirmado=Boolean(order.payment_id&&order.preference_id&&order.paid_at&&
      order.status==="paid"&&order.deposit_ars===order.amount_ars);
     express.descargaHabilitada=express.descargaHabilitada&&express.pagoConfirmado;
     produccion.polaroidsExpress=express;
    }
    const existsBank=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bank_accreditations'").first();
    const bankAccreditation=existsBank?await env.DB.prepare("SELECT amount_ars,operator,bank_reference,recorded_at FROM bank_accreditations WHERE order_id=?").bind(id).first():null;
    return json({order,items:rows.results,produccion,bankAccreditation:bankAccreditation||null});
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
   // Solicitud de transferencia PRIVADA: no verifica movimientos bancarios ni
   // transforma un comprobante aportado por el comprador en un pago aprobado.
   if(url.pathname==="/demo/transfer-request"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    if(env.TRANSFER_PRIVATE_ENABLED!=="PRIVATE_TEST_ONLY")return json({error:"Transferencias todavía no disponibles"},503);
    const body=await req.json().catch(()=>null);
    if(!body||!isUUID(body.order_id))return json({error:"Pedido inválido"},400);
    const alias=String(env.TRANSFER_ALIAS||"").trim();
    if(!/^[A-Za-z0-9._-]{6,50}$/.test(alias))return json({error:"Cuenta de transferencia no configurada"},503);
    const order=await env.DB.prepare("SELECT id,amount_ars,deposit_ars,status,preference_id,created_at FROM orders WHERE id=?").bind(body.order_id).first();
    if(!order)return json({error:"Pedido inexistente"},404);
    const createdAt=Date.parse(String(order.created_at||"").replace(" ","T")+"Z");
    if(!Number.isFinite(createdAt)||Date.now()>=createdAt+24*60*60*1000)
     return json({error:"La cotización venció; prepará un nuevo pedido"},409);
    if(order.status!=="awaiting_payment"||order.preference_id||order.amount_ars!==order.deposit_ars||
       !Number.isSafeInteger(order.amount_ars)||order.amount_ars<1)
     return json({error:"Pedido incompatible o con pago iniciado"},409);
    // Un pedido con documentos verificados NO puede confirmarse para producción
    // mediante esta ruta. La solicitud sólo conserva el estado pendiente.
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS transfer_requests (order_id TEXT PRIMARY KEY REFERENCES orders(id),amount_ars INTEGER NOT NULL CHECK(amount_ars>0),status TEXT NOT NULL CHECK(status='awaiting_bank_verification'),created_at TEXT NOT NULL DEFAULT(datetime('now')))").run();
    await env.DB.prepare("INSERT OR IGNORE INTO transfer_requests(order_id,amount_ars,status) VALUES(?,?,'awaiting_bank_verification')").bind(order.id,order.amount_ars).run();
    const saved=await env.DB.prepare("SELECT amount_ars,status FROM transfer_requests WHERE order_id=?").bind(order.id).first();
    if(saved?.amount_ars!==order.amount_ars||saved.status!=="awaiting_bank_verification")
     return json({error:"La transferencia requiere revisión administrativa"},409);
    return json({order_id:order.id,amount_ars:order.amount_ars,alias,
     state:"awaiting_bank_verification",payment_confirmed:false,production_enabled:false});
   }
   // Diagnóstico SOLO lectura. No cambia D1, no reconcilia ni autoriza impresión.
   // Consulta la preferencia y los intentos registrados por Mercado Pago.
   if(url.pathname==="/admin/api/central/payment-diagnostic"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const body=await req.json().catch(()=>null);
    if(!body||Object.keys(body).join(",")!=="order_id"||!isUUID(body.order_id))
     return json({error:"Pedido inválido"},400);
    const order=await env.DB.prepare("SELECT id,amount_ars,status,preference_id FROM orders WHERE id=?").bind(body.order_id).first();
    if(!order)return json({error:"Pedido no encontrado"},404);
    if(!order.preference_id)return json({order_state:order.status,preference_registered:false,
     payment_attempts:[],payment_search_ok:true,merchant_order_search_ok:true,productionAuthorized:false});
    const pref=await mp(env,"/checkout/preferences/"+esc(order.preference_id)).catch(()=>null);
    const matchesPref=!!pref&&String(pref.id)===String(order.preference_id)&&String(pref.external_reference)===String(order.id);
    const query=new URLSearchParams({external_reference:order.id,sort:"date_created",criteria:"desc",limit:"10"});
    const [found,merchant]=await Promise.all([
     mp(env,"/v1/payments/search?"+query).catch(()=>null),
     mp(env,"/merchant_orders/search?"+new URLSearchParams({preference_id:String(order.preference_id)})).catch(()=>null)
    ]);
    const attempts=Array.isArray(found?.results)?found.results:[];
    const safeAttempts=attempts.filter(p=>String(p.external_reference||"")===String(order.id))
     .map(p=>({status:String(p.status||"unknown").slice(0,40),
      status_detail:String(p.status_detail||"unknown").slice(0,80),
      amount_matches:Number(p.transaction_amount)===Number(order.amount_ars),
      preference_matches:!p.preference_id||String(p.preference_id)===String(order.preference_id)}));
    const merchants=Array.isArray(merchant?.elements)?merchant.elements:[];
    const safeMerchants=merchants.filter(m=>String(m.preference_id||"")===String(order.preference_id))
     .map(m=>({status:String(m.status||"unknown").slice(0,40),
      payments:Array.isArray(m.payments)?m.payments.map(p=>({
       status:String(p.status||"unknown").slice(0,40),
       status_detail:String(p.status_detail||"unknown").slice(0,80)})).slice(0,10):[]}));
    return json({order_state:order.status,preference_registered:true,preference_matches:matchesPref,
     preference_expired:pref?.expiration_date_to?Date.now()>Date.parse(pref.expiration_date_to):null,
     payment_search_ok:found!==null,merchant_order_search_ok:merchant!==null,
     payment_attempts:safeAttempts,merchant_orders:safeMerchants,productionAuthorized:false});
   }
   // Preflight de pago documental: consulta D1 sin generar preferencias ni
   // tocar estados. La habilitación real del checkout permanece BLOQUEADA.
   if(["/admin/api/central/payment-preflight","/admin/api/central/payment-sandbox-prepare"].includes(url.pathname)&&req.method==="POST"){
    const sandboxPrepare=url.pathname==="/admin/api/central/payment-sandbox-prepare";
    if(sandboxPrepare&&env.DOCS_SANDBOX_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY")return json({error:"Pago documental sandbox deshabilitado"},503);
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const body=await req.json().catch(()=>null);
    if(!body||Object.keys(body).join(",")!=="order_id"||!isUUID(body.order_id))
     return json({error:"Pedido inválido"},400);
    await ensureOrderItems(env);
    await centralTables(env);
    const order=await env.DB.prepare("SELECT id,amount_ars,deposit_ars,status,created_at,preference_id FROM orders WHERE id=?").bind(body.order_id).first();
    if(!order)return json({error:"Pedido inexistente"},404);
    const manifest=await env.DB.prepare("SELECT amount_ars,file_count,manifest_json FROM central_document_manifests WHERE commercial_order_id=?").bind(order.id).first();
    if(!manifest)return json({error:"Pedido sin recepción documental verificada"},409);
    const lines=(await env.DB.prepare("SELECT sku,line_total_ars,quantity,unit_price_ars FROM order_items WHERE order_id=? ORDER BY line_number").bind(order.id).all()).results||[];
    const lineTotal=lines.reduce((sum,line)=>sum+Number(line.line_total_ars),0);
    const docs=lines.filter(line=>line.sku==="DOCS_VERIFIED");
    let parsed=null;
    try{parsed=JSON.parse(manifest.manifest_json)}catch(_){}
    const createdAt=Date.parse(String(order.created_at||"").replace(" ","T")+"Z");
    const reason=order.status!=="awaiting_payment"?"PEDIDO_NO_PENDIENTE":
     order.preference_id&&!sandboxPrepare?"PAGO_YA_INICIADO":
     !Number.isSafeInteger(createdAt)||Date.now()>=createdAt+86400000?"COTIZACION_VENCIDA":
     !Number.isSafeInteger(order.amount_ars)||order.amount_ars<1||order.deposit_ars!==order.amount_ars?"PAGO_TOTAL_INVALIDO":
     !Number.isSafeInteger(manifest.amount_ars)||manifest.amount_ars<1||!Number.isSafeInteger(manifest.file_count)||manifest.file_count<1?"RECEPCION_INVALIDA":
     !parsed||parsed.schema!=="saber-central-documentos-d1-v1"||parsed.importe!==manifest.amount_ars||
       !Array.isArray(parsed.trabajos)||parsed.trabajos.length!==manifest.file_count?"MANIFIESTO_INVALIDO":
     docs.length!==1||docs[0].line_total_ars!==manifest.amount_ars?"LINEA_DOCUMENTAL_INVALIDA":
     !lines.length||lines.some(line=>!Number.isSafeInteger(line.line_total_ars)||line.line_total_ars<1||
       !Number.isSafeInteger(line.quantity)||line.quantity<1||
       !Number.isSafeInteger(line.unit_price_ars)||line.unit_price_ars<1)||
       lineTotal!==order.amount_ars?"IMPORTE_NO_COINCIDE":null;
    if(sandboxPrepare){
     if(reason)return json({error:"Pedido no apto para pago de pruebas",reason,paymentAuthorized:false,productionAuthorized:false},409);
     const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_requests'").first();
     if(table){const transfer=await env.DB.prepare("SELECT order_id FROM transfer_requests WHERE order_id=?").bind(order.id).first();
      if(transfer)return json({error:"Pedido pendiente de transferencia; no iniciar otro pago",paymentAuthorized:false},409);}
     return await this.fetch(new Request(new URL("/demo/checkout",req.url),{method:"POST",headers:{Authorization:req.headers.get("Authorization"),"Content-Type":"application/json"},body:JSON.stringify({order_id:order.id})}),env);
    }
    return json({order_id:order.id,ready_for_sandbox_test:reason===null,
     reason:reason||"DOCUMENTOS_Y_TOTAL_VERIFICADOS",
     amount_ars:order.amount_ars,documents_ars:manifest.amount_ars,
     paymentAuthorized:false,productionAuthorized:false,
     createsMercadoPagoPreference:false});
   }
   if(url.pathname==="/demo/checkout"&&req.method==="POST"){
    if(!tokenOK(req,env))return json({error:"No autorizado"},401);
    const body=await req.json().catch(()=>null);
    const orderId=body?.order_id;
    if(!isUUID(orderId))return json({error:"order_id inválido"},400);
    const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first();
    if(!order)return json({error:"Pedido no encontrado"},404);
    // La prohibición de cobro depende de los trabajos, NO de una descripción:
    // un carrito mixto o un cambio de título nunca puede eludirla.
    await ensureOrderItems(env);
    const restricted=await env.DB.prepare("SELECT sku FROM order_items WHERE order_id=? AND sku IN ('DOCS_VERIFIED','POLAROID_EXPRESS_A4','R2_PREPAID_PLOT','PDF_UNIVERSAL_PREPAID') ORDER BY CASE WHEN sku='POLAROID_EXPRESS_A4' THEN 0 WHEN sku='R2_PREPAID_PLOT' THEN 1 ELSE 2 END LIMIT 1").bind(orderId).first();
    if(restricted?.sku==="PDF_UNIVERSAL_PREPAID"){
      const {verificarPedidoUniversalCobrable}=await import("./r2-universal-checkout-central.mjs");
      const approved=await verificarPedidoUniversalCobrable(env,order.id);
      if(!approved.ok)
       return json({error:"Pedido universal no apto para cobro Sandbox",
        reason:approved.reason},503);
     }
    if(restricted?.sku==="POLAROID_EXPRESS_A4")return json({error:"Cobro de Polaroids Express todavía deshabilitado"},503);
     if(restricted?.sku==="R2_PREPAID_PLOT"){
      if(env.CENTRAL_R2_PREPAY_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY"||
         env.DOCS_SANDBOX_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY")
       return json({error:"R2 prepago sandbox todavía deshabilitado"},503);
      const prepay=await env.DB.prepare(
       "SELECT i.amount_ars,i.state FROM central_r2_prepaid_intents i "+
       "JOIN order_items line ON line.order_id=i.commercial_order_id "+
       "WHERE i.commercial_order_id=? AND line.sku='R2_PREPAID_PLOT' "+
       "AND line.quantity=1 AND line.line_total_ars=i.amount_ars LIMIT 1"
      ).bind(orderId).first();
      if(!prepay||prepay.state!=="awaiting_upload_after_payment"||
         prepay.amount_ars!==order.amount_ars||
         order.deposit_ars!==order.amount_ars)
       return json({error:"R2 prepago no corresponde al importe registrado"},409);
     }
     if(restricted?.sku==="DOCS_VERIFIED"){
      if(env.DOCS_SANDBOX_CHECKOUT_ENABLED!=="PRIVATE_TEST_ONLY")return json({error:"Cobro de documentos deshabilitado hasta preflight privado sandbox"},503);
      // Revalidar D1 AQUÍ, incluso cuando un cliente invoque /demo/checkout
      // directamente o falsifique encabezados. Nunca confiar en un header interno.
      const verified=await documentSandboxEligibility(env,order.id,true);
      if(verified.reason)return json({error:"Pedido documental no autorizado para sandbox",reason:verified.reason},409);
     }
    if(order.description==="Librería Saber · documentos verificados y tienda"&&!restricted){
      return json({error:"Pedido documental sin renglón verificable; cobro bloqueado"},503);
     }
    if(order.description==="Librería Saber · Polaroids Express y tienda")return json({error:"Cobro de Polaroids Express aún no habilitado. Falta el ensayo integral."},503);
    // Evitar ofrecer Mercado Pago cuando el mismo pedido ya recibió instrucciones de transferencia.
    const transferTable=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_requests'").first();
    if(transferTable){
     const transfer=await env.DB.prepare("SELECT order_id FROM transfer_requests WHERE order_id=?").bind(orderId).first();
     if(transfer)return json({error:"Este pedido ya está pendiente de transferencia. No generes un segundo pago."},409);
    }
    if(order.status!=="awaiting_payment")return json({error:"El pedido ya está pago"},409);
    const expiresAt=new Date(String(order.created_at).replace(" ","T")+"Z").getTime()+24*60*60*1000;
    if(!Number.isFinite(expiresAt)||Date.now()>=expiresAt)return json({error:"La cotización venció; prepará un nuevo pedido"},409);
    if(order.deposit_ars!==order.amount_ars)return json({error:"El pedido anterior no corresponde a la modalidad de pago total"},409);
    async function returnPreference(id,reused){
     const preference=await mp(env,"/checkout/preferences/"+esc(id));
     const lines=preference.items;
     const valid=String(preference.id||"")===String(id)&&
      String(preference.external_reference||"")===order.id&&
      Array.isArray(lines)&&lines.length===1&&
      lines[0].currency_id==="ARS"&&Number(lines[0].quantity)===1&&
      Number.isSafeInteger(Number(lines[0].unit_price))&&
      Number(lines[0].unit_price)===order.amount_ars&&
      order.deposit_ars===order.amount_ars;
     if(!valid)return json({error:"Preferencia incompatible con pedido, moneda o importe en D1"},409);
     // Checkout Pro actual: prueba con init_point y vendedor test_user,
     // NUNCA con sandbox_init_point (flujo obsoleto).
     // No entregar un enlace de cobro si el token pertenece a un vendedor real.
     const seller=await mp(env,"/users/me");
     if(String(seller?.id)!==String(env.MP_TEST_SELLER_ID)||
       !Array.isArray(seller?.tags)||!seller.tags.includes("test_user")||
       String(preference.collector_id)!==String(seller.id))
      return json({error:"El vendedor de Mercado Pago no está verificado como cuenta de prueba. Pago bloqueado."},409);
     const checkoutUrl=preference.init_point;
     let safe=false;
     try{
      const u=new URL(checkoutUrl);
      safe=u.protocol==="https:"&&/(^|\.)(mercadopago\.com|mercadopago\.com\.ar)$/.test(u.hostname);
     }catch(_){}
     if(!safe)return json({error:"Mercado Pago no devolvió un enlace válido de Checkout Pro para pruebas"},502);
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
    // init_point es obligatorio para Checkout Pro; verificar vendedor test_user y URL antes de ofrecerlo.
    // Validar con la misma rutina que las preferencias recuperadas.
    return returnPreference(preference.id,false);
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
    const rows=await env.DB.prepare("SELECT id,description,amount_ars,deposit_ars,status,paid_at FROM orders WHERE status='paid' AND EXISTS (SELECT 1 FROM payment_reviews WHERE order_id=orders.id AND state='verified') ORDER BY paid_at DESC LIMIT 100").all();
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
  if(!order)return json({error:"Pedido no encontrado"},404);
  let state=review?.state==="revoked"?"review":
   order.status==="paid"?(review?.state==="verified"?"paid":"verifying_payment"):order.status;
  // Una orden con instrucciones de transferencia no debe aparecer como
  // "pendiente de tarjeta" ni permitir un segundo checkout desde el retorno.
  if(state==="awaiting_payment"){
   const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transfer_requests'").first();
   if(table){
    const transfer=await env.DB.prepare("SELECT status FROM transfer_requests WHERE order_id=?").bind(cart.order_id).first();
    if(transfer?.status==="awaiting_bank_verification")state="awaiting_bank_verification";
   }
  }
  return json({order_id:cart.order_id,total_ars:order.amount_ars,state});
 }
 let target;
 if(path==="/checkout/polaroid-proof")target="/demo/polaroid-proof";
 else if(path==="/checkout/cart-order")target="/demo/cart-order";
 else if(path==="/checkout/pay"){
  if(!cart||cart.order_id!==body.order_id)return json({error:"Pedido ajeno a esta sesión"},403);
  target="/demo/checkout";
 }else if(path==="/checkout/transfer"){
  if(!cart||cart.order_id!==body.order_id)return json({error:"Pedido ajeno a esta sesión"},403);
  if(env.TRANSFER_PRIVATE_ENABLED!=="PRIVATE_TEST_ONLY")return json({error:"Transferencias todavía no disponibles"},503);
  target="/demo/transfer-request";
 }else return json({error:"Operación desconocida"},404);
 return worker.fetch(new Request(new URL(target,req.url),{method:"POST",headers:{Authorization:"Bearer "+env.DEMO_ADMIN_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)}),env);
}
