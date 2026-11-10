/**
 * Instalación opcional, cerrada. Lee token LIVE de un secreto de CI, consulta
 * GET /users/me y guarda credenciales SOLO en saber-pagos-produccion.
 * NUNCA modifica sandbox, configura webhook ni activa cobros.
 */
const account=process.env.SABER_CF_ACCOUNT_ID;
const cfToken=process.env.SABER_CF_DEPLOY_TOKEN;
const mpToken=process.env.SABER_MP_LIVE_ACCESS_TOKEN;
const root=account&&'https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/saber-pagos-produccion';
const headers={Authorization:'Bearer '+cfToken};
function fail(msg){throw Error(msg)}
async function cf(url,opts={}){
 const response=await fetch(url,{...opts,headers:{...headers,...opts.headers},signal:AbortSignal.timeout(25000)});
 const value=await response.json().catch(()=>null);
 if(!response.ok||value?.success!==true)
  fail('CLOUDFLARE_API_RECHAZO_'+response.status);
 return value.result;
}
if(!/^[a-f0-9]{32}$/i.test(account||'')||!cfToken||!root)
 fail('CONFIGURACION_CLOUDFLARE_FALTANTE');
if(!mpToken){
 console.log('MP_LIVE_ACCESS_TOKEN_AUN_NO_CARGADO_NO_CAMBIOS');
 process.exit(0);
}
if(!/^APP_USR-[A-Za-z0-9_-]{20,}$/.test(mpToken))
 fail('TOKEN_MP_LIVE_INVALIDO_NO_CAMBIOS');
const before=await cf(root+'/settings');
const bindings=before?.bindings;
if(!Array.isArray(bindings)||
  !bindings.some(x=>x.name==='MP_LIVE_GATE'&&x.text==='NO_GO')||
  !bindings.some(x=>x.name==='SABER_ENTORNO'&&x.text==='preparacion')||
  !bindings.some(x=>x.name==='CENTRAL_DB_ENV'&&x.text==='produccion')||
  !bindings.some(x=>x.name==='CENTRAL_BRIDGE_KEY'&&x.type==='secret_text'))
 fail('WORKER_PRODUCCION_NO_ESTA_CERRADO');
if(bindings.some(x=>x.name==='MP_LIVE_ACCESS_TOKEN'||x.name==='MP_LIVE_SELLER_ID'))
 fail('MP_LIVE_CREDENCIALES_EXISTENTES_NO_SOBRESCRIBIR');
const subdomain=await cf(root+'/subdomain');
if(subdomain.enabled!==false||subdomain.previews_enabled!==false)
 fail('WORKER_CENTRAL_INCORRECTAMENTE_PUBLICO');
const sellerResponse=await fetch('https://api.mercadopago.com/users/me',{
 headers:{Authorization:'Bearer '+mpToken,'Accept':'application/json'},
 redirect:'error',signal:AbortSignal.timeout(15000)
});
if(!sellerResponse.ok)fail('MERCH_ID_NO_AUTORIZADO_HTTP_'+sellerResponse.status);
const seller=await sellerResponse.json().catch(()=>null);
const id=String(seller?.id??'');
if(!/^[1-9][0-9]{3,19}$/.test(id)||seller?.site_id!=='MLA'||
  (Array.isArray(seller?.tags)&&seller.tags.includes('test_user')))
 fail('MP_LIVE_VENDEDOR_NO_VALIDADO');
console.log('MP_LIVE_SELLER_REAL_ARGENTINA_VALIDADO_SIN_EXPOSICION_DE_DATOS');
const installed=[];
try{
 for(const [name,value] of [['MP_LIVE_ACCESS_TOKEN',mpToken],['MP_LIVE_SELLER_ID',id]]){
  await cf(root+'/secrets',{method:'PUT',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({name,text:value,type:'secret_text'})});
  installed.push(name);
 }
 const after=await cf(root+'/settings');
 for(const name of installed){
  if(!after.bindings?.some(x=>x.name===name&&x.type==='secret_text'))
   fail('SECRET_MP_LIVE_NO_CONFIRMADO_'+name);
 }
 if(!after.bindings?.some(x=>x.name==='MP_LIVE_GATE'&&x.text==='NO_GO')||
    !after.bindings?.some(x=>x.name==='SABER_ENTORNO'&&x.text==='preparacion'))
  fail('GATE_CLOUDFLARE_HA_CAMBIADO');
 const stillPrivate=await cf(root+'/subdomain');
 if(stillPrivate.enabled!==false||stillPrivate.previews_enabled!==false)
  fail('WORKER_CENTRAL_PUBLICO_DESPUES_DEL_CAMBIO');
 console.log('MP_LIVE_TOKEN_Y_VENDEDOR_GUARDADOS_SOLO_EN_CENTRAL_PRODUCCION');
 console.log('MP_LIVE_WEBHOOK_Y_CHECKOUT_AUN_NO_CONFIGURADOS_GATE_NO_GO');
}catch(e){
 console.log('MP_LIVE_INSTALACION_INCOMPLETA_REVOCANDO_SECRETS_NUEVOS');
 for(const name of installed.reverse()){
  try{await cf(root+'/secrets/'+name,{method:'DELETE'});}
  catch{console.log('MP_LIVE_LIMPIEZA_NO_CONFIRMADA_'+name)}
 }
 throw e;
}
