/** Promoción semanal del tarifario APROBADO D1.
 * Se aplica EN SERVIDOR al mismo importe que recibe el borrador/orden.
 * Una promoción anunciada en un portal no equivale a descuento aprobado.
 */
const DAY={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
const indice=now=>DAY[new Intl.DateTimeFormat('en-US',{
 timeZone:'America/Argentina/Cordoba',weekday:'short'
}).format(new Date(now))];
const porcentaje=(base,n)=>Number.isFinite(n)&&n>0&&n<=50?
 Math.round(base*n/100):0;
const seguro=n=>Number.isSafeInteger(n)&&n>=0?n:0;
export function promocionSemanalCotizacion({
 promociones,precios,detalleImpresiones=[],detallePloteos=[],
 detalleStickers=[],detalleFotos=[],subtotalImpresiones=0,subtotalAnillados=0,
 subtotalPloteos=0,subtotalStickers=0,subtotalFotos=0,
 subtotalCortes=0,subtotalGraficas=0,ahora=Date.now()
}={}){
 const total=seguro(subtotalImpresiones)+seguro(subtotalPloteos)+
  seguro(subtotalStickers)+seguro(subtotalFotos)+seguro(subtotalCortes)+
  seguro(subtotalGraficas);
 if(promociones?.enabled!==true||!Array.isArray(promociones.weekly))
  return null;
 const day=indice(ahora);
 const promo=promociones.weekly.find(p=>p?.day===day&&p.enabled===true);
 if(!promo||typeof promo.title!=='string'||promo.title.length>90||
    typeof promo.summary!=='string'||promo.summary.length>180)return null;
 let descuento=0;
 if(day===0||day===6){
  if(promo.kind==='percent')descuento=porcentaje(total,promo.percent);
 }else if(day===1&&promo.kind==='percent'){
  // CAD sobre papel obra; mínimo por trabajo incluido el número de copias.
  for(const x of detallePloteos){
   if(x.papelPoster==='obra80'&&Array.isArray(x.paginas)&&
      x.paginas.length>0&&x.paginas.every(p=>p.modo==='cad')&&
      x.metrosLineales*x.copias>=Number(promo.minMeters||2))
    descuento+=porcentaje(seguro(x.subtotal),promo.percent);
  }
 }else if(day===2&&promo.kind==='percent'){
  // Sólo impresiones, no el cargo de anillado.
  descuento=porcentaje(Math.max(0,seguro(subtotalImpresiones)-seguro(subtotalAnillados)),promo.percent);
 }else if(day===3&&promo.kind==='premium_to_normal'){
  for(const foto of detalleFotos){
   const premium=precios?.photos?.products?.find(p=>p.id===foto.productoId);
   if(premium?.paper!=='Luster'||!['10x15','13x18','A4'].includes(premium.size))continue;
   const normal=precios.photos.products.find(p=>p.paper==='Papel fotográfico'&&p.size===premium.size);
   const scale=precios.photos.scales.findIndex(x=>foto.cantidad>=x.from&&
    (x.to==null||foto.cantidad<=x.to));
   if(scale<0||!Number.isFinite(normal?.prices?.[scale]))continue;
   descuento+=Math.max(0,seguro(foto.subtotal)-Math.round(foto.cantidad*normal.prices[scale]));
  }
 }else if(day===4&&promo.kind==='free_binding'){
  descuento=seguro(subtotalAnillados);
 }else if(day===5&&promo.kind==='percent'){
  descuento=detalleStickers.reduce((n,x)=>n+(x.formato==='a3'?
   porcentaje(seguro(x.subtotal),promo.percent):0),0);
 }
 descuento=Math.min(total,seguro(descuento));
 if(!descuento)return null;
 return Object.freeze({
  dia:day,titulo:promo.title,descripcion:promo.summary,
  totalAnterior:total,descuento,totalFinal:total-descuento,
  fuente:'tarifario-d1-aprobado',aplicada:true
 });
}
