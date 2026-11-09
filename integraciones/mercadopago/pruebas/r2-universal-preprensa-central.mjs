/**
 * Operator approval for one PAID universal batch after SHA-verified ZIP
 * inspection. Until approved, production and delivery remain blocked.
 * Approval is immutable and scoped to D1 quote hash + file count.
 */
import {verificarPedidoUniversalCobrable,estadoPagoUniversal} from './r2-universal-checkout-central.mjs';
import {consultarPaqueteUniversalCentral} from './r2-universal-package-central.mjs';
const FLAG='PRIVATE_TEST_ONLY';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const ALL=['archivo','caras','clasificacion','copias','escala','material','medidas','paginas','precio','rollo'];
export const UNIVERSAL_PREPRESS_TABLE="CREATE TABLE IF NOT EXISTS central_r2_universal_prepress_approvals ("+
 "commercial_order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,"+
 "web_order_id TEXT NOT NULL UNIQUE REFERENCES central_r2_universal_drafts(web_order_id),"+
 "quote_hash TEXT NOT NULL,file_count INTEGER NOT NULL CHECK(file_count BETWEEN 1 AND 10),"+
 "operator TEXT NOT NULL,checks_json TEXT NOT NULL,"+
 "approved_at TEXT NOT NULL DEFAULT(datetime('now')))";
const reply=(x,status=200)=>Response.json(x,{status,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff'}});
export async function comprobarPreprensaUniversal(env,commercialOrderId){
 if(env?.CENTRAL_R2_UNIVERSAL_PREPRESS_ENABLED!==FLAG||!UUID.test(commercialOrderId||'')||
    !env?.DB?.prepare)return false;
 const db=env.DB;
 const table=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' "+
  "AND name='central_r2_universal_prepress_approvals'").first();
 if(!table)return false;
 const row=await db.prepare("SELECT a.web_order_id,a.quote_hash,a.file_count,a.operator "+
  "FROM central_r2_universal_prepress_approvals a "+
  "JOIN central_r2_universal_order_links l ON l.commercial_order_id=a.commercial_order_id "+
  "WHERE a.commercial_order_id=? AND a.web_order_id=l.web_order_id "+
  "AND a.quote_hash=l.quote_hash AND NOT EXISTS("+
  "SELECT 1 FROM central_r2_universal_files f WHERE f.web_order_id=l.web_order_id "+
  "AND f.received<>1) AND a.file_count=("+
  "SELECT COUNT(*) FROM central_r2_universal_files f WHERE f.web_order_id=l.web_order_id)"
 ).bind(commercialOrderId).first();
 return Boolean(row&&WEB.test(row.web_order_id||'')&&
  SHA.test(row.quote_hash||'')&&Number.isSafeInteger(row.file_count)&&
  row.file_count>0&&row.file_count<=10&&typeof row.operator==='string');
}
export async function aprobarPreprensaUniversalCentral(request,env,{
 authorized=false,subtle=crypto.subtle
}={}){
 if(!authorized)return reply({ok:false,error:'UNIVERSAL_PREPRENSA_SIN_AUTORIZACION'},401);
 if(env?.CENTRAL_R2_UNIVERSAL_PREPRESS_ENABLED!==FLAG||
    env?.CENTRAL_R2_UNIVERSAL_PACKAGE_ENABLED!==FLAG||
    !env?.DB?.prepare||!env?.DB?.batch)
  return reply({ok:false,error:'UNIVERSAL_PREPRENSA_OFF'},503);
 if(request.method!=='POST'||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
  return reply({ok:false,error:'UNIVERSAL_PREPRENSA_METODO'},405);
 const raw=await request.text();
 if(raw.length>1800)return reply({ok:false,error:'UNIVERSAL_PREPRENSA_LIMITE'},413);
 let p;try{p=JSON.parse(raw)}catch{}
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='commercialOrderId,confirmed,operator,schema,webOrderId'||
    p.schema!=='saber-central-r2-universal-prepress-approval-v1'||
    !WEB.test(p.webOrderId||'')||!UUID.test(p.commercialOrderId||'')||
    typeof p.operator!=='string'||p.operator.trim().length<2||
    p.operator.trim().length>60||!p.confirmed||
    Object.keys(p.confirmed).sort().join(',')!==ALL.join(',')||
    !ALL.every(key=>p.confirmed[key]===true))
  return reply({ok:false,error:'UNIVERSAL_PREPRENSA_CONFIRMACIONES'},422);
 const db=env.DB;
 const v=await verificarPedidoUniversalCobrable(env,p.commercialOrderId,{
  webOrderId:p.webOrderId,subtle});
 if(!v.ok||v.rows.some(x=>x.received!==1))
  return reply({ok:false,error:'UNIVERSAL_PREPRENSA_FALTA_ORIGINAL'},409);
 const payment=await estadoPagoUniversal(env,p.commercialOrderId);
 if(!payment.verified||payment.revoked)
  return reply({ok:false,error:'UNIVERSAL_PREPRENSA_SIN_PAGO'},402);
 const manifest=await consultarPaqueteUniversalCentral(new Request(
  'https://central.invalid/internal/central/r2-universal-package-manifest',{method:'POST'}),env,{
  readSigned:async()=>({payload:{schema:'saber-central-r2-universal-package-manifest-v1',
   webOrderId:p.webOrderId}}),subtle});
 if(manifest.status!==200)
  return reply({ok:false,error:'UNIVERSAL_PREPRENSA_RECIBOS_INCOMPLETOS'},409);
 const data=await manifest.json();
 if(data?.totalArchivos!==v.works.length||data?.importe!==v.amountArs||
    data?.pagoVerificado!==true)
  return reply({ok:false,error:'UNIVERSAL_PREPRENSA_FICHA_NO_COINCIDE'},409);
 await db.prepare(UNIVERSAL_PREPRESS_TABLE).run();
 const find=()=>db.prepare('SELECT quote_hash,file_count,operator FROM '+
  'central_r2_universal_prepress_approvals WHERE commercial_order_id=?')
  .bind(p.commercialOrderId).first();
 const existing=await find();
 if(existing)return existing.quote_hash===v.link.quote_hash&&
   existing.file_count===v.works.length?
   reply({ok:true,approved:true,idempotent:true,webOrderId:p.webOrderId,
    productionGatePassed:true},200):
   reply({ok:false,error:'UNIVERSAL_PREPRENSA_CONFLICTO'},409);
 const q="INSERT INTO central_r2_universal_prepress_approvals "+
  "(commercial_order_id,web_order_id,quote_hash,file_count,operator,checks_json) "+
  "SELECT l.commercial_order_id,l.web_order_id,l.quote_hash,?,?,? "+
  "FROM central_r2_universal_order_links l JOIN orders o ON o.id=l.commercial_order_id "+
  "WHERE l.commercial_order_id=? AND l.web_order_id=? AND l.quote_hash=? "+
  "AND o.status='paid' AND o.paid_at IS NOT NULL AND o.deposit_ars=o.amount_ars "+
  "AND EXISTS(SELECT 1 FROM payment_reviews p WHERE p.order_id=o.id "+
  "AND p.state='verified') AND NOT EXISTS(SELECT 1 FROM central_r2_universal_files f "+
  "WHERE f.web_order_id=l.web_order_id AND f.received<>1) AND "+
  "(SELECT COUNT(*) FROM central_r2_universal_files f WHERE f.web_order_id=l.web_order_id)=?";
 try{
  const res=await db.prepare(q).bind(v.works.length,p.operator.trim(),
   JSON.stringify(p.confirmed),p.commercialOrderId,p.webOrderId,
   v.link.quote_hash,v.works.length).run();
  if(res?.meta?.changes!==1)
   return reply({ok:false,error:'UNIVERSAL_PREPRENSA_CONFLICTO_D1'},409);
 }catch{
  const prior=await find().catch(()=>null);
  return prior?.quote_hash===v.link.quote_hash&&prior.file_count===v.works.length?
   reply({ok:true,approved:true,idempotent:true,webOrderId:p.webOrderId,
    productionGatePassed:true}):
   reply({ok:false,error:'UNIVERSAL_PREPRENSA_CONCURRENCIA'},409);
 }
 return reply({ok:true,approved:true,idempotent:false,webOrderId:p.webOrderId,
  productionGatePassed:true},201);
}
