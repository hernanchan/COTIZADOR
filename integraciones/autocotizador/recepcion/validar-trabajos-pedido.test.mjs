import test from 'node:test';
import assert from 'node:assert/strict';
import {validarTrabajosPedido} from './validar-trabajos-pedido.mjs';

test('acepta varios trabajos consecutivos con varios archivos cada uno',()=>{
 const result=validarTrabajosPedido([
  {id:'job-1',nombre:'Apuntes',indices:[0,1]},
  {id:'job-2',nombre:'Láminas',indices:[2,3]}
 ],4);
 assert.deepEqual(result.map(x=>({...x,indices:[...x.indices]})),[
  {id:'job-1',nombre:'Apuntes',indices:[0,1]},
  {id:'job-2',nombre:'Láminas',indices:[2,3]}
 ]);
});

test('rechaza archivos omitidos, repetidos, ajenos y grupos fuera de orden',()=>{
 const invalid=[
  [{id:'a',nombre:'A',indices:[0]}],
  [{id:'a',nombre:'A',indices:[0,1]},{id:'b',nombre:'B',indices:[1]}],
  [{id:'a',nombre:'A',indices:[0,2]},{id:'b',nombre:'B',indices:[1]}],
  [{id:'a',nombre:'A',indices:[1]},{id:'b',nombre:'B',indices:[0]}]
 ];
 for(const jobs of invalid)assert.throws(()=>validarTrabajosPedido(jobs,2));
});

test('rechaza IDs repetidos, nombres inseguros y propiedades no previstas',()=>{
 for(const jobs of [
  [{id:'a',nombre:'A',indices:[0]},{id:'a',nombre:'B',indices:[1]}],
  [{id:'a',nombre:'<script>',indices:[0]},{id:'b',nombre:'B',indices:[1]}],
  [{id:'a',nombre:'A',indices:[0],precio:100},{id:'b',nombre:'B',indices:[1]}]
 ])assert.throws(()=>validarTrabajosPedido(jobs,2));
});
