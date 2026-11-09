/**
 * Read-only production PACKAGE manifest and file authority for a single
 * PAID mixed R2/TUS order. Called exclusively via HMAC by Documents Worker.
 * Never marks prepress passed or exposes Storage credentials.
 */
import {verificarPedidoUniversalCobrable,estadoPagoUniversal} from './r2-universal-checkout-central.mjs';
const ON='PRIVATE_TEST_ONLY';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const RECEIPT=/^DOC-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const R2KEY=/^r2-v1\/(WEB-ENSAYO-[A-F0-9]{32})\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.pdf$/i;
const respond=(v,status=200)=>Response.json(v,{status,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
function enabled(env){
 return env?.CENTRAL_R2_UNIVERSAL_PACKAGE_ENABLED===ON&&
  env?.CENTRAL_R2_UNIVERSAL_POSTPAY_ENABLED===ON&&
  env?.DB?.prepare;
}
async function checkedOrder(env,webOrderId,subtle){
 const db=env.DB;
 const link=await db.prepare('SELECT commercial_order_id FROM central_r2_universal_order_links '+
  'WHERE web_order_id=? LIMIT 1').bind(webOrderId).first();
 if(!UUID.test(link?.commercial_order_id||''))throw Error('NO_LINK');
 const valid=await verificarPedidoUniversalCobrable(env,link.commercial_order_id,{
  webOrderId,subtle});
 if(!valid.ok)throw Error('NO_QUOTE');
 const pay=await estadoPagoUniversal(env,valid.commercialOrderId);
 if(!pay.verified||pay.revoked)throw Error('NO_PAYMENT');
 const prodTable=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' "+
  "AND name='central_production_status'").first();
 if(prodTable){
  const stage=await db.prepare('SELECT state FROM central_production_status WHERE order_id=?')
   .bind(valid.commercialOrderId).first();
  if(stage?.state==='entregado')throw Error('DELIVERED');
 }
 return valid;
}
async function receipt(env,valid,row){
 const db=env.DB;
 if(row.transport==='tus'){
  const r=await db.prepare('SELECT receipt_id,object_name,sha256,bytes,page_count '+
   'FROM central_r2_universal_tus_receipts WHERE web_order_id=? AND file_id=?')
   .bind(valid.webOrderId,row.file_id).first();
  if(!RECEIPT.test(r?.receipt_id||'')||
     r.object_name!=='v2/'+valid.webOrderId+'/'+r.receipt_id.slice(4)+'.pdf'||
     r.sha256!==row.sha256||r.bytes!==row.bytes||
     !Number.isSafeInteger(r.page_count)||r.page_count<1||r.page_count>2000)
   throw Error('TUS_RECEIPT');
  return {receiptId:r.receipt_id,objectKey:r.object_name,pages:r.page_count};
 }
 const r=await db.prepare('SELECT p.receipt_id,p.object_key,p.pages_claimed,'+
  'p.sha256,p.bytes,p.status,q.state AS reservation_state '+
  'FROM central_r2_large_pending p JOIN central_r2_large_reservations q '+
  'ON q.object_key=p.object_key AND q.web_order_id=p.web_order_id '+
  'AND q.file_id=p.file_id AND q.sha256=p.sha256 AND q.bytes=p.bytes '+
  'WHERE p.web_order_id=? AND p.file_id=? AND p.sha256=? AND p.bytes=? '+
  'LIMIT 1').bind(valid.webOrderId,row.file_id,row.sha256,row.bytes).first();
 const m=RECEIPT.exec(r?.receipt_id||''),key=R2KEY.exec(r?.object_key||'');
 if(!m||!key||key[1]!==valid.webOrderId||
    m[1].toLowerCase()!==key[2].toLowerCase()||
    r.sha256!==row.sha256||r.bytes!==row.bytes||
    r.status!=='awaiting_pdf_analysis'||r.reservation_state!=='reserved'||
    !Number.isSafeInteger(r.pages_claimed)||r.pages_claimed<1||r.pages_claimed>2000)
  throw Error('R2_RECEIPT');
 return {receiptId:r.receipt_id,objectKey:r.object_key,pages:r.pages_claimed};
}
async function readRequest(request,env,readSigned,subtle,action){
 if(!enabled(env)||typeof readSigned!=='function')return {error:'PAQUETE_OFF',status:503};
 const signed=await readSigned(request,env);
 if(signed?.error)return {error:'PAQUETE_FIRMA',status:signed.status||401};
 const p=signed.payload;
 const fields=action==='manifest'?'schema,webOrderId':'fileId,schema,webOrderId';
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!==fields||
    p.schema!=='saber-central-r2-universal-package-'+action+'-v1'||
    !WEB.test(p.webOrderId||'')||(action==='file'&&!FILE.test(p.fileId||'')))
  return {error:'PAQUETE_PARAMETROS',status:422};
 let valid;
 try{valid=await checkedOrder(env,p.webOrderId,subtle)}
 catch{return {error:'PAQUETE_PAGO_O_ORDEN_NO_VALIDO',status:409}}
 return {p,valid};
}
export async function consultarPaqueteUniversalCentral(request,env,{
 readSigned,subtle=crypto.subtle
}={}){
 const c=await readRequest(request,env,readSigned,subtle,'manifest');
 if(c.error)return respond({ok:false,error:c.error},c.status);
 const {valid,p}=c;
 const pending=valid.rows.filter(r=>r.received!==1);
 if(pending.length)return respond({ok:false,error:'PAQUETE_ORIGINALES_PENDIENTES',
  receivedFiles:valid.rows.length-pending.length,pendingFiles:pending.length,
  productionAuthorized:false},409);
 const db=env.DB;
 const number=await db.prepare('SELECT number FROM central_work_order_numbers '+
  'WHERE commercial_order_id=?').bind(valid.commercialOrderId).first();
 if(!Number.isSafeInteger(number?.number)||number.number<1)
  return respond({ok:false,error:'PAQUETE_NUMERO_NO_VERIFICADO'},409);
 const trabajos=[];
 for(const row of valid.rows){
  let r;
  try{r=await receipt(env,valid,row)}
  catch{return respond({ok:false,error:'PAQUETE_RECIBO_NO_VERIFICADO'},409)}
  const w=valid.works.find(x=>x.fileId===row.file_id);
  if(!w||w.configuracion.paginas.length!==r.pages||w.nombre!==row.name||
     w.sha256!==row.sha256||w.bytes!==row.bytes)
   return respond({ok:false,error:'PAQUETE_CONFIGURACION_CAMBIO'},409);
  trabajos.push({orden:row.ordinal+1,fileId:row.file_id,
   nombreOriginal:row.name,bytes:row.bytes,sha256:row.sha256,
   transporte:row.transport,servicio:row.service,
   reciboPrivado:r.receiptId,formatoFinal:w.formatoFinal,
   paginasElegidas:w.paginasElegidas,
   importeArs:w.importeArs,configuracion:w.configuracion,detalle:w.detalle,
   preprensaAprobada:false});
 }
 let armados;try{armados=JSON.parse(valid.link.armados_json)}catch{}
 if(!Array.isArray(armados))return respond({ok:false,error:'PAQUETE_ARMADO_INVALIDO'},409);
 return respond({ok:true,schema:'saber-central-r2-universal-package-manifest-v1',
  webOrderId:p.webOrderId,numeroOrden:String(number.number).padStart(3,'0'),
  importe:valid.amountArs,estadoPago:'PAGADO_VERIFICADO',pagoVerificado:true,
  totalArchivos:trabajos.length,trabajos,armados,
  listoParaProducir:false,productionAuthorized:false,preprensaPendiente:true},200);
}
export async function consultarArchivoUniversalCentral(request,env,{
 readSigned,subtle=crypto.subtle
}={}){
 const c=await readRequest(request,env,readSigned,subtle,'file');
 if(c.error)return respond({ok:false,error:c.error},c.status);
 const {p,valid}=c;
 const row=valid.rows.find(r=>r.file_id===p.fileId);
 if(!row||row.received!==1)return respond({ok:false,error:'PAQUETE_ARCHIVO_NO_RECIBIDO'},409);
 let r;try{r=await receipt(env,valid,row)}
 catch{return respond({ok:false,error:'PAQUETE_RECIBO_NO_VERIFICADO'},409)}
 const w=valid.works.find(x=>x.fileId===row.file_id);
 if(!w||w.configuracion.paginas.length!==r.pages||
    !SHA.test(row.sha256||''))return respond({ok:false,error:'PAQUETE_ARCHIVO_INCONSISTENTE'},409);
 return respond({ok:true,schema:'saber-central-r2-universal-package-file-v1',
  webOrderId:p.webOrderId,fileId:p.fileId,transporte:row.transport,
  nombre:row.name,bytes:row.bytes,sha256:row.sha256,receiptId:r.receiptId,
  objectKey:r.objectKey,numeroPaginas:r.pages,
  productionAuthorized:false,preprensaPendiente:true},200);
}
