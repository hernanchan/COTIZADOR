/**
 * Librería Saber - liberación segura de originales TUS al entregar.
 * FASE ENSAYO: endpoint de SIMULACIÓN únicamente. No llama DELETE.
 * El ejecutor aislado requiere tres compuertas + auditoría y no está conectado
 * a un endpoint ni a cron hasta el cierre de pruebas con el operador.
 */
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const RECEIPT=/^DOC-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const FILE=/^[A-Za-z0-9_-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/i;
const BUCKET='saber-tus-lab';
const PROJECT='qkbbqzbannyhuanngjpw';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,
 headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store,private',
 'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow,noarchive'}});
const fail=message=>{throw Error(message)};

/** La Central es la única autoridad del pago, la entrega y los recibos. */
export function planDeBorradoEntregado(plan,webOrderId){
 if(!WEB.test(webOrderId||'')||!plan||typeof plan!=='object'||
    plan.ok!==true||plan.schema!=='saber-central-tus-purge-plan-v1'||
    plan.webOrderId!==webOrderId||plan.productionState!=='entregado'||
    plan.paymentVerified!==true||!UUID.test(plan.commercialOrderId||'')||
    !Number.isSafeInteger(plan.productionVersion)||plan.productionVersion<1||
    !Array.isArray(plan.files)||plan.files.length<1||plan.files.length>10||
    plan.deletionExecuted!==false||plan.retentionDays!==0)
  return fail('Plan de limpieza no autorizado o incompleto');
 const ids=new Set(),keys=new Set();
 let bytes=0;
 const paths=[];
 for(const file of plan.files){
  const match=RECEIPT.exec(file?.receiptId||'');
  if(!match||!FILE.test(file.fileId||'')||!SHA.test(file.sha256||'')||
     !Number.isSafeInteger(file.bytes)||file.bytes<5||file.bytes>20*1024*1024||
     ids.has(file.fileId)||keys.has(file.receiptId))
   return fail('Recibos de pedido incompatibles');
  ids.add(file.fileId);keys.add(file.receiptId);
  const path='v2/'+webOrderId+'/'+match[1]+'.pdf';
  if(!/^v2\/WEB-ENSAYO-[A-F0-9]{32}\/[0-9a-f-]{36}\.pdf$/i.test(path))
   return fail('Ruta TUS insegura');
  paths.push(path);
  bytes+=file.bytes;
 }
 if(bytes>60*1024*1024)return fail('Límite de lote excedido');
 return Object.freeze({webOrderId,commercialOrderId:plan.commercialOrderId,
  version:plan.productionVersion,paths:Object.freeze(paths),
  count:paths.length,totalBytes:bytes,bucket:BUCKET,
  confirmedDelivered:true,paymentVerified:true});
}

async function planCentralFirmado(env,webOrderId,{service=env?.SABER_CENTRAL,
 uuid=()=>crypto.randomUUID(),now=()=>Math.floor(Date.now()/1000),
 subtle=crypto.subtle}={}){
 if(typeof service?.fetch!=='function'||typeof env.CENTRAL_BRIDGE_KEY!=='string'||
    env.CENTRAL_BRIDGE_KEY.length<32)return fail('Central privada no configurada');
 let target;
 try{target=new URL(env.CENTRAL_TEST_URL)}catch{return fail('Destino Central no configurado')}
 if(target.protocol!=='https:'||
    !/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/.test(target.hostname)||
    target.pathname!=='/internal/central/stage'||target.search||target.hash||
    target.port||target.username||target.password)
  return fail('Destino Central no autorizado');
 const body=JSON.stringify({schema:'saber-central-tus-purge-plan-v1',webOrderId});
 const ts=now(),id=uuid();
 if(!Number.isSafeInteger(ts)||!UUID.test(id))return fail('Firma de solicitud inválida');
 const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Array.from(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))),
  x=>x.toString(16).padStart(2,'0')).join('');
 target.pathname='/internal/central/tus-purge-plan';
 const answer=await service.fetch(new Request(target.href,{method:'POST',headers:{
  'Content-Type':'application/json','x-saber-ts':String(ts),
  'x-saber-request-id':id,'x-saber-signature':sig},body}));
 const raw=await answer.text();
 if(raw.length>24000)return fail('Manifiesto de borrado demasiado extenso');
 const obj=JSON.parse(raw);
 if(answer.status!==200||obj?.ok!==true)return fail('La Central no confirmó entrega y pago');
 return planDeBorradoEntregado(obj,webOrderId);
}

/** Solo previsualiza cantidad y bytes. No se admiten POST de borrado acá. */
export async function simularLimpiezaTUS(request,env,{
 authorized=false,central=planCentralFirmado
}={}){
 if(authorized!==true||request.method!=='POST'||
    new URL(request.url).protocol!=='https:'||
    request.headers.get('Origin')!==new URL(request.url).origin||
    !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'')||
    (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return response({ok:false,error:'Operador no autorizado'},403);
 try{
  const raw=await request.text();
  if(raw.length>300)return response({ok:false,error:'Solicitud demasiado extensa'},413);
  const d=JSON.parse(raw);
  if(!d||typeof d!=='object'||Array.isArray(d)||
     Object.keys(d).join(',')!=='webOrderId'||!WEB.test(d.webOrderId||''))
   return response({ok:false,error:'Referencia de pedido inválida'},422);
  const plan=await central(env,d.webOrderId);
  return response({ok:true,mode:'simulacion',webOrderId:plan.webOrderId,
    entregado:true,pagoVerificado:true,archivosAEliminar:plan.count,
    bytesALiberar:plan.totalBytes,borrados:0,irreversible:true,
    nota:'Simulación únicamente. No se borró ningún archivo.'},200);
 }catch{return response({ok:false,error:'No se pudo verificar el pedido entregado'},409)}
}

/**
 * Ejecutor encapsulado para habilitación posterior. No lo llama ningún endpoint.
 * No confiar en rutas del navegador; la lista es derivada del manifiesto firmado.
 * Exigir doble autorización y callbacks para auditoría durable.
 */
export async function borrarPDFTUSEntregados(plan,env,{
 confirmed=false,approved=false,mode='simulacion',fetcher=fetch,audit
}={}){
 if(!plan?.confirmedDelivered||!plan?.paymentVerified||
    !Array.isArray(plan.paths)||!plan.paths.length||
    plan.paths.some(p=>!p.startsWith('v2/'+plan.webOrderId+'/'))||
    plan.bucket!==BUCKET)
  return fail('Plan no validado');
 if(mode!=='execute'||confirmed!==true||approved!==true||
    env?.DOCS_TUS_PURGE_ENABLED!=='PRIVATE_TEST_ONLY')
  return Object.freeze({mode:'simulacion',borrados:0,candidatos:plan.paths.length});
 if(typeof audit!=='function'||typeof env.DOCS_TUS_SUPABASE_SERVICE_KEY!=='string'||
    env.DOCS_TUS_SUPABASE_SERVICE_KEY.length<32)
  return fail('Auditoría o credenciales de Storage ausentes');
 await audit({phase:'before',orderId:plan.commercialOrderId,webOrderId:plan.webOrderId,version:plan.version,count:plan.count});
 // Según API Storage: DELETE /storage/v1/object/{bucket}, JSON {prefixes:[rutas completas]}.
 // Nunca borrar el bucket ni usar SQL directo.
 const url='https://'+PROJECT+'.storage.supabase.co/storage/v1/object/'+BUCKET;
 const answer=await fetcher(url,{method:'DELETE',redirect:'manual',headers:{
   apikey:env.DOCS_TUS_SUPABASE_SERVICE_KEY,
   Authorization:'Bearer '+env.DOCS_TUS_SUPABASE_SERVICE_KEY,
   'Content-Type':'application/json'
  },body:JSON.stringify({prefixes:plan.paths})});
 if(!answer.ok)return fail('Storage rechazó la eliminación');
 const raw=await answer.text();
 if(raw.length>16000)return fail('Respuesta de Storage excesiva');
 let deleted;
 try{deleted=JSON.parse(raw)}catch{return fail('Respuesta de Storage inválida')}
 if(!Array.isArray(deleted))return fail('Respuesta Storage no enumera archivos');
 const names=new Set(deleted.map(x=>x?.name).filter(Boolean));
 // Un archivo ausente o borrado parcialmente no equivale a operación confirmada.
 if(names.size!==plan.paths.length||plan.paths.some(path=>!names.has(path)))
  return fail('No se confirmó el borrado de todos los archivos');
 await audit({phase:'after',orderId:plan.commercialOrderId,webOrderId:plan.webOrderId,version:plan.version,count:plan.count});
 return Object.freeze({mode:'execute',borrados:plan.paths.length,candidatos:plan.paths.length});
}
