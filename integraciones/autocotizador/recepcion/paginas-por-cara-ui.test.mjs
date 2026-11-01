import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('./carga-unica-cliente.mjs',import.meta.url),'utf8');
const page=readFileSync(new URL('./carga-unica-pagina.mjs',import.meta.url),'utf8');
const start=src.indexOf('function selectorPaginasPorCara(');
const end=src.indexOf('\nfunction cantidadCopias(',start);
assert.ok(start>=0&&end>start,'Falta el selector real por PDF');
const functionCode=src.slice(start,end);

function simulate(numero,indice=2){
 const changed=[];
 const doc={createElement(tag){
  return {tag,className:'',children:[],append(...x){this.children.push(...x)}};
 }};
 const texto=(tag,label)=>({tag,textContent:label});
 const change=()=>changed.push(numero.paginasPorHoja);
 const crear=new Function('document','texto','cambio',functionCode+';return selectorPaginasPorCara;');
 const field=crear(doc,texto,change)(numero,indice);
 const principales=field.children[1].children;
 const advanced=field.children[2],extras=advanced.children[1].children;
 return {field,principales,advanced,extras,changed};
}
test('por defecto se ofrecen 1 y 2 páginas, 4 y 9 permanecen en opciones avanzadas',()=>{
 for(const formato of ['a4','a3','a5','personalizado_a4']){
  const job={formatoFinal:formato,paginasPorHoja:1};
  const x=simulate(job);
  assert.equal(x.field.tag,'fieldset');
  assert.equal(x.field.children[0].textContent,'Páginas por cara');
  assert.deepEqual(x.principales.map(x=>x.children[0].value),['1','2']);
  assert.equal(x.principales[0].children[0].checked,true);
  assert.equal(x.principales[1].children[0].checked,false);
  assert.deepEqual(x.extras.map(x=>x.children[0].value),['4','9']);
  assert.equal(x.advanced.open,false);
  assert.equal(x.advanced.children[0].textContent,'Más opciones (4 o 9 páginas por cara)');
 }
});
test('elegir 2 páginas modifica la misma opción que cotiza y activa recálculo',()=>{
 const job={paginasPorHoja:1},x=simulate(job,7);
 const selected=x.principales[1].children[0];
 assert.equal(selected.name,'paginas-por-cara-7');
 selected.checked=true;
 selected.onchange();
 assert.equal(job.paginasPorHoja,2);
 assert.deepEqual(x.changed,[2]);
 const refreshed=simulate(job,7);
 assert.equal(refreshed.principales[1].children[0].checked,true);
 assert.equal(refreshed.advanced.open,false);
});
test('4 o 9 siguen disponibles y quedan visibles si se seleccionaron antes',()=>{
 for(const n of [4,9]){
  const job={paginasPorHoja:n};
  const x=simulate(job);
  assert.equal(x.advanced.open,true);
  assert.equal(x.advanced.children[0].textContent,n+' páginas por cara · Más opciones');
  const selected=x.extras.find(row=>row.children[0].value===String(n));
  assert.equal(selected.children[0].checked,true);
  const regular=x.principales[0].children[0];
  regular.checked=true;regular.onchange();
  assert.equal(job.paginasPorHoja,1);
  assert.equal(simulate(job).advanced.open,false);
 }
});
test('N-up figura en resumen de cada PDF, presupuesto y ficha sin afectar ploteos',()=>{
 assert.ok(src.includes("e.paginasPorHoja??1)>1"));
 assert.ok(src.includes("paginasPorHoja:e.paginasPorHoja??1"));
 assert.ok(src.includes("plan.destino==='documentos'"));
 assert.ok(src.includes("else if(decision.destino==='documentos')"));
 assert.match(page,/composicion-por-cara/);
 assert.match(page,/composicion-avanzada/);
 assert.ok(page.includes('Con doble faz')===false,'La frase debe quedar en el cliente, no en la plantilla');
});


test('selector VISIBLE fuera de Más opciones: se monta antes del retorno de panel cerrado',()=>{
 const placement=src.indexOf('mostrarSelectorRapido(card,e,i);');
 const hidden=src.indexOf('if(abierto!==i){bloque.append(card);continue}');
 assert.ok(placement>0&&hidden>placement,'El selector debe estar montado fuera y ANTES del panel cerrado');
 const start=src.indexOf('function mostrarSelectorRapido(');
 const end=src.indexOf('\nfunction cantidadCopias(',start);
 assert.ok(start>0&&end>start);
 const creates=[];
 const card={children:[],append(child){this.children.push(child)}};
 const docJob={servicio:'auto',paginas:[{anchoCm:21,altoCm:29.7}],seleccion:'a4',paginasPorHoja:1};
 const selectorPaginasPorCara=()=>({classList:{add(s){creates.push(s)}},type:'selector'});
 const paginasElegidas=e=>e.paginas;
 const clasificarDestino=(_pages,selected)=>selected==='a4'
  ?{confirmado:true,destino:'documentos'}
  :selected==='original'?{confirmado:true,destino:'ploteo'}
  :{confirmado:false,destino:null};
 const mount=new Function('paginasElegidas','clasificarDestino','selectorPaginasPorCara',
  src.slice(start,end)+';return mostrarSelectorRapido;')(paginasElegidas,clasificarDestino,selectorPaginasPorCara);
 mount(card,docJob,0);
 assert.equal(card.children.length,1,'El selector debe existir aun cuando el detalle no se abra');
 assert.deepEqual(creates,['composicion-visible']);
 docJob.paginasPorHoja=2;
 mount(card,docJob,0);
 assert.equal(card.children.length,2,'Debe seguir disponible tras elegir dos páginas');
 mount(card,{...docJob,servicio:'fotos'},1);
 mount(card,{...docJob,seleccion:'original'},2);
 assert.equal(card.children.length,2,'Excluir fotos y ploteos');
 // Caso REAL reportado: 14 páginas de 14×20 cm pendientes del tamaño final,
 // sin abrir detalles: el cliente debe ver 1 o 2 inmediatamente.
 const pendiente={...docJob,seleccion:'sin-confirmar',
  paginas:Array.from({length:14},(_,i)=>({numero:i+1,anchoCm:14,altoCm:20}))};
 mount(card,pendiente,3);
 assert.equal(card.children.length,3,'NO ocultar 2 páginas mientras se pregunta por tamaño (14 × 20 cm)');
 assert.ok(card.children[2].type==='selector');
 mount(card,{...pendiente,paginas:[{anchoCm:29.7,altoCm:42}]},4);
 assert.equal(card.children.length,4,'A3 pendiente también permite 1 o 2 páginas');
 mount(card,{...pendiente,paginas:[{anchoCm:84.1,altoCm:118.9}]},5);
 assert.equal(card.children.length,4,'No anticipar opción de 2 páginas en ploteo A0');
 assert.ok(src.includes("e.seleccion==='sin-confirmar'&&enA3"),'La regla no debe requerir tamaño final para mostrar 1/2');
 assert.ok(page.includes('.composicion-visible{'));
 assert.ok(page.includes('.archivo .composicion-opcion{'));
 assert.ok(!page.includes('.panel-edicion .composicion-opcion{'));
});
