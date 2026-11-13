/** R2 LIVE: sólo registra un original después de inspección local firmada.
 * No genera órdenes, cobra, autoriza impresión ni acepta informes del comprador.
 * El PDF de 40-200 MiB se examina fuera del Worker para no agotar su RAM.
 */
import {verificarPedidoUniversalCobrable,estadoPagoUniversal}
 from './r2-universal-checkout-central.mjs';
const GO='GO_COMERCIAL_CONFIRMADO',MIB=1048576;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const DOC=/^DOC-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const respond=(value,status=200)=>Response.json(value,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
function constantHex(a,b){
 if(!SHA.test(a||'')||!SHA.test(b||''))return false;
 let n=0;for(let i=0;i<64;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);
 return n===0;
}
function validProof(p){
 return p&&typeof p==='object'&&!Array.isArray(p)&&
  Object.keys(p).sort().join(',')===
  'bytes,commercialOrderId,fileId,issuedAt,measuredDimensions,quoteHash,receiptId,schema,sha256,webOrderId'&&
  p.schema==='saber-r2-live-inspection-proof-v1'&&
  WEB.test(p.webOrderId||'')&&FILE.test(p.fileId||'')&&
  UUID.test(p.commercialOrderId||'')&&DOC.test(p.receiptId||'')&&
  SHA.test(p.quoteHash||'')&&SHA.test(p.sha256||'')&&
  Number.isSafeInteger(p.bytes)&&p.bytes>40*MIB&&p.bytes<=200*MIB&&
  Number.isSafeInteger(p.issuedAt)&&p.issuedAt>1700000000&&
  Array.isArray(p.measuredDimensions)&&p.measuredDimensions.length>0&&
  p.measuredDimensions.length<=2000&&
  p.measuredDimensions.every((m,i)=>m&&typeof m==='object'&&
   Object.keys(m).sort().join(',')==='altoCm,anchoCm,numero'&&
   m.numero===i+1&&Number.isFinite(m.anchoCm)&&Number.isFinite(m.altoCm)&&
   m.anchoCm>0&&m.altoCm>0&&m.anchoCm<=2000&&m.altoCm<=2000);
}
export async function finalizarInspeccionR2Live(req,env,{
 authorized=false,verify=verificarPedidoUniversalCobrable,
 payment=estadoPagoUniversal,subtle=crypto.subtle,now=()=>Math.floor(Date.now()/1000)
}={}){
 const u=new URL(req.url),G=GO;
 if(u.origin!=='https://pagos.libreriasaber.com.ar'||
  u.pathname!=='/admin/api/central/live-r2-inspection'||u.search||
  req.method!=='POST')return respond({ok:false,error:'LIVE_R2_INSPECCION_RUTA'},405);
 if(!authorized)return respond({ok:false,error:'LIVE_R2_INSPECCION_OPERADOR'},401);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.MP_LIVE_GATE!==G||env?.CENTRAL_LIVE_POSTPAY_GATE!==G||
  // Confirmar inspección de un original previamente pagado no autoriza
  // nuevos cobros ni cargas R2: éstos conservan sus propios gates NO_GO.
  env?.CENTRAL_LIVE_R2_INSPECTION_GATE!==G||
  !env?.DB?.prepare||!env?.DB?.batch||
  typeof env?.CENTRAL_LIVE_R2_INSPECTION_KEY!=='string'||
  env.CENTRAL_LIVE_R2_INSPECTION_KEY.length<32||
  [env.CENTRAL_BRIDGE_KEY,env.DEMO_ADMIN_KEY,env.MP_LIVE_ACCESS_TOKEN]
   .includes(env.CENTRAL_LIVE_R2_INSPECTION_KEY))
  return respond({ok:false,error:'LIVE_R2_INSPECCION_OFF'},503);
 if(req.headers.get('Origin')!=='https://pagos.libreriasaber.com.ar'||
  !/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')||
  (req.headers.get('Sec-Fetch-Site')&&req.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return respond({ok:false,error:'LIVE_R2_INSPECCION_ORIGEN'},403);
 const raw=await req.text();
 if(raw.length>100000)return respond({ok:false,error:'LIVE_R2_INSPECCION_LIMITE'},413);
 let data;try{data=JSON.parse(raw)}catch{}
 if(!data||Object.keys(data).sort().join(',')!=='confirmed,operator,proof,signature'||
  data.confirmed!==true||typeof data.operator!=='string'||
  data.operator.trim().length<2||data.operator.trim().length>60||
  !validProof(data.proof)||!SHA.test(data.signature||''))
  return respond({ok:false,error:'LIVE_R2_INSPECCION_FORMA'},422);
 const p=data.proof;
 const age=now()-p.issuedAt;
 if(!Number.isSafeInteger(age)||age<0||age>86400)
  return respond({ok:false,error:'LIVE_R2_INSPECCION_VENCIDA'},409);
 const json=JSON.stringify(p);
 const key=await subtle.importKey('raw',new TextEncoder().encode(
  env.CENTRAL_LIVE_R2_INSPECTION_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,new TextEncoder().encode(json))));
 if(!constantHex(signature,data.signature))
  return respond({ok:false,error:'LIVE_R2_INSPECCION_FIRMA'},401);
 const reportHash=hex(new Uint8Array(await subtle.digest('SHA-256',new TextEncoder().encode(json))));
 const db=env.DB;
 let valid,paid,pending,reserve,prior;
 try{
  valid=await verify(env,p.commercialOrderId,{webOrderId:p.webOrderId,subtle});
  if(!valid?.ok||valid.link?.quote_hash!==p.quoteHash||
     valid.amountArs<1)return respond({ok:false,error:'LIVE_R2_INSPECCION_COTIZACION'},409);
  paid=await payment(env,p.commercialOrderId);
  if(!paid?.verified||paid.revoked)
   return respond({ok:false,error:'LIVE_R2_INSPECCION_PAGO'},402);
  const file=valid.rows.find(x=>x.file_id===p.fileId);
  const work=valid.works.find(x=>x.fileId===p.fileId);
  const pages=work?.configuracion?.paginas;
  if(!file||!work||file.transport!=='r2'||file.sha256!==p.sha256||
   file.bytes!==p.bytes||!Array.isArray(pages)||
   pages.length!==p.measuredDimensions.length||
   pages.some((decl,i)=>{
    const measured=p.measuredDimensions[i];
    return decl.numero!==i+1||!Number.isFinite(decl.anchoCm)||
     !Number.isFinite(decl.altoCm)||
     Math.abs(decl.anchoCm-measured.anchoCm)>0.1||
     Math.abs(decl.altoCm-measured.altoCm)>0.1;
   }))return respond({ok:false,error:'LIVE_R2_INSPECCION_GEOMETRIA'},409);
  [pending,reserve,prior]=await Promise.all([
   db.prepare('SELECT receipt_id,web_order_id,file_id,object_key,sha256,bytes,status '+
    'FROM central_r2_large_pending WHERE web_order_id=? AND file_id=?')
    .bind(p.webOrderId,p.fileId).first(),
   db.prepare('SELECT web_order_id,file_id,sha256,bytes,state FROM central_r2_large_reservations '+
    'WHERE web_order_id=? AND file_id=?').bind(p.webOrderId,p.fileId).first(),
   db.prepare('SELECT report_hash,receipt_id,sha256,bytes FROM central_r2_live_inspections '+
    'WHERE web_order_id=? AND file_id=?').bind(p.webOrderId,p.fileId).first()
  ]);
  const keyName='r2-v1/'+p.webOrderId+'/'+p.receiptId.slice(4)+'.pdf';
  if(!pending||pending.receipt_id!==p.receiptId||
   pending.web_order_id!==p.webOrderId||pending.file_id!==p.fileId||
   pending.object_key!==keyName||pending.sha256!==p.sha256||
   pending.bytes!==p.bytes||pending.status!=='awaiting_pdf_analysis'||
   !reserve||reserve.web_order_id!==p.webOrderId||
   reserve.file_id!==p.fileId||reserve.sha256!==p.sha256||
   reserve.bytes!==p.bytes||reserve.state!=='reserved')
   return respond({ok:false,error:'LIVE_R2_INSPECCION_RESERVA'},409);
  if(prior){
   if(file.received===1&&prior.report_hash===reportHash&&
    prior.receipt_id===p.receiptId&&prior.sha256===p.sha256&&prior.bytes===p.bytes)
    return respond({ok:true,saved:true,idempotent:true,productionAuthorized:false});
   return respond({ok:false,error:'LIVE_R2_INSPECCION_CONFLICTO'},409);
  }
  if(file.received!==0)return respond({ok:false,error:'LIVE_R2_INSPECCION_ESTADO'},409);
 }catch{return respond({ok:false,error:'LIVE_R2_INSPECCION_D1'},503)}
 try{
  // D1 ya concilió la cuenta. La operación final debe conservar la misma
  // prueba de pago, también cuando fue una transferencia bancaria auditada.
  if(!['transferencia','mercadopago'].includes(paid.method))
   return respond({ok:false,error:'LIVE_R2_INSPECCION_METODO'},402);
  const paymentMethodSQL=paid.method==='transferencia'?
   "AND o.payment_id IS NULL AND o.preference_id IS NULL "+
   "AND EXISTS (SELECT 1 FROM central_live_bank_accreditations b "+
   "WHERE b.order_id=o.id AND b.amount_ars=o.amount_ars "+
   "AND length(b.bank_reference)>=6 AND length(b.operator)>=2)":
   "AND o.payment_id IS NOT NULL AND o.preference_id IS NOT NULL";
  const paidSQL="EXISTS(SELECT 1 FROM central_r2_universal_order_links l "+
   "JOIN orders o ON o.id=l.commercial_order_id "+
   "JOIN payment_reviews r ON r.order_id=o.id "+
   "WHERE l.web_order_id=? AND l.commercial_order_id=? "+
   "AND o.status='paid' AND o.paid_at IS NOT NULL "+
   "AND o.amount_ars=o.deposit_ars AND r.state='verified' "+
   paymentMethodSQL+")";
  const stageSQL="EXISTS(SELECT 1 FROM central_r2_large_pending p "+
   "JOIN central_r2_large_reservations q ON q.object_key=p.object_key "+
   "WHERE p.web_order_id=? AND p.file_id=? AND p.receipt_id=? "+
   "AND p.sha256=? AND p.bytes=? AND p.status='awaiting_pdf_analysis' "+
   "AND q.state='reserved' AND q.web_order_id=p.web_order_id "+
   "AND q.file_id=p.file_id AND q.sha256=p.sha256 AND q.bytes=p.bytes)";
  const insert='INSERT INTO central_r2_live_inspections ('+
   'web_order_id,file_id,commercial_order_id,receipt_id,quote_hash,sha256,'+
   'bytes,report_hash,operator,measured_json) SELECT ?,?,?,?,?,?,?,?,?,? WHERE '+
   paidSQL+' AND '+stageSQL;
  const update='UPDATE central_r2_universal_files SET received=1 WHERE '+
   "web_order_id=? AND file_id=? AND transport='r2' AND received=0 "+
   'AND sha256=? AND bytes=? AND '+paidSQL+
   ' AND EXISTS(SELECT 1 FROM central_r2_live_inspections i WHERE '+
   'i.web_order_id=? AND i.file_id=? AND i.sha256=? AND i.bytes=? AND i.report_hash=?)';
  const writes=await db.batch([
   db.prepare(insert).bind(p.webOrderId,p.fileId,p.commercialOrderId,
    p.receiptId,p.quoteHash,p.sha256,p.bytes,reportHash,
    data.operator.trim(),JSON.stringify(p.measuredDimensions),
    p.webOrderId,p.commercialOrderId,p.webOrderId,p.fileId,
    p.receiptId,p.sha256,p.bytes),
   db.prepare(update).bind(p.webOrderId,p.fileId,p.sha256,p.bytes,
    p.webOrderId,p.commercialOrderId,p.webOrderId,p.fileId,
    p.sha256,p.bytes,reportHash)
  ]);
  if(writes?.length!==2||writes.some(r=>r?.meta?.changes!==1))
   return respond({ok:false,error:'LIVE_R2_INSPECCION_CARRERA'},409);
 }catch{return respond({ok:false,error:'LIVE_R2_INSPECCION_ESCRITURA'},503)}
 return respond({ok:true,saved:true,idempotent:false,
  webOrderId:p.webOrderId,fileId:p.fileId,originalVerified:true,
  productionAuthorized:false,prepressApproved:false,zipEnabled:false},201);
}

/** Manifiesto de preprensa generado desde D1; evita inventar medidas o precios
 * para que la estación local pueda cotejar el PDF grande.
 * No incluye token de descarga ni URL del bucket.
 */
export async function manifiestoInspeccionR2Live(req,env,{
 authorized=false,verify=verificarPedidoUniversalCobrable,
 payment=estadoPagoUniversal,subtle=crypto.subtle
}={}){
 const u=new URL(req.url);
 if(req.method!=='GET'||u.origin!=='https://pagos.libreriasaber.com.ar'||
  u.pathname!=='/admin/api/central/live-r2-manifest')
  return respond({ok:false,error:'LIVE_R2_MANIFEST_RUTA'},405);
 if(!authorized)return respond({ok:false,error:'LIVE_R2_MANIFEST_OPERADOR'},401);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.MP_LIVE_GATE!==GO||env?.CENTRAL_LIVE_POSTPAY_GATE!==GO||
  // Manifiesto de sólo lectura para personal. Exige pedido/pago D1
  // verificados y gate de inspección, NO activa checkout ni staging R2.
  env?.CENTRAL_LIVE_R2_INSPECTION_GATE!==GO||!env?.DB?.prepare)
  return respond({ok:false,error:'LIVE_R2_MANIFEST_OFF'},503);
 if([...u.searchParams.keys()].sort().join(',')!=='fileId,webOrderId')
  return respond({ok:false,error:'LIVE_R2_MANIFEST_PARAMS'},422);
 const webOrderId=u.searchParams.get('webOrderId'),fileId=u.searchParams.get('fileId');
 if(!WEB.test(webOrderId||'')||!FILE.test(fileId||''))
  return respond({ok:false,error:'LIVE_R2_MANIFEST_IDENTIDAD'},422);
 try{
  const db=env.DB;
  const link=await db.prepare(
   'SELECT commercial_order_id FROM central_r2_universal_order_links WHERE web_order_id=?'
  ).bind(webOrderId).first();
  if(!UUID.test(link?.commercial_order_id||''))
   return respond({ok:false,error:'LIVE_R2_MANIFEST_ORDEN'},404);
  const valid=await verify(env,link.commercial_order_id,{webOrderId,subtle});
  if(!valid?.ok)return respond({ok:false,error:'LIVE_R2_MANIFEST_FICHA'},409);
  const pay=await payment(env,link.commercial_order_id);
  if(!pay?.verified||pay.revoked)
   return respond({ok:false,error:'LIVE_R2_MANIFEST_PAGO'},402);
  const row=valid.rows.find(x=>x.file_id===fileId);
  const work=valid.works.find(x=>x.fileId===fileId);
  const pages=work?.configuracion?.paginas;
  if(!row||!work||row.transport!=='r2'||row.received!==0||
    !Array.isArray(pages)||!pages.length||pages.length>2000||
    pages.some((p,i)=>p.numero!==i+1||
      !Number.isFinite(p.anchoCm)||!Number.isFinite(p.altoCm)||
      !['cad','poster','sin-clasificar'].includes(p.modo)))
   return respond({ok:false,error:'LIVE_R2_MANIFEST_ARCHIVO'},409);
  const stage=await db.prepare(
   'SELECT receipt_id,sha256,bytes,status FROM central_r2_large_pending '+
   'WHERE web_order_id=? AND file_id=?'
  ).bind(webOrderId,fileId).first();
  if(!stage||!DOC.test(stage.receipt_id||'')||
   stage.sha256!==row.sha256||stage.bytes!==row.bytes||
   stage.status!=='awaiting_pdf_analysis')
   return respond({ok:false,error:'LIVE_R2_MANIFEST_STAGE'},409);
  return respond({ok:true,manifest:{
   schema:'saber-r2-live-inspection-manifest-v1',
   webOrderId,commercialOrderId:link.commercial_order_id,
   fileId,receiptId:stage.receipt_id,
   expectedSha256:row.sha256,expectedBytes:row.bytes,
   paginasDeclaradas:pages.map(x=>({numero:x.numero,
    anchoCm:x.anchoCm,altoCm:x.altoCm,modo:x.modo})),
   formatoFinal:work.formatoFinal||'original',
   quoteHash:valid.link.quote_hash,amountArs:valid.amountArs,
   quoteSnapshot:null,productionAuthorized:false
  },downloadAuthorized:false,productionAuthorized:false});
 }catch{return respond({ok:false,error:'LIVE_R2_MANIFEST_D1'},503)}
}
