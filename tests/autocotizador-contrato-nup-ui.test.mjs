import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../integraciones/autocotizador/recepcion/',import.meta.url);
const intake=readFileSync(new URL('carga-unica-cliente.mjs',base),'utf8');
const portal=readFileSync(new URL('pantalla-cotizador-v2-prueba-privada.mjs',base),'utf8');
const worker=readFileSync(new URL('worker-fase4-cotizador-unificado.mjs',base),'utf8');
test('la ficha de borrador real conserva anillado grupo y N-up por archivo',()=>{
 const start=intake.indexOf("const draft=prepararBorradorPedido({");
 const end=intake.indexOf("let articulos=",start);
 assert.ok(start>0&&end>start);
 const block=intake.slice(start,end);
 for(const field of ['caras:e.caras','anillado:e.anillado',
   'grupoAnillado:e.grupoAnillado','paginasPorHoja:e.paginasPorHoja??1'])
  assert.ok(block.includes(field),'Falta '+field);
});
test('el N-up seleccionado pasa una sola vez de carga a portal y de portal al servidor',()=>{
 assert.match(intake,/options\.push\(\{[\s\S]*?paginasPorHoja:e\.paginasPorHoja\?\?1/);
 assert.match(portal,/paginasPorHoja\.value=String\(d\.opcionesInteligentes\.paginasPorHoja\?\?1\)/);
 assert.match(portal,/paginasPorHoja:Number\(paginasPorHoja\.value\)/);
 assert.match(portal,/paginasPorHoja:q\.paginasPorHoja\?\?1/);
 assert.match(worker,/cotizarNupReciboVerificado\(/);
 assert.match(worker,/await leerPdfFase4Privado\(/);
 assert.match(worker,/await medidasPdfServidor\(original\)/);
});
test('el vínculo V2 no autoriza cobros ni supone PDF compuesto ya impreso',()=>{
 assert.match(worker,/paymentAuthorized:false,checkoutEnabled:false/);
 assert.match(portal,/Pago y producción: DESACTIVADOS/);
});
