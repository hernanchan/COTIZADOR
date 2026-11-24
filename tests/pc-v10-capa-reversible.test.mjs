import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {crearCapaPcV10} from '../integraciones/autocotizador/recepcion/pc-v10-capa-reversible.mjs';
const path=new URL('../integraciones/autocotizador/recepcion/',import.meta.url);
const css=fs.readFileSync(new URL('pc-v10-comercial.css.txt',path),'utf8');
const js=fs.readFileSync(new URL('pc-v10-comercial.js.txt',path),'utf8');
const origin='https://pedidos.libreriasaber.com.ar';
const on={DOCS_LIVE_PC_V10_GATE:'GO_COMERCIAL_CONFIRMADO'};
const html='<html><head></head><body>'+['zonaArchivos','archivos','modoConfiguracion','configComunGlobal','estado','presupuesto','prepararPedido','resumenPedido','anilladosConjuntos','lista'].map(id=>'<div id="'+id+'"></div>').join('')+'<script src="/cotizar/archivos.js"></script><script src="/cotizar/movil.js"></script>SABER_SMART_RESIZE</body></html>';
const csp="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'self'";
const headers={'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':csp,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
function setup(body=html,status=200,head=headers){
 let calls=0,last=null;
 const base={fetch(req,env,ctx){calls++;last={req,env,ctx};return new Response(body,{status,headers:head});},scheduled(){return 'base-cron';}};
 const layer=crearCapaPcV10(base,{css,js});
 return {layer,base,calls:()=>calls,last:()=>last};
}
test('gate apagado devuelve objeto original, sin alteraciones',async()=>{
 const original=new Response(html,{headers});
 const base={fetch(){return original}};
 const layer=crearCapaPcV10(base,{css,js});
 assert.equal(await layer.fetch(new Request(origin+'/cotizar/archivos'),{},{}),original);
});
test('capa activa solo añade CSS/JS; quitar ambos devuelve byte por byte el HTML',async()=>{
 const s=setup(),req=new Request(origin+'/cotizar/archivos'),ctx={};
 const out=await s.layer.fetch(req,on,ctx);
 assert.equal(out.headers.get('Content-Security-Policy'),csp);
 assert.equal(out.headers.get('X-Content-Type-Options'),'nosniff');
 const modified=await out.text();
 assert.match(modified,/id="saber-pc-v10-layer-css"/);
 assert.match(modified,/id="saber-pc-v10-layer-js"/);
 assert.equal(modified.replace(/<style id="saber-pc-v10-layer-css">[\s\S]*?<\/style>/,'').replace(/<script id="saber-pc-v10-layer-js">[\s\S]*?<\/script>/,''),html);
 assert.equal(s.calls(),1);
 assert.deepEqual(s.last(),{req,env:on,ctx});
});
test('rutas de precio, pago, transferencia, archivos y seguimiento no se interceptan',async()=>{
 for(const path of ['/cotizar','/cotizar/movil.js','/cotizar/archivos.js','/api/pedido/live/cotizar','/api/pedido/live/checkout','/api/pedido/live/transfer','/api/pedido/live/tus/iniciar','/api/pedido/live/r2/iniciar','/personal/central','/pedido/estado']){
  const s=setup(),res=await s.layer.fetch(new Request(origin+path),on,{});
  assert.equal(await res.text(),html,path);assert.equal(s.calls(),1);
 }
});
test('móvil explícito, otro origen y métodos no GET quedan intactos',async()=>{
 for(const req of [new Request(origin+'/cotizar/archivos?vista=movil'),new Request('https://example.invalid/cotizar/archivos'),new Request(origin+'/cotizar/archivos',{method:'POST'})]){
  const s=setup(),res=await s.layer.fetch(req,on,{});assert.equal(await res.text(),html);
 }
});
test('el rechazo de acceso original no se transforma',async()=>{
 const s=setup('Acceso denegado',503);
 const res=await s.layer.fetch(new Request(origin+'/cotizar/archivos'),on,{});
 assert.equal(res.status,503);assert.equal(await res.text(),'Acceso denegado');
});
test('HTML no reconocido o CSP diferente vuelve al original',async()=>{
 for(const [body,head] of [[html.replace('id="lista"','id="otro"'),headers],[html,{...headers,'Content-Security-Policy':"script-src 'self'; style-src 'unsafe-inline'"}],[html,{...headers,'Content-Security-Policy':csp+"; script-src-elem 'self'"}]]){
  const s=setup(body,200,head),res=await s.layer.fetch(new Request(origin+'/cotizar/archivos'),on,{});
  assert.equal(await res.text(),body);
 }
});
test('ejecución original programada y otros handlers conservados',()=>{
 const s=setup();assert.equal(s.layer.scheduled,s.base.scheduled);assert.equal(s.layer.scheduled(),'base-cron');
});
