/**
 * Fachada privada bajo Basic de personal (verificada en Worker principal).
 * Sólo entrega un contrato validado al Service Binding de la Central LIVE.
 * El navegador nunca conoce HMAC, D1 ni secretos de pagos.
 */
const GO='GO_COMERCIAL_CONFIRMADO';
const DEST='https://pagos.libreriasaber.com.ar/internal/central/live/staff-pricing';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const j=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store,private',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'
}});
export async function preciosPersonalLiveApi(request,env,{
 fetchService=env?.SABER_CENTRAL?.fetch?.bind(env.SABER_CENTRAL),
 subtle=crypto.subtle,now=()=>Math.floor(Date.now()/1000),
 nonce=()=>crypto.randomUUID()
}={}){
 const url=new URL(request.url);
 if(url.origin!=='https://pedidos.libreriasaber.com.ar'||
    !['GET','POST'].includes(request.method)||
    env?.SABER_ENTORNO!=='produccion'||env?.CENTRAL_DB_ENV!=='produccion'||
    env?.DOCS_LIVE_STAFF_GATE!==GO||env?.DOCS_LIVE_PRICING_GATE!==GO||
    typeof env?.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof fetchService!=='function')
  return j({ok:false,error:'Edición de precios no habilitada'},503);
 let input={action:'read',changes:[],confirmed:false,expectedRevision:0,operator:''};
 if(request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin||
     (request.headers.has('Sec-Fetch-Site')&&
      request.headers.get('Sec-Fetch-Site')!=='same-origin')||
     !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))
   return j({ok:false,error:'Origen no autorizado'},403);
  const known=Number(request.headers.get('Content-Length')||0);
  if(known>22000)return j({ok:false,error:'Solicitud extensa'},413);
  const raw=await request.text();
  if(raw.length>22000)return j({ok:false,error:'Solicitud extensa'},413);
  try{input=JSON.parse(raw)}catch{return j({ok:false,error:'JSON inválido'},400)}
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).sort().join(',')!=='action,changes,confirmed,expectedRevision,operator'||
     !['preview','draft','approve'].includes(input.action)||
     !Array.isArray(input.changes)||input.changes.length>250||
     !Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||
     input.expectedRevision>999999||
     typeof input.operator!=='string'||input.operator.trim().length<2||
     input.operator.trim().length>60||
     typeof input.confirmed!=='boolean')
   return j({ok:false,error:'Datos de edición inválidos'},422);
 }
 const ts=now(),id=nonce();
 if(!Number.isSafeInteger(ts)||!UUID.test(id))
  return j({ok:false,error:'Error de firma'},503);
 const body=JSON.stringify({schema:'saber-central-live-staff-pricing-v1',...input});
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await subtle.sign('HMAC',key,
   new TextEncoder().encode(ts+'\n'+id+'\n'+body)));
 const hex=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
 const req=new Request(DEST,{method:'POST',headers:{
  'Content-Type':'application/json',
  'x-saber-ts':String(ts),'x-saber-request-id':id,
  'x-saber-signature':hex
 },body});
 try{
  const res=await fetchService(req);
  const response=await res.text();
  if(response.length>150000)return j({ok:false,error:'Respuesta demasiado extensa'},502);
  const data=JSON.parse(response);
  return j(data,res.status);
 }catch{return j({ok:false,error:'No pudimos consultar el tarifario LIVE'},503)}
}
