import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {paginaR2PreprensaPersonal} from '../integraciones/autocotizador/recepcion/pantalla-r2-preprensa-personal.mjs';

test('Mostrador: página R2 advierte de preprensa, no libera producción ni pagos',()=>{
 const html=paginaR2PreprensaPersonal();
 assert.match(html,/<button id="download" disabled>/);
 assert.match(html,/Revisión de preprensa obligatoria/);
 assert.match(html,/NO IMPRIMIR sin aprobar la orden/);
 assert.match(html,/ensayo-r2-descargar-d1-personal/);
 assert.doesNotMatch(html,/mercadopago\.com|storage\.supabase\.co|<iframe|bucket\.r2/);
 const match=html.match(/<script>([\s\S]+?)<\/script>/);
 assert.ok(match);
 assert.doesNotThrow(()=>new vm.Script(match[1]));
});
test('Navegador: único enlace resuelve servidor con POST, sin URL pública R2',()=>{
 const html=paginaR2PreprensaPersonal();
 assert.match(html,/credentials:'same-origin'/);
 assert.match(html,/method:'POST'/);
 assert.match(html,/response\.blob|res\.blob\(/);
 assert.match(html,/showSaveFilePicker/);
 assert.match(html,/read\!\=size|read!==size/);
 assert.match(html,/Original recibido por R2/);
 assert.ok(html.indexOf('window.showSaveFilePicker')<html.indexOf("await fetch('/prueba-v2/api/ensayo-r2-descargar-d1-personal'"),
  'el selector de archivos debe abrirse antes de perder activación del clic');
 assert.doesNotMatch(html,/Authorization:\s*'Bearer|access_token|service_role/);
});
