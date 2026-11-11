/** Un borrador D1 con múltiples fichas TUS/R2, sin crear orders ni checkout.
 * Mantener circuito histórico R2_PREPAID_PLOT sin cambios.
 */
import {decidirTransportePDF} from '../../autocotizador/recepcion/seleccionar-transporte-pdf.mjs';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const reply=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store,private'}});
const MASTER="CREATE TABLE IF NOT EXISTS central_r2_universal_drafts ("+
 "web_order_id TEXT PRIMARY KEY,draft_id TEXT NOT NULL UNIQUE,quote_hash TEXT NOT NULL,"+
 "price_revision TEXT NOT NULL,total_ars INTEGER NOT NULL CHECK(total_ars>0),"+
 "file_count INTEGER NOT NULL CHECK(file_count BETWEEN 1 AND 10),"+
 "armados_json TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'draft_not_payable' "+
 "CHECK(state='draft_not_payable'),created_at TEXT NOT NULL DEFAULT(datetime('now')))";
const LINES="CREATE TABLE IF NOT EXISTS central_r2_universal_files ("+
 "web_order_id TEXT NOT NULL REFERENCES central_r2_universal_drafts(web_order_id),"+
 "file_id TEXT NOT NULL,ordinal INTEGER NOT NULL,name TEXT NOT NULL,sha256 TEXT NOT NULL,"+
 "bytes INTEGER NOT NULL,transport TEXT NOT NULL CHECK(transport IN ('tus','r2')),"+
 "service TEXT NOT NULL,work_json TEXT NOT NULL,received INTEGER NOT NULL DEFAULT 0,"+
 "PRIMARY KEY(web_order_id,file_id),UNIQUE(web_order_id,ordinal))";
const digest=async(data,subtle=crypto.subtle)=>Array.from(new Uint8Array(
 await subtle.digest('SHA-256',new TextEncoder().encode(data))),x=>x.toString(16).padStart(2,'0')).join('');
export async function verificarFichaUniversal(p,{subtle=crypto.subtle,allowTusOnly=false}={}){
 if(!p||typeof p!=='object'||Array.isArray(p)||!SHA.test(p.quoteHash||''))
  throw Error('UNIVERSAL_FICHA_INVALIDA');
 const {quoteHash,...ficha}=p;
 if(Object.keys(ficha).sort().join(',')!==
   'archivos,armados,estado,pagoAutorizado,priceRevision,produccionAutorizada,schema,subidaAutorizada,totalArs,webOrderId'||
   ficha.schema!=='saber-r2-universal-draft-v1'||!WEB.test(ficha.webOrderId||'')||
   !/^d1-approved-revision-[1-9]\d{0,7}$/.test(ficha.priceRevision||'')||
   !Number.isSafeInteger(ficha.totalArs)||ficha.totalArs<1||ficha.totalArs>50000000||
   !Array.isArray(ficha.archivos)||!ficha.archivos.length||ficha.archivos.length>10||
   !Array.isArray(ficha.armados)||ficha.armados.length>10||
   ficha.estado!=='PRELIMINAR_SIN_ORIGINALES'||ficha.pagoAutorizado!==false||
   ficha.subidaAutorizada!==false||ficha.produccionAutorizada!==false)
  throw Error('UNIVERSAL_FICHA_INVALIDA');
 if(await digest(JSON.stringify(ficha),subtle)!==quoteHash)
  throw Error('UNIVERSAL_HASH_INVALIDO');
 const ids=new Set(),workIds=new Set();let subtotal=0,tusBytes=0,r2=0;
 for(const [i,f] of ficha.archivos.entries()){
  if(!f||Object.keys(f).sort().join(',')!==
   'bytes,configuracion,destino,detalle,fileId,formatoFinal,idTrabajo,importeArs,indice,integridadVerificada,nombre,originalRecibido,paginasElegidas,preprensaAprobada,sha256,transporte'||
   f.indice!==i||!ID.test(f.fileId||'')||ids.has(f.fileId)||
   !SHA.test(f.sha256||'')||!Number.isSafeInteger(f.bytes)||
   decidirTransportePDF(f.bytes).ruta!==f.transporte||
   typeof f.nombre!=='string'||f.nombre.length<1||f.nombre.length>120||
   !/\.pdf$/i.test(f.nombre)||!['documentos','ploteos','fotos','stickers','corte','grafica'].includes(f.destino)||
   typeof f.idTrabajo!=='string'||!f.idTrabajo||
   workIds.has(f.idTrabajo)||!Array.isArray(f.paginasElegidas)||!f.paginasElegidas.length||
   f.paginasElegidas.length>2000||
   f.paginasElegidas.some(n=>!Number.isSafeInteger(n)||n<1||n>2000)||
   !f.configuracion||f.configuracion.nombre!==f.nombre||
   !f.detalle||f.detalle.nombre!==f.nombre||f.detalle.id!==f.idTrabajo||
   f.detalle.subtotal!==f.importeArs||
   !Number.isSafeInteger(f.importeArs)||f.importeArs<0||
   f.originalRecibido!==false||f.integridadVerificada!==false||
   f.preprensaAprobada!==false)
   throw Error('UNIVERSAL_ARCHIVO_INVALIDO');
  ids.add(f.fileId);workIds.add(f.idTrabajo);subtotal+=f.importeArs;
  if(f.transporte==='r2')r2++;else tusBytes+=f.bytes;
 }
 if((!allowTusOnly&&!r2)||tusBytes>60*1048576)throw Error('UNIVERSAL_RUTA_INVALIDA');
 for(const a of ficha.armados){
  if(!a||typeof a.grupo!=='string'||!Array.isArray(a.archivos)||
   a.archivos.length<2||!Number.isSafeInteger(a.subtotal)||a.subtotal<0||
   a.archivos.some(id=>!workIds.has(id)))throw Error('UNIVERSAL_ANILLADO_INVALIDO');
  subtotal+=a.subtotal;
 }
 if(subtotal!==ficha.totalArs)throw Error('UNIVERSAL_TOTAL_INVALIDO');
 return ficha;
}
export async function registrarFichaUniversalD1(request,env,{
 readSigned,uuid=()=>crypto.randomUUID(),subtle=crypto.subtle
}={}){
 const live=env?.SABER_ENTORNO==='produccion'&&
  env?.CENTRAL_DB_ENV==='produccion'&&
  env?.CENTRAL_LIVE_DRAFT_GATE==='GO_COMERCIAL_CONFIRMADO'&&
  env?.CENTRAL_LIVE_PRICING_GATE==='GO_COMERCIAL_CONFIRMADO'&&
  env?.CENTRAL_LIVE_BRIDGE_ENABLED==='GO_COMERCIAL_CONFIRMADO'&&
  env?.MP_LIVE_GATE==='GO_COMERCIAL_CONFIRMADO'&&
  env?.CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED!=='PRIVATE_TEST_ONLY';
 const sandbox=env?.SABER_ENTORNO!=='produccion'&&
  env?.CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED==='PRIVATE_TEST_ONLY';
 if((!sandbox&&!live)||!env?.DB?.prepare||!env?.DB?.batch)
  return reply({ok:false,error:'UNIVERSAL_OFF'},503);
 if(typeof readSigned!=='function')return reply({ok:false,error:'UNIVERSAL_HMAC_OFF'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return reply({ok:false,error:'UNIVERSAL_FIRMA'},signed.status||401);
 let ficha;try{ficha=await verificarFichaUniversal(signed.payload,{subtle,allowTusOnly:live})}
 catch{return reply({ok:false,error:'UNIVERSAL_FICHA_RECHAZADA'},422)}
 const db=env.DB;
 if(live){
  // El presupuesto nunca puede usar revisión no aprobada o vencida.
  // No crear esquema, importar baseline ni generar pedido por esta comprobación.
  let approved;
  try{approved=await db.prepare(
   'SELECT approved_revision,approved_json FROM central_pricing_admin_head WHERE id=1'
  ).first()}catch{return reply({ok:false,error:'LIVE_DRAFT_PRICING_UNAVAILABLE'},503)}
  if(!approved?.approved_json||
     ficha.priceRevision!=='d1-approved-revision-'+approved.approved_revision)
   return reply({ok:false,error:'LIVE_DRAFT_PRICING_REVISION_CHANGED'},409);
  let approvedData;try{approvedData=JSON.parse(approved.approved_json)}catch{}
  if(approvedData?.prices?.schema!=='saber-web-prices-v1')
   return reply({ok:false,error:'LIVE_DRAFT_PRICING_INVALID'},409);
 }else{
  await db.prepare(MASTER).run();await db.prepare(LINES).run();
 }
 const find=()=>db.prepare('SELECT draft_id,quote_hash,total_ars,file_count,state FROM central_r2_universal_drafts WHERE web_order_id=?')
  .bind(ficha.webOrderId).first();
 const answer=(prior)=>prior&&prior.quote_hash===signed.payload.quoteHash&&
  prior.total_ars===ficha.totalArs&&prior.file_count===ficha.archivos.length&&
  prior.state==='draft_not_payable'?
   reply({ok:true,webOrderId:ficha.webOrderId,draftId:prior.draft_id,
    totalArs:ficha.totalArs,fileCount:ficha.archivos.length,idempotent:true,
    paymentAuthorized:false,filesUploaded:false,checkoutEnabled:false,productionAuthorized:false}):null;
 const old=await find();
 if(old)return answer(old)||reply({ok:false,error:'UNIVERSAL_CONFLICTO'},409);
 const id=uuid();if(!UUID.test(id))return reply({ok:false,error:'UNIVERSAL_UUID'},503);
 try{
  await db.batch([
   db.prepare('INSERT INTO central_r2_universal_drafts (web_order_id,draft_id,quote_hash,price_revision,total_ars,file_count,armados_json) VALUES(?,?,?,?,?,?,?)')
    .bind(ficha.webOrderId,id,signed.payload.quoteHash,ficha.priceRevision,
     ficha.totalArs,ficha.archivos.length,JSON.stringify(ficha.armados)),
   ...ficha.archivos.map(f=>db.prepare('INSERT INTO central_r2_universal_files (web_order_id,file_id,ordinal,name,sha256,bytes,transport,service,work_json) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(ficha.webOrderId,f.fileId,f.indice,f.nombre,f.sha256,f.bytes,
     f.transporte,f.destino,JSON.stringify(f)))
  ]);
 }catch{return answer(await find().catch(()=>null))||
   reply({ok:false,error:'UNIVERSAL_D1_FALLO'},409)}
 return reply({ok:true,webOrderId:ficha.webOrderId,draftId:id,totalArs:ficha.totalArs,
  fileCount:ficha.archivos.length,idempotent:false,paymentAuthorized:false,
  filesUploaded:false,checkoutEnabled:false,productionAuthorized:false},201);
}

/**
 * Consulta de fichas SIN cobro ni PDF: exclusivo panel de personal.
 * No aparecen en Nuevos (pedidos pagados) hasta promoverse con garantías.
 * La consulta no crea tablas ni permisos de acceso a originales.
 */
export async function listarFichasR2Universales(request,env,{authorized=false}={}){
 if(!authorized)return reply({ok:false,error:'UNIVERSAL_PERSONAL_NO_AUTORIZADO'},401);
 if(request.method!=='GET')return reply({ok:false,error:'UNIVERSAL_METODO'},405);
 if(env?.CENTRAL_R2_UNIVERSAL_DRAFT_ENABLED!=='PRIVATE_TEST_ONLY'||
    !env?.DB?.prepare)return reply({ok:false,error:'UNIVERSAL_OFF'},503);
 const db=env.DB;
 const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' "+
  "AND name IN ('central_r2_universal_drafts','central_r2_universal_files')").all();
 const names=new Set((tables.results||[]).map(t=>t.name));
 if(names.size!==2)return reply({ok:true,count:0,drafts:[],productionAuthorized:false});
 const rows=await db.prepare('SELECT web_order_id,draft_id,quote_hash,price_revision,'+
  'total_ars,file_count,armados_json,state,created_at '+
  'FROM central_r2_universal_drafts ORDER BY created_at DESC LIMIT 50').all();
 const drafts=[];
 for(const d of rows.results||[]){
  if(d.state!=='draft_not_payable'||!UUID.test(d.draft_id||'')||
     !WEB.test(d.web_order_id||''))continue;
  const files=await db.prepare('SELECT file_id,ordinal,name,sha256,bytes,transport,'+
   'service,work_json,received FROM central_r2_universal_files '+
   'WHERE web_order_id=? ORDER BY ordinal ASC').bind(d.web_order_id).all()
   .catch(()=>({results:[]}));
  const lines=(files.results||[]).map(x=>{
   let w;try{w=JSON.parse(x.work_json)}catch{}
   if(!w||w.fileId!==x.file_id||w.nombre!==x.name||
      w.bytes!==x.bytes||w.sha256!==x.sha256||
      w.transporte!==x.transport||w.destino!==x.service||
      w.indice!==x.ordinal||x.received!==0)
    return null;
   return {...w,originalRecibido:false,integridadVerificada:false,preprensaAprobada:false};
  });
  if(lines.some(x=>!x)||lines.length!==d.file_count)continue;
  let armados;try{armados=JSON.parse(d.armados_json)}catch{}
  if(!Array.isArray(armados))continue;
  drafts.push({draftId:d.draft_id,webOrderId:d.web_order_id,
   totalArs:d.total_ars,priceRevision:d.price_revision,quotedAt:d.created_at,
   trabajos:lines,armados,fileCount:lines.length,
   estado:'PRESUPUESTO_SIN_ORIGINALES',
   checkoutEnabled:false,filesUploaded:false,
   paymentAuthorized:false,productionAuthorized:false});
 }
 return reply({ok:true,count:drafts.length,drafts,productionAuthorized:false});
}
