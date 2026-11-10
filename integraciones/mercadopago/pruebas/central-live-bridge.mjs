/**
 * Receptor HMAC EXCLUSIVO para la Central LIVE. No abre acceso a rutas de ensayo.
 * Validación criptográfica antes de consultar MP o escribir la D1.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const GATE='GO_COMERCIAL_CONFIRMADO';
const routeSchema=new Map([
 ['/internal/central/live/checkout','saber-mp-live-checkout-v1'],
 ['/internal/central/live/status','saber-mp-live-status-v1'],
 ['/internal/central/live/order','saber-central-r2-universal-create-order-v1'],
 ['/internal/central/live/pricing','saber-price-snapshot-live-v1'],
 ['/internal/central/live/draft','saber-r2-universal-draft-v1'],
 ['/internal/central/live/tus-gate','saber-central-r2-universal-tus-gate-v1'],
 ['/internal/central/live/tus-received','saber-central-r2-universal-tus-received-v1'],
 ['/internal/central/live/r2-gate','saber-central-r2-universal-live-gate-v1'],
 ['/internal/central/live/r2-reserve','saber-central-r2-universal-live-reserve-v1'],
 ['/internal/central/live/r2-stage','saber-central-r2-grande-pendiente-v1']
]);
export async function leerFirmaInternaLive(request,env,{
 now=()=>Math.floor(Date.now()/1000),subtle=crypto.subtle
}={}){
 if(env?.SABER_ENTORNO!=='produccion'||
    env?.CENTRAL_DB_ENV!=='produccion'||
    env?.MP_LIVE_GATE!==GATE||
    env?.CENTRAL_LIVE_BRIDGE_ENABLED!==GATE||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||
    env.CENTRAL_BRIDGE_KEY.length<32||
    [env.MP_LIVE_WEBHOOK_SECRET,env.MP_LIVE_ACCESS_TOKEN,
     env.MP_WEBHOOK_SECRET,env.MP_TEST_ACCESS_TOKEN,
     env.DEMO_ADMIN_KEY].some(k=>typeof k==='string'&&k===env.CENTRAL_BRIDGE_KEY))
   return {error:'Firma LIVE no habilitada',status:503};
 const url=new URL(request.url);
 const expectedSchema=routeSchema.get(url.pathname);
 if(!expectedSchema||url.hostname!=='pagos.libreriasaber.com.ar'||
    url.protocol!=='https:'||url.port||url.search||
    request.method!=='POST'||request.headers.has('Origin')||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
   return {error:'Solicitud interna LIVE inválida',status:403};
 const ts=request.headers.get('x-saber-ts')||'';
 const id=request.headers.get('x-saber-request-id')||'';
 const signature=request.headers.get('x-saber-signature')||'';
 const time=now();
 if(!/^\d{10}$/.test(ts)||!UUID.test(id)||!/^[a-f0-9]{64}$/.test(signature)||
    !Number.isSafeInteger(time)||Math.abs(time-Number(ts))>300)
   return {error:'Identidad o fecha LIVE inválida',status:401};
 const raw=await request.text();
 const draftRoute=url.pathname==='/internal/central/live/draft';
 const tusReceipt=url.pathname==='/internal/central/live/tus-received';
 const tusGate=url.pathname==='/internal/central/live/tus-gate';
 const r2Gate=url.pathname==='/internal/central/live/r2-gate';
 const r2Reserve=url.pathname==='/internal/central/live/r2-reserve';
 const r2Stage=url.pathname==='/internal/central/live/r2-stage';
 if(raw.length<40||raw.length>(draftRoute?512000:tusReceipt?140000:2000))
   return {error:'Tamaño LIVE inválido',status:413};
 let payload;try{payload=JSON.parse(raw)}catch{}
 const orderRoute=url.pathname==='/internal/central/live/order';
 const pricingRoute=url.pathname==='/internal/central/live/pricing';
 const keys=r2Stage?'bytes,contenidoPdfVerificado,etag,fileId,listoParaProducir,name,objectKey,orderId,pagesDeclaradas,paymentAuthorized,receiptId,registeredInD1,schema,sha256,sha256Verificado':
  r2Reserve?'bytes,fileId,name,objectKey,orderId,pages,schema,sha256':
  r2Gate?'bytes,fileId,name,orderId,pages,schema,sha256':
  tusGate?'action,bytes,fileId,name,orderId,pages,schema,sha256':
  tusReceipt?'bytes,fileId,metrics,name,objectName,orderId,pages,receiptId,schema,sha256':
  draftRoute?'archivos,armados,estado,pagoAutorizado,priceRevision,produccionAutorizada,quoteHash,schema,subidaAutorizada,totalArs,webOrderId':
  pricingRoute?'purpose,schema':orderRoute?'draftId,quoteHash,schema,telefono,webOrderId':
  'commercialOrderId,schema,webOrderId';
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    Object.keys(payload).sort().join(',')!==keys||
    payload.schema!==expectedSchema||
    (r2Stage?(!WEB.test(payload.orderId||'')||
       typeof payload.fileId!=='string'||payload.fileId.length<1||
       !/^[A-Za-z0-9_-]{1,80}$/.test(payload.fileId)||
       !/^[a-f0-9]{64}$/.test(payload.sha256||'')||
       !Number.isSafeInteger(payload.bytes)||payload.bytes<=40*1048576||
       payload.bytes>200*1048576||
       payload.sha256Verificado!==true||payload.contenidoPdfVerificado!==false||
       payload.registeredInD1!==false||payload.paymentAuthorized!==false||
       payload.listoParaProducir!==false):
     r2Reserve?(!WEB.test(payload.orderId||'')||
       !/^[A-Za-z0-9_-]{1,80}$/.test(payload.fileId||'')||
       !/^[a-f0-9]{64}$/.test(payload.sha256||'')||
       typeof payload.name!=='string'||payload.name.length<1||payload.name.length>120||
       !payload.name.toLowerCase().endsWith('.pdf')||
       !Number.isSafeInteger(payload.bytes)||payload.bytes<=40*1048576||
       payload.bytes>200*1048576||
       !Number.isSafeInteger(payload.pages)||payload.pages<1||payload.pages>2000||
       typeof payload.objectKey!=='string'||
       !payload.objectKey.startsWith('r2-v1/'+payload.orderId+'/')||
       !/^r2-v1\/WEB-ENSAYO-[A-F0-9]{32}\/[a-f0-9-]{36}[.]pdf$/i.test(payload.objectKey)):
     r2Gate?(!WEB.test(payload.orderId||'')||
       !/^[A-Za-z0-9_-]{1,80}$/.test(payload.fileId||'')||
       !/^[a-f0-9]{64}$/.test(payload.sha256||'')||
       typeof payload.name!=='string'||payload.name.length<1||payload.name.length>120||
       !payload.name.toLowerCase().endsWith('.pdf')||
       !Number.isSafeInteger(payload.bytes)||payload.bytes<=40*1048576||
       payload.bytes>200*1048576||
       !Number.isSafeInteger(payload.pages)||payload.pages<1||payload.pages>2000):
     tusGate?(!['start','finish'].includes(payload.action)||!WEB.test(payload.orderId||'')||
       !/^[A-Za-z0-9_-]{1,80}$/.test(payload.fileId||'')||
       !/^[a-f0-9]{64}$/.test(payload.sha256||'')||
       typeof payload.name!=='string'||payload.name.length<1||payload.name.length>120||
       !/\.pdf$/i.test(payload.name)||
       !Number.isSafeInteger(payload.bytes)||payload.bytes<5||payload.bytes>40*1048576||
       !Number.isSafeInteger(payload.pages)||payload.pages<1||payload.pages>2000):
     tusReceipt?(!WEB.test(payload.orderId||'')||
       !/^[A-Za-z0-9_-]{1,80}$/.test(payload.fileId||'')||
       !/^[a-f0-9]{64}$/.test(payload.sha256||'')||
       typeof payload.name!=='string'||payload.name.length<1||payload.name.length>120||
       !/\.pdf$/i.test(payload.name)||
       !Number.isSafeInteger(payload.bytes)||payload.bytes<5||payload.bytes>40*1048576||
       !Number.isSafeInteger(payload.pages)||payload.pages<1||payload.pages>2000||
       !Array.isArray(payload.metrics)||payload.metrics.length!==payload.pages||
       payload.metrics.some(m=>!m||!Number.isFinite(m.anchoCm)||!Number.isFinite(m.altoCm)||
          m.modo!=='sin-clasificar')||
       typeof payload.receiptId!=='string'||!/^DOC-[a-f0-9-]{36}$/i.test(payload.receiptId)||
       typeof payload.objectName!=='string'||payload.objectName.length>150):
     draftRoute?!/^[a-f0-9]{64}$/.test(payload.quoteHash||'')||
       !/^d1-approved-revision-[1-9]\d{0,7}$/.test(payload.priceRevision||'')||
       payload.pagoAutorizado!==false||payload.subidaAutorizada!==false||
       payload.produccionAutorizada!==false||
       payload.estado!=='PRELIMINAR_SIN_ORIGINALES':
     pricingRoute?payload.purpose!=='quote-production-approved':
     orderRoute?!UUID.test(payload.draftId||'')||
      !/^[a-f0-9]{64}$/.test(payload.quoteHash||'')||
      typeof payload.telefono!=='string'||
      !/^\+?[0-9 ()-]{10,26}$/.test(payload.telefono)||
      payload.telefono.replace(/\D/g,'').length<10||
      payload.telefono.replace(/\D/g,'').length>15:
      !UUID.test(payload.commercialOrderId||''))||
    (!pricingRoute&&!tusGate&&!tusReceipt&&!r2Gate&&!r2Reserve&&!r2Stage&&!WEB.test(payload.webOrderId||'')))
   return {error:'Orden LIVE inválida',status:422};
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['verify']);
 const data=new TextEncoder().encode(ts+'\n'+id+'\n'+raw);
 const signed=Uint8Array.from(signature.match(/../g).map(x=>parseInt(x,16)));
 if(!await subtle.verify('HMAC',key,signed,data))
   return {error:'Firma LIVE incorrecta',status:401};
 return {requestId:id,raw,payload};
}
