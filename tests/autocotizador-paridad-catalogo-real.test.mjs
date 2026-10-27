import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';

// Catálogo comercial versionado: no inventar precios ni cambiar descuentos.
const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
function archivo(nombre,{cantidad=1,formato='a4',modo='bn',materialColor='',anillado='ninguno',grupoAnillado='',caras='simple'}={}){
 const d=formato==='a3'?[29.7,42]:[21,29.7];
 return {nombre,servicio:'auto',seleccion:formato,paginasSeleccionadas:'',
  paginas:Array.from({length:cantidad},(_,i)=>({numero:i+1,anchoCm:d[0],altoCm:d[1],modo:'sin-clasificar'})),
  copias:1,modo,caras,papelPoster:'obra80',anillado,grupoAnillado,materialColor};
}
test('A4 B/N aplica escala conjunta de 11 a 30 páginas',()=>{
 const r=cotizarCargaUnica({precios,archivos:[
  archivo('siete.pdf',{cantidad:7}),archivo('cinco.pdf',{cantidad:5})]});
 assert.equal(r.estado,'PRELIMINAR');
 assert.equal(r.subtotalImpresiones,12*84);
 assert.equal(r.total,1008);
 assert.equal(r.paymentAuthorized,false);
 assert.equal(r.plan.length,r.detalleImpresiones.length);
});
test('A3 color toma su material propio, no el A4',()=>{
 const r=cotizarCargaUnica({precios,archivos:[
  archivo('laminas-a3.pdf',{cantidad:2,formato:'a3',modo:'color',materialColor:'a3_color_obra80'})]});
 assert.equal(r.estado,'PRELIMINAR');
 assert.equal(r.total,2000);
 assert.equal(r.detalleImpresiones[0].materialColor,'a3_color_obra80');
});
test('A3 color rechaza material de A4: nunca devuelve precio inventado',()=>{
 const r=cotizarCargaUnica({precios,archivos:[
  archivo('error-papel.pdf',{formato:'a3',modo:'color',materialColor:'obra70'})]});
 assert.equal(r.estado,'INCOMPLETO');
 assert.equal(r.total,null);
 assert.equal(r.paymentAuthorized,false);
 assert.match(r.pendientes[0].motivo,/Material incompatible/);
});
test('grupo A4 válido: una encuadernación para dos PDF, sin duplicarla',()=>{
 const r=cotizarCargaUnica({precios,archivos:[
  archivo('primero.pdf',{cantidad:7,anillado:'grupo',grupoAnillado:'1'}),
  archivo('segundo.pdf',{cantidad:5,anillado:'grupo',grupoAnillado:'1'})]});
 assert.equal(r.estado,'PRELIMINAR');
 assert.equal(r.detalleImpresiones.reduce((s,d)=>s+d.subtotal,0),1008);
 // En este contrato subtotalImpresiones ya incluye el armado; no sumarlo dos veces.
 assert.equal(r.subtotalImpresiones,3338);
 assert.equal(r.subtotalAnillados,2330);
 assert.equal(r.total,3338);
 assert.deepEqual(r.detalleArmados[0].archivos,['pdf1','pdf2']);
 assert.equal(r.detalleArmados[0].hojasPorJuego,12);
});
test('separación comercial: A4 B/N y A3 color no comparten escala',()=>{
 const r=cotizarCargaUnica({precios,archivos:[
  archivo('apunte.pdf',{cantidad:7}),
  archivo('lamina.pdf',{cantidad:2,formato:'a3',modo:'color',materialColor:'a3_color_obra80'})]});
 assert.equal(r.estado,'PRELIMINAR');
 assert.equal(r.subtotalImpresiones,700+2000);
 assert.equal(r.total,2700);
 assert.equal(r.plan.length,2);
 for(const linea of r.plan){
  assert.equal(r.detalleImpresiones.find(x=>x.id===linea.id)?.nombre,linea.nombre);
 }
});
