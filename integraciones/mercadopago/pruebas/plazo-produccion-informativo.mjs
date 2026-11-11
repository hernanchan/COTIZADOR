/**
 * Plazo público informativo: la Central comparte únicamente la franja vigente,
 * sin fechas exactas inventadas ni acceso a pedidos/datos del comprador.
 * No crea tablas, no modifica D1 y no autoriza pago/producción.
 */
const modes=new Set(['hoy','hoy_tarde','proximo_dia','por_confirmar']);
const safeHeaders={'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow'};
export function plazoInformativo(mode,instant=Date.now()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Argentina/Cordoba',weekday:'short',hour:'2-digit',
  minute:'2-digit',hourCycle:'h23'
 }).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
 const weekday=!['Sat','Sun'].includes(parts.weekday);
 const minute=Number(parts.hour)*60+Number(parts.minute);
 const withinDay=weekday&&minute<20*60;
 let effective=modes.has(mode)?mode:'por_confirmar';
 if(!withinDay&&['hoy','hoy_tarde'].includes(effective))
  effective='por_confirmar';
 const labels={
  hoy:'En el día de hoy, dentro del horario de atención',
  hoy_tarde:'Hoy por la tarde, dentro del horario de atención',
  proximo_dia:'Próximo día de atención',
  por_confirmar:'A confirmar según la disponibilidad del local'
 };
 return {
  ok:true,mode:effective,configuredMode:modes.has(mode)?mode:'por_confirmar',
  heading:'Plazo máximo orientativo de preparación',
  label:labels[effective],
  notice:'Es una previsión, no una hora de retiro garantizada. Se cuenta desde la acreditación del pago y depende de las características del trabajo, la demanda, el horario de atención y los feriados. Una vez que iniciemos la preparación, te informaremos una fecha y hora más precisas.',
  exactReadyAt:null,guaranteed:false,productionAuthorized:false,
  source:'central-delivery-plan-readonly'
 };
}
export async function plazoPublicoCentral(req,env,{now=()=>Date.now()}={}){
 const url=new URL(req.url);
 if(req.method!=='GET'||url.pathname!=='/public/api/plazo-produccion'||
    url.search||url.hash)return Response.json({ok:false,error:'PLAZO_PUBLICO_RUTA'},{status:405,headers:safeHeaders});
 if(typeof env?.DB?.prepare!=='function')
  return Response.json({ok:false,error:'PLAZO_CENTRAL_NO_DISPONIBLE'},{status:503,headers:safeHeaders});
 let mode='por_confirmar';
 try{
  const row=await env.DB.prepare('SELECT mode FROM central_delivery_plan WHERE id=1').first();
  if(typeof row?.mode==='string'&&modes.has(row.mode))mode=row.mode;
 }catch{
  // Si no existe configuración histórica, no atribuir una promesa al comercio.
 }
 return Response.json(plazoInformativo(mode,now()),{status:200,headers:safeHeaders});
}
