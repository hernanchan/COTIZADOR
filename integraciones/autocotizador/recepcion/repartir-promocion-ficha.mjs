/**
 * Distribución comprobable del descuento D1 entre líneas de la ficha firmada.
 * Mantiene el esquema histórico de Central: cada trabajo conserva subtotal
 * neto igual a importeArs y la suma coincide con el total que se cobra.
 * Nunca acepta descuentos del navegador.
 */
const entero=n=>Number.isSafeInteger(n)&&n>=0;
const base=f=>f?.detalle?.subtotal;
const costoImpresion=f=>{
 const d=f.detalle;
 const qty=d?.cantidad,unit=d?.precioUnitario;
 const cost=qty*unit;
 if(!entero(qty)||!entero(unit)||!entero(cost)||cost>d.subtotal)
  throw Error('UNIVERSAL_DESGLOSE_IMPRESION');
 return cost;
};
function pesoPromocion(f,promo,precios){
 const d=f.detalle;
 switch(promo.dia){
  case 0:case 6:return d.subtotal;
  case 1:
   return f.destino==='ploteos'&&d.papelPoster==='obra80'&&
    Array.isArray(d.paginas)&&d.paginas.length>0&&
    d.paginas.every(p=>p.modo==='cad')&&
    d.metrosLineales*d.copias>=2?d.subtotal:0;
  case 2:
   return f.destino==='documentos'?costoImpresion(f):0;
  case 3:{
   if(f.destino!=='fotos')return 0;
   const premium=precios?.photos?.products?.find(p=>p.id===d.productoId);
   if(premium?.paper!=='Luster'||!['10x15','13x18','A4'].includes(premium.size))return 0;
   const normal=precios.photos.products.find(p=>p.paper==='Papel fotográfico'&&p.size===premium.size);
   const ix=precios.photos.scales.findIndex(x=>d.cantidad>=x.from&&(x.to==null||d.cantidad<=x.to));
   const tariff=normal?.prices?.[ix];
   if(!Number.isFinite(tariff)||tariff<0)return 0;
   return Math.max(0,d.subtotal-Math.round(d.cantidad*tariff));
  }
  case 4:
   return f.destino==='documentos'?d.subtotal-costoImpresion(f):0;
  case 5:
   return f.destino==='stickers'&&d.formato==='a3'?d.subtotal:0;
  default:throw Error('UNIVERSAL_PROMOCION_DIA_INVALIDO');
 }
}
export function repartirPromocionFicha({quote,trabajos,armados,precios}={}){
 if(!quote||!Array.isArray(trabajos)||!Array.isArray(armados))
  throw Error('UNIVERSAL_REPARTO_INVALIDO');
 let bruto=0;
 for(const f of trabajos){if(!entero(base(f)))throw Error('UNIVERSAL_LINEA_IMPORTE');bruto+=base(f)}
 for(const a of armados){if(!entero(a?.subtotal))throw Error('UNIVERSAL_ARMADO_IMPORTE');bruto+=a.subtotal}
 if(!entero(bruto))throw Error('UNIVERSAL_BRUTO_INVALIDO');
 const promo=quote.promocion;
 if(!promo){
  if(quote.total!==bruto)throw Error('UNIVERSAL_TOTAL_NO_CONCILIA');
  return {trabajos,armados,totalArs:bruto};
 }
 if(promo.aplicada!==true||promo.fuente!=='tarifario-d1-aprobado'||
   !entero(promo.descuento)||promo.descuento<1||
   promo.totalAnterior!==bruto||promo.totalFinal!==quote.total||
   promo.descuento>bruto||promo.totalFinal!==bruto-promo.descuento)
  throw Error('UNIVERSAL_PROMOCION_IMPORTE_INVALIDO');
 const weights=trabajos.map(f=>pesoPromocion(f,promo,precios));
 // Los anillados conjuntos se descuentan enteros los jueves y,
 // junto al resto de los trabajos, participan del descuento del fin de semana.
 const weightsArmados=armados.map(a=>[0,4,6].includes(promo.dia)?a.subtotal:0);
 const all=[...weights,...weightsArmados];
 if(all.some(x=>!entero(x)))throw Error('UNIVERSAL_PROMOCION_PESOS');
 const sum=all.reduce((a,b)=>a+b,0);
 if(!entero(sum)||sum<promo.descuento)throw Error('UNIVERSAL_PROMOCION_INSUFICIENTE');
 const amounts=new Array(all.length).fill(0);
 let rest=promo.descuento;
 const ix=all.flatMap((w,i)=>w>0?[i]:[]);
 for(const [at,i] of ix.entries()){
  const amount=at===ix.length-1?rest:Math.floor(promo.descuento*all[i]/sum);
  if(!entero(amount)||amount>all[i])throw Error('UNIVERSAL_PROMOCION_DISTRIBUCION');
  amounts[i]=amount;rest-=amount;
 }
 if(rest!==0)throw Error('UNIVERSAL_PROMOCION_REMANENTE');
 const netLines=trabajos.map((f,i)=>{
  const descuento=amounts[i];
  return descuento?{
   ...f,detalle:{...f.detalle,subtotalOriginal:f.detalle.subtotal,
    descuentoPromocion:descuento,subtotal:f.detalle.subtotal-descuento,
    promocionTitulo:promo.titulo},
   importeArs:f.importeArs-descuento
  }:f;
 });
 const netArmados=armados.map((a,i)=>{
  const descuento=amounts[trabajos.length+i];
  return descuento?{...a,subtotalOriginal:a.subtotal,
   descuentoPromocion:descuento,subtotal:a.subtotal-descuento}:a;
 });
 const total=netLines.reduce((n,f)=>n+f.importeArs,0)+
  netArmados.reduce((n,a)=>n+a.subtotal,0);
 if(total!==quote.total)throw Error('UNIVERSAL_PROMOCION_NO_CONCILIA');
 return {trabajos:netLines,armados:netArmados,totalArs:total};
}
