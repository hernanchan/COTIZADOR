import test from 'node:test';
import assert from 'node:assert/strict';
import {plazoProduccionCliente} from './plazo-produccion-cliente.mjs';
import {plazoInformativo} from '../../mercadopago/pruebas/plazo-produccion-informativo.mjs';
const testRoot='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const liveRoot='https://pedidos.libreriasaber.com.ar';
const read=(url,env,service)=>plazoProduccionCliente(new Request(url),env,{service});
test('presupuesto de ensayo consulta Central sin pedido ni datos de cliente',async()=>{
 const calls=[],service={fetch:async req=>{
  calls.push(req);
  return Response.json(plazoInformativo('hoy',Date.parse('2026-11-11T12:00:00Z')));
 }};
 const r=await read(testRoot+'/prueba-v2/api/plazo-produccion',
  {SABER_ENTORNO:'pruebas'},service);
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.mode,'hoy');
 assert.equal(data.guaranteed,false);
 assert.equal(data.exactReadyAt,null);
 assert.equal(calls.length,1);
 assert.equal(calls[0].method,'GET');
 assert.equal(calls[0].url,'https://saber-pagos-pruebas.libreriasaber.workers.dev/public/api/plazo-produccion');
 assert.equal(calls[0].headers.get('Authorization'),null);
});
test('presupuesto LIVE lee solo plazo de Central producción (no Sandbox)',async()=>{
 const calls=[],service={fetch:async req=>{
  calls.push(req);
  return Response.json(plazoInformativo('proximo_dia',Date.parse('2026-11-11T12:00:00Z')));
 }};
 const res=await read(liveRoot+'/api/pedido/plazo',{SABER_ENTORNO:'produccion'},service);
 assert.equal(res.status,200);
 assert.equal((await res.json()).mode,'proximo_dia');
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://pagos.libreriasaber.com.ar/public/api/plazo-produccion');
});
test('no cruzar sandbox con LIVE ni aceptar URL de origen tercero',async()=>{
 const calls=[],service={fetch:async r=>{calls.push(r);throw Error('NO_FETCH')}};
 assert.equal((await read(testRoot+'/prueba-v2/api/plazo-produccion',
  {SABER_ENTORNO:'produccion'},service)).status,403);
 assert.equal((await read(liveRoot+'/api/pedido/plazo',
  {SABER_ENTORNO:'pruebas'},service)).status,403);
 assert.equal((await read('https://intruso.example/api/pedido/plazo',
  {SABER_ENTORNO:'produccion'},service)).status,403);
 assert.equal(calls.length,0);
});
test('si falla la Central el cotizador no inventa hora ni autoriza pedido',async()=>{
 const service={fetch:async()=>Response.json({ok:true,guaranteed:true,mode:'hoy',
  source:'central-delivery-plan-readonly',heading:'Plazo máximo orientativo de preparación',
  label:'Hoy',notice:'Seguro',exactReadyAt:'2026-11-11T20:00:00Z'})};
 const res=await read(liveRoot+'/api/pedido/plazo',{SABER_ENTORNO:'produccion'},service);
 assert.equal(res.status,502);
});
