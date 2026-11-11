/**
 * Puente de solo lectura Central→comprador. No expone credenciales, orden, D1
 * ni permite introducir una promesa distinta de la configurada por el operador.
 */
const allowedModes=new Set(['hoy','hoy_tarde','proximo_dia','por_confirmar']);
const PAGES=new Map([
 ['/prueba-v2/api/plazo-produccion','https://saber-pagos-pruebas.libreriasaber.workers.dev/public/api/plazo-produccion'],
 ['/api/pedido/plazo','https://pagos.libreriasaber.com.ar/public/api/plazo-produccion']
]);
const reply=(obj,status=200)=>Response.json(obj,{status,headers:{
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow'
}});
export async function plazoProduccionCliente(request,env,{service=env?.SABER_CENTRAL}={}){
 const url=new URL(request.url),target=PAGES.get(url.pathname),live=url.pathname==='/api/pedido/plazo';
 if(!target||request.method!=='GET'||url.search||url.hash||url.protocol!=='https:')
  return reply({ok:false,error:'PLAZO_CLIENTE_RUTA'},405);
 if(live?(env?.SABER_ENTORNO!=='produccion'||
          url.origin!=='https://pedidos.libreriasaber.com.ar'):
         (env?.SABER_ENTORNO==='produccion'||
          !/^https:\/\/saber-documentos-pruebas\.[a-z0-9-]+\.workers\.dev$/.test(url.origin)))
  return reply({ok:false,error:'PLAZO_CLIENTE_ENTORNO'},403);
 if(typeof service?.fetch!=='function')
  return reply({ok:false,error:'PLAZO_CLIENTE_CENTRAL_INDISPONIBLE'},503);
 try{
  const response=await service.fetch(new Request(target,{method:'GET',
   headers:{'Accept':'application/json'}}));
  if(!response.ok)return reply({ok:false,error:'PLAZO_CLIENTE_CENTRAL_INDISPONIBLE'},503);
  const raw=await response.text();
  if(raw.length>1900)return reply({ok:false,error:'PLAZO_CLIENTE_TAMANO_INVALIDO'},502);
  const data=JSON.parse(raw);
  if(data?.ok!==true||data.source!=='central-delivery-plan-readonly'||
     !allowedModes.has(data.mode)||data.guaranteed!==false||
     data.exactReadyAt!==null||data.productionAuthorized!==false||
   !(data.estimatedDeadlineDate===null||
     /^20\d\d-\d\d-\d\d$/.test(data.estimatedDeadlineDate))||
   !(data.dayPromotion==null||(
     typeof data.dayPromotion==='object'&&
     data.dayPromotion?.informationalOnly===true&&
     data.dayPromotion?.appliedToQuote===false&&
     typeof data.dayPromotion?.title==='string'&&
     typeof data.dayPromotion?.summary==='string'&&
     data.dayPromotion.title.length<=90&&data.dayPromotion.summary.length<=180))||
     data.heading!=='Plazo máximo orientativo de preparación'||
     typeof data.label!=='string'||data.label.length>100||
     typeof data.notice!=='string'||data.notice.length>650)
   return reply({ok:false,error:'PLAZO_CLIENTE_CENTRAL_INCONSISTENTE'},502);
  return reply({ok:true,heading:data.heading,label:data.label,
   notice:data.notice,mode:data.mode,
   estimatedDeadlineDate:data.estimatedDeadlineDate,
   dayPromotion:data.dayPromotion,guaranteed:false,exactReadyAt:null});
 }catch{return reply({ok:false,error:'PLAZO_CLIENTE_CENTRAL_INDISPONIBLE'},503)}
}
