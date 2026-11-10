/** Sesión del comprador LIVE independiente de Sandbox.
 * Turnstile -> cookie HttpOnly firmada -> vínculo HMAC por pedido.
 * No crea orden, no habilita pagos ni almacena PDF por sí sola.
 */
const ORIGIN='https://pedidos.libreriasaber.com.ar';
const GATE='GO_COMERCIAL_CONFIRMADO',AGE=3600;
const COOKIE='saber_pedido_live_v1',BIND='saber_pedido_live_order_v1';
const WEB=/^WEB-ENSAYO-[A-F0-9]{32}$/;
const HEX=/^[a-f0-9]{64}$/;
const respond=(v,status=200,headers={})=>Response.json(v,{
 status,headers:{'Cache-Control':'no-store, private',
  'X-Content-Type-Options':'nosniff',...headers}});
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
function active(env){
 return env?.SABER_ENTORNO==='produccion'&&env?.CENTRAL_DB_ENV==='produccion'&&
  env?.DOCS_LIVE_SESSION_GATE===GATE&&
  env?.DOCS_MP_LIVE_GATE===GATE&&
  typeof env?.DOCS_LIVE_SESSION_KEY==='string'&&
  env.DOCS_LIVE_SESSION_KEY.length>=32&&
  ![env.CENTRAL_BRIDGE_KEY,env.DOCS_TURNSTILE_SECRET,env.MP_LIVE_ACCESS_TOKEN]
   .includes(env.DOCS_LIVE_SESSION_KEY)&&
  typeof env?.DOCS_LIVE_TURNSTILE_SECRET==='string'&&
  env.DOCS_LIVE_TURNSTILE_SECRET.length>=20;
}
async function mac(env,message,subtle){
 const key=await subtle.importKey('raw',
  new TextEncoder().encode(env.DOCS_LIVE_SESSION_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(new Uint8Array(await subtle.sign('HMAC',key,
  new TextEncoder().encode(message))));
}
const equal=(a,b)=>{
 if(!HEX.test(a||'')||!HEX.test(b||''))return false;
 let acc=0;for(let i=0;i<a.length;i++)acc|=a.charCodeAt(i)^b.charCodeAt(i);
 return acc===0;
};
function buyerCookie(req){
 const c=req.headers.get('Cookie')||'';
 if(c.length>4096)return null;
 const m=c.match(/(?:^|;\s*)saber_pedido_live_v1=(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})(?=;|$)/);
 return m?{value:m[0].split('=').slice(1).join('='),ts:m[1],nonce:m[2],sig:m[3]}:null;
}
export async function autorizadoCompradorLive(req,env,{
 now=Date.now(),subtle=crypto.subtle
}={}){
 if(!active(env)||new URL(req.url).origin!==ORIGIN)return false;
 const c=buyerCookie(req);
 if(!c)return false;
 const seconds=Math.floor(now/1000),issued=Number(c.ts);
 if(!Number.isSafeInteger(issued)||issued>seconds+30||seconds-issued>AGE)return false;
 return equal(c.sig,await mac(env,'saber-live-comprador-v1\n'+c.ts+'\n'+c.nonce,subtle));
}
export async function vinculoOrdenLive(req,env,webOrderId,{
 now=Date.now(),subtle=crypto.subtle
}={}){
 if(!WEB.test(webOrderId||'')||!await autorizadoCompradorLive(req,env,{now,subtle}))return null;
 const buyer=buyerCookie(req);
 const signature=await mac(env,'saber-live-vinculo-v1\n'+webOrderId+'\n'+buyer.value,subtle);
 return BIND+'='+webOrderId+'.'+signature+
  '; Path=/; Max-Age='+AGE+'; Secure; HttpOnly; SameSite=Strict';
}
export async function autorizadoOrdenLive(req,env,webOrderId,{
 now=Date.now(),subtle=crypto.subtle
}={}){
 if(!WEB.test(webOrderId||'')||!await autorizadoCompradorLive(req,env,{now,subtle}))
  return false;
 const cookie=req.headers.get('Cookie')||'';
 const m=cookie.match(/(?:^|;\s*)saber_pedido_live_order_v1=(WEB-ENSAYO-[A-F0-9]{32})\.([a-f0-9]{64})(?=;|$)/);
 if(!m||m[1]!==webOrderId)return false;
 const buyer=buyerCookie(req);
 return equal(m[2],await mac(env,
  'saber-live-vinculo-v1\n'+webOrderId+'\n'+buyer.value,subtle));
}
export async function iniciarSesionCompradorLive(req,env,{
 fetcher=fetch,subtle=crypto.subtle,now=Date.now(),
 random=()=>crypto.getRandomValues(new Uint8Array(16))
}={}){
 if(!active(env))return respond({ok:false,error:'LIVE_SESION_OFF'},503);
 const u=new URL(req.url);
 if(u.origin!==ORIGIN||u.pathname!=='/api/pedido/live/sesion'||
  req.method!=='POST'||req.headers.get('Origin')!==ORIGIN||
  !/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')||
  (req.headers.get('Sec-Fetch-Site')&&req.headers.get('Sec-Fetch-Site')!=='same-origin'))
  return respond({ok:false,error:'LIVE_SESION_ORIGEN'},403);
 const raw=await req.text();
 if(raw.length>3200)return respond({ok:false,error:'LIVE_SESION_TAMANO'},413);
 let p;try{p=JSON.parse(raw)}catch{}
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).join(',')!=='token'||typeof p.token!=='string'||
  p.token.length<10||p.token.length>2048)
  return respond({ok:false,error:'LIVE_SESION_TOKEN'},422);
 let verified;
 try{
  const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'POST',redirect:'manual',
   body:new URLSearchParams({secret:env.DOCS_LIVE_TURNSTILE_SECRET,response:p.token}),
   signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)return respond({ok:false,error:'LIVE_TURNSTILE_NO_DISPONIBLE'},503);
  verified=await response.json();
 }catch{return respond({ok:false,error:'LIVE_TURNSTILE_NO_DISPONIBLE'},503)}
 if(verified?.success!==true||verified?.hostname!==u.hostname||
  verified?.action!=='saber_pedido_live')
  return respond({ok:false,error:'LIVE_TURNSTILE_INVALIDO'},403);
 const bytes=random();
 if(!(bytes instanceof Uint8Array)||bytes.length!==16)
  return respond({ok:false,error:'LIVE_SESION_RANDOM'},503);
 const ts=String(Math.floor(now/1000)),nonce=hex(bytes);
 const signature=await mac(env,'saber-live-comprador-v1\n'+ts+'\n'+nonce,subtle);
 return respond({ok:true,mode:'live-session',paymentAuthorized:false},200,{
  'Set-Cookie':COOKIE+'='+ts+'.'+nonce+'.'+signature+
   '; Path=/; Max-Age='+AGE+'; Secure; HttpOnly; SameSite=Strict'
 });
}
