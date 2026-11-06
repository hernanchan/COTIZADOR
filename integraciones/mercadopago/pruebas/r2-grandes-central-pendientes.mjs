/**
 * R2 grandes, recepción PRELIMINAR en D1 — sin orden comercial, sin precio.
 * Este registro no constituye un pedido: faltan PDF parseado por servidor,
 * presupuesto recotizado y confirmación del comprador.
 * Únicamente recibe un Worker documental autenticado mediante HMAC central.
 */
const ORDER=/^WEB-[A-Za-z0-9_-]{5,80}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const DOC=/^DOC-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const KEY=/^r2-v1\/(WEB-[A-Za-z0-9_-]{5,80})\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.pdf$/i;
const LIMIT=256*1024*1024;
const MIN=40*1024*1024;
function shape(obj,fields){
 return obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join(',')===fields.slice().sort().join(',');
}
export function validarPreRecepcionR2(p){
 if(!shape(p,['schema','orderId','fileId','receiptId','name','bytes',
  'sha256','objectKey','etag','pagesDeclaradas','sha256Verificado',
  'contenidoPdfVerificado','registeredInD1','paymentAuthorized','listoParaProducir'])||
  p.schema!=='saber-central-r2-grande-pendiente-v1'||
  !ORDER.test(p.orderId||'')||!FILE.test(p.fileId||'')||
  !DOC.test(p.receiptId||'')||
  typeof p.name!=='string'||p.name.length<1||p.name.length>120||
  !/\.pdf$/i.test(p.name)||
  !Number.isSafeInteger(p.bytes)||p.bytes<=MIN||p.bytes>LIMIT||
  !SHA.test(p.sha256||'')||
  !Number.isSafeInteger(p.pagesDeclaradas)||p.pagesDeclaradas<1||p.pagesDeclaradas>2000||
  typeof p.etag!=='string'||!/^[a-zA-Z0-9:"_-]{8,256}$/.test(p.etag)||
  p.sha256Verificado!==true||p.contenidoPdfVerificado!==false||
  p.registeredInD1!==false||p.paymentAuthorized!==false||
  p.listoParaProducir!==false)
  throw Error('R2_MANIFIESTO_NO_VALIDO');
 const match=KEY.exec(p.objectKey||'');
 if(!match||match[1]!==p.orderId||
  ('DOC-'+match[2]).toLowerCase()!==p.receiptId.toLowerCase())
  throw Error('R2_OBJETO_AJENO_A_LA_ORDEN');
 // La identidad surge del objectKey aleatorio ligado al recibo del Worker.
 return Object.freeze({...p,etag:p.etag.replaceAll('"','')});
}
const response=(obj,status=200)=>new Response(JSON.stringify(obj),{status,
 headers:{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function stageR2PendienteCentral(request,env,{readSigned}={}){
 if(env?.CENTRAL_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY')
  return response({ok:false,error:'Etapa R2 no habilitada',paymentAuthorized:false},503);
 if(typeof readSigned!=='function'||!env?.DB?.prepare)
  return response({ok:false,error:'Etapa privada no configurada',paymentAuthorized:false},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return response({ok:false,error:'Firma inválida',paymentAuthorized:false},signed.status||401);
 let p;
 try{p=validarPreRecepcionR2(signed.payload)}
 catch{return response({ok:false,error:'PDF grande sin comprobante íntegro',paymentAuthorized:false},422)}
 // Jamás insertar en central_document_manifests, orders o pagos.
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS central_r2_large_pending ('+
  'receipt_id TEXT PRIMARY KEY,web_order_id TEXT NOT NULL,file_id TEXT NOT NULL,'+
  'object_key TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL,etag TEXT NOT NULL,'+
  'bytes INTEGER NOT NULL,name TEXT NOT NULL,pages_claimed INTEGER NOT NULL,'+
  'status TEXT NOT NULL DEFAULT \'awaiting_pdf_analysis\' CHECK(status=\'awaiting_pdf_analysis\'),'+
  'created_at TEXT NOT NULL DEFAULT (datetime(\'now\')),'+
  'UNIQUE(web_order_id,file_id))').run();
 const present=await env.DB.prepare(
  'SELECT web_order_id,file_id,object_key,sha256,etag,bytes,name,pages_claimed,status '+
  'FROM central_r2_large_pending WHERE receipt_id=? OR (web_order_id=? AND file_id=?)'
 ).bind(p.receiptId,p.orderId,p.fileId).first();
 const identical=x=>x&&x.web_order_id===p.orderId&&x.file_id===p.fileId&&
  x.object_key===p.objectKey&&x.sha256===p.sha256&&x.etag===p.etag&&
  x.bytes===p.bytes&&x.name===p.name&&x.pages_claimed===p.pagesDeclaradas&&
  x.status==='awaiting_pdf_analysis';
 if(present)return identical(present)?
  response({ok:true,saved:true,idempotent:true,webOrderId:p.orderId,
   status:'awaiting_pdf_analysis',paymentAuthorized:false,registeredInD1:false}):
  response({ok:false,error:'Archivo distinto ya registrado',paymentAuthorized:false},409);
 try{
  await env.DB.prepare('INSERT INTO central_r2_large_pending '+
   '(receipt_id,web_order_id,file_id,object_key,sha256,etag,bytes,name,pages_claimed) '+
   'VALUES(?,?,?,?,?,?,?,?,?)')
  .bind(p.receiptId,p.orderId,p.fileId,p.objectKey,p.sha256,p.etag,p.bytes,
   p.name,p.pagesDeclaradas).run();
 }catch{
  return response({ok:false,error:'Conflicto de recepción R2',paymentAuthorized:false},409);
 }
 return response({ok:true,saved:true,idempotent:false,webOrderId:p.orderId,
  status:'awaiting_pdf_analysis',registeredInD1:false,paymentAuthorized:false},201);
}

/**
 * Consulta interna SOLO Worker documentos ↔ Central, firmada como stage.
 * No concede permiso de descarga; el Worker de documentos vuelve a exigir
 * Basic del operador y verificar los bytes exactos almacenados en R2.
 * Sin proof de 2 horas, para continuar verificaciones días después.
 */
export async function lookupR2PendienteCentral(request,env,{readSigned}={}){
 if(env?.CENTRAL_R2_STAGING_ENABLED!=='PRIVATE_TEST_ONLY')
  return response({ok:false,found:false,paymentAuthorized:false},503);
 if(typeof readSigned!=='function'||!env?.DB?.prepare)
  return response({ok:false,found:false,paymentAuthorized:false},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return response({ok:false,found:false,paymentAuthorized:false},
  signed.status||401);
 const p=signed?.payload;
 if(!shape(p,['schema','webOrderId','receiptId'])||
   p.schema!=='saber-central-r2-pending-lookup-v1'||
   !ORDER.test(p.webOrderId||'')||!DOC.test(p.receiptId||''))
  return response({ok:false,found:false,paymentAuthorized:false},422);
 // Lectura sin crear tablas ni cambiar pedidos. Ausencia = 404.
 const table=await env.DB.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='central_r2_large_pending'"
 ).first();
 if(!table)return response({ok:false,found:false,paymentAuthorized:false},404);
 const row=await env.DB.prepare(
  'SELECT receipt_id,web_order_id,file_id,object_key,sha256,etag,bytes,name,'+
  'pages_claimed,status FROM central_r2_large_pending '+
  'WHERE receipt_id=? AND web_order_id=? LIMIT 1'
 ).bind(p.receiptId,p.webOrderId).first();
 if(!row)return response({ok:false,found:false,paymentAuthorized:false},404);
 if(row.status!=='awaiting_pdf_analysis')
  return response({ok:false,found:false,paymentAuthorized:false},409);
 // Validación profunda: no confiar ciegamente en datos de D1 dañados.
 try{
  validarPreRecepcionR2({
   schema:'saber-central-r2-grande-pendiente-v1',
   orderId:row.web_order_id,fileId:row.file_id,receiptId:row.receipt_id,
   objectKey:row.object_key,sha256:row.sha256,etag:row.etag,
   bytes:row.bytes,name:row.name,pagesDeclaradas:row.pages_claimed,
   sha256Verificado:true,contenidoPdfVerificado:false,
   registeredInD1:false,paymentAuthorized:false,listoParaProducir:false
  });
 }catch{return response({ok:false,found:false,paymentAuthorized:false},409)}
 return response({ok:true,found:true,
  schema:'saber-central-r2-pending-lookup-v1',
  webOrderId:row.web_order_id,receiptId:row.receipt_id,
  fileId:row.file_id,objectKey:row.object_key,
  sha256:row.sha256,etag:row.etag,bytes:row.bytes,
  pagesDeclared:row.pages_claimed,name:row.name,
  status:'awaiting_pdf_analysis',
  contenidoPdfVerificado:false,registeredInD1:false,
  paymentAuthorized:false,listoParaProducir:false});
}
