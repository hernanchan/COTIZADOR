import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cotizarNupReciboVerificado} from '../integraciones/autocotizador/recepcion/cotizar-nup-recibo-verificado.mjs';
const precios=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const recibo={ok:true,status:'verified',verified:true,storageVerified:true,
 pageVerification:'server',paymentAuthorized:false,pages:9,
 name:'pdf-123__real.pdf',mode:'bn'};
const medidas={pageCount:9,pageMetrics:Array.from({length:9},()=>({anchoCm:21,altoCm:29.7}))};
const opt={paginasPorHoja:4,formato:'a4',caras:'double',copias:2,anillado:'ninguno',materialColor:'obra70'};
test('recibo real simulado: nueve páginas 4-up doble faz y dos juegos',()=>{
 const q=cotizarNupReciboVerificado({recibo,medidas,opciones:opt,precios});
 assert.equal(q.totalArs,6*100);
 assert.equal(q.paginasPorHoja,4);
 assert.equal(q.paginasOriginales,9);
 assert.equal(q.paymentAuthorized,false);
});
test('rechaza PDF con páginas grandes aunque se solicite imprimir A4',()=>{
 const m={...medidas,pageMetrics:medidas.pageMetrics.map((p,i)=>i? p : {anchoCm:60,altoCm:90})};
 assert.throws(()=>cotizarNupReciboVerificado({recibo,medidas:m,opciones:opt,precios}),/A3|ploteo/);
});
test('rechaza recibo no verificado, sustitución de recuento y 3 por cara',()=>{
 for(const values of [{recibo:{...recibo,verified:false}},
  {medidas:{...medidas,pageCount:8}},
  {opciones:{...opt,paginasPorHoja:3}}])
  assert.throws(()=>cotizarNupReciboVerificado({recibo,medidas,opciones:opt,precios,...values}),/verificados/);
});
test('recibo de color material correcto usa catálogo A3, sin cobro',()=>{
 const r={...recibo,pages:5,mode:'color'};
 const m={pageCount:5,pageMetrics:Array.from({length:5},()=>({anchoCm:29.7,altoCm:42}))};
 const q=cotizarNupReciboVerificado({recibo:r,medidas:m,opciones:{
  ...opt,paginasPorHoja:2,formato:'a3',caras:'simple',copias:1,
  materialColor:'a3_color_obra80'
 },precios});
 assert.equal(q.totalArs,3000);
 assert.equal(q.paymentAuthorized,false);
});
