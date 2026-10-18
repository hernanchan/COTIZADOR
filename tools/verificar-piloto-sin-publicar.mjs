// Diagnóstico de solo lectura para el piloto aislado de pagos y Polaroids.
// Node 20+. No sube fotos, crea pedidos, cobra, toca D1 ni modifica Cloudflare.
// Uso: node tools/verificar-piloto-sin-publicar.mjs
import assert from 'node:assert/strict';

const pilotHost='polaroids-integracion-sin-r2.libreriasaber.pages.dev';
const pilotOrigin='https://'+pilotHost;
const paymentsOrigin='https://saber-pagos-pruebas.libreriasaber.workers.dev';
const expectedScript='https://script.google.com/macros/s/AKfycbzF2lx1Q0qmVOoshCigtQQaMmR4IF0kiT8vK_3fwBGgwXgpUW8CixpDJoprhLuOxv20/exec';

async function readJSON(url){
 const response=await fetch(url,{method:'GET',cache:'no-store',redirect:'error',
  headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 assert.equal(response.status,200,'HTTP '+response.status+' al consultar '+new URL(url).pathname);
 const ct=response.headers.get('content-type')||'';
 assert.match(ct,/application\/json/i,'Respuesta no JSON en '+new URL(url).pathname);
 return response.json();
}
const checks=[
 ['Configuración de recepción del piloto',async()=>{
   const config=await readJSON(pilotOrigin+'/pruebas/polaroids/recepcion-config.json');
   assert.equal(config.enabled,true,'El piloto Polaroids está apagado');
   assert.equal(config.allowedHost,pilotHost,'El hostname autorizado no coincide');
   assert.equal(config.bridgeUrl,expectedScript,'El Apps Script configurado no es el esperado');
   return 'host, switch y Apps Script coinciden';
 }],
 ['Receptor de Cloudflare Pages',async()=>{
   const info=await readJSON(pilotOrigin+'/api/polaroids-receiver');
   assert.equal(info.ok,true,'El receptor respondió sin OK');
   assert.equal(info.route,'polaroids-receiver','Ruta del receptor incorrecta');
   assert.equal(info.testOnly,true,'No se identificó como receptor exclusivo de pruebas');
   assert.equal(info.receptionEnabled,true,'Cloudflare tiene la recepción pausada');
   return 'ruta y recepción de prueba disponibles';
 }],
 ['Worker de Mercado Pago (solo salud)',async()=>{
   const info=await readJSON(paymentsOrigin+'/health');
   assert.equal(info.ok,true,'El Worker no respondió OK');
   assert.equal(info.environment,'test','El Worker no se identificó como ensayo');
   assert.equal(info.databaseReady,true,'La D1 de pruebas no está preparada');
   assert.equal(info.configured,true,'Falta configuración del Worker de pruebas');
   return 'Worker configurado y D1 de pruebas accesible';
 }]
];
let failed=false;
for(const [label,check]of checks){
 try{console.log('PASS:',label,'—',await check())}
 catch(error){failed=true;console.error('FALLO:',label,'—',String(error?.message||error).slice(0,300))}
}
console.log(failed?
 'No iniciar cargas ni cobros de prueba hasta resolver los fallos anteriores.':
 'Solo comprobaciones GET correctas. NO certifica subida, PDF, Google ni pago.');
if(failed)process.exitCode=1;
