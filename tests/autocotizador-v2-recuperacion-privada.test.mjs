import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';
const html=paginaCotizadorV2PruebaPrivada('0x4AAAAA_PRIVATESITEKEY_0123456789');
const match=html.match(/<script type="module">([\s\S]*?)<\/script>/);
test('script del portal V2 se analiza sintácticamente en el navegador',()=>{
 assert.ok(match,'Debe existir script de módulo');
 const clean=match[1].replace(/^import[^\n]*;\s*/m,'');
 assert.doesNotThrow(()=>new vm.Script(clean),'JavaScript de la pantalla debe parsear');
});
test('recupera solo referencias PDF, nunca bytes ni credenciales',()=>{
 assert.match(html,/const RECOVERY_KEY='saber-v2-ensayo-metadatos-v1'/);
 assert.match(html,/sessionStorage\.getItem\(RECOVERY_KEY\)/);
 assert.match(html,/sessionStorage\.setItem\(RECOVERY_KEY,encoded\)/);
 assert.match(html,/const previous=restore\(\),orderId=previous\?\.orderId\|\|newOrderId\(\)/);
 assert.match(html,/all\.push\(\{name:p\.name,price:p\.price,references:refs\}\);\s*save\(\)/);
 assert.match(html,/r\.estado==='PENDIENTE_DE_ENVIO'&&r\.recibido===false/);
 assert.match(html,/Date\.now\(\)-state\.savedAt>RECOVERY_MAX_AGE/);
 const save=html.slice(html.indexOf('function save(){'),html.indexOf('const catalogPromise='));
 assert.doesNotMatch(save,/dataBase64|uploadToken|turnstileToken|session\.token|File\(|arrayBuffer/);
 assert.match(html,/Volvé a seleccionar cada PDF/);
});


test('la recuperación contabiliza hasta 30 PDF entre todos los trabajos, no por línea',()=>{
 assert.match(html,/let totalReferences=0/);
 assert.match(html,/totalReferences\+\+/);
 assert.match(html,/if\(totalReferences>30\)return null/);
 assert.match(html,/Carrito recuperado:/);
 assert.match(html,/Ningún pago ni pedido quedó confirmado/);
});


test('restauración ejecutada: admite 30 referencias pero descarta 31 repartidas en varios trabajos',()=>{
 const source=match[1];
 const beginning=source.indexOf('const RECOVERY_KEY=');
 const end=source.indexOf('const previous=restore()');
 assert.ok(beginning>=0&&end>beginning);
 const code=source.slice(beginning,end)+'\nglobalThis.testRestore=restore;';
 let saved='';
 const ctx=vm.createContext({
  Date,sessionStorage:{getItem(){return saved}},
  crypto:{getRandomValues(bytes){return bytes}},
  console
 });
 new vm.Script(code).runInContext(ctx);
 const reference=n=>({
  schema:'saber-pdf-local-pendiente-v1',
  localRef:'12345678-1234-4234-8234-'+String(n).padStart(12,'0'),
  nombre:'doc-'+n+'.pdf',bytes:200,paginas:1,sha256:String(n).padStart(64,'a'),
  estado:'PENDIENTE_DE_ENVIO',recibido:false,verificadoServidor:false
 });
 const orderId='WEB-ENSAYO-'+('A'.repeat(32));
 const make=count=>JSON.stringify({orderId,savedAt:Date.now(),
  items:Array.from({length:Math.ceil(count/10)},(_,i)=>({
   name:'Trabajo '+i,price:500,
   references:Array.from({length:Math.min(10,count-i*10)},(_,j)=>({
    itemIndex:j,reference:reference(i*10+j+1)
   }))
  }))
 });
 saved=make(30);
 const recovered=ctx.testRestore();
 assert.equal(recovered.items.length,3);
 assert.equal(recovered.seen.size,30);
 saved=make(31);
 assert.equal(ctx.testRestore(),null);
});
