/**
 * Agrupa subtotales ya calculados por el único cotizador comercial.
 * No calcula tarifas ni reparte promociones entre trabajos.
 */
const DESTINOS=Object.freeze([
 ['documentos','detalleImpresiones'],['ploteos','detallePloteos'],
 ['stickers','detalleStickers'],['fotos','detalleFotos'],
 ['corte','detalleCortes'],['grafica','detalleGraficas']
]);
const entero=n=>Number.isSafeInteger(n)&&n>=0;

export function resumirSubtotalesTrabajos({cotizacion,trabajos,cantidadArchivos}={}){
 if(!cotizacion||cotizacion.estado!=='PRELIMINAR'||
    !Array.isArray(cotizacion.plan)||!Array.isArray(trabajos)||
    !Number.isSafeInteger(cantidadArchivos)||cantidadArchivos<1||cantidadArchivos>30||
    trabajos.length<1||trabajos.length>10)return null;
 const planPorId=new Map(),trabajoPorIndice=new Map(),consumidos=new Set();
 for(const p of cotizacion.plan){
  if(!p||typeof p.id!=='string'||planPorId.has(p.id)||
     !Number.isSafeInteger(p.indice)||p.indice<0||p.indice>=cantidadArchivos)return null;
  planPorId.set(p.id,p);
 }
 const rows=trabajos.map(w=>{
  if(!w||typeof w.id!=='string'||typeof w.nombre!=='string'||
     !Array.isArray(w.indices)||w.indices.length<1)return null;
  const indices=[...w.indices];
  if(indices.some(i=>!Number.isSafeInteger(i)||i<0||i>=cantidadArchivos||trabajoPorIndice.has(i)))return null;
  for(const i of indices)trabajoPorIndice.set(i,w.id);
  return {id:w.id,nombre:w.nombre,archivos:indices.length,subtotal:0};
 });
 if(rows.some(x=>!x)||trabajoPorIndice.size!==cantidadArchivos)return null;
 const rowPorId=new Map(rows.map(r=>[r.id,r]));
 for(const [destino,field] of DESTINOS){
  const detalles=cotizacion[field];
  if(!Array.isArray(detalles))return null;
  for(const detalle of detalles){
   if(!detalle||typeof detalle.id!=='string'||!entero(detalle.subtotal))return null;
   const plan=planPorId.get(detalle.id),workId=plan&&trabajoPorIndice.get(plan.indice),row=rowPorId.get(workId);
   if(!plan||plan.destino!==destino||!row||consumidos.has(plan.id))return null;
   row.subtotal+=detalle.subtotal;consumidos.add(plan.id);
  }
 }
 for(const armado of cotizacion.detalleArmados||[]){
  if(!armado||!Array.isArray(armado.archivos)||armado.archivos.length<2||!entero(armado.subtotal))return null;
  const plans=armado.archivos.map(id=>planPorId.get(id));
  if(plans.some(p=>!p||p.destino!=='documentos'))return null;
  const workIds=new Set(plans.map(p=>trabajoPorIndice.get(p.indice)));
  if(workIds.size!==1||!rowPorId.has([...workIds][0]))return null;
  rowPorId.get([...workIds][0]).subtotal+=armado.subtotal;
 }
 if(consumidos.size!==cotizacion.plan.length)return null;
 const totalBruto=cotizacion.subtotalImpresiones+cotizacion.subtotalPloteos+
  cotizacion.subtotalStickers+cotizacion.subtotalFotos+
  cotizacion.subtotalCortes+cotizacion.subtotalGraficas;
 if(!entero(totalBruto)||rows.some(r=>!entero(r.subtotal))||
    rows.reduce((n,r)=>n+r.subtotal,0)!==totalBruto)return null;
 return rows.map(r=>Object.freeze({...r,antesDePromocion:cotizacion.promocion?.aplicada===true}));
}
