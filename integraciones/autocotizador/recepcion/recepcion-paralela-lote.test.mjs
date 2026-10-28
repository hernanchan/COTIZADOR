/** Simulaciones deterministas del planificador de hasta 2 PDF, sin red. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ejecutarRecepcionParalela} from './subir-vincular-pdf-v2-privado.mjs';

test('10 PDF se procesan máximo de dos simultáneos; se confirma cada uno antes de Central',async()=>{
 let activos=0,maximo=0;
 const finalizados=[];
 const files=Array.from({length:10},(_,i)=>({i,sha:'SHA_'+i}));
 const result=await ejecutarRecepcionParalela(files,async d=>{
  activos++;maximo=Math.max(maximo,activos);
  await new Promise(resolve=>setTimeout(resolve,3+(d.i%3)));
  activos--;
  return true;
 },d=>finalizados.push(d.i),2);
 assert.equal(maximo,2);
 assert.equal(result.confirmados,10);
 assert.equal(result.fallos,0);
 assert.equal(result.completo,true);
 assert.deepEqual([...finalizados].sort((a,b)=>a-b),files.map(f=>f.i));
 assert.equal(activos,0);
});

test('ante error en un PDF no comienza un tercer envío; se conserva el ya iniciado',async()=>{
 const iniciados=[],confirmados=[];
 const result=await ejecutarRecepcionParalela([0,1,2,3,4],async i=>{
  iniciados.push(i);
  if(i===1)return false;
  await new Promise(resolve=>setTimeout(resolve,12));
  return true;
 },i=>confirmados.push(i),2);
 assert.deepEqual(iniciados,[0,1]);
 assert.deepEqual(confirmados,[0]);
 assert.equal(result.confirmados,1);
 assert.equal(result.fallos,1);
 assert.equal(result.completo,false);
 assert.equal(result.total,5);
});

test('rechazo del servidor o excepción no equivale a pedido confirmado',async()=>{
 let llamados=0;
 const result=await ejecutarRecepcionParalela([0,1,2],async i=>{
  llamados++;
  if(i===0)throw Error('GAS temporalmente indisponible');
  await new Promise(resolve=>setTimeout(resolve,5));
  return true;
 },()=>{},2);
 assert.equal(result.completo,false);
 assert.equal(result.fallos,1);
 assert.ok(llamados<=2);
});

test('límite queda fijado en dos; no existe paralelismo ilimitado por pedido',async()=>{
 await assert.rejects(ejecutarRecepcionParalela([1],()=>true,()=>{},3),/inválida/);
 await assert.rejects(ejecutarRecepcionParalela(Array(31).fill(0),()=>true,()=>{},2),/inválida/);
});
