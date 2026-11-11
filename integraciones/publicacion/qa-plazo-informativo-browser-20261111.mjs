/** QA de lectura real del plazo en presupuesto, sin subir PDF, crear pedido ni cobrar. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const password=process.env.SABER_OPERATOR_TEST_PASSWORD;
assert.ok(password,'Falta la clave operativa del ambiente de prueba');
const base='https://saber-documentos-pruebas.libreriasaber.workers.dev';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({httpCredentials:{username:'operador',password},
  viewport:{width:390,height:844}});
 const jsErrors=[];
 page.on('pageerror',e=>jsErrors.push(String(e.message).slice(0,180)));
 const api=await page.request.get(base+'/prueba-v2/api/plazo-produccion');
 assert.equal(api.status(),200,'Central no entregó previsión del local');
 const plan=await api.json();
 assert.equal(plan.ok,true);
 assert.equal(plan.guaranteed,false);
 assert.equal(plan.exactReadyAt,null);
 const r=await page.goto(base+'/prueba-v2/',{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(r?.status(),200,'No cargó cotizador privado');
 const line=page.locator('#plazo-produccion-orientativo');
 await line.waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>{
  const s=document.querySelector('#plazo-produccion-orientativo')?.textContent||'';
  return s.includes('Fecha a confirmar')||/^\\d{2}\\/\\d{2}\\/20\\d{2}$/.test(s.trim());
 },{timeout:15000});
 const rendered=(await line.innerText()).trim();
 const expected=typeof plan.estimatedDeadlineDate==='string'?
  plan.estimatedDeadlineDate.split('-').reverse().join('/'):'Fecha a confirmar';
 assert.equal(rendered,expected,'Fecha visible no coincide con el calendario Central');
 const fontSize=await line.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 assert.ok(fontSize>=20,'Fuente de fecha demasiado pequeña: '+fontSize+'px');
 const priceFont=await page.locator('#precio-smart').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 assert.ok(priceFont>=20,'Fuente del precio demasiado pequeña: '+priceFont+'px');
 const footnote=await page.locator('#aclaracion-plazo').innerText();
 assert.ok(footnote.includes('acreditación del pago'),'Falta aclarar cuándo inicia el plazo');
 assert.ok(footnote.includes('fecha y hora'),'Falta aclarar cuándo se confirma el horario');
 if(plan.dayPromotion){
  const promo=await page.locator('#promocion-dia-resumen').innerText();
  assert.ok(promo.includes(plan.dayPromotion.title),'Promoción del día no informada');
  assert.ok(promo.includes('No descontada'),'Se promete un descuento no aplicado');
 }
 assert.equal(jsErrors.length,0,'Fallo JavaScript: '+jsErrors.join(' | '));
 console.log('PLAZO_PRESUPUESTO_BROWSER_VISIBLE_MATCHES_CENTRAL');
 console.log('PLAZO_NO_ORDER_NO_PAYMENT_NO_DEPLOY');
}finally{await browser.close()}
