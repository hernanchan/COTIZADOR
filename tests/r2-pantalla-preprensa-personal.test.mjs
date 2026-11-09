import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
// Esta página incorpora scripts .txt mediante esbuild (text loader) en Workers.
// Node no importa .txt; evaluar la plantilla con sus scripts como cadenas
// conserva la misma página y permite comprobar la sintaxis resultante.
const base='../integraciones/autocotizador/recepcion/';
const read=name=>readFileSync(new URL(base+name,import.meta.url),'utf8');
const source=read('pantalla-r2-preprensa-personal.mjs');
const injected=[
 "const zipJs="+JSON.stringify(read('zip-tus-cliente.txt'))+";",
 "const pdfOrdenJs="+JSON.stringify(read('pdf-orden-tus-cliente.txt'))+";",
 "const pdfHojaR2Js="+JSON.stringify(read('pdf-hoja-r2-preprensa.txt'))+";"
].join('\n');
const script=injected+'\n'+source.replace(/^import .*?;\s*$/gm,'')
 .replace('export function paginaR2PreprensaPersonal(){',
 'function paginaR2PreprensaPersonal(){')+
 '\nglobalThis.paginaR2PreprensaPersonal=paginaR2PreprensaPersonal;';
const ctx=vm.createContext({});
vm.runInContext(script,ctx);
const paginaR2PreprensaPersonal=ctx.paginaR2PreprensaPersonal;

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
 const originalButtonHandler=html.slice(html.indexOf("button.addEventListener('click'"));
 assert.ok(originalButtonHandler.indexOf('window.showSaveFilePicker')<
  originalButtonHandler.indexOf("await fetch('/prueba-v2/api/ensayo-r2-descargar-d1-personal'"),
  'el selector de archivos debe abrirse antes de perder activación del clic');
 assert.doesNotMatch(html,/Authorization:\s*'Bearer|access_token|service_role/);
});

test('Página de preprensa R2 ofrece ZIP privado con PDF original y hoja A4, sin habilitar impresión',()=>{
 const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/pantalla-r2-preprensa-personal.mjs',import.meta.url),'utf8');
 assert.match(source,/pdf-hoja-r2-preprensa\.txt/);
 assert.match(source,/zip-tus-cliente\.txt/);
 assert.match(source,/ZIP de revisión/);
 assert.match(source,/ensayo-r2-descargar-d1-personal/);
 assert.match(source,/NO imprimir/);
 assert.doesNotMatch(source,/getPublicUrl|service_role|R2_GRANDES\.get/i);
});
