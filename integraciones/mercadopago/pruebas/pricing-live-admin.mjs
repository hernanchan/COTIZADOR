/** Tarifario comercial D1 LIVE. Sin precios presembrados y sin
 * usar ni importar el tarifario de ensayo. Doble aprobación del operador:
 * primero propuesta completa, luego hash SHA-256 + revisión exacta.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const response=(value,status=200)=>Response.json(value,{status,headers:{
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
const HEX=/^[a-f0-9]{64}$/;
const sha=async(s,subtle)=>Array.from(new Uint8Array(await subtle.digest('SHA-256',
 new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const okActor=a=>typeof a==='string'&&a.trim().length>=2&&a.trim().length<=60;
export async function pricingLiveAdmin(req,env,{
 authorized=false,validate=()=>false,subtle=crypto.subtle
}={}){
 const url=new URL(req.url);
 if(!['/admin/api/pricing-live','/admin/api/pricing-live/draft',
   '/admin/api/pricing-live/approve'].includes(url.pathname)||
   url.search||url.hash||url.protocol!=='https:')
  return response({ok:false,error:'LIVE_PRICE_RUTA'},404);
 if(!authorized)return response({ok:false,error:'LIVE_PRICE_OPERADOR'},401);
 if(env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
  env?.CENTRAL_LIVE_PRICING_ADMIN_GATE!==GO||
  !env?.DB?.prepare||!env?.DB?.batch)
  return response({ok:false,error:'LIVE_PRICE_ADMIN_OFF'},503);
 const db=env.DB;
 if(url.pathname==='/admin/api/pricing-live'&&req.method==='GET'){
  try{
   const head=await db.prepare('SELECT revision,approved_revision,draft_json,approved_json,updated_at FROM central_pricing_admin_head WHERE id=1').first();
   const audit=(await db.prepare('SELECT revision,action,operator,changed_count,created_at FROM central_pricing_admin_history ORDER BY revision DESC LIMIT 15').all()).results||[];
   const draft=head?.draft_json||null;
   return response({ok:true,revision:head?.revision||0,
    approvedRevision:head?.approved_revision||0,
    draftPresent:Boolean(draft),draftHash:draft?await sha(draft,subtle):null,
    draft: draft?JSON.parse(draft):null,
    audit,publicPricingEnabled:false,paymentsEnabled:false,
    note:'Revisar precios, materiales y promociones antes de aprobar. Nunca importa precios de ensayo.'});
  }catch{return response({ok:false,error:'LIVE_PRICE_D1_NO_DISPONIBLE'},503)}
 }
 if(req.method!=='POST')return response({ok:false,error:'LIVE_PRICE_METODO'},405);
 if(req.headers.get('Origin')!=='https://pagos.libreriasaber.com.ar'||
    !/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')||
    (req.headers.get('Sec-Fetch-Site')&&req.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return response({ok:false,error:'LIVE_PRICE_ORIGEN'},403);
 const raw=await req.text();
 if(raw.length>80000)return response({ok:false,error:'LIVE_PRICE_TAMANO'},413);
 let data;try{data=JSON.parse(raw)}catch{}
 if(!data||typeof data!=='object'||Array.isArray(data)||
    !okActor(data.operator)||!Number.isSafeInteger(data.expectedRevision)||
    data.expectedRevision<0)
  return response({ok:false,error:'LIVE_PRICE_DATOS'},422);
 let head;
 try{head=await db.prepare('SELECT revision,approved_revision,draft_json,approved_json FROM central_pricing_admin_head WHERE id=1').first()}
 catch{return response({ok:false,error:'LIVE_PRICE_D1'},503)}
 const revision=head?.revision||0;
 if(revision!==data.expectedRevision)return response({ok:false,error:'LIVE_PRICE_REVISION_CAMBIO'},409);
 if(url.pathname==='/admin/api/pricing-live/draft'){
  if(Object.keys(data).sort().join(',')!=='confirmed,expectedRevision,operator,snapshot'||
     data.confirmed!==true||!validate(data.snapshot))
   return response({ok:false,error:'LIVE_PRICE_PROPUESTA_INVALIDA'},422);
  const payload=JSON.stringify(data.snapshot);
  const next=revision+1,digest=await sha(payload,subtle);
  try{
   const statements=[];
   if(!head)statements.push(db.prepare(
    'INSERT INTO central_pricing_admin_head(id,revision,approved_revision,draft_json,approved_json) VALUES(1,0,0,NULL,NULL)'));
   statements.push(db.prepare(
    'UPDATE central_pricing_admin_head SET revision=?,draft_json=?,updated_at=datetime(\'now\') WHERE id=1 AND revision=?'
   ).bind(next,payload,revision));
   statements.push(db.prepare(
    "INSERT INTO central_pricing_admin_history(revision,action,operator,payload_json,changed_count) VALUES(?,'draft',?,?,0)"
   ).bind(next,data.operator.trim(),payload));
   const written=await db.batch(statements);
   if(written.some(x=>x?.meta?.changes!==1))
    return response({ok:false,error:'LIVE_PRICE_WRITE_CONFLICT'},409);
  }catch{return response({ok:false,error:'LIVE_PRICE_D1_WRITE'},503)}
  return response({ok:true,draftRevision:next,draftHash:digest,
   approvalRequired:true,paymentsEnabled:false,commercialRelease:false},201);
 }
 if(url.pathname==='/admin/api/pricing-live/approve'){
  if(Object.keys(data).sort().join(',')!=='confirmed,draftHash,expectedRevision,operator'||
    data.confirmed!==true||!HEX.test(data.draftHash||'')||
    !head?.draft_json)
   return response({ok:false,error:'LIVE_PRICE_SIN_PROPUESTA'},422);
  let candidate;try{candidate=JSON.parse(head.draft_json)}catch{}
  if(!validate(candidate)||await sha(head.draft_json,subtle)!==data.draftHash)
   return response({ok:false,error:'LIVE_PRICE_HASH_NO_COINCIDE'},409);
  const next=revision+1;
  try{
   const written=await db.batch([
    db.prepare('UPDATE central_pricing_admin_head SET approved_json=draft_json,draft_json=NULL,approved_revision=?,revision=?,updated_at=datetime(\'now\') WHERE id=1 AND revision=? AND draft_json=?'
    ).bind(next,next,revision,head.draft_json),
    db.prepare(
     "INSERT INTO central_pricing_admin_history(revision,action,operator,payload_json,changed_count) VALUES(?,'approve',?,?,0)"
    ).bind(next,data.operator.trim(),head.draft_json)
   ]);
   if(written.length!==2||written.some(x=>x?.meta?.changes!==1))
    return response({ok:false,error:'LIVE_PRICE_APPROVAL_CONFLICT'},409);
  }catch{return response({ok:false,error:'LIVE_PRICE_APPROVAL_D1'},503)}
  return response({ok:true,approvedRevision:next,approvedHash:data.draftHash,
   commercialRelease:false,paymentsEnabled:false},200);
 }
 return response({ok:false,error:'LIVE_PRICE_RUTA'},404);
}
