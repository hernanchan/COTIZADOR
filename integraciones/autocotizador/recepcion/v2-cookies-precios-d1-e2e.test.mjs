import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import worker from './dist/saber-documentos-cotizador-fase4.mjs';

globalThis.crypto??=webcrypto;
const origin='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const prices=JSON.parse(readFileSync(new URL('../../../precios-web.json',import.meta.url),'utf8'));
const pass='a'.repeat(42);
const auth='Basic '+Buffer.from('operador:'+pass).toString('base64');
const env={
 DOCS_V2_PRIVATE_UI_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_V2_PRIVATE_UI_SECRET:pass,
 DOCS_CENTRAL_ADMIN_KEY:'b'.repeat(42),
 DOCS_RELAY_KEY:'c'.repeat(42),
 CENTRAL_BRIDGE_KEY:'d'.repeat(42),
 DOCS_PRICE_ADMIN_D1_ENABLED:'PRIVATE_TEST_ONLY',
 DOCS_TURNSTILE_SITE_KEY:'0x4AAAA-test-0123456789',
 SABER_CENTRAL:{fetch:async(req)=>{
   assert.equal(new URL(req.url).pathname,'/internal/central/pricing-snapshot');
   assert.match(req.headers.get('x-saber-signature')||'',/^[a-f0-9]{64}$/);
   return Response.json({ok:true,schema:'saber-price-snapshot-v1',
    approvedRevision:3,approvedAt:'2026-11-03T10:00:00Z',
    prices,promotions:{codes:[]},commercialRelease:false,paymentAuthorized:false,
    source:'private-d1-approved-only'});
 }}
};
function request(path,headers={},body){
 return new Request(origin+path,{method:body?'POST':'GET',headers,
  ...(body?{body:JSON.stringify(body)}:{})});
}
const fixture={archivos:[{
 nombre:'Resumen_2_paginas.pdf',
 paginas:[
  {numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'},
  {numero:2,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}
 ],
 seleccion:'a4',servicio:'auto',paginasPorHoja:1,copias:1,modo:'bn',
 caras:'simple',papelPoster:'obra80',anillado:'ninguno',
 grupoAnillado:'',materialColor:'obra70'
}]};
test('portal privado entrega cookies sólo para los endpoints de cotización autorizados',async()=>{
 const page=await worker.fetch(request('/prueba-v2/',{Authorization:auth}),env,{});
 assert.equal(page.status,200);
 const cookies=page.headers.getSetCookie();
 for(const path of ['/api/ensayo-materiales-rapido','/api/ensayo-carga-unica']){
  const session=cookies.find(x=>x.includes('Path='+path+';'));
  assert.ok(session,'Falta cookie del endpoint '+path);
  assert.match(session,/Secure; HttpOnly; SameSite=Strict/);
 }
 assert.ok(cookies.every(x=>!x.includes('Path=/api/;')),
  'La sesión no debe habilitar toda la API');
});
test('iframe sin cabecera Basic, con cookie legítima, recibe materiales y cotiza 2 páginas a $200',async()=>{
 const page=await worker.fetch(request('/prueba-v2/',{Authorization:auth}),env,{});
 const cookies=page.headers.getSetCookie();
 const session=path=>cookies.find(x=>x.includes('Path='+path+';')).split(';')[0];
 const material=await worker.fetch(request('/api/ensayo-materiales-rapido',{
  Cookie:session('/api/ensayo-materiales-rapido')}),env,{});
 assert.equal(material.status,200);
 const catalog=await material.json();
 assert.equal(catalog.ok,true);
 const quote=await worker.fetch(request('/api/ensayo-carga-unica',{
  Cookie:session('/api/ensayo-carga-unica'),Origin:origin,
  'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'
 },fixture),env,{});
 assert.equal(quote.status,200,await quote.clone().text());
 const result=await quote.json();
 assert.equal(result.ok,true);
 assert.equal(result.total,200);
 assert.equal(result.paymentAuthorized,false);
});
test('sin cookie de cotizador no hay presupuesto D1 y no se reutilizan precios históricos',async()=>{
 const quote=await worker.fetch(request('/api/ensayo-carga-unica',{
  Origin:origin,'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'
 },fixture),env,{});
 assert.equal(quote.status,503);
 const r=await quote.json();
 assert.equal(r.ok,false);
 assert.equal(r.paymentAuthorized,false);
 assert.match(r.error,/verificar los precios vigentes/);
});
