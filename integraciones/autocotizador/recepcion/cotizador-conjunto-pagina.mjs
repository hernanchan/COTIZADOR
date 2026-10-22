/** Ensayo conjunto local, no carrito ni autorización de compra. */
export function paginaCotizadorConjunto(){
return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Saber · Ensayo conjunto de impresión y ploteos</title>
<style>*{box-sizing:border-box}body{margin:0;background:#edf3f7;color:#17334b;font:16px system-ui,Arial}main{max-width:1050px;margin:auto;padding:18px}header{position:sticky;top:0;z-index:5;background:#174e75;color:#fff;border-radius:9px;padding:15px}h1{font-size:23px;margin:0 0 8px}header strong{font-size:28px}header p{margin:5px 0}section{background:#fff;border-radius:10px;margin:18px 0;padding:12px}section h2{font-size:20px;margin:4px 6px 12px}iframe{border:1px solid #cedde7;border-radius:8px;width:100%;height:800px;background:white}#ploteos{height:720px}.nota{background:#fff1d7;padding:12px;line-height:1.5}@media(max-width:600px){main{padding:6px}header{border-radius:0}iframe{height:850px}#ploteos{height:760px}}</style></head>
<body><main><header><h1>Presupuesto conjunto · Prueba privada</h1><div id="total" role="status" aria-live="polite"><strong>A cotizar</strong><p>Agregá impresiones A4/A3, ploteos o ambos.</p></div></header>
<p class="nota"><strong>Ensayo preliminar:</strong> los dos módulos conservan sus validaciones y tarifas. Los subtotales se suman únicamente cuando ambos están listos o vacíos. No hay envío de PDF, pedido confirmado ni pagos. El total debe verificarse con los originales antes de cualquier cobro.</p>
<section><h2>1. Impresiones A4/A3 y anillados</h2><iframe id="impresiones" title="Cotización de impresiones" data-ruta="/prueba-cotizador-rapido"></iframe></section>
<section><h2>2. Ploteos CAD y Póster</h2><iframe id="ploteos" title="Cotización de ploteos" data-ruta="/prueba-ploteos-rapido"></iframe></section>
</main><script>
const estados={impresiones:{estado:'pendiente',total:0},ploteos:{estado:'pendiente',total:0}};
const pesos=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
const panel=document.getElementById('total');
function actualizar(){
 const items=Object.values(estados),mal=items.some(x=>x.estado==='error');
 const pendiente=items.some(x=>!['listo','vacio'].includes(x.estado));
 const valor=items.reduce((n,x)=>n+x.total,0);
 const titulo=document.createElement('strong'),detalle=document.createElement('p');
 titulo.textContent=mal?'Revisar presupuestos':pendiente?'Total pendiente':pesos.format(valor);
 detalle.textContent=mal?'Algún módulo necesita corrección. No se muestra un total desactualizado.':pendiente?'Terminá de calcular ambos módulos, si corresponde.':'Impresiones '+pesos.format(estados.impresiones.total)+' + Ploteos '+pesos.format(estados.ploteos.total)+' · Total orientativo';
 panel.replaceChildren(titulo,detalle);
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||!['impresiones','ploteos'].includes(event.data?.modulo)||event.data?.tipo!=='saber-cotizacion-parcial-v1')return;
 const iframe=document.getElementById(event.data.modulo);
 if(event.source!==iframe.contentWindow)return;
 const {estado,total}=event.data;
 if(!['pendiente','calculando','listo','error','vacio'].includes(estado))return;
 if(estado==='listo'&&(!Number.isFinite(total)||total<0))return;
 estados[event.data.modulo]={estado,total:estado==='listo'?total:0};actualizar();
});
// Incrustación privada mediante srcdoc: evita depender de X-Frame-Options de las rutas protegidas.
async function cargarModulo(f){
 try{
  const ruta=f.dataset.ruta;
  const respuesta=await fetch(ruta,{cache:'no-store'});
  if(!respuesta.ok)throw Error('HTTP '+respuesta.status);
  const html=await respuesta.text();
  if(!html.includes('<!doctype html>'))throw Error('Contenido de prueba inválido');
  f.srcdoc=html;
  f.addEventListener('load',()=>{estados[f.id]={estado:'vacio',total:0};actualizar()},{once:true});
 }catch(e){
  estados[f.id]={estado:'error',total:0};actualizar();
  const aviso=document.createElement('p');aviso.textContent='No se pudo cargar el módulo '+f.id+': '+String(e.message||e);
  f.replaceWith(aviso);
 }
}
document.querySelectorAll('iframe').forEach(cargarModulo);
actualizar();
</script></body></html>`;
}
