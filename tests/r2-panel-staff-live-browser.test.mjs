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
 ].join('\n')+'\n'+source.replace(/^import .*?;\s*$/gm,'')
 .replace('export function paginaPaqueteUniversalPersonal(){',
 'function paginaPaqueteUniversalPersonal(){')+
 '\nglobalThis.paginaPaqueteUniversalPersonal=paginaPaqueteUniversalPersonal;';
const ctx=vm.createContext({});
vm.runInContext(compiled,ctx);
const html=ctx.paginaPaqueteUniversalPersonal();

test('la página operativa completa compila con un solo botón ZIP',()=>{
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 assert.doesNotThrow(()=>new vm.Script(scripts[0][1]));
 assert.match(html,/<button id="zip" disabled>Descargar ZIP completo<\/button>/);
 assert.doesNotMatch(html,/id="r2Inspeccion"|id="r2Recargar"|id="r2Operador"/);
 assert.match(html,/PREPRENSA PENDIENTE/);
});
test('el operador no recibe pantallas de TUS, R2 ni medidas manuales',()=>{
 const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 assert.doesNotMatch(code,/live-r2-inspection-original|live-r2-inspection-confirm/);
 assert.doesNotMatch(code,/r2Verificado|r2Operador|measuredDimensions/);
 assert.match(read('paquete-universal-cliente.mjs'),/validarZIPDeProduccion/);
 assert.doesNotMatch(code,/getPublicUrl|service_role|MP_LIVE_ACCESS_TOKEN/);
});
