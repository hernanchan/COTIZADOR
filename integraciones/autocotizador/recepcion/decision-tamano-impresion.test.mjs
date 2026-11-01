import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decidirTamanoCliente} from './decision-tamano-impresion.mjs';

const pagina=(x,y)=>({anchoCm:x,altoCm:y});
const decide=(x,y)=>decidirTamanoCliente([pagina(x,y)]);

test('A4 real vertical/horizontal se preselecciona, sin pregunta innecesaria',()=>{
 for(const [x,y] of [[21,29.7],[29.7,21],[21.02,29.71]]){
  const d=decide(x,y);
  assert.equal(d.seleccionInicial,'a4');
  assert.equal(d.requierePregunta,false);
  assert.equal(d.a4Exacto,true);
 }
});
test('A3, A5, tamaños próximos a A4 y tamaños mixtos sin ploteos requieren elección',()=>{
 const sizes=[[29.7,42],[14.8,21],[21.75,30.43],[25,35],[20.7,30.01]];
 for(const [x,y] of sizes){
  const d=decide(x,y);
  assert.equal(d.seleccionInicial,'sin-confirmar',x+'x'+y);
  assert.equal(d.requierePregunta,true,x+'x'+y);
 }
 const d=decidirTamanoCliente([pagina(21,29.7),pagina(29.7,42)]);
 assert.equal(d.variosTamanos,true);
 assert.equal(d.requierePregunta,true);
});
test('plano real municipal 97,01 × 61,49, A0 y otros mayores a A3 se envían automáticamente a ploteo original',()=>{
 for(const [w,h] of [[97.01,61.49],[61.49,97.01],[84.1,118.9],[42.1,29.7],[35,50]]){
  const d=decide(w,h);
  assert.equal(d.superaA3,true,w+' × '+h);
  assert.equal(d.seleccionInicial,'original',w+' × '+h);
  assert.equal(d.requierePregunta,false,w+' × '+h);
 }
 const mixto=decidirTamanoCliente([pagina(21,29.7),pagina(97.01,61.49)]);
 assert.equal(mixto.superaA3,true);
 assert.equal(mixto.variosTamanos,true);
 assert.equal(mixto.seleccionInicial,'original');
 assert.equal(mixto.requierePregunta,false);
});
test('tolerancia de A3 no deriva a ploteo sin motivo',()=>{
 for(const [w,h] of [[29.7,42],[29.73,42.03],[42,29.7]]){
  const d=decide(w,h);
  assert.equal(d.superaA3,false);
  assert.equal(d.seleccionInicial,'sin-confirmar');
 }
});
test('regla especial 20×20 siempre usa A4, sin pregunta',()=>{
 const d=decide(20,20);
 assert.equal(d.seleccionInicial,'a4');
 assert.equal(d.forzarA4,true);
 assert.equal(d.requierePregunta,false);
});
test('medidas inválidas nunca crean confirmación',()=>{
 assert.throws(()=>decidirTamanoCliente([]),/Medidas/);
 assert.throws(()=>decidirTamanoCliente([pagina(0,30)]),/Medidas/);
 assert.throws(()=>decidirTamanoCliente([pagina(NaN,20)]),/Medidas/);
});
test('la pantalla exige respuesta visible antes de presupuestar PDF no A4',()=>{
 const client=readFileSync(new URL('./carga-unica-cliente.mjs',import.meta.url),'utf8');
 const page=readFileSync(new URL('./carga-unica-pagina.mjs',import.meta.url),'utf8');
 assert.match(client,/e\.seleccion=decision\.seleccionInicial/);
 assert.match(client,/regla\.requierePregunta&&e\.seleccion==='sin-confirmar'/);
 assert.match(client,/El PDF no es A4\. ¿Cómo querés imprimirlo\?/);
 assert.match(client,/Ajustar a A4/);
 assert.match(client,/Mantener tamaño real/);
 assert.match(client,/Medida detectada/);
 assert.match(client,/const orden=\['pendientes'/);
 assert.match(client,/if\(regla\.forzarA4&&tam!=='a4'\)continue/);
 assert.match(client,/decidirTamanoCliente\(paginas\)\.forzarA4\?'a4':sel\.value/);
 assert.match(client,/Ploteo a tamaño real seleccionado automáticamente/);
 assert.match(client,/filaTam\.append\(btn\)/,'Conservar A4 y A3 como alternativas manuales de reducción');
 assert.match(client,/ATENCIÓN: /);
 assert.match(client,/clasificarDestino\(elegidas,e\.seleccion\)/);
 assert.match(page,/pregunta-tamano/);
});
