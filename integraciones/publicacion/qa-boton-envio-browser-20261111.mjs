/** Prueba real sin enviar ningún PDF ni generar pedido/pago. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const password=process.env.SABER_OPERATOR_TEST_PASSWORD;
assert.ok(password&&password.length>0,'Falta credencial de operador de QA');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({httpCredentials:{username:'operador',password},viewport:{width:1366,height:900}});
 const errors=[];
 page.on('pageerror',err=>errors.push(String(err.message).slice(0,180)));
 const response=await page.goto(base+'/prueba-v2/',{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(response?.status(),200,'No se abrió la pantalla protegida de cotizador');
 const button=page.locator('#send-all-pdf');
 await button.waitFor({state:'visible',timeout:15000});
 await page.waitForTimeout(2500);
 assert.equal(await button.isDisabled(),false,'El botón está gris; el módulo de cotizador no inició');
 assert.ok(!errors.some(x=>x.includes('telefonoContacto')||x.includes('ReferenceError')),'Error JavaScript del formulario: '+errors.join(' | '));
 await button.click();
 await page.waitForTimeout(700);
 const progress=await page.locator('#batch-progress').innerText();
 assert.match(progress,/todavía no se puede enviar|presupuesto completo|presupuesto no está listo|cotiz/i,
  'No informa por qué no se puede enviar sin cotización');
 assert.equal(await button.isDisabled(),false,'El botón quedó bloqueado tras un intento inválido');
 console.log('BROWSER_BUTTON_ENABLED_NO_REFERENCE_ERROR_NO_ORDER_NO_PAYMENT');
 console.log('BROWSER_SAFE_VALIDATION_MESSAGE_OK');
}finally{await browser.close()}
