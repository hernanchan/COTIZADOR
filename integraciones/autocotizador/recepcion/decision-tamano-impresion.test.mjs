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
test('A3, A5, A0 CAD, tamaños próximos a A4 y tamaños mixtos requieren elección',()=>{
 const sizes=[[29.7,42],[14.8,21],[84.1,118.9],[21.75,30.43],[25,35],[20.7,30.01]];
 for(const [x,y] of sizes){
  const d=decide(x,y);
  assert.equal(d.seleccionInicial,'sin-confirmar',x+'x'+y);
  assert.equal(d.requierePregunta,true,x+'x'+y);
 }
 const d=decidirTamanoCliente([pagina(21,29.7),pagina(29.7,42)]);
 assert.equal(d.variosTamanos,true);
 assert.equal(d.requierePregunta,true);
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
 assert.match(client,/ATENCIÓN: /);
 assert.match(client,/clasificarDestino\(elegidas,e\.seleccion\)/);
 assert.match(page,/pregunta-tamano/);
});
