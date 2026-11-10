import test from 'node:test';
import assert from 'node:assert/strict';
import {cotizarPloteosRapido} from './cotizar-ploteos-rapido.mjs';

const precios={plotter:{
 minMeters:0,roundTo:1,
 supports:[
  {id:'rollo60',name:'Obra 60',widthCm:60,cadPerMeter:100,posterPerMeter:200},
  {id:'rec60',name:'Recubierto 60',widthCm:60,cadPerMeter:175,posterPerMeter:350}
 ]}};
function cotizar(nombre,modo,papelPoster){
 return cotizarPloteosRapido({precios,trabajos:[{
  id:'pl1',nombre,modo,material:'rollo60',papelPoster,copias:1,
  paginas:[{numero:1,anchoCm:50,altoCm:70,modo}]
 }]});
}
test('el nombre VINILO BLANCO no determina soporte ni tarifa',()=>{
 const a=cotizar('QR PARROQUIA- VINILO BLANCO- 50X70CM.pdf','poster','obra80');
 const b=cotizar('archivo.pdf','poster','obra80');
 assert.equal(a.total,b.total);
 assert.equal(a.detalles[0].paginas[0].material,'rollo60');
});
test('CAD en obra 80 y recubierto 130 tienen soportes y tarifas diferentes',()=>{
 const obra=cotizar('plano.pdf','cad','obra80');
 const rec=cotizar('plano.pdf','cad','recubierto');
 assert.equal(obra.total,70);
 assert.equal(rec.total,123);
 assert.equal(rec.detalles[0].paginas[0].material,'rec60');
 assert.equal(rec.detalles[0].paginas[0].papel,'recubierto');
});
test('pleno recubierto sigue calculando la tarifa de poster',()=>{
 const rec=cotizar('poster.pdf','poster','recubierto');
 assert.equal(rec.total,245);
});
