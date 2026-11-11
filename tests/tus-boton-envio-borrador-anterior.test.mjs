import test from 'node:test';
import assert from 'node:assert/strict';
import {paginaCotizadorV2PruebaPrivada} from '../integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs';
const html=paginaCotizadorV2PruebaPrivada('test-sitekey-1234567890',true,{invalidos:[]},true);
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]||'';
const begin=script.indexOf('function borradorAnteriorSinPDF(){');
const end=script.indexOf('function updateSummary(){',begin);
assert.ok(begin>0&&end>begin,'No se encontró separación de borrador y botón de envío');
const block=script.slice(begin,end);

function probar({smartReady=true,preflight=true,blocked=false,all=[],refsConfirmadas=false}={}){
 let orderId='OLD-ORDER',clientOrderId='OLD-CLIENT';
 const used=new Set(['oldref']),removed=[];
 const sessionStorage={removeItem:key=>removed.push(key)};
 const TUS_ENABLED=true,TUS_BLOCKED=blocked,tusPreflightOK=preflight;
 const batchSending=false,registering=false,handoffInProgress=false,registeredOrder=null,smartBlockedReason='';
 const newOrderId=()=> 'WEB-ENSAYO-NEW',newClientOrderId=()=> 'NEW-CLIENT';
 const RECOVERY_KEY='saber-v2-ensayo-metadatos-v1';
 const fn=new Function('all','used','sessionStorage','smartReady','TUS_ENABLED','TUS_BLOCKED','tusPreflightOK',
  'batchSending','registering','handoffInProgress','registeredOrder','smartBlockedReason','newOrderId',
  'newClientOrderId','RECOVERY_KEY',
  'let orderId="OLD-ORDER",clientOrderId="OLD-CLIENT";'+block+'\n'+
  'return {reason:motivoBloqueoEnvio(),discarded:descartarBorradorAnteriorParaPedidoNuevo(),'+
  'all,orderId,clientOrderId};');
 const result=fn(all,used,sessionStorage,smartReady,TUS_ENABLED,TUS_BLOCKED,tusPreflightOK,
  batchSending,registering,handoffInProgress,registeredOrder,smartBlockedReason,newOrderId,newClientOrderId,RECOVERY_KEY);
 return {...result,removed,used};
}

test('PDF nuevo cotizado habilita envío sin borrar datos del PDF actual',()=>{
 const q=probar();
 assert.equal(q.reason,'');
 assert.equal(q.discarded,false);
 assert.equal(q.orderId,'OLD-ORDER');
});
test('borrador anterior sin File no bloquea el PDF nuevo ni mezcla identificadores',()=>{
 const borrador=[{name:'antiguo.pdf',references:[{reference:{nombre:'antiguo.pdf'}}]}];
 const q=probar({all:borrador});
 assert.equal(q.reason,'');
 assert.equal(q.discarded,true);
 assert.equal(q.all.length,0);
 assert.equal(q.used.size,0);
 assert.equal(q.orderId,'WEB-ENSAYO-NEW');
 assert.equal(q.clientOrderId,'NEW-CLIENT');
 assert.deepEqual(q.removed,['saber-v2-ensayo-metadatos-v1']);
});
test('el preflight TUS fallido prevalece aunque haya presupuesto válido',()=>{
 const q=probar({preflight:false});
 assert.match(q.reason,/conexión privada/);
});
test('no habilita enviar si aún no terminó la cotización',()=>{
 const q=probar({smartReady:false});
 assert.match(q.reason,/presupuesto completo/);
});
test('un envío en curso no se reactiva por mensajes nuevos del iframe',()=>{
 assert.match(script,/if\(batchSending\)return 'Los archivos se están enviando\.'/);
 assert.match(script,/sendAllButton.disabled=Boolean\(batchSending\|\|registering\|\|handoffInProgress\|\|registeredOrder\)/);
 assert.match(script,/const razon=motivoBloqueoEnvio\(\)/);
 assert.match(script,/if\(TUS_ENABLED&&!tusPreflightOK\)await verificarDisponibilidadTUS\(\)/);
 assert.match(script,/if\(razon\)\{/);
 assert.match(script,/if\(descartarBorradorAnteriorParaPedidoNuevo\(\)\)/);
});


test('si la precarga falla, el botón permite diagnosticar sin saltar controles de envío',()=>{
 assert.match(script,/tusPreflightError=String\(error\?\.message\|\|error\)/);
 assert.match(script,/verificarDisponibilidadTUS\(\)/);
 assert.match(script,/El pedido todavía no se puede enviar:/);
 assert.match(script,/if\(razon\)\{[\s\S]*?return;/);
 assert.ok(script.indexOf('const razon=motivoBloqueoEnvio()')<script.indexOf('if(!nombreValido())'));
});


test('la pantalla declara cada contacto ANTES de instalar listeners y activar envío',()=>{
 const telefono=script.indexOf("const telefonoContacto=document.getElementById('cliente-telefono');");
 const nombre=script.indexOf("const nombreCliente=document.getElementById('cliente-nombre');");
 const direccion=script.indexOf("const direccionCliente=document.getElementById('cliente-direccion');");
 const listener=script.indexOf("telefonoContacto.addEventListener('input'");
 const enviar=script.indexOf("sendAllButton.addEventListener('click'");
 assert.ok(telefono>0&&nombre>0&&direccion>0,'Falta referencia DOM obligatoria; se rompe todo el módulo');
 assert.ok(listener>telefono&&enviar>listener,'Referencia de teléfono debe existir antes de utilizarse');
 assert.match(script,/const telefonoError=document.getElementById\\('cliente-telefono-error'\\)/);
});
