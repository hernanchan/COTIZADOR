/** Vista de seguimiento SOLO de la orden ya vinculada y pagada.
 * La identidad del comprador se valida por sesión + HMAC ANTES de esta consulta.
 * Lecturas D1 sin datos personales ni alteración de estados/horas.
 */
const MODES=new Set(['por_confirmar','hoy','hoy_tarde','proximo_dia']);
const STATES=new Set(['pendiente','en_preparacion','en_espera','listo','entregado']);
export async function leerSeguimientoLiveCentral(db,commercialOrderId){
 const base={numeroOrden:null,productionState:'pendiente',readyAt:null,forecastMode:'por_confirmar'};
 const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('central_work_order_numbers','central_live_production_states','central_preparation_estimates','central_delivery_plan')").all();
 const names=new Set((tables?.results||[]).map(row=>row.name));
 if(names.has('central_work_order_numbers')){
  const n=await db.prepare('SELECT number FROM central_work_order_numbers WHERE commercial_order_id=?')
   .bind(commercialOrderId).first();
  if(Number.isSafeInteger(n?.number)&&n.number>0)base.numeroOrden=String(n.number).padStart(3,'0');
 }
 if(names.has('central_live_production_states')){
  const r=await db.prepare('SELECT state FROM central_live_production_states WHERE order_id=?')
   .bind(commercialOrderId).first();
  if(STATES.has(r?.state))base.productionState=r.state;
 }
 if(names.has('central_preparation_estimates')){
  const r=await db.prepare('SELECT ready_at FROM central_preparation_estimates WHERE order_id=?')
   .bind(commercialOrderId).first();
  if(typeof r?.ready_at==='string'&&Number.isFinite(Date.parse(r.ready_at)))
   base.readyAt=new Date(r.ready_at).toISOString();
 }
 if(names.has('central_delivery_plan')){
  const r=await db.prepare('SELECT mode FROM central_delivery_plan WHERE id=1').first();
  if(MODES.has(r?.mode))base.forecastMode=r.mode;
 }
 return base;
}
