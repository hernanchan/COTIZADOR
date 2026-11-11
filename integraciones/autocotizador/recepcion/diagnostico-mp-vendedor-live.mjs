/** Short-lived, credential-protected, read-only Mercado Pago seller health probe.
 * Only invoked from GitHub once. Must not create preferences, orders or payments.
 * When the temporary secret is absent this route is always 404.
 */
const LIVE='GO_COMERCIAL_CONFIRMADO';
const same=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length||a.length!==64)return false;
 let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);
 return n===0;
};
const reply=(x,s=200)=>Response.json(x,{status:s,headers:{
 'Cache-Control':'no-store,private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow','Referrer-Policy':'no-referrer'}});
export async function diagnosticarVendedorMPDesdeDocs(request,env,{service=env?.SABER_CENTRAL}={}){
 const u=new URL(request.url);
 if(u.protocol!=='https:'||u.hostname!=='pedidos.libreriasaber.com.ar'||
    u.pathname!=='/api/pedido/live/diagnostico-mp'||
    u.search||u.hash||request.method!=='POST'||request.headers.has('Origin')||
    env?.SABER_ENTORNO!=='produccion'||env?.DOCS_MP_LIVE_GATE!==LIVE||
    typeof env?.DOCS_LIVE_MP_DIAG_TOKEN!=='string'||
    !/^[a-f0-9]{64}$/.test(env.DOCS_LIVE_MP_DIAG_TOKEN))
  return reply({ok:false,code:'DIAG_CERRADO'},404);
 if(!same(request.headers.get('x-saber-mp-diag'),env.DOCS_LIVE_MP_DIAG_TOKEN))
  return reply({ok:false,code:'DIAG_ACCESO_DENEGADO'},401);
 if(typeof env.CENTRAL_BRIDGE_KEY!=='string'||env.CENTRAL_BRIDGE_KEY.length<32||
    typeof service?.fetch!=='function')return reply({ok:false,code:'DIAG_CONEXION_CENTRAL'},503);
 const body=JSON.stringify({schema:'saber-mp-live-seller-diagnostic-v1',
  purpose:'verificar-cuenta-solo-lectura'});
 const ts=String(Math.floor(Date.now()/1000)),id=crypto.randomUUID();
 const key=await crypto.subtle.importKey('raw',
  new TextEncoder().encode(env.CENTRAL_BRIDGE_KEY),{name:'HMAC',hash:'SHA-256'},
  false,['sign']);
 const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(ts+'\n'+id+'\n'+body))),
   x=>x.toString(16).padStart(2,'0')).join('');
 let upstream;
 try{
  upstream=await service.fetch(new Request(
   'https://pagos.libreriasaber.com.ar/internal/central/live/diag-seller',{
    method:'POST',headers:{
     'Content-Type':'application/json','x-saber-ts':ts,
     'x-saber-request-id':id,'x-saber-signature':sig
    },body}));
 }catch{return reply({ok:false,code:'DIAG_SERVICIO_NO_DISPONIBLE'},503)}
 const result=await upstream.json().catch(()=>null);
 const code=typeof result?.code==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(result.code)?
  result.code:'DIAG_RESPUESTA_NO_VALIDA';
 return reply({ok:upstream.ok&&result?.ok===true,code},upstream.ok?200:503);
}
