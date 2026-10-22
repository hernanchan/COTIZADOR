const $=id=>document.getElementById(id);
const lista=[];let catalogo=[];
let version=0,controlador=null;
const money=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v);
const dato=(tag,contenido)=>{const el=document.createElement(tag);if(contenido!==undefined)el.textContent=contenido;return el};
function resultado(mensaje){$('resultado').textContent=mensaje}
function pendiente(mensaje='Recalculando…'){
 version++;if(controlador){controlador.abort();controlador=null}
 $('importe').textContent='Por calcular';
 resultado(mensaje);
}
function input(label,tipo,valor,cambio){
 const wrap=dato('label',label),el=document.createElement('input');
 el.type=tipo;el.value=valor;el.min='1';el.max=tipo==='number'?'500':undefined;
 el.addEventListener('change',()=>{cambio(el.value);cotizar()});
 wrap.append(el);return wrap;
}
function selector(label,opciones,actual,cambio){
 const wrap=dato('label',label),el=document.createElement('select');
 for(const [id,nombre] of opciones)el.add(new Option(nombre,id));
 el.value=actual;el.addEventListener('change',()=>{cambio(el.value);cotizar()});
 wrap.append(el);return wrap;
}
function render(){
 const box=$('trabajos');box.replaceChildren();
 lista.forEach((d,i)=>{
  const card=dato('section');card.className='trabajo';
  card.append(dato('h2',(i+1)+'. '+d.nombre));
  const form=dato('div');form.className='controles';
  form.append(selector('Tipo de ploteo',[['cad','Plano CAD'],['poster','Póster / imagen']],d.modo,v=>d.modo=v));
  form.append(selector('Material / ancho de rollo',catalogo.map(x=>[x.id,x.name+' ('+x.widthCm+' cm)']),d.material,v=>d.material=v));
  const ancho=input('Ancho final (cm)','number',String(d.anchoCm),v=>d.anchoCm=Number(v));
  const alto=input('Alto final (cm)','number',String(d.altoCm),v=>d.altoCm=Number(v));
  const copias=input('Copias','number',String(d.copias),v=>d.copias=Number(v));
  for(const e of [ancho,alto]){const x=e.querySelector('input');x.step='0.1';x.max='2000'}
  form.append(ancho,alto,copias);
  card.append(form);
  const quitar=dato('button','Quitar archivo');quitar.type='button';quitar.addEventListener('click',()=>{lista.splice(i,1);render();cotizar()});card.append(quitar);
  box.append(card);
 });
 $('calcular').disabled=!lista.length||!catalogo.length;
}
async function cotizar(){
 pendiente();
 if(!lista.length){resultado('Elegí al menos un PDF para cotizar un ploteo.');return}
 if(!catalogo.length){resultado('Cargando materiales de ploteo.');return}
 const actual=version;const ac=new AbortController();controlador=ac;
 const trabajos=lista.map((d,i)=>({...d,id:'pl'+(i+1)}));
 try{
  const r=await fetch('/api/ensayo-ploteos-rapido',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({trabajos}),signal:ac.signal});
  const res=await r.json();
  if(actual!==version)return;
  if(!r.ok||res.ok!==true||res.paymentAuthorized!==false)throw Error(res.error||'No se pudo cotizar.');
  $('importe').textContent=money(res.resumen.total);
  const cont=$('resultado');cont.replaceChildren();
  cont.append(dato('h2','Detalle del presupuesto preliminar'));
  const list=dato('ol');
  for(const p of res.resumen.detalles){
   const li=dato('li',p.nombre+' · '+p.modo.toUpperCase()+' · '+p.materialNombre+
    ' · '+p.anchoCm+' × '+p.altoCm+' cm · '+p.copias+' copia(s) → '+money(p.subtotal));
   list.append(li);
  }
  cont.append(list,dato('strong','TOTAL ORIENTATIVO: '+money(res.resumen.total)));
  cont.append(dato('p','Medidas declaradas por el cliente: verificar tamaño real y orientación antes de aceptar el pedido.'));
 }catch(e){
  if(actual!==version||e.name==='AbortError')return;
  $('importe').textContent='Sin precio';
  resultado(String(e.message||e));
 }finally{if(actual===version)controlador=null}
}
$('archivosPloteo').addEventListener('change',event=>{
 const fs=Array.from(event.target.files||[]);
 if(lista.length+fs.length>30){resultado('Máximo 30 PDF por presupuesto de ploteos.');return}
 for(const file of fs)lista.push({nombre:file.name,modo:'cad',material:catalogo[0]?.id||'',anchoCm:29.7,altoCm:42,copias:1});
 event.target.value='';render();cotizar();
});
$('calcular').addEventListener('click',cotizar);
async function iniciar(){
 try{
  const r=await fetch('/api/ensayo-materiales-ploteo',{cache:'no-store'});
  const data=await r.json();
  if(!r.ok||!data.ok||!Array.isArray(data.supports)||!data.supports.length)throw Error('Catálogo de ploteos no disponible.');
  catalogo=data.supports;
  for(const d of lista)if(!catalogo.some(p=>p.id===d.material))d.material=catalogo[0].id;
  render();resultado('Configurá el tamaño final de cada PDF; no se calcula automáticamente desde el archivo.');
 }catch(e){resultado('No se pudieron cargar los materiales de ploteo. Recargá la página.')}
}
iniciar();
