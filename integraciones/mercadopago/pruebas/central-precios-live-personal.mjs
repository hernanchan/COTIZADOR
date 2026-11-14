/**
 * Administrador de precios LIVE, bajo firma HMAC interna y Basic de la Central.
 * Consume exclusivamente el tarifario aprobado en D1 producción.
 * Los borradores no afectan cotización pública: sólo approve cambia approved_json.
 * No modifica pedidos, importes históricos ni pagos ya iniciados.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const MAX_CHANGES=250;
const copy=x=>JSON.parse(JSON.stringify(x));
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer'
}});
export async function administrarPreciosLivePersonal(request,env,{
 readSigned,fields,validate,at,set,preview
}){
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.MP_LIVE_GATE!==GO||env?.CENTRAL_LIVE_PRICING_GATE!==GO||
    typeof env?.DB?.prepare!=='function')
  return json({ok:false,error:'Administración de tarifas no disponible'},503);
 const signed=await readSigned(request,env);
 if(signed?.error)return json({ok:false,error:'Acceso interno no autorizado'},signed.status||403);
 const p=signed.payload;
 if(!p||p.schema!=='saber-central-live-staff-pricing-v1')
  return json({ok:false,error:'Solicitud inválida'},422);
 if(!['read','preview','draft','approve'].includes(p.action))
  return json({ok:false,error:'Acción desconocida'},422);
 const operator=String(p.operator||'').trim();
 if(p.action!=='read'&&(operator.length<2||operator.length>60||/[<>\r\n]/.test(operator)))
  return json({ok:false,error:'Indicá el responsable'},422);
 if(p.action==='read'&&p.changes.length!==0)return json({ok:false,error:'Solicitud inválida'},422);
 try{
  const head=await env.DB.prepare(
   'SELECT revision,approved_revision,draft_json,approved_json,updated_at FROM central_pricing_admin_head WHERE id=1'
  ).first();
  if(!head||!Number.isSafeInteger(head.approved_revision)||head.approved_revision<1||
     !Number.isSafeInteger(head.revision)||head.revision<head.approved_revision||
     typeof head.approved_json!=='string')
   return json({ok:false,error:'No hay tarifas comerciales aprobadas'},409);
  const approved=JSON.parse(head.approved_json);
  if(!validate(approved))return json({ok:false,error:'Tarifario comercial inválido'},409);
  const current=head.draft_json?JSON.parse(head.draft_json):approved;
  if(!validate(current))return json({ok:false,error:'Borrador de tarifas inválido'},409);
  const changesPresent=Boolean(head.draft_json);
  const rows=(await env.DB.prepare(
   "SELECT revision,action,operator,changed_count,created_at FROM central_pricing_admin_history ORDER BY revision DESC LIMIT 12"
  ).all()).results||[];
  if(p.action==='read'){
   return json({ok:true,revision:head.revision,approvedRevision:head.approved_revision,
    draftPresent:changesPresent,updatedAt:head.updated_at,
    fields:fields.map(f=>({path:f.path,category:f.category,label:f.label,kind:f.kind,
      value:at(current,f.path),approvedValue:at(approved,f.path)})),
    history:rows,commercialPricingConnected:true,
    paymentAuthorized:false,paymentsCreated:0,source:'production-d1-approved-only'});
  }
  if(!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision!==head.revision)
   return json({ok:false,error:'El tarifario cambió. Actualizá antes de guardar.'},409);
  if(!Array.isArray(p.changes)||p.changes.length>MAX_CHANGES)
   return json({ok:false,error:'Demasiados cambios'},422);
  const allowed=new Map(fields.map(f=>[f.path,f]));
  const seen=new Set(),proposed=copy(current);
  for(const change of p.changes){
   if(!change||typeof change!=='object'||Array.isArray(change)||
      Object.keys(change).sort().join(',')!=='path,value'||
      typeof change.path!=='string'||seen.has(change.path)||
      !allowed.has(change.path))return json({ok:false,error:'Campo de precio inválido'},422);
   const field=allowed.get(change.path),v=change.value;
   const valid=field.kind==='boolean'?typeof v==='boolean':
    typeof v==='number'&&Number.isFinite(v)&&
    (field.kind==='percent'?v>=0&&v<=50&&Math.round(v*100)===v*100:
      v>0&&v<=50000000&&Math.abs(v*100-Math.round(v*100))<.000001);
   if(!valid)return json({ok:false,error:'Valor o porcentaje inválido'},422);
   seen.add(change.path);set(proposed,change.path,v);
  }
  if(!validate(proposed))return json({ok:false,error:'Tarifario propuesto inválido'},422);
  const edited=fields.filter(f=>at(approved,f.path)!==at(proposed,f.path));
  if(p.action==='preview'){
   const result=preview(approved,proposed);
   return json({ok:true,revision:head.revision,draftPresent:changesPresent,
    edits:result.edits,examples:result.examples,
    caution:'Simulación orientativa. Las promociones pueden modificar el total. No se cambió ningún precio.'});
  }
  if(p.action==='draft'&&p.changes.length<1)
   return json({ok:false,error:'No hay cambios para guardar'},422);
  if(p.action==='approve'&&(!changesPresent||p.changes.length!==0||p.confirmed!==true))
   return json({ok:false,error:'Primero guardá un borrador y confirmá su aprobación'},422);
  if(p.action==='approve'&&edited.length===0)
   return json({ok:false,error:'El borrador no presenta cambios'},409);
  const revision=head.revision+1;
  const payload=p.action==='draft'?JSON.stringify(proposed):head.draft_json;
  const newDraft=p.action==='draft'?payload:null;
  const newApproved=p.action==='draft'?head.approved_json:payload;
  const approvedRev=p.action==='draft'?head.approved_revision:revision;
  const audit=p.action==='draft'?proposed:current;
  const statements=[
   env.DB.prepare(
    'UPDATE central_pricing_admin_head SET revision=?,approved_revision=?,draft_json=?,approved_json=?,updated_at=datetime(\'now\') WHERE id=1 AND revision=?'
   ).bind(revision,approvedRev,newDraft,newApproved,head.revision),
   env.DB.prepare(
    'INSERT INTO central_pricing_admin_history(revision,action,operator,payload_json,changed_count) '+
    'SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM central_pricing_admin_head WHERE id=1 AND revision=?)'
   ).bind(revision,p.action,operator,JSON.stringify(audit),edited.length,revision)
  ];
  const updates=await env.DB.batch(statements);
  if(updates?.[0]?.meta?.changes!==1||updates?.[1]?.meta?.changes!==1)
   return json({ok:false,error:'Actualización concurrente: volvé a cargar'},409);
  return json({ok:true,revision,approvedRevision:approvedRev,
   draftPresent:p.action==='draft',changedCount:edited.length,
   approved:p.action==='approve',commercialPricesUpdated:p.action==='approve',
   note:p.action==='draft'?'Borrador guardado, todavía sin publicar':
    'Tarifas aprobadas: rigen únicamente para presupuestos nuevos'});
 }catch(_){
  return json({ok:false,error:'No fue posible consultar o guardar tarifas. No reintentes sin revisar el estado.'},503);
 }
}
