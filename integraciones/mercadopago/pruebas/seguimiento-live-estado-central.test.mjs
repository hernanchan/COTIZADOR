import test from 'node:test';
import assert from 'node:assert/strict';
import {leerSeguimientoLiveCentral} from './seguimiento-live-estado-central.mjs';

const id='123e4567-e89b-42d3-a456-426614174000';
const fakeDb=rows=>({prepare(sql){
 return {bind(ref){assert.equal(ref,id);return this},
  async all(){assert.match(sql,/sqlite_master/);return {results:Object.keys(rows).map(name=>({name}))}},
  async first(){
   if(sql.includes('central_work_order_numbers'))return rows.central_work_order_numbers;
   if(sql.includes('central_live_production_states'))return rows.central_live_production_states;
   if(sql.includes('central_preparation_estimates'))return rows.central_preparation_estimates;
   if(sql.includes('central_delivery_plan'))return rows.central_delivery_plan;
   throw Error('Unexpected query');
  }};
}});
test('seguimiento de orden pagada lee estado, hora y calendario sin mutar D1',async()=>{
 const r=await leerSeguimientoLiveCentral(fakeDb({
  central_work_order_numbers:{number:8},
  central_live_production_states:{state:'en_preparacion'},
  central_preparation_estimates:{ready_at:'2026-11-13T14:00:00.000Z'},
  central_delivery_plan:{mode:'proximo_dia'}
 }),id);
 assert.deepEqual(r,{
  numeroOrden:'008',productionState:'en_preparacion',
  readyAt:'2026-11-13T14:00:00.000Z',forecastMode:'proximo_dia'
 });
});
test('sin tablas habilitadas no inventa hora ni estado',async()=>{
 const r=await leerSeguimientoLiveCentral(fakeDb({}),id);
 assert.deepEqual(r,{
  numeroOrden:null,productionState:'pendiente',readyAt:null,forecastMode:'por_confirmar'
 });
});
test('estados inválidos no se trasladan al cliente',async()=>{
 const r=await leerSeguimientoLiveCentral(fakeDb({
  central_work_order_numbers:{number:-2},
  central_live_production_states:{state:'cobro_admin'},
  central_preparation_estimates:{ready_at:'invalid'},
  central_delivery_plan:{mode:'mañana'}
 }),id);
 assert.equal(r.numeroOrden,null);
 assert.equal(r.productionState,'pendiente');
 assert.equal(r.readyAt,null);
 assert.equal(r.forecastMode,'por_confirmar');
});
