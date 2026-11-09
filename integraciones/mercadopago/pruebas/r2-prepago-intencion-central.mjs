/**
 * Registra UNA intención de compra sin recibir bytes PDF.
 * Exclusivamente interna, firmada entre Workers; saldo de R2 = 0 hasta pago.
 * El servidor Documentos debe cotizar con precios D1 aprobados antes de firmar.
 * La geometría/clase aún es declarada por el cliente; se revalida después.
 */
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const MIB=1024*1024;
const response=(data,status=200)=>Response.json(data,{status,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'
}});
const TABLE=[
 'CREATE TABLE IF NOT EXISTS central_r2_prepaid_intents (',
 'web_order_id TEXT NOT NULL,',
 'file_id TEXT NOT NULL,',
 'sha256 TEXT NOT NULL CHECK(length(sha256)=64),',
 'bytes INTEGER NOT NULL CHECK(bytes>41943040 AND bytes<=209715200),',
 'amount_ars INTEGER NOT NULL CHECK(amount_ars>0 AND amount_ars<=50000000),',
 'declared_pages INTEGER NOT NULL CHECK(declared_pages BETWEEN 1 AND 2000),',
 'quote_sha256 TEXT NOT NULL CHECK(length(quote_sha256)=64),',
 'quote_revision TEXT NOT NULL,',
 'commercial_order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,',
 "state TEXT NOT NULL DEFAULT 'awaiting_upload_after_payment'",
 " CHECK(state IN ('awaiting_upload_after_payment','under_review','uploaded_verified','cancelled','delivered')),",
 "created_at TEXT NOT NULL DEFAULT(datetime('now')),",
 'PRIMARY KEY(web_order_id,file_id))'
].join(' ');
export function validarIntencionR2Prepaga(x){
 const oldKeys='amountArs,bytes,declaredPages,fileId,quoteRevision,quoteSha256,schema,sha256,webOrderId';
 const newKeys='amountArs,bytes,declaredPages,fileId,quoteRevision,quoteSha256,quoteSnapshot,schema,sha256,webOrderId';
 const keys=x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).sort().join(','):'';
 const v1=x?.schema==='saber-central-r2-prepaid-intent-v1'&&keys===oldKeys;
 const v2=x?.schema==='saber-central-r2-prepaid-intent-v2'&&keys===newKeys;
 const q=x?.quoteSnapshot;
 const validQuote=v1||(
  q&&typeof q==='object'&&!Array.isArray(q)&&
  Object.keys(q).sort().join(',')===
   'copias,importeArs,modoImpresion,nombre,paginas,papelPoster,rolloBase,schema,seleccion'&&
  q.schema==='saber-r2-cotizacion-firmada-v1'&&
  typeof q.nombre==='string'&&q.nombre.length>0&&q.nombre.length<=160&&
  q.seleccion==='original'&&['bn','color'].includes(q.modoImpresion)&&
  Number.isSafeInteger(q.copias)&&q.copias>=1&&q.copias<=500&&
  ['obra80','recubierto'].includes(q.papelPoster)&&
  /^rollo\d+$/.test(q.rolloBase||'')&&q.importeArs===x.amountArs&&
  Array.isArray(q.paginas)&&q.paginas.length===x.declaredPages&&
  q.paginas.every(p=>Array.isArray(p)&&p.length===5&&
   Number.isFinite(p[0])&&p[0]>0&&p[0]<=2000&&
   Number.isFinite(p[1])&&p[1]>0&&p[1]<=2000&&
   ['cad','poster'].includes(p[2])&&/^(rollo|rec)\d+$/.test(p[3]||'')&&
   ['obra80','recubierto'].includes(p[4])&&
   (p[2]==='cad'?p[4]==='obra80':true))
 );
 if(!x||typeof x!=='object'||Array.isArray(x)||
  !(v1||v2)||!validQuote||
  !WEB.test(x.webOrderId||'')||!FILE.test(x.fileId||'')||
  !SHA.test(x.sha256||'')||!SHA.test(x.quoteSha256||'')||
  !Number.isSafeInteger(x.bytes)||x.bytes<=40*MIB||x.bytes>200*MIB||
  !Number.isSafeInteger(x.declaredPages)||x.declaredPages<1||
  x.declaredPages>2000||
  !Number.isSafeInteger(x.amountArs)||x.amountArs<1||x.amountArs>50000000||
  typeof x.quoteRevision!=='string'||!/^d1-approved-revision-[1-9]\d{0,7}$/.test(x.quoteRevision))
  throw Error('R2_PREPAGO_INTENCION_INVALIDA');
 return x;
}
function v2Quote(p){
 return p.schema==='saber-central-r2-prepaid-intent-v2'?p.quoteSnapshot:null;
}
export async function registrarIntencionR2Prepaga(req,env,{
 readSigned,uuid=()=>crypto.randomUUID()
}={}){
 if(env?.CENTRAL_R2_PREPAY_DRAFT_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env?.DB?.prepare!=='function')
  return response({ok:false,error:'R2_PREPAGO_BORRADOR_APAGADO'},503);
 if(typeof readSigned!=='function')
  return response({ok:false,error:'R2_PREPAGO_HMAC_NO_DISPONIBLE'},503);
 const signed=await readSigned(req,env);
 if(signed?.error)return response({ok:false,error:'R2_PREPAGO_FIRMA_INVALIDA'},
  signed.status||401);
 let p;try{p=validarIntencionR2Prepaga(signed.payload)}
 catch{return response({ok:false,error:'R2_PREPAGO_DATOS_INVALIDOS'},422)}
 const db=env.DB;
 await db.prepare(TABLE).run();
 const lookup=()=>db.prepare(
  'SELECT i.web_order_id,i.file_id,i.sha256,i.bytes,i.amount_ars,'+
  'i.declared_pages,i.quote_sha256,i.quote_revision,i.commercial_order_id,'+
  'i.state,o.status AS order_status '+
  'FROM central_r2_prepaid_intents i JOIN orders o ON o.id=i.commercial_order_id '+
  'WHERE i.web_order_id=? AND i.file_id=? LIMIT 1'
 ).bind(p.webOrderId,p.fileId).first();
 const existing=await lookup();
 const matched=r=>r&&r.sha256===p.sha256&&r.bytes===p.bytes&&
  r.amount_ars===p.amountArs&&r.declared_pages===p.declaredPages&&
  r.quote_sha256===p.quoteSha256&&r.quote_revision===p.quoteRevision&&
  r.state==='awaiting_upload_after_payment';
 if(existing)return matched(existing)?
  response({ok:true,webOrderId:p.webOrderId,commercialOrderId:existing.commercial_order_id,
   amountArs:p.amountArs,idempotent:true,filesUploaded:false,paymentAuthorized:false}):
  response({ok:false,error:'R2_PREPAGO_CONFLICTO_INMUTABLE'},409);
 const id=uuid();
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))
  return response({ok:false,error:'R2_PREPAGO_ID_NO_VALIDO'},503);
 try{
  // DB.batch: transacción atómica. No crear órdenes huérfanas.
  await db.batch([
   db.prepare('INSERT INTO orders(id,description,amount_ars,deposit_ars) VALUES(?,?,?,?)')
    .bind(id,'Librería Saber · ploteo grande pendiente de archivo',p.amountArs,p.amountArs),
   db.prepare('INSERT INTO central_r2_prepaid_intents('+
    'web_order_id,file_id,sha256,bytes,amount_ars,declared_pages,'+
    'quote_sha256,quote_revision,commercial_order_id) '+
    'VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(p.webOrderId,p.fileId,p.sha256,p.bytes,p.amountArs,
     p.declaredPages,p.quoteSha256,p.quoteRevision,id),
   // SKU restringido: impide que /demo/checkout trate la orden como
   // carrito común; siempre exigirá la intención prearchivo.
   db.prepare('INSERT INTO order_items('+
    'order_id,line_number,item_type,sku,title,quantity,unit_price_ars,'+
    'line_total_ars,detail_json,file_references_json) '+
    'VALUES(?,1,\'print\',\'R2_PREPAID_PLOT\',?,1,?,?,?,\'[]\')')
    .bind(id,'Ploteo grande · presupuesto sujeto a verificación',
     p.amountArs,p.amountArs,JSON.stringify({
      schema:p.schema,webOrderId:p.webOrderId,fileId:p.fileId,
      sha256:p.sha256,bytes:p.bytes,declaredPages:p.declaredPages,
      quoteSha256:p.quoteSha256,quoteRevision:p.quoteRevision,
      requiresUploadAfterPayment:true,
      requiresReviewOnQuoteMismatch:true,
      // v1 histórico no tiene ficha y permanece siempre en revisión.
      quoteSnapshot:v2Quote(p)}))
  ]);
 }catch{
  // Una pestaña pudo registrar la misma intención concurrentemente.
  const prior=await lookup().catch(()=>null);
  return matched(prior)?
   response({ok:true,webOrderId:p.webOrderId,commercialOrderId:prior.commercial_order_id,
    amountArs:p.amountArs,idempotent:true,filesUploaded:false,paymentAuthorized:false}):
   response({ok:false,error:'R2_PREPAGO_NO_REGISTRADO'},409);
 }
 return response({ok:true,webOrderId:p.webOrderId,commercialOrderId:id,
  amountArs:p.amountArs,idempotent:false,filesUploaded:false,
  paymentAuthorized:false,uploadAuthorized:false},201);
}
