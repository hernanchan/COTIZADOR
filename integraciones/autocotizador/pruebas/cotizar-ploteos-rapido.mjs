/**
 * Cálculo preliminar de ploteos por metro lineal. Basado exclusivamente en
 * precios-web.json: rollos, ancho físico, CAD/póster, redondeo y mínimo.
 * Sin PDF original verificado; no permite confirmar pedidos ni cobrar.
 */
export function cotizarPloteosRapido({trabajos,precios}){
 const config=precios?.plotter;
 if(!config||!Array.isArray(config.supports))throw Error('Tarifas de ploteo no disponibles.');
 if(!Array.isArray(trabajos)||trabajos.length<1||trabajos.length>30)throw Error('Cantidad de ploteos inválida.');
 const detalles=[];
 let total=0;
 for(const [i,t] of trabajos.entries()){
  if(!t||Object.keys(t).sort().join(',')!=='altoCm,anchoCm,copias,id,material,modo,nombre'||
   t.id!=='pl'+(i+1)||typeof t.nombre!=='string'||!t.nombre.trim()||t.nombre.length>160||
   !['cad','poster'].includes(t.modo)||!Number.isSafeInteger(t.copias)||t.copias<1||t.copias>500||
   !Number.isFinite(t.anchoCm)||!Number.isFinite(t.altoCm)||
   t.anchoCm<=0||t.altoCm<=0||t.anchoCm>2000||t.altoCm>2000)
   throw Error('Medidas u opciones de ploteo inválidas.');
  const soporte=config.supports.find(p=>p.id===t.material);
  if(!soporte)throw Error('Material de ploteo no disponible.');
  // Autoorientación: usar el lado menor como ancho para minimizar consumo.
  const ancho=Math.min(t.anchoCm,t.altoCm),largo=Math.max(t.anchoCm,t.altoCm);
  if(ancho>Number(soporte.widthCm))throw Error('El ploteo supera el ancho del material '+soporte.name+'.');
  const tarifa=Number(t.modo==='cad'?soporte.cadPerMeter:soporte.posterPerMeter);
  const metros=largo/100;
  const metrosFacturables=Math.max(Number(config.minMeters||0),metros);
  const subtotalBruto=metrosFacturables*tarifa*t.copias;
  const redondeo=Number(config.roundTo||1);
  if(!Number.isFinite(tarifa)||tarifa<0||!Number.isFinite(redondeo)||redondeo<=0)throw Error('Tarifa inválida.');
  const subtotal=Math.ceil((subtotalBruto-1e-8)/redondeo)*redondeo;
  total+=subtotal;
  detalles.push({id:t.id,nombre:t.nombre,modo:t.modo,material:t.material,
   materialNombre:soporte.name,anchoCm:t.anchoCm,altoCm:t.altoCm,
   copias:t.copias,metrosLineales:metros,tarifaPorMetro:tarifa,subtotal});
 }
 return {estado:'PRELIMINAR_SIN_VERIFICAR',paymentAuthorized:false,
  total,trabajos:detalles.length,detalles};
}
