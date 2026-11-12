/**
 * Plazo público informativo: la Central comparte únicamente la franja vigente,
 * sin fechas exactas inventadas ni acceso a pedidos/datos del comprador.
 * No crea tablas, no modifica D1 y no autoriza pago/producción.
 */
const modes=new Set(['hoy','hoy_tarde','proximo_dia','por_confirmar']);
const safeHeaders={'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow'};
function fechaLocal(instant){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date(instant)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
function calendarioVigente(calendar){
 if(!calendar||typeof calendar!=='object'||!calendar.weekly||
    typeof calendar.weekly!=='object'||!Array.isArray(calendar.closedDates))
  return false;
 return ['mon','tue','wed','thu','fri','sat','sun'].every(k=>
  typeof calendar.weekly[k]==='string')&&
  calendar.closedDates.every(x=>/^20\d\d-\d\d-\d\d$/.test(x));
}
function proximaFechaDeAtencion(mode,instant,calendar){
 if(!calendarioVigente(calendar)||mode==='por_confirmar')return null;
 const today=fechaLocal(instant),first=new Date(today+'T00:00:00Z');
 const closed=new Set(calendar.closedDates);
 const wd=['sun','mon','tue','wed','thu','fri','sat'];
 for(let i=mode==='proximo_dia'?1:0;i<61;i++){
  const day=new Date(first.getTime()+i*86400000),key=day.toISOString().slice(0,10);
  const slots=calendar.weekly[wd[day.getUTCDay()]];
  if(closed.has(key)||!slots){if(i===0&&mode!=='proximo_dia')return null;continue}
  if(i===0){
   const local=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Argentina/Cordoba',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
   }).formatToParts(new Date(instant));
   const get=k=>Number(local.find(p=>p.type===k)?.value||0);
   const n=get('hour')*60+get('minute');
   const endings=slots.split(',').map(s=>s.split('-')[1]).filter(Boolean).map(s=>{
    const [h,m]=s.split(':').map(Number);return h*60+m;
   });
   if(!endings.some(e=>e>n))return null;
  }
  return key;
 }
 return null;
}
export function plazoInformativo(mode,instant=Date.now(),calendar=null){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Argentina/Cordoba',weekday:'short',hour:'2-digit',
  minute:'2-digit',hourCycle:'h23'
 }).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
 const weekday=!['Sat','Sun'].includes(parts.weekday);
 const minute=Number(parts.hour)*60+Number(parts.minute);
 const withinDay=weekday&&minute<20*60;
 const configuredMode=modes.has(mode)?mode:'por_confirmar';
 const todaySelected=['hoy','hoy_tarde'].includes(configuredMode);
 const expiredToday=todaySelected&&!withinDay;
 let effective=configuredMode;
 if(expiredToday)effective='por_confirmar';
 // Si el operador seleccionó explícitamente "hoy", esa previsión es la
 // fuente comercial. Mostrar el día local incluso si falta la agenda D1;
 // nunca inventar una hora ni un "próximo día" sin calendario verificado.
 const promisedDate=(!calendar&&['hoy','hoy_tarde'].includes(effective))?
  fechaLocal(instant):proximaFechaDeAtencion(effective,instant,calendar);
 if((effective==='hoy'||effective==='hoy_tarde')&&calendar&&promisedDate===null)
  effective='por_confirmar';
 const closedToday=todaySelected&&!expiredToday&&effective==='por_confirmar';
 const labels={
  hoy:'En el día de hoy, dentro del horario de atención',
  hoy_tarde:'Hoy por la tarde, dentro del horario de atención',
  proximo_dia:'Próximo día de atención',
  por_confirmar:'A confirmar según la disponibilidad del local'
 };
 return {
  ok:true,mode:effective,configuredMode,
  heading:'Plazo máximo orientativo de preparación',
  label:expiredToday?'La previsión de hoy venció al cerrar el local':
    closedToday?'La previsión de hoy no aplica: día sin atención':labels[effective],
  estimatedDeadlineDate:effective==='por_confirmar'?null:promisedDate,
  calendarVerified:calendarioVigente(calendar),
  notice:expiredToday?'La Central tenía indicado hoy, pero ya terminó el horario de atención. No sería correcto prometer una entrega vencida. Consultanos antes de pagar para conocer la próxima fecha estimada.':
    closedToday?'La Central tenía indicado hoy, pero el calendario registra un cierre o feriado. Consultanos antes de pagar para confirmar una nueva fecha.':
    'Es una previsión, no una hora de retiro garantizada. Se cuenta desde la acreditación del pago y depende de las características del trabajo, la demanda, el horario de atención y los feriados. Una vez que iniciemos la preparación, te informaremos una fecha y hora más precisas.',
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
 let mode='por_confirmar',calendar=null,dayPromotion=null;
 try{
  const row=await env.DB.prepare('SELECT mode FROM central_delivery_plan WHERE id=1').first();
  if(typeof row?.mode==='string'&&modes.has(row.mode))mode=row.mode;
 }catch{
  // Si no existe configuración histórica, no atribuir una promesa al comercio.
 }
 try{
  const row=await env.DB.prepare(
   'SELECT weekly_json,closed_json FROM central_eta_calendar WHERE id=1'
  ).first();
  if(row){
   const value={weekly:JSON.parse(row.weekly_json),closedDates:JSON.parse(row.closed_json)};
   if(calendarioVigente(value))calendar=value;
  }
 }catch{calendar=null}
 try{
  const row=await env.DB.prepare('SELECT approved_json FROM central_pricing_admin_head WHERE id=1').first();
  const weekly=JSON.parse(row?.approved_json||'null')?.promotions;
  if(weekly?.enabled===true&&Array.isArray(weekly.weekly)){
   const dayName=new Intl.DateTimeFormat('en-US',{timeZone:'America/Argentina/Cordoba',
    weekday:'short'}).format(new Date(now()));
   const weekIndex={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[dayName];
   const promo=weekly.weekly.find(p=>p.day===weekIndex&&p.enabled===true);
   if(promo&&typeof promo.title==='string'&&typeof promo.summary==='string'&&
      promo.title.length<=90&&promo.summary.length<=180)
    dayPromotion={title:promo.title,summary:promo.summary,
     appliedToQuote:false,informationalOnly:true};
  }
 }catch{dayPromotion=null}
 return Response.json({...plazoInformativo(mode,now(),calendar),dayPromotion},
  {status:200,headers:safeHeaders});
}
