import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {paginaCargaUnica} from '../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs';
const leer=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const ui=leer('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs');
const source=leer('../integraciones/autocotizador/recepcion/paquete-tus-cliente.txt');
const pre=source.slice(source.indexOf('function clean(v)'),source.indexOf('async function fetchFicha()'));
const ctx=vm.createContext({});
vm.runInContext(pre+'\n globalThis.resumir=resumirGruposAnillado;globalThis.filas=formatoOrden;',ctx);
function pdf(orden,n,{grupo='1',caras='simple',nup=1,copias=2,formato='a4',tipo='grupo'}={}){
 return {orden,nombreOriginal:'Apunte '+orden+'.pdf',servicio:'documentos',
  paginasOriginales:n,paginasElegidas:Array.from({length:n},(_,i)=>i+1),
  copias,formatoFinal:formato,modo:'bn',carasPresupuestadas:caras,
  paginasPorCaraPresupuestadas:nup,tipoAnillado:tipo,grupoAnillado:tipo==='grupo'?grupo:null};
}
test('editor permite grupos y orden sin alterar el boton de enviar',()=>{
 const html=paginaCargaUnica();
 assert.match(html,/id="anilladosConjuntos" hidden/);
 assert.ok(html.indexOf('id="anilladosConjuntos"')<html.indexOf('id="lista"'));
 for(const k of ['Anillar todos juntos','Junto · Grupo ','Subir','Bajar','renderAnilladosConjuntos',
  'entries.splice','anilladosAbierto=true;cambio()','Sin anillado','Individual'])
  assert.ok(ui.includes(k),k);
 assert.match(ui,/renderConfiguracionGlobal\(\);\s*renderAnilladosConjuntos\(\);/);
 assert.match(ui,/function cambio\(\)\{version\+\+;render\(\);cotizar\(\)\}/);
});
test('tres PDF: nueve hojas fisicas por juego y dos anillados, orden ZIP',()=>{
 // 8 paginas / 2 por cara / doble faz = 2 hojas;
 // 5 paginas simple = 5 hojas; 3 paginas doble = 2 hojas; total 9.
 const docs=[pdf(1,8,{caras:'double',nup:2}),pdf(2,5),pdf(3,3,{caras:'double'})];
 const g=ctx.resumir(docs).get('1');
 assert.equal(g.valido,true);assert.equal(g.juegos,2);assert.equal(g.hojasPorJuego,9);
 assert.match(g.orden,/PDF_01\.pdf.*PDF_02\.pdf.*PDF_03\.pdf/);
 const filas=ctx.filas(docs[0],0,ctx.resumir(docs));
 assert.ok(filas.some(([k,v])=>k==='Hojas físicas de cada anillado'&&v===9));
 assert.ok(filas.some(([k,v])=>k==='Cantidad de anillados de este grupo'&&v===2));
 assert.ok(filas.some(([k,v])=>k==='Orden de armado del grupo 1'&&v.includes('PDF_03.pdf')));
});
test('dos grupos independientes y un trabajo suelto',()=>{
 const docs=[pdf(1,10),pdf(2,12,{tipo:'ninguno'}),pdf(3,9),
  pdf(4,4,{grupo:'2',copias:1}),pdf(5,4,{grupo:'2',copias:1})];
 const grupos=ctx.resumir(docs);
 assert.equal(grupos.get('1').hojasPorJuego,19);
 assert.equal(grupos.get('2').hojasPorJuego,8);
 assert.match(grupos.get('1').orden,/PDF_01\.pdf.*PDF_03\.pdf/);
 assert.doesNotMatch(grupos.get('1').orden,/PDF_02\.pdf/);
});
test('grupos incompletos e historicos no inventan hojas ni cantidades',()=>{
 for(const docs of [[pdf(1,10)],[pdf(1,5),pdf(2,10,{copias:1})],
 [pdf(1,5),pdf(2,10,{formato:'a3'})],
 [pdf(1,4),{...pdf(2,4),paginasPorCaraPresupuestadas:null}]]){
  assert.equal(ctx.resumir(docs).get('1').valido,false);
 }
 const old=ctx.filas(pdf(1,4),0);
 assert.ok(old.some(([k,v])=>k==='Anillado después de imprimir'&&v.includes('confirmar integrantes')));
});
