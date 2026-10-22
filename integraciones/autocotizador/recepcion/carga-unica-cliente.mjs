import {leerMedidasPloteo} from './medidas-local-pdf.mjs';
import {clasificarDestino} from './destino-impresion.mjs';
const $=id=>document.getElementById(id);
const entries=[];
let leyendo=false;
const texto=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n};
function render(){
 const lista=$('lista');lista.replaceChildren();
 for(const [i,e] of entries.entries()){
  const card=texto('section','');card.className='archivo';
  card.append(texto('h3',(i+1)+'. '+e.name));
  if(e.error){card.append(texto('p','Error: '+e.error));lista.append(card);continue}
  if(!e.paginas){card.append(texto('p','Analizando medidas…'));lista.append(card);continue}
  const multiples=e.paginas.length>1;
  const medidas=e.paginas.map(p=>p.anchoCm.toFixed(2)+' × '+p.altoCm.toFixed(2)+' cm');
  card.append(texto('p','Tamaño original: '+(new Set(medidas).size===1?medidas[0]:(multiples?'Varios tamaños · '+[...new Set(medidas)].join(' / '):medidas[0]))+' · '+e.paginas.length+' página(s)'));
  const aviso=clasificarDestino(e.paginas);
  if(aviso.requiereConfirmacion)card.append(texto('p','Importante: confirmá el tamaño final. El tamaño del PDF no determina por sí solo el precio.'));
  const label=texto('label','Quiero imprimir en: ');
  const sel=document.createElement('select');sel.setAttribute('aria-label','Tamaño final de '+e.name);
  for(const [v,l] of [['sin-confirmar','Elegir tamaño final'],['original','Mantener tamaño original'],['a3','A3 (29,7 × 42 cm)'],['a4','A4 (21 × 29,7 cm)'],['a5','A5 (14,8 × 21 cm)']]){
   const o=new Option(l,v);sel.add(o);
  }
  sel.value=e.seleccion;sel.onchange=()=>{e.seleccion=sel.value;render()};label.append(sel);card.append(label);
  const decision=clasificarDestino(e.paginas,e.seleccion);
  if(decision.confirmado){
   card.append(texto('p','Destino: '+(decision.destino==='ploteo'?'Ploteos CAD/Póster':'Impresiones de documentos')+' · Tamaño final: '+(decision.tamanoFinal==='original'?'original':decision.tamanoFinal.toUpperCase())));
   if(decision.cambioEscala)card.append(texto('p','Se ajustará proporcionalmente sin recortar. Verificar legibilidad y escala, especialmente en planos CAD.'));
   if(decision.mixtas&&decision.tamanoFinal==='original')card.append(texto('p','El PDF contiene tamaños distintos. Se conservarán individualmente al presupuestar.'));
  }else card.append(texto('p','Sin precio hasta confirmar el tamaño final.'));
  lista.append(card);
 }
 $('estado').textContent=leyendo?'Analizando archivos…':entries.length?'Identificados '+entries.length+' PDF. Esta pantalla todavía no calcula precios: prepara decisiones para el cotizador definitivo.':'Seleccioná tus PDF para comenzar.';
}
$('archivos').addEventListener('change',async ev=>{
 if(leyendo)return;
 const files=[...(ev.target.files||[])];ev.target.value='';
 if(entries.length+files.length>30){$('estado').textContent='Máximo 30 PDF.';return}
 leyendo=true;
 for(const f of files)entries.push({name:f.name,paginas:null,seleccion:'sin-confirmar',error:null});
 render();
 const start=entries.length-files.length;
 for(let i=0;i<files.length;i++){
  const e=entries[start+i];
  try{
   const x=await leerMedidasPloteo(files[i],{maxPaginas:2000});
   e.paginas=x.paginas;
   const suggested=clasificarDestino(e.paginas);
   // No adivinar tamaño final, incluso cuando el PDF parece A4.
   e.requiereConfirmacion=suggested.requiereConfirmacion;
  }catch(ex){e.error=String(ex.message||ex)}
  render();
 }
 leyendo=false;render();
});
render();
