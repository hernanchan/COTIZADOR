import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {opcionesTipoPloteo,elegirTipoPloteo} from '../integraciones/autocotizador/recepcion/eleccion-ploteo-cad-pleno.mjs';
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';
const src=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');
const prices=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const cotizar=e=>cotizarCargaUnica({archivos:[Object.fromEntries(Object.entries(e).filter(([key])=>!['clasificacionAutomatica','tipoPloteoElegidoPorCliente'].includes(key)))],precios:prices});
function ui(e){
 const begin=src.indexOf('    const eleccion=opcionesTipoPloteo(elegidas,e.seleccion);');
 const end=src.indexOf("     principal.append(bloque);\n    }",begin);
 assert.ok(begin>0&&end>begin);
 const js=src.slice(begin,end+"     principal.append(bloque);\n    }".length);
 const all=[];
 function node(tag,label=''){
  const n={tag,textContent:label,children:[],attributes:{},append(...items){this.children.push(...items)},
   setAttribute(k,v){this.attributes[k]=v}};
  all.push(n);return n;
 }
 const eDoc=e;
 const principal=node('main');
 let changes=0;
 const f=new Function('e','elegidas','principal','opcionesTipoPloteo','document',
  'texto','valor','cambio','elegirTipoPloteo','WHATSAPP_CONSULTAS_SABER','unicas',
  js+';return principal;');
 f(eDoc,e.paginas,principal,opcionesTipoPloteo,{createElement:tag=>node(tag)},
  (tag,label)=>node(tag,label),
  (name,opts,current,cb)=>node('label',name+': '+current),
  ()=>{changes++},elegirTipoPloteo,'5493513110130',['52,99 × 95 cm']);
 return {all,principal,get changes(){return changes}};
}
const documento=modo=>({
 nombre:'GATO-VIN BCO BASE GRIS-53x95-1UNIDAD.pdf',
 paginas:[{numero:1,anchoCm:52.99,altoCm:95,modo}],
 seleccion:'original',servicio:'auto',copias:1,modo:'color',caras:'simple',
 paginasPorHoja:1,anillado:'ninguno',grupoAnillado:'',materialColor:'',
 paginasSeleccionadas:'',papelPoster:'obra80',clasificacionAutomatica:true
});
test('un póster visualmente detectado NO ofrece botón CAD ni modifica su tarifa',()=>{
 const e=documento('poster');
 const antes=cotizar(e);
 assert.equal(antes.plan[0].destino,'ploteos');
 const result=ui(e);
 assert.equal(result.all.filter(x=>x.tag==='button').length,0);
 assert.equal(result.all.filter(x=>x.tag==='a').length,1);
 assert.match(result.all.find(x=>x.textContent?.includes('Clasificación automática:'))?.textContent||'',/PLENO/);
 const review=result.all.find(x=>x.tag==='a');
 assert.match(review.textContent,/Solicitar revisión/);
 assert.match(new URL(review.href).searchParams.get('text'),/El sistema detectó PLENO/);
 assert.equal(e.paginas[0].modo,'poster');
 assert.equal(cotizar(e).total,antes.total);
});
test('un CAD detectado tampoco ofrece pleno: conserva cotización CAD automática',()=>{
 const e=documento('cad'),r=ui(e);
 assert.equal(r.all.filter(x=>x.tag==='button').length,0);
 assert.match(r.all.find(x=>x.textContent?.includes('Clasificación automática:'))?.textContent||'',/CAD/);
 assert.equal(e.paginas[0].modo,'cad');
});
test('si clasificación NO se pudo hacer, pregunta CAD/pleno y no inventa detección',()=>{
 const e=documento('sin-clasificar');
 e.clasificacionAutomatica=false;
 assert.equal(cotizar(e).estado,'INCOMPLETO');
 const r=ui(e);
 const buttons=r.all.filter(x=>x.tag==='button');
 assert.deepEqual(buttons.map(b=>b.textContent),['CAD · Planos','PLENO · Póster']);
 assert.equal(r.all.some(x=>x.tag==='a'),false);
 buttons[0].onclick();
 assert.equal(e.paginas[0].modo,'cad');
 assert.equal(e.tipoPloteoElegidoPorCliente,true);
 assert.equal(r.changes,1);
 assert.equal(cotizar(e).estado,'PRELIMINAR');
});
test('clasificación por páginas mixta verificada no permite forzar un tipo barato',()=>{
 const e=documento('poster');
 e.paginas.push({numero:2,anchoCm:52.99,altoCm:95,modo:'cad'});
 const r=ui(e);
 assert.equal(r.all.filter(x=>x.tag==='button').length,0);
 assert.match(r.all.find(x=>x.textContent?.includes('Clasificación automática:'))?.textContent||'',/MIXTO/);
 assert.deepEqual(e.paginas.map(p=>p.modo),['poster','cad']);
});
test('solo el análisis visual completo marca la procedencia automática',()=>{
 assert.match(src,/e\.clasificacionAutomatica=clases\.length===e\.paginas\.length&&/);
 assert.match(src,/e\.clasificacionAutomatica===true&&/);
 assert.match(src,/elegidas\.every\(p=>\['cad','poster'\]\.includes\(p\.modo\)\)/);
 assert.match(src,/e\.clasificacionAutomatica=false;/);
 assert.doesNotMatch(src,/if\(clasificacionConfirmada\)[\s\S]{0,450}const opciones=document\.createElement\('div'\)/);
});
