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
