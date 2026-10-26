import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';
const html=paginaCotizadorV2PruebaPrivada('0x4AAAAA_PRIVATESITEKEY_0123456789');
const match=html.match(/<script type="module">([\s\S]*?)<\/script>/);
test('script del portal V2 se analiza sintácticamente en el navegador',()=>{
 assert.ok(match,'Debe existir script de módulo');
 const clean=match[1].replace(/^import\s+\{[^}]+\}\s+from\s+[^;]+;\s*/,'');
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
