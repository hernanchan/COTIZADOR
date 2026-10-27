import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';
const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
function doc(nombre,paginas,{porCara=1,caras='simple',anillado='ninguno',grupoAnillado='',copias=1}={}){
 return {nombre,servicio:'auto',seleccion:'a4',paginasSeleccionadas:'',
  paginas:Array.from({length:paginas},(_,i)=>({numero:i+1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'})),
  copias,modo:'bn',caras,papelPoster:'obra80',anillado,grupoAnillado,
  materialColor:'',paginasPorHoja:porCara};
}
test('2 por cara: 7 originales producen 4 caras impresas en simple faz',()=>{
 const r=cotizarCargaUnica({archivos:[doc('siete.pdf',7,{porCara:2})],precios});
 assert.equal(r.estado,'PRELIMINAR');
 assert.equal(r.total,400);
 assert.equal(r.detalleImpresiones[0].carasPorJuego,4);
 assert.equal(r.detalleImpresiones[0].hojasPorJuego,4);
 assert.equal(r.plan[0].paginasPorHoja,2);
});
test('4 por cara, doble faz: 9 originales = 3 caras, 2 hojas físicas',()=>{
 const r=cotizarCargaUnica({archivos:[doc('nueve.pdf',9,{porCara:4,caras:'double',anillado:'individual'})],precios});
 assert.equal(r.estado,'PRELIMINAR');
 assert.equal(r.detalleImpresiones[0].cantidad,3);
 assert.equal(r.detalleImpresiones[0].hojasPorJuego,2);
 assert.equal(r.subtotalAnillados,2330);
 assert.equal(r.total,300+2330);
});
test('9 por cara: 19 originales producen 3 caras, sin cobrar 19',()=>{
 const r=cotizarCargaUnica({archivos:[doc('diecinueve.pdf',19,{porCara:9})],precios});
 assert.equal(r.total,300);
 assert.equal(r.detalleImpresiones[0].carasPorJuego,3);
 assert.equal(r.detalleImpresiones[0].paginas,19);
});
test('mezcla 1 y 2 páginas por cara comparte escala según caras facturadas',()=>{
 const r=cotizarCargaUnica({archivos:[
  doc('diez.pdf',10),doc('cinco-en-dos.pdf',5,{porCara:2})
 ],precios});
 assert.equal(r.total,13*84);
 assert.equal(r.detalleImpresiones[1].cantidad,3);
});
test('anillado conjunto acumula hojas por archivo, no redondea páginas del grupo',()=>{
 const r=cotizarCargaUnica({archivos:[
  doc('a.pdf',5,{porCara:4,caras:'double',anillado:'grupo',grupoAnillado:'1'}),
  doc('b.pdf',5,{porCara:4,caras:'double',anillado:'grupo',grupoAnillado:'1'})
 ],precios});
 assert.equal(r.estado,'PRELIMINAR');
 assert.equal(r.detalleArmados[0].hojasPorJuego,2);
 assert.equal(r.subtotalAnillados,2330);
 assert.equal(r.total,4*100+2330);
});
test('solo 1, 2, 4, 9; rechazar 3 para impedir presupuestos ambiguos',()=>{
 const bad=doc('invalido.pdf',4,{porCara:3});
 assert.throws(()=>cotizarCargaUnica({archivos:[bad],precios}),/Configuración inválida/);
});
test('un ploteo no acepta 4 por cara para evitar uso accidental de precio documental',()=>{
 const f=doc('plano.pdf',1,{porCara:4});
 f.seleccion='original';
 f.paginas[0].anchoCm=60;f.paginas[0].altoCm=120;f.paginas[0].modo='cad';
 const r=cotizarCargaUnica({archivos:[f],precios});
 assert.equal(r.estado,'INCOMPLETO');
 assert.equal(r.total,null);
 assert.match(r.pendientes[0].motivo,/Composición múltiple/);
});
