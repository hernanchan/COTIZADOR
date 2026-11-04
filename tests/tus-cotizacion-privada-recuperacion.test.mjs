import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {solicitarCotizacionPrivada} from '../integraciones/autocotizador/recepcion/solicitar-cotizacion-privada.mjs';
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';
const prices=JSON.parse(readFileSync(new URL('../precios-web.json',import.meta.url),'utf8'));
const paginas=Array.from({length:11},(_,j)=>({
 numero:j+1,anchoCm:24.57,altoCm:j%2===0?37.8:37.81,modo:'sin-clasificar'
}));
const archivo={nombre:'test-A3-11.pdf',paginas,paginasSeleccionadas:'',seleccion:'a3',
 servicio:'auto',productoFoto:'',productoGrafica:'',corteVariante:'gt3',
 corteMetros:1,copias:1,modo:'bn',caras:'simple',paginasPorHoja:1,
 papelPoster:'obra80',anillado:'ninguno',grupoAnillado:'',materialColor:''};
const ok={ok:true,estado:'PRELIMINAR',paymentAuthorized:false,total:5115,pendientes:[],plan:[]};
test('11 páginas A3 no bloquean la cotización solo por tamaño mixto de 0,01 cm',()=>{
 const out=cotizarCargaUnica({archivos:[archivo],precios:prices});
 assert.equal(out.ok,true);
 assert.equal(out.estado,'PRELIMINAR');
 assert.equal(out.total,11*465);
 assert.equal(out.plan[0].formatoFinal,'a3');
});
test('error transitorio 503 se reintenta sin nuevas cargas y sin crear pedidos',async()=>{
 const requests=[],waits=[];
 const result=await solicitarCotizacionPrivada([archivo],{
  fetcher:async (url,init)=>{
   requests.push({url,init});
   return new Response(JSON.stringify(requests.length===1?
    {ok:false,error:'Tarifario temporalmente no disponible'}:ok),{status:requests.length===1?503:200});
  },pausa:async ms=>waits.push(ms)
 });
 assert.deepEqual(result,ok);
 assert.equal(requests.length,2);
 assert.deepEqual(waits,[450]);
 for(const r of requests){
  assert.equal(r.url,'/api/ensayo-carga-unica');
  assert.equal(r.init.credentials,'same-origin');
  assert.equal(r.init.cache,'no-store');
  assert.equal(JSON.parse(r.init.body).archivos.length,1);
  assert.ok(!r.init.body.includes('paymentId'));
 }
});
test('400 no se oculta: muestra el error sin reintentar',async()=>{
 let n=0;
 await assert.rejects(solicitarCotizacionPrivada([archivo],{
  fetcher:async()=>{n++;return new Response(JSON.stringify({ok:false,error:'Datos inválidos o trabajo pendiente de revisión.'}),{status:400})},
  pausa:async()=>{}
 }),/Datos inválidos o trabajo pendiente de revisión/);
 assert.equal(n,1);
});
test('sin red devuelve recuperación explícita y limita los intentos',async()=>{
 let n=0;
 await assert.rejects(solicitarCotizacionPrivada([archivo],{
  fetcher:async()=>{n++;throw Error('offline')},pausa:async()=>{}
 }),/El PDF sigue en esta pantalla/);
 assert.equal(n,2);
});
test('rechazar respuesta que intente declarar autorización de pago en una cotización preliminar',async()=>{
 await assert.rejects(solicitarCotizacionPrivada([archivo],{
  fetcher:async()=>new Response(JSON.stringify({...ok,paymentAuthorized:true})),pausa:async()=>{}
 }),/servidor no pudo completar la cotización/i);
});
test('el error antes oculto se muestra junto al documento y en cabecera; no se borra el PDF',()=>{
 const client=readFileSync(new URL('../integraciones/autocotizador/recepcion/carga-unica-cliente.mjs',import.meta.url),'utf8');
 const page=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs',import.meta.url),'utf8');
 assert.match(client,/informarPrecioPrivado\('error',null,razon\)/);
 assert.match(client,/Reintentar presupuesto sin volver a subir/);
 assert.match(client,/El PDF sigue cargado; no lo vuelvas a seleccionar/);
 assert.match(client,/solicitarCotizacionPrivada\(archivos\)/);
 assert.match(page,/Presupuesto pendiente · /);
 assert.match(page,/smartBlockedReason\|\|/);
});
