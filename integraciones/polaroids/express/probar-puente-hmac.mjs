/**
 * Ensayo HMAC real, exclusivo de Pages Express aislado.
 * No usa fotos, GAS, D1 ni checkout. No altera la recepción.
 * La Central debe rechazar con 422 un manifiesto firmado pero deliberadamente inválido.
 */
const CENTRAL_HOST=/^saber-pagos-pruebas\.[a-z0-9-]+\.workers\.dev$/;
const MARKER='saber-polaroids-express-bridge-check-v1';
const respond=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}
});
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
function same(a,b) {
  if(typeof a!=='string'||typeof b!=='string')return false;
  const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
  let difference=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++)difference|=(x[i]||0)^(y[i]||0);
  return difference===0;
}
export async function onRequestPost({
  request,env,fetcher=fetch,subtle=crypto.subtle,
  now=()=>Math.floor(Date.now()/1000),newId=()=>crypto.randomUUID()
}) {
  const url=new URL(request.url);
  const expectedHost='saber-polaroids-express-pruebas.pages.dev';
  if(request.method!=='POST'||url.protocol!=='https:'||url.hostname!==expectedHost||
    url.port||request.headers.get('Origin')!==url.origin||
    (request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin'))
    return respond({ok:false,error:'Solicitud no autorizada'},403);
  if(env?.EXPRESS_ALLOWED_HOST!==expectedHost||
    env.EXPRESS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'||
    typeof env.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    env.CENTRAL_BRIDGE_KEY===env.EXPRESS_PDF_HMAC_KEY)
    return respond({ok:false,error:'Puente de pruebas no configurado'},503);
  const supplied=request.headers.get('Authorization')||'';
  if(!supplied.startsWith('Bearer ')||!same(supplied.slice(7),env.CENTRAL_BRIDGE_KEY))
    return respond({ok:false,error:'Acceso restringido al operador'},401);
  let dest;
  try{dest=new URL(env.CENTRAL_EXPRESS_URL)}
  catch{return respond({ok:false,error:'Destino de Central no configurado'},503)}
  if(dest.protocol!=='https:'||!CENTRAL_HOST.test(dest.hostname)||dest.port||
    dest.username||dest.password||dest.search||dest.hash||
    dest.pathname!=='/internal/central/polaroid-stage')
    return respond({ok:false,error:'Destino de Central no autorizado'},503);
  // Cumple el tamaño requerido por centralReadSigned, pero nunca satisface
  // centralPolaroidSafe. Una firma válida => HTTP 422; D1 no se consulta ni escribe.
  const body=JSON.stringify({schema:MARKER,invalid:true});
  const ts=now(),requestId=newId();
  if(!Number.isSafeInteger(ts)||!Number.isSafeInteger(Date.now())||
     !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))
    return respond({ok:false,error:'No se pudo preparar firma'},500);
  const key=await subtle.importKey('raw',new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=hex(new Uint8Array(await subtle.sign('HMAC',key,
    new TextEncoder().encode(ts+'\n'+requestId+'\n'+body))));
  try{
    const result=await fetcher(dest.href,{method:'POST',headers:{
      'Content-Type':'application/json',
      'x-saber-ts':String(ts),'x-saber-request-id':requestId,
      'x-saber-signature':signature
    },body,redirect:'error',signal:AbortSignal.timeout(12000)});
    // Sólo esta combinación prueba que HMAC pasó y el esquema fue rechazado.
    if(result.status!==422)
      return respond({ok:false,signedConnection:false,centralStatus:result.status,
        writes:false},502);
    const text=await result.text();
    let answer;try{answer=JSON.parse(text)}catch{return respond({
      ok:false,signedConnection:false,error:'Respuesta central inválida',writes:false},502)}
    if(answer?.error!=='Recibo Express no válido')
      return respond({ok:false,signedConnection:false,error:'Rechazo no identificado',writes:false},502);
    return respond({ok:true,signedConnection:true,centralStatus:422,
      writes:false,photosSent:false,paymentsEnabled:false});
  }catch{return respond({ok:false,signedConnection:false,
    error:'Sin comunicación HTTPS con la Central',writes:false},502)}
}
export async function onRequestGet(){return respond({ok:false,error:'Método no permitido'},405);}
