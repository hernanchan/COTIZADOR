import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const file=path=>new URL(path,root);
const text=path=>readFileSync(file(path),'utf8');

test('las rutas temporales de HMAC no se exponen en Pages ni en la web base',()=>{
 for(const path of [
  'integraciones/polaroids/express/public/pruebas/puente-hmac.html',
  'integraciones/polaroids/express/functions/api/express-bridge-check.js',
  'functions/api/express-bridge-check.js'
 ])assert.equal(existsSync(file(path)),false,path+' aún expuesto');
});

test('la configuración Express conserva bloqueada recepción, tienda y activación',()=>{
 const config=JSON.parse(text('integraciones/polaroids/express/public/polaroids/recepcion-config.json'));
 assert.equal(config.enabled,false);
 assert.equal(config.showInShop,false);
 assert.equal(config.rollout,'PENDIENTE_DE_APROBACION');
 assert.equal(config.allowedHost,'saber-polaroids-express-pruebas.pages.dev');
 assert.equal(config.maxSheetsForRealUploads,4);
 assert.equal(config.turnstileSiteKey,'');
});

test('el endpoint de fotos sigue protegido por bloqueos independientes',()=>{
 const worker=text('integraciones/polaroids/express/worker-express.mjs');
 for(const guard of [
  "env?.EXPRESS_RECEPTION_ENABLED!=='PRIVATE_TEST_ONLY'",
  "env?.EXPRESS_PDF_ENABLED!=='PRIVATE_TEST_ONLY'",
  "env?.EXPRESS_CENTRAL_SYNC_ENABLED!=='PRIVATE_TEST_ONLY'",
  "data?.enabled===true",
  "data.rollout==='APROBADO'",
  "return json({ok:false,error:'Polaroids Express todavía no está habilitado.'},503)"
 ])assert.ok(worker.includes(guard),'Falta bloqueo de recepción: '+guard);
 assert.ok(worker.includes('pdfForClient:false'));
});

test('la comunicación operativa utiliza binding interno y no expone PDF al cliente',()=>{
 const sender=text('integraciones/polaroids/express/enviar-central-express.mjs');
 assert.ok(sender.includes("env?.SABER_CENTRAL"));
 assert.ok(sender.includes('service.fetch(new Request(url.href,options))'));
 const pdf=text('integraciones/polaroids/express/guardar-pdf-privado.mjs');
 assert.ok(pdf.includes("env?.EXPRESS_PDF_ENABLED!=='PRIVATE_TEST_ONLY'"));
 assert.ok(pdf.includes("url.hostname!=='script.google.com'"));
});
