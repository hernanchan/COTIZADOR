import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const root='../integraciones/autocotizador/recepcion/';
const read=name=>readFileSync(new URL(root+name,import.meta.url),'utf8');
const source=read('pantalla-paquete-universal-personal.mjs');
const compiled=[
 'const zipJs='+JSON.stringify(read('zip-tus-cliente.txt'))+';',
 'const pdfJs='+JSON.stringify(read('pdf-orden-tus-cliente.txt'))+';',
 // El bundle se genera al compilar; QA aislada usa vacío y el deploy exige el bundle real.
 'const universalJs='+JSON.stringify(existsSync(new URL(root+'paquete-universal-cliente.txt',import.meta.url))?
  read('paquete-universal-cliente.txt'):'')+';',
 'const staffR2Js='+JSON.stringify(read('staff-r2-personal-ui.txt'))+';'
].join('\n')+'\n'+source.replace(/^import .*?;\s*$/gm,'')
 .replace('export function paginaPaqueteUniversalPersonal(){',
 'function paginaPaqueteUniversalPersonal(){')+
 '\nglobalThis.paginaPaqueteUniversalPersonal=paginaPaqueteUniversalPersonal;';
const ctx=vm.createContext({});
vm.runInContext(compiled,ctx);
const html=ctx.paginaPaqueteUniversalPersonal();

test('la página de personal completa compila en navegador sin script roto',()=>{
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 assert.doesNotThrow(()=>new vm.Script(scripts[0][1]));
 assert.doesNotMatch(scripts[0][1],/\}\)\(\);\+x\.amountArs/);
 assert.match(scripts[0][1],/r2Inspeccion/);
 assert.match(scripts[0][1],/live-r2-inspection-original/);
 assert.match(scripts[0][1],/live-r2-inspection-confirm/);
 assert.match(html,/<button type="button" id="r2Recargar">/);
 assert.match(html,/PREPRENSA PENDIENTE/);
});

test('interfaz R2 exige verificación humana antes de enviar confirmación',()=>{
 const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 assert.match(code,/r2Verificado/);
 assert.match(code,/r2Operador/);
 assert.match(code,/measuredDimensions/);
 assert.match(code,/confirmed:true/);
 assert.doesNotMatch(code,/getPublicUrl|service_role|MP_LIVE_ACCESS_TOKEN/);
});
