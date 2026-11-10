import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decidirTamanoCliente} from '../integraciones/autocotizador/recepcion/decision-tamano-impresion.mjs';
import {opcionesTipoPloteo,elegirTipoPloteo} from '../integraciones/autocotizador/recepcion/eleccion-ploteo-cad-pleno.mjs';
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';

const original=(anchoCm,altoCm,modo='sin-clasificar')=>[{numero:1,anchoCm,altoCm,modo}];
const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const make=paginas=>({
 nombre:'Plano A2.pdf',paginas,paginasSeleccionadas:'',seleccion:'original',
 servicio:'auto',copias:1,modo:'color',caras:'simple',paginasPorHoja:1,
 anillado:'ninguno',grupoAnillado:'',materialColor:'',
 papelPoster:'obra80'
});
test('un A2, A1 y plano personalizado mayor A3 va a plotter y permite CAD o PLENO',()=>{
 for(const [x,y] of [[42,59.4],[59.4,84.1],[97.01,61.49],[84.1,118.9]]){
  const paginas=original(x,y);
  const d=decidirTamanoCliente(paginas);
  assert.equal(d.seleccionInicial,'original');
  assert.equal(d.superaA3,true);
  assert.equal(d.requierePregunta,false);
  const before=opcionesTipoPloteo(paginas,'original');
  assert.equal(before.mostrar,true);
  assert.equal(before.tipo,null);
  elegirTipoPloteo(paginas,'original','cad');
  assert.equal(paginas[0].modo,'cad');
  assert.equal(opcionesTipoPloteo(paginas,'original').tipo,'cad');
  elegirTipoPloteo(paginas,'original','poster');
  assert.equal(opcionesTipoPloteo(paginas,'original').tipo,'poster');
 }
});
test('se conserva opción en paisaje y límite A3 no necesita CAD/pleno',()=>{
 assert.equal(opcionesTipoPloteo(original(29.7,42),'original').mostrar,false);
 assert.equal(opcionesTipoPloteo(original(42,29.7),'original').mostrar,false);
 assert.equal(opcionesTipoPloteo(original(21,29.7),'original').mostrar,false);
 const big=original(84.1,59.4);
 assert.equal(opcionesTipoPloteo(big,'a3').mostrar,false,
  'Sólo para tamaño original; reducir a A3 es una decisión explícita distinta');
 assert.throws(()=>elegirTipoPloteo(big,'a3','poster'),/solamente al ploteo original/);
 assert.throws(()=>elegirTipoPloteo(big,'original','inventado'),/Elegí/);
});
test('la elección comercial modifica el precio y destino del MISMO original, no su tamaño',()=>{
 const paginas=original(59.4,84.1);
 const c=make(paginas);
 assert.equal(cotizarCargaUnica({archivos:[c],precios}).estado,'INCOMPLETO');
 elegirTipoPloteo(paginas,'original','cad');
 const plano=cotizarCargaUnica({archivos:[c],precios});
 assert.equal(plano.estado,'PRELIMINAR');
 assert.equal(plano.plan[0].destino,'ploteos');
 assert.equal(plano.plan[0].formatoFinal,'original');
 assert.equal(plano.detallePloteos[0].paginas[0].modo,'cad');
 assert.ok(plano.total>0);
 elegirTipoPloteo(paginas,'original','poster');
 const pleno=cotizarCargaUnica({archivos:[c],precios});
 assert.equal(pleno.estado,'PRELIMINAR');
 assert.equal(pleno.plan[0].destino,'ploteos');
 assert.equal(pleno.plan[0].formatoFinal,'original');
 assert.equal(pleno.detallePloteos[0].paginas[0].modo,'poster');
 assert.ok(pleno.total>0);
 assert.notEqual(plano.total,pleno.total,'CAD y pleno deben mantener sus precios separados');
 assert.deepEqual(paginas,[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'poster'}]);
 assert.equal(pleno.paymentAuthorized,false);
});
test('el cliente ve ploteo mayor A3 sin preguntas CAD/PLENO, o revisión si falla',()=>{
 const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');
 const page=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-pagina.mjs',import.meta.url),'utf8');
 const beg=source.indexOf("if(destino.confirmado&&destino.destino==='ploteo'){");
 const end=source.indexOf("if(e.paginas&&e.servicio==='auto'){",beg+20);
 assert.ok(beg>0&&end>beg);
 const card=source.slice(beg,end);
 assert.match(card,/TAMAÑO MAYOR A A3 · CORRESPONDE A PLOTTER/);
 assert.match(card,/Medidas originales:/);
 assert.doesNotMatch(card,/¿Qué tipo de ploteo necesitás\?/);
 assert.doesNotMatch(card,/elegirTipoPloteo\(e.paginas,e.seleccion,v\)/);
 assert.match(card,/No pudimos identificar automáticamente/);
 assert.match(card,/Solicitar revisión del PDF/);
 assert.match(card,/Papel para ploteo/);
 assert.match(card,/principal\.append\(bloque\)/);
 assert.match(page,/\.eleccion-plotter-boton\.seleccionada/);
 assert.match(page,/\.eleccion-plotter-boton:focus-visible/);
 assert.match(source,/file\.size<=MAX_PDF_TUS_BYTES&&requiereClasificacionVisualPloteo/,
  'Los PDF de hasta 40 MiB utilizan análisis visual local');
 assert.match(source,/file\.size>MAX_PDF_TUS_BYTES&&requiereClasificacionVisualPloteo/,
  'Los PDF mayores a 40 MiB utilizan análisis local por rangos');
 assert.doesNotMatch(source,/controles\.append\(valor\('Para cotizar: ¿qué contiene/,
  'No volver a preguntar el tipo dentro de Más opciones');
});
test('si el PDF trae clases mezcladas, el comprador puede elegir un único tipo para todo el original',()=>{
 const paginas=[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'},
  {numero:2,anchoCm:59.4,altoCm:84.1,modo:'poster'}];
 const d=opcionesTipoPloteo(paginas,'original');
 assert.equal(d.mostrar,true);
 assert.equal(d.confirmado,false);
 assert.equal(d.variasClases,true);
 elegirTipoPloteo(paginas,'original','poster');
 assert.deepEqual(paginas.map(x=>x.modo),['poster','poster']);
});
